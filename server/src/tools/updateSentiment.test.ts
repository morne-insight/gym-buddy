import { updateSentiment } from './updateSentiment.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, getActiveSession } from '../db/index.js';
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

describe('updateSentiment', () => {
  it('updates sentiment on an active session by sessionId', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const result = updateSentiment(db, {
      sessionId: session.id,
      sentiment: 'frustrated',
    });

    expect(result.updated).toBe(true);

    const active = getActiveSession(db, userId);
    expect(active!.sentiment).toBe('frustrated');
  });

  it('finds active session by userId when sessionId is not provided', () => {
    const userId = seedTestUser(db);
    createSession(db, userId, null);

    const result = updateSentiment(db, {
      userId,
      sentiment: 'motivated',
    });

    expect(result.updated).toBe(true);

    const active = getActiveSession(db, userId);
    expect(active!.sentiment).toBe('motivated');
  });

  it('fails when no session exists', () => {
    const userId = seedTestUser(db);

    const result = updateSentiment(db, {
      userId,
      sentiment: 'tired',
    });

    expect(result.updated).toBe(false);
    expect(result.error).toMatch(/no active session/i);
  });

  it('overwrites previous sentiment', () => {
    const userId = seedTestUser(db);
    const session = createSession(db, userId, null);

    updateSentiment(db, { sessionId: session.id, sentiment: 'frustrated' });
    updateSentiment(db, { sessionId: session.id, sentiment: 'energized' });

    const active = getActiveSession(db, userId);
    expect(active!.sentiment).toBe('energized');
  });
});
