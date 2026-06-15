import { createPool } from './pool.js';
import {
  runMigrations,
  truncateAll,
  insertUser,
  insertPersona,
  insertProgram,
  insertWorkout,
  insertSchedule,
  insertWorkoutExercise,
  insertRotationState,
  type DB,
} from './index.js';

/**
 * Connection string for the ephemeral Postgres used by the test suite. Defaults
 * to the disposable Docker container started by `jest.global-setup.cjs`; override
 * with `TEST_DATABASE_URL` to point at a different test database. This is never
 * the runtime Supabase database.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/postgres';

let testPool: DB | null = null;

/** Returns the shared test pool, creating it once per worker. */
export function getTestPool(): DB {
  if (!testPool) {
    testPool = createPool(TEST_DATABASE_URL, 5);
  }
  return testPool;
}

/** Applies the schema to the test database (idempotent). Call once in `beforeAll`. */
export async function setupTestSchema(): Promise<void> {
  await runMigrations(getTestPool());
}

/** Clears all data between tests for isolation. Call in `beforeEach`. */
export async function resetTestData(): Promise<void> {
  await truncateAll(getTestPool());
}

/** Closes the test pool. Call once in `afterAll`. */
export async function closeTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

/** Returns the shared test pool handle to pass into data-access functions. */
export function createTestDatabase(): DB {
  return getTestPool();
}

export async function seedTestUser(db: DB, overrides?: Partial<{ id: string; name: string }>): Promise<string> {
  const userId = overrides?.id ?? 'test-user-1';
  await insertUser(db, {
    id: userId,
    name: overrides?.name ?? 'Test User',
    telegram_chat_id: null,
    persona_id: 'drill-sergeant',
    goal_description: 'Get stronger',
    goal_image_url: null,
    training_style: 'weightlifting',
  });
  return userId;
}

export async function seedTestPersona(db: DB): Promise<void> {
  await insertPersona(db, {
    id: 'drill-sergeant',
    name: 'The Drill Sergeant',
    description: 'Tough love, no excuses',
    system_prompt: 'You are a drill sergeant gym buddy.',
    tts_voice: 'cartesia-drill-sergeant',
    example_greeting: 'Look who showed up. Let\'s get after it.',
    example_skip_reaction: 'Stay mediocre then.',
    example_no_show_reaction: 'You didn\'t show. What happened?',
  });
}

export async function seedTestSchedule(db: DB, userId: string): Promise<string> {
  const programId = 'prog-static-test';
  const workoutId = 'workout-push';
  const scheduleId = 'sched-monday-push';

  await insertProgram(db, {
    id: programId,
    user_id: userId,
    name: 'Test PPL',
    type: 'static',
  });

  await insertWorkout(db, {
    id: workoutId,
    program_id: programId,
    name: 'Push Day',
  });

  await insertSchedule(db, {
    id: scheduleId,
    user_id: userId,
    program_id: programId,
    workout_id: workoutId,
    day_of_week: 1,
    scheduled_time: '06:00',
    sort_order: 0,
  });

  await insertWorkoutExercise(db, {
    id: 'ex-bench',
    workout_id: workoutId,
    exercise_name: 'Bench Press',
    exercise_db_id: null,
    sets: 4,
    reps: '8-10',
    rest_seconds: 90,
    sort_order: 1,
  });

  await insertWorkoutExercise(db, {
    id: 'ex-ohp',
    workout_id: workoutId,
    exercise_name: 'Overhead Press',
    exercise_db_id: null,
    sets: 3,
    reps: '10-12',
    rest_seconds: 90,
    sort_order: 2,
  });

  await insertWorkoutExercise(db, {
    id: 'ex-dips',
    workout_id: workoutId,
    exercise_name: 'Dips',
    exercise_db_id: null,
    sets: 3,
    reps: 'to failure',
    rest_seconds: 60,
    sort_order: 3,
  });

  return scheduleId;
}

