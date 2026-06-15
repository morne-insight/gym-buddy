import {
  insertProgram,
  getActiveProgram,
  deactivateUserPrograms,
  insertWorkout,
  getWorkoutById,
  getWorkoutsByProgram,
  getExercisesForWorkout,
  insertWorkoutExercise,
  insertRotationState,
  getRotationState,
  advanceRotation,
  type DB,
} from './index.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
} from './test-helpers.js';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';

let db: DB;

beforeAll(async () => {
  db = createTestDatabase();
  await setupTestSchema();
});

beforeEach(async () => {
  await resetTestData();
  await seedTestPersona(db);
});

afterAll(async () => {
  await closeTestPool();
});

describe('workouts CRUD and exercise ownership', () => {
  it('inserts and retrieves a workout', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL', type: 'static' });
    await insertWorkout(db, { id: 'w-push', program_id: 'prog-1', name: 'Push Day' });

    const workout = await getWorkoutById(db, 'w-push');
    expect(workout).toBeDefined();
    expect(workout!.name).toBe('Push Day');
    expect(workout!.program_id).toBe('prog-1');
  });

  it('retrieves all workouts for a program', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL', type: 'static' });
    await insertWorkout(db, { id: 'w-push', program_id: 'prog-1', name: 'Push Day' });
    await insertWorkout(db, { id: 'w-pull', program_id: 'prog-1', name: 'Pull Day' });

    const workouts = await getWorkoutsByProgram(db, 'prog-1');
    expect(workouts).toHaveLength(2);
  });

  it('exercises belong to a workout, not a schedule', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL', type: 'static' });
    await insertWorkout(db, { id: 'w-push', program_id: 'prog-1', name: 'Push Day' });

    await insertWorkoutExercise(db, {
      id: 'ex-1', workout_id: 'w-push', exercise_name: 'Bench Press',
      exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 1,
    });
    await insertWorkoutExercise(db, {
      id: 'ex-2', workout_id: 'w-push', exercise_name: 'OHP',
      exercise_db_id: null, sets: 3, reps: '10-12', rest_seconds: 90, sort_order: 2,
    });

    const exercises = await getExercisesForWorkout(db, 'w-push');
    expect(exercises).toHaveLength(2);
    expect(exercises[0].exercise_name).toBe('Bench Press');
    expect(exercises[1].exercise_name).toBe('OHP');
    expect(exercises[0].workout_id).toBe('w-push');
  });

  it('exercises are returned in sort_order', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL', type: 'static' });
    await insertWorkout(db, { id: 'w-push', program_id: 'prog-1', name: 'Push Day' });

    await insertWorkoutExercise(db, {
      id: 'ex-2', workout_id: 'w-push', exercise_name: 'OHP',
      exercise_db_id: null, sets: 3, reps: '10-12', rest_seconds: 90, sort_order: 2,
    });
    await insertWorkoutExercise(db, {
      id: 'ex-1', workout_id: 'w-push', exercise_name: 'Bench Press',
      exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 1,
    });

    const exercises = await getExercisesForWorkout(db, 'w-push');
    expect(exercises[0].exercise_name).toBe('Bench Press');
    expect(exercises[1].exercise_name).toBe('OHP');
  });
});

describe('programs CRUD and active-program constraint', () => {
  it('inserts and retrieves active program', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL', type: 'static' });

    const program = await getActiveProgram(db, userId);
    expect(program).toBeDefined();
    expect(program!.name).toBe('PPL');
    expect(program!.type).toBe('static');
    expect(program!.active).toBe(1);
  });

  it('returns undefined when no active program', async () => {
    const userId = await seedTestUser(db);
    const program = await getActiveProgram(db, userId);
    expect(program).toBeUndefined();
  });

  it('deactivates all user programs', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL', type: 'static' });

    await deactivateUserPrograms(db, userId);
    const program = await getActiveProgram(db, userId);
    expect(program).toBeUndefined();
  });

  it('only one active program per user via deactivation', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-1', user_id: userId, name: 'PPL Static', type: 'static' });

    await deactivateUserPrograms(db, userId);
    await insertProgram(db, { id: 'prog-2', user_id: userId, name: 'PPL Rotation', type: 'rotation' });

    const program = await getActiveProgram(db, userId);
    expect(program!.id).toBe('prog-2');
    expect(program!.type).toBe('rotation');
  });

  it('supports rotation type', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r', user_id: userId, name: 'PPL Rotation', type: 'rotation' });

    const program = await getActiveProgram(db, userId);
    expect(program!.type).toBe('rotation');
  });
});

describe('rotation_state advancement and wrap-around', () => {
  it('creates rotation state at index 0', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r', user_id: userId, name: 'PPL', type: 'rotation' });
    await insertRotationState(db, { id: 'rs-1', user_id: userId, program_id: 'prog-r', current_index: 0 });

    const state = await getRotationState(db, userId, 'prog-r');
    expect(state).toBeDefined();
    expect(state!.current_index).toBe(0);
    expect(state!.last_completed_at).toBeNull();
  });

  it('advances rotation index', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r', user_id: userId, name: 'PPL', type: 'rotation' });
    await insertRotationState(db, { id: 'rs-1', user_id: userId, program_id: 'prog-r', current_index: 0 });

    await advanceRotation(db, userId, 'prog-r', 3);

    const state = await getRotationState(db, userId, 'prog-r');
    expect(state!.current_index).toBe(1);
    expect(state!.last_completed_at).not.toBeNull();
  });

  it('wraps around at end of rotation', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r', user_id: userId, name: 'PPL', type: 'rotation' });
    await insertRotationState(db, { id: 'rs-1', user_id: userId, program_id: 'prog-r', current_index: 2 });

    await advanceRotation(db, userId, 'prog-r', 3);

    const state = await getRotationState(db, userId, 'prog-r');
    expect(state!.current_index).toBe(0);
  });

  it('advances through full cycle', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r', user_id: userId, name: 'PPL', type: 'rotation' });
    await insertRotationState(db, { id: 'rs-1', user_id: userId, program_id: 'prog-r', current_index: 0 });

    await advanceRotation(db, userId, 'prog-r', 3); // 0 → 1
    await advanceRotation(db, userId, 'prog-r', 3); // 1 → 2
    await advanceRotation(db, userId, 'prog-r', 3); // 2 → 0

    const state = await getRotationState(db, userId, 'prog-r');
    expect(state!.current_index).toBe(0);
  });

  it('sets last_completed_at on advance', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r', user_id: userId, name: 'PPL', type: 'rotation' });
    await insertRotationState(db, { id: 'rs-1', user_id: userId, program_id: 'prog-r', current_index: 0 });

    const before = new Date().toISOString();
    await advanceRotation(db, userId, 'prog-r', 3);
    const after = new Date().toISOString();

    const state = await getRotationState(db, userId, 'prog-r');
    expect(state!.last_completed_at).not.toBeNull();
    expect(state!.last_completed_at! >= before).toBe(true);
    expect(state!.last_completed_at! <= after).toBe(true);
  });
});
