import { schedulePreWorkoutCheckIns } from './preWorkoutCheckIn.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
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

describe('schedulePreWorkoutCheckIns', () => {
  it('schedules a check-in when user has workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = schedulePreWorkoutCheckIns(db, 1);

    expect(result.scheduled).toBe(1);
    expect(result.skipped).toBe(0);

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const pending = getPendingMessages(db, futureTime);
    expect(pending).toHaveLength(1);
    expect(pending[0].message_type).toBe('pre_workout');
    expect(pending[0].content).toContain('Push Day');
    expect(pending[0].created_by).toBe('cron_pre_workout');
  });

  it('skips users with no workout tomorrow', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = schedulePreWorkoutCheckIns(db, 3);

    expect(result.scheduled).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('handles multiple users', () => {
    const user1 = seedTestUser(db, { id: 'user-a', name: 'User A' });
    const user2 = seedTestUser(db, { id: 'user-b', name: 'User B' });
    seedTestSchedule(db, user1);

    const result = schedulePreWorkoutCheckIns(db, 1);

    expect(result.checked).toBe(2);
    expect(result.scheduled).toBe(1);
    expect(result.skipped).toBe(1);
  });
});
