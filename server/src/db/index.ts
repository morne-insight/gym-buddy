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

export function getAllUsers(db: Database.Database): User[] {
  return db.prepare('SELECT * FROM users').all() as User[];
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

// --- Programs ---

export interface Program {
  id: string;
  user_id: string;
  name: string;
  type: 'static' | 'rotation';
  active: number;
  created_at: string;
}

export function insertProgram(db: Database.Database, program: Omit<Program, 'active' | 'created_at'>): void {
  db.prepare(
    `INSERT INTO programs (id, user_id, name, type) VALUES (?, ?, ?, ?)`,
  ).run(program.id, program.user_id, program.name, program.type);
}

export function getActiveProgram(db: Database.Database, userId: string): Program | undefined {
  return db
    .prepare('SELECT * FROM programs WHERE user_id = ? AND active = 1')
    .get(userId) as Program | undefined;
}

export function deactivateUserPrograms(db: Database.Database, userId: string): void {
  db.prepare('UPDATE programs SET active = 0 WHERE user_id = ?').run(userId);
}

// --- Workouts ---

export interface Workout {
  id: string;
  program_id: string;
  name: string;
}

export function insertWorkout(db: Database.Database, workout: Workout): void {
  db.prepare(
    `INSERT INTO workouts (id, program_id, name) VALUES (?, ?, ?)`,
  ).run(workout.id, workout.program_id, workout.name);
}

export function getWorkoutById(db: Database.Database, workoutId: string): Workout | undefined {
  return db.prepare('SELECT * FROM workouts WHERE id = ?').get(workoutId) as Workout | undefined;
}

export function getWorkoutsByProgram(db: Database.Database, programId: string): Workout[] {
  return db.prepare('SELECT * FROM workouts WHERE program_id = ?').all(programId) as Workout[];
}

// --- Schedule ---

export interface Schedule {
  id: string;
  user_id: string;
  program_id: string;
  workout_id: string;
  day_of_week: number | null;
  scheduled_time: string | null;
  sort_order: number;
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

export function insertSchedule(
  db: Database.Database,
  schedule: Omit<Schedule, 'active'>,
): void {
  db.prepare(
    `INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    schedule.id,
    schedule.user_id,
    schedule.program_id,
    schedule.workout_id,
    schedule.day_of_week,
    schedule.scheduled_time,
    schedule.sort_order,
  );
}

export function getSchedulesByProgram(db: Database.Database, programId: string): Schedule[] {
  return db
    .prepare('SELECT * FROM schedule WHERE program_id = ? AND active = 1 ORDER BY sort_order')
    .all(programId) as Schedule[];
}

export function getScheduleAtIndex(db: Database.Database, programId: string, sortOrder: number): Schedule | undefined {
  return db
    .prepare('SELECT * FROM schedule WHERE program_id = ? AND sort_order = ? AND active = 1')
    .get(programId, sortOrder) as Schedule | undefined;
}

// --- Workout Exercises ---

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_name: string;
  exercise_db_id: string | null;
  sets: number;
  reps: string;
  rest_seconds: number;
  sort_order: number;
}

export function getExercisesForWorkout(
  db: Database.Database,
  workoutId: string,
): WorkoutExercise[] {
  return db
    .prepare('SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY sort_order')
    .all(workoutId) as WorkoutExercise[];
}

export function insertWorkoutExercise(db: Database.Database, exercise: WorkoutExercise): void {
  db.prepare(
    `INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    exercise.id,
    exercise.workout_id,
    exercise.exercise_name,
    exercise.exercise_db_id,
    exercise.sets,
    exercise.reps,
    exercise.rest_seconds,
    exercise.sort_order,
  );
}

// --- Rotation State ---

export interface RotationState {
  id: string;
  user_id: string;
  program_id: string;
  current_index: number;
  last_completed_at: string | null;
}

export function insertRotationState(db: Database.Database, state: Omit<RotationState, 'last_completed_at'>): void {
  db.prepare(
    `INSERT INTO rotation_state (id, user_id, program_id, current_index) VALUES (?, ?, ?, ?)`,
  ).run(state.id, state.user_id, state.program_id, state.current_index);
}

export function getRotationState(db: Database.Database, userId: string, programId: string): RotationState | undefined {
  return db
    .prepare('SELECT * FROM rotation_state WHERE user_id = ? AND program_id = ?')
    .get(userId, programId) as RotationState | undefined;
}

export function advanceRotation(db: Database.Database, userId: string, programId: string, rotationLength: number): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE rotation_state SET current_index = (current_index + 1) % ?, last_completed_at = ? WHERE user_id = ? AND program_id = ?`,
  ).run(rotationLength, now, userId, programId);
}

// --- Smart Resolution helpers ---

export function peekNextRotationWorkout(db: Database.Database, userId: string, programId: string): Workout | undefined {
  const state = getRotationState(db, userId, programId);
  if (!state) return undefined;

  const schedules = getSchedulesByProgram(db, programId);
  if (schedules.length === 0) return undefined;

  const nextIndex = (state.current_index + 1) % schedules.length;
  const nextSchedule = schedules.find(s => s.sort_order === nextIndex);
  if (!nextSchedule) return undefined;

  return getWorkoutById(db, nextSchedule.workout_id);
}

export function getCompletedWorkoutsThisWeek(
  db: Database.Database,
  userId: string,
  referenceDate?: string,
): string[] {
  const ref = referenceDate ?? new Date().toISOString().split('T')[0];
  return (db
    .prepare(
      `SELECT DISTINCT s.workout_id FROM schedule s
       JOIN sessions ses ON ses.schedule_id = s.id
       WHERE ses.user_id = ? AND ses.status = 'completed'
       AND ses.started_at >= DATE(?, 'weekday 1', '-7 days')
       AND ses.started_at < DATE(?, 'weekday 1')`,
    )
    .all(userId, ref, ref) as Array<{ workout_id: string }>).map(r => r.workout_id);
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
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Session | undefined;
  if (!session || session.status !== 'in_progress') return;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE sessions SET status = 'completed', completed_at = ? WHERE id = ?`,
  ).run(now, sessionId);

  if (session.schedule_id) {
    const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(session.schedule_id) as Schedule | undefined;
    if (schedule) {
      const program = db.prepare('SELECT * FROM programs WHERE id = ?').get(schedule.program_id) as Program | undefined;
      if (program?.type === 'rotation') {
        const scheduleCount = (db.prepare(
          'SELECT COUNT(*) as cnt FROM schedule WHERE program_id = ? AND active = 1',
        ).get(program.id) as { cnt: number }).cnt;
        advanceRotation(db, session.user_id, program.id, scheduleCount);
      }
    }
  }
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
  /** @deprecated Use set_logs table instead */
  actual_sets: number | null;
  /** @deprecated Use set_logs table instead */
  actual_reps: string | null;
  /** @deprecated Use set_logs table instead */
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

export function createExerciseLog(
  db: Database.Database,
  sessionId: string,
  workoutExerciseId: string,
): ExerciseLog {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped)
     VALUES (?, ?, ?, 0, 0)`,
  ).run(id, sessionId, workoutExerciseId);
  return db.prepare('SELECT * FROM exercise_logs WHERE id = ?').get(id) as ExerciseLog;
}

export function markExerciseLogCompleted(
  db: Database.Database,
  exerciseLogId: string,
): void {
  db.prepare(
    'UPDATE exercise_logs SET completed = 1, completed_at = ? WHERE id = ?',
  ).run(new Date().toISOString(), exerciseLogId);
}

export function markExerciseLogSkipped(
  db: Database.Database,
  exerciseLogId: string,
): void {
  db.prepare(
    'UPDATE exercise_logs SET skipped = 1, completed_at = ? WHERE id = ?',
  ).run(new Date().toISOString(), exerciseLogId);
}

export function getExerciseLogForWorkoutExercise(
  db: Database.Database,
  sessionId: string,
  workoutExerciseId: string,
): ExerciseLog | undefined {
  return db
    .prepare('SELECT * FROM exercise_logs WHERE session_id = ? AND workout_exercise_id = ?')
    .get(sessionId, workoutExerciseId) as ExerciseLog | undefined;
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
       ORDER BY s.started_at DESC, el.rowid DESC
       LIMIT ?`,
    )
    .all(userId, exerciseName, limit) as Array<ExerciseLog & { started_at: string }>;
}

// --- Set Logs ---

export interface SetLog {
  id: string;
  exercise_log_id: string;
  set_number: number;
  reps: number;
  weight: number | null;
  completed_at: string | null;
}

export function insertSetLog(
  db: Database.Database,
  log: Omit<SetLog, 'id' | 'completed_at'>,
): SetLog {
  const id = randomUUID();
  const completedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, log.exercise_log_id, log.set_number, log.reps, log.weight, completedAt);
  return db.prepare('SELECT * FROM set_logs WHERE id = ?').get(id) as SetLog;
}

export function getSetLogsForExercise(
  db: Database.Database,
  exerciseLogId: string,
): SetLog[] {
  return db
    .prepare('SELECT * FROM set_logs WHERE exercise_log_id = ? ORDER BY set_number')
    .all(exerciseLogId) as SetLog[];
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
