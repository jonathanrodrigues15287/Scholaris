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

## Request IDs and errors

The server accepts an optional UUID `X-Request-ID` header and generates one
when it is absent or invalid. Every response returns the ID in the same
header. Error responses also include it in `error.request_id`.

```json
{
  "detail": "Request validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "body.title",
        "message": "Field required",
        "type": "missing"
      }
    ],
    "request_id": "8e5d..."
  }
}
```

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
updates use:

```http
If-Match: 3
```

Stale assignment writes return `VERSION_CONFLICT` with `server`, `client`, and
`updated_at` fields.

## Status codes

```text
200  Successful read or update
201  Resource created
204  Successful delete or logout
400  Invalid domain operation
401  Missing or invalid authentication
403  CSRF failure or forbidden operation
404  Resource not found
409  Conflict
422  Request validation failure
429  Rate limit exceeded
500  Unexpected server error
```

