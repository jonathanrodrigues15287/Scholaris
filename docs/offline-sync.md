# Offline synchronization

Scholaris supports browser-local queuing for authenticated mutations. This is not a universal offline-first guarantee: reads still require the API.
Mutations may be queued locally and replayed with stable operation IDs.

## Client queue

When an authenticated mutation is attempted while the browser reports itself
offline, or when a network/HTTP failure occurs, the frontend stores an operation
in `localStorage` under `scholaris_sync_queue`. Every mutation request receives
a stable `X-Idempotency-Key`. The operation contains its user ID, path, method,
request body and headers, timestamps, attempt count, operation ID, and state.
The queue is user-scoped and replayed sequentially when the browser is online
and that user is authenticated.

The queue retains at most 500 operations. Retryable operations remain eligible
for replay. Conflict and permanent operations are retained for review and are
age-cleaned after 30 days. Successful operations are removed immediately.
Automatic cleanup runs when queue state is read, and users can additionally
discard or retry individual operations from the Pending Changes screen.

The queue does not silently evict older work when it reaches 500 operations.
Instead, new mutations are rejected locally with a queue-full error directing
the user to Pending Changes. That screen shows current capacity, the 30-day
retention period, the individual expiration countdown for failed/conflicted
changes, and retry/discard controls. Expiration removes only locally queued
failed/conflicted entries; retryable work remains until replay succeeds or the
user resolves it.

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

## Pending Changes review

The sidebar's **Pending Changes** screen lists queued operations that are
waiting, retryable, permanently failed, or conflicting. Each item shows the
HTTP method and path, latest error, update time, retry count, and state.
Users can retry one operation, retry all eligible operations, or discard one
or all failed changes after confirmation.

## Server guarantees

Mutating API requests carrying `X-Idempotency-Key` are handled by server
idempotency middleware. The key is scoped to the authenticated user and stored
with the request method, path, payload fingerprint, status, and response body.
Replaying the same operation returns the original successful response.
Reusing a key with a different method, path, or payload returns
`409 IDEMPOTENCY_CONFLICT`. Records are automatically removed after 30 days.
The server first inserts a pending reservation under a unique
`(user_id, operation_id)` constraint. Concurrent requests sharing the key wait
for the winner to complete and receive the replayed response; different
payloads are rejected immediately. Requests that return an error are not cached
and abandon the reservation so a later retry can execute.

This protects replayed mutations from duplicate execution where the middleware
can return a cached response. Assignment creation also has its service-level
idempotency implementation, providing an existing atomic assignment-create
contract. Idempotency does not convert every domain operation into a distributed
transaction, and assignment version conflicts must still be resolved explicitly.

## Current coverage

| Concern | Current behavior |
| --- | --- |
| Server-side idempotency | Mutating requests with `X-Idempotency-Key` store the user, request fingerprint, original status, and response body. Assignment creation also has service-level replay handling. |
| Version-based concurrency | `PATCH /assignments/{id}` only. The JSON body must include the last observed `version`; stale writes return `409 VERSION_CONFLICT`. |
| Automatically retried failures | Network failures, `408`, `425`, `429`, `5xx`, and authenticated `401` responses, up to five replay attempts. |
| User action required | `VERSION_CONFLICT` requires resolution. Validation and other non-retryable failures become `permanent` and need correction or an explicit retry. |
| Retention | Maximum 500 queued operations. Successful operations are removed immediately; retryable operations remain queued; conflict/permanent operations receive 30-day cleanup. |
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
