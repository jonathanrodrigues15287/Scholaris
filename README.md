# Scholaris

A web-based personal assistant for college students to manage classes, assignments, study sessions, and CGPA.

## Project Structure

```
college-personal-assistant/
├── frontend/
│   ├── abc               # Bundled version of the entire codebase
│   ├── index.html        # Main application UI
│   ├── styles.css        # Styling, theming, responsive layout
│   └── js/
│       ├── theme.js      # Theme toggle, localStorage persistence, prefers-color-scheme
│       ├── nav.js        # Sidebar navigation, mobile hamburger menu
│       ├── assignments.js # Add/complete/delete tasks, localStorage, dashboard sync
│       ├── cgpa.js       # Dynamic multi-subject SGPA calculator, localStorage
│       ├── timer.js      # Pomodoro timer with SVG ring, focus/break phases, session history
│       └── timetable.js  # Timetable upload (PDF/image), Tesseract.js OCR, grid rendering
└── README.md
```

## Features

- **Dashboard** — Live overview of upcoming classes and pending deadlines
- **Timetable** — Upload a PDF or image of your timetable to automatically extract and parse your schedule using in-browser OCR (Tesseract.js). The parsed schedule is editable and persisted locally.
- **Assignments** — Full task CRUD with due-date badges and completion toggle; persisted to `localStorage`
- **Study Planner** — Pomodoro timer (25 min focus / 5 min break) with animated SVG ring. Includes a session history log where you can record what you accomplished after each focus block.
- **CGPA Calculator** — Dynamic multi-subject SGPA calculator; rows persisted to `localStorage`

## Tech

- Vanilla HTML, CSS, JavaScript — no build step
- **PDF.js** (CDN) for rendering PDF timetables to images
- **Tesseract.js** (CDN) for in-browser OCR scanning of timetables
- Phosphor Icons via CDN
- Google Fonts (Inter)
- `localStorage` for all data persistence
