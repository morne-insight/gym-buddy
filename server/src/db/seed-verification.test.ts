import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations, getActiveProgram, getScheduleForDay, getExercisesForWorkout, getWorkoutById, getRotationState } from './index.js';
import { getCurrentWorkout } from '../tools/getCurrentWorkout.js';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  const seed = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  db.exec(seed);
});

afterEach(() => {
  db.close();
});

describe('seed data verification', () => {
  it('static PPL schedule resolves identically to pre-change behavior', () => {
    const monday = getCurrentWorkout(db, 'user-founder', 1);
    expect(monday.restDay).toBe(false);
    expect(monday.workoutName).toBe('Push Day');
    expect(monday.exercises).toHaveLength(5);
    expect(monday.exercises[0].name).toBe('Barbell Bench Press');

    const wednesday = getCurrentWorkout(db, 'user-founder', 3);
    expect(wednesday.restDay).toBe(false);
    expect(wednesday.workoutName).toBe('Pull Day');
    expect(wednesday.exercises).toHaveLength(5);
    expect(wednesday.exercises[0].name).toBe('Deadlift');

    const friday = getCurrentWorkout(db, 'user-founder', 5);
    expect(friday.restDay).toBe(false);
    expect(friday.workoutName).toBe('Legs Day');
    expect(friday.exercises).toHaveLength(5);
    expect(friday.exercises[0].name).toBe('Barbell Squat');
  });

  it('static program is active and rotation program is inactive', () => {
    const program = getActiveProgram(db, 'user-founder');
    expect(program).toBeDefined();
    expect(program!.type).toBe('static');
    expect(program!.name).toBe('PPL 3-Day Split');
  });

  it('rotation PPL seed exists with correct structure', () => {
    const rotationSchedules = db
      .prepare("SELECT * FROM schedule WHERE program_id = 'prog-rotation-ppl' ORDER BY sort_order")
      .all() as Array<{ workout_id: string; day_of_week: number | null; sort_order: number }>;

    expect(rotationSchedules).toHaveLength(3);
    expect(rotationSchedules[0].day_of_week).toBeNull();
    expect(rotationSchedules[0].sort_order).toBe(0);
    expect(rotationSchedules[1].sort_order).toBe(1);
    expect(rotationSchedules[2].sort_order).toBe(2);

    const w0 = getWorkoutById(db, rotationSchedules[0].workout_id);
    const w1 = getWorkoutById(db, rotationSchedules[1].workout_id);
    const w2 = getWorkoutById(db, rotationSchedules[2].workout_id);
    expect(w0!.name).toBe('Push Day');
    expect(w1!.name).toBe('Pull Day');
    expect(w2!.name).toBe('Legs Day');
  });

  it('rotation state initialized at index 0', () => {
    const state = getRotationState(db, 'user-founder', 'prog-rotation-ppl');
    expect(state).toBeDefined();
    expect(state!.current_index).toBe(0);
    expect(state!.last_completed_at).toBeNull();
  });

  it('rotation cycling works when activated', () => {
    // Activate rotation, deactivate static
    db.prepare("UPDATE programs SET active = 0 WHERE id = 'prog-static-ppl'").run();
    db.prepare("UPDATE programs SET active = 1 WHERE id = 'prog-rotation-ppl'").run();

    const first = getCurrentWorkout(db, 'user-founder');
    expect(first.workoutName).toBe('Push Day');

    // Simulate completion: advance rotation
    db.prepare("UPDATE rotation_state SET current_index = 1 WHERE program_id = 'prog-rotation-ppl'").run();

    const second = getCurrentWorkout(db, 'user-founder');
    expect(second.workoutName).toBe('Pull Day');

    db.prepare("UPDATE rotation_state SET current_index = 2 WHERE program_id = 'prog-rotation-ppl'").run();

    const third = getCurrentWorkout(db, 'user-founder');
    expect(third.workoutName).toBe('Legs Day');

    // Wrap around
    db.prepare("UPDATE rotation_state SET current_index = 0 WHERE program_id = 'prog-rotation-ppl'").run();

    const wrapped = getCurrentWorkout(db, 'user-founder');
    expect(wrapped.workoutName).toBe('Push Day');
  });

  it('Smart Resolution: completed Push Day on Monday, Monday returns Pull Day instead', () => {
    const today = new Date().toISOString().split('T')[0];

    // Complete a session for Push Day this week
    const sessionId = 'sess-smart-test';
    db.prepare(
      `INSERT INTO sessions (id, user_id, schedule_id, started_at, completed_at, status)
       VALUES (?, 'user-founder', 'sched-mon-push', datetime('now', '-1 day'), datetime('now', '-1 day'), 'completed')`,
    ).run(sessionId);

    const result = getCurrentWorkout(db, 'user-founder', 1, today); // Monday
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Pull Day'); // Skipped Push Day
  });

  it('previous sessions are properly linked to schedules and workouts', () => {
    const sessions = db.prepare("SELECT * FROM sessions WHERE user_id = 'user-founder' AND status = 'completed'").all() as Array<{ schedule_id: string }>;
    expect(sessions.length).toBe(3);

    for (const session of sessions) {
      const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(session.schedule_id) as { workout_id: string } | undefined;
      expect(schedule).toBeDefined();

      const workout = getWorkoutById(db, schedule!.workout_id);
      expect(workout).toBeDefined();

      const exercises = getExercisesForWorkout(db, workout!.id);
      expect(exercises.length).toBeGreaterThan(0);
    }
  });
});
