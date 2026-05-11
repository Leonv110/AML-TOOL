<div align="center">

# 🛡️ GAFA — Anti-Money Laundering Intelligence Platform

**Adaptive Audit-Log Driven Transaction Monitoring for Financial Risk Control**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/License-Academic-f59e0b?style=flat-square)]()

<br/>

A full-stack AML compliance platform combining **rule-based detection**, **machine learning anomaly scoring**, and a **6-pillar adaptive audit intelligence system** — built for the GAFA Certified Anti-Money Laundering (CAML) program.

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [Features](#-features) · [Audit Intelligence](#-adaptive-audit-intelligence) · [API Reference](#-api-reference) · [Deployment](#-deployment)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 Transaction Monitoring
- 8 AML detection rules (Structuring, Layering, Velocity Spike, Dormancy, Geo-Risk, Rapid Fund Movement, New Device, Round Tripping)
- Real-time risk scoring with configurable thresholds
- Rule toggle (enable/disable) with live alert counts
- Paginated transaction table with flagged-only filter

### 🤖 ML Anomaly Detection
- Isolation Forest (200 estimators, 5% contamination)
- K-Means behavioral clustering (2–5 clusters)
- SHAP explainability for anomaly decisions
- Combined HIGH/MEDIUM/LOW risk classification

### 🔗 Adaptive Audit Intelligence
- Tamper-evident hash chain (blockchain-style)
- Rule precision feedback loop with 7-day trends
- Analyst behavioral anomaly detection
- 5-component compliance health score
- Session forensics timeline
- FIU-IND regulatory PDF export

</td>
<td width="50%">

### 👤 Customer Due Diligence
- KYC customer master with PEP flag tracking
- Sanctions screening (OFAC, UN, EU lists)
- Customer risk profiling with income mismatch detection
- Document upload and management

### ⚠️ Alert & Investigation Workflow
- Alert generation from rule engine + ML pipeline
- Status lifecycle: Open → Investigating → Escalated / Closed
- SAR (Suspicious Activity Report) drafting workspace
- Investigation case management with analyst notes

### 📊 Reporting & Admin
- Compliance report generation (CTR, STR, Risk Summary)
- Scheduled report automation
- Admin panel with user management
- Role-based access control (Admin / Student)
- Session timeout with countdown warning

</td>
</tr>
</table>

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (React 19 + Vite)               │
│  Landing · Dashboard · Customers · Transactions · Screening  │
│  Alerts · Investigations · Reports · Audit Intelligence      │
│                                                              │
│  Auth Context · Protected Routes · HMAC Audit Logging        │
└──────────────────┬───────────────────────┬───────────────────┘
                   │ REST (JWT Bearer)     │ REST
┌──────────────────▼──────────────┐  ┌─────▼──────────────────┐
│    EXPRESS.JS API SERVER        │  │  FASTAPI ML BACKEND    │
│    Port 3001                    │  │  Port 8000             │
│                                 │  │                        │
│  /api/auth     — JWT auth       │  │  /api/aml/process      │
│  /api/customers — CRUD          │  │  /api/aml/progress/:id │
│  /api/transactions — bulk ops   │  │  /api/ml/train         │
│  /api/alerts   — lifecycle      │  │  /api/ml/score/:id     │
│  /api/audit    — 8 endpoints    │  │                        │
│  /api/rules    — toggle/CRUD    │  │  AML Processor (8 rules│
│  /api/reports  — generation     │  │  + NetworkX graphs)    │
│  /api/investigations — SAR      │  │  Ensemble ML pipeline  │
│  /api/admin    — user mgmt      │  │  (IsolationForest +    │
│  /api/screening — AML Watcher   │  │   KMeans + SHAP)       │
└──────────────────┬──────────────┘  └─────┬──────────────────┘
                   │ SQL (pg)              │ psycopg2
               ┌───▼──────────────────────▼───┐
               │   POSTGRESQL (Supabase)       │
               │                               │
               │  users · profiles · customers │
               │  transactions · alerts · rules│
               │  investigations · documents   │
               │  notes · audit_logs · reports │
               │  report_schedules             │
               └───────────────────────────────┘
```

| Layer | Stack | Role |
|-------|-------|------|
| **Frontend** | React 19, Vite 6, Recharts, jsPDF | UI, client-side HMAC, PDF generation |
| **API Server** | Node.js, Express, JWT, Helmet, Swagger | REST API, auth, CRUD, audit analytics |
| **ML Backend** | Python 3, FastAPI, scikit-learn, NetworkX, SHAP | AML rule processing, anomaly detection |
| **Database** | PostgreSQL (Supabase), 12 tables, 5 indexes on audit | Persistent storage with append-only audit trail |
| **Deployment** | Vercel (frontend), Render (API + ML) | Auto-deploy on push |

---

## 🛡 Adaptive Audit Intelligence

The audit module transforms the platform from a standard monitoring tool into an **adaptive, self-evaluating compliance system**. Six architectural pillars ensure the audit trail is not just a passive record — it actively drives risk control.

### Pillar 1 — Tamper-Evident Hash Chain 🔗

Every audit entry chains cryptographically to its predecessor via `prev_hash`. Sequential `BIGSERIAL` numbering detects deletions via gap analysis.

```
Entry #1                Entry #2                Entry #3
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ seq: 1        │       │ seq: 2        │       │ seq: 3        │
│ hmac: abc123  │◄──────│ prev: abc123  │◄──────│ prev: def456  │
│ prev: NULL    │       │ hmac: def456  │       │ hmac: ghi789  │
└───────────────┘       └───────────────┘       └───────────────┘

Delete Entry #2 → Entry #3's prev_hash won't match Entry #1 → CHAIN BREAK ⚠️
```

Includes **signed JSON export** with a master HMAC-SHA256 hash for regulator-verifiable records.

### Pillar 2 — Adaptive Rule Feedback Loop 📊

Analyzes analyst decisions (`ALERT_ESCALATED` vs `ALERT_CLOSED`) to compute per-rule **Precision Scores**:

```
Precision = Escalated / (Escalated + False Positives) × 100
```

Compares precision across 7-day windows to detect **improving** or **degrading** trends, and auto-suggests threshold adjustments when precision drops below 30%.

### Pillar 3 — Analyst Behavioral Anomaly Detection 🕵️

Session-level heuristics flag insider threat indicators:

| Anomaly | Trigger | Severity |
|---------|---------|----------|
| Rubber-stamping | >5 decisions in <3 min | 🔴 High |
| Bulk data access | >20 customer views/session | 🟡 Medium |
| One-directional decisions | All FP or all escalations (5+) | 🔴 High |
| Off-hours activity | Sessions before 06:00 or after 22:00 | 🟡 Medium |

### Pillar 4 — Compliance Health Score 🏥

Real-time composite score (0–100) across five dimensions:

| Component | What It Measures |
|-----------|-----------------|
| **Coverage** | Are all required event types being logged? |
| **Timeliness** | Average alert response time vs 48-hour target |
| **Integrity** | Hash chain breaks + sequence gaps |
| **Quality** | False positive rate across all decisions |
| **Regulatory** | PMLA 7-day STR filing deadline adherence |

### Pillar 5 — Session Forensics Timeline ⏱️

Reconstructs user sessions from audit entries (30-min gap = new session). Interactive vertical timeline with **expandable metadata inspection** per event — click any event to see full JSONB details inline.

### Pillar 6 — FIU-IND Regulatory Export 📄

One-click PDF generation for regulatory submission under PMLA Section 12:
- Cover page with institution details + chain integrity verification
- Chronological event table with HMAC status per entry
- Digital signature (master hash of all entry signatures)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **PostgreSQL** database ([Supabase](https://supabase.com) free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/Leonv110/AML-TOOL.git
cd AML-TOOL

# Frontend dependencies
npm install

# API server dependencies
cd api-server && npm install && cd ..

# ML backend dependencies
pip install -r requirements.txt
```

### 2. Environment Setup

```bash
# Frontend
cp .env.example .env

# API server
cp api-server/.env.example api-server/.env
```

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:3001
VITE_AML_BACKEND_URL=http://localhost:8000
VITE_AUDIT_HMAC_SECRET=<generate: openssl rand -hex 32>
```

**API Server** (`api-server/.env`):
```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
JWT_SECRET=<generate: openssl rand -hex 32>
PORT=3001
ADMIN_EMAIL=admin@gafa.org
ADMIN_PASSWORD=YourStrongPass1
```

### 3. Database Setup

Run the schema in your PostgreSQL instance (Supabase SQL Editor):

```bash
# Full schema (new database)
psql $DATABASE_URL -f postgres_schema.sql

# If upgrading existing database — add audit chain columns
psql $DATABASE_URL -f audit_chain_migration.sql
```

Then seed the admin user:
```bash
cd api-server && node seed-admin.js
```

### 4. Run

```bash
# All three services concurrently
npm run dev:all

# Or individually:
npm run dev          # Frontend → http://localhost:5173
npm run dev:api      # API Server → http://localhost:3001
npm run dev:ml       # ML Backend → http://localhost:8000
```

---

## 📡 API Reference

### Express API Server (`/api/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/login` | Authenticate, returns JWT |
| `GET` | `/api/auth/me` | Get current user profile |
| `GET` | `/api/customers` | List all customers |
| `POST` | `/api/customers` | Bulk insert customers |
| `GET` | `/api/customers/:id` | Customer detail |
| `GET` | `/api/transactions` | List with filters (date, amount, country, rule) |
| `POST` | `/api/transactions` | Bulk insert transactions |
| `GET` | `/api/alerts` | List alerts with status filter |
| `PATCH` | `/api/alerts/:id/status` | Update alert status |
| `GET` | `/api/rules` | List detection rules |
| `PATCH` | `/api/rules/:id` | Toggle rule active/inactive |
| **Audit Intelligence** | | |
| `POST` | `/api/audit` | Insert with hash-chain linking |
| `GET` | `/api/audit` | Fetch with filters |
| `GET` | `/api/audit/chain/verify` | Verify chain integrity |
| `GET` | `/api/audit/chain/export` | Signed JSON export |
| `GET` | `/api/audit/analytics/rule-effectiveness` | Rule precision scores + trends |
| `GET` | `/api/audit/analytics/analyst-behavior` | Session-level anomaly profiles |
| `GET` | `/api/audit/analytics/compliance-score` | 5-component health score |
| `GET` | `/api/audit/session/:actorId` | Session forensics timeline |

### FastAPI ML Backend (`/api/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/aml/process` | Run AML rule engine (async) |
| `GET` | `/api/aml/progress/:taskId` | Poll processing progress |
| `GET` | `/api/aml/status` | Count unprocessed transactions |
| `POST` | `/api/ml/train` | Train Isolation Forest + KMeans |
| `POST` | `/api/ml/score/:customerId` | Score customer transactions |
| `GET` | `/health` | Health check |

Full interactive docs available at `/api/docs` (Swagger UI).

---

## 🗂 Project Structure

```
GAFA/
├── src/                          # React Frontend
│   ├── App.jsx                   # Route definitions
│   ├── apiClient.js              # REST client with JWT
│   ├── index.css                 # Global design system
│   ├── contexts/
│   │   └── AuthContext.jsx       # Auth state + session timeout
│   ├── components/
│   │   ├── ProtectedRoute.jsx    # Auth guard
│   │   ├── AdminRoute.jsx        # Admin role guard
│   │   └── RoleRoute.jsx         # Role-based guard
│   ├── services/
│   │   ├── auditService.js       # HMAC signing, chain verify, PDF export
│   │   ├── dataService.js        # CRUD operations
│   │   ├── screeningService.js   # Sanctions screening
│   │   ├── aiService.js          # AI analysis integration
│   │   └── reportGenerator.js    # Report PDF generation
│   └── pages/
│       ├── LandingPage.jsx       # Public landing
│       ├── LoginPage.jsx         # Authentication
│       ├── DashboardPage.jsx     # KPI overview
│       ├── CustomerMaster.jsx    # Bulk customer upload
│       ├── CustomerProfile.jsx   # Individual customer view
│       ├── TransactionMonitoring.jsx  # Transaction table + rules
│       ├── Screening.jsx         # Sanctions screening
│       ├── AlertReview.jsx       # Alert triage
│       ├── InvestigationWorkspace.jsx # SAR workspace
│       ├── Reports.jsx           # Report generation
│       ├── AuditLog.jsx          # 🛡️ 5-tab audit dashboard
│       ├── IngestionPage.jsx     # Data ingestion pipeline
│       └── AdminPanel.jsx        # User management
│
├── api-server/                   # Express.js API
│   ├── server.js                 # Entry, CORS, rate-limit, Swagger
│   ├── db.js                     # PostgreSQL pool
│   ├── middleware/
│   │   └── auth.js               # JWT verification
│   ├── routes/
│   │   ├── audit.js              # 🛡️ 8 audit endpoints
│   │   ├── auth.js               # Login/signup/me
│   │   ├── customers.js          # Customer CRUD
│   │   ├── transactions.js       # Transaction CRUD + bulk
│   │   ├── alerts.js             # Alert lifecycle
│   │   ├── rules.js              # Rule management
│   │   ├── investigations.js     # SAR case management
│   │   └── reports.js            # Report generation
│   └── services/
│       └── amlWatcherService.js  # AML Watcher API integration
│
├── backend/                      # Python ML Backend
│   ├── main.py                   # FastAPI entry
│   ├── aml_processor.py          # 8-rule AML engine
│   └── ml/
│       └── ensemble.py           # IsolationForest + KMeans + SHAP
│
├── postgres_schema.sql           # Full database schema (12 tables)
├── audit_chain_migration.sql     # Hash chain column migration
└── package.json                  # Frontend dependencies + scripts
```

---

## 🗄 Database Schema

12 tables across 4 domains:

| Domain | Tables |
|--------|--------|
| **Identity** | `users`, `profiles` |
| **Core AML** | `customers`, `transactions`, `alerts`, `rules` |
| **Investigation** | `investigations`, `documents`, `notes` |
| **Audit & Reporting** | `audit_logs`, `reports`, `report_schedules` |

Key design decisions:
- **Append-only `audit_logs`** — no UPDATE or DELETE operations permitted at the API layer
- **HMAC integrity** — every audit entry is cryptographically signed client-side
- **Hash chain** — each entry links to its predecessor for tamper detection
- **JSONB metadata** — flexible structured data per audit event

---

## 🚢 Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | **Vercel** | Auto-deploy from `main`. SPA routing via `vercel.json` |
| API Server | **Render** | Web service, `node server.js`, env vars in dashboard |
| ML Backend | **Render** | Web service, `uvicorn main:app --host 0.0.0.0 --port 8000` |
| Database | **Supabase** | Free PostgreSQL, connection string in env |

```bash
# Build for production
npm run build    # Output in dist/
```

Keep-alive mechanism prevents Render free tier spindowns (pings every 10 minutes).

---

## 🔒 Security

- **JWT authentication** on all API endpoints
- **Helmet.js** security headers
- **Rate limiting** — 2000 requests per 15-minute window
- **CORS** whitelist with Vercel subdomain support
- **bcrypt** password hashing (12 rounds)
- **Session timeout** — 30 min inactivity with 5 min warning
- **Role-based access control** — Admin/Student segregation
- **HMAC-SHA256 audit signatures** — dual-key architecture (client + server)
- **Append-only audit log** — no UPDATE/DELETE at API layer

---

## 📚 Regulatory Framework

This platform implements controls mapped to:

| Regulation | Relevant Sections | Platform Feature |
|-----------|-------------------|------------------|
| **PMLA 2002** | §12 (record maintenance), §12A (information to Director) | Audit trail, FIU-IND export |
| **RBI KYC Directions** | §63 (staff monitoring) | Analyst behavioral anomaly detection |
| **RBI Cybersecurity Framework** | §4.2 (audit trail integrity) | Hash chain tamper detection |
| **FATF Recommendation 20** | STR quality and timeliness | Rule precision scoring, 7-day deadline tracking |
| **Indian Evidence Act** | §65B (electronic records) | Digitally signed audit exports |

---

## 🛠 Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend Framework | React 19 |
| Build Tool | Vite 6 |
| Routing | React Router 7 |
| Charts | Recharts |
| PDF Generation | jsPDF + jsPDF-AutoTable |
| Excel Parsing | SheetJS (xlsx) |
| Backend Framework | Express.js 4 |
| ML Framework | FastAPI |
| ML Libraries | scikit-learn, NetworkX, SHAP, pandas |
| Database | PostgreSQL (Supabase) |
| Authentication | JWT (jsonwebtoken) |
| API Documentation | Swagger UI (swagger-jsdoc) |
| Cryptography | Web Crypto API (client), Node crypto (server) |
| Deployment | Vercel, Render |

---

<div align="center">

</div>
