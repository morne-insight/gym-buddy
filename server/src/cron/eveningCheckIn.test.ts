import { runEveningCheckIn } from './eveningCheckIn.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, completeSession, getPendingMessages, insertSchedule } from '../db/index.js';
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

describe('runEveningCheckIn', () => {
  it('sends combined message when user missed today and has workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    insertSchedule(db, {
      id: 'sched-tuesday-pull',
      user_id: userId,
      day_of_week: 2,
      workout_name: 'Pull Day',
      scheduled_time: '06:00',
    });

    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 2);

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('missed_and_preview');
    expect(pending[0].content).toContain("didn't show");
    expect(pending[0].content).toContain('Get your gear ready');
    expect(pending[0].created_by).toBe('cron_evening');
  });

  it('sends missed-only message when no workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 4);

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending[0].message_type).toBe('missed_workout');
    expect(pending[0].content).toContain("didn't show up");
  });

  it('sends pre-workout-only message when today was completed', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');
    completeSession(db, session.id);

    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 1);

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending[0].message_type).toBe('pre_workout');
    expect(pending[0].content).toContain('Get your gear ready');
  });

  it('skips when no workout today or tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 4, 5);

    expect(result.messaged).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('does not double-message for completed today + no workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');
    completeSession(db, session.id);

    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 4);

    expect(result.messaged).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
