import {
  getUser,
  getScheduleForDay,
  getExercisesForWorkout,
  createSession,
  logExercise,
  getExerciseLogsForSession,
  getExerciseHistory,
  completeSession,
  scheduleMessage,
  getPendingMessages,
  markMessageDelivered,
  getActiveSession,
  updateUserTelegram,
  type DB,
} from './index.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestSchedule,
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

describe('schema', () => {
  it('creates all tables', async () => {
    const tables = (await db`
      SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `) as unknown as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('personas');
    expect(tableNames).toContain('programs');
    expect(tableNames).toContain('workouts');
    expect(tableNames).toContain('schedule');
    expect(tableNames).toContain('workout_exercises');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('exercise_logs');
    expect(tableNames).toContain('scheduled_messages');
    expect(tableNames).toContain('rotation_state');
  });
});

describe('users', () => {
  it('inserts and retrieves a user', async () => {
    const userId = await seedTestUser(db);
    const user = await getUser(db, userId);
    expect(user).toBeDefined();
    expect(user!.name).toBe('Test User');
    expect(user!.persona_id).toBe('drill-sergeant');
  });

  it('updates telegram chat ID', async () => {
    const userId = await seedTestUser(db);
    await updateUserTelegram(db, userId, '12345');
    const user = await getUser(db, userId);
    expect(user!.telegram_chat_id).toBe('12345');
  });
});

describe('schedule + exercises', () => {
  it('returns correct workout for day of week', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const schedule = await getScheduleForDay(db, userId, 1);
    expect(schedule).toBeDefined();
    expect(schedule!.workout_id).toBe('workout-push');

    const exercises = await getExercisesForWorkout(db, schedule!.workout_id);
    expect(exercises).toHaveLength(3);
    expect(exercises[0].exercise_name).toBe('Bench Press');
    expect(exercises[1].exercise_name).toBe('Overhead Press');
    expect(exercises[2].exercise_name).toBe('Dips');
  });

  it('returns undefined for rest day', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const schedule = await getScheduleForDay(db, userId, 0);
    expect(schedule).toBeUndefined();
  });
});

describe('sessions', () => {
  it('creates and completes a session', async () => {
    const userId = await seedTestUser(db);
    const session = await createSession(db, userId, null);
    expect(session.status).toBe('in_progress');

    await completeSession(db, session.id);
    const active = await getActiveSession(db, userId);
    expect(active).toBeUndefined();
  });
});

describe('exercise logs', () => {
  it('logs a completed exercise', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const log = await logExercise(db, {
      session_id: session.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,7,6',
      actual_weight: 80,
      notes: null,
    });

    expect(log.completed).toBe(1);
    expect(log.actual_weight).toBe(80);

    const logs = await getExerciseLogsForSession(db, session.id);
    expect(logs).toHaveLength(1);
  });

  it('logs a skipped exercise', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);
    const session = await createSession(db, userId, 'sched-monday-push');

    const log = await logExercise(db, {
      session_id: session.id,
      workout_exercise_id: 'ex-dips',
      completed: 0,
      skipped: 1,
      actual_sets: null,
      actual_reps: null,
      actual_weight: null,
      notes: 'Shoulder pain',
    });

    expect(log.skipped).toBe(1);
    expect(log.notes).toBe('Shoulder pain');
  });

  it('returns exercise history across sessions', async () => {
    const userId = await seedTestUser(db);
    await seedTestSchedule(db, userId);

    const session1 = await createSession(db, userId, 'sched-monday-push');
    await logExercise(db, {
      session_id: session1.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,8',
      actual_weight: 75,
      notes: null,
    });
    await completeSession(db, session1.id);

    const session2 = await createSession(db, userId, 'sched-monday-push');
    await logExercise(db, {
      session_id: session2.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,7',
      actual_weight: 80,
      notes: null,
    });

    const history = await getExerciseHistory(db, userId, 'Bench Press');
    expect(history).toHaveLength(2);
    expect(history[0].actual_weight).toBe(80);
    expect(history[1].actual_weight).toBe(75);
  });
});

describe('scheduled messages', () => {
  it('schedules and retrieves pending messages', async () => {
    const userId = await seedTestUser(db);

    await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'pre_workout',
      content: 'Gear packed?',
      image_url: null,
      created_by: 'cron',
    });

    const pending = await getPendingMessages(db, new Date().toISOString());
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe('Gear packed?');
  });

  it('marks message as delivered', async () => {
    const userId = await seedTestUser(db);

    const msg = await scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'motivation',
      content: 'Keep going',
      image_url: null,
      created_by: 'voice_session',
    });

    await markMessageDelivered(db, msg.id);
    const pending = await getPendingMessages(db, new Date().toISOString());
    expect(pending).toHaveLength(0);
  });
});
