import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL, sslmode='require')

def seed_data():
    print("Seeding test transactions...")

    transactions = [
        # 1. Geo-Risk (CUST001)
        ("TXN_GEO_001", "CUST001", 5000, datetime.now().isoformat(), None, "Nigeria", "High"),
        # 2. Dormancy (CUST002)
        ("TXN_DORM_PREV", "CUST002", 100, (datetime.now() - timedelta(days=60)).isoformat(), None, None, None),
        ("TXN_DORM_NEW", "CUST002", 1200, datetime.now().isoformat(), None, None, None),
        # 3. Structuring (CUST003)
        ("TXN_STR_001", "CUST003", 20000, (datetime.now() - timedelta(days=2)).isoformat(), None, None, None),
        ("TXN_STR_002", "CUST003", 20000, (datetime.now() - timedelta(days=1)).isoformat(), None, None, None),
        ("TXN_STR_003", "CUST003", 20000, datetime.now().isoformat(), None, None, None),
        # 4. Velocity Spike (CUST004)
        ("TXN_VEL_001", "CUST004", 1000, datetime.now().isoformat(), None, None, None),
        ("TXN_VEL_002", "CUST004", 1000, (datetime.now() - timedelta(minutes=10)).isoformat(), None, None, None),
        ("TXN_VEL_003", "CUST004", 1000, (datetime.now() - timedelta(minutes=20)).isoformat(), None, None, None),
        ("TXN_VEL_004", "CUST004", 1000, (datetime.now() - timedelta(minutes=30)).isoformat(), None, None, None),
        ("TXN_VEL_005", "CUST004", 50000, (datetime.now() - timedelta(minutes=40)).isoformat(), None, None, None),
    ]

    cur = conn.cursor()
    try:
        for txn in transactions:
            cur.execute(
                """INSERT INTO transactions (transaction_id, customer_id, amount, transaction_date, transaction_type, country, country_risk_level)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (transaction_id) DO UPDATE SET
                     customer_id = EXCLUDED.customer_id,
                     amount = EXCLUDED.amount,
                     transaction_date = EXCLUDED.transaction_date,
                     transaction_type = EXCLUDED.transaction_type,
                     country = EXCLUDED.country,
                     country_risk_level = EXCLUDED.country_risk_level""",
                txn
            )
        conn.commit()
        print(f"Upserted {len(transactions)} transactions.")
    except Exception as e:
        conn.rollback()
        print(f"Error seeding: {e}")
    finally:
        cur.close()

if __name__ == "__main__":
    seed_data()
    conn.close()
