import type Database from 'better-sqlite3';
import { getScheduleForDay, getExercisesForSchedule } from '../db/index.js';

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
  exercises: WorkoutExerciseInfo[];
}

export function getCurrentWorkout(
  db: Database.Database,
  userId: string,
  dayOfWeek?: number,
): CurrentWorkoutResult {
  const day = dayOfWeek ?? new Date().getDay();
  const schedule = getScheduleForDay(db, userId, day);

  if (!schedule) {
    return { restDay: true, workoutName: null, exercises: [] };
  }

  const exercises = getExercisesForSchedule(db, schedule.id);

  return {
    restDay: false,
    workoutName: schedule.workout_name,
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.exercise_name,
      sets: e.sets,
      reps: e.reps,
      restSeconds: e.rest_seconds,
    })),
  };
}
