# Local development

Walking skeleton: React → FastAPI → database. All AI and job-listing calls are
mocked for now; the shapes follow [ref/prototype-data-format-v0.1.md](ref/prototype-data-format-v0.1.md).

## Prerequisites

- Python 3.11+ (verified on 3.14)
- Node 20+ (verified on 22)

## Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # optional -- defaults work as-is
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

Tables are created automatically on startup. The default database is SQLite
(`backend/dev.db`, gitignored) so nothing needs installing.

## Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:8000`, so the browser sees a single
origin and CORS never comes up in dev.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | service status + active DB dialect |
| POST | `/api/jobs/search` | `Job[]` (mocked; logs the search to the DB) |
| POST | `/api/jobs/fit-analysis` | `FitAnalysisResult` (mocked) |
| GET | `/api/interview/questions` | `InterviewQuestion[]` (mocked) |
| POST | `/api/interview/feedback` | `InterviewFeedback` (mocked) |

## Switching to Postgres

1. `.venv/bin/pip install "psycopg[binary]"`
2. In `backend/.env`:
   ```
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/career_assistant
   ```
3. Restart the backend. No application code changes -- SQLAlchemy handles both.

`/api/health` reports which dialect is live, so you can confirm the switch took.

## Layout

```
backend/app/
  main.py        app setup, CORS, table creation
  config.py      env-driven settings
  schemas.py     Pydantic models  <-- mirrors the shared data format
  models.py      SQLAlchemy tables (users, profiles, search_logs)
  db.py          engine + session dependency
  mock_data.py   placeholder responses
  routers/       jobs.py, interview.py

frontend/src/
  types.ts       TypeScript mirror of the shared data format
  api.ts         typed fetch wrappers
  App.tsx        both feature panels
```

## Known gaps

- Aivana MMI is not wired up; `mock_data.py` marks every call site.
- No third-party job API yet -- still undecided.
- No auth. `search_logs.user_id` is nullable and always null.
- `FitAnalysisResult` has no `match_score`, though the proposal's success
  criteria and UI mockup both call for one.
- Tables are created via `create_all`; move to Alembic once the schema settles.
