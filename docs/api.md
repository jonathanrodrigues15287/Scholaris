# API contract

The API is served under `/api/v1`.

## Documentation endpoints

- Swagger UI: `/api/v1/docs`
- ReDoc: `/api/v1/redoc`
- OpenAPI JSON: `/api/v1/openapi.json`
- Health check: `GET /api/v1/health`

The OpenAPI document is authoritative for request and response schemas. The
main resource groups are authentication, dashboard, courses, assignments,
attendance, timetable, study, and CGPA/academic records.

## Authentication

Authentication endpoints:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /auth/me
POST /auth/logout
```

The backend sets HTTP-only access and refresh cookies. Browser requests must
include credentials. See [authentication.md](./authentication.md).

The resource routers currently cover `/courses`, `/assignments`,
`/attendance`, `/timetable`, `/study`, `/cgpa`, and `/dashboard` in addition
to `/auth`. The generated OpenAPI document at `/api/v1/openapi.json` is the
source of truth for the complete route and schema list.

## Request IDs and errors

The server accepts an optional UUID `X-Request-ID` header and generates one
when it is absent or invalid. Every response returns the ID in the same
header. Error responses use one canonical envelope:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "request_id": "8e5d...",
  "details": [
    {
      "field": "body.title",
      "message": "Field required",
      "type": "missing"
    }
  ]
}
```

For errors without structured details, `details` is `null`. Error responses
never expose stack traces, database errors, secrets, or other sensitive
internal information.

## Pagination

Paginated collection endpoints accept `page` and `page_size`. Pages start at
`1`; the default page size is `20` and the maximum is `100`.

```json
{
  "items": [],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

## Conflict handling

`409 Conflict` represents business-rule conflicts, duplicate records,
idempotency conflicts, and stale optimistic-concurrency writes. Assignment
updates carry the expected version in the JSON request body:

```http
PATCH /api/v1/assignments/42
Content-Type: application/json
```

```json
{
  "title": "Database Assignment",
  "version": 3
}
```

On success, the response contains the updated assignment with `version`
incremented to `4`. A stale request returns the standard error envelope:

```json
{
  "code": "VERSION_CONFLICT",
  "message": "Assignment changed on another device; fetch the latest version and retry",
  "request_id": "8e5d...",
  "details": null
}
```

The conflict response does not include server and client assignment
representations. Fetch the assignment again before resolving the conflict.

`POST /api/v1/assignments` also requires the `X-Idempotency-Key` header. The
key is scoped to the authenticated user and is stored with the request
fingerprint and original response. Other mutation routes do not currently
persist server-side idempotency records, even if the frontend queues them.

## Status codes

```text
200  Successful read or update
201  Resource created
204  Successful delete or logout
400  Invalid request or operation
401  Missing or invalid authentication
403  Authenticated but not permitted
404  Resource not found or unavailable to the caller
409  Conflict, such as a stale version or reused key with different payload
422  Request failed schema validation
429  Rate limit exceeded
500  Unexpected server error
```
