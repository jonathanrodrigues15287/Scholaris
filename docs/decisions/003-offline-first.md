# ADR 003: Use an offline-first mutation queue

- **Status:** Accepted
- **Date:** 2026-10-07

## Problem

Students may lose connectivity while recording attendance, assignments, or
study sessions. Rejecting every mutation during a short network outage makes
the application unreliable in ordinary student environments.

## Decision

Persist authenticated mutation envelopes in the browser while offline or when
a network or retryable HTTP failure occurs. Retry them when connectivity
returns. Mutations receive a stable client operation ID and
`X-Idempotency-Key`; server middleware provides replay protection for successful
authenticated mutations carrying that key.

The envelope records the request path, method, payload, timestamps, retry
count, and synchronization state. The queue is capped at 500 entries and
cleans old failed review entries after 30 days. The API stores mutation
fingerprints and original responses, and assignment creation also has
service-level idempotency.

## Conflict strategy

Use optimistic concurrency for assignment edits. The client sends the version
it observed as the `version` field in the JSON PATCH body. A stale write is
rejected with `409 VERSION_CONFLICT`. The response uses the standard error
envelope and does not promise server/client representations; clients fetch the
latest assignment before resolving the conflict.

The user or UI can then choose server-wins, client-wins after review, or a
field-level merge. The system does not silently overwrite a newer change.

## Alternatives rejected

- **Blind last-write-wins:** can silently overwrite work from another device.
- **Fail every mutation while offline:** loses user work and creates a poor
  experience.
- **Server queue only:** cannot preserve a mutation when the browser cannot
  reach the server in the first place.

## Consequences

- The frontend exposes pending, retryable, conflict, permanent, and synced
  states in the Pending Changes review screen.
- Mutations must carry stable server idempotency keys for replay protection.
- User-visible failure handling remains necessary for domain conflicts and
  permanent failures that idempotency cannot resolve.
- Local browser storage is not a substitute for server durability; successful
  replay is the point at which the server becomes authoritative.
