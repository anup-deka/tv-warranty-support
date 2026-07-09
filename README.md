# TV Warranty Support Assistant

An AI-powered support app for VistaTech TV warranty customers. Customers enter
their serial code, see their warranty status, chat with an AI grounded in the
warranty policy, and raise support tickets.

## DigitalOcean Services

| Service | Purpose |
|---|---|
| **Serverless Inference** | LLM (Llama 3.1) for Q&A + embedding model for RAG |
| **App Platform** | Hosts Next.js frontend + FastAPI backend |
| **Managed Databases** | PostgreSQL + pgvector for device records, policy embeddings, tickets |
| **Spaces** | Object storage for the warranty policy PDF |

## Project Structure

```
tv-warranty-support/
├── frontend/                  # Next.js 14 (App Router + Tailwind)
├── backend/                   # FastAPI (Python)
│   ├── main.py
│   ├── config.py
│   ├── routes/                # device, chat, tickets
│   ├── services/              # inference client, RAG pipeline
│   ├── db/                    # schema.sql, database.py, bootstrap.py
│   └── sample_data/           # bundled so deploys can self-seed
│       ├── warranty_policy.txt    # Sample warranty doc
│       └── seed_devices.sql       # Sample serial codes
├── scripts/
│   └── ingest_policy.py       # One-time policy indexing
└── .do/
    └── app.yaml               # App Platform deployment spec
```

## Local Setup

### Prerequisites
- Node.js 20+, Python 3.11+
- A PostgreSQL instance with pgvector extension
- A DigitalOcean account with Serverless Inference enabled

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # fill in your credentials
uvicorn main:app --reload --port 8000
```

### 2. Database setup

```bash
# Apply schema
psql $DATABASE_URL -f backend/db/schema.sql
# Seed sample devices
psql $DATABASE_URL -f backend/sample_data/seed_devices.sql
```

### 3. Ingest the warranty policy

```bash
# Option A: use the local sample file (no Spaces needed)
python scripts/ingest_policy.py --local

# Option B: download from DO Spaces (set Spaces credentials in .env first)
python scripts/ingest_policy.py
```

### 4. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev        # runs on http://localhost:3000
```

## Demo Serial Codes

| Serial Code | Status |
|---|---|
| `SN-VISTA-2024-001` | Active (Standard, 65" OLED) |
| `SN-VISTA-2023-002` | Expiring soon |
| `SN-LUMA-2021-005` | Expired |
| `SN-NOVA-2022-003` | Active (Extended, 5-year) |
| `SN-VISTA-2022-007` | Active (Premium plan) |

## Deploying to DigitalOcean App Platform

1. Push the repo to GitHub.
2. Edit `.do/app.yaml` — replace `your-org/tv-warranty-support` with your repo.
3. Fill in secret values (`DO_INFERENCE_API_KEY`, Spaces credentials).
4. Deploy:

```bash
doctl apps create --spec .do/app.yaml
```

After first deploy, run the ingest script once pointing at the production DB:

```bash
DATABASE_URL=<prod_db_url> python scripts/ingest_policy.py
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/device/{serial_code}` | Look up device + warranty status |
| POST | `/chat` | Send a message (RAG Q&A) |
| POST | `/tickets` | Create a support ticket |
| GET | `/tickets/{serial_code}` | List tickets for a device |
