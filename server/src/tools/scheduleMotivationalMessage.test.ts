import { scheduleMotivationalMessage } from './scheduleMotivationalMessage.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
} from '../db/test-helpers.js';
import { getPendingMessages, type DB } from '../db/index.js';
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

describe('scheduleMotivationalMessage', () => {
  it('schedules a message with correct delivery time', async () => {
    const userId = await seedTestUser(db);
    const before = Date.now();

    const result = await scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 3,
      context: 'User was frustrated with bench press plateau',
    });

    expect(result.scheduled).toBe(true);
    expect(result.messageId).toBeDefined();

    const deliverAt = new Date(result.deliverAt!).getTime();
    const expectedMin = before + 3 * 60 * 60 * 1000 - 1000;
    const expectedMax = before + 3 * 60 * 60 * 1000 + 5000;
    expect(deliverAt).toBeGreaterThanOrEqual(expectedMin);
    expect(deliverAt).toBeLessThanOrEqual(expectedMax);
  });

  it('stores the context for later LLM generation', async () => {
    const userId = await seedTestUser(db);

    const result = await scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 2,
      context: 'User said they want to quit',
    });

    expect(result.scheduled).toBe(true);

    const futureTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const pending = await getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('motivation');
    expect(pending[0].content).toContain('User said they want to quit');
    expect(pending[0].created_by).toBe('voice_session');
  });

  it('rejects delivery times outside 1-24 hours', async () => {
    const userId = await seedTestUser(db);

    const tooSoon = await scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 0.5,
      context: 'Too soon',
    });
    expect(tooSoon.scheduled).toBe(false);
    expect(tooSoon.error).toMatch(/1.*24/);

    const tooLate = await scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 48,
      context: 'Too late',
    });
    expect(tooLate.scheduled).toBe(false);
    expect(tooLate.error).toMatch(/1.*24/);
  });

  it('accepts boundary values of 1 and 24 hours', async () => {
    const userId = await seedTestUser(db);

    const oneHour = await scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 1,
      context: 'Minimum valid',
    });
    expect(oneHour.scheduled).toBe(true);

    const twentyFour = await scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 24,
      context: 'Maximum valid',
    });
    expect(twentyFour.scheduled).toBe(true);
  });
});
