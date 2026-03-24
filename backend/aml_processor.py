import pandas as pd
from sklearn.ensemble import IsolationForest
import networkx as nx
import time
import uuid

def append_reason(existing_reason, new_reason):
    if not existing_reason or pd.isna(existing_reason):
        return new_reason
    existing_list = [r.strip() for r in str(existing_reason).split(',')]
    if new_reason not in existing_list:
        existing_list.append(new_reason)
    return ", ".join(existing_list)

class AMLProcessor:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def run(self, batch_id=None, progress_callback=None):
        def p(prog, msg):
            print(msg)
            if progress_callback:
                progress_callback(prog, msg)

        t0 = time.time()
        p(5, "Fetching records from Supabase...")
        
        query = self.supabase.table("transactions").select("*").limit(100000)
        if batch_id:
            query = query.eq("batch_id", batch_id)
        else:
            query = query.is_("flagged", "null")
            
        response = query.execute()
        data = response.data
        
        if not data:
            print("No transactions found or failed to fetch.")
            return {"processed": 0, "flagged": 0, "alerts_created": 0, "duration_seconds": time.time() - t0}
            
        df = pd.DataFrame(data)
        p(15, f"Loaded {len(df)} transactions into pandas DataFrame.")

        if 'flagged' not in df.columns:
            df['flagged'] = False
        else:
            df['flagged'] = df['flagged'].fillna(False).astype(bool)
            
        if 'flag_reason' not in df.columns:
            df['flag_reason'] = ""
        if 'rule_triggered' not in df.columns:
            df['rule_triggered'] = ""
            
        # 1. Geo-Risk: Flag if country_risk_level == 'High'.
        if 'country_risk_level' in df.columns:
            p(20, "Applying Geo-Risk rule...")
            for idx, row in df.iterrows():
                if str(row['country_risk_level']).strip().lower() == 'high':
                    df.at[idx, 'flagged'] = True
                    df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Geographic Risk')
                    if not df.at[idx, 'rule_triggered']:
                         df.at[idx, 'rule_triggered'] = 'Geographic Risk'

        # 2. Dormancy: Flag if days_since_last_transaction > 30 (Calculate from transaction_date if missing)
        if 'days_since_last_transaction' in df.columns or 'transaction_date' in df.columns:
            p(30, "Applying Dormancy Activation rule...")
            t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'
            u_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'
            
            if 'days_since_last_transaction' not in df.columns and t_col in df.columns and u_col in df.columns:
                # Calculate gap for each transaction vs the previous one for that user
                df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
                df = df.sort_values([u_col, 'Date_Temp'])
                df['days_since_last_transaction'] = df.groupby(u_col)['Date_Temp'].diff().dt.days
                print("Calculated days_since_last_transaction from transaction history.")

            for idx, row in df.iterrows():
                try:
                    days_since_last = float(row.get('days_since_last_transaction', 0))
                    if pd.notna(days_since_last) and days_since_last > 30: # Lowered threshold to 30 days
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Dormancy Activation')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Dormancy Activation'
                except (ValueError, TypeError):
                    pass

        # 3. Structuring: Use a 7-day rolling window. (Mapping for customer_id/transaction_date)
        # Ensure we use available columns for user identity and time
        u_col = 'user_id' if 'user_id' in df.columns else 'customer_id'
        t_col = 'timestamp' if 'timestamp' in df.columns else 'transaction_date'
        
        if all(col in df.columns for col in [u_col, t_col, 'amount']):
            p(40, "Applying Structuring rule...")
            df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
            for user_id, user_data in df.groupby(u_col):
                # Sort chronologically
                user_data = user_data.dropna(subset=['Date_Temp']).sort_values(by='Date_Temp')
                
                user_idx = user_data.set_index('Date_Temp')
                user_idx['amount_num'] = pd.to_numeric(user_idx['amount'], errors='coerce').fillna(0)
                
                rolling_sums = user_idx['amount_num'].rolling('7d').sum().values
                rolling_counts = user_idx['amount_num'].rolling('7d').count().values
                v_current_amounts = user_idx['amount_num'].values
                
                for mem_i, idx in enumerate(user_data.index):
                    if rolling_sums[mem_i] > 50000 and v_current_amounts[mem_i] < 50000 and rolling_counts[mem_i] >= 3:
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Structuring')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Structuring'

            df.drop(columns=['Date_Temp'], inplace=True, errors='ignore')

        # 4. Spike Detection: Use IsolationForest on the amount and transaction_frequency_1hr columns.
        t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'
        u_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'
        
        if 'amount' in df.columns and (t_col in df.columns or 'transaction_frequency_1hr' in df.columns):
            p(60, "Applying Velocity Spike rule...")
            if 'transaction_frequency_1hr' not in df.columns and t_col in df.columns and u_col in df.columns:
                 df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
                 df = df.sort_values([u_col, 'Date_Temp'])
                 df['dummy_count'] = 1
                 freqs = []
                 for user, group in df.groupby(u_col):
                     group_idx = group.set_index('Date_Temp')
                     # Count occurrences in a 1-hour window for this user over time
                     counts = group_idx['dummy_count'].rolling('1h').sum().values
                     freqs.extend(counts)
                 
                 df['transaction_frequency_1hr'] = freqs
                 print("Calculated transaction_frequency_1hr from history (Fast).")

            # Prepare the data and safely handle NaNs/Non-numerics
            X = df[['amount', 'transaction_frequency_1hr']].apply(pd.to_numeric, errors='coerce').fillna(0)
            
            if len(X) > 0:
                clf = IsolationForest(contamination=0.10, random_state=42) # Increased contamination rate from 5% to 10%
                preds = clf.fit_predict(X)
                
                for idx, pred in zip(df.index, preds):
                    if pred == -1: # Outlier detected (-1)
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Velocity Spike')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Velocity Spike'

        # 5. Layering: Create a directed graph with user_id and destination_id to find circular transfers.
        u_col = 'user_id' if 'user_id' in df.columns else 'customer_id'
        v_col = 'destination_id' if 'destination_id' in df.columns else None
        
        if v_col and u_col in df.columns and v_col in df.columns:
            p(80, "Applying Layering rule...")
            G = nx.DiGraph()
            
            for idx, row in df.iterrows():
                u = row[u_col]
                v = row[v_col]
                if pd.notna(u) and pd.notna(v):
                    # We can store a list of indices in case of multiple transactions between same nodes
                    if G.has_edge(u, v):
                        G[u][v]['indices'].append(idx)
                    else:
                        G.add_edge(u, v, indices=[idx])
            
            try:
                cycles = list(nx.simple_cycles(G))
                for cycle_item in cycles:
                    cycle_list = list(cycle_item) # Type-hint workaround
                    if len(cycle_list) > 1: # Flag cycles length roughly > 1 (e.g., A -> B -> A, or A -> B -> C -> A)
                        for i in range(len(cycle_list)):
                            u = cycle_list[i]
                            v = cycle_list[(i + 1) % len(cycle_list)]
                            edge_data = G.get_edge_data(u, v)
                            if edge_data and 'indices' in edge_data:
                                for idx in edge_data['indices']:
                                    df.at[idx, 'flagged'] = True
                                    df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Layering')
                                    if not df.at[idx, 'rule_triggered']:
                                        df.at[idx, 'rule_triggered'] = 'Layering'
            except Exception as e:
                print(f"Error executing Layering detection: {e}")

        # Finalize Output: Push updates to Supabase using individual UPDATE calls
        p(90, "Preparing updates for Supabase...")

        alerts_to_insert = []
        flagged_df = df[df['flagged'] == True]
        clean_df = df[df['flagged'] == False]
        success_count = 0
        fail_count = 0

        if 'transaction_id' in df.columns:
            print(f"Batch clearing {len(clean_df)} clean transactions...")
            clean_ids = clean_df['transaction_id'].dropna().tolist()
            for i in range(0, len(clean_ids), 1000):
                chunk = clean_ids[i:i+1000]
                try:
                    self.supabase.table("transactions").update({
                        'flagged': False,
                        'flag_reason': '',
                        'rule_triggered': ''
                    }).in_("transaction_id", chunk).execute()
                except Exception as e:
                    pass

            print(f"Updating {len(flagged_df)} flagged transactions individually...")            
            for _, row in flagged_df.iterrows():
                if pd.notna(row['transaction_id']):
                    req_update = {
                        'flagged': True,
                        'flag_reason': str(row.get('flag_reason', '')),
                        'rule_triggered': str(row.get('rule_triggered', '')),
                    }
                    try:
                        self.supabase.table("transactions").update(req_update).eq('transaction_id', row['transaction_id']).execute()
                        success_count += 1
                        alerts_to_insert.append({
                            'alert_id': f"ALT-{int(time.time()*1000)}-{str(uuid.uuid4())[:6].upper()}",
                            'customer_id': row.get(u_col, ''),
                            'customer_name': row.get('customer_name', row.get(u_col, '')),
                            'risk_level': 'HIGH',
                            'rule_triggered': str(row.get('rule_triggered', '')),
                            'status': 'open',
                            'transaction_id': row['transaction_id'],
                            'amount': float(row.get('amount', 0)) if pd.notna(row.get('amount')) else 0,
                            'country': str(row.get('country', '')),
                            'created_at': time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
                        })
                    except Exception as e:
                        fail_count += 1

            alerts_created = len(alerts_to_insert)
            if alerts_created > 0:
                 # Batch insert alerts
                 for i in range(0, alerts_created, 100):
                     chunk = alerts_to_insert[i:i+100]
                     try:
                         self.supabase.table("alerts").insert(chunk).execute()
                     except Exception as e:
                         pass
        else:
            print("Notice: No 'transaction_id' column found in DataFrame. Could not update Supabase.")

        duration = time.time() - t0
        return {
            "processed": len(df),
            "flagged": success_count,
            "alerts_created": len(alerts_to_insert),
            "duration_seconds": duration
        }
