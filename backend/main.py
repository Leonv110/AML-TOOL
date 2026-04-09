import uuid
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="GAFA AML Processing Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_conn():
    """Create a new database connection."""
    # Remove unsupported query parameters like ?pgbouncer=true for psycopg2
    clean_url = DATABASE_URL.split('?')[0] if DATABASE_URL else DATABASE_URL
    return psycopg2.connect(clean_url, sslmode='require')

tasks = {}

def process_task(task_id, batch_id):
    conn = None
    try:
        from aml_processor import AMLProcessor
        def update_progress(prog, msg):
            tasks[task_id]["progress"] = prog
            tasks[task_id]["message"] = msg

        conn = get_db_conn()
        processor = AMLProcessor(conn)
        results = processor.run(batch_id=batch_id, progress_callback=update_progress)

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["message"] = "AML processing complete"
        tasks[task_id]["results"] = results
    except Exception as e:
        import traceback
        traceback.print_exc()
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

@app.post("/api/aml/process")
async def run_aml_processing(background_tasks: BackgroundTasks, request: dict = {}):
    try:
        task_id = str(uuid.uuid4())
        tasks[task_id] = {"status": "running", "progress": 0, "message": "Starting...", "results": None, "error": None}

        batch_id = request.get("batch_id", None)
        background_tasks.add_task(process_task, task_id, batch_id)

        return {
            "success": True,
            "task_id": task_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/aml/progress/{task_id}")
async def get_progress(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.get("/api/aml/status")
async def get_processing_status():
    """Check if there are unprocessed transactions waiting"""
    conn = get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM transactions WHERE flagged IS NULL")
    count = cur.fetchone()[0]
    cur.close()
    conn.close()

    return {
        "unprocessed_count": count,
        "ready": count > 0
    }

@app.get("/health")
async def health():
    return {"status": "ok"}

# ============================================================
# ML Model Endpoints
# ============================================================

@app.post("/api/ml/train")
async def train_ml_model():
    """Train the Isolation Forest ensemble on all transactions."""
    try:
        import pandas as pd
        from ml.ensemble import AMLEnsemble

        conn = get_db_conn()
        cur = conn.cursor(psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM transactions LIMIT 100000")
        rows = cur.fetchall()
        cur.close()
        conn.close()

        if not rows:
            raise HTTPException(status_code=400, detail="No transactions found for training")

        df = pd.DataFrame(rows)
        model = AMLEnsemble()
        metrics = model.train(df)

        return {
            "success": True,
            "metrics": metrics,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ml/score/{customer_id}")
async def score_customer(customer_id: str):
    """Score all transactions for a given customer using the trained ensemble model."""
    try:
        import pandas as pd
        from ml.ensemble import AMLEnsemble

        conn = get_db_conn()
        cur = conn.cursor(psycopg2.extras.RealDictCursor)
        cur.execute("SELECT * FROM transactions WHERE customer_id = %s ORDER BY transaction_date DESC LIMIT 500", (customer_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        if not rows:
            raise HTTPException(status_code=404, detail=f"No transactions found for customer {customer_id}")

        df = pd.DataFrame(rows)
        model = AMLEnsemble()

        if not model.load():
            raise HTTPException(status_code=400, detail="Model not trained yet. Call POST /api/ml/train first.")

        predictions = model.predict(df)

        # Aggregate into customer-level risk
        high_count = sum(1 for p in predictions if p['risk_level'] == 'HIGH')
        medium_count = sum(1 for p in predictions if p['risk_level'] == 'MEDIUM')
        avg_score = sum(p['anomaly_score'] for p in predictions) / len(predictions)

        return {
            "customer_id": customer_id,
            "transactions_scored": len(predictions),
            "high_risk_transactions": high_count,
            "medium_risk_transactions": medium_count,
            "average_anomaly_score": round(avg_score, 4),
            "transaction_scores": predictions[:20],  # Return top 20 for display
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

