import {
  getExerciseLogForWorkoutExercise,
  createExerciseLog,
  markExerciseLogCompleted,
  markExerciseLogSkipped,
  getExercisesForWorkout,
  getExerciseLogsForSession,
  getWorkoutExerciseById,
  getActiveSession,
  createSession,
  type DB,
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

export async function completeExercise(db: DB, params: CompleteExerciseParams): Promise<CompleteExerciseResult> {
  let sessionId = params.sessionId;

  if (!sessionId && params.userId) {
    let session = await getActiveSession(db, params.userId);
    if (!session) {
      session = await createSession(db, params.userId, null);
    }
    sessionId = session.id;
  }

  const exercise = await getWorkoutExerciseById(db, params.exerciseId);

  if (!sessionId || !exercise) {
    return {
      completed: false,
      skipped: false,
      exerciseName: '',
      remainingExercises: 0,
      workoutComplete: false,
    };
  }

  let exerciseLog = await getExerciseLogForWorkoutExercise(db, sessionId, params.exerciseId);
  if (!exerciseLog) {
    exerciseLog = await createExerciseLog(db, sessionId, params.exerciseId);
  }

  if (params.skipped) {
    await markExerciseLogSkipped(db, exerciseLog.id);
  } else {
    await markExerciseLogCompleted(db, exerciseLog.id);
  }

  const workoutExercises = await getExercisesForWorkout(db, exercise.workout_id);
  const allLogs = await getExerciseLogsForSession(db, sessionId);
  const doneIds = new Set(
    allLogs.filter((l) => l.completed === 1 || l.skipped === 1).map((l) => l.workout_exercise_id),
  );
  doneIds.add(params.exerciseId);

  const remainingExercises = workoutExercises.filter((e) => !doneIds.has(e.id)).length;

  return {
    completed: !params.skipped,
    skipped: !!params.skipped,
    exerciseName: exercise.exercise_name,
    remainingExercises,
    workoutComplete: remainingExercises === 0,
  };
}
