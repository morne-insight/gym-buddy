import Database from 'better-sqlite3';
import { createInMemoryDatabase, insertUser, insertPersona, insertSchedule, insertWorkoutExercise } from './index.js';

export function createTestDatabase(): Database.Database {
  return createInMemoryDatabase();
}

export function seedTestUser(db: Database.Database, overrides?: Partial<{ id: string; name: string }>) {
  const userId = overrides?.id ?? 'test-user-1';
  insertUser(db, {
    id: userId,
    name: overrides?.name ?? 'Test User',
    telegram_chat_id: null,
    persona_id: 'drill-sergeant',
    goal_description: 'Get stronger',
    goal_image_url: null,
    training_style: 'weightlifting',
  });
  return userId;
}

export function seedTestPersona(db: Database.Database) {
  insertPersona(db, {
    id: 'drill-sergeant',
    name: 'The Drill Sergeant',
    description: 'Tough love, no excuses',
    system_prompt: 'You are a drill sergeant gym buddy.',
    tts_voice: 'cartesia-drill-sergeant',
    example_greeting: 'Look who showed up. Let\'s get after it.',
    example_skip_reaction: 'Stay mediocre then.',
    example_no_show_reaction: 'You didn\'t show. What happened?',
  });
}

export function seedTestSchedule(db: Database.Database, userId: string) {
  const scheduleId = 'sched-monday-push';
  insertSchedule(db, {
    id: scheduleId,
    user_id: userId,
    day_of_week: 1,
    workout_name: 'Push Day',
    scheduled_time: '06:00',
  });

  insertWorkoutExercise(db, {
    id: 'ex-bench',
    schedule_id: scheduleId,
    exercise_name: 'Bench Press',
    exercise_db_id: null,
    sets: 4,
    reps: '8-10',
    rest_seconds: 90,
    sort_order: 1,
  });

  insertWorkoutExercise(db, {
    id: 'ex-ohp',
    schedule_id: scheduleId,
    exercise_name: 'Overhead Press',
    exercise_db_id: null,
    sets: 3,
    reps: '10-12',
    rest_seconds: 90,
    sort_order: 2,
  });

  insertWorkoutExercise(db, {
    id: 'ex-dips',
    schedule_id: scheduleId,
    exercise_name: 'Dips',
    exercise_db_id: null,
    sets: 3,
    reps: 'to failure',
    rest_seconds: 60,
    sort_order: 3,
  });

  return scheduleId;
}
