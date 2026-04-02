import os
import pandas as pd
from sklearn.ensemble import IsolationForest
import networkx as nx
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize PostgreSQL connection
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL must be provided in the .env file.")
    exit(1)

conn = psycopg2.connect(DATABASE_URL, sslmode='require')

def append_reason(existing_reason, new_reason):
    """Helper function to append new rule reason correctly avoid duplicates."""
    if not existing_reason or pd.isna(existing_reason):
        return new_reason

    existing_list = [r.strip() for r in str(existing_reason).split(',')]
    if new_reason not in existing_list:
        existing_list.append(new_reason)

    return ", ".join(existing_list)

def process_aml_rules():
    print("Fetching records from PostgreSQL...")

    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM transactions LIMIT 100000")
    data = cur.fetchall()
    cur.close()

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

    # 2. Dormancy: Flag if days_since_last_transaction > 30
    if 'days_since_last_transaction' in df.columns or 'transaction_date' in df.columns:
        print("Applying Dormancy Activation rule...")
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
        print("Applying Structuring rule...")
        df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
        for user_id, user_data in df.groupby(u_col):
            user_data = user_data.dropna(subset=['Date_Temp']).sort_values(by='Date_Temp')

            for idx in user_data.index:
                current_date = user_data.loc[idx, 'Date_Temp']
                try:
                    current_amount = float(user_data.loc[idx, 'amount'])
                except (ValueError, TypeError):
                    continue

                window_start = current_date - pd.Timedelta(days=7)
                window_data = user_data[(user_data['Date_Temp'] >= window_start) & (user_data['Date_Temp'] <= current_date)]

                try:
                    window_sum = window_data['amount'].astype(float).sum()
                    transaction_count = len(window_data)

                    if window_sum > 50000 and current_amount < 50000 and transaction_count >= 3:
                        df.at[idx, 'flagged'] = True
                        df.at[idx, 'flag_reason'] = append_reason(df.at[idx, 'flag_reason'], 'Structuring')
                        if not df.at[idx, 'rule_triggered']:
                            df.at[idx, 'rule_triggered'] = 'Structuring'
                except ValueError:
                    continue

        df.drop(columns=['Date_Temp'], inplace=True, errors='ignore')

    # 4. Spike Detection: Use IsolationForest
    t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'
    u_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'

    if 'amount' in df.columns and (t_col in df.columns or 'transaction_frequency_1hr' in df.columns):
        print("Applying Velocity Spike rule...")
        if 'transaction_frequency_1hr' not in df.columns and t_col in df.columns and u_col in df.columns:
             df['Date_Temp'] = pd.to_datetime(df[t_col], errors='coerce')
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
        print("Applying Layering rule...")
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

    # Finalize Output: Push updates to PostgreSQL
    print("Preparing updates for PostgreSQL...")

    if 'transaction_id' in df.columns:
        flagged_df = df[df['flagged'] == True]
        updates_count = len(flagged_df)

        if updates_count > 0:
            print(f"Updating {updates_count} flagged records...")
            success_count = 0
            fail_count = 0
            cur = conn.cursor()

            for _, row in flagged_df.iterrows():
                try:
                    cur.execute(
                        "UPDATE transactions SET flagged = TRUE, flag_reason = %s, rule_triggered = %s WHERE transaction_id = %s",
                        (str(row['flag_reason']), str(row['rule_triggered']), row['transaction_id'])
                    )
                    success_count += 1
                except Exception as e:
                    fail_count += 1
                    print(f"  Failed to update {row['transaction_id']}: {e}")

            conn.commit()
            cur.close()
            print(f"Successfully updated {success_count} flagged records. ({fail_count} failed)")
        else:
            print("Successfully processed rules. No new flags to update.")
    else:
        print("Notice: No 'transaction_id' column found in DataFrame. Could not update PostgreSQL.")


if __name__ == "__main__":
    process_aml_rules()
    conn.close()
