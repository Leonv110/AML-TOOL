import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

conn = psycopg2.connect(DATABASE_URL, sslmode='require')

def seed_data():
    print("Seeding test transactions...")

    now = datetime.utcnow()

    # ----------------------------------------------------------------
    # VELOCITY SPIKE — CUST004
    # Strategy: seed 1 historical transaction per day over 30 days
    # (baseline ~0.033/hr), then 4 rapid transactions within 1 hour
    # → freq(4/hr) >= 3 × baseline triggers the rule.
    # ----------------------------------------------------------------
    velocity_txns = []

    # 30-day historical baseline (1 per day)
    for i in range(30, 0, -1):
        velocity_txns.append((
            f"TXN_VEL_HIST_{i:03d}", "CUST004",
            800,
            (now - timedelta(days=i)).isoformat(),
            "NEFT", "India", "Low",
            None, None, None, None   # is_new_device, balance_before, balance_after, destination_id
        ))

    # 4 rapid transactions within 1 hour (current time window)
    for i in range(4):
        velocity_txns.append((
            f"TXN_VEL_RAPID_{i+1:03d}", "CUST004",
            1500,
            (now - timedelta(minutes=i * 12)).isoformat(),
            "IMPS", "India", "Low",
            None, None, None, None
        ))

    # ----------------------------------------------------------------
    # NEW DEVICE HIGH VALUE — CUST005
    # is_new_device = TRUE, amount = 75,000 (> 20k threshold)
    # ----------------------------------------------------------------
    new_device_txns = [
        (
            "TXN_NEWDEV_001", "CUST005",
            75000,
            now.isoformat(),
            "RTGS", "India", "Low",
            True, None, None, None
        ),
        (
            "TXN_NEWDEV_002", "CUST005",
            35000,
            (now - timedelta(hours=3)).isoformat(),
            "IMPS", "India", "Low",
            True, None, None, None
        ),
    ]

    # ----------------------------------------------------------------
    # RAPID FUND MOVEMENT — CUST001 (reuse existing customer)
    # balance_before = 50,000  →  moved 90% = 45,000  →  balance_after = 5,000
    # amount = 45,000 (> 8k), pct_moved = 0.90 >= 0.85 → triggers rule
    # ----------------------------------------------------------------
    rapid_fund_txns = [
        (
            "TXN_RFM_001", "CUST001",
            45000,
            (now - timedelta(hours=1)).isoformat(),
            "RTGS", "India", "Low",
            None, 50000, 5000, None
        ),
        (
            "TXN_RFM_002", "CUST002",
            30000,
            (now - timedelta(hours=2)).isoformat(),
            "NEFT", "UAE", "Medium",
            None, 32000, 2000, None
        ),
    ]

    all_txns = velocity_txns + new_device_txns + rapid_fund_txns

    cur = conn.cursor()
    try:
        for txn in all_txns:
            (txn_id, cust_id, amt, txn_date, txn_type, country, risk_level,
             is_new_device, balance_before, balance_after, destination_id) = txn

            cur.execute(
                """INSERT INTO transactions
                     (transaction_id, customer_id, amount, transaction_date,
                      transaction_type, country, country_risk_level,
                      is_new_device, balance_before, balance_after, destination_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (transaction_id) DO UPDATE SET
                     customer_id       = EXCLUDED.customer_id,
                     amount            = EXCLUDED.amount,
                     transaction_date  = EXCLUDED.transaction_date,
                     transaction_type  = EXCLUDED.transaction_type,
                     country           = EXCLUDED.country,
                     country_risk_level= EXCLUDED.country_risk_level,
                     is_new_device     = EXCLUDED.is_new_device,
                     balance_before    = EXCLUDED.balance_before,
                     balance_after     = EXCLUDED.balance_after,
                     destination_id    = EXCLUDED.destination_id,
                     flagged           = NULL,
                     flag_reason       = '',
                     rule_triggered    = ''""",
                (txn_id, cust_id, amt, txn_date, txn_type, country, risk_level,
                 is_new_device, balance_before, balance_after, destination_id)
            )

        # Also keep the original seed records (upsert, no clobber)
        original_txns = [
            ("TXN_GEO_001",   "CUST001", 5000,  now.isoformat(),                        None, "Nigeria", "High",  None, None, None, None),
            ("TXN_DORM_PREV", "CUST002", 100,   (now - timedelta(days=60)).isoformat(), None, None,     None,     None, None, None, None),
            ("TXN_DORM_NEW",  "CUST002", 1200,  now.isoformat(),                        None, None,     None,     None, None, None, None),
            ("TXN_STR_001",   "CUST003", 20000, (now - timedelta(days=2)).isoformat(),  None, None,     None,     None, None, None, None),
            ("TXN_STR_002",   "CUST003", 20000, (now - timedelta(days=1)).isoformat(),  None, None,     None,     None, None, None, None),
            ("TXN_STR_003",   "CUST003", 20000, now.isoformat(),                        None, None,     None,     None, None, None, None),
        ]
        for txn in original_txns:
            (txn_id, cust_id, amt, txn_date, txn_type, country, risk_level,
             is_new_device, balance_before, balance_after, destination_id) = txn
            cur.execute(
                """INSERT INTO transactions
                     (transaction_id, customer_id, amount, transaction_date,
                      transaction_type, country, country_risk_level,
                      is_new_device, balance_before, balance_after, destination_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (transaction_id) DO NOTHING""",
                (txn_id, cust_id, amt, txn_date, txn_type, country, risk_level,
                 is_new_device, balance_before, balance_after, destination_id)
            )

        conn.commit()
        print(f"Upserted {len(all_txns)} new rule-coverage transactions + {len(original_txns)} legacy seed records.")
        print("\nExpected rule triggers after next AML run:")
        print("  ✓ Velocity Spike  → CUST004 (4 rapid txns vs 0.033/hr baseline)")
        print("  ✓ New Device HV   → CUST005 (is_new_device=True, amount ₹75k & ₹35k > ₹20k)")
        print("  ✓ Rapid Fund Mvmt → CUST001/CUST002 (90%+ of balance drained, >₹8k)")
    except Exception as e:
        conn.rollback()
        print(f"Error seeding: {e}")
    finally:
        cur.close()


if __name__ == "__main__":
    seed_data()
    conn.close()
