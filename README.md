# Scholaris

Scholaris is a student productivity app for managing academic work in one place.

## Features

- Dashboard with upcoming classes, assignments, attendance, and study progress
- Assignment tracking
- Attendance tracking and predictions
- Weekly timetable management
- Study timer and study history
- SGPA and CGPA calculations

## Built With

- Frontend: HTML, CSS, and JavaScript
- Backend: FastAPI and SQLAlchemy
- Database: PostgreSQL
- Migrations: Alembic

## Project Structure

```text
scholaris/
├── backend/
│   ├── app/
│   │   ├── core/       # Configuration, security, and database setup
│   │   ├── models/     # Database models
│   │   ├── routers/    # API routes
│   │   ├── schemas/    # Request and response schemas
│   │   └── services/   # Application logic
│   ├── alembic/        # Database migrations
│   ├── tests/          # Backend tests
│   └── requirements.txt
├── frontend/
│   ├── css/            # Stylesheets
│   ├── js/             # Frontend scripts
│   └── index.html      # Main application page
├── .env.example        # Environment variable template
└── README.md
```

## Setup

### Requirements

- Python 3.11 or newer
- PostgreSQL
- A modern web browser

### 1. Configure the database

Create a PostgreSQL database, then copy the environment file:

```powershell
Copy-Item .env.example .env
```

Update `.env` with your database URL and a JWT secret of at least 32 characters.

### 2. Install the backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
alembic -c backend/alembic.ini upgrade head
```

### 3. Start the backend

```powershell
$env:PYTHONPATH = "backend"
uvicorn app.main:app --reload --app-dir backend
```

The API runs at `http://localhost:8000`.

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

## Tests

Run the backend tests with a test PostgreSQL database configured in `TEST_DATABASE_URL`:

```powershell
$env:PYTHONPATH = "backend"
$env:TEST_DATABASE_URL = "postgresql+psycopg2://user:password@localhost:5432/scholaris_test"
pytest backend/tests/test_vertical_slice.py -q
```
