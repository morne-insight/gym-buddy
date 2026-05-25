import { completeExercise } from './completeExercise.js';
import { logSetCompleted } from './logSetCompleted.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, getExerciseLogForWorkoutExercise } from '../db/index.js';
import type Database from 'better-sqlite3';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('completeExercise', () => {
  it('marks exercise as completed', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    // Log all sets first
    for (let i = 1; i <= 4; i++) {
      logSetCompleted(db, {
        sessionId: session.id,
        exerciseId: 'ex-bench',
        setNumber: i,
        reps: 8,
        weight: 80,
      });
    }

    const result = completeExercise(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
    });

    expect(result.completed).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.exerciseName).toBe('Bench Press');
    expect(result.remainingExercises).toBe(2);

    const log = getExerciseLogForWorkoutExercise(db, session.id, 'ex-bench');
    expect(log!.completed).toBe(1);
    expect(log!.completed_at).toBeTruthy();
  });

  it('returns correct remaining count', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    // Complete bench
    logSetCompleted(db, { sessionId: session.id, exerciseId: 'ex-bench', setNumber: 1, reps: 8, weight: 80 });
    completeExercise(db, { sessionId: session.id, exerciseId: 'ex-bench' });

    // Complete OHP
    logSetCompleted(db, { sessionId: session.id, exerciseId: 'ex-ohp', setNumber: 1, reps: 10, weight: 40 });
    const result = completeExercise(db, { sessionId: session.id, exerciseId: 'ex-ohp' });

    expect(result.remainingExercises).toBe(1);
    expect(result.workoutComplete).toBe(false);
  });

  it('returns workoutComplete when last exercise done', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    completeExercise(db, { sessionId: session.id, exerciseId: 'ex-bench' });
    completeExercise(db, { sessionId: session.id, exerciseId: 'ex-ohp' });
    const result = completeExercise(db, { sessionId: session.id, exerciseId: 'ex-dips' });

    expect(result.workoutComplete).toBe(true);
    expect(result.remainingExercises).toBe(0);
  });

  it('marks exercise as skipped when skipped flag is true', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const result = completeExercise(db, {
      sessionId: session.id,
      exerciseId: 'ex-dips',
      skipped: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.completed).toBe(false);

    const log = getExerciseLogForWorkoutExercise(db, session.id, 'ex-dips');
    expect(log!.skipped).toBe(1);
  });
});
