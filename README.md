# College Personal Assistant

A web-based personal assistant for college students to manage classes, assignments, study sessions, and CGPA.

## Project Structure

```
college-personal-assistant/
├── frontend/
│   ├── index.html        # Main application UI
│   ├── styles.css        # Styling, theming, responsive layout
│   └── js/
│       ├── theme.js      # Theme toggle, localStorage persistence, prefers-color-scheme
│       ├── nav.js        # Sidebar navigation, mobile hamburger menu
│       ├── assignments.js # Add/complete/delete tasks, localStorage, dashboard sync
│       ├── cgpa.js       # Dynamic multi-subject SGPA calculator, localStorage
│       └── timer.js      # Pomodoro timer with SVG ring, focus/break phases
└── README.md
```

## Features

- **Dashboard** — Live overview of upcoming classes and pending deadlines
- **Timetable** — Weekly class schedule manager
- **Assignments** — Full task CRUD with due-date badges and completion toggle; persisted to `localStorage`
- **Study Planner** — Pomodoro timer (25 min focus / 5 min break) with animated SVG ring
- **CGPA Calculator** — Dynamic multi-subject SGPA calculator; rows persisted to `localStorage`

## Tech

- Vanilla HTML, CSS, JavaScript — no build step, no dependencies
- Phosphor Icons via CDN
- Google Fonts (Inter)
- `localStorage` for all data persistence
