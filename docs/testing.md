# Testing strategy

The repository contains frontend business-logic tests, backend API tests, and
real-browser Playwright tests.

Production deployments require a shared Redis instance configured with
`REDIS_URL` for coordinated login throttling across API processes. Local
development can use the bounded in-process fallback.

## Frontend tests

Frontend business-logic tests run independently with Node:

```powershell
node --test frontend/tests/*.test.js
```

The frontend suite covers state, API helpers, assignment rules, attendance,
CGPA, timer behavior, queue retry distinctions, assignment conflict resolution,
and events. These tests use mocked requests for API behavior.

## Backend tests

Run the backend suite from the repository root:

```powershell
python -m pytest -q backend/tests
```

The suite covers authentication, schemas, API contracts, idempotency, version
conflicts, security, rate limiting, and calculation edge cases.
It includes simultaneous replay coverage to verify that concurrent requests
with the same idempotency key execute the mutation only once.
Queue tests cover the 500-operation limit and verify 30-day cleanup of failed
or conflicted operations.
Backend tests cover deadline worker lifecycle state, duplicate reminder-run
leases, grouped reminder delivery, and the health endpoint's scheduler status.

## Browser tests

Browser-level Playwright tests exercise the real FastAPI server and static
frontend. They cover registration and sign-in cookies, CSRF mutation headers,
offline assignment creation, reconnect replay, and session/cookie sharing
across tabs.
The offline test verifies that a mutation is queued immediately from the
browser and removed after successful replay.

Install the browser dependencies once:

```powershell
npm install
npx playwright install chromium
```

Run the suite from the repository root:

```powershell
npm run test:browser
```

Playwright starts an isolated SQLite backend on port `8000` and the static
frontend on port `5500`. The browser server deletes any prior SQLite database
and uses a fresh `create_all()` test fixture. Deployment migrations are tested
separately against clean PostgreSQL in the migration workflow.

## Continuous integration

Pull requests run these checks independently:

- **Backend unit and API tests**: SQLite test run for the backend suite.
- **Backend PostgreSQL tests**: the backend suite against PostgreSQL 16.
- **Frontend unit tests**: Node tests for frontend state and business logic.
- **Browser tests**: Playwright against the real FastAPI and static frontend.
- **Migration check**: Alembic upgrade, downgrade to base, and upgrade again
  against PostgreSQL 16 in a dedicated `Migration tests` workflow.

Separate jobs make failures easier to locate. The migration check is a
standalone GitHub Actions job and does not depend on backend or browser tests.
