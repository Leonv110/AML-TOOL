import os
from supabase import create_client, Client
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_data():
    print("Seeding test transactions...")
    
    # Use existing customer IDs from the migration script if possible
    # CUST001, CUST002, CUST003, CUST004, CUST005
    
    transactions = [
        # 1. Geo-Risk (CUST001)
        {
            "transaction_id": "TXN_GEO_001",
            "customer_id": "CUST001",
            "amount": 5000,
            "transaction_date": datetime.now().isoformat(),
            "country": "Nigeria",
            "country_risk_level": "High"
        },
        # 2. Dormancy (CUST002) - we'll insert a previous txn far in the past
        {
            "transaction_id": "TXN_DORM_PREV",
            "customer_id": "CUST002",
            "amount": 100,
            "transaction_date": (datetime.now() - timedelta(days=60)).isoformat()
        },
        {
            "transaction_id": "TXN_DORM_NEW",
            "customer_id": "CUST002",
            "amount": 1200,
            "transaction_date": datetime.now().isoformat()
        },
        # 3. Structuring (CUST003) - 3 txns within 7 days, sum 60k, individual 20k
        {
            "transaction_id": "TXN_STR_001",
            "customer_id": "CUST003",
            "amount": 20000,
            "transaction_date": (datetime.now() - timedelta(days=2)).isoformat()
        },
        {
            "transaction_id": "TXN_STR_002",
            "customer_id": "CUST003",
            "amount": 20000,
            "transaction_date": (datetime.now() - timedelta(days=1)).isoformat()
        },
        {
            "transaction_id": "TXN_STR_003",
            "customer_id": "CUST003",
            "amount": 20000,
            "transaction_date": datetime.now().isoformat()
        },
        # 4. Velocity Spike (CUST004) - 5 txns in the same hour
        {
            "transaction_id": "TXN_VEL_001", "customer_id": "CUST004", "amount": 1000, "transaction_date": datetime.now().isoformat()
        },
        {
            "transaction_id": "TXN_VEL_002", "customer_id": "CUST004", "amount": 1000, "transaction_date": (datetime.now() - timedelta(minutes=10)).isoformat()
        },
        {
            "transaction_id": "TXN_VEL_003", "customer_id": "CUST004", "amount": 1000, "transaction_date": (datetime.now() - timedelta(minutes=20)).isoformat()
        },
        {
            "transaction_id": "TXN_VEL_004", "customer_id": "CUST004", "amount": 1000, "transaction_date": (datetime.now() - timedelta(minutes=30)).isoformat()
        },
        {
            "transaction_id": "TXN_VEL_005", "customer_id": "CUST004", "amount": 50000, "transaction_date": (datetime.now() - timedelta(minutes=40)).isoformat()
        }
    ]
    
    try:
        response = supabase.table("transactions").upsert(transactions).execute()
        print(f"Upserted {len(transactions)} transactions.")
    except Exception as e:
        print(f"Error seeding: {e}")

if __name__ == "__main__":
    seed_data()
