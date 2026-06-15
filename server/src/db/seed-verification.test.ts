import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  getActiveProgram,
  getExercisesForWorkout,
  getWorkoutById,
  getRotationState,
  type DB,
} from './index.js';
import { createTestDatabase, setupTestSchema, resetTestData, closeTestPool } from './test-helpers.js';
import { getCurrentWorkout } from '../tools/getCurrentWorkout.js';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from '@jest/globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedSql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');

let db: DB;

beforeAll(async () => {
  db = createTestDatabase();
  await setupTestSchema();
});

beforeEach(async () => {
  await resetTestData();
  await db.unsafe(seedSql);
});

afterAll(async () => {
  await closeTestPool();
});

describe('seed data verification', () => {
  it('static PPL schedule resolves identically to pre-change behavior', async () => {
    const monday = await getCurrentWorkout(db, 'user-founder', 1);
    expect(monday.restDay).toBe(false);
    expect(monday.workoutName).toBe('Push Day');
    expect(monday.exercises).toHaveLength(5);
    expect(monday.exercises[0].name).toBe('Barbell Bench Press');

    const wednesday = await getCurrentWorkout(db, 'user-founder', 3);
    expect(wednesday.restDay).toBe(false);
    expect(wednesday.workoutName).toBe('Pull Day');
    expect(wednesday.exercises).toHaveLength(5);
    expect(wednesday.exercises[0].name).toBe('Deadlift');

    const friday = await getCurrentWorkout(db, 'user-founder', 5);
    expect(friday.restDay).toBe(false);
    expect(friday.workoutName).toBe('Legs Day');
    expect(friday.exercises).toHaveLength(5);
    expect(friday.exercises[0].name).toBe('Barbell Squat');
  });

  it('static program is active and rotation program is inactive', async () => {
    const program = await getActiveProgram(db, 'user-founder');
    expect(program).toBeDefined();
    expect(program!.type).toBe('static');
    expect(program!.name).toBe('PPL 3-Day Split');
  });

  it('rotation PPL seed exists with correct structure', async () => {
    const rotationSchedules = (await db`
      SELECT * FROM schedule WHERE program_id = 'prog-rotation-ppl' ORDER BY sort_order
    `) as unknown as Array<{ workout_id: string; day_of_week: number | null; sort_order: number }>;

    expect(rotationSchedules).toHaveLength(3);
    expect(rotationSchedules[0].day_of_week).toBeNull();
    expect(rotationSchedules[0].sort_order).toBe(0);
    expect(rotationSchedules[1].sort_order).toBe(1);
    expect(rotationSchedules[2].sort_order).toBe(2);

    const w0 = await getWorkoutById(db, rotationSchedules[0].workout_id);
    const w1 = await getWorkoutById(db, rotationSchedules[1].workout_id);
    const w2 = await getWorkoutById(db, rotationSchedules[2].workout_id);
    expect(w0!.name).toBe('Push Day');
    expect(w1!.name).toBe('Pull Day');
    expect(w2!.name).toBe('Legs Day');
  });

  it('rotation state initialized at index 0', async () => {
    const state = await getRotationState(db, 'user-founder', 'prog-rotation-ppl');
    expect(state).toBeDefined();
    expect(state!.current_index).toBe(0);
    expect(state!.last_completed_at).toBeNull();
  });

  it('rotation cycling works when activated', async () => {
    // Activate rotation, deactivate static
    await db`UPDATE programs SET active = 0 WHERE id = 'prog-static-ppl'`;
    await db`UPDATE programs SET active = 1 WHERE id = 'prog-rotation-ppl'`;

    const first = await getCurrentWorkout(db, 'user-founder');
    expect(first.workoutName).toBe('Push Day');

    // Simulate completion: advance rotation
    await db`UPDATE rotation_state SET current_index = 1 WHERE program_id = 'prog-rotation-ppl'`;

    const second = await getCurrentWorkout(db, 'user-founder');
    expect(second.workoutName).toBe('Pull Day');

    await db`UPDATE rotation_state SET current_index = 2 WHERE program_id = 'prog-rotation-ppl'`;

    const third = await getCurrentWorkout(db, 'user-founder');
    expect(third.workoutName).toBe('Legs Day');

    // Wrap around
    await db`UPDATE rotation_state SET current_index = 0 WHERE program_id = 'prog-rotation-ppl'`;

    const wrapped = await getCurrentWorkout(db, 'user-founder');
    expect(wrapped.workoutName).toBe('Push Day');
  });

  it('Smart Resolution: completed Push Day on Monday, Monday returns Pull Day instead', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Complete a session for Push Day this week
    const sessionId = 'sess-smart-test';
    await db`
      INSERT INTO sessions (id, user_id, schedule_id, started_at, completed_at, status)
      VALUES (${sessionId}, 'user-founder', 'sched-mon-push', now() - interval '1 day', now() - interval '1 day', 'completed')`;

    const result = await getCurrentWorkout(db, 'user-founder', 1, today); // Monday
    expect(result.restDay).toBe(false);
    expect(result.workoutName).toBe('Pull Day'); // Skipped Push Day
  });

  it('previous sessions are properly linked to schedules and workouts', async () => {
    const sessions = (await db`
      SELECT * FROM sessions WHERE user_id = 'user-founder' AND status = 'completed'
    `) as unknown as Array<{ schedule_id: string }>;
    expect(sessions.length).toBe(3);

    for (const session of sessions) {
      const [schedule] = (await db`SELECT * FROM schedule WHERE id = ${session.schedule_id}`) as unknown as Array<{ workout_id: string }>;
      expect(schedule).toBeDefined();

      const workout = await getWorkoutById(db, schedule!.workout_id);
      expect(workout).toBeDefined();

      const exercises = await getExercisesForWorkout(db, workout!.id);
      expect(exercises.length).toBeGreaterThan(0);
    }
  });
});
