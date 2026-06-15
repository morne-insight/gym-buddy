import {
  getActiveProgram,
  getScheduleForDay,
  getSchedulesByProgram,
  getScheduleAtIndex,
  getExercisesForWorkout,
  getWorkoutById,
  getRotationState,
  getCompletedWorkoutsThisWeek,
  type DB,
  type Schedule,
} from '../db/index.js';

export interface WorkoutExerciseInfo {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
}

export interface CurrentWorkoutResult {
  restDay: boolean;
  workoutName: string | null;
  scheduleId: string | null;
  exercises: WorkoutExerciseInfo[];
}

export async function getCurrentWorkout(
  db: DB,
  userId: string,
  dayOfWeek?: number,
  referenceDate?: string,
): Promise<CurrentWorkoutResult> {
  const restDay: CurrentWorkoutResult = { restDay: true, workoutName: null, scheduleId: null, exercises: [] };

  const program = await getActiveProgram(db, userId);
  if (!program) return restDay;

  if (program.type === 'rotation') {
    return resolveRotation(db, userId, program.id);
  }

  return resolveStatic(db, userId, program.id, dayOfWeek, referenceDate);
}

async function resolveStatic(
  db: DB,
  userId: string,
  programId: string,
  dayOfWeek?: number,
  referenceDate?: string,
): Promise<CurrentWorkoutResult> {
  const restDay: CurrentWorkoutResult = { restDay: true, workoutName: null, scheduleId: null, exercises: [] };
  const day = dayOfWeek ?? new Date().getDay();
  const completedWorkoutIds = await getCompletedWorkoutsThisWeek(db, userId, referenceDate);

  const todaySchedule = await getScheduleForDay(db, userId, day);

  if (todaySchedule && !completedWorkoutIds.includes(todaySchedule.workout_id)) {
    return buildResult(db, todaySchedule);
  }

  const allSchedules = await getSchedulesByProgram(db, programId);
  for (const sched of allSchedules) {
    if (!completedWorkoutIds.includes(sched.workout_id)) {
      return buildResult(db, sched);
    }
  }

  return restDay;
}

async function resolveRotation(db: DB, userId: string, programId: string): Promise<CurrentWorkoutResult> {
  const restDay: CurrentWorkoutResult = { restDay: true, workoutName: null, scheduleId: null, exercises: [] };

  const state = await getRotationState(db, userId, programId);
  if (!state) return restDay;

  const schedule = await getScheduleAtIndex(db, programId, state.current_index);
  if (!schedule) return restDay;

  return buildResult(db, schedule);
}

async function buildResult(db: DB, schedule: Schedule): Promise<CurrentWorkoutResult> {
  const workout = await getWorkoutById(db, schedule.workout_id);
  if (!workout) return { restDay: true, workoutName: null, scheduleId: null, exercises: [] };

  const exercises = await getExercisesForWorkout(db, workout.id);

  return {
    restDay: false,
    workoutName: workout.name,
    scheduleId: schedule.id,
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.exercise_name,
      sets: e.sets,
      reps: e.reps,
      restSeconds: e.rest_seconds,
    })),
  };
}
