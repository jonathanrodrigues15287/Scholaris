# Scholaris

A web-based personal assistant for college students to manage classes, assignments, study sessions, and CGPA.

## Project Structure

```
college-personal-assistant/
├── frontend/
│   ├── index.html        # Main application UI
│   ├── css/              # Module-specific styles
│   │   ├── assignments.css
│   │   ├── dashboard.css
│   │   ├── responsive.css
│   │   ├── style.css
│   │   └── timetable.css
│   └── js/
│       ├── assignments.js # Task CRUD, submission tracking
│       ├── attendance.js  # Attendance tracking and stats
│       ├── cgpa.js       # Dynamic SGPA/CGPA calculator
│       ├── nav.js        # Sidebar navigation handling
│       ├── states.js     # Empty states and UI placeholders
│       ├── theme.js      # Theme toggling
│       ├── timer.js      # Pomodoro timer implementation
│       ├── timetable.js  # Timetable rendering and OCR
│       ├── toast.js      # Toast notification system
│       └── validation.js # Input validation helpers
└── README.md
```

## Features

- **Dashboard** — Live overview of upcoming classes and pending deadlines
- **Timetable** — Upload a PDF or image of your timetable to automatically extract and parse your schedule using in-browser OCR (Tesseract.js). The parsed schedule is editable and persisted locally.
- **Assignments** — Full task CRUD with due-date badges, completion toggle, and a dedicated section for submitted assignments; persisted to `localStorage`
- **Study Planner** — Pomodoro timer (25 min focus / 5 min break) with animated SVG ring. Includes a session history log where you can record what you accomplished after each focus block.
- **CGPA Calculator** — Dynamic multi-subject SGPA calculator; rows persisted to `localStorage`
- **Attendance Tracker** — Log daily lecture attendance, mark holidays or exam days, and track present/absent statistics.

## Tech

- Vanilla HTML, CSS, JavaScript — no build step
- **PDF.js** (CDN) for rendering PDF timetables to images
- **Tesseract.js** (CDN) for in-browser OCR scanning of timetables
- Phosphor Icons via CDN
- Google Fonts (Inter)
- `localStorage` for all data persistence

