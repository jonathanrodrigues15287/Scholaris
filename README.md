# Scholaris

A web-based personal assistant for college students to manage classes, assignments, study sessions, and CGPA.

Scholaris is a client-side application: your information stays in the browser's `localStorage`, and no backend or build process is required.

## Getting Started

1. Open `frontend/index.html` in a modern browser.
2. Add your timetable, assignments, subjects, attendance records, and study sessions.
3. Use **Export Data** in the sidebar to download a JSON backup. Use **Import Data** to restore it on another browser or device.

For the most reliable browser behavior, serve the repository with any local static web server and open `frontend/index.html` through that server.

## Project Structure

```
Scholaris/
├── frontend/
│   ├── index.html        # Main application UI
│   ├── css/              # Module-specific styles
│   │   ├── assignments.css
│   │   ├── dashboard.css
│   │   ├── responsive.css
│   │   ├── style.css
│   │   └── timetable.css
│   └── js/
│       ├── accessibility.js # Keyboard and accessibility enhancements
│       ├── attendance.js  # Attendance tracking and stats
│       ├── assignments.js # Task CRUD, submission tracking
│       ├── cgpa.js       # Dynamic SGPA/CGPA calculator
│       ├── nav.js        # Sidebar navigation and data import/export
│       ├── states.js     # Empty states and UI placeholders
│       ├── theme.js      # Theme toggling
│       ├── timer.js      # Pomodoro timer implementation
│       ├── timetable.js  # Timetable rendering and OCR
│       ├── toast.js      # Toast notification system
│       └── validation.js # Input validation helpers
├── backend/
│   ├── app/                 # FastAPI application and layered backend code
│   ├── requirements.txt
│   └── tests/               # Backend API tests
└── README.md
```

## Features

- **Dashboard** — Live overview of upcoming classes and pending deadlines
- **Timetable** — Upload a PDF or image of your timetable to automatically extract and parse your schedule using in-browser OCR (Tesseract.js). The parsed schedule is editable and persisted locally.
- **Assignments** — Full task CRUD with due-date badges, status and priority filters, manual or automatic priority, sorting, completion toggle, and a dedicated section for submitted assignments; persisted to `localStorage`
- **Study Planner** — Pomodoro timer (25 min focus / 5 min break) with animated SVG ring. Includes a session history log where you can record what you accomplished after each focus block.
- **CGPA Calculator** — Dynamic multi-subject SGPA calculator; rows persisted to `localStorage`
- **Attendance Tracker** — Log daily lecture attendance, mark holidays or exam days, and track present/absent statistics.
- **Data management** — Export all Scholaris data to JSON, import a previous backup, or clear local data from the sidebar.
- **Accessibility** — Keyboard-friendly navigation, skip-link support, labels, focus states, and screen-reader attributes are included throughout the interface.

## Tech

- Vanilla HTML, CSS, JavaScript — no build step
- **PDF.js** (CDN, lazy-loaded) for rendering PDF timetables to images
- **Tesseract.js** (CDN, lazy-loaded) for in-browser OCR scanning of timetables
- Phosphor Icons via CDN
- Flatpickr via CDN for date inputs
- Google Fonts (Inter)
- `localStorage` for all data persistence

## Privacy

Scholaris does not include a server or account system. Application data is stored locally in the browser. Timetable OCR runs in the browser after the required library is loaded from its CDN, and uploaded timetable files are not sent to a Scholaris backend.

## Backend Development

The first backend vertical slice is available under `backend/` and provides:

- `POST /auth/register` and `POST /auth/login` with JWT authentication
- Authenticated course creation and listing through `/courses`
- Authenticated assignment creation, listing, and status updates through `/assignments`
- SQLAlchemy models for users, courses, and assignments

The default database is PostgreSQL:

```text
DATABASE_URL=postgresql+psycopg2://scholaris:scholaris@localhost:5432/scholaris
JWT_SECRET_KEY=replace-this-value
```

From the repository root, install the backend dependencies and run the API with:

```powershell
python -m pip install -r backend/requirements.txt
$env:PYTHONPATH = "backend"
uvicorn app.main:app --reload --app-dir backend
```

The vertical slice test uses SQLite, so it does not require PostgreSQL:

```powershell
$env:PYTHONPATH = "backend"
pytest backend/tests/test_vertical_slice.py -q
```

When the API is running at `http://localhost:8000`, the frontend shows Login and Register controls in the top bar. After connecting an account, assignments are fetched from the API and new, completed, submitted, or deleted assignments are synchronized there. Without a connection, the existing `localStorage` behavior remains available.

