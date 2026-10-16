# Database architecture

Scholaris uses PostgreSQL with SQLAlchemy 2.x for runtime access and Alembic
for schema migrations.

## Persistence boundaries

The database stores:

- users and authentication state
- refresh-token records
- courses and semesters
- assignments and assignment history
- attendance records and attendance history
- timetable entries and exceptions
- study sessions and study goals
- idempotency records for replay-safe assignment mutations

The frontend does not write directly to PostgreSQL. All durable server-side
changes go through the FastAPI API and service layer.

## Key relationships and constraints

- A user owns courses, semesters, assignments, study sessions, refresh
  tokens, and idempotency records. Deleting a user cascades to those records.
- A course belongs to a user and may belong to a semester. Assignments,
  attendance records, timetable entries, and study sessions may reference a
  course; deleting a course cascades to assignments, attendance, and timetable
  entries, while study-session course references are set to null.
- An assignment belongs to both a user and a course. Its history is
  deleted with the assignment, and its `version` is used for optimistic
  concurrency.
- Attendance has a unique `(course_id, date)` key. Timetable exceptions have a
  unique `(timetable_id, exception_date)` key.
- Assignment status, priority, priority mode, recurrence, and the derived
  completion/submission flags are protected by database check constraints in
  addition to Pydantic validation.

## Sessions and transactions

Request handlers receive a synchronous SQLAlchemy `Session` from `get_db`.
The dependency closes the session after the request. Services explicitly commit
successful mutations and refresh created or updated entities before returning
them.

Background workers create independent sessions because they run outside the
request lifecycle.

## Migrations

Apply the current schema with:

```powershell
alembic -c backend/alembic.ini upgrade head
```

Migration files live in `backend/alembic/versions/`. Schema changes should be
made through a new migration rather than by editing an already-applied
migration.

## Consistency and concurrency

Database constraints enforce uniqueness and relationship integrity. The API
maps integrity violations to `409 Conflict`.

Assignment updates use optimistic concurrency. A client supplies the expected
version in the update request body. The service rejects stale writes with a
`VERSION_CONFLICT` response. The assignment response includes the incremented
version; the conflict response does not include server or client state, so the
client must fetch the assignment again before resolving the conflict.

Assignment creation persists an idempotency key, request fingerprint, response
status, and response body in `idempotency_records`. Replaying the same
operation returns the original result; reusing the key with different input is
rejected. These records have no application-level retention job and are
deleted when their user is deleted.

## Query instrumentation

In development, dashboard requests use SQLAlchemy engine events to record:

- number of cursor executions
- aggregate database time
- total request time

The metrics are request-scoped with a `ContextVar`, so concurrent requests do
not share counters.
