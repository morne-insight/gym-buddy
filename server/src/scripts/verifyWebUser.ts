import { createDatabase, closePool, getActiveProgramDetail } from '../db/index.js';
import { getCurrentWorkout } from '../tools/getCurrentWorkout.js';

/**
 * Dev verification for the web onboarding/config slice (tasks 10.2 / 10.3).
 *
 * Prints the agent-compatible row tree for a web-configured user and then runs
 * the agent's Smart Workout Resolution (`getCurrentWorkout`) against it, so you
 * can confirm a freshly self-served Program resolves exactly like a seeded one.
 *
 *   npx tsx src/scripts/verifyWebUser.ts [userId]
 *
 * With no argument it picks the most recently created non-founder user that has
 * an active Program (i.e. the account you just onboarded through the web app).
 */
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

async function resolveUserId(db: ReturnType<typeof createDatabase>, argId?: string): Promise<string | undefined> {
  if (argId) return argId;
  const [row] = await db`
    SELECT u.id
    FROM users u
    JOIN programs p ON p.user_id = u.id AND p.active = 1
    WHERE u.id <> 'user-founder'
    ORDER BY u.created_at DESC
    LIMIT 1`;
  return row?.id as string | undefined;
}

async function main(): Promise<void> {
  const db = createDatabase();
  const userId = await resolveUserId(db, process.argv[2]);

  if (!userId) {
    console.log('No web-configured user found (no non-founder user with an active program).');
    console.log('Onboard + adopt a plan through the web app first, or pass a userId argument.');
    return;
  }

  const [user] = await db`SELECT id, name, persona_id, goal_description, goal_image_url, training_style FROM users WHERE id = ${userId}`;
  console.log('\n=== USER ===');
  console.log(user);

  const program = await getActiveProgramDetail(db, userId);
  if (!program) {
    console.log('\nUser has no active program.');
    return;
  }

  console.log(`\n=== ACTIVE PROGRAM: ${program.name} (${program.type}) ===`);
  console.log(`rotation_current_index: ${program.rotation_current_index}`);
  for (const w of program.workouts) {
    const when =
      program.type === 'static'
        ? `${w.day_of_week ? DAYS[w.day_of_week] : 'unscheduled'} ${w.scheduled_time ?? ''}`.trim()
        : `position ${w.sort_order}${w.scheduled_time ? ` @ ${w.scheduled_time}` : ''}`;
    console.log(`\n  • ${w.name}  [${when}]`);
    for (const e of w.exercises) {
      console.log(`      - ${e.exercise_name}: ${e.sets}x${e.reps}, rest ${e.rest_seconds}s`);
    }
  }

  console.log('\n=== getCurrentWorkout (Smart Workout Resolution) ===');
  if (program.type === 'static') {
    // Static plans resolve by weekday — probe each day so the result is
    // independent of when this script happens to run.
    for (let day = 1; day <= 7; day++) {
      const res = await getCurrentWorkout(db, userId, day);
      console.log(
        `  ${DAYS[day]}: ${res.restDay ? 'rest day' : `${res.workoutName} (${res.exercises.length} exercises)`}`,
      );
    }
  } else {
    const res = await getCurrentWorkout(db, userId);
    console.log(
      `  current: ${res.restDay ? 'rest day' : `${res.workoutName} (${res.exercises.length} exercises)`}`,
    );
  }

  console.log('\nDone. If a workout resolved above, the web-built plan is agent-compatible.');
}

main()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