export async function seedTestPPL(db: DB, userId: string): Promise<string> {
  const programId = 'prog-static-ppl';

  await insertProgram(db, {
    id: programId,
    user_id: userId,
    name: 'PPL Static',
    type: 'static',
  });

  const workouts = [
    { id: 'workout-push', name: 'Push Day' },
    { id: 'workout-pull', name: 'Pull Day' },
    { id: 'workout-legs', name: 'Legs Day' },
  ];

  for (const w of workouts) {
    await insertWorkout(db, { id: w.id, program_id: programId, name: w.name });
  }

  await insertSchedule(db, {
    id: 'sched-mon-push',
    user_id: userId,
    program_id: programId,
    workout_id: 'workout-push',
    day_of_week: 1,
    scheduled_time: '06:00',
    sort_order: 0,
  });

  await insertSchedule(db, {
    id: 'sched-wed-pull',
    user_id: userId,
    program_id: programId,
    workout_id: 'workout-pull',
    day_of_week: 3,
    scheduled_time: '06:00',
    sort_order: 1,
  });

  await insertSchedule(db, {
    id: 'sched-fri-legs',
    user_id: userId,
    program_id: programId,
    workout_id: 'workout-legs',
    day_of_week: 5,
    scheduled_time: '06:00',
    sort_order: 2,
  });

  await insertWorkoutExercise(db, { id: 'ex-bench', workout_id: 'workout-push', exercise_name: 'Bench Press', exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 1 });
  await insertWorkoutExercise(db, { id: 'ex-ohp', workout_id: 'workout-push', exercise_name: 'Overhead Press', exercise_db_id: null, sets: 3, reps: '10-12', rest_seconds: 90, sort_order: 2 });

  await insertWorkoutExercise(db, { id: 'ex-deadlift', workout_id: 'workout-pull', exercise_name: 'Deadlift', exercise_db_id: null, sets: 4, reps: '5-6', rest_seconds: 180, sort_order: 1 });
  await insertWorkoutExercise(db, { id: 'ex-row', workout_id: 'workout-pull', exercise_name: 'Barbell Row', exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 2 });

  await insertWorkoutExercise(db, { id: 'ex-squat', workout_id: 'workout-legs', exercise_name: 'Barbell Squat', exercise_db_id: null, sets: 4, reps: '6-8', rest_seconds: 180, sort_order: 1 });
  await insertWorkoutExercise(db, { id: 'ex-rdl', workout_id: 'workout-legs', exercise_name: 'Romanian Deadlift', exercise_db_id: null, sets: 3, reps: '8-10', rest_seconds: 120, sort_order: 2 });

  return programId;
}

export async function seedTestRotationPPL(db: DB, userId: string): Promise<string> {
  const programId = 'prog-rotation-ppl';

  await insertProgram(db, {
    id: programId,
    user_id: userId,
    name: 'PPL Rotation',
    type: 'rotation',
  });

  const workouts = [
    { id: 'rworkout-push', name: 'Push Day' },
    { id: 'rworkout-pull', name: 'Pull Day' },
    { id: 'rworkout-legs', name: 'Legs Day' },
  ];

  for (const w of workouts) {
    await insertWorkout(db, { id: w.id, program_id: programId, name: w.name });
  }

  await insertSchedule(db, {
    id: 'rsched-push',
    user_id: userId,
    program_id: programId,
    workout_id: 'rworkout-push',
    day_of_week: null,
    scheduled_time: null,
    sort_order: 0,
  });

  await insertSchedule(db, {
    id: 'rsched-pull',
    user_id: userId,
    program_id: programId,
    workout_id: 'rworkout-pull',
    day_of_week: null,
    scheduled_time: null,
    sort_order: 1,
  });

  await insertSchedule(db, {
    id: 'rsched-legs',
    user_id: userId,
    program_id: programId,
    workout_id: 'rworkout-legs',
    day_of_week: null,
    scheduled_time: null,
    sort_order: 2,
  });

  await insertWorkoutExercise(db, { id: 'rex-bench', workout_id: 'rworkout-push', exercise_name: 'Bench Press', exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 1 });
  await insertWorkoutExercise(db, { id: 'rex-deadlift', workout_id: 'rworkout-pull', exercise_name: 'Deadlift', exercise_db_id: null, sets: 4, reps: '5-6', rest_seconds: 180, sort_order: 1 });
  await insertWorkoutExercise(db, { id: 'rex-squat', workout_id: 'rworkout-legs', exercise_name: 'Barbell Squat', exercise_db_id: null, sets: 4, reps: '6-8', rest_seconds: 180, sort_order: 1 });

  await insertRotationState(db, {
    id: 'rstate-1',
    user_id: userId,
    program_id: programId,
    current_index: 0,
  });

  return programId;
}
