import { updateSentiment } from './updateSentiment.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestSchedule,
} from '../db/test-helpers.js';
import { createSession, getActiveSession, type DB } from '../db/index.js';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';

let db: DB;

beforeAll(async () => {
  db = createTestDatabase();
  await setupTestSchema();
});

beforeEach(async () => {
  await resetTestData();
  await seedTestPersona(db);
});

afterAll(async () => {
  await closeTestPool();
});

describe('updateSentiment', () => {
  it('updates sentiment on an active session by sessionId', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const result = await updateSentiment(db, {
      sessionId: session.id,
      sentiment: 'frustrated',
    });

    expect(result.updated).toBe(true);

    const active = await getActiveSession(db, userId);
    expect(active!.sentiment).toBe('frustrated');
  });

  it('finds active session by userId when sessionId is not provided', async () => {
    const userId = await seedTestUser(db);
    await createSession(db, userId, null);

    const result = await updateSentiment(db, {
      userId,
      sentiment: 'motivated',
    });

    expect(result.updated).toBe(true);

    const active = await getActiveSession(db, userId);
    expect(active!.sentiment).toBe('motivated');
  });

  it('fails when no session exists', async () => {
    const userId = await seedTestUser(db);

    const result = await updateSentiment(db, {
      userId,
      sentiment: 'tired',
    });

    expect(result.updated).toBe(false);
    expect(result.error).toMatch(/no active session/i);
  });

  it('overwrites previous sentiment', async () => {
    const userId = await seedTestUser(db);
    const session = await createSession(db, userId, null);

    await updateSentiment(db, { sessionId: session.id, sentiment: 'frustrated' });
    await updateSentiment(db, { sessionId: session.id, sentiment: 'energized' });

    const active = await getActiveSession(db, userId);
    expect(active!.sentiment).toBe('energized');
  });
});
