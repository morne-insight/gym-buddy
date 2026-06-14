## 1. Dependencies & connection config

- [ ] 1.1 Add a Postgres client dependency (`postgres`, with `pg` as fallback) and remove nothing yet; keep `better-sqlite3` until cutover.
- [ ] 1.2 Add Supabase connection env vars (connection string / project URL + key) to `.env`/example and document them in `server/AGENTS.md`.
- [ ] 1.3 Create a shared pool module (`db/pool.ts` or within `db/index.ts`) that builds the pool once from env, fails fast if config is missing, and exposes a close/shutdown hook.

## 2. Schema & seed (Postgres)

- [ ] 2.1 Port `db/schema.sql` to Postgres DDL: `DATETIME`→`TIMESTAMPTZ`, `REAL`→`DOUBLE PRECISION`, keep flag columns as `INTEGER`, preserve all table/column names, FKs, and the `programs.type` CHECK constraint.
- [ ] 2.2 Port `db/seed.sql` / `db/seed.ts` to run against Postgres (wrap in a transaction).
- [ ] 2.3 Update `runMigrations` to apply the Postgres schema; provide a script to provision + seed a fresh Supabase database.

## 3. Async data-access layer (`db/index.ts`)

- [ ] 3.1 Change `createDatabase`/`createInMemoryDatabase` factories to return/accept a Postgres pool handle; replace `Database.Database` types throughout.
- [ ] 3.2 Convert all read functions (users, personas, programs, workouts, schedule, workout_exercises, sessions, exercise_logs, set_logs, scheduled_messages, rotation_state) to `async` returning Promises with identical result shapes.
- [ ] 3.3 Convert insert-and-return functions (`createSession`, `logExercise`, `createExerciseLog`, `insertSetLog`, `scheduleMessage`) to use `INSERT ... RETURNING *`.
- [ ] 3.4 Wrap `completeSession` (session update + rotation advancement) in an explicit Postgres transaction.
- [ ] 3.5 Re-express `getCompletedWorkoutsThisWeek` using Postgres `date_trunc('week', ...)` to match the prior Monday-based window.

## 4. Update consumers (add `await` / propagate async)

- [ ] 4.1 Update `agent.ts` (pool creation, `createSession`/`completeSession`/`getActiveSession` call sites).
- [ ] 4.2 Update all `src/tools/*` handlers to await db calls.
- [ ] 4.3 Update all `src/cron/*` jobs (eveningCheckIn, deliverMessages, index) to await db calls.
- [ ] 4.4 Update `src/telegram/*` (bot, chat) to await db calls.
- [ ] 4.5 Update `src/scripts/*` and any standalone scripts.
- [ ] 4.6 Update one-off migration scripts (`migrate-to-programs.ts`, `migrate-set-logs.ts`) or remove them if obsolete post-cutover.
- [ ] 4.7 Run `npm run build`/`tsc` and resolve every compiler error surfaced by the sync→async change.

## 5. Test infrastructure

- [ ] 5.1 Update `db/test-helpers.ts` to connect to an ephemeral Postgres test DB, apply the schema, and truncate tables between tests.
- [ ] 5.2 Update Jest config/setup to provision the Postgres test database (Supabase local stack or service container) and tear down.
- [ ] 5.3 Convert all `*.test.ts` db setup and assertions to async/await.

## 6. Verify behavior parity

- [ ] 6.1 Ensure rotation advancement, smart resolution, and evening check-in tests pass unchanged in behavior.
- [ ] 6.2 Add/confirm a test asserting `getCompletedWorkoutsThisWeek` returns the same `workout_id`s for known reference dates.
- [ ] 6.3 Run the full suite (`npm test`) green against Postgres.
- [ ] 6.4 Manually smoke-test a full session end-to-end (start → log sets → complete → rotation advances) against Supabase.

## 7. Cutover & cleanup

- [ ] 7.1 Re-seed the Supabase database from seed data.
- [ ] 7.2 Remove `better-sqlite3` from dependencies and delete `gym-buddy.db*` files from the working tree/repo.
- [ ] 7.3 Update `server/AGENTS.md` and any docs to describe the Supabase backend and required env vars.
