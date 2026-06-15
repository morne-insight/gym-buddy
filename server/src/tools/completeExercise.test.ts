import { completeExercise } from './completeExercise.js';
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
import { createSession, getExerciseLogForWorkoutExercise, type DB } from '../db/index.js';
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

describe('completeExercise', () => {
  it('marks exercise as completed', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    // Log all sets first
    for (let i = 1; i <= 4; i++) {
      await logSetCompleted(db, {
        sessionId: session.id,
        exerciseId: 'ex-bench',
        setNumber: i,
        reps: 8,
        weight: 80,
      });
    }

    const result = await completeExercise(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
    });

    expect(result.completed).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.exerciseName).toBe('Bench Press');
    expect(result.remainingExercises).toBe(2);

    const log = await getExerciseLogForWorkoutExercise(db, session.id, 'ex-bench');
    expect(log!.completed).toBe(1);
    expect(log!.completed_at).toBeTruthy();
  });

  it('returns correct remaining count', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    // Complete bench
    await logSetCompleted(db, { sessionId: session.id, exerciseId: 'ex-bench', setNumber: 1, reps: 8, weight: 80 });
    await completeExercise(db, { sessionId: session.id, exerciseId: 'ex-bench' });

    // Complete OHP
    await logSetCompleted(db, { sessionId: session.id, exerciseId: 'ex-ohp', setNumber: 1, reps: 10, weight: 40 });
    const result = await completeExercise(db, { sessionId: session.id, exerciseId: 'ex-ohp' });

    expect(result.remainingExercises).toBe(1);
    expect(result.workoutComplete).toBe(false);
  });

  it('returns workoutComplete when last exercise done', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    await completeExercise(db, { sessionId: session.id, exerciseId: 'ex-bench' });
    await completeExercise(db, { sessionId: session.id, exerciseId: 'ex-ohp' });
    const result = await completeExercise(db, { sessionId: session.id, exerciseId: 'ex-dips' });

    expect(result.workoutComplete).toBe(true);
    expect(result.remainingExercises).toBe(0);
  });

  it('marks exercise as skipped when skipped flag is true', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const result = await completeExercise(db, {
      sessionId: session.id,
      exerciseId: 'ex-dips',
      skipped: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.completed).toBe(false);

    const log = await getExerciseLogForWorkoutExercise(db, session.id, 'ex-dips');
    expect(log!.skipped).toBe(1);
  });
});
