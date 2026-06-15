## 1. Dependencies & connection config

- [x] 1.1 Add a Postgres client dependency (`postgres`, with `pg` as fallback) and remove nothing yet; keep `better-sqlite3` until cutover.
- [x] 1.2 Add Supabase connection env vars (connection string / project URL + key) to `.env`/example and document them in `server/AGENTS.md`. _(`.env` + `.env.example` done with session-pooler `DATABASE_URL`; AGENTS.md note folded into task 7.3.)_
- [x] 1.3 Create a shared pool module (`db/pool.ts` or within `db/index.ts`) that builds the pool once from env, fails fast if config is missing, and exposes a close/shutdown hook.

## 2. Schema & seed (Postgres)

- [x] 2.1 Port `db/schema.sql` to Postgres DDL: `DATETIME`→`TIMESTAMPTZ`, `REAL`→`DOUBLE PRECISION`, keep flag columns as `INTEGER`, preserve all table/column names, FKs, and the `programs.type` CHECK constraint. _(Added internal `exercise_logs.seq` IDENTITY column to replace the SQLite `rowid` tiebreaker in `getExerciseHistory`.)_
- [x] 2.2 Port `db/seed.sql` / `db/seed.ts` to run against Postgres (wrap in a transaction). _(`INSERT OR REPLACE` → `INSERT ... ON CONFLICT (id) DO NOTHING`; `seed.ts` now async via the pool.)_
- [x] 2.3 Update `runMigrations` to apply the Postgres schema; provide a script to provision + seed a fresh Supabase database. _(`runMigrations` uses `db.unsafe(schema)`; new `npm run provision` applies schema, truncates, and seeds.)_

## 3. Async data-access layer (`db/index.ts`)

- [x] 3.1 Change `createDatabase`/`createInMemoryDatabase` factories to return/accept a Postgres pool handle; replace `Database.Database` types throughout. _(`createDatabase()` returns the shared pool; `createInMemoryDatabase` removed — tests use an ephemeral Postgres via `test-helpers`.)_
- [x] 3.2 Convert all read functions (users, personas, programs, workouts, schedule, workout_exercises, sessions, exercise_logs, set_logs, scheduled_messages, rotation_state) to `async` returning Promises with identical result shapes. _(Added `getWorkoutExerciseById` and `getUserByTelegramChatId` helpers to replace inline `db.prepare(...)` call sites.)_
- [x] 3.3 Convert insert-and-return functions (`createSession`, `logExercise`, `createExerciseLog`, `insertSetLog`, `scheduleMessage`) to use `INSERT ... RETURNING *`.
- [x] 3.4 Wrap `completeSession` (session update + rotation advancement) in an explicit Postgres transaction (`sql.begin(...)`).
- [x] 3.5 Re-express `getCompletedWorkoutsThisWeek` using Postgres date arithmetic to match the prior Monday-based window exactly (including the Monday-reference edge).

## 4. Update consumers (add `await` / propagate async)

- [x] 4.1 Update `agent.ts` (single shared pool, `createSession`/`completeSession`/`getActiveSession` call sites, `closePool` on shutdown).
- [x] 4.2 Update all `src/tools/*` handlers to await db calls.
- [x] 4.3 Update all `src/cron/*` jobs (eveningCheckIn, deliverMessages, index) to await db calls.
- [x] 4.4 Update `src/telegram/*` (bot, chat) to await db calls.
- [x] 4.5 Update `src/scripts/*` and any standalone scripts.
- [x] 4.6 Update one-off migration scripts (`migrate-to-programs.ts`, `migrate-set-logs.ts`) or remove them if obsolete post-cutover. _(Removed — both were SQLite-only backfills; their tables now live in `schema.sql` and we re-seed greenfield. Also removed `migrate-set-logs.test.ts`.)_
- [x] 4.7 Run `npm run build`/`tsc` and resolve every compiler error surfaced by the sync→async change. _(`tsc --noEmit` is clean.)_

## 5. Test infrastructure

- [x] 5.1 Update `db/test-helpers.ts` to connect to an ephemeral Postgres test DB, apply the schema, and truncate tables between tests.
- [x] 5.2 Update Jest config/setup to provision the Postgres test database (Docker container) and tear down. _(`jest.global-setup.cjs` / `jest.global-teardown.cjs` manage a `postgres:17-alpine` container on `localhost:5433`; `maxWorkers: 1`.)_
- [x] 5.3 Convert all `*.test.ts` db setup and assertions to async/await.

## 6. Verify behavior parity

- [x] 6.1 Ensure rotation advancement, smart resolution, and evening check-in tests pass unchanged in behavior.
- [x] 6.2 Add/confirm a test asserting `getCompletedWorkoutsThisWeek` returns the same `workout_id`s for known reference dates. _(`db/week-boundary.test.ts`.)_
- [x] 6.3 Run the full suite (`npm test`) green against Postgres. _(22 suites / 137 tests passing.)_
- [x] 6.4 Manually smoke-test a full session end-to-end (start → log sets → complete → rotation advances) against Supabase. _(`npm run smoke` — passes and self-cleans.)_

## 7. Cutover & cleanup

- [x] 7.1 Re-seed the Supabase database from seed data. _(`npm run provision` against `DATABASE_URL`.)_
- [x] 7.2 Remove `better-sqlite3` from dependencies and delete `gym-buddy.db*` files from the working tree/repo.
- [x] 7.3 Update `server/AGENTS.md` and any docs to describe the Supabase backend and required env vars.
