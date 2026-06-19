import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { getPool, closePool, type DB } from './pool.js';

export { closePool, type DB } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Returns the shared Postgres connection pool. The pool is created once from
 * `DATABASE_URL` and reused across the agent, cron jobs, and tools.
 */
export function createDatabase(): DB {
  return getPool();
}

/** Applies the Postgres schema (idempotent — all DDL uses IF NOT EXISTS). */
export async function runMigrations(db: DB): Promise<void> {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await db.unsafe(schema);
}

/**
 * All domain tables in dependency order (children before parents) — used by the
 * re-seed script and the test harness to clear state. `CASCADE` handles FK
 * ordering regardless, but the explicit list keeps the set authoritative.
 */
export const ALL_TABLES = [
  'set_logs',
  'exercise_logs',
  'sessions',
  'scheduled_messages',
  'rotation_state',
  'schedule',
  'workout_exercises',
  'workouts',
  'programs',
  'users',
  'personas',
  'template_schedule',
  'template_exercises',
  'template_workouts',
  'program_templates',
] as const;

/** Truncates every domain table and resets identity sequences. */
export async function truncateAll(db: DB): Promise<void> {
  await db.unsafe(`TRUNCATE TABLE ${ALL_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
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

export async function getUser(db: DB, userId: string): Promise<User | undefined> {
  const [row] = await db`SELECT * FROM users WHERE id = ${userId}`;
  return row as User | undefined;
}

export async function getAllUsers(db: DB): Promise<User[]> {
  return (await db`SELECT * FROM users`) as unknown as User[];
}

export async function getUserByTelegramChatId(db: DB, telegramChatId: string): Promise<User | undefined> {
  const [row] = await db`SELECT * FROM users WHERE telegram_chat_id = ${telegramChatId}`;
  return row as User | undefined;
}

export async function insertUser(db: DB, user: Omit<User, 'created_at'>): Promise<void> {
  await db`
    INSERT INTO users (id, name, telegram_chat_id, persona_id, goal_description, goal_image_url, training_style)
    VALUES (${user.id}, ${user.name}, ${user.telegram_chat_id}, ${user.persona_id}, ${user.goal_description}, ${user.goal_image_url}, ${user.training_style})`;
}

export async function updateUserTelegram(db: DB, userId: string, telegramChatId: string): Promise<void> {
  await db`UPDATE users SET telegram_chat_id = ${telegramChatId} WHERE id = ${userId}`;
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

export async function getPersona(db: DB, personaId: string): Promise<Persona | undefined> {
  const [row] = await db`SELECT * FROM personas WHERE id = ${personaId}`;
  return row as Persona | undefined;
}

export async function insertPersona(db: DB, persona: Persona): Promise<void> {
  await db`
    INSERT INTO personas (id, name, description, system_prompt, tts_voice, example_greeting, example_skip_reaction, example_no_show_reaction)
    VALUES (${persona.id}, ${persona.name}, ${persona.description}, ${persona.system_prompt}, ${persona.tts_voice}, ${persona.example_greeting}, ${persona.example_skip_reaction}, ${persona.example_no_show_reaction})`;
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

export async function insertProgram(db: DB, program: Omit<Program, 'active' | 'created_at'>): Promise<void> {
  await db`INSERT INTO programs (id, user_id, name, type) VALUES (${program.id}, ${program.user_id}, ${program.name}, ${program.type})`;
}

export async function getActiveProgram(db: DB, userId: string): Promise<Program | undefined> {
  const [row] = await db`SELECT * FROM programs WHERE user_id = ${userId} AND active = 1`;
  return row as Program | undefined;
}

export async function deactivateUserPrograms(db: DB, userId: string): Promise<void> {
  await db`UPDATE programs SET active = 0 WHERE user_id = ${userId}`;
}

// --- Workouts ---

export interface Workout {
  id: string;
  program_id: string;
  name: string;
}

export async function insertWorkout(db: DB, workout: Workout): Promise<void> {
  await db`INSERT INTO workouts (id, program_id, name) VALUES (${workout.id}, ${workout.program_id}, ${workout.name})`;
}

export async function getWorkoutById(db: DB, workoutId: string): Promise<Workout | undefined> {
  const [row] = await db`SELECT * FROM workouts WHERE id = ${workoutId}`;
  return row as Workout | undefined;
}

export async function getWorkoutsByProgram(db: DB, programId: string): Promise<Workout[]> {
  return (await db`SELECT * FROM workouts WHERE program_id = ${programId}`) as unknown as Workout[];
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

export async function getScheduleForDay(db: DB, userId: string, dayOfWeek: number): Promise<Schedule | undefined> {
  const [row] = await db`SELECT * FROM schedule WHERE user_id = ${userId} AND day_of_week = ${dayOfWeek} AND active = 1`;
  return row as Schedule | undefined;
}

export async function getUserSchedules(db: DB, userId: string): Promise<Schedule[]> {
  return (await db`SELECT * FROM schedule WHERE user_id = ${userId} AND active = 1 ORDER BY day_of_week`) as unknown as Schedule[];
}

export async function insertSchedule(db: DB, schedule: Omit<Schedule, 'active'>): Promise<void> {
  await db`
    INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
    VALUES (${schedule.id}, ${schedule.user_id}, ${schedule.program_id}, ${schedule.workout_id}, ${schedule.day_of_week}, ${schedule.scheduled_time}, ${schedule.sort_order})`;
}

export async function getSchedulesByProgram(db: DB, programId: string): Promise<Schedule[]> {
  return (await db`SELECT * FROM schedule WHERE program_id = ${programId} AND active = 1 ORDER BY sort_order`) as unknown as Schedule[];
}

export async function getScheduleAtIndex(db: DB, programId: string, sortOrder: number): Promise<Schedule | undefined> {
  const [row] = await db`SELECT * FROM schedule WHERE program_id = ${programId} AND sort_order = ${sortOrder} AND active = 1`;
  return row as Schedule | undefined;
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

export async function getWorkoutExerciseById(db: DB, exerciseId: string): Promise<WorkoutExercise | undefined> {
  const [row] = await db`SELECT * FROM workout_exercises WHERE id = ${exerciseId}`;
  return row as WorkoutExercise | undefined;
}

export async function getExercisesForWorkout(db: DB, workoutId: string): Promise<WorkoutExercise[]> {
  return (await db`SELECT * FROM workout_exercises WHERE workout_id = ${workoutId} ORDER BY sort_order`) as unknown as WorkoutExercise[];
}

export async function insertWorkoutExercise(db: DB, exercise: WorkoutExercise): Promise<void> {
  await db`
    INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
    VALUES (${exercise.id}, ${exercise.workout_id}, ${exercise.exercise_name}, ${exercise.exercise_db_id}, ${exercise.sets}, ${exercise.reps}, ${exercise.rest_seconds}, ${exercise.sort_order})`;
}

// --- Rotation State ---

export interface RotationState {
  id: string;
  user_id: string;
  program_id: string;
  current_index: number;
  last_completed_at: string | null;
}

export async function insertRotationState(db: DB, state: Omit<RotationState, 'last_completed_at'>): Promise<void> {
  await db`INSERT INTO rotation_state (id, user_id, program_id, current_index) VALUES (${state.id}, ${state.user_id}, ${state.program_id}, ${state.current_index})`;
}

export async function getRotationState(db: DB, userId: string, programId: string): Promise<RotationState | undefined> {
  const [row] = await db`SELECT * FROM rotation_state WHERE user_id = ${userId} AND program_id = ${programId}`;
  return row as RotationState | undefined;
}

export async function advanceRotation(db: DB, userId: string, programId: string, rotationLength: number): Promise<void> {
  const now = new Date().toISOString();
  await db`
    UPDATE rotation_state
    SET current_index = (current_index + 1) % ${rotationLength}, last_completed_at = ${now}
    WHERE user_id = ${userId} AND program_id = ${programId}`;
}

// --- Smart Resolution helpers ---

export async function peekNextRotationWorkout(db: DB, userId: string, programId: string): Promise<Workout | undefined> {
  const state = await getRotationState(db, userId, programId);
  if (!state) return undefined;

  const schedules = await getSchedulesByProgram(db, programId);
  if (schedules.length === 0) return undefined;

  const nextIndex = (state.current_index + 1) % schedules.length;
  const nextSchedule = schedules.find((s) => s.sort_order === nextIndex);
  if (!nextSchedule) return undefined;

  return getWorkoutById(db, nextSchedule.workout_id);
}

export async function getCompletedWorkoutsThisWeek(
  db: DB,
  userId: string,
  referenceDate?: string,
): Promise<string[]> {
  const ref = referenceDate ?? new Date().toISOString().split('T')[0];
  // Re-express the prior SQLite `DATE(?, 'weekday 1', '-7 days')` window in
  // Postgres. SQLite's `weekday 1` yields the smallest Monday >= ref; the
  // window is [that Monday - 7 days, that Monday). For a Monday reference this
  // resolves to the *previous* ISO week, exactly as SQLite did — parity is
  // preserved including that edge.
  const rows = await db`
    WITH bounds AS (
      SELECT (
        CASE WHEN extract(isodow FROM ${ref}::date) = 1
             THEN ${ref}::date
             ELSE date_trunc('week', ${ref}::date)::date + 7
        END
      ) AS week_end
    )
    SELECT DISTINCT s.workout_id
    FROM schedule s
    JOIN sessions ses ON ses.schedule_id = s.id
    CROSS JOIN bounds b
    WHERE ses.user_id = ${userId} AND ses.status = 'completed'
      AND ses.started_at >= (b.week_end - 7)::timestamptz
      AND ses.started_at <  b.week_end::timestamptz`;
  return (rows as unknown as Array<{ workout_id: string }>).map((r) => r.workout_id);
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

export async function createSession(db: DB, userId: string, scheduleId: string | null): Promise<Session> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const [row] = await db`
    INSERT INTO sessions (id, user_id, schedule_id, started_at, status)
    VALUES (${id}, ${userId}, ${scheduleId}, ${now}, 'in_progress')
    RETURNING *`;
  return row as Session;
}

export async function completeSession(db: DB, sessionId: string): Promise<void> {
  await db.begin(async (sql) => {
    const [session] = await sql`SELECT * FROM sessions WHERE id = ${sessionId}`;
    if (!session || session.status !== 'in_progress') return;

    const now = new Date().toISOString();
    await sql`UPDATE sessions SET status = 'completed', completed_at = ${now} WHERE id = ${sessionId}`;

    if (session.schedule_id) {
      const [schedule] = await sql`SELECT * FROM schedule WHERE id = ${session.schedule_id}`;
      if (schedule) {
        const [program] = await sql`SELECT * FROM programs WHERE id = ${schedule.program_id}`;
        if (program?.type === 'rotation') {
          const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM schedule WHERE program_id = ${program.id} AND active = 1`;
          await sql`
            UPDATE rotation_state
            SET current_index = (current_index + 1) % ${cnt}, last_completed_at = ${now}
            WHERE user_id = ${session.user_id} AND program_id = ${program.id}`;
        }
      }
    }
  });
}

