import Database from 'better-sqlite3';
import {
  createInMemoryDatabase,
  insertUser,
  insertPersona,
  insertProgram,
  insertWorkout,
  insertSchedule,
  insertWorkoutExercise,
  insertRotationState,
} from './index.js';

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
  const programId = 'prog-static-test';
  const workoutId = 'workout-push';
  const scheduleId = 'sched-monday-push';

  insertProgram(db, {
    id: programId,
    user_id: userId,
    name: 'Test PPL',
    type: 'static',
  });

  insertWorkout(db, {
    id: workoutId,
    program_id: programId,
    name: 'Push Day',
  });

  insertSchedule(db, {
    id: scheduleId,
    user_id: userId,
    program_id: programId,
    workout_id: workoutId,
    day_of_week: 1,
    scheduled_time: '06:00',
    sort_order: 0,
  });

  insertWorkoutExercise(db, {
    id: 'ex-bench',
    workout_id: workoutId,
    exercise_name: 'Bench Press',
    exercise_db_id: null,
    sets: 4,
    reps: '8-10',
    rest_seconds: 90,
    sort_order: 1,
  });

  insertWorkoutExercise(db, {
    id: 'ex-ohp',
    workout_id: workoutId,
    exercise_name: 'Overhead Press',
    exercise_db_id: null,
    sets: 3,
    reps: '10-12',
    rest_seconds: 90,
    sort_order: 2,
  });

  insertWorkoutExercise(db, {
    id: 'ex-dips',
    workout_id: workoutId,
    exercise_name: 'Dips',
    exercise_db_id: null,
    sets: 3,
    reps: 'to failure',
    rest_seconds: 60,
    sort_order: 3,
  });

  return scheduleId;
}

export function seedTestPPL(db: Database.Database, userId: string) {
  const programId = 'prog-static-ppl';

  insertProgram(db, {
    id: programId,
    user_id: userId,
    name: 'PPL Static',
    type: 'static',
  });

  const workouts = [
    { id: 'workout-push', name: 'Push Day' },
    { id: 'workout-pull', name: 'Pull Day' },
    { id: 'workout-legs', name: 'Legs Day' },
  ];

  for (const w of workouts) {
    insertWorkout(db, { id: w.id, program_id: programId, name: w.name });
  }

  insertSchedule(db, {
    id: 'sched-mon-push',
    user_id: userId,
    program_id: programId,
    workout_id: 'workout-push',
    day_of_week: 1,
    scheduled_time: '06:00',
    sort_order: 0,
  });

  insertSchedule(db, {
    id: 'sched-wed-pull',
    user_id: userId,
    program_id: programId,
    workout_id: 'workout-pull',
    day_of_week: 3,
    scheduled_time: '06:00',
    sort_order: 1,
  });

  insertSchedule(db, {
    id: 'sched-fri-legs',
    user_id: userId,
    program_id: programId,
    workout_id: 'workout-legs',
    day_of_week: 5,
    scheduled_time: '06:00',
    sort_order: 2,
  });

  insertWorkoutExercise(db, { id: 'ex-bench', workout_id: 'workout-push', exercise_name: 'Bench Press', exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 1 });
  insertWorkoutExercise(db, { id: 'ex-ohp', workout_id: 'workout-push', exercise_name: 'Overhead Press', exercise_db_id: null, sets: 3, reps: '10-12', rest_seconds: 90, sort_order: 2 });

  insertWorkoutExercise(db, { id: 'ex-deadlift', workout_id: 'workout-pull', exercise_name: 'Deadlift', exercise_db_id: null, sets: 4, reps: '5-6', rest_seconds: 180, sort_order: 1 });
  insertWorkoutExercise(db, { id: 'ex-row', workout_id: 'workout-pull', exercise_name: 'Barbell Row', exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 2 });

  insertWorkoutExercise(db, { id: 'ex-squat', workout_id: 'workout-legs', exercise_name: 'Barbell Squat', exercise_db_id: null, sets: 4, reps: '6-8', rest_seconds: 180, sort_order: 1 });
  insertWorkoutExercise(db, { id: 'ex-rdl', workout_id: 'workout-legs', exercise_name: 'Romanian Deadlift', exercise_db_id: null, sets: 3, reps: '8-10', rest_seconds: 120, sort_order: 2 });

  return programId;
}

export function seedTestRotationPPL(db: Database.Database, userId: string) {
  const programId = 'prog-rotation-ppl';

  insertProgram(db, {
    id: programId,
    user_id: userId,
    name: 'PPL Rotation',
    type: 'rotation',
  });

  const workouts = [
    { id: 'rworkout-push', name: 'Push Day' },
    { id: 'rworkout-pull', name: 'Pull Day' },
    { id: 'rworkout-legs', name: 'Legs Day' },
  ];

  for (const w of workouts) {
    insertWorkout(db, { id: w.id, program_id: programId, name: w.name });
  }

  insertSchedule(db, {
    id: 'rsched-push',
    user_id: userId,
    program_id: programId,
    workout_id: 'rworkout-push',
    day_of_week: null,
    scheduled_time: null,
    sort_order: 0,
  });

  insertSchedule(db, {
    id: 'rsched-pull',
    user_id: userId,
    program_id: programId,
    workout_id: 'rworkout-pull',
    day_of_week: null,
    scheduled_time: null,
    sort_order: 1,
  });

  insertSchedule(db, {
    id: 'rsched-legs',
    user_id: userId,
    program_id: programId,
    workout_id: 'rworkout-legs',
    day_of_week: null,
    scheduled_time: null,
    sort_order: 2,
  });

  insertWorkoutExercise(db, { id: 'rex-bench', workout_id: 'rworkout-push', exercise_name: 'Bench Press', exercise_db_id: null, sets: 4, reps: '8-10', rest_seconds: 90, sort_order: 1 });
  insertWorkoutExercise(db, { id: 'rex-deadlift', workout_id: 'rworkout-pull', exercise_name: 'Deadlift', exercise_db_id: null, sets: 4, reps: '5-6', rest_seconds: 180, sort_order: 1 });
  insertWorkoutExercise(db, { id: 'rex-squat', workout_id: 'rworkout-legs', exercise_name: 'Barbell Squat', exercise_db_id: null, sets: 4, reps: '6-8', rest_seconds: 180, sort_order: 1 });

  insertRotationState(db, {
    id: 'rstate-1',
    user_id: userId,
    program_id: programId,
    current_index: 0,
  });

  return programId;
}
