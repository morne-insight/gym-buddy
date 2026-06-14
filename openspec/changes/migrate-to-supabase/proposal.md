## Why

The server stores all domain data in a local SQLite file (`gym-buddy.db`) accessed through synchronous `better-sqlite3`. A file-on-disk database cannot be shared across multiple server instances, has no managed backups, and ties persistence to a single host — blocking deployment to LiveKit Cloud and any future multi-instance or multi-surface (web + mobile + server) topology. Moving to Supabase (hosted Postgres) gives us a managed, network-accessible database now, and a path to Auth/RLS/Realtime later, without changing app behavior.

## What Changes

- Replace `better-sqlite3` with a Postgres client (`postgres`/`pg` via the Supabase connection string) as the server's data backend.
- **BREAKING** (internal): The entire `db/index.ts` data-access layer becomes **asynchronous**. Every exported query/mutation function returns a `Promise`, and all consumers (agent, tools, cron jobs, Telegram bot, scripts) must `await` them. The exported function names and result shapes are preserved.
- Port `schema.sql` to Postgres-compatible DDL (e.g. `TEXT`/`UUID` PKs, `INTEGER`→`BOOLEAN` for flags where appropriate, `DATETIME`→`TIMESTAMPTZ`, `CURRENT_TIMESTAMP` defaults, `CHECK` constraints, foreign keys) while keeping table/column names identical so domain logic is unchanged.
- Replace the SQLite `DATE(..., 'weekday 1', ...)` week-boundary logic in `getCompletedWorkoutsThisWeek` with Postgres-equivalent date arithmetic.
- Provide connection configuration via environment variables (Supabase project URL / Postgres connection string + key) instead of a local file path.
- Re-point the test suite from the in-memory SQLite database to an ephemeral Postgres test database (Supabase local/CI instance or a disposable schema), preserving existing test behavior.
- Re-seed the Supabase database from the existing seed data (greenfield — no row-by-row migration of the local dev DB).
- Remove the local `gym-buddy.db*` files and the `better-sqlite3` dependency once cutover is complete.

Out of scope: Supabase Auth, Row Level Security, Realtime, and any direct client→Supabase access. The LiveKit server remains the **sole** database client; web and mobile continue to reach data through the server. No domain behavior changes.

## Capabilities

### New Capabilities
- `data-persistence`: Defines how the system persists domain data — a Supabase/Postgres backend, an asynchronous data-access layer with preserved function contracts, schema parity with the prior SQLite schema, environment-based connection configuration, and a re-seed path. The server is the sole database client.

### Modified Capabilities
<!-- None. rotation-scheduling and schedule-type-resolution behavior is preserved; the sync→async change is an implementation detail, not a requirement change. -->

## Impact

- **Dependencies**: remove `better-sqlite3`; add a Postgres client (`postgres` or `pg`) and optionally `@supabase/supabase-js`. New env vars for the Supabase connection.
- **Data layer**: `server/src/db/index.ts` (all functions → async), `schema.sql` (→ Postgres DDL), `seed.sql`/`seed.ts`, `db/test-helpers.ts`, `db/index.ts` factory functions (`createDatabase`, `createInMemoryDatabase`, `runMigrations`).
- **Consumers (must add `await`)**: `agent.ts`, all of `src/tools/*`, `src/cron/*`, `src/telegram/*`, `src/scripts/*`, and existing one-off migration scripts (`migrate-to-programs.ts`, `migrate-set-logs.ts`).
- **Tests**: every `*.test.ts` that builds a DB or calls db functions (the in-memory factory and synchronous call sites) — they become async and target a Postgres test DB.
- **Local dev / deploy**: developers and CI need a reachable Postgres (Supabase local stack or a hosted test project); `gym-buddy.db*` artifacts removed from the repo/working tree.
