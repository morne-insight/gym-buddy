import {
  getUser,
  getScheduleForDay,
  getExercisesForSchedule,
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
} from './index.js';
import { createTestDatabase, seedTestUser, seedTestPersona, seedTestSchedule } from './test-helpers.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = createTestDatabase();
  seedTestPersona(db);
});

afterEach(() => {
  db.close();
});

describe('schema', () => {
  it('creates all tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('personas');
    expect(tableNames).toContain('schedule');
    expect(tableNames).toContain('workout_exercises');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('exercise_logs');
    expect(tableNames).toContain('scheduled_messages');
  });
});

describe('users', () => {
  it('inserts and retrieves a user', () => {
    const userId = seedTestUser(db);
    const user = getUser(db, userId);
    expect(user).toBeDefined();
    expect(user!.name).toBe('Test User');
    expect(user!.persona_id).toBe('drill-sergeant');
  });

  it('updates telegram chat ID', () => {
    const userId = seedTestUser(db);
    updateUserTelegram(db, userId, '12345');
    const user = getUser(db, userId);
    expect(user!.telegram_chat_id).toBe('12345');
  });
});

describe('schedule + exercises', () => {
  it('returns correct workout for day of week', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const schedule = getScheduleForDay(db, userId, 1);
    expect(schedule).toBeDefined();
    expect(schedule!.workout_name).toBe('Push Day');

    const exercises = getExercisesForSchedule(db, schedule!.id);
    expect(exercises).toHaveLength(3);
    expect(exercises[0].exercise_name).toBe('Bench Press');
    expect(exercises[1].exercise_name).toBe('Overhead Press');
    expect(exercises[2].exercise_name).toBe('Dips');
  });

  it('returns undefined for rest day', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const schedule = getScheduleForDay(db, userId, 0);
    expect(schedule).toBeUndefined();
  });
});

describe('sessions', () => {
  it('creates and completes a session', () => {
    const userId = seedTestUser(db);
    const session = createSession(db, userId, null);
    expect(session.status).toBe('in_progress');

    completeSession(db, session.id);
    const active = getActiveSession(db, userId);
    expect(active).toBeUndefined();
  });
});

describe('exercise logs', () => {
  it('logs a completed exercise', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const log = logExercise(db, {
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

    const logs = getExerciseLogsForSession(db, session.id);
    expect(logs).toHaveLength(1);
  });

  it('logs a skipped exercise', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);
    const session = createSession(db, userId, 'sched-monday-push');

    const log = logExercise(db, {
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

  it('returns exercise history across sessions', () => {
    const userId = seedTestUser(db);
    seedTestSchedule(db, userId);

    const session1 = createSession(db, userId, 'sched-monday-push');
    logExercise(db, {
      session_id: session1.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,8',
      actual_weight: 75,
      notes: null,
    });
    completeSession(db, session1.id);

    const session2 = createSession(db, userId, 'sched-monday-push');
    logExercise(db, {
      session_id: session2.id,
      workout_exercise_id: 'ex-bench',
      completed: 1,
      skipped: 0,
      actual_sets: 4,
      actual_reps: '8,8,8,7',
      actual_weight: 80,
      notes: null,
    });

    const history = getExerciseHistory(db, userId, 'Bench Press');
    expect(history).toHaveLength(2);
    expect(history[0].actual_weight).toBe(80);
    expect(history[1].actual_weight).toBe(75);
  });
});

describe('scheduled messages', () => {
  it('schedules and retrieves pending messages', () => {
    const userId = seedTestUser(db);

    scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'pre_workout',
      content: 'Gear packed?',
      image_url: null,
      created_by: 'cron',
    });

    const pending = getPendingMessages(db, new Date().toISOString());
    expect(pending).toHaveLength(1);
    expect(pending[0].content).toBe('Gear packed?');
  });

  it('marks message as delivered', () => {
    const userId = seedTestUser(db);

    const msg = scheduleMessage(db, {
      user_id: userId,
      deliver_at: new Date(Date.now() - 60000).toISOString(),
      message_type: 'motivation',
      content: 'Keep going',
      image_url: null,
      created_by: 'voice_session',
    });

    markMessageDelivered(db, msg.id);
    const pending = getPendingMessages(db, new Date().toISOString());
    expect(pending).toHaveLength(0);
  });
});
