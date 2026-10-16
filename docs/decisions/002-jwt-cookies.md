# ADR 002: Use JWT sessions in HTTP-only cookies

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The browser frontend needs an authenticated session without exposing long-lived
credentials to application JavaScript. The API must support access-token
expiry, refresh, logout, and revocation.

## Decision

Use short-lived JWT access tokens and longer-lived refresh tokens in secure,
HTTP-only cookies. Store refresh-token hashes server-side, rotate refresh
tokens, and revoke them on logout.

Protect cookie-authenticated mutations with a separate CSRF token header.

## Consequences

- JavaScript cannot read the access or refresh cookies.
- Browser requests must use `credentials: "include"`.
- CSRF protection is required because cookies are sent automatically.
- Refresh-token state can be revoked server-side.
- Native clients may need an adapter if they do not use browser cookies.

## Alternatives rejected

- **Tokens in localStorage:** easier for a JavaScript client, but increases
  exposure if an XSS vulnerability is introduced.
- **Long-lived access tokens:** simpler, but increases the impact of token
  theft and weakens logout semantics.

