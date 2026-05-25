import type Database from 'better-sqlite3';
import {
  logExercise,
  getExerciseLogsForSession,
  getExercisesForSchedule,
  createSession,
  getActiveSession,
  type WorkoutExercise,
} from '../db/index.js';

interface LogExerciseParams {
  sessionId?: string;
  userId?: string;
  exerciseId: string;
  actualSets?: number;
  actualReps?: string;
  actualWeight?: number;
  skipped: boolean;
  notes?: string;
}

export interface LogExerciseResult {
  logged: boolean;
  alreadyLogged?: boolean;
  skipped?: boolean;
  exerciseName?: string;
  remaining: number;
  sessionId?: string;
}

export function logExerciseCompleted(db: Database.Database, params: LogExerciseParams): LogExerciseResult {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    let session = getActiveSession(db, params.userId);
    if (!session) {
      session = createSession(db, params.userId, null);
    }
    sessionId = session.id;
  }

  if (!sessionId) {
    return { logged: false, remaining: 0 };
  }

  const existingLogs = getExerciseLogsForSession(db, sessionId);
  const alreadyLogged = existingLogs.some((l) => l.workout_exercise_id === params.exerciseId);
  if (alreadyLogged) {
    return { logged: false, alreadyLogged: true, remaining: 0 };
  }

  const exercise = db
    .prepare('SELECT * FROM workout_exercises WHERE id = ?')
    .get(params.exerciseId) as WorkoutExercise | undefined;

  logExercise(db, {
    session_id: sessionId,
    workout_exercise_id: params.exerciseId,
    completed: params.skipped ? 0 : 1,
    skipped: params.skipped ? 1 : 0,
    actual_sets: params.actualSets ?? null,
    actual_reps: params.actualReps ?? null,
    actual_weight: params.actualWeight ?? null,
    notes: params.notes ?? null,
  });

  let remaining = 0;
  if (exercise) {
    const scheduleExercises = getExercisesForSchedule(db, exercise.schedule_id);
    const logsAfter = getExerciseLogsForSession(db, sessionId);
    const loggedIds = new Set(logsAfter.map((l) => l.workout_exercise_id));
    remaining = scheduleExercises.filter((e) => !loggedIds.has(e.id)).length;
  }

  return {
    logged: true,
    skipped: params.skipped,
    exerciseName: exercise?.exercise_name,
    remaining,
    sessionId,
  };
}
