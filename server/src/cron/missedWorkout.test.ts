import { detectMissedWorkouts } from './missedWorkout.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, completeSession, getPendingMessages } from '../db/index.js';
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

describe('detectMissedWorkouts', () => {
  it('detects missed workout when no session logged', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const today = new Date().toISOString().split('T')[0];
    const result = detectMissedWorkouts(db, today, 1);

    expect(result.missed).toBe(1);
    expect(result.completed).toBe(0);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('missed_workout');
    expect(pending[0].content).toContain('Push Day');
    expect(pending[0].content).toContain("didn't show up");
    expect(pending[0].created_by).toBe('cron_missed_workout');
  });

  it('does not flag completed workouts', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');
    completeSession(db, session.id);

    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = detectMissedWorkouts(db, today, 1);

    expect(result.missed).toBe(0);
    expect(result.completed).toBe(1);
  });

  it('skips rest days', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const today = new Date().toISOString().split('T')[0];
    const result = detectMissedWorkouts(db, today, 3);

    expect(result.missed).toBe(0);
    expect(result.noWorkout).toBe(1);
  });

  it('counts in-progress sessions as completed', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    createSession(db, userId, 'sched-monday-push');

    const today = new Date().toISOString().split('T')[0];
    const result = detectMissedWorkouts(db, today, 1);

    expect(result.missed).toBe(0);
    expect(result.completed).toBe(1);
  });
});
