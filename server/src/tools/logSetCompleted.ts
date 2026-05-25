import type Database from 'better-sqlite3';
import {
  createExerciseLog,
  getExerciseLogForWorkoutExercise,
  getExercisesForSchedule,
  getExerciseLogsForSession,
  insertSetLog,
  getActiveSession,
  createSession,
  type WorkoutExercise,
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

export function logSetCompleted(db: Database.Database, params: LogSetParams): LogSetResult {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    let session = getActiveSession(db, params.userId);
    if (!session) {
      session = createSession(db, params.userId, null);
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

  const exercise = db
    .prepare('SELECT * FROM workout_exercises WHERE id = ?')
    .get(params.exerciseId) as WorkoutExercise | undefined;

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

  let exerciseLog = getExerciseLogForWorkoutExercise(db, sessionId, params.exerciseId);
  if (!exerciseLog) {
    exerciseLog = createExerciseLog(db, sessionId, params.exerciseId);
  }

  insertSetLog(db, {
    exercise_log_id: exerciseLog.id,
    set_number: params.setNumber,
    reps: params.reps,
    weight: params.weight ?? null,
  });

  const exerciseComplete = params.setNumber >= exercise.sets;

  const scheduleExercises = getExercisesForSchedule(db, exercise.schedule_id);
  const allLogs = getExerciseLogsForSession(db, sessionId);
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
