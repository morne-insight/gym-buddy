import { runEveningCheckIn } from './eveningCheckIn.js';
import {
  createTestDatabase,
  seedTestUser,
  seedTestPersona,
  seedTestRotationPPL,
} from '../db/test-helpers.js';
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

describe('evening check-in with rotation program', () => {
  it('peeks next workout without advancing pointer', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    // User missed today's workout (rotation at index 0 = Push Day)
    const today = new Date().toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 2);

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('missed_and_preview');
    expect(pending[0].content).toContain('Push Day'); // today's missed
    expect(pending[0].content).toContain('Pull Day'); // next up (peek)

    // Verify pointer didn't advance
    const state = db.prepare("SELECT * FROM rotation_state WHERE user_id = ?").get(userId) as { current_index: number };
    expect(state.current_index).toBe(0);
  });

  it('uses "Next up is" wording for rotation (not "Tomorrow is")', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    // Complete today's workout so we get pre_workout message
    const session = createSession(db, userId, 'rsched-push');
    completeSession(db, session.id);

    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 2);

    expect(result.messaged).toBe(1);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending[0].content).toContain('Next up is');
    expect(pending[0].content).not.toContain('Tomorrow is');
  });

  it('uses Buddy persona voice in messages', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    // User missed today
    const today = new Date().toISOString().split('T')[0];
    runEveningCheckIn(db, today, 1, 2);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);

    // The persona's example_no_show_reaction should be used
    expect(pending[0].content).toContain("You didn't show");
  });

  it('previews correct next workout after completion advances pointer', () => {
    const userId = seedTestUser(db);
    seedTestRotationPPL(db, userId);

    // Complete Push Day (index 0) — pointer advances to 1 (Pull Day)
    const session = createSession(db, userId, 'rsched-push');
    completeSession(db, session.id);

    // peek should show Legs Day (index 2, the one after current_index=1)
    const today = new Date(session.started_at).toISOString().split('T')[0];
    const result = runEveningCheckIn(db, today, 1, 2);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending[0].content).toContain('Legs Day');
  });
});
