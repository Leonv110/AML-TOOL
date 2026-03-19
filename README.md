# GAFA — AML Training Platform

A forensic AML training tool for Student / Admin / Exam Access roles. Students investigate synthetic AML cases using real investigative workflows.

> **Important**: This platform uses probabilistic language throughout — it never declares fraud as fact.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Run the Supabase migration
# Open Supabase Dashboard → SQL Editor → paste supabase_migration.sql → Run

# 4. Start development server
npm run dev
```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | ✅ Yes |
| `VITE_GEMINI_KEY` | Google Gemini API key for AI analysis | ❌ Placeholder |
| `VITE_SCREENING_API_URL` | Real screening API endpoint | ❌ Placeholder |

## Tech Stack

- **Frontend**: React 19 + Vite 6
- **Styling**: Tailwind CSS 4 + custom CSS
- **Database & Auth**: Supabase
- **Excel Parsing**: SheetJS (xlsx)
- **Charts**: Recharts
- **Deployment**: Vercel

## Routes

| Path | Page |
|---|---|
| `/` | Dashboard |
| `/customer-master` | Customer Master File (upload) |
| `/customers` | Customer Directory |
| `/customers/:id` | Customer Profile |
| `/screening` | Screening Tab |
| `/transactions` | Transaction Monitoring |
| `/alerts` | Alert Review |
| `/investigations` | Investigations / SAR Workshop |
| `/investigations/:case_id` | Investigation Workspace |
| `/reports` | Reports Tab |

## Database

Run `supabase_migration.sql` in the Supabase SQL Editor before first use. This creates:
- `customers` — Customer master records
- `transactions` — Transaction data
- `alerts` — System-generated alerts
- `rules` — 8 AML detection rules
- `documents` — KYC document metadata
- `notes` — Analyst investigation notes
- `investigations` — SAR cases

## Deployment (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Vercel auto-deploys on push to `main`

The `vercel.json` file handles SPA routing.

## Swap Points (Future Integration)

- **Screening API**: `src/services/screeningService.js` — replace `localOpenSanctionsMatch` with real API call
- **Gemini AI**: `src/services/aiService.js` — replace simulated response with real Gemini API call
- **Power BI**: `src/pages/Reports.jsx` — paste embed URL in the placeholder section
