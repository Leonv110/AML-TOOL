import pandas as pd
from sklearn.ensemble import IsolationForest
import networkx as nx
import time
import uuid
import psycopg2
import psycopg2.extras

def append_reason(existing_reason, new_reason):
    if not existing_reason or pd.isna(existing_reason):
        return new_reason
    existing_list = [r.strip() for r in str(existing_reason).split(',')]
    if new_reason not in existing_list:
        existing_list.append(new_reason)
    return ", ".join(existing_list)

class AMLProcessor:
    def __init__(self, db_conn):
        self.conn = db_conn

    def run(self, batch_id=None, progress_callback=None):
        def p(prog, msg):
            print(msg)
            if progress_callback:
                progress_callback(prog, msg)

        t0 = time.time()
        p(5, "Fetching records from PostgreSQL...")

        cur = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if batch_id:
            cur.execute("SELECT * FROM transactions WHERE batch_id = %s LIMIT 100000", (batch_id,))
        else:
            cur.execute("SELECT * FROM transactions WHERE flagged IS NULL LIMIT 100000")

        data = cur.fetchall()
        cur.close()

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

        # 2. Dormancy: Flag if days_since_last_transaction > 30
        if 'days_since_last_transaction' in df.columns or 'transaction_date' in df.columns:
            p(30, "Applying Dormancy Activation rule...")
            t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'
            u_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'

            if 'days_since_last_transaction' not in df.columns and t_col in df.columns and u_col in df.columns:
                df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
                df = df.sort_values([u_col, 'Date_Temp'])
                df['days_since_last_transaction'] = df.groupby(u_col)['Date_Temp'].diff().dt.days
                print("Calculated days_since_last_transaction from transaction history.")

            for idx, row in df.iterrows():
                try:
                    days_since_last = float(row.get('days_since_last_transaction', 0))
                    if pd.notna(days_since_last) and days_since_last > 30:
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Dormancy Activation')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Dormancy Activation'
                except (ValueError, TypeError):
                    pass

        # 3. Structuring: Use a 7-day rolling window.
        u_col = 'user_id' if 'user_id' in df.columns else 'customer_id'
        t_col = 'timestamp' if 'timestamp' in df.columns else 'transaction_date'

        if all(col in df.columns for col in [u_col, t_col, 'amount']):
            p(40, "Applying Structuring rule...")
            df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
            for user_id, user_data in df.groupby(u_col):
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

        # 4. Spike Detection: Use IsolationForest
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
                     counts = group_idx['dummy_count'].rolling('1h').sum().values
                     freqs.extend(counts)

                 df['transaction_frequency_1hr'] = freqs
                 print("Calculated transaction_frequency_1hr from history (Fast).")

            X = df[['amount', 'transaction_frequency_1hr']].apply(pd.to_numeric, errors='coerce').fillna(0)

            if len(X) > 0:
                clf = IsolationForest(contamination=0.10, random_state=42)
                preds = clf.fit_predict(X)

                for idx, pred in zip(df.index, preds):
                    if pred == -1:
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Velocity Spike')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Velocity Spike'

        # 5. Layering: Directed graph cycle detection
        u_col = 'user_id' if 'user_id' in df.columns else 'customer_id'
        v_col = 'destination_id' if 'destination_id' in df.columns else None

        if v_col and u_col in df.columns and v_col in df.columns:
            p(80, "Applying Layering rule...")
            G = nx.DiGraph()

            for idx, row in df.iterrows():
                u = row[u_col]
                v = row[v_col]
                if pd.notna(u) and pd.notna(v):
                    if G.has_edge(u, v):
                        G[u][v]['indices'].append(idx)
                    else:
                        G.add_edge(u, v, indices=[idx])

            try:
                cycles = list(nx.simple_cycles(G))
                for cycle_item in cycles:
                    cycle_list = list(cycle_item)
                    if len(cycle_list) > 1:
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

        # 6. Rapid Fund Movement: Flag if > 80% of balance moved out quickly after deposit
        if all(col in df.columns for col in ['amount', 'balance_before', 'balance_after']):
            p(83, "Applying Rapid Fund Movement rule...")
            for idx, row in df.iterrows():
                try:
                    bal_before = float(row.get('balance_before', 0) or 0)
                    bal_after = float(row.get('balance_after', 0) or 0)
                    amt = float(row.get('amount', 0) or 0)
                    if bal_before > 0 and amt > 0:
                        pct_moved = (bal_before - bal_after) / bal_before
                        if pct_moved >= 0.80:
                            df.at[idx, 'flagged'] = True
                            df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Rapid Fund Movement')
                            if not df.at[idx, 'rule_triggered']:
                                df.at[idx, 'rule_triggered'] = 'Rapid Fund Movement'
                except (ValueError, TypeError):
                    pass

        # 7. New Device High Value: Flag high value txn from unrecognised device
        if 'is_new_device' in df.columns and 'amount' in df.columns:
            p(86, "Applying New Device High Value rule...")
            avg_amount = pd.to_numeric(df['amount'], errors='coerce').mean()
            threshold = avg_amount * 2 if avg_amount > 0 else 50000
            for idx, row in df.iterrows():
                try:
                    if row.get('is_new_device') in [True, 'true', 'True', 1, '1']:
                        amt = float(row.get('amount', 0) or 0)
                        if amt >= threshold:
                            df.at[idx, 'flagged'] = True
                            df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'New Device High Value')
                            if not df.at[idx, 'rule_triggered']:
                                df.at[idx, 'rule_triggered'] = 'New Device High Value'
                except (ValueError, TypeError):
                    pass

        # 8. Round Tripping: Same amount +/-5% sent and received from same counterparty within 48hrs
        u_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'
        v_col = 'destination_id' if 'destination_id' in df.columns else None
        t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'

        if v_col and all(c in df.columns for c in [u_col, v_col, 'amount', t_col]):
            p(88, "Applying Round Tripping rule...")
            df['RT_Date'] = pd.to_datetime(df[t_col], errors='coerce')
            df['RT_Amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0)
            
            for idx, row in df.iterrows():
                try:
                    sender = row[u_col]
                    receiver = row[v_col]
                    amt = row['RT_Amount']
                    dt = row['RT_Date']
                    if pd.isna(sender) or pd.isna(receiver) or pd.isna(dt) or amt <= 0:
                        continue
                    
                    # Look for a reverse transaction: receiver -> sender, same amount +/-5%, within 48hrs
                    reverse = df[
                        (df[u_col] == receiver) &
                        (df[v_col] == sender) &
                        (df['RT_Amount'].between(amt * 0.95, amt * 1.05)) &
                        ((df['RT_Date'] - dt).abs() <= pd.Timedelta(hours=48))
                    ]
                    if len(reverse) > 0:
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Round Tripping')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Round Tripping'
                except Exception:
                    pass
            
            df.drop(columns=['RT_Date', 'RT_Amount'], inplace=True, errors='ignore')

        # Finalize Output: Push updates to PostgreSQL using parameterized SQL
        p(90, "Preparing updates for PostgreSQL...")

        alerts_to_insert = []
        flagged_df = df[df['flagged'] == True]
        clean_df = df[df['flagged'] == False]
        success_count = 0
        fail_count = 0

        if 'transaction_id' in df.columns:
            cur = self.conn.cursor()

            # Batch clear clean transactions
            print(f"Batch clearing {len(clean_df)} clean transactions...")
            clean_ids = clean_df['transaction_id'].dropna().tolist()
            for i in range(0, len(clean_ids), 1000):
                chunk = clean_ids[i:i+1000]
                try:
                    cur.execute(
                        "UPDATE transactions SET flagged = FALSE, flag_reason = '', rule_triggered = '' WHERE transaction_id = ANY(%s)",
                        (chunk,)
                    )
                except Exception as e:
                    pass

            print(f"Batch updating {len(flagged_df)} flagged transactions...")
            update_data = []
            for _, row in flagged_df.iterrows():
                if pd.notna(row['transaction_id']):
                    update_data.append((
                        str(row.get('flag_reason', '')),
                        str(row.get('rule_triggered', '')),
                        row['transaction_id']
                    ))
                    success_count += 1
                    alerts_to_insert.append((
                        f"ALT-{int(time.time()*1000)}-{str(uuid.uuid4())[:6].upper()}",
                        row.get(u_col, ''),
                        row.get('customer_name', row.get(u_col, '')),
                        'HIGH',
                        str(row.get('rule_triggered', '')),
                        'open',
                        row['transaction_id'],
                        float(row.get('amount', 0)) if pd.notna(row.get('amount')) else 0,
                        str(row.get('country', '')),
                        time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
                    ))

            try:
                if update_data:
                    psycopg2.extras.execute_batch(
                        cur,
                        "UPDATE transactions SET flagged = TRUE, flag_reason = %s, rule_triggered = %s WHERE transaction_id = %s",
                        update_data,
                        page_size=500
                    )
            except Exception as e:
                print(f"Failed to batch update flagged transactions: {e}")

            # Insert alerts
            print(f"Batch inserting {len(alerts_to_insert)} alerts...")
            try:
                if alerts_to_insert:
                    psycopg2.extras.execute_batch(
                        cur,
                        """INSERT INTO alerts (alert_id, customer_id, customer_name, risk_level, rule_triggered, status, transaction_id, amount, country, created_at)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (alert_id) DO NOTHING""",
                        alerts_to_insert,
                        page_size=500
                    )
            except Exception as e:
                print(f"Failed to batch insert alerts: {e}")

            self.conn.commit()
            cur.close()
        else:
            print("Notice: No 'transaction_id' column found in DataFrame. Could not update PostgreSQL.")

        duration = time.time() - t0
        return {
            "processed": len(df),
            "flagged": success_count,
            "alerts_created": len(alerts_to_insert),
            "duration_seconds": duration
        }
