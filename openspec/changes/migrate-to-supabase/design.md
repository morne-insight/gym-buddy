## Context

The server persists all domain data (users, personas, programs, workouts, schedule, sessions, exercise/set logs, scheduled messages, rotation state) in a local SQLite file via `better-sqlite3`. `better-sqlite3` is **synchronous**: every function in `server/src/db/index.ts` (`getUser`, `createSession`, `logExercise`, etc.) executes the query inline and returns a value, and ~46 files call these functions synchronously.

We are moving the backend to **Supabase (hosted Postgres)** with the server as the sole database client (decided: server-only gateway, no Auth/RLS/Realtime yet). Postgres clients in Node are **asynchronous**, so the central technical reality of this change is the synchronous→asynchronous conversion of the data-access layer and every call site. The schema and domain behavior are otherwise preserved, and the database is stood up fresh and re-seeded (greenfield — no row-level ETL).

Constraints:
- Function names and result shapes in `db/index.ts` should be preserved to minimize churn; only their signatures change (return `Promise<T>`, accept a connection/pool handle).
- Existing tests rely on `createInMemoryDatabase()` returning a ready-to-use synchronous handle. Tests must keep working against a real Postgres instance.
- This is a LiveKit Agents project deployed to LiveKit Cloud; connection config must come from environment variables, not a file path.

## Goals / Non-Goals

**Goals:**
- Persist all domain data in Supabase Postgres with table/column parity to the current schema.
- Convert `db/index.ts` to an async data-access layer with preserved function names and result shapes.
- Keep all domain behavior identical (rotation advancement, smart resolution, week-boundary completion queries, etc.).
- Provide environment-based connection configuration and a re-seed path.
- Keep the full test suite green against an ephemeral Postgres test database.

**Non-Goals:**
- Supabase Auth, Row Level Security, Realtime, Storage.
- Any direct client (web/mobile) → Supabase access. Clients still go through the server.
- Row-by-row migration of the existing local `gym-buddy.db` (greenfield re-seed instead).
- Introducing a full ORM or query builder if a thin client suffices.
- Changing any user-facing behavior or API surface.

## Decisions

### Decision: Use the `postgres` (porsager) client with a connection pool, not an ORM
A thin SQL client keeps the existing hand-written SQL approach intact — we mostly translate `db.prepare(sql).get/all/run(...)` into `await sql\`...\``-style calls — and avoids the cost of modeling the schema in an ORM.
- **Alternatives considered**: `pg` (also fine; `postgres` has ergonomic tagged-template parameterization and built-in pooling). `@supabase/supabase-js` REST client (rejected for server-side relational queries — the joins in `getExerciseHistory`/`getCompletedWorkoutsThisWeek` are awkward over PostgREST; we want raw SQL). Drizzle/Prisma ORM (rejected — large rewrite, unnecessary for a parity migration).
- `@supabase/supabase-js` may still be added later if/when Auth or Realtime is introduced; not now.

### Decision: Preserve `db/index.ts` function names and shapes; change only sync→async
Each exported function keeps its name and return shape but becomes `async` and returns a `Promise`. The handle passed in changes from `Database.Database` to a pool/client type. This localizes the blast radius to "add `await` at call sites" rather than redesigning the data layer.
- Functions that today do a write-then-read (`createSession`, `logExercise`, `insertSetLog`) use Postgres `INSERT ... RETURNING *` to keep the "insert and return the row" contract in a single round-trip.

### Decision: Port the schema to Postgres-native types, keep names identical
- `TEXT PRIMARY KEY` ids stay `TEXT` (ids are app-generated UUID strings via `randomUUID()` — no need to switch to `uuid` columns, preserving exact behavior).
- `DATETIME` → `TIMESTAMPTZ`; `DEFAULT CURRENT_TIMESTAMP` preserved.
- Boolean-ish `INTEGER` flags (`active`, `completed`, `skipped`, `delivered`) — keep as `INTEGER` (NOT `BOOLEAN`) to preserve the existing `0/1` result shapes that TypeScript interfaces and call sites depend on (e.g. `active: number`). Re-typing to boolean would ripple into every consumer; out of scope.
- `REAL` → `DOUBLE PRECISION`; `CHECK` constraints and foreign keys ported verbatim.

