import { getExerciseHistoryTool } from './getExerciseHistory.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestSchedule,
} from '../db/test-helpers.js';
import { createSession, logExercise, completeSession, type DB } from '../db/index.js';
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

describe('getExerciseHistoryTool', () => {
  it('returns history for a specific exercise across sessions', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const s1 = await createSession(db, userId, 'sched-monday-push');
    await logExercise(db, {
      session_id: s1.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,8',
      actual_weight: 75,
      notes: null,
    });
    await completeSession(db, s1.id);

    const s2 = await createSession(db, userId, 'sched-monday-push');
    await logExercise(db, {
      session_id: s2.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,7',
      actual_weight: 80,
      notes: null,
    });
    await completeSession(db, s2.id);

    const result = await getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].weight).toBe(80);
    expect(result.entries[1].weight).toBe(75);
  });

  it('calculates skip frequency', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    for (let i = 0; i < 4; i++) {
      const s = await createSession(db, userId, 'sched-monday-push');
      await logExercise(db, {
        session_id: s.id,
        workout_exercise_id: 'ex-bench',
        completed: i < 3 ? 1 : 0,
        skipped: i < 3 ? 0 : 1,
        actual_sets: i < 3 ? 4 : null,
        actual_reps: i < 3 ? '8,8,8,8' : null,
        actual_weight: i < 3 ? 75 + i * 5 : null,
        notes: i === 3 ? 'Tired' : null,
      });
      await completeSession(db, s.id);
    }

    const result = await getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.entries).toHaveLength(4);
    expect(result.skipCount).toBe(1);
    expect(result.totalSessions).toBe(4);
  });

  it('calculates weight progression trend', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const weights = [70, 75, 77.5, 80];
    for (const w of weights) {
      const s = await createSession(db, userId, 'sched-monday-push');
      await logExercise(db, {
        session_id: s.id,
        workout_exercise_id: 'ex-bench',
        completed: 1,
        skipped: 0,
        actual_sets: 4,
        actual_reps: '8,8,8,8',
        actual_weight: w,
        notes: null,
      });
      await completeSession(db, s.id);
    }

    const result = await getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.weightTrend).toBe('increasing');
  });

  it('returns empty history for unknown exercise', async () => {
    const userId = await seedTestUser(db);

    const result = await getExerciseHistoryTool(db, userId, 'Underwater Basket Weaving');
    expect(result.entries).toHaveLength(0);
    expect(result.skipCount).toBe(0);
    expect(result.totalSessions).toBe(0);
    expect(result.weightTrend).toBe('none');
  });

  it('detects decreasing weight trend', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const weights = [80, 77.5, 75, 70];
    for (const w of weights) {
      const s = await createSession(db, userId, 'sched-monday-push');
      await logExercise(db, {
        session_id: s.id,
        workout_exercise_id: 'ex-bench',
        completed: 1,
        skipped: 0,
        actual_sets: 4,
        actual_reps: '8,8,8,8',
        actual_weight: w,
        notes: null,
      });
      await completeSession(db, s.id);
    }

    const result = await getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.weightTrend).toBe('decreasing');
  });
});
