import { logSetCompleted } from './logSetCompleted.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, getSetLogsForExercise, getExerciseLogForWorkoutExercise } from '../db/index.js';
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

describe('logSetCompleted', () => {
  it('creates parent exercise_log on first set', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const result = logSetCompleted(db, {
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

    const exerciseLog = getExerciseLogForWorkoutExercise(db, session.id, 'ex-bench');
    expect(exerciseLog).toBeDefined();
  });

  it('appends subsequent sets to existing exercise_log', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 1,
      reps: 10,
      weight: 80,
    });

    const result = logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 2,
      reps: 8,
      weight: 80,
    });

    expect(result.logged).toBe(true);
    expect(result.setNumber).toBe(2);
    expect(result.exerciseComplete).toBe(false);

    const exerciseLog = getExerciseLogForWorkoutExercise(db, session.id, 'ex-bench');
    const setLogs = getSetLogsForExercise(db, exerciseLog!.id);
    expect(setLogs).toHaveLength(2);
    expect(setLogs[0].reps).toBe(10);
    expect(setLogs[1].reps).toBe(8);
  });

  it('marks exercise complete on final set', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    for (let i = 1; i <= 3; i++) {
      logSetCompleted(db, {
        sessionId: session.id,
        exerciseId: 'ex-bench',
        setNumber: i,
        reps: 8,
        weight: 80,
      });
    }

    const result = logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 4,
      reps: 6,
      weight: 80,
    });

    expect(result.exerciseComplete).toBe(true);
    expect(result.totalSets).toBe(4);
  });

  it('tracks remaining exercises correctly', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const result = logSetCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      setNumber: 1,
      reps: 10,
      weight: 80,
    });

    // Bench not complete yet, so all 3 exercises still remaining
    expect(result.remainingExercises).toBe(3);
  });

  it('auto-creates session if none exists', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = logSetCompleted(db, {
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
