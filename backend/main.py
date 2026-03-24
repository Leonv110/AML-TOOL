import uuid
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
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

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

tasks = {}

async def process_task(task_id, batch_id):
    try:
        from aml_processor import AMLProcessor
        def update_progress(prog, msg):
            tasks[task_id]["progress"] = prog
            tasks[task_id]["message"] = msg
            
        processor = AMLProcessor(supabase)
        results = await processor.run(batch_id=batch_id, progress_callback=update_progress)
        
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
    result = supabase.from_("transactions")\
        .select("*", count="exact")\
        .is_("flagged", "null")\
        .execute()
    
    return {
        "unprocessed_count": result.count,
        "ready": result.count > 0
    }

@app.get("/health")
async def health():
    return {"status": "ok"}
