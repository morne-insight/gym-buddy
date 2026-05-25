import { getExerciseHistoryTool } from './getExerciseHistory.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from '../db/test-helpers.js';
import { createSession, logExercise, completeSession } from '../db/index.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('getExerciseHistoryTool', () => {
  it('returns history for a specific exercise across sessions', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const s1 = createSession(db, userId, 'sched-monday-push');
    logExercise(db, {
      session_id: s1.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,8',
      actual_weight: 75,
      notes: null,
    });
    completeSession(db, s1.id);

    const s2 = createSession(db, userId, 'sched-monday-push');
    logExercise(db, {
      session_id: s2.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,7',
      actual_weight: 80,
      notes: null,
    });
    completeSession(db, s2.id);

    const result = getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].weight).toBe(80);
    expect(result.entries[1].weight).toBe(75);
  });

  it('calculates skip frequency', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    for (let i = 0; i < 4; i++) {
      const s = createSession(db, userId, 'sched-monday-push');
      logExercise(db, {
        session_id: s.id,
        workout_exercise_id: 'ex-bench',
        completed: i < 3 ? 1 : 0,
        skipped: i < 3 ? 0 : 1,
        actual_sets: i < 3 ? 4 : null,
        actual_reps: i < 3 ? '8,8,8,8' : null,
        actual_weight: i < 3 ? 75 + i * 5 : null,
        notes: i === 3 ? 'Tired' : null,
      });
      completeSession(db, s.id);
    }

    const result = getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.entries).toHaveLength(4);
    expect(result.skipCount).toBe(1);
    expect(result.totalSessions).toBe(4);
  });

  it('calculates weight progression trend', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const weights = [70, 75, 77.5, 80];
    for (const w of weights) {
      const s = createSession(db, userId, 'sched-monday-push');
      logExercise(db, {
        session_id: s.id,
        workout_exercise_id: 'ex-bench',
        completed: 1,
        skipped: 0,
        actual_sets: 4,
        actual_reps: '8,8,8,8',
        actual_weight: w,
        notes: null,
      });
      completeSession(db, s.id);
    }

    const result = getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.weightTrend).toBe('increasing');
  });

  it('returns empty history for unknown exercise', () => {
    const userId = seedTestUser(db);

    const result = getExerciseHistoryTool(db, userId, 'Underwater Basket Weaving');
    expect(result.entries).toHaveLength(0);
    expect(result.skipCount).toBe(0);
    expect(result.totalSessions).toBe(0);
    expect(result.weightTrend).toBe('none');
  });

  it('detects decreasing weight trend', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const weights = [80, 77.5, 75, 70];
    for (const w of weights) {
      const s = createSession(db, userId, 'sched-monday-push');
      logExercise(db, {
        session_id: s.id,
        workout_exercise_id: 'ex-bench',
        completed: 1,
        skipped: 0,
        actual_sets: 4,
        actual_reps: '8,8,8,8',
        actual_weight: w,
        notes: null,
      });
      completeSession(db, s.id);
    }

    const result = getExerciseHistoryTool(db, userId, 'Bench Press');
    expect(result.weightTrend).toBe('decreasing');
  });
});
