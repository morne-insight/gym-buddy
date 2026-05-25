import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from './test-helpers.js';
import { createSession, logExercise, getSetLogsForExercise } from './index.js';
import { migrateToSetLogs } from './migrate-set-logs.js';
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

describe('migrateToSetLogs', () => {
  it('converts comma-separated reps into individual set_logs rows', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    logExercise(db, {
      session_id: session.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '10,8,8,6',
      actual_weight: 80,
      notes: null,
    });

    migrateToSetLogs(db);

    const exerciseLogs = db
      .prepare('SELECT id FROM exercise_logs WHERE session_id = ?')
      .all(session.id) as Array<{ id: string }>;

    const setLogs = getSetLogsForExercise(db, exerciseLogs[0].id);
    expect(setLogs).toHaveLength(4);
    expect(setLogs[0].set_number).toBe(1);
    expect(setLogs[0].reps).toBe(10);
    expect(setLogs[0].weight).toBe(80);
    expect(setLogs[1].set_number).toBe(2);
    expect(setLogs[1].reps).toBe(8);
    expect(setLogs[2].reps).toBe(8);
    expect(setLogs[3].set_number).toBe(4);
    expect(setLogs[3].reps).toBe(6);
  });

  it('handles exercise logs with only actual_sets (no reps string)', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    logExercise(db, {
      session_id: session.id,
      workout_exercise_id: 'ex-dips',
      completed: 1,
      skipped: 0,
      actual_sets: 3,
      actual_reps: null,
      actual_weight: null,
      notes: null,
    });

    migrateToSetLogs(db);

    const exerciseLogs = db
      .prepare('SELECT id FROM exercise_logs WHERE session_id = ?')
      .all(session.id) as Array<{ id: string }>;

    const setLogs = getSetLogsForExercise(db, exerciseLogs[0].id);
    expect(setLogs).toHaveLength(3);
    expect(setLogs[0].reps).toBe(0);
    expect(setLogs[0].weight).toBeNull();
  });

  it('is idempotent - running twice does not duplicate rows', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    logExercise(db, {
      session_id: session.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 2,
      actual_reps: '10,10',
      actual_weight: 60,
      notes: null,
    });

    migrateToSetLogs(db);
    migrateToSetLogs(db);

    const exerciseLogs = db
      .prepare('SELECT id FROM exercise_logs WHERE session_id = ?')
      .all(session.id) as Array<{ id: string }>;

    const setLogs = getSetLogsForExercise(db, exerciseLogs[0].id);
    expect(setLogs).toHaveLength(2);
  });
});
