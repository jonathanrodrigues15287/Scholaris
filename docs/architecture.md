# Scholaris architecture

Scholaris is a browser-based student productivity application with a static
frontend and a FastAPI backend.

## System overview

```text
Browser
  ├─ HTML/CSS/JavaScript UI
  ├─ local state and offline mutation queue
  └─ cookie-authenticated API requests
          │
          ▼
FastAPI application (/api/v1)
  ├─ request ID and security middleware
  ├─ routers (HTTP boundary)
  ├─ services (business rules)
  ├─ SQLAlchemy sessions and models
  └─ structured errors and request logging
          │
          ├─ PostgreSQL
          └─ APScheduler → in-process queue → email worker → SMTP
```

## Backend layers

- **Middleware** handles request IDs, CSRF checks, security headers, CORS, and
  development-only dashboard query metrics.
- **Routers** validate HTTP input, resolve the authenticated user, and delegate
  to services.
- **Services** contain domain operations such as assignment lifecycle rules,
  attendance analytics, GPA calculations, and synchronization safeguards.
- **Models** define SQLAlchemy persistence mappings.
- **Schemas** define Pydantic request and response contracts.
- **Alembic** applies versioned database migrations.

The application uses synchronous SQLAlchemy sessions. Each dependency-created
session is closed after the request. Background jobs create their own session
instead of reusing request state.

## Request lifecycle

1. The request context middleware accepts or generates a UUID request ID.
2. Security middleware validates CSRF for cookie-authenticated mutations.
3. FastAPI resolves authentication and database dependencies.
4. A router calls the relevant service.
5. Domain, validation, or infrastructure errors are converted to the common
   API error envelope.
6. The response includes `X-Request-ID` for client-side correlation.

See [api.md](./api.md), [authentication.md](./authentication.md), and
[offline-sync.md](./offline-sync.md) for the cross-cutting contracts.

## Background work

Deadline reminders currently use an in-process architecture:

```text
APScheduler
    ↓
Queue[DeadlineEmailTask]
    ↓
deadline-email-worker thread
    ↓
database query and SMTP delivery
```

This keeps local development simple while providing a queue boundary that can
later be replaced with Redis/RQ, Celery, or another distributed worker system.
Only one API instance should run the in-process scheduler in production.

## Observability

Every response carries an `X-Request-ID`. Structured log events include the
same ID when work occurs during a request. Development dashboard metrics record
SQL query count, aggregate database time, and total request time.

