import { scheduleMotivationalMessage } from './scheduleMotivationalMessage.js';
import { createTestDatabase, seedTestUser, seedTestPersona } from '../db/test-helpers.js';
import { getPendingMessages } from '../db/index.js';
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

describe('scheduleMotivationalMessage', () => {
  it('schedules a message with correct delivery time', () => {
    const userId = seedTestUser(db);
    const before = Date.now();

    const result = scheduleMotivationalMessage(db, {
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

  it('stores the context for later LLM generation', () => {
    const userId = seedTestUser(db);

    const result = scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 2,
      context: 'User said they want to quit',
    });

    expect(result.scheduled).toBe(true);

    const futureTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('motivation');
    expect(pending[0].content).toContain('User said they want to quit');
    expect(pending[0].created_by).toBe('voice_session');
  });

  it('rejects delivery times outside 1-24 hours', () => {
    const userId = seedTestUser(db);

    const tooSoon = scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 0.5,
      context: 'Too soon',
    });
    expect(tooSoon.scheduled).toBe(false);
    expect(tooSoon.error).toMatch(/1.*24/);

    const tooLate = scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 48,
      context: 'Too late',
    });
    expect(tooLate.scheduled).toBe(false);
    expect(tooLate.error).toMatch(/1.*24/);
  });

  it('accepts boundary values of 1 and 24 hours', () => {
    const userId = seedTestUser(db);

    const oneHour = scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 1,
      context: 'Minimum valid',
    });
    expect(oneHour.scheduled).toBe(true);

    const twentyFour = scheduleMotivationalMessage(db, {
      userId,
      deliverInHours: 24,
      context: 'Maximum valid',
    });
    expect(twentyFour.scheduled).toBe(true);
  });
});
