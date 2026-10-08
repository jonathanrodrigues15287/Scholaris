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
version through `If-Match`; the service rejects stale writes with a
`VERSION_CONFLICT` response containing server and client state.

Assignment creation also persists an idempotency key and request fingerprint.
Replaying the same operation returns the original result; reusing the key with
different input is rejected.

## Query instrumentation

In development, dashboard requests use SQLAlchemy engine events to record:

- number of cursor executions
- aggregate database time
- total request time

The metrics are request-scoped with a `ContextVar`, so concurrent requests do
not share counters.

