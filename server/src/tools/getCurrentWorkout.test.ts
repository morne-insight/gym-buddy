import { getCurrentWorkout } from './getCurrentWorkout.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule, seedTestPPL } from '../db/test-helpers.js';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('getCurrentWorkout', () => {
  it('returns the workout for a scheduled day', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = getCurrentWorkout(db, userId, 1);
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day');
    expect(result.exercises).toHaveLength(3);
    expect(result.exercises[0]).toEqual({
      id: 'ex-bench',
      name: 'Bench Press',
      sets: 4,
      reps: '8-10',
      restSeconds: 90,
    });
  });

  it('returns exercises in sort order', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = getCurrentWorkout(db, userId, 1);
    expect(result.exercises[0].name).toBe('Bench Press');
    expect(result.exercises[1].name).toBe('Overhead Press');
    expect(result.exercises[2].name).toBe('Dips');
  });

  it('offers next unperformed workout on off-day (Smart Resolution)', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const result = getCurrentWorkout(db, userId, 0); // Sunday — no schedule, but Push Day unperformed
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Push Day');
  });

  it('returns rest day for user with no active program', () => {
    const userId = seedTestUser(db);

    const result = getCurrentWorkout(db, userId, 3);
    expect(result.restDay).toBe(true);
  });

  it('handles multiple workout days correctly', () => {
    const userId = seedTestUser(db);
    seedTestPPL(db, userId);

    const monday = getCurrentWorkout(db, userId, 1);
    expect(monday.workoutName).toBe('Push Day');
    expect(monday.exercises).toHaveLength(2);

    const wednesday = getCurrentWorkout(db, userId, 3);
    expect(wednesday.workoutName).toBe('Pull Day');
    expect(wednesday.exercises).toHaveLength(2);
    expect(wednesday.exercises[0].name).toBe('Deadlift');
  });
});
