import { logExerciseCompleted } from './logExerciseCompleted.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, getExerciseLogsForSession, getActiveSession } from '../db/index.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('logExerciseCompleted', () => {
  it('logs a completed exercise with weight and reps', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const result = logExerciseCompleted(db, {
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

  it('logs a skipped exercise with a note', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const result = logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-dips',
      skipped: true,
      notes: 'Shoulder pain',
    });

    expect(result.logged).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.remaining).toBe(2);

    const logs = getExerciseLogsForSession(db, session.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].skipped).toBe(1);
    expect(logs[0].notes).toBe('Shoulder pain');
  });

  it('tracks remaining exercise count correctly', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const r1 = logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 80,
      skipped: false,
    });
    expect(r1.remaining).toBe(2);

    const r2 = logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-ohp',
      actualSets: 3,
      actualReps: '10,10,10',
      actualWeight: 40,
      skipped: false,
    });
    expect(r2.remaining).toBe(1);

    const r3 = logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-dips',
      skipped: true,
    });
    expect(r3.remaining).toBe(0);
  });

  it('auto-creates a session if none exists', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = logExerciseCompleted(db, {
      userId,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 75,
      skipped: false,
    });

    expect(result.logged).toBe(true);
    expect(result.sessionId).toBeDefined();

    const active = getActiveSession(db, userId);
    expect(active).toBeDefined();
  });

  it('prevents duplicate logging of the same exercise in a session', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 80,
      skipped: false,
    });

    const result = logExerciseCompleted(db, {
      sessionId: session.id,
      exerciseId: 'ex-bench',
      actualSets: 4,
      actualReps: '8,8,8,8',
      actualWeight: 85,
      skipped: false,
    });

    expect(result.alreadyLogged).toBe(true);
    const logs = getExerciseLogsForSession(db, session.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].actual_weight).toBe(80);
  });
});
