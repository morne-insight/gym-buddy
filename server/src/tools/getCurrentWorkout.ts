import type Database from 'better-sqlite3';
import {
  getActiveProgram,
  getScheduleForDay,
  getSchedulesByProgram,
  getScheduleAtIndex,
  getExercisesForWorkout,
  getWorkoutById,
  getRotationState,
  getCompletedWorkoutsThisWeek,
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

export function getCurrentWorkout(
  db: Database.Database,
  userId: string,
  dayOfWeek?: number,
  referenceDate?: string,
): CurrentWorkoutResult {
  const restDay: CurrentWorkoutResult = { restDay: true, workoutName: null, scheduleId: null, exercises: [] };

  const program = getActiveProgram(db, userId);
  if (!program) return restDay;

  if (program.type === 'rotation') {
    return resolveRotation(db, userId, program.id);
  }

  return resolveStatic(db, userId, program.id, dayOfWeek, referenceDate);
}

function resolveStatic(
  db: Database.Database,
  userId: string,
  programId: string,
  dayOfWeek?: number,
  referenceDate?: string,
): CurrentWorkoutResult {
  const restDay: CurrentWorkoutResult = { restDay: true, workoutName: null, scheduleId: null, exercises: [] };
  const day = dayOfWeek ?? new Date().getDay();
  const completedWorkoutIds = getCompletedWorkoutsThisWeek(db, userId, referenceDate);

  const todaySchedule = getScheduleForDay(db, userId, day);

  if (todaySchedule && !completedWorkoutIds.includes(todaySchedule.workout_id)) {
    return buildResult(db, todaySchedule);
  }

  const allSchedules = getSchedulesByProgram(db, programId);
  for (const sched of allSchedules) {
    if (!completedWorkoutIds.includes(sched.workout_id)) {
      return buildResult(db, sched);
    }
  }

  return restDay;
}

function resolveRotation(
  db: Database.Database,
  userId: string,
  programId: string,
): CurrentWorkoutResult {
  const restDay: CurrentWorkoutResult = { restDay: true, workoutName: null, scheduleId: null, exercises: [] };

  const state = getRotationState(db, userId, programId);
  if (!state) return restDay;

  const schedule = getScheduleAtIndex(db, programId, state.current_index);
  if (!schedule) return restDay;

  return buildResult(db, schedule);
}

function buildResult(db: Database.Database, schedule: Schedule): CurrentWorkoutResult {
  const workout = getWorkoutById(db, schedule.workout_id);
  if (!workout) return { restDay: true, workoutName: null, scheduleId: null, exercises: [] };

  const exercises = getExercisesForWorkout(db, workout.id);

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
