# ADR 003: Use an offline-first mutation queue

- **Status:** Accepted
- **Date:** 2026-10-07

## Problem

Students may lose connectivity while recording attendance, assignments, or
study sessions. Rejecting every mutation during a short network outage makes
the application unreliable in ordinary student environments.

## Decision

Persist authenticated mutation envelopes in the browser when a network or
retryable HTTP failure occurs. Retry them when connectivity returns. Assignment
creation preserves a server idempotency key; other mutations have only a
client-side queue operation ID and do not yet have server-side exactly-once
protection.

The envelope records the request path, method, payload, timestamps, retry
count, and synchronization state. The API treats assignment creation replays
idempotently using the operation key and request fingerprint.

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

- The frontend must show pending and conflict states.
- Assignment creation must carry a stable server idempotency key; other queued
  mutations require user-visible failure handling because they are not
  server-side exactly-once operations.
- Server-side idempotency persistence must be expanded to every mutation
  endpoint before claiming exactly-once semantics for the entire API.
- Local browser storage is not a substitute for server durability; successful
  replay is the point at which the server becomes authoritative.
