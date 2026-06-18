# ADR-0002: Web client goes through the server API; Supabase Auth is identity-only

**Status:** Accepted
**Date:** 2026-06-18

## Context

We are adding a web client (`apps/web`) for sign-up and routine configuration. The
obvious path with Supabase is to let the browser talk to Supabase directly — `supabase-js`
for both auth and data, with Row Level Security (RLS) enforcing per-user access. The
prior migration ([ADR background](../handoff-supabase-migration.md), `migrate-to-supabase`)
deliberately established that **the Node server is the sole database client** and explicitly
left Auth/RLS/Realtime out of scope.

## Decision

The web client is a thin SPA that reaches all domain data through an **authenticated REST
API on the existing Node server**, which remains the **sole database client**. We use
**Supabase Auth as an identity provider only**: it issues the session, the server **verifies
the access token via JWKS** and maps the `sub` claim to `users.id`. We do **not** enable
RLS — authorization stays in server query logic, exactly as today. The domain `users` row is
provisioned by the server on the first authenticated call (no `auth.users` trigger).

## Considered Options

- **Supabase-direct + RLS** (rejected): browser uses `supabase-js` for data, secured by RLS.
  Fastest to build, but creates a *second* data authority whose policies inevitably drift
  from server logic, reverses the migration's "no client→DB, no RLS" decision, and forces
  every domain rule into row-filter policies instead of code.

## Consequences

- **Preserves the single-DB-client invariant** — one place writes Postgres, one set of query
  logic and validation; web and mobile are symmetric thin clients.
- **Reuses the existing async `db/index.ts` data layer** instead of reimplementing writes as
  `supabase-js` + RLS policies.
- **No RLS to author or get subtly wrong**; only Supabase Auth (identity) is newly introduced.
- **Cost:** the server gains a real HTTP API (routing, CORS, JWKS verification middleware) and
  becomes web-facing, with the attendant deployment/scaling considerations. Request validation
  moves to shared Zod contracts (`packages/contracts`).
