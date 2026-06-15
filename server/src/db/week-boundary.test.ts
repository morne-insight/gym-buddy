import {
  getCompletedWorkoutsThisWeek,
  type DB,
} from './index.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestPPL,
} from './test-helpers.js';
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

/**
 * Inserts a completed session for the given schedule at a fixed timestamp.
 * `seedTestPPL` defines sched-mon-push (workout-push), sched-wed-pull
 * (workout-pull) and sched-fri-legs (workout-legs).
 */
async function completedSessionOn(userId: string, scheduleId: string, startedAt: string, id: string): Promise<void> {
  await db`
    INSERT INTO sessions (id, user_id, schedule_id, started_at, completed_at, status)
    VALUES (${id}, ${userId}, ${scheduleId}, ${startedAt}, ${startedAt}, 'completed')`;
}

// The prior SQLite query used DATE(ref, 'weekday 1', '-7 days') .. DATE(ref, 'weekday 1'),
// i.e. the window [Monday-of-ref's-week, next Monday) for a mid-week ref, and the
// *previous* ISO week for a Monday ref. These tests lock that exact behavior.
describe('getCompletedWorkoutsThisWeek — week boundary parity', () => {
  it('returns only workouts completed within the Monday-based current week', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    // ISO week of Wed 2026-06-10 is Mon 2026-06-08 .. Sun 2026-06-14 → window [06-08, 06-15)
    await completedSessionOn(userId, 'sched-mon-push', '2026-06-09 06:00:00', 'sess-in-week'); // Tue, in window
    await completedSessionOn(userId, 'sched-wed-pull', '2026-06-07 06:00:00', 'sess-prev-week'); // prev Sun, out
    await completedSessionOn(userId, 'sched-fri-legs', '2026-06-15 06:00:00', 'sess-next-week'); // next Mon, out

    const result = await getCompletedWorkoutsThisWeek(db, userId, '2026-06-10');
    expect(result).toEqual(['workout-push']);
  });

  it('includes a session on the first day (Monday) of the reference week', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    // ref Wed 2026-06-10 → window starts Mon 2026-06-08 00:00 (inclusive)
    await completedSessionOn(userId, 'sched-mon-push', '2026-06-08 00:00:00', 'sess-monday-start');

    const result = await getCompletedWorkoutsThisWeek(db, userId, '2026-06-10');
    expect(result).toEqual(['workout-push']);
  });

  it('matches the SQLite Monday-reference edge: a Monday ref looks at the previous week', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    // For ref = Mon 2026-06-15, SQLite's window is [2026-06-08, 2026-06-15):
    //   - Sun 2026-06-14 is INCLUDED (previous ISO week)
    //   - Mon 2026-06-15 itself is EXCLUDED
    await completedSessionOn(userId, 'sched-wed-pull', '2026-06-14 06:00:00', 'sess-prev-sun'); // included
    await completedSessionOn(userId, 'sched-mon-push', '2026-06-15 06:00:00', 'sess-this-mon'); // excluded

    const result = await getCompletedWorkoutsThisWeek(db, userId, '2026-06-15');
    expect(result).toEqual(['workout-pull']);
  });

  it('returns an empty array when nothing was completed in the window', async () => {
    const userId = await seedTestUser(db);
    await seedTestPPL(db, userId);

    await completedSessionOn(userId, 'sched-mon-push', '2026-05-01 06:00:00', 'sess-long-ago');

    const result = await getCompletedWorkoutsThisWeek(db, userId, '2026-06-10');
    expect(result).toEqual([]);
  });
});
