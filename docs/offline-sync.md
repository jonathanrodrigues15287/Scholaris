# Offline synchronization

## Goal

Students should be able to record assignments, attendance, and study activity
even when the browser temporarily loses connectivity.

## Client queue

Before sending a mutation, the frontend creates a stable operation ID. A
network failure for an authenticated mutation stores the operation in
`localStorage` with:

- operation ID
- entity and entity ID when known
- operation type
- payload
- request path and method
- creation and update timestamps
- retry count
- pending or conflict state

The operation ID is sent as `X-Idempotency-Key` and is reused for every retry.

## Replay

When the browser is online and the user is authenticated, the client flushes
pending operations sequentially. Successful operations are removed. Temporary
network failures are retried up to the configured retry limit. Validation,
authorization, and conflict responses are retained as a conflict instead of
being incorrectly treated as an offline condition.

## Server guarantees

Assignment creation persists the idempotency key, request fingerprint, and
original response atomically. Replaying the same operation is safe. Reusing an
operation ID with a different payload returns `409 Conflict`.

Other mutation endpoints receive the idempotency header but do not all yet
persist server-side idempotency records. They should not be described as
exactly-once until that persistence is added.

## Conflict resolution

Assignment edits use optimistic concurrency. The client sends the version it
last observed in `If-Match`. If the server version has advanced, the API
returns `VERSION_CONFLICT` with both server and client representations.

The UI can choose to:

- accept the server version
- retry the client version after reviewing the change
- merge fields and submit a new version

Blind last-write-wins is intentionally avoided because it can silently erase
changes made on another device.

## Future scale

The current queue is browser-local and intentionally simple. A multi-instance
deployment may add a distributed server-side queue for asynchronous work, but
the client operation envelope and conflict contract should remain stable.

