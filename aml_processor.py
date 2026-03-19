import os
import pandas as pd  # pyre-ignore[21]
from supabase import create_client, Client  # pyre-ignore[21]
from sklearn.ensemble import IsolationForest  # pyre-ignore[21]
import networkx as nx  # pyre-ignore[21]
from dotenv import load_dotenv  # pyre-ignore[21]

# Load environment variables (Make sure .env is in the same directory)
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
# Use service role key to bypass Row Level Security (RLS) for backend processing
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase URL and Key must be provided in the .env file.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def append_reason(existing_reason, new_reason):
    """Helper function to append new rule reason correctly avoid duplicates."""
    if not existing_reason or pd.isna(existing_reason):
        return new_reason
    
    existing_list = [r.strip() for r in str(existing_reason).split(',')]
    if new_reason not in existing_list:
        existing_list.append(new_reason)
    
    return ", ".join(existing_list)

def process_aml_rules():
    print("Fetching records from Supabase...")
    
    # Let's fetch the data. Note: for large tables, pagination might be required.
    # Upping the limit to 100,000 to ensure we capture the whole 95k dataset instead of Supabase's default 1,000 limit
    response = supabase.table("transactions").select("*").limit(100000).execute()
    data = response.data
    
    if not data:
        print("No transactions found or failed to fetch.")
        return

    df = pd.DataFrame(data)
    print(f"Loaded {len(df)} transactions into pandas DataFrame.")

    # Standardize column initialization
    if 'flagged' not in df.columns:
        df['flagged'] = False
    if 'flag_reason' not in df.columns:
        df['flag_reason'] = ""
    if 'rule_triggered' not in df.columns:
        df['rule_triggered'] = ""
    
    # 1. Geo-Risk: Flag if country_risk_level == 'High'.
    if 'country_risk_level' in df.columns:
        print("Applying Geo-Risk rule...")
        for idx, row in df.iterrows():
            if str(row['country_risk_level']).strip().lower() == 'high':
                df.at[idx, 'flagged'] = True
                df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Geographic Risk')
                if not df.at[idx, 'rule_triggered']:
                     df.at[idx, 'rule_triggered'] = 'Geographic Risk'

    # 2. Dormancy: Flag if days_since_last_transaction > 30 (Calculate from transaction_date if missing)
    if 'days_since_last_transaction' in df.columns or 'transaction_date' in df.columns:
        print("Applying Dormancy Activation rule...")
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
        print("Applying Structuring rule...")
        df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
        for user_id, user_data in df.groupby(u_col):
            # Sort chronologically
            user_data = user_data.dropna(subset=['Date_Temp']).sort_values(by='Date_Temp')
            
            for idx in user_data.index:
                current_date = user_data.loc[idx, 'Date_Temp']
                try:
                    current_amount = float(user_data.loc[idx, 'amount'])
                except (ValueError, TypeError):
                    continue
                
                # Retrieve the 7 days prior up to current date
                window_start = current_date - pd.Timedelta(days=7)
                window_data = user_data[(user_data['Date_Temp'] >= window_start) & (user_data['Date_Temp'] <= current_date)]
                
                try:
                    window_sum = window_data['amount'].astype(float).sum()
                    transaction_count = len(window_data)
                    
                    if window_sum > 50000 and current_amount < 50000 and transaction_count >= 3: # Lowered threshold to $50k
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Structuring')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Structuring'
                except ValueError:
                    continue

        df.drop(columns=['Date_Temp'], inplace=True, errors='ignore')

    # 4. Spike Detection: Use IsolationForest on the amount and transaction_frequency_1hr columns.
    t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'
    u_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'
    
    if 'amount' in df.columns and (t_col in df.columns or 'transaction_frequency_1hr' in df.columns):
        print("Applying Velocity Spike rule...")
        if 'transaction_frequency_1hr' not in df.columns and t_col in df.columns and u_col in df.columns:
             # Calculate frequency: check how many txns in the hour preceding each txn
             df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
             # For each row, count others with same user in [time-1h, time]
             # This is slow on large datasets, but works for the seed data
             freqs = []
             for _, row in df.iterrows():
                 if pd.isna(row['Date_Temp']):
                     freqs.append(0)
                     continue
                 window_start = row['Date_Temp'] - pd.Timedelta(hours=1)
                 count = len(df[(df[u_col] == row[u_col]) & (df['Date_Temp'] >= window_start) & (df['Date_Temp'] <= row['Date_Temp'])])
                 freqs.append(count)
             df['transaction_frequency_1hr'] = freqs
             print("Calculated transaction_frequency_1hr from history.")

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
        print("Applying Layering rule...")
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
    print("Preparing updates for Supabase...")

    if 'transaction_id' in df.columns:
        flagged_df = df[df['flagged'] == True]
        updates_count = len(flagged_df)

        if updates_count > 0:
            print(f"Updating {updates_count} flagged records...")
            success_count = 0
            fail_count = 0

            for _, row in flagged_df.iterrows():
                try:
                    supabase.table("transactions").update({
                        'flagged': True,
                        'flag_reason': str(row['flag_reason']),
                        'rule_triggered': str(row['rule_triggered']),
                    }).eq('transaction_id', row['transaction_id']).execute()
                    success_count += 1
                except Exception as e:
                    fail_count += 1
                    print(f"  Failed to update {row['transaction_id']}: {e}")

            print(f"Successfully updated {success_count} flagged records. ({fail_count} failed)")
        else:
            print("Successfully processed rules. No new flags to update.")
    else:
        print("Notice: No 'transaction_id' column found in DataFrame. Could not update Supabase.")


if __name__ == "__main__":
    process_aml_rules()
