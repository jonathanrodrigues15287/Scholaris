# Testing strategy

Scholaris uses four test levels. Each level has a different boundary, setup
cost, and failure signal; a passing lower level does not replace the level
above it.

## Level 1: unit tests

Unit tests isolate pure business logic and do not require a database, HTTP
client, SMTP server, or browser. They cover status transitions, date
calculations, validation helpers, hashing, and request transformation.

```powershell
pytest backend/tests/test_unit.py -m unit -q
```

The main unit module is
[test_unit.py](../backend/tests/test_unit.py). Keep these tests deterministic
and fast; mock external boundaries rather than recreating the application.

## Level 2: database integration tests

Database tests verify SQLAlchemy behavior that mocks cannot prove: migrations,
foreign keys, unique constraints, optimistic locking, commit/rollback
semantics, and concurrent claims. API tests are also marked `db` because they
run against the migrated database.

Configure a disposable PostgreSQL database before running them:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg2://user:password@localhost:5432/scholaris_test"
$env:PYTHONPATH = "backend"
pytest backend/tests -m db -q
```

The `api_app` fixture runs Alembic migrations to `head`. Tests should use a
unique user or operation key and avoid relying on execution order. PostgreSQL
specific behavior must not be inferred from SQLite-only tests.

Clean-schema migration smoke tests require a disposable database:

```powershell
$env:TEST_DATABASE_URL = "postgresql+psycopg2://user:password@localhost:5432/scholaris_test"
$env:TEST_DATABASE_IS_DISPOSABLE = "1"
pytest backend/tests/test_migrations.py -q
```

The migration test verifies one expected head (`0017_assignment_versions`),
required tables, assignment version/reminder columns, idempotency uniqueness,
refresh-token indexes, and a base-to-head downgrade/upgrade cycle. Never set
`TEST_DATABASE_IS_DISPOSABLE=1` for a database containing production or
development data.

## Level 3: API integration tests

API tests send requests through FastAPI, including routing, Pydantic
validation, authentication, CSRF middleware, database dependencies, exception
handlers, and response schemas.

```powershell
pytest backend/tests -m api -q
```

Important interaction scenarios include stale assignment updates returning
`409`, concurrent idempotency keys producing one assignment, refresh-token
reuse returning `401`, and CSRF failures returning `403`.

## Level 4: end-to-end tests

End-to-end tests will drive the real frontend against a running API and
database. The repository currently has no browser automation dependency, so
this level is an explicit gap rather than a test command that silently
pretends to provide browser coverage.

The first E2E workflows should cover:

1. Queue assignment creation while offline.
2. Reconnect and retry the same operation key.
3. Verify exactly one assignment appears.
4. Exercise authentication cookies and CSRF through the browser.

When browser automation is introduced, mark those tests `e2e` and keep them
separate from the API test process.

## Frontend tests

Frontend business-logic tests run independently with Node:

```powershell
node --test frontend/tests/*.test.js
```

Coverage is reported with branch data for critical code rather than treated as
proof of correctness:

```powershell
pytest backend/tests/test_assignment_concurrency.py `
  backend/tests/test_failure_paths.py `
  backend/tests/test_auth.py `
  --cov=backend/app `
  --cov-branch `
  --cov-report=term-missing
```

The initial project goal is approximately 80% overall statement coverage,
with stronger branch and negative-path coverage for authentication,
idempotency, optimistic locking, and transaction boundaries. A coverage
threshold should be enforced after the existing full-suite collection
blockers are resolved.

They currently cover state, API helpers, assignment rules, attendance, CGPA,
timer behavior, and events. Browser rendering and network/server interaction
remain Level 4 concerns.

## CI order and failure triage

Run the fast tests first, then progressively more expensive boundaries:

```powershell
pytest backend/tests/test_unit.py -m unit -q
pytest backend/tests -m "db and not api" -q
pytest backend/tests -m api -q
node --test frontend/tests/*.test.js
```

Use a disposable database per CI job. Do not share a mutable development
database with tests. A missing `TEST_DATABASE_URL` intentionally skips
database-backed tests locally; CI should provide it and fail the job if the
database setup cannot run.

The current branch also contains pre-existing collection blockers in
`backend/tests/test_unit.py` and `backend/app/utils/validators.py`. The
commands above are the intended target commands; the full suite will become
runnable after those baseline issues are repaired.

The frontend queue contract is covered by
[api.test.js](../frontend/tests/api.test.js), including assignment
version-conflict resolution and the distinction between retryable and
permanent queued failures. These tests use mocked requests; they do not prove
browser storage durability or multi-tab behavior.

## Failure-path coverage

Important operations are tested at the point where their failure becomes
observable:

| Operation | Failure path | Expected invariant |
| --- | --- | --- |
| Assignment creation | Commit fails | Session rolls back; no success response is produced |
| Assignment creation | Concurrent identical key | One committed operation; losing request replays the winner |
| Assignment creation | Key reused with new data | `409` idempotency conflict |
| Assignment update | ORM detects stale version | Rollback and `409` version conflict |
| Refresh rotation | Another request claims the token first | Rollback and only one successful rotation |
| Refresh rotation | Replacement creation/commit fails | Old-token revocation is rolled back |
| Email delivery | SMTP transient failure | Bounded retry with backoff; marker is not set on exhaustion |
| Worker shutdown | Stop during retry or processing | Active work is bounded; pending work remains recoverable |
| Scheduler startup | Scheduler cannot start | Worker is stopped and startup failure propagates |

The refresh-token API tests in
[test_auth.py](../backend/tests/test_auth.py) cover successful rotation,
revoked-token reuse, and logout. The focused mock-based failure tests are in
[test_failure_paths.py](../backend/tests/test_failure_paths.py).
