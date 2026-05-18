import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDatabase(dbPath?: string): Database.Database {
  const db = new Database(dbPath ?? join(__dirname, '../../gym-buddy.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function runMigrations(db: Database.Database): void {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
}

export function createInMemoryDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

// --- Users ---

export interface User {
  id: string;
  name: string;
  telegram_chat_id: string | null;
  persona_id: string;
  goal_description: string | null;
  goal_image_url: string | null;
  training_style: string;
  created_at: string;
}

export function getUser(db: Database.Database, userId: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
}

export function insertUser(
  db: Database.Database,
  user: Omit<User, 'created_at'>,
): void {
  db.prepare(
    `INSERT INTO users (id, name, telegram_chat_id, persona_id, goal_description, goal_image_url, training_style)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.name,
    user.telegram_chat_id,
    user.persona_id,
    user.goal_description,
    user.goal_image_url,
    user.training_style,
  );
}

export function updateUserTelegram(
  db: Database.Database,
  userId: string,
  telegramChatId: string,
): void {
  db.prepare('UPDATE users SET telegram_chat_id = ? WHERE id = ?').run(telegramChatId, userId);
}

// --- Personas ---

export interface Persona {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  tts_voice: string;
  example_greeting: string | null;
  example_skip_reaction: string | null;
  example_no_show_reaction: string | null;
}

export function getPersona(db: Database.Database, personaId: string): Persona | undefined {
  return db.prepare('SELECT * FROM personas WHERE id = ?').get(personaId) as Persona | undefined;
}

export function insertPersona(db: Database.Database, persona: Persona): void {
  db.prepare(
    `INSERT INTO personas (id, name, description, system_prompt, tts_voice, example_greeting, example_skip_reaction, example_no_show_reaction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    persona.id,
    persona.name,
    persona.description,
    persona.system_prompt,
    persona.tts_voice,
    persona.example_greeting,
    persona.example_skip_reaction,
    persona.example_no_show_reaction,
  );
}

// --- Schedule ---

export interface Schedule {
  id: string;
  user_id: string;
  day_of_week: number;
  workout_name: string;
  scheduled_time: string | null;
  active: number;
}

export function getScheduleForDay(
  db: Database.Database,
  userId: string,
  dayOfWeek: number,
): Schedule | undefined {
  return db
    .prepare('SELECT * FROM schedule WHERE user_id = ? AND day_of_week = ? AND active = 1')
    .get(userId, dayOfWeek) as Schedule | undefined;
}

export function getUserSchedules(db: Database.Database, userId: string): Schedule[] {
  return db
    .prepare('SELECT * FROM schedule WHERE user_id = ? AND active = 1 ORDER BY day_of_week')
    .all(userId) as Schedule[];
}

export function insertSchedule(db: Database.Database, schedule: Omit<Schedule, 'active'>): void {
  db.prepare(
    `INSERT INTO schedule (id, user_id, day_of_week, workout_name, scheduled_time)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(schedule.id, schedule.user_id, schedule.day_of_week, schedule.workout_name, schedule.scheduled_time);
}

// --- Workout Exercises ---

export interface WorkoutExercise {
  id: string;
  schedule_id: string;
  exercise_name: string;
  exercise_db_id: string | null;
  sets: number;
  reps: string;
  rest_seconds: number;
  sort_order: number;
}

export function getExercisesForSchedule(
  db: Database.Database,
  scheduleId: string,
): WorkoutExercise[] {
  return db
    .prepare('SELECT * FROM workout_exercises WHERE schedule_id = ? ORDER BY sort_order')
    .all(scheduleId) as WorkoutExercise[];
}

export function insertWorkoutExercise(db: Database.Database, exercise: WorkoutExercise): void {
  db.prepare(
    `INSERT INTO workout_exercises (id, schedule_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    exercise.id,
    exercise.schedule_id,
    exercise.exercise_name,
    exercise.exercise_db_id,
    exercise.sets,
    exercise.reps,
    exercise.rest_seconds,
    exercise.sort_order,
  );
}

// --- Sessions ---

export interface Session {
  id: string;
  user_id: string;
  schedule_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
  notes: string | null;
  sentiment: string | null;
}

export function createSession(
  db: Database.Database,
  userId: string,
  scheduleId: string | null,
): Session {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, schedule_id, started_at, status)
     VALUES (?, ?, ?, ?, 'in_progress')`,
  ).run(id, userId, scheduleId, now);
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session;
}

export function completeSession(db: Database.Database, sessionId: string): void {
  db.prepare(
    `UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), sessionId);
}

export function getActiveSession(db: Database.Database, userId: string): Session | undefined {
  return db
    .prepare("SELECT * FROM sessions WHERE user_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1")
    .get(userId) as Session | undefined;
}

export function updateSessionSentiment(
  db: Database.Database,
  sessionId: string,
  sentiment: string,
): void {
  db.prepare('UPDATE sessions SET sentiment = ? WHERE id = ?').run(sentiment, sessionId);
}

export function getSessionsForDate(
  db: Database.Database,
  userId: string,
  date: string,
): Session[] {
  return db
    .prepare("SELECT * FROM sessions WHERE user_id = ? AND DATE(started_at) = DATE(?)")
    .all(userId, date) as Session[];
}

// --- Exercise Logs ---

export interface ExerciseLog {
  id: string;
  session_id: string;
  workout_exercise_id: string;
  completed: number;
  skipped: number;
  actual_sets: number | null;
  actual_reps: string | null;
  actual_weight: number | null;
  notes: string | null;
  completed_at: string | null;
}

export function logExercise(
  db: Database.Database,
  log: Omit<ExerciseLog, 'id' | 'completed_at'> & { completed_at?: string },
): ExerciseLog {
  const id = randomUUID();
  const completedAt = log.completed_at ?? (log.completed ? new Date().toISOString() : null);
  db.prepare(
    `INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped, actual_sets, actual_reps, actual_weight, notes, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    log.session_id,
    log.workout_exercise_id,
    log.completed,
    log.skipped,
    log.actual_sets,
    log.actual_reps,
    log.actual_weight,
    log.notes,
    completedAt,
  );
  return db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(id) as ExerciseLog;
}

export function getExerciseLogsForSession(
  db: Database.Database,
  sessionId: string,
): ExerciseLog[] {
  return db
    .prepare('SELECT * FROM exercise_logs WHERE session_id = ?')
    .all(sessionId) as ExerciseLog[];
}

export function getExerciseHistory(
  db: Database.Database,
  userId: string,
  exerciseName: string,
  limit: number = 10,
): Array<ExerciseLog & { started_at: string }> {
  return db
    .prepare(
      `SELECT el.*, s.started_at
       FROM exercise_logs el
       JOIN sessions s ON el.session_id = s.id
       JOIN workout_exercises we ON el.workout_exercise_id = we.id
       WHERE s.user_id = ? AND we.exercise_name = ?
       ORDER BY s.started_at DESC
       LIMIT ?`,
    )
    .all(userId, exerciseName, limit) as Array<ExerciseLog & { started_at: string }>;
}

// --- Scheduled Messages ---

export interface ScheduledMessage {
  id: string;
  user_id: string;
  deliver_at: string;
  message_type: string;
  content: string | null;
  image_url: string | null;
  delivered: number;
  created_by: string | null;
}

export function scheduleMessage(
  db: Database.Database,
  msg: Omit<ScheduledMessage, 'id' | 'delivered'>,
): ScheduledMessage {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO scheduled_messages (id, user_id, deliver_at, message_type, content, image_url, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, msg.user_id, msg.deliver_at, msg.message_type, msg.content, msg.image_url, msg.created_by);
  return db.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id) as ScheduledMessage;
}

export function getPendingMessages(db: Database.Database, now?: string): ScheduledMessage[] {
  const currentTime = now ?? new Date().toISOString();
  return db
    .prepare(
      'SELECT * FROM scheduled_messages WHERE delivered = 0 AND deliver_at <= ? ORDER BY deliver_at',
    )
    .all(currentTime) as ScheduledMessage[];
}

export function markMessageDelivered(db: Database.Database, messageId: string): void {
  db.prepare('UPDATE scheduled_messages SET delivered = 1 WHERE id = ?').run(messageId);
}
