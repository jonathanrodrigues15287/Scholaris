# Scholaris

## Pitch

Scholaris is a student productivity application for organizing academic work
in one place. It combines a FastAPI backend with a browser-based frontend for
assignments, attendance, timetables, study sessions, and academic records.

## Screenshots

Screenshots are not currently included in the repository.

## Features

- Assignment tracking with lifecycle rules, concurrency protection, and
  deadline reminders
- Attendance management, summaries, and attendance prediction
- Timetable and schedule management
- Study session tracking, goals, and a study timer
- GPA and CGPA calculations with academic record support
- Dashboard summaries for the student's academic workflow
- Cookie-authenticated API with CSRF protection and structured errors
- Offline-first mutation queue in browser `localStorage`
- Exactly-once replay protection for assignment creation through
  `X-Idempotency-Key`
- Version-aware assignment synchronization and conflict resolution

Offline mutations are scoped to the signed-in user and replayed sequentially
when the browser reconnects. See the [offline synchronization
documentation](./docs/offline-sync.md) for retry behavior and current
limitations.

When SMTP is configured, the backend sends grouped reminders for incomplete
assignments due the following day. The daily schedule and deployment
considerations are documented in the [architecture
documentation](./docs/architecture.md).

## Quick start

Scholaris is configured for local development with Python 3.11+, a database
configured through `.env`, and a browser for the static frontend.

### 1. Install the backend

From the repository root, create and activate a virtual environment and install
the backend dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
alembic -c backend/alembic.ini upgrade head
```

On macOS or Linux, activate the environment with:

```bash
source .venv/bin/activate
```

### 2. Start the API

Open a terminal in the repository root and run:

```powershell
cd backend
$env:PYTHONPATH = "."
uvicorn app.main:app --reload
```

On macOS or Linux, use `PYTHONPATH=.` before the command:

```bash
cd backend
PYTHONPATH=. uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`.

### 3. Start the frontend

Open a second terminal in the repository root and serve the static frontend:

```powershell
python -m http.server 5500 --directory frontend
```

Open `http://localhost:5500` in a browser. Useful backend endpoints are:

- Health check: `http://localhost:8000/api/v1/health`
- OpenAPI documentation: `http://localhost:8000/api/v1/docs`

## Architecture

The browser frontend communicates with the FastAPI application over
cookie-authenticated API requests. The backend is organized into routers,
services, models, schemas, and database migrations:

```text
Browser frontend
  ├─ HTML/CSS/JavaScript UI
  ├─ local state and offline mutation queue
  └─ cookie-authenticated API requests
          │
          ▼
FastAPI application
  ├─ middleware and security checks
  ├─ routers → services
  ├─ SQLAlchemy models and sessions
  └─ Alembic migrations
          │
          ├─ PostgreSQL
          └─ APScheduler → email worker → SMTP
```

The browser queue is separate from the backend queue. It replays authenticated
mutations sequentially when the browser is online. Assignment creation has
durable server-side idempotency records; other queued mutations remain
at-least-once attempts and should be reviewed when conflicts occur.

See the [full architecture documentation](./docs/architecture.md) for request
lifecycles, background work, and observability.

## Documentation

- [API contract](./docs/api.md)
- [Architecture](./docs/architecture.md)
- [Authentication](./docs/authentication.md)
- [Database](./docs/database.md)
- [Offline synchronization](./docs/offline-sync.md)
- [Testing strategy](./docs/testing.md)
- [Architecture decision records](./docs/decisions/)

The main code areas are:

- `backend/app/` — FastAPI application, domain services, models, and jobs
- `backend/alembic/` — versioned database migrations
- `frontend/` — static browser application
- `frontend/tests/` — frontend business-logic tests

## Tests

Run the frontend business-logic tests with Node:

```powershell
node --test frontend/tests/*.test.js
```

The suite covers state, API helpers, assignments, attendance, CGPA, timers,
and events. Browser automation is not currently included, so these tests do
not verify browser storage durability, multi-tab behavior, or live
network/server interaction. See the [testing strategy](./docs/testing.md) for
coverage details and known limitations.
