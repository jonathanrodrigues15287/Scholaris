# Offline synchronization

Scholaris supports browser-local queuing for authenticated mutations. This is
not a universal offline-first guarantee: reads still require the API, and only
one mutation family currently has durable server-side idempotency.

## Client queue

When an authenticated mutating request fails with a network error or an HTTP
error response, the frontend may store an operation in `localStorage` under
`scholaris_sync_queue`. The operation contains its user ID, path, method,
request body and headers, timestamps, attempt count, operation ID, and state.
The queue is user-scoped and is replayed sequentially when the browser is
online and that user is authenticated.

Queued operations have no time-to-live or automatic age-based deletion. They
remain until they succeed, are explicitly retried or resolved, or the user
clears local Scholaris data. A `permanent` operation is not discarded
automatically.

## Replay

When the browser is online and the user is authenticated, the client flushes
`pending` and `retryable` operations sequentially. An operation becomes
`syncing` while it is being replayed. Successful operations are removed.
Network failures, `408`, `425`, `429`, and `5xx` responses become `retryable`
and are replayed up to five attempts. An authenticated `401` is also retained
as retryable. After five replay attempts, the operation becomes `permanent`.
Validation and other non-retryable failures become `permanent` and remain
visible for explicit retry or correction. Version conflicts are retained as
`conflict` and are never silently marked as synchronized.

Refreshing or logging out does not discard queued operations. Logout revokes
the server refresh token and clears cookies, but queued operations remain in
browser storage, paused until the same user authenticates again.

## Server guarantees

Assignment creation persists the idempotency key, request fingerprint, and
original response atomically. Replaying the same operation is safe. Reusing an
operation ID with a different payload returns `409 IDEMPOTENCY_CONFLICT`.
`POST /assignments` requires the `X-Idempotency-Key` header.

Other mutations can be queued, but the frontend does not attach a persisted
server idempotency record to them. They should not be described as exactly-once
until that persistence is added.

## Current coverage

| Concern | Current behavior |
| --- | --- |
| Server-side idempotency | `POST /assignments` only. It requires `X-Idempotency-Key`, stores the request fingerprint and original response, and replays the response for the same user and key. |
| Version-based concurrency | `PATCH /assignments/{id}` only. The JSON body must include the last observed `version`; stale writes return `409 VERSION_CONFLICT`. |
| Automatically retried failures | Network failures, `408`, `425`, `429`, `5xx`, and authenticated `401` responses, up to five replay attempts. |
| User action required | `VERSION_CONFLICT` requires resolution. Validation and other non-retryable failures become `permanent` and need correction or an explicit retry. |
| Retention | No time limit. Successful operations are removed; conflict and permanent operations remain for review. |
| Logout with pending changes | The queue is retained and not replayed while logged out. It becomes eligible when the same user authenticates again. |

## Conflict resolution

Assignment edits use optimistic concurrency. The client sends the version it
last observed as the `version` field in the JSON PATCH body. If the server
version has advanced, the API returns `409 VERSION_CONFLICT`. The error does
not include server or client assignment representations, so the client must
fetch the latest assignment before resolving the conflict.

The UI can choose to:

- accept the server version
- deliberately keep the reviewed local values by submitting a new request
  with the latest server version
- merge selected fields and submit a new version

Blind last-write-wins is intentionally avoided because it can silently erase
changes made on another device.

## Future scale

The current queue is browser-local and intentionally simple. A multi-instance
deployment may add a distributed server-side queue for asynchronous work, but
the client operation envelope and conflict contract should remain stable.