### Decision: Replace SQLite-specific date logic with Postgres equivalents
`getCompletedWorkoutsThisWeek` uses `DATE(?, 'weekday 1', '-7 days')`. Re-express the Monday-based week window using Postgres `date_trunc('week', ...)` (ISO week starts Monday) parameterized by the reference date. This is the one query whose SQL is not a mechanical port and needs explicit test coverage.

### Decision: Test against real Postgres, not an in-memory shim
`createInMemoryDatabase()` is replaced by a helper that connects to an ephemeral Postgres (Supabase local stack or a disposable schema/database per test run) and runs migrations + truncation between tests. There is no in-memory Postgres; tests run against the real engine. Jest setup creates/migrates the schema once and truncates tables between tests for isolation.
- **Alternatives considered**: `pglite` (embedded Postgres in WASM) for fast hermetic tests — attractive, but adds a second engine to validate against; defer unless CI Postgres proves too slow.

## Risks / Trade-offs

- **Large async ripple across ~46 files** → Convert `db/index.ts` first with the new signatures, let TypeScript surface every now-broken call site, and fix them mechanically (`await` + make the caller async). The compiler is the checklist.
- **Hidden synchronous assumptions** (e.g. a db call inside a non-async callback, array `.map` returning promises, or transaction ordering) → Audit `agent.ts` and tool handlers for places where `await` changes control flow; add tests around session completion + rotation advancement (multi-statement logic in `completeSession`).
- **Loss of implicit SQLite transaction atomicity** — `completeSession` does several writes; SQLite ran them in one synchronous call. Under async Postgres they can interleave → Wrap multi-write operations (`completeSession`, seed) in explicit Postgres transactions.
- **Week-boundary query semantics drift** between SQLite `weekday 1` and Postgres `date_trunc('week')` → Cover with a dedicated test asserting the same Workouts are returned for known dates.
- **Test suite latency / flakiness** against networked Postgres → Use a local Supabase/Postgres in CI, schema-per-worker isolation, and truncate-between-tests rather than re-migrate.
- **Connection management in cron + agent** (multiple `createDatabase()` calls today create independent handles) → Introduce a single shared pool; ensure it is created once and reused, and closed on shutdown.

## Migration Plan

1. Add Postgres client dependency and connection config (env vars). Stand up a Supabase project + local stack for dev/CI.
2. Port `schema.sql` to Postgres DDL; port `seed.sql`/`seed.ts`.
3. Rewrite `db/index.ts` factory + all functions to async against the pool; use `RETURNING *` and explicit transactions where needed.
4. Update `db/test-helpers.ts` and Jest config to provision/migrate/truncate a Postgres test database.
5. Fix all call sites flagged by the compiler (`await` + async propagation) across tools, cron, telegram, agent, scripts.
6. Re-seed Supabase; run the full test suite; manually smoke-test a session end-to-end.
7. Remove `better-sqlite3`, delete `gym-buddy.db*` files, update `AGENTS.md`/docs.

**Rollback**: The change is isolated to the data layer behind preserved function names. If Supabase proves problematic before cutover, revert the branch (SQLite files and `better-sqlite3` remain until the final cleanup step, so pre-cleanup the old path is still intact).

## Resolved Decisions (during apply)

- **Postgres client**: `postgres` (porsager) — confirmed. Tagged-template parameterization + `sql.begin()` map cleanly onto the hand-written SQL and the `completeSession` transaction.
- **Connection string**: Supabase **session pooler** (port 5432, Supavisor session mode). Session mode supports prepared statements, so no `prepare: false` is required (unlike the transaction pooler on 6543).
- **Test database**: local **Docker Postgres** container (non-destructive; isolated from the Supabase project). Runtime points at the Supabase session-pooler string via `DATABASE_URL`.

## Open Questions

- Should the shared pool live in a new `db/pool.ts` module, or stay in `db/index.ts`? Minor; decide during implementation.
