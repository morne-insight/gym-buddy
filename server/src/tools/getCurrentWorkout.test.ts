import { getCurrentWorkout } from './getCurrentWorkout.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { insertSchedule, insertWorkoutExercise } from '../db/index.js';
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
    seedTestSchedule(db, userId); // Monday Push Day

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

  it('returns rest day when no workout is scheduled', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId); // Only Monday

    const result = getCurrentWorkout(db, userId, 0); // Sunday
    expect(result.restDay).toBe(true);
    expect(result.workoutName).toBeNull();
    expect(result.exercises).toEqual([]);
  });

  it('returns rest day for user with no schedule at all', () => {
    const userId = seedTestUser(db);

    const result = getCurrentWorkout(db, userId, 3); // Wednesday
    expect(result.restDay).toBe(true);
  });

  it('handles multiple workout days correctly', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId); // Monday Push Day

    insertSchedule(db, {
      id: 'sched-wed-pull',
      user_id: userId,
      day_of_week: 3,
      workout_name: 'Pull Day',
      scheduled_time: '06:00',
    });
    insertWorkoutExercise(db, {
      id: 'ex-deadlift',
      schedule_id: 'sched-wed-pull',
      exercise_name: 'Deadlift',
      exercise_db_id: null,
      sets: 4,
      reps: '5-6',
      rest_seconds: 180,
      sort_order: 1,
    });

    const monday = getCurrentWorkout(db, userId, 1);
    expect(monday.workoutName).toBe('Push Day');
    expect(monday.exercises).toHaveLength(3);

    const wednesday = getCurrentWorkout(db, userId, 3);
    expect(wednesday.workoutName).toBe('Pull Day');
    expect(wednesday.exercises).toHaveLength(1);
    expect(wednesday.exercises[0].name).toBe('Deadlift');
  });
});
