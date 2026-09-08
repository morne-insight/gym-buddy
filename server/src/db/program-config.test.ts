import {
  provisionUser,
  updateUserProfile,
  setGoalImageUrl,
  getUser,
  adoptTemplate,
  getActiveProgramDetail,
  addWorkout,
  renameWorkout,
  removeWorkout,
  reorderWorkouts,
  addExercise,
  updateExercise,
  removeExercise,
  reorderExercises,
  setSchedule,
  switchProgramType,
  getSchedulesByProgram,
  getRotationState,
  getExercisesForWorkout,
  NotFoundError,
  DomainValidationError,
  type DB,
} from './index.js';
import {
  createTestDatabase,
  setupTestSchema,
  resetTestData,
  closeTestPool,
  seedTestUser,
  seedTestPersona,
  seedTestTemplates,
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

describe('provisionUser (identity provisioning)', () => {
  it('creates a domain user row keyed by the auth sub on first call', async () => {
    const user = await provisionUser(db, 'auth-sub-123');
    expect(user.id).toBe('auth-sub-123');
    expect(await getUser(db, 'auth-sub-123')).toBeDefined();
  });

  it('is idempotent — repeated calls do not create duplicates or wipe the profile', async () => {
    await provisionUser(db, 'auth-sub-123');
    await updateUserProfile(db, 'auth-sub-123', {
      name: 'Ada',
      persona_id: 'drill-sergeant',
      goal_description: 'Get strong',
      training_style: 'weightlifting',
    });

    const again = await provisionUser(db, 'auth-sub-123');
    expect(again.name).toBe('Ada'); // not reset to ''
  });
});

describe('profile read/update', () => {
  it('persists profile fields on the caller row', async () => {
    const userId = await provisionUser(db, 'sub-1').then((u) => u.id);
    const updated = await updateUserProfile(db, userId, {
      name: 'Grace',
      persona_id: 'drill-sergeant',
      goal_description: null,
      training_style: 'weightlifting',
    });
    expect(updated.name).toBe('Grace');
    expect(updated.persona_id).toBe('drill-sergeant');
    expect(updated.goal_description).toBeNull();
  });

  it('sets the goal image url', async () => {
    const userId = await provisionUser(db, 'sub-1').then((u) => u.id);
    const updated = await setGoalImageUrl(db, userId, 'goal-images/sub-1/pic.jpg');
    expect(updated.goal_image_url).toBe('goal-images/sub-1/pic.jpg');
  });
});

describe('workout CRUD on the active program', () => {
  it('adds a workout with an appended schedule slot', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);

    const workoutId = await addWorkout(db, userId, 'Arms');
    const program = await getActiveProgramDetail(db, userId);
    const arms = program!.workouts.find((w) => w.id === workoutId);
    expect(arms).toBeDefined();
    expect(arms!.name).toBe('Arms');
    expect(program!.workouts).toHaveLength(4);
  });

  it('renames a workout', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const target = program!.workouts[0];

    await renameWorkout(db, userId, target.id, 'Heavy Push');
    const after = await getActiveProgramDetail(db, userId);
    expect(after!.workouts.find((w) => w.id === target.id)!.name).toBe('Heavy Push');
  });

  it('removes a workout and cascades its exercises and schedule entry', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const target = program!.workouts.find((w) => w.name === 'Push Day')!;

    await removeWorkout(db, userId, target.id);

    const after = await getActiveProgramDetail(db, userId);
    expect(after!.workouts.find((w) => w.id === target.id)).toBeUndefined();
    expect(after!.workouts).toHaveLength(2);
    expect(await getExercisesForWorkout(db, target.id)).toHaveLength(0);
    // Remaining schedule entries re-packed to contiguous order.
    expect(after!.workouts.map((w) => w.sort_order)).toEqual([0, 1]);
  });

  it('reorders workouts', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const ids = program!.workouts.map((w) => w.id);
    const reversed = [...ids].reverse();

    await reorderWorkouts(db, userId, reversed);
    const after = await getActiveProgramDetail(db, userId);
    expect(after!.workouts.map((w) => w.id)).toEqual(reversed);
  });

  it("cannot touch another user's workout (treated as not found)", async () => {
    const owner = await seedTestUser(db, { id: 'owner' });
    const intruder = await seedTestUser(db, { id: 'intruder' });
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, owner, staticId);
    const program = await getActiveProgramDetail(db, owner);
    const victimWorkout = program!.workouts[0].id;

    await expect(renameWorkout(db, intruder, victimWorkout, 'hacked')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('rejects a reorder that is not the full workout set', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);

    await expect(
      reorderWorkouts(db, userId, [program!.workouts[0].id]),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });
});

