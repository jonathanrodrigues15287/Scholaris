# Testing strategy

The repository currently contains frontend business-logic tests. Backend test
assets and browser automation are not part of the repository.

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

When backend tests or browser automation are reintroduced, document their
commands and CI jobs here. Browser workflows should cover offline assignment
creation, reconnect retries, idempotency, authentication cookies, and CSRF.
