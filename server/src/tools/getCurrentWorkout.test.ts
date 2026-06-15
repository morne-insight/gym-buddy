import { getCurrentWorkout } from './getCurrentWorkout.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestSchedule,
  seedTestPPL,
} from '../db/test-helpers.js';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';
import type { DB } from '../db/index.js';

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

describe('getCurrentWorkout', () => {
  it('returns the workout for a scheduled day', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const result = await getCurrentWorkout(db, userId, 1);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day');
    expect(result.exercises).toHaveLength(3);
    expect(result.exercises[0]).toEqual({
      id: 'ex-bench',
      name: 'Bench Press',
      sets: 4,
      reps: '8-10',
      restSeconds: 90,
    });
  });

  it('returns exercises in sort order', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const result = await getCurrentWorkout(db, userId, 1);
    expect(result.exercises[0].name).toBe('Bench Press');
    expect(result.exercises[1].name).toBe('Overhead Press');
    expect(result.exercises[2].name).toBe('Dips');
  });

  it('offers next unperformed workout on off-day (Smart Resolution)', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const result = await getCurrentWorkout(db, userId, 0); // Sunday — no schedule, but Push Day unperformed
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day');
  });

  it('returns rest day for user with no active program', async () => {
    const userId = await seedTestUser(db);

    const result = await getCurrentWorkout(db, userId, 3);
    expect(result.restDay).toBe(true);
  });

  it('handles multiple workout days correctly', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    const monday = await getCurrentWorkout(db, userId, 1);
    expect(monday.workoutName).toBe('Push Day');
    expect(monday.exercises).toHaveLength(2);

    const wednesday = await getCurrentWorkout(db, userId, 3);
    expect(wednesday.workoutName).toBe('Pull Day');
    expect(wednesday.exercises).toHaveLength(2);
    expect(wednesday.exercises[0].name).toBe('Deadlift');
  });
});
