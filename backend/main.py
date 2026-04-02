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
    return psycopg2.connect(DATABASE_URL, sslmode='require')

tasks = {}

async def process_task(task_id, batch_id):
    try:
        from aml_processor import AMLProcessor
        def update_progress(prog, msg):
            tasks[task_id]["progress"] = prog
            tasks[task_id]["message"] = msg

        conn = get_db_conn()
        processor = AMLProcessor(conn)
        results = await processor.run(batch_id=batch_id, progress_callback=update_progress)
        conn.close()

        tasks[task_id]["status"] = "completed"
        tasks[task_id]["progress"] = 100
        tasks[task_id]["message"] = "AML processing complete"
        tasks[task_id]["results"] = results
    except Exception as e:
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error"] = str(e)

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