describe('exercise CRUD within a workout', () => {
  it('adds an exercise with the given prescription', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const workout = program!.workouts[0];

    const exId = await addExercise(db, userId, {
      workout_id: workout.id,
      exercise_name: 'Bicep Curl',
      sets: 3,
      reps: '10-12',
    });

    const exercises = await getExercisesForWorkout(db, workout.id);
    const added = exercises.find((e) => e.id === exId)!;
    expect(added.exercise_name).toBe('Bicep Curl');
    expect(added.sets).toBe(3);
    expect(added.reps).toBe('10-12');
    expect(added.rest_seconds).toBe(90); // default
  });

  it('updates only the provided fields', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const ex = program!.workouts[0].exercises[0];

    await updateExercise(db, userId, { exercise_id: ex.id, sets: 5 });
    const exercises = await getExercisesForWorkout(db, program!.workouts[0].id);
    const updated = exercises.find((e) => e.id === ex.id)!;
    expect(updated.sets).toBe(5);
    expect(updated.exercise_name).toBe(ex.exercise_name); // unchanged
  });

  it('removes an exercise', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const workout = program!.workouts[0];
    const ex = workout.exercises[0];

    await removeExercise(db, userId, ex.id);
    const exercises = await getExercisesForWorkout(db, workout.id);
    expect(exercises.find((e) => e.id === ex.id)).toBeUndefined();
  });

  it('reorders exercises within a workout', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    await adoptTemplate(db, userId, staticId);
    const program = await getActiveProgramDetail(db, userId);
    const workout = program!.workouts.find((w) => w.exercises.length >= 2)!;
    const ids = workout.exercises.map((e) => e.id);
    const reversed = [...ids].reverse();

    await reorderExercises(db, userId, workout.id, reversed);
    const exercises = await getExercisesForWorkout(db, workout.id);
    expect(exercises.map((e) => e.id)).toEqual(reversed);
  });
});

describe('schedule intent', () => {
  it('sets a static schedule (day + time per workout)', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, staticId);
    const [w0, w1, w2] = program.workouts;

    await setSchedule(db, userId, {
      type: 'static',
      entries: [
        { workout_id: w0.id, day_of_week: 2, scheduled_time: '18:00' },
        { workout_id: w1.id, day_of_week: 4, scheduled_time: '18:00' },
        { workout_id: w2.id, day_of_week: 6, scheduled_time: '09:00' },
      ],
    });

    const after = await getActiveProgramDetail(db, userId);
    const byId = new Map(after!.workouts.map((w) => [w.id, w]));
    expect(byId.get(w0.id)!.day_of_week).toBe(2);
    expect(byId.get(w0.id)!.scheduled_time).toBe('18:00');
    expect(byId.get(w2.id)!.day_of_week).toBe(6);
  });

  it('reorders a rotation and assigns contiguous sort_order', async () => {
    const userId = await seedTestUser(db);
    const { rotationId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, rotationId);
    const reversed = [...program.workouts].reverse();

    await setSchedule(db, userId, {
      type: 'rotation',
      entries: reversed.map((w) => ({ workout_id: w.id })),
    });

    const after = await getActiveProgramDetail(db, userId);
    expect(after!.workouts.map((w) => w.id)).toEqual(reversed.map((w) => w.id));
    expect(after!.workouts.map((w) => w.sort_order)).toEqual([0, 1, 2]);
  });

  it('rejects a schedule intent whose type does not match the program', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, staticId);

    await expect(
      setSchedule(db, userId, {
        type: 'rotation',
        entries: program.workouts.map((w) => ({ workout_id: w.id })),
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });
});

describe('switchProgramType (server-owned invariants)', () => {
  it('static → rotation: nulls days, contiguous order, seeds rotation_state@0', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, staticId);

    await switchProgramType(db, userId, 'rotation');

    const schedules = await getSchedulesByProgram(db, program.id);
    expect(schedules.every((s) => s.day_of_week === null)).toBe(true);
    expect(schedules.map((s) => s.sort_order)).toEqual([0, 1, 2]);

    const state = await getRotationState(db, userId, program.id);
    expect(state).toBeDefined();
    expect(state!.current_index).toBe(0);

    const detail = await getActiveProgramDetail(db, userId);
    expect(detail!.type).toBe('rotation');
  });

  it('rotation → static: requires a day per workout and deletes rotation_state', async () => {
    const userId = await seedTestUser(db);
    const { rotationId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, rotationId);

    await switchProgramType(
      db,
      userId,
      'static',
      program.workouts.map((w, i) => ({ workout_id: w.id, day_of_week: [1, 3, 5][i] })),
    );

    const schedules = await getSchedulesByProgram(db, program.id);
    expect(schedules.map((s) => s.day_of_week).sort()).toEqual([1, 3, 5]);
    expect(await getRotationState(db, userId, program.id)).toBeUndefined();

    const detail = await getActiveProgramDetail(db, userId);
    expect(detail!.type).toBe('static');
  });

  it('rotation → static without days for every workout is rejected', async () => {
    const userId = await seedTestUser(db);
    const { rotationId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, rotationId);

    await expect(
      switchProgramType(db, userId, 'static', [
        { workout_id: program.workouts[0].id, day_of_week: 1 },
      ]),
    ).rejects.toBeInstanceOf(DomainValidationError);

    // The failed switch left the program as rotation (transaction rolled back).
    const detail = await getActiveProgramDetail(db, userId);
    expect(detail!.type).toBe('rotation');
  });
});
