import {
  createExerciseLog,
  getExerciseLogForWorkoutExercise,
  getExercisesForWorkout,
  getExerciseLogsForSession,
  getWorkoutExerciseById,
  insertSetLog,
  getActiveSession,
  createSession,
  type DB,
} from '../db/index.js';

export interface LogSetParams {
  sessionId?: string;
  userId?: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  weight?: number;
}

export interface LogSetResult {
  logged: boolean;
  setNumber: number;
  totalSets: number;
  exerciseComplete: boolean;
  remainingExercises: number;
  exerciseLogId: string;
  sessionId: string;
}

export async function logSetCompleted(db: DB, params: LogSetParams): Promise<LogSetResult> {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    let session = await getActiveSession(db, params.userId);
    if (!session) {
      session = await createSession(db, params.userId, null);
    }
    sessionId = session.id;
  }

  if (!sessionId) {
    return {
      logged: false,
      setNumber: params.setNumber,
      totalSets: 0,
      exerciseComplete: false,
      remainingExercises: 0,
      exerciseLogId: '',
      sessionId: '',
    };
  }

  const exercise = await getWorkoutExerciseById(db, params.exerciseId);

  if (!exercise) {
    return {
      logged: false,
      setNumber: params.setNumber,
      totalSets: 0,
      exerciseComplete: false,
      remainingExercises: 0,
      exerciseLogId: '',
      sessionId,
    };
  }

  let exerciseLog = await getExerciseLogForWorkoutExercise(db, sessionId, params.exerciseId);
  if (!exerciseLog) {
    exerciseLog = await createExerciseLog(db, sessionId, params.exerciseId);
  }

  await insertSetLog(db, {
    exercise_log_id: exerciseLog.id,
    set_number: params.setNumber,
    reps: params.reps,
    weight: params.weight ?? null,
  });

  const exerciseComplete = params.setNumber >= exercise.sets;

  const scheduleExercises = await getExercisesForWorkout(db, exercise.workout_id);
  const allLogs = await getExerciseLogsForSession(db, sessionId);
  const completedExerciseIds = new Set(
    allLogs.filter((l) => l.completed === 1 || l.skipped === 1).map((l) => l.workout_exercise_id),
  );
  if (exerciseComplete) {
    completedExerciseIds.add(params.exerciseId);
  }
  const remainingExercises = scheduleExercises.filter((e) => !completedExerciseIds.has(e.id)).length;

  return {
    logged: true,
    setNumber: params.setNumber,
    totalSets: exercise.sets,
    exerciseComplete,
    remainingExercises,
    exerciseLogId: exerciseLog.id,
    sessionId,
  };
}
