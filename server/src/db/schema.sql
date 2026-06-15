-- Postgres schema (ported from the original SQLite schema).
-- Table and column names are preserved verbatim so the data-access layer and
-- all domain logic are unchanged. Type mapping:
--   DATETIME -> TIMESTAMPTZ
--   REAL     -> DOUBLE PRECISION
-- Boolean-style flag columns (active, completed, skipped, delivered) stay
-- INTEGER 0/1 to preserve the existing result shapes that TypeScript
-- interfaces and call sites depend on.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  telegram_chat_id TEXT,
  persona_id TEXT NOT NULL DEFAULT 'drill-sergeant',
  goal_description TEXT,
  goal_image_url TEXT,
  training_style TEXT NOT NULL DEFAULT 'weightlifting',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tts_voice TEXT NOT NULL,
  example_greeting TEXT,
  example_skip_reaction TEXT,
  example_no_show_reaction TEXT
);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('static', 'rotation')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL REFERENCES programs(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  program_id TEXT NOT NULL REFERENCES programs(id),
  workout_id TEXT NOT NULL REFERENCES workouts(id),
  day_of_week INTEGER,
  scheduled_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id),
  exercise_name TEXT NOT NULL,
  exercise_db_id TEXT,
  sets INTEGER NOT NULL,
  reps TEXT NOT NULL,
  rest_seconds INTEGER DEFAULT 90,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  schedule_id TEXT REFERENCES schedule(id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  sentiment TEXT
);

-- `seq` is an internal insertion-order column that replaces the SQLite `rowid`
-- used as a tiebreaker in getExerciseHistory. It is not part of the
-- ExerciseLog contract; queries that return ExerciseLog rows select columns
-- explicitly where shape matters.
CREATE TABLE IF NOT EXISTS exercise_logs (
  id TEXT PRIMARY KEY,
  seq BIGINT GENERATED ALWAYS AS IDENTITY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id),
  completed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  actual_sets INTEGER,
  actual_reps TEXT,
  actual_weight DOUBLE PRECISION,
  notes TEXT,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS set_logs (
  id TEXT PRIMARY KEY,
  exercise_log_id TEXT NOT NULL REFERENCES exercise_logs(id),
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight DOUBLE PRECISION,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  deliver_at TIMESTAMPTZ NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS rotation_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  program_id TEXT NOT NULL REFERENCES programs(id),
  current_index INTEGER NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ
);
