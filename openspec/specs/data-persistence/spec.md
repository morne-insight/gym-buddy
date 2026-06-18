# data-persistence Specification

## Purpose
Defines how the system persists all domain data in a Supabase-hosted Postgres database, with the LiveKit server as the sole database client. Covers schema parity with the prior SQLite schema, the asynchronous data-access layer and its preserved contracts, preservation of domain behavior across the migration, environment-based connection configuration, and schema provisioning and re-seed.

## Requirements

### Requirement: Supabase Postgres is the system of record
The system SHALL persist all domain data (users, personas, programs, workouts, schedule, workout_exercises, sessions, exercise_logs, set_logs, scheduled_messages, rotation_state) in a Supabase-hosted Postgres database. The LiveKit server SHALL be the sole database client; web and mobile clients SHALL NOT connect to the database directly. The local SQLite file (`gym-buddy.db`) and the `better-sqlite3` dependency SHALL be removed after cutover.

#### Scenario: Domain data is read from Postgres
- **WHEN** the server resolves a user's current workout
- **THEN** all reads SHALL be served from the Supabase Postgres database, not a local SQLite file

#### Scenario: No local database file remains after cutover
- **WHEN** the migration is complete
- **THEN** the repository and working tree SHALL contain no `gym-buddy.db*` files and the project SHALL NOT depend on `better-sqlite3`

### Requirement: Schema parity with the prior SQLite schema
The Postgres schema SHALL preserve the table names and column names of the prior SQLite schema. Types SHALL be mapped to Postgres equivalents (`DATETIME` → `TIMESTAMPTZ`, `REAL` → `DOUBLE PRECISION`) while integer boolean-style flags (`active`, `completed`, `skipped`, `delivered`) SHALL remain `INTEGER` to preserve existing `0/1` result shapes. Foreign keys and `CHECK` constraints SHALL be preserved.

#### Scenario: Tables and columns match prior names
- **WHEN** the Postgres schema is applied
- **THEN** every table and column referenced by `db/index.ts` (e.g. `programs.type`, `schedule.day_of_week`, `rotation_state.current_index`) SHALL exist with the same name

#### Scenario: Flag columns keep integer 0/1 shape
- **WHEN** a row with a flag column (e.g. `sessions` is read, or `programs.active`) is returned to application code
- **THEN** the flag SHALL be a number (`0` or `1`), matching the existing TypeScript interfaces

#### Scenario: Type check constraint is preserved
- **WHEN** a program is inserted with a `type` other than `static` or `rotation`
- **THEN** the database SHALL reject the insert via the `CHECK` constraint

### Requirement: Asynchronous data-access layer with preserved contracts
The data-access functions exported from `server/src/db/index.ts` SHALL retain their existing names and result shapes, but SHALL become asynchronous and return Promises. Functions that previously inserted a row and returned it (e.g. `createSession`, `logExercise`, `insertSetLog`) SHALL continue to return the inserted row, using `INSERT ... RETURNING` to do so.

#### Scenario: Query function returns a Promise of the same shape
- **WHEN** `getActiveProgram(db, userId)` is awaited
- **THEN** it SHALL resolve to a `Program` object (or `undefined`) with the same fields as before the migration

#### Scenario: Insert-and-return contract preserved
- **WHEN** `createSession(db, userId, scheduleId)` is awaited
- **THEN** it SHALL resolve to the newly created `Session` row with `status = 'in_progress'` and a generated `id`

#### Scenario: All call sites await data-access functions
- **WHEN** any consumer (agent, tools, cron, telegram, scripts) calls a `db/index.ts` function
- **THEN** it SHALL await the returned Promise and propagate async correctly

### Requirement: Domain behavior is preserved across the migration
Migrating the backend SHALL NOT change any domain behavior. Rotation advancement on session completion, smart workout resolution, and the Monday-based "completed this week" query SHALL produce the same results as before, despite the SQLite→Postgres date-function differences.

#### Scenario: Rotation still advances on session completion
- **WHEN** a session for a rotation program at index 1 of a 3-workout rotation is completed
- **THEN** `rotation_state.current_index` SHALL become 2, as it did under SQLite

#### Scenario: Multi-write completion is atomic
- **WHEN** `completeSession` performs its session update and rotation advancement
- **THEN** the writes SHALL execute within a single Postgres transaction so they cannot partially apply

#### Scenario: Week-boundary completion query matches prior results
- **WHEN** `getCompletedWorkoutsThisWeek` is evaluated for a known reference date using the Postgres `date_trunc('week', ...)` window
- **THEN** it SHALL return the same set of `workout_id`s that the prior SQLite `weekday 1` query returned for that date

### Requirement: Environment-based connection configuration
The database connection SHALL be configured via environment variables (the Supabase Postgres connection string / project credentials) rather than a local file path. The server SHALL use a single shared connection pool created once and reused across the agent, cron jobs, and tools, and closed on shutdown.

#### Scenario: Connection is configured from environment
- **WHEN** the server starts
- **THEN** it SHALL read the Supabase connection details from environment variables and SHALL NOT reference a local database file path

#### Scenario: Missing configuration fails fast
- **WHEN** the required connection environment variables are absent
- **THEN** the server SHALL fail to start with a clear error rather than silently falling back to a local file

### Requirement: Schema provisioning and re-seed
The system SHALL provide a way to create the schema in a fresh Supabase database and re-seed it from the existing seed data (greenfield — no row-by-row migration of the prior SQLite data). The test suite SHALL run against an ephemeral Postgres database, provisioning the schema and isolating tests (e.g. truncation between tests).

#### Scenario: Fresh database is provisioned and seeded
- **WHEN** the schema is applied to an empty Supabase database and the seed is run
- **THEN** the database SHALL contain the seeded personas, users, programs, workouts, schedule, and exercises

#### Scenario: Tests run against ephemeral Postgres
- **WHEN** the test suite runs
- **THEN** it SHALL connect to a Postgres test database, apply the schema, and isolate state between tests rather than using an in-memory SQLite database
</content>
</invoke>
