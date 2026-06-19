import {
  listTemplates,
  adoptTemplate,
  getActiveProgram,
  getActiveProgramDetail,
  getSchedulesByProgram,
  getRotationState,
  getWorkoutsByProgram,
  NotFoundError,
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

describe('listTemplates (catalog)', () => {
  it('returns templates with workouts, schedule, and exercises', async () => {
    await seedTestTemplates(db);
    const templates = await listTemplates(db);

    expect(templates).toHaveLength(2);
    const staticTpl = templates.find((t) => t.type === 'static')!;
    expect(staticTpl.name).toBe('Static PPL');
    expect(staticTpl.workouts).toHaveLength(3);
    expect(staticTpl.workouts[0].name).toBe('Push Day');
    expect(staticTpl.workouts[0].day_of_week).toBe(1);
    expect(staticTpl.workouts[0].exercises.length).toBeGreaterThan(0);
    expect(staticTpl.workouts[0].exercises[0].exercise_name).toBe('Bench Press');
  });

  it('rotation template workouts have null day_of_week and contiguous order', async () => {
    await seedTestTemplates(db);
    const templates = await listTemplates(db);
    const rotation = templates.find((t) => t.type === 'rotation')!;

    expect(rotation.workouts.map((w) => w.day_of_week)).toEqual([null, null, null]);
    expect(rotation.workouts.map((w) => w.sort_order)).toEqual([0, 1, 2]);
  });
});

describe('adoptTemplate (transactional clone)', () => {
  it('clones a static template into a new active user-owned program', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);

    const program = await adoptTemplate(db, userId, staticId);

    expect(program.type).toBe('static');
    expect(program.name).toBe('Static PPL');
    expect(program.workouts).toHaveLength(3);

    const active = await getActiveProgram(db, userId);
    expect(active).toBeDefined();
    expect(active!.id).toBe(program.id);
    expect(active!.active).toBe(1);

    // Cloned exercises exist under the cloned workouts.
    const push = program.workouts.find((w) => w.name === 'Push Day')!;
    expect(push.exercises.map((e) => e.exercise_name)).toContain('Bench Press');
  });

  it('static adoption retains day_of_week and creates no rotation_state', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);

    const program = await adoptTemplate(db, userId, staticId);
    const schedules = await getSchedulesByProgram(db, program.id);

    expect(schedules.map((s) => s.day_of_week).sort()).toEqual([1, 3, 5]);
    expect(await getRotationState(db, userId, program.id)).toBeUndefined();
  });

  it('rotation adoption nulls days, contiguous order, seeds rotation_state at 0', async () => {
    const userId = await seedTestUser(db);
    const { rotationId } = await seedTestTemplates(db);

    const program = await adoptTemplate(db, userId, rotationId);
    const schedules = await getSchedulesByProgram(db, program.id);

    expect(schedules.every((s) => s.day_of_week === null)).toBe(true);
    expect(schedules.map((s) => s.sort_order)).toEqual([0, 1, 2]);

    const state = await getRotationState(db, userId, program.id);
    expect(state).toBeDefined();
    expect(state!.current_index).toBe(0);
    expect(state!.last_completed_at).toBeNull();
    expect(program.rotation_current_index).toBe(0);
  });

  it('marks the previously active program inactive (single active program)', async () => {
    const userId = await seedTestUser(db);
    const { staticId, rotationId } = await seedTestTemplates(db);

    const first = await adoptTemplate(db, userId, staticId);
    const second = await adoptTemplate(db, userId, rotationId);

    const active = await getActiveProgram(db, userId);
    expect(active!.id).toBe(second.id);
    expect(active!.id).not.toBe(first.id);
  });

  it('rejects an unknown template id', async () => {
    const userId = await seedTestUser(db);
    await seedTestTemplates(db);
    await expect(adoptTemplate(db, userId, 'does-not-exist')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('does not propagate later template edits to an adopted program', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, staticId);

    // Edit the catalog template after adoption.
    await db`UPDATE program_templates SET name = 'Edited Catalog Name' WHERE id = ${staticId}`;
    await db`UPDATE template_workouts SET name = 'Edited Workout' WHERE program_template_id = ${staticId}`;
    await db`UPDATE template_exercises SET exercise_name = 'Edited Exercise' WHERE template_workout_id = 'tw-s-push'`;

    const after = await getActiveProgramDetail(db, userId);
    expect(after!.name).toBe('Static PPL'); // unchanged
    expect(after!.workouts.map((w) => w.name)).not.toContain('Edited Workout');
    const allExercises = after!.workouts.flatMap((w) => w.exercises.map((e) => e.exercise_name));
    expect(allExercises).not.toContain('Edited Exercise');
  });

  it('cloned program rows are independent of the catalog (no shared ids)', async () => {
    const userId = await seedTestUser(db);
    const { staticId } = await seedTestTemplates(db);
    const program = await adoptTemplate(db, userId, staticId);

    const workouts = await getWorkoutsByProgram(db, program.id);
    // Cloned workout ids are freshly generated, not the template ids.
    expect(workouts.every((w) => !w.id.startsWith('tw-s-'))).toBe(true);
  });
});
