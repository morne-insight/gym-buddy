import { getCurrentWorkout } from './getCurrentWorkout.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestPPL,
  seedTestRotationPPL,
} from '../db/test-helpers.js';
import {
  createSession,
  completeSession,
  getRotationState,
  insertProgram,
  type DB,
} from '../db/index.js';
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

describe('getCurrentWorkout — static program', () => {
  it('same-day resolution returns scheduled workout (regression)', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    const result = await getCurrentWorkout(db, userId, 1); // Monday
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day');
    expect(result.exercises.length).toBeGreaterThan(0);
  });

  it('Smart Resolution skips already-performed Workout', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    // Simulate completing Push Day earlier this week
    const session = await createSession(db, userId, 'sched-mon-push');
    await db`UPDATE sessions SET started_at = now() - interval '1 day', status = 'completed', completed_at = now() - interval '1 day' WHERE id = ${session.id}`;

    const today = new Date().toISOString().split('T')[0];
    const result = await getCurrentWorkout(db, userId, 1, today); // Monday — Push already done
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Pull Day');
  });

  it('off-day offers next unperformed Workout', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    // Saturday (day 6) — no schedule entry, Pull Day not performed
    const result = await getCurrentWorkout(db, userId, 6);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day'); // First unperformed in sort_order
  });

  it('all Workouts done this week returns rest day', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    const today = new Date().toISOString().split('T')[0];

    // Complete all 3 workouts this week
    const s1 = await createSession(db, userId, 'sched-mon-push');
    await db`UPDATE sessions SET started_at = now() - interval '2 days', status = 'completed', completed_at = now() - interval '2 days' WHERE id = ${s1.id}`;

    const s2 = await createSession(db, userId, 'sched-wed-pull');
    await db`UPDATE sessions SET started_at = now() - interval '1 day', status = 'completed', completed_at = now() - interval '1 day' WHERE id = ${s2.id}`;

    const s3 = await createSession(db, userId, 'sched-fri-legs');
    await db`UPDATE sessions SET started_at = now(), status = 'completed', completed_at = now() WHERE id = ${s3.id}`;

    const result = await getCurrentWorkout(db, userId, 6, today); // Saturday, all done
    expect(result.restDay).toBe(true);
    expect(result.workoutName).toBeNull();
  });

  it('no active program returns rest day', async () => {
    const userId = await seedTestUser(db);
    // No program seeded
    const result = await getCurrentWorkout(db, userId, 1);
    expect(result.restDay).toBe(true);
  });
});

describe('getCurrentWorkout — rotation program', () => {
  it('resolves by current index', async () => {
    const userId = await seedTestUser(db);
    await seedTestRotationPPL(db, userId);

    const result = await getCurrentWorkout(db, userId);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day'); // index 0
  });

  it('resolves to second workout when index is 1', async () => {
    const userId = await seedTestUser(db);
    await seedTestRotationPPL(db, userId);

    // Advance to index 1
    await db`UPDATE rotation_state SET current_index = 1 WHERE program_id = ${'prog-rotation-ppl'}`;

    const result = await getCurrentWorkout(db, userId);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Pull Day');
  });

  it('rotation always has a workout (never rest day)', async () => {
    const userId = await seedTestUser(db);
    await seedTestRotationPPL(db, userId);

    for (let i = 0; i < 3; i++) {
      await db`UPDATE rotation_state SET current_index = ${i} WHERE program_id = ${'prog-rotation-ppl'}`;
      const result = await getCurrentWorkout(db, userId);
      expect(result.restDay).toBe(false);
    }
  });

  it('returns rest day when no rotation state exists', async () => {
    const userId = await seedTestUser(db);
    await insertProgram(db, { id: 'prog-r-empty', user_id: userId, name: 'Empty', type: 'rotation' });
    // No rotation state, no schedules
    const result = await getCurrentWorkout(db, userId);
    expect(result.restDay).toBe(true);
  });
});

describe('Session completion advancing rotation pointer', () => {
  it('advances rotation pointer on session completion', async () => {
    const userId = await seedTestUser(db);
    await seedTestRotationPPL(db, userId);

    const session = await createSession(db, userId, 'rsched-push');
    await completeSession(db, session.id);

    const state = await getRotationState(db, userId, 'prog-rotation-ppl');
    expect(state!.current_index).toBe(1); // Advanced from 0 to 1
  });

  it('wraps around after completing last rotation entry', async () => {
    const userId = await seedTestUser(db);
    await seedTestRotationPPL(db, userId);

    // Set to last index
    await db`UPDATE rotation_state SET current_index = 2 WHERE program_id = ${'prog-rotation-ppl'}`;

    const session = await createSession(db, userId, 'rsched-legs');
    await completeSession(db, session.id);

    const state = await getRotationState(db, userId, 'prog-rotation-ppl');
    expect(state!.current_index).toBe(0); // Wrapped around
  });

  it('abandoned session does NOT advance rotation pointer', async () => {
    const userId = await seedTestUser(db);
    await seedTestRotationPPL(db, userId);

    const session = await createSession(db, userId, 'rsched-push');
    // Abandon the session
    await db`UPDATE sessions SET status = 'abandoned' WHERE id = ${session.id}`;

    // Now try completing — should not advance because status is already abandoned
    const session2 = await createSession(db, userId, 'rsched-push');
    await db`UPDATE sessions SET status = 'abandoned' WHERE id = ${session2.id}`;

    const state = await getRotationState(db, userId, 'prog-rotation-ppl');
    expect(state!.current_index).toBe(0); // Still at 0
  });

  it('does not advance for static program completion', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    const session = await createSession(db, userId, 'sched-mon-push');
    await completeSession(db, session.id);

    // No rotation state should exist for static programs
    const state = await getRotationState(db, userId, 'prog-static-ppl');
    expect(state).toBeUndefined();
  });
});
