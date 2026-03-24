## GAFA AML Backend — Deployment

### Local development
cd backend
pip install -r requirements.txt
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
uvicorn main:app --reload --port 8000

### Deploy to Railway
1. Go to railway.app → New Project → Deploy from GitHub
2. Set root directory to /backend
3. Add environment variables:
   - SUPABASE_URL = your project URL
   - SUPABASE_SERVICE_KEY = your service role key (Settings → API → service_role)
4. Railway auto-detects the Dockerfile and deploys
5. Copy the Railway URL (e.g. https://gafa-backend.railway.app)
6. Add to Vercel environment variables:
   - VITE_AML_BACKEND_URL = https://gafa-backend.railway.app
7. Redeploy Vercel frontend

### Important: Use SERVICE_ROLE key not ANON key
The service role key bypasses RLS and is required for batch processing.
Never expose it in the frontend — only use it in the backend .env file.