export async function getActiveSession(db: DB, userId: string): Promise<Session | undefined> {
  const [row] = await db`SELECT * FROM sessions WHERE user_id = ${userId} AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1`;
  return row as Session | undefined;
}

export async function updateSessionSentiment(db: DB, sessionId: string, sentiment: string): Promise<void> {
  await db`UPDATE sessions SET sentiment = ${sentiment} WHERE id = ${sessionId}`;
}

export async function getSessionsForDate(db: DB, userId: string, date: string): Promise<Session[]> {
  return (await db`SELECT * FROM sessions WHERE user_id = ${userId} AND started_at::date = ${date}::date`) as unknown as Session[];
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

export async function logExercise(
  db: DB,
  log: Omit<ExerciseLog, 'id' | 'completed_at'> & { completed_at?: string },
): Promise<ExerciseLog> {
  const id = randomUUID();
  const completedAt = log.completed_at ?? (log.completed ? new Date().toISOString() : null);
  const [row] = await db`
    INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped, actual_sets, actual_reps, actual_weight, notes, completed_at)
    VALUES (${id}, ${log.session_id}, ${log.workout_exercise_id}, ${log.completed}, ${log.skipped}, ${log.actual_sets}, ${log.actual_reps}, ${log.actual_weight}, ${log.notes}, ${completedAt})
    RETURNING *`;
  return row as ExerciseLog;
}

export async function createExerciseLog(db: DB, sessionId: string, workoutExerciseId: string): Promise<ExerciseLog> {
  const id = randomUUID();
  const [row] = await db`
    INSERT INTO exercise_logs (id, session_id, workout_exercise_id, completed, skipped)
    VALUES (${id}, ${sessionId}, ${workoutExerciseId}, 0, 0)
    RETURNING *`;
  return row as ExerciseLog;
}

export async function markExerciseLogCompleted(db: DB, exerciseLogId: string): Promise<void> {
  await db`UPDATE exercise_logs SET completed = 1, completed_at = ${new Date().toISOString()} WHERE id = ${exerciseLogId}`;
}

export async function markExerciseLogSkipped(db: DB, exerciseLogId: string): Promise<void> {
  await db`UPDATE exercise_logs SET skipped = 1, completed_at = ${new Date().toISOString()} WHERE id = ${exerciseLogId}`;
}

export async function getExerciseLogForWorkoutExercise(
  db: DB,
  sessionId: string,
  workoutExerciseId: string,
): Promise<ExerciseLog | undefined> {
  const [row] = await db`SELECT * FROM exercise_logs WHERE session_id = ${sessionId} AND workout_exercise_id = ${workoutExerciseId}`;
  return row as ExerciseLog | undefined;
}

export async function getExerciseLogsForSession(db: DB, sessionId: string): Promise<ExerciseLog[]> {
  return (await db`SELECT * FROM exercise_logs WHERE session_id = ${sessionId}`) as unknown as ExerciseLog[];
}

export async function getExerciseHistory(
  db: DB,
  userId: string,
  exerciseName: string,
  limit: number = 10,
): Promise<Array<ExerciseLog & { started_at: string }>> {
  // `el.seq` (insertion order) replaces the SQLite `el.rowid` tiebreaker.
  return (await db`
    SELECT el.*, s.started_at
    FROM exercise_logs el
    JOIN sessions s ON el.session_id = s.id
    JOIN workout_exercises we ON el.workout_exercise_id = we.id
    WHERE s.user_id = ${userId} AND we.exercise_name = ${exerciseName}
    ORDER BY s.started_at DESC, el.seq DESC
    LIMIT ${limit}`) as unknown as Array<ExerciseLog & { started_at: string }>;
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

export async function insertSetLog(db: DB, log: Omit<SetLog, 'id' | 'completed_at'>): Promise<SetLog> {
  const id = randomUUID();
  const completedAt = new Date().toISOString();
  const [row] = await db`
    INSERT INTO set_logs (id, exercise_log_id, set_number, reps, weight, completed_at)
    VALUES (${id}, ${log.exercise_log_id}, ${log.set_number}, ${log.reps}, ${log.weight}, ${completedAt})
    RETURNING *`;
  return row as SetLog;
}

export async function getSetLogsForExercise(db: DB, exerciseLogId: string): Promise<SetLog[]> {
  return (await db`SELECT * FROM set_logs WHERE exercise_log_id = ${exerciseLogId} ORDER BY set_number`) as unknown as SetLog[];
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

export async function scheduleMessage(
  db: DB,
  msg: Omit<ScheduledMessage, 'id' | 'delivered'>,
): Promise<ScheduledMessage> {
  const id = randomUUID();
  const [row] = await db`
    INSERT INTO scheduled_messages (id, user_id, deliver_at, message_type, content, image_url, created_by)
    VALUES (${id}, ${msg.user_id}, ${msg.deliver_at}, ${msg.message_type}, ${msg.content}, ${msg.image_url}, ${msg.created_by})
    RETURNING *`;
  return row as ScheduledMessage;
}

export async function getPendingMessages(db: DB, now?: string): Promise<ScheduledMessage[]> {
  const currentTime = now ?? new Date().toISOString();
  return (await db`SELECT * FROM scheduled_messages WHERE delivered = 0 AND deliver_at <= ${currentTime} ORDER BY deliver_at`) as unknown as ScheduledMessage[];
}

export async function markMessageDelivered(db: DB, messageId: string): Promise<void> {
  await db`UPDATE scheduled_messages SET delivered = 1 WHERE id = ${messageId}`;
}

// --- Web API: typed errors ---------------------------------------------------

/** Thrown when a resource is absent or not owned by the caller (→ HTTP 404). */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Thrown when an operation would violate a domain invariant (→ HTTP 400). */
export class DomainValidationError extends Error {
  constructor(message = 'Invalid request') {
    super(message);
    this.name = 'DomainValidationError';
  }
}

// --- Web API: identity provisioning & personas -------------------------------

/**
 * Idempotently provisions the domain `users` row for a verified auth identity
 * (`sub`). On first authenticated request the row is created with placeholder
 * profile defaults; subsequent calls return the existing row unchanged. This is
 * the only place a `users` row is created for web users — never a DB trigger.
 */
export async function provisionUser(db: DB, userId: string): Promise<User> {
  const [row] = await db`
    INSERT INTO users (id, name)
    VALUES (${userId}, '')
    ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
    RETURNING *`;
  return row as User;
}

export async function listPersonas(db: DB): Promise<Persona[]> {
  return (await db`SELECT * FROM personas ORDER BY name`) as unknown as Persona[];
}

export async function personaExists(db: DB, personaId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 AS ok FROM personas WHERE id = ${personaId}`;
  return Boolean(row);
}

// --- Web API: profile --------------------------------------------------------

export interface ProfileUpdate {
  name: string;
  persona_id: string;
  goal_description: string | null;
  training_style: string;
}

/** Writes the onboarding/profile fields to the caller's own `users` row. */
export async function updateUserProfile(db: DB, userId: string, p: ProfileUpdate): Promise<User> {
  const [row] = await db`
    UPDATE users
    SET name = ${p.name},
        persona_id = ${p.persona_id},
        goal_description = ${p.goal_description},
        training_style = ${p.training_style}
    WHERE id = ${userId}
    RETURNING *`;
  if (!row) throw new NotFoundError('User not found');
  return row as User;
}

export async function setGoalImageUrl(db: DB, userId: string, url: string): Promise<User> {
  const [row] = await db`UPDATE users SET goal_image_url = ${url} WHERE id = ${userId} RETURNING *`;
  if (!row) throw new NotFoundError('User not found');
  return row as User;
}

// --- Web API: Template catalog -----------------------------------------------

export interface AssembledTemplateExercise {
  id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  sort_order: number;
}

export interface AssembledTemplateWorkout {
  id: string;
  name: string;
  sort_order: number;
  day_of_week: number | null;
  scheduled_time: string | null;
  exercises: AssembledTemplateExercise[];
}

export interface AssembledTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'static' | 'rotation';
  workouts: AssembledTemplateWorkout[];
}

/** Lists every catalog Template with its Workouts, default schedule, and exercises. */
export async function listTemplates(db: DB): Promise<AssembledTemplate[]> {
  const templates = (await db`
    SELECT * FROM program_templates ORDER BY sort_order, name`) as unknown as Array<{
    id: string;
    name: string;
    description: string | null;
    type: 'static' | 'rotation';
  }>;

  const result: AssembledTemplate[] = [];
  for (const t of templates) {
    const workouts = (await db`
      SELECT * FROM template_workouts WHERE program_template_id = ${t.id} ORDER BY sort_order`) as unknown as Array<{
      id: string;
      name: string;
      sort_order: number;
    }>;
    const schedule = (await db`
      SELECT * FROM template_schedule WHERE program_template_id = ${t.id}`) as unknown as Array<{
      template_workout_id: string;
      day_of_week: number | null;
      scheduled_time: string | null;
      sort_order: number;
    }>;
    const schedByWorkout = new Map(schedule.map((s) => [s.template_workout_id, s]));

    const assembledWorkouts: AssembledTemplateWorkout[] = [];
    for (const w of workouts) {
      const exercises = (await db`
        SELECT id, exercise_name, sets, reps, rest_seconds, sort_order
        FROM template_exercises WHERE template_workout_id = ${w.id} ORDER BY sort_order`) as unknown as AssembledTemplateExercise[];
      const s = schedByWorkout.get(w.id);
      assembledWorkouts.push({
        id: w.id,
        name: w.name,
        sort_order: s?.sort_order ?? w.sort_order,
        day_of_week: s?.day_of_week ?? null,
        scheduled_time: s?.scheduled_time ?? null,
        exercises,
      });
    }
    assembledWorkouts.sort((a, b) => a.sort_order - b.sort_order);
    result.push({ id: t.id, name: t.name, description: t.description, type: t.type, workouts: assembledWorkouts });
  }
  return result;
}

// --- Web API: active Program assembly ----------------------------------------

export interface AssembledProgramExercise {
  id: string;
  workout_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  sort_order: number;
}

export interface AssembledProgramWorkout {
  id: string;
  name: string;
  sort_order: number;
  day_of_week: number | null;
  scheduled_time: string | null;
  exercises: AssembledProgramExercise[];
}

export interface AssembledProgram {
  id: string;
  name: string;
  type: 'static' | 'rotation';
  rotation_current_index: number | null;
  workouts: AssembledProgramWorkout[];
}

/**
 * Assembles the caller's single active Program into the nested shape the editor
 * consumes. Workouts are ordered by their schedule `sort_order`. Returns
 * undefined when the user has no active Program.
 */
export async function getActiveProgramDetail(db: DB, userId: string): Promise<AssembledProgram | undefined> {
  const program = await getActiveProgram(db, userId);
  if (!program) return undefined;

  const workouts = await getWorkoutsByProgram(db, program.id);
  const schedules = await getSchedulesByProgram(db, program.id);
  const schedByWorkout = new Map(schedules.map((s) => [s.workout_id, s]));

  const assembled: AssembledProgramWorkout[] = [];
  for (const w of workouts) {
    const exercises = await getExercisesForWorkout(db, w.id);
    const s = schedByWorkout.get(w.id);
    assembled.push({
      id: w.id,
      name: w.name,
      sort_order: s?.sort_order ?? 0,
      day_of_week: s?.day_of_week ?? null,
      scheduled_time: s?.scheduled_time ?? null,
      exercises: exercises.map((e) => ({
        id: e.id,
        workout_id: e.workout_id,
        exercise_name: e.exercise_name,
        sets: e.sets,
        reps: e.reps,
        rest_seconds: e.rest_seconds,
        sort_order: e.sort_order,
      })),
    });
  }
  assembled.sort((a, b) => a.sort_order - b.sort_order);

  let rotationIndex: number | null = null;
  if (program.type === 'rotation') {
    const state = await getRotationState(db, userId, program.id);
    rotationIndex = state?.current_index ?? 0;
  }

  return {
    id: program.id,
    name: program.name,
    type: program.type,
    rotation_current_index: rotationIndex,
    workouts: assembled,
  };
}

// --- Web API: Template adoption (transactional clone) ------------------------

/**
 * Clones a catalog Template into a new user-owned active Program in a single
 * transaction: deactivates any prior Program, then creates `programs`,
 * `workouts`, `workout_exercises`, and `schedule` rows owned by the caller.
 * Rotation templates seed a `rotation_state` row at index 0 with NULL
 * `day_of_week`; static templates keep their `day_of_week` values. There is no
 * FK back to the Template — adoption is a one-time copy with no propagation.
 */
export async function adoptTemplate(db: DB, userId: string, templateId: string): Promise<AssembledProgram> {
  await db.begin(async (sql) => {
    const [template] = await sql`SELECT * FROM program_templates WHERE id = ${templateId}`;
    if (!template) throw new NotFoundError('Template not found');
    const isRotation = template.type === 'rotation';

    await sql`UPDATE programs SET active = 0 WHERE user_id = ${userId}`;

    const programId = randomUUID();
    await sql`INSERT INTO programs (id, user_id, name, type) VALUES (${programId}, ${userId}, ${template.name}, ${template.type})`;

    const tWorkouts = await sql`SELECT * FROM template_workouts WHERE program_template_id = ${templateId} ORDER BY sort_order`;
    const tSchedule = await sql`SELECT * FROM template_schedule WHERE program_template_id = ${templateId}`;
    const schedByWorkout = new Map(
      (tSchedule as unknown as Array<{ template_workout_id: string; day_of_week: number | null; scheduled_time: string | null; sort_order: number }>).map(
        (s) => [s.template_workout_id, s],
      ),
    );

    let order = 0;
    for (const tw of tWorkouts as unknown as Array<{ id: string; name: string }>) {
      const workoutId = randomUUID();
      await sql`INSERT INTO workouts (id, program_id, name) VALUES (${workoutId}, ${programId}, ${tw.name})`;

      const exercises = await sql`SELECT * FROM template_exercises WHERE template_workout_id = ${tw.id} ORDER BY sort_order`;
      for (const e of exercises as unknown as Array<{
        exercise_name: string;
        exercise_db_id: string | null;
        sets: number;
        reps: string;
        rest_seconds: number;
        sort_order: number;
      }>) {
        await sql`
          INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
          VALUES (${randomUUID()}, ${workoutId}, ${e.exercise_name}, ${e.exercise_db_id}, ${e.sets}, ${e.reps}, ${e.rest_seconds}, ${e.sort_order})`;
      }

      const s = schedByWorkout.get(tw.id);
      const dayOfWeek = isRotation ? null : s?.day_of_week ?? null;
      const scheduledTime = s?.scheduled_time ?? null;
      const sortOrder = isRotation ? order : s?.sort_order ?? order;
      await sql`
        INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
        VALUES (${randomUUID()}, ${userId}, ${programId}, ${workoutId}, ${dayOfWeek}, ${scheduledTime}, ${sortOrder})`;
      order++;
    }

    if (isRotation) {
      await sql`INSERT INTO rotation_state (id, user_id, program_id, current_index) VALUES (${randomUUID()}, ${userId}, ${programId}, 0)`;
    }
  });

  const program = await getActiveProgramDetail(db, userId);
  if (!program) throw new Error('Adoption completed but no active program found');
  return program;
}

// --- Web API: program configuration (intent-based, server-owned invariants) --

/**
 * Resolves the workout's owning Program, asserting it belongs to the caller's
 * active Program. Returns the program id + type. Throws {@link NotFoundError}
 * otherwise (so cross-user access is indistinguishable from "not found").
 */
async function requireOwnedWorkout(
  sql: DB,
  userId: string,
  workoutId: string,
): Promise<{ programId: string; type: 'static' | 'rotation' }> {
  const [row] = await sql`
    SELECT w.program_id, p.type
    FROM workouts w
    JOIN programs p ON p.id = w.program_id
    WHERE w.id = ${workoutId} AND p.user_id = ${userId} AND p.active = 1`;
  if (!row) throw new NotFoundError('Workout not found');
  return { programId: row.program_id as string, type: row.type as 'static' | 'rotation' };
}

async function requireActiveProgram(db: DB, userId: string): Promise<Program> {
  const program = await getActiveProgram(db, userId);
  if (!program) throw new NotFoundError('No active program');
  return program;
}

/** Adds a Workout to the active Program with an (unscheduled) schedule slot appended. */
export async function addWorkout(db: DB, userId: string, name: string): Promise<string> {
  const program = await requireActiveProgram(db, userId);
  const workoutId = randomUUID();
  await db.begin(async (sql) => {
    await sql`INSERT INTO workouts (id, program_id, name) VALUES (${workoutId}, ${program.id}, ${name})`;
    const [{ next_order }] = await sql`
      SELECT COALESCE(MAX(sort_order), -1)::int + 1 AS next_order FROM schedule WHERE program_id = ${program.id} AND active = 1`;
    await sql`
      INSERT INTO schedule (id, user_id, program_id, workout_id, day_of_week, scheduled_time, sort_order)
      VALUES (${randomUUID()}, ${userId}, ${program.id}, ${workoutId}, NULL, NULL, ${next_order})`;
  });
  return workoutId;
}

export async function renameWorkout(db: DB, userId: string, workoutId: string, name: string): Promise<void> {
  await db.begin(async (sql) => {
    await requireOwnedWorkout(sql as unknown as DB, userId, workoutId);
    await sql`UPDATE workouts SET name = ${name} WHERE id = ${workoutId}`;
  });
}

/** Removes a Workout and cascades its schedule entries and exercises; re-packs order. */
export async function removeWorkout(db: DB, userId: string, workoutId: string): Promise<void> {
  await db.begin(async (sql) => {
    const { programId } = await requireOwnedWorkout(sql as unknown as DB, userId, workoutId);
    await sql`DELETE FROM schedule WHERE workout_id = ${workoutId}`;
    await sql`DELETE FROM workout_exercises WHERE workout_id = ${workoutId}`;
    await sql`DELETE FROM workouts WHERE id = ${workoutId}`;

    const remaining = await sql`SELECT id FROM schedule WHERE program_id = ${programId} AND active = 1 ORDER BY sort_order`;
    let i = 0;
    for (const r of remaining as unknown as Array<{ id: string }>) {
      await sql`UPDATE schedule SET sort_order = ${i} WHERE id = ${r.id}`;
      i++;
    }
  });
}

/** Reorders the active Program's Workouts; `workoutIds` must be the full set. */
export async function reorderWorkouts(db: DB, userId: string, workoutIds: string[]): Promise<void> {
  const program = await requireActiveProgram(db, userId);
  await db.begin(async (sql) => {
    const rows = await sql`SELECT workout_id FROM schedule WHERE program_id = ${program.id} AND active = 1`;
    const existing = new Set((rows as unknown as Array<{ workout_id: string }>).map((r) => r.workout_id));
    if (workoutIds.length !== existing.size || !workoutIds.every((id) => existing.has(id))) {
      throw new DomainValidationError('workout_ids must list exactly the active program workouts');
    }
    let i = 0;
    for (const id of workoutIds) {
      await sql`UPDATE schedule SET sort_order = ${i} WHERE program_id = ${program.id} AND workout_id = ${id} AND active = 1`;
      i++;
    }
  });
}

export interface AddExerciseInput {
  workout_id: string;
  exercise_name: string;
  sets: number;
  reps: string;
  rest_seconds?: number;
}

export async function addExercise(db: DB, userId: string, input: AddExerciseInput): Promise<string> {
  const exerciseId = randomUUID();
  await db.begin(async (sql) => {
    await requireOwnedWorkout(sql as unknown as DB, userId, input.workout_id);
    const [{ next_order }] = await sql`
      SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order FROM workout_exercises WHERE workout_id = ${input.workout_id}`;
    await sql`
      INSERT INTO workout_exercises (id, workout_id, exercise_name, exercise_db_id, sets, reps, rest_seconds, sort_order)
      VALUES (${exerciseId}, ${input.workout_id}, ${input.exercise_name}, NULL, ${input.sets}, ${input.reps}, ${input.rest_seconds ?? 90}, ${next_order})`;
  });
  return exerciseId;
}

export interface UpdateExerciseInput {
  exercise_id: string;
  exercise_name?: string;
  sets?: number;
  reps?: string;
  rest_seconds?: number;
}

export async function updateExercise(db: DB, userId: string, input: UpdateExerciseInput): Promise<void> {
  await db.begin(async (sql) => {
    const [row] = await sql`
      SELECT we.id
      FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      JOIN programs p ON p.id = w.program_id
      WHERE we.id = ${input.exercise_id} AND p.user_id = ${userId} AND p.active = 1`;
    if (!row) throw new NotFoundError('Exercise not found');
    // COALESCE keeps the existing value when a field is omitted (passed as null).
    await sql`
      UPDATE workout_exercises SET
        exercise_name = COALESCE(${input.exercise_name ?? null}, exercise_name),
        sets = COALESCE(${input.sets ?? null}, sets),
        reps = COALESCE(${input.reps ?? null}, reps),
        rest_seconds = COALESCE(${input.rest_seconds ?? null}, rest_seconds)
      WHERE id = ${input.exercise_id}`;
  });
}

export async function removeExercise(db: DB, userId: string, exerciseId: string): Promise<void> {
  await db.begin(async (sql) => {
    const [row] = await sql`
      SELECT we.id
      FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      JOIN programs p ON p.id = w.program_id
      WHERE we.id = ${exerciseId} AND p.user_id = ${userId} AND p.active = 1`;
    if (!row) throw new NotFoundError('Exercise not found');
    await sql`DELETE FROM workout_exercises WHERE id = ${exerciseId}`;
  });
}

export async function reorderExercises(
  db: DB,
  userId: string,
  workoutId: string,
  exerciseIds: string[],
): Promise<void> {
  await db.begin(async (sql) => {
    await requireOwnedWorkout(sql as unknown as DB, userId, workoutId);
    const rows = await sql`SELECT id FROM workout_exercises WHERE workout_id = ${workoutId}`;
    const existing = new Set((rows as unknown as Array<{ id: string }>).map((r) => r.id));
    if (exerciseIds.length !== existing.size || !exerciseIds.every((id) => existing.has(id))) {
      throw new DomainValidationError('exercise_ids must list exactly the workout exercises');
    }
    let i = 1;
    for (const id of exerciseIds) {
      await sql`UPDATE workout_exercises SET sort_order = ${i} WHERE id = ${id}`;
      i++;
    }
  });
}

export type ScheduleIntent =
  | { type: 'static'; entries: Array<{ workout_id: string; day_of_week: number; scheduled_time?: string | null }> }
  | { type: 'rotation'; entries: Array<{ workout_id: string; scheduled_time?: string | null }> };

/**
 * Applies a schedule intent to the active Program. The intent type must match
 * the Program type (use {@link switchProgramType} to change it). The server
 * derives `day_of_week` / `sort_order`; the client never stores them verbatim.
 */
export async function setSchedule(db: DB, userId: string, intent: ScheduleIntent): Promise<void> {
  const program = await requireActiveProgram(db, userId);
  if (intent.type !== program.type) {
    throw new DomainValidationError(
      `Active program is ${program.type}; switch its type before setting a ${intent.type} schedule`,
    );
  }
  await db.begin(async (sql) => {
    const rows = await sql`SELECT workout_id FROM schedule WHERE program_id = ${program.id} AND active = 1`;
    const owned = new Set((rows as unknown as Array<{ workout_id: string }>).map((r) => r.workout_id));
    for (const e of intent.entries) {
      if (!owned.has(e.workout_id)) throw new NotFoundError('Workout not found in active program');
    }

    if (intent.type === 'static') {
      for (const e of intent.entries) {
        await sql`
          UPDATE schedule SET day_of_week = ${e.day_of_week}, scheduled_time = ${e.scheduled_time ?? null}
          WHERE program_id = ${program.id} AND workout_id = ${e.workout_id} AND active = 1`;
      }
    } else {
      let i = 0;
      for (const e of intent.entries) {
        await sql`
          UPDATE schedule SET day_of_week = NULL, scheduled_time = ${e.scheduled_time ?? null}, sort_order = ${i}
          WHERE program_id = ${program.id} AND workout_id = ${e.workout_id} AND active = 1`;
        i++;
      }
    }
  });
}

/**
 * Switches the active Program's scheduling type, maintaining all invariants.
 * → rotation: nulls every `day_of_week`, assigns contiguous `sort_order`, and
 *   (re)creates `rotation_state` at index 0.
 * → static: requires a `day_of_week` per Workout and deletes `rotation_state`.
 */
export async function switchProgramType(
  db: DB,
  userId: string,
  target: 'static' | 'rotation',
  days?: Array<{ workout_id: string; day_of_week: number; scheduled_time?: string | null }>,
): Promise<void> {
  const program = await requireActiveProgram(db, userId);
  await db.begin(async (sql) => {
    const schedules = (await sql`
      SELECT * FROM schedule WHERE program_id = ${program.id} AND active = 1 ORDER BY sort_order`) as unknown as Schedule[];

    if (target === 'rotation') {
      let i = 0;
      for (const s of schedules) {
        await sql`UPDATE schedule SET day_of_week = NULL, sort_order = ${i} WHERE id = ${s.id}`;
        i++;
      }
      await sql`UPDATE programs SET type = 'rotation' WHERE id = ${program.id}`;
      await sql`DELETE FROM rotation_state WHERE program_id = ${program.id}`;
      await sql`INSERT INTO rotation_state (id, user_id, program_id, current_index) VALUES (${randomUUID()}, ${userId}, ${program.id}, 0)`;
    } else {
      const dayMap = new Map((days ?? []).map((d) => [d.workout_id, d]));
      for (const s of schedules) {
        if (!dayMap.has(s.workout_id)) {
          throw new DomainValidationError('Switching to static requires a day_of_week for every workout');
        }
      }
      let i = 0;
      for (const s of schedules) {
        const d = dayMap.get(s.workout_id)!;
        await sql`
          UPDATE schedule SET day_of_week = ${d.day_of_week}, scheduled_time = ${d.scheduled_time ?? s.scheduled_time}, sort_order = ${i}
          WHERE id = ${s.id}`;
        i++;
      }
      await sql`UPDATE programs SET type = 'static' WHERE id = ${program.id}`;
      await sql`DELETE FROM rotation_state WHERE program_id = ${program.id}`;
    }
  });
}
