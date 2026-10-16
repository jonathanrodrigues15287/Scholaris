# ADR 001: Use PostgreSQL as the primary database

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

Scholaris stores related academic records with ownership, uniqueness,
transactions, and concurrent updates. The application also needs a durable
database suitable for development growth beyond a single local file.

## Decision

Use PostgreSQL as the primary production database. SQLAlchemy provides the
application data-access layer and Alembic manages schema migrations.

## Consequences

- Strong relational constraints and transaction semantics are available.
- Foreign keys, indexes, and unique constraints protect ownership and
  consistency.
- Deployments need PostgreSQL configuration and migration execution.
- SQLite remains useful for focused local tests, but is not the production
  target.

## Alternatives rejected

- **SQLite as production storage:** simpler to start, but less suitable for
  concurrent multi-user API workloads.
- **Document storage:** would make relational ownership and academic
  relationships harder to enforce consistently.

