/**
 * End-to-end smoke test against the real Supabase database.
 *
 *   npm run smoke
 *
 * Creates a throwaway rotation program, runs a full session (start → log sets →
 * complete exercise → complete session), asserts the rotation pointer advanced,
 * then deletes everything it created. Exits non-zero on any failure.
 */
import {
  createDatabase,
  closePool,
  insertUser,
  insertProgram,
  insertWorkout,
  insertWorkoutExercise,
  insertSchedule,
  insertRotationState,
  createSession,
  completeSession,
  getRotationState,
  getActiveSession,
  getExerciseLogsForSession,
  type DB,
} from '../db/index.js';
import { getCurrentWorkout } from '../tools/getCurrentWorkout.js';
import { logSetCompleted } from '../tools/logSetCompleted.js';
import { completeExercise } from '../tools/completeExercise.js';

const U = 'smoke-user';
const P = 'smoke-prog';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`Smoke assertion failed: ${msg}`);
}

async function cleanup(db: DB): Promise<void> {
  await db`DELETE FROM set_logs WHERE exercise_log_id IN (
            SELECT el.id FROM exercise_logs el JOIN sessions s ON el.session_id = s.id WHERE s.user_id = ${U})`;
  await db`DELETE FROM exercise_logs WHERE session_id IN (SELECT id FROM sessions WHERE user_id = ${U})`;
  await db`DELETE FROM sessions WHERE user_id = ${U}`;
  await db`DELETE FROM rotation_state WHERE user_id = ${U}`;
  await db`DELETE FROM schedule WHERE user_id = ${U}`;
  await db`DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE program_id = ${P})`;
  await db`DELETE FROM workouts WHERE program_id = ${P}`;
  await db`DELETE FROM programs WHERE id = ${P}`;
  await db`DELETE FROM users WHERE id = ${U}`;
}

async function main(): Promise<void> {
  const db = createDatabase();

  // Start clean in case a previous run aborted mid-way.
  await cleanup(db);

  await insertUser(db, {
    id: U, name: 'Smoke Tester', telegram_chat_id: null,
    persona_id: 'drill-sergeant', goal_description: null, goal_image_url: null,
    training_style: 'weightlifting',
  });
  await insertProgram(db, { id: P, user_id: U, name: 'Smoke Rotation', type: 'rotation' });

  for (const [i, name] of ['Push', 'Pull', 'Legs'].entries()) {
    await insertWorkout(db, { id: `${P}-w${i}`, program_id: P, name: `${name} Day` });
    await insertSchedule(db, {
      id: `${P}-s${i}`, user_id: U, program_id: P, workout_id: `${P}-w${i}`,
      day_of_week: null, scheduled_time: null, sort_order: i,
    });
    await insertWorkoutExercise(db, {
      id: `${P}-e${i}`, workout_id: `${P}-w${i}`, exercise_name: `${name} Lift`,
      exercise_db_id: null, sets: 2, reps: '8', rest_seconds: 60, sort_order: 1,
    });
  }
  await insertRotationState(db, { id: `${P}-rs`, user_id: U, program_id: P, current_index: 0 });

  // 1. Resolve today's workout (rotation index 0 → Push)
  const workout = await getCurrentWorkout(db, U);
  assert(!workout.restDay, 'expected a workout, got rest day');
  assert(workout.workoutName === 'Push Day', `expected Push Day, got ${workout.workoutName}`);
  console.log(`✓ getCurrentWorkout → ${workout.workoutName}`);

  // 2. Start a session
  const session = await createSession(db, U, workout.scheduleId);
  assert(session.status === 'in_progress', 'session should be in_progress');
  console.log(`✓ createSession → ${session.id}`);

  // 3. Log both sets of the first exercise
  const exId = workout.exercises[0].id;
  await logSetCompleted(db, { sessionId: session.id, exerciseId: exId, setNumber: 1, reps: 8, weight: 50 });
  const last = await logSetCompleted(db, { sessionId: session.id, exerciseId: exId, setNumber: 2, reps: 8, weight: 50 });
  assert(last.exerciseComplete, 'exercise should be complete after final set');
  console.log('✓ logSetCompleted x2 → exercise complete');

  // 4. Complete the exercise
  const ce = await completeExercise(db, { sessionId: session.id, exerciseId: exId });
  assert(ce.completed, 'completeExercise should report completed');
  const logs = await getExerciseLogsForSession(db, session.id);
  assert(logs.length === 1 && logs[0].completed === 1, 'one completed exercise log expected');
  console.log('✓ completeExercise');

  // 5. Complete the session → rotation advances 0 → 1
  await completeSession(db, session.id);
  const active = await getActiveSession(db, U);
  assert(active === undefined, 'no active session should remain');
  const state = await getRotationState(db, U, P);
  assert(state?.current_index === 1, `rotation should advance to 1, got ${state?.current_index}`);
  console.log('✓ completeSession → rotation advanced to index 1');

  await cleanup(db);
  console.log('\nSmoke test PASSED ✅ (cleaned up)');
}

main()
  .catch((err) => {
    console.error('\nSmoke test FAILED ❌');
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
