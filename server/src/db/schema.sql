CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  telegram_chat_id TEXT,
  persona_id TEXT NOT NULL DEFAULT 'drill-sergeant',
  goal_description TEXT,
  goal_image_url TEXT,
  training_style TEXT NOT NULL DEFAULT 'weightlifting',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS schedule (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  day_of_week INTEGER NOT NULL,
  workout_name TEXT NOT NULL,
  scheduled_time TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedule(id),
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
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  sentiment TEXT
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id),
  completed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  actual_sets INTEGER,
  actual_reps TEXT,
  actual_weight REAL,
  notes TEXT,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS scheduled_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  deliver_at DATETIME NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_by TEXT
);
