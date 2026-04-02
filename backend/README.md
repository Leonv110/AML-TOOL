# GAFA AML Processing Backend

FastAPI backend for running AML rule processing against PostgreSQL (Neon).

## Setup

```bash
# Fill in DATABASE_URL in .env
cp .env.example .env  # or edit .env directly

# Install dependencies
pip install -r requirements.txt

# Environment variables:
#   DATABASE_URL = your Neon PostgreSQL connection string

# Run
uvicorn main:app --reload
```

## Endpoints

- `POST /api/aml/process` — Start AML processing
- `GET /api/aml/progress/{task_id}` — Check processing progress
- `GET /api/aml/status` — Check unprocessed transaction count
- `GET /health` — Health check
