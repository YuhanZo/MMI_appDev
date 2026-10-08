# MMI_appDev

Career Decision Assistant — a CSE 5911 capstone app built on the Aivana
Multi-Model Intelligence (MMI) API. React (Vite) frontend, FastAPI backend,
SQLite by default.

## Prerequisites

- Python 3.11+ (verified on 3.11)
- Node 20.19+ or 22.12+ (verified on 24)

## First-time setup

Do this once after cloning (and again when `requirements.txt` or
`package.json` changes).

**Backend**


```powershell
cd backend

# Create a virtual environment
python -m venv .venv

# Install dependencies
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Optional: Create a local environment file (defaults work as-is)
Copy-Item .env.example .env
```

Backend versions are pinned in `requirements.txt` to the set the tests pass on. To upgrade, bump a pin, reinstall and re-run the tests before committing.


**Frontend**

```bash
cd frontend
npm install
```

## Run

Use two terminals, and start the backend first.

**Terminal 1 — backend** (http://localhost:8000)

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Wait for `Application startup complete.`

**Terminal 2 — frontend** (http://localhost:5173)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173. The top bar should show
`Backend: ok (db: sqlite)` with a green dot.

Both servers reload on save. Stop each with `Ctrl+C`.

- API docs (Swagger, try any endpoint): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Page shows `backend unreachable` or `Error: 502 Bad Gateway` | The backend isn't running (start it in terminal 1, then refresh), or `/api/health` returned 503 because the database is unreachable. |
| Backend exits with `unable to open database file` / `Application startup failed` | It can't reach `DATABASE_URL` at startup (tables are created then). Check the URL in `backend/.env`. |
| `npm error enoent Could not read package.json` | `npm run dev` was run in `backend/`. It belongs in `frontend/`. |
| `uvicorn: command not found` | The venv isn't active. Run `source .venv/bin/activate`, or use `.venv/bin/uvicorn ...`. |

## Architecture

```
Browser ──> Vite dev server :5173 ──/api proxy──> FastAPI :8000 ──> SQLAlchemy ──> SQLite (dev.db)
            (React app)                           (routers, Pydantic)
```

Vite proxies `/api` to the backend, so the browser sees a single origin and
CORS never comes up in dev. All AI and job-listing calls are **mocked** for
now (`backend/app/mock_data.py`); the router functions that will call Aivana
MMI are marked with `This is where the Aivana MMI call goes`.

## Project structure

```
.
├── README.md                  you are here
├── ref/
│   ├── overview.txt           Aivana's project brief
│   └── prototype-data-format-v0.1.md   shared request/response format (source of truth)
│
├── backend/
│   ├── requirements.txt
│   ├── .env.example           DATABASE_URL, CORS origins, Aivana key (unused yet)
│   ├── pytest.ini
│   ├── app/
│   │   ├── main.py            app setup, CORS, table creation, /api/health
│   │   ├── config.py          env-driven settings (reads .env)
│   │   ├── db.py              engine + get_db session dependency
│   │   ├── models.py          SQLAlchemy tables: users, profiles, search_logs
│   │   ├── schemas.py         Pydantic models  <-- mirrors the shared format
│   │   ├── mock_data.py       placeholder jobs, questions, analysis, feedback
│   │   └── routers/
│   │       ├── jobs.py        /api/jobs/search, /api/jobs/fit-analysis
│   │       └── interview.py   /api/interview/questions, /api/interview/feedback
│   └── tests/
│       ├── conftest.py        throwaway SQLite per test, test client
│       ├── test_health.py
│       ├── test_jobs.py
│       └── test_interview.py
│
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.ts         /api proxy + Vitest config
    └── src/
        ├── main.tsx           React entry
        ├── App.tsx            top bar, sidebar, Home, Job Search, Profile,
        │                      Behavioral and Technical interview views
        ├── features/interview setup, five-question session, feedback,
        │                      completion and summary components
        ├── App.css            layout and component styles (Google Drive-inspired)
        ├── index.css          color tokens (light + dark), base styles
        ├── icons.tsx          inline SVG icons
        ├── api.ts             typed fetch wrappers, one per endpoint
        ├── types.ts           TypeScript mirror of the shared format
        └── test/
            ├── setup.ts
            └── App.test.tsx
```

`backend/dev.db` is created on first startup and is gitignored. The
project brief PDFs in `ref/` are local-only (gitignored).

## Shared data format

The request/response shapes are defined once in
[ref/prototype-data-format-v0.1.md](ref/prototype-data-format-v0.1.md) and
mirrored in `backend/app/schemas.py` and `frontend/src/types.ts`.
**Change all three together.** The shared-format tests fail as soon as they
drift apart.

## API endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | runs `SELECT 1`; `200 {status: ok, database: <dialect>}`, or `503` if the database is unreachable |
| POST | `/api/jobs/search` | `Job[]` (mocked; logs the search to the DB) |
| POST | `/api/jobs/fit-analysis` | `FitAnalysisResult` (mocked) |
| GET | `/api/interview/questions?mode=behavioral\|technical` | five prepared questions for the selected mode |
| POST | `/api/interview/feedback` | `InterviewFeedback` (mocked) |
| POST | `/api/interview/detailed-feedback` | prepared mode-specific detailed feedback |
| GET | `/api/interview/summary?mode=behavioral\|technical` | prepared interview summary |

## Tests

```bash
cd backend; .venv\Scripts\python.exe -m pytest -q   # 22 tests
cd frontend; npm test -- --run                         # 16 tests
```

Neither suite needs a running server. Backend tests swap `app.state.engine`
for a fresh throwaway SQLite file per test, so the configured database
(`dev.db` or Postgres) is never touched, not even at startup; frontend tests
stub `fetch`, so no backend is required.

| Area | Checks |
| --- | --- |
| Shared format | Every response's field set matches the shared format doc |
| Validation | Malformed requests get 422, not a 500 |
| Persistence | A job search writes a `search_logs` row with the right values |
| Isolation | Startup table creation goes to the test database, not the configured one |
| Round trips | search → fit analysis, and question → answer → feedback |
| UI state | Each interview question keeps its own answer |
| Interview flow | Setup, five questions, detailed feedback, completion, summary and cross-mode launch |
| Failure paths | Unreachable backend and a failing search both surface to the user; health returns 503 when the database is down |

## Switching to Postgres

1. `.venv\Scripts\python.exe -m pip install "psycopg[binary]"`
2. In `backend/.env`:
   ```
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/career_assistant
   ```
3. Restart the backend. No application code changes -- SQLAlchemy handles both.

`/api/health` reports which dialect is live, so you can confirm the switch took.

## Known gaps

- Aivana MMI is not wired up; `mock_data.py` stands in for every call.
- No third-party job API yet -- still undecided. Location/remote filters
  are sent but not applied by the mock search.
- No auth. `search_logs.user_id` is nullable and always null; the frontend
  uses a hard-coded demo profile.
- `FitAnalysisResult` has no `match_score`, though the proposal's success
  criteria and UI mockup both call for one.
- Tables are created via `create_all`; move to Alembic once the schema settles.
