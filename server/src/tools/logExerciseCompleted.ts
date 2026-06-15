import {
  logExercise,
  getExerciseLogsForSession,
  getExercisesForWorkout,
  getWorkoutExerciseById,
  createSession,
  getActiveSession,
  type DB,
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

export async function logExerciseCompleted(db: DB, params: LogExerciseParams): Promise<LogExerciseResult> {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    let session = await getActiveSession(db, params.userId);
    if (!session) {
      session = await createSession(db, params.userId, null);
    }
    sessionId = session.id;
  }

  if (!sessionId) {
    return { logged: false, remaining: 0 };
  }

  const existingLogs = await getExerciseLogsForSession(db, sessionId);
  const alreadyLogged = existingLogs.some((l) => l.workout_exercise_id === params.exerciseId);
  if (alreadyLogged) {
    return { logged: false, alreadyLogged: true, remaining: 0 };
  }

  const exercise = await getWorkoutExerciseById(db, params.exerciseId);

  await logExercise(db, {
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
    const scheduleExercises = await getExercisesForWorkout(db, exercise.workout_id);
    const logsAfter = await getExerciseLogsForSession(db, sessionId);
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
