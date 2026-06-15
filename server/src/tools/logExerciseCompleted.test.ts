import { logExerciseCompleted } from './logExerciseCompleted.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestSchedule,
} from '../db/test-helpers.js';
import { createSession, getExerciseLogsForSession, getActiveSession, type DB } from '../db/index.js';
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

describe('logExerciseCompleted', () => {
  it('logs a completed exercise with weight and reps', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const result = await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,7,6',
      actualWeight: 80,
      skipped: false,
    });

    expect(result.logged).toBe(true);
    expect(result.exerciseName).toBe('Bench Press');
    expect(result.remaining).toBe(2);
  });

  it('logs a skipped exercise with a note', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const result = await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-dips',
      skipped: true,
      notes: 'Shoulder pain',
    });

    expect(result.logged).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.remaining).toBe(2);

    const logs = await getExerciseLogsForSession(db, session.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].skipped).toBe(1);
    expect(logs[0].notes).toBe('Shoulder pain');
  });

  it('tracks remaining exercise count correctly', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const r1 = await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 80,
      skipped: false,
    });
    expect(r1.remaining).toBe(2);

    const r2 = await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-ohp',
      actualSets: 3,
      actualReps: '10,10,10',
      actualWeight: 40,
      skipped: false,
    });
    expect(r2.remaining).toBe(1);

    const r3 = await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-dips',
      skipped: true,
    });
    expect(r3.remaining).toBe(0);
  });

  it('auto-creates a session if none exists', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const result = await logExerciseCompleted(db, {
      userId,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 75,
      skipped: false,
    });

    expect(result.logged).toBe(true);
    expect(result.sessionId).toBeDefined();

    const active = await getActiveSession(db, userId);
    expect(active).toBeDefined();
  });

  it('prevents duplicate logging of the same exercise in a session', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 80,
      skipped: false,
    });

    const result = await logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 85,
      skipped: false,
    });

    expect(result.alreadyLogged).toBe(true);
    const logs = await getExerciseLogsForSession(db, session.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].actual_weight).toBe(80);
  });
});
