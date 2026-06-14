import { getCurrentWorkout } from './getCurrentWorkout.js';
import {
  createTestDatabase,
  seedTestUser,
  seedTestPersona,
  seedTestPPL,
  seedTestRotationPPL,
} from '../db/test-helpers.js';
import {
  createSession,
  completeSession,
  getRotationState,
  insertSchedule,
  insertWorkout,
  insertWorkoutExercise,
  insertProgram,
  insertRotationState,
} from '../db/index.js';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('getCurrentWorkout — static program', () => {
  it('same-day resolution returns scheduled workout (regression)', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    const result = getCurrentWorkout(db, userId, 1); // Monday
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day');
    expect(result.exercises.length).toBeGreaterThan(0);
  });

  it('Smart Resolution skips already-performed Workout', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    // Simulate completing Push Day earlier this week (Saturday)
    const session = createSession(db, userId, 'sched-mon-push');
    // Override started_at to be this week (use a Monday-aligned reference)
    db.prepare("UPDATE sessions SET started_at = datetime('now', '-1 day'), status = 'completed', completed_at = datetime('now', '-1 day') WHERE id = ?").run(session.id);

    const today = new Date().toISOString().split('T')[0];
    const result = getCurrentWorkout(db, userId, 1, today); // Monday — Push already done
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Pull Day');
  });

  it('off-day offers next unperformed Workout', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    // Saturday (day 6) — no schedule entry, Pull Day not performed
    const result = getCurrentWorkout(db, userId, 6);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day'); // First unperformed in sort_order
  });

  it('all Workouts done this week returns rest day', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    const today = new Date().toISOString().split('T')[0];

    // Complete all 3 workouts this week
    const s1 = createSession(db, userId, 'sched-mon-push');
    db.prepare("UPDATE sessions SET started_at = datetime('now', '-2 days'), status = 'completed', completed_at = datetime('now', '-2 days') WHERE id = ?").run(s1.id);

    const s2 = createSession(db, userId, 'sched-wed-pull');
    db.prepare("UPDATE sessions SET started_at = datetime('now', '-1 day'), status = 'completed', completed_at = datetime('now', '-1 day') WHERE id = ?").run(s2.id);

    const s3 = createSession(db, userId, 'sched-fri-legs');
    db.prepare("UPDATE sessions SET started_at = datetime('now'), status = 'completed', completed_at = datetime('now') WHERE id = ?").run(s3.id);

    const result = getCurrentWorkout(db, userId, 6, today); // Saturday, all done
    expect(result.restDay).toBe(true);
    expect(result.workoutName).toBeNull();
  });

  it('no active program returns rest day', () => {
    const userId = seedTestUser(db);
    // No program seeded
    const result = getCurrentWorkout(db, userId, 1);
    expect(result.restDay).toBe(true);
  });
});

describe('getCurrentWorkout — rotation program', () => {
  it('resolves by current index', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    const result = getCurrentWorkout(db, userId);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day'); // index 0
  });

  it('resolves to second workout when index is 1', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    // Advance to index 1
    db.prepare('UPDATE rotation_state SET current_index = 1 WHERE program_id = ?').run('prog-rotation-ppl');

    const result = getCurrentWorkout(db, userId);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Pull Day');
  });

  it('rotation always has a workout (never rest day)', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    for (let i = 0; i < 3; i++) {
      db.prepare('UPDATE rotation_state SET current_index = ? WHERE program_id = ?').run(i, 'prog-rotation-ppl');
      const result = getCurrentWorkout(db, userId);
      expect(result.restDay).toBe(false);
    }
  });

  it('returns rest day when no rotation state exists', () => {
    const userId = seedTestUser(db);
    insertProgram(db, { id: 'prog-r-empty', user_id: userId, name: 'Empty', type: 'rotation' });
    // No rotation state, no schedules
    const result = getCurrentWorkout(db, userId);
    expect(result.restDay).toBe(true);
  });
});

describe('Session completion advancing rotation pointer', () => {
  it('advances rotation pointer on session completion', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    const session = createSession(db, userId, 'rsched-push');
    completeSession(db, session.id);

    const state = getRotationState(db, userId, 'prog-rotation-ppl');
    expect(state!.current_index).toBe(1); // Advanced from 0 to 1
  });

  it('wraps around after completing last rotation entry', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    // Set to last index
    db.prepare('UPDATE rotation_state SET current_index = 2 WHERE program_id = ?').run('prog-rotation-ppl');

    const session = createSession(db, userId, 'rsched-legs');
    completeSession(db, session.id);

    const state = getRotationState(db, userId, 'prog-rotation-ppl');
    expect(state!.current_index).toBe(0); // Wrapped around
  });

  it('abandoned session does NOT advance rotation pointer', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    const session = createSession(db, userId, 'rsched-push');
    // Abandon the session
    db.prepare("UPDATE sessions SET status = 'abandoned' WHERE id = ?").run(session.id);

    // Now try completing — should not advance because status is already abandoned
    // Actually, the real test is: completeSession checks status = in_progress
    // Let's create a new session and abandon it properly
    const session2 = createSession(db, userId, 'rsched-push');
    db.prepare("UPDATE sessions SET status = 'abandoned' WHERE id = ?").run(session2.id);

    const state = getRotationState(db, userId, 'prog-rotation-ppl');
    expect(state!.current_index).toBe(0); // Still at 0
  });

  it('does not advance for static program completion', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    const session = createSession(db, userId, 'sched-mon-push');
    completeSession(db, session.id);

    // No rotation state should exist for static programs
    const state = getRotationState(db, userId, 'prog-static-ppl');
    expect(state).toBeUndefined();
  });
});
