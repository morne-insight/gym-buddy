import type Database from 'better-sqlite3';
import {
  getExerciseLogForWorkoutExercise,
  createExerciseLog,
  markExerciseLogCompleted,
  markExerciseLogSkipped,
  getExercisesForSchedule,
  getExerciseLogsForSession,
  getActiveSession,
  createSession,
  type WorkoutExercise,
} from '../db/index.js';

export interface CompleteExerciseParams {
  sessionId?: string;
  userId?: string;
  exerciseId: string;
  skipped?: boolean;
}

export interface CompleteExerciseResult {
  completed: boolean;
  skipped: boolean;
  exerciseName: string;
  remainingExercises: number;
  workoutComplete: boolean;
}

export function completeExercise(db: Database.Database, params: CompleteExerciseParams): CompleteExerciseResult {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    let session = getActiveSession(db, params.userId);
    if (!session) {
      session = createSession(db, params.userId, null);
    }
    sessionId = session.id;
  }

  const exercise = db
    .prepare('SELECT * FROM workout_exercises WHERE id = ?')
    .get(params.exerciseId) as WorkoutExercise | undefined;

  if (!sessionId || !exercise) {
    return {
      completed: false,
      skipped: false,
      exerciseName: '',
      remainingExercises: 0,
      workoutComplete: false,
    };
  }

  let exerciseLog = getExerciseLogForWorkoutExercise(db, sessionId, params.exerciseId);
  if (!exerciseLog) {
    exerciseLog = createExerciseLog(db, sessionId, params.exerciseId);
  }

  if (params.skipped) {
    markExerciseLogSkipped(db, exerciseLog.id);
  } else {
    markExerciseLogCompleted(db, exerciseLog.id);
  }

  const scheduleExercises = getExercisesForSchedule(db, exercise.schedule_id);
  const allLogs = getExerciseLogsForSession(db, sessionId);
  const doneIds = new Set(
    allLogs.filter((l) => l.completed === 1 || l.skipped === 1).map((l) => l.workout_exercise_id),
  );
  doneIds.add(params.exerciseId);

  const remainingExercises = scheduleExercises.filter((e) => !doneIds.has(e.id)).length;

  return {
    completed: !params.skipped,
    skipped: !!params.skipped,
    exerciseName: exercise.exercise_name,
    remainingExercises,
    workoutComplete: remainingExercises === 0,
  };
}
