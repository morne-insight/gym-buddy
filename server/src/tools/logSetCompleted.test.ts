import { logSetCompleted } from './logSetCompleted.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestSchedule,
} from '../db/test-helpers.js';
import { createSession, getSetLogsForExercise, getExerciseLogForWorkoutExercise, type DB } from '../db/index.js';
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

describe('logSetCompleted', () => {
  it('creates parent exercise_log on first set', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const result = await logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 1,
      reps: 10,
      weight: 80,
    });

    expect(result.logged).toBe(true);
    expect(result.setNumber).toBe(1);
    expect(result.totalSets).toBe(4);
    expect(result.exerciseComplete).toBe(false);

    const exerciseLog = await getExerciseLogForWorkoutExercise(db, session.id, 'ex-bench');
    expect(exerciseLog).toBeDefined();
  });

  it('appends subsequent sets to existing exercise_log', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    await logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 1,
      reps: 10,
      weight: 80,
    });

    const result = await logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 2,
      reps: 8,
      weight: 80,
    });

    expect(result.logged).toBe(true);
    expect(result.setNumber).toBe(2);
    expect(result.exerciseComplete).toBe(false);

    const exerciseLog = await getExerciseLogForWorkoutExercise(db, session.id, 'ex-bench');
    const setLogs = await getSetLogsForExercise(db, exerciseLog!.id);
    expect(setLogs).toHaveLength(2);
    expect(setLogs[0].reps).toBe(10);
    expect(setLogs[1].reps).toBe(8);
  });

  it('marks exercise complete on final set', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    for (let i = 1; i <= 3; i++) {
      await logSetCompleted(db, {
        sessionId: session.id,
        exerciseId: 'ex-bench',
        setNumber: i,
        reps: 8,
        weight: 80,
      });
    }

    const result = await logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 4,
      reps: 6,
      weight: 80,
    });

    expect(result.exerciseComplete).toBe(true);
    expect(result.totalSets).toBe(4);
  });

  it('tracks remaining exercises correctly', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const result = await logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 1,
      reps: 10,
      weight: 80,
    });

    // Bench not complete yet, so all 3 exercises still remaining
    expect(result.remainingExercises).toBe(3);
  });

  it('auto-creates session if none exists', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const result = await logSetCompleted(db, {
      userId,
      exerciseId: 'ex-bench',
      setNumber: 1,
      reps: 10,
      weight: 80,
    });

    expect(result.logged).toBe(true);
    expect(result.sessionId).toBeTruthy();
  });
});
