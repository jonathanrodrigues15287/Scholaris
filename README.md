# Scholaris

Scholaris is the codebase in this repository: a student productivity application with a FastAPI backend, a browser-based frontend, and project documentation.

## What is in this codebase

This repository contains the actual working app files for:

- Academic assignment tracking
- Attendance management and attendance prediction logic
- Timetable and schedule handling
- Study session tracking and study-goal support
- Academic record / GPA / CGPA calculations
- Dashboard summaries and user-facing frontend pages
- API documentation and Alembic database migrations

## Project structure

```text
scholaris/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── app/
│   │   ├── core/
│   │   ├── jobs/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── utils/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── test_scholaris.db
│   └── tests/
├── docs/
│   ├── api.md
│   ├── architecture.md
│   ├── authentication.md
│   ├── database.md
│   ├── decisions/
│   └── offline-sync.md
├── frontend/
│   ├── css/
│   ├── js/
│   │   ├── accessibility.js
│   │   ├── api.js
│   │   ├── assignments.js
│   │   ├── attendance.js
│   │   ├── cgpa.js
│   │   ├── dashboard.js
│   │   ├── nav.js
│   │   ├── states.js
│   │   ├── theme.js
│   │   ├── timer.js
│   │   ├── timetable.js
│   │   ├── toast.js
│   │   ├── utils.js
│   │   ├── validation.js
│   │   └── core/
│   ├── index.html
│   ├── package-lock.json
│   └── tests/
├── browser_auth_test.db
├── scholaris_local.db
├── test_scholaris.db
└── improvements.txt
```

## Backend contents

The backend is a FastAPI application under `backend/app`.

- `app/main.py` starts the API application
- `app/core/` holds configuration, security, database initialization, and shared app settings
- `app/models/` contains SQLAlchemy models for users, courses, assignments, attendance, study sessions, timetable data, and academic records
- `app/routers/` exposes the API endpoints for auth, courses, assignments, attendance, timetables, study tracking, CGPA, and dashboard data
- `app/schemas/` defines the request/response models used by the API
- `app/services/` contains the business logic for the application features
- `app/jobs/` includes scheduled or background jobs
- `app/utils/` contains shared utility helpers

The backend also includes Alembic migrations in `backend/alembic/versions/` and environment configuration in `backend/alembic.ini`.

## Frontend contents

The frontend is a browser app served from `frontend/`.

- `frontend/index.html` is the app shell
- `frontend/css/` contains styling for the dashboard and feature screens
- `frontend/js/` contains the front-end logic, including:
  - `api.js` for backend communication and offline sync handling
  - `assignments.js` for assignment CRUD and task state management
  - `attendance.js` for attendance tracking and summaries
  - `cgpa.js` for academic GPA calculations
  - `dashboard.js` for dashboard rendering
  - `timer.js` for study timer behaviour
  - `timetable.js` for timetable display and updates
  - `theme.js`, `nav.js`, `toast.js`, `accessibility.js`, and `validation.js` for app support features
  - `core/` for shared business logic, events, state, and storage helpers

## Documentation and tests

The repository includes project documentation and test assets:

- `docs/` contains API and architecture notes, auth documentation, database docs, offline sync notes, and design decisions
- `backend/tests/` contains backend test coverage
- `frontend/tests/` contains browser-side tests

## Setup

This repository is configured for local development as a Python + FastAPI backend with a static frontend.

### Requirements

- Python 3.11+
- A configured database URL in `.env`
- Browser access to the served frontend

### Typical local workflow

```bash
python -m venv .venv
source .venv/bin/activate  # or .\.venv\Scripts\Activate.ps1 on Windows
pip install -r backend/requirements.txt
alembic -c backend/alembic.ini upgrade head
```

Then start the API from the backend folder:

```bash
cd backend
PYTHONPATH=. uvicorn app.main:app --reload
```

The frontend is served as a static app from `frontend/` and is intended to run alongside the FastAPI backend.

## Summary

This repository contains the actual implementation of the Scholaris application: backend API logic, frontend interface modules, database migrations, support docs, and tests. The codebase is organized around academic workflow features rather than a generic starter template.

### Offline synchronization

The frontend creates a stable operation ID before sending each mutation. It
sends that ID as `X-Idempotency-Key` and stores failed network mutations in a
local queue. Retries reuse the same operation ID, preserving the original
request fingerprint and preventing duplicate assignment creation. Queued
operations expose their entity, operation, payload, retry count, and conflict
state to the frontend. Network failures can therefore be retried safely;
validation and conflict responses remain visible instead of being treated as
offline failures.

### HTTP status codes

```text
200 OK                  Successful read or update
201 Created             Resource created
204 No Content          Successful delete or logout
400 Bad Request         Invalid domain operation
401 Unauthorized        Missing or invalid authentication
403 Forbidden           CSRF failure or insufficient access
404 Not Found           Resource does not exist for this user
409 Conflict            Business, duplicate, idempotency, or version conflict
422 Unprocessable Entity Request schema validation failed
429 Too Many Requests   Login rate limit exceeded
500 Internal Server Error Unexpected server failure
```

### Assignment deadline emails

When SMTP is configured, the backend starts a daily APScheduler publisher and
an in-process worker. The publisher enqueues a task; the worker opens its own
database session, queries incomplete assignments due the following day, and
sends grouped emails through SMTP. Set `DEADLINE_EMAIL_HOUR_UTC` and
`DEADLINE_EMAIL_MINUTE_UTC` to choose the daily run time; defaults are 08:00
UTC. The job records the due date emailed for each assignment, so rerunning it
on the same day will not resend those alerts. If SMTP is not configured, the
scheduler and worker stay disabled. Run a single API instance with this
in-process queue; for multi-instance deployments, replace the queue with a
distributed worker such as Redis/RQ or Celery.

### 4. Start the frontend

Open a second terminal and run:

```powershell
python -m http.server 5500 --directory frontend
```

Open `http://localhost:5500` in your browser.

## Useful Links

- API health check: `http://localhost:8000/api/v1/health`
- API documentation: `http://localhost:8000/api/v1/docs`
- Frontend: `http://localhost:5500`
- [Architecture documentation](./docs/architecture.md)
- [API contract](./docs/api.md)
- [Authentication](./docs/authentication.md)
- [Offline synchronization](./docs/offline-sync.md)

## Tests

Run the frontend business-logic tests with Node.js 18 or newer:

```powershell
node --test frontend/tests/*.test.js
```

The frontend suite covers CGPA/SGPA, attendance percentage and prediction, assignment date and priority rules, timer formatting, API errors, and event handling. These tests do not require a browser or backend server.

Run the backend tests with a test PostgreSQL database configured in `TEST_DATABASE_URL`:

```powershell
$env:PYTHONPATH = "backend"
$env:TEST_DATABASE_URL = "postgresql+psycopg2://user:password@localhost:5432/scholaris_test"
pytest backend/tests/test_vertical_slice.py -q
```
