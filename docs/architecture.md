# Scholaris architecture

Scholaris is a browser-based student productivity application with a static
frontend and a FastAPI backend.

## System overview

```text
Browser
  ├─ HTML/CSS/JavaScript UI
  ├─ local state and user-scoped offline mutation queue
  └─ cookie-authenticated API requests
          │
          ▼
FastAPI application (/api/v1)
  ├─ request ID and security middleware
  ├─ routers (HTTP boundary)
  ├─ services (business rules, idempotency, and assignment concurrency)
  ├─ SQLAlchemy sessions and models
  └─ structured errors and request logging
          │
          ├─ PostgreSQL
          └─ APScheduler → in-process queue → email worker → SMTP
```

## Backend layers

- **Middleware** handles request IDs, CSRF checks, security headers, CORS,
  mutation idempotency, and development-only dashboard query metrics.
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

The browser queue is not a backend queue: it is a user-scoped `localStorage`
data structure owned by the current frontend. It enqueues mutations immediately
when offline and replays authenticated mutations sequentially when the browser
is online. Queue operations are capped at 500 entries and aged after 30 days.
The Pending Changes screen exposes retry and discard controls.

The backend mutation-idempotency middleware stores successful replayable
responses for authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests that
carry `X-Idempotency-Key`. Assignment creation also has service-level
idempotency. Assignment edits remain subject to optimistic version checks.

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
When SMTP is configured, startup reports scheduler and worker state separately
through `GET /api/v1/health`. Worker or scheduler startup failure is logged and
the API remains available in degraded mode instead of crashing the application
process.

Deadline reminder execution uses a distributed lease for the due-date key.
Redis is preferred when `REDIS_URL` is configured; PostgreSQL uses a session
advisory lock as a fallback, and local SQLite/test deployments use an in-process
lease. The lease prevents multiple API workers from sending the same day's
reminder set twice.

## Observability

Every response carries an `X-Request-ID`. Structured log events include the
same ID when work occurs during a request. Development dashboard metrics record
SQL query count, aggregate database time, and total request time.
