# Authentication and authorization

## Session model

Scholaris uses JWT access and refresh tokens stored in HTTP-only cookies.
Access tokens expire after the configured `ACCESS_TOKEN_EXPIRE_MINUTES`
(30 minutes by default). Refresh tokens expire after
`REFRESH_TOKEN_EXPIRE_DAYS` (14 days by default), are tracked server-side, and
can be revoked and rotated.

The frontend sends:

```js
fetch(url, { credentials: "include" })
```

The server validates the access token, loads the user, and requires the user
to be active before protected routes run.

## Login flow

1. Register with `POST /api/v1/auth/register`.
2. Login with `POST /api/v1/auth/login` using OAuth2 form fields:
   `username` and `password`.
3. The server sets access and refresh cookies.
4. Use `GET /api/v1/auth/me` to restore the session.
5. When the access token expires, call `POST /api/v1/auth/refresh`.
6. Logout with `POST /api/v1/auth/logout`, which revokes the refresh token and
   clears the cookies.

The access and refresh cookies are `HttpOnly`, `SameSite=Lax`, and use the
configured `COOKIE_DOMAIN`. `Secure` is enabled automatically in production
unless `COOKIE_SECURE` is explicitly configured.

## CSRF protection

Cookie-authenticated state-changing requests must send
`X-CSRF-Token` matching the readable `csrf_token` cookie. Requests without a
matching token receive `403 CSRF_ERROR`.

Safe methods (`GET`, `HEAD`, and `OPTIONS`) do not require the CSRF header.
The frontend reads the CSRF cookie and adds the header to mutating requests;
the access and refresh cookies themselves remain unreadable to JavaScript.

## Passwords and tokens

- Passwords are stored as salted `scrypt` hashes.
- JWTs are signed with the configured `JWT_SECRET_KEY` and algorithm.
- Access and refresh tokens have distinct token types.
- Refresh tokens include a unique identifier and are stored by hash.
- Refresh tokens are rotated on refresh and can be revoked on logout.
- Login attempts are rate-limited per IP and per account identifier after
  failures.

## Security configuration

Production deployments should use secure cookies, a strong secret of at least
32 characters, explicit CORS origins, HTTPS, and a single trusted frontend
origin or an appropriately controlled allowlist.
