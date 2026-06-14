import { runEveningCheckIn } from './eveningCheckIn.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule, seedTestPPL } from '../db/test-helpers.js';
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

describe('runEveningCheckIn', () => {
  it('sends combined message when user missed today and has workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 3); // Monday missed, Wednesday next

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('missed_and_preview');
    expect(pending[0].content).toContain('Push Day');
    expect(pending[0].content).toContain('Pull Day');
    expect(pending[0].created_by).toBe('cron_evening');
  });

  it('sends missed-only message when no workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId); // Only Monday

    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 4); // Monday missed, Thursday no workout

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending[0].message_type).toBe('missed_workout');
    expect(pending[0].content).toContain('Push Day');
  });

  it('sends pre-workout-only message when today was completed', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);
    const session = createSession(db, userId, 'sched-mon-push');
    completeSession(db, session.id);

    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 3); // Monday completed, Wednesday next

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending[0].message_type).toBe('pre_workout');
    expect(pending[0].content).toContain('Get your gear ready');
    expect(pending[0].content).toContain('Pull Day');
  });

  it('skips when no workout today or tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId); // Only Monday

    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 4, 6); // Thursday, Saturday — no workouts

    expect(result.messaged).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('does not double-message for completed today + no workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId); // Only Monday
    const session = createSession(db, userId, 'sched-monday-push');
    completeSession(db, session.id);

    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 4); // Monday completed, Thursday no workout

    expect(result.messaged).toBe(0);
    expect(result.skipped).toBe(1);
  });
});
