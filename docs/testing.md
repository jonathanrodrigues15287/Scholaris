# Testing strategy

The repository currently contains frontend business-logic tests. Browser
automation is not part of the repository.

Production deployments require a shared Redis instance configured with
`REDIS_URL` for coordinated login throttling across API processes. Local
development can use the bounded in-process fallback.

## Frontend tests

Frontend business-logic tests run independently with Node:

```powershell
node --test frontend/tests/*.test.js
```

The frontend suite covers state, API helpers, assignment rules, attendance,
CGPA, timer behavior, and events. These tests use mocked requests and do not
prove browser storage durability, multi-tab behavior, or network/server
interaction.

## Future coverage

## Browser tests

Browser-level Playwright tests exercise the real FastAPI server and static
frontend. They cover registration and sign-in cookies, CSRF mutation headers,
offline assignment creation, reconnect replay, and session/cookie sharing
across tabs.

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
frontend on port `5500`. The backend database is recreated for each run.
