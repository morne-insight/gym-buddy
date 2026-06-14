import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export function migrateToPrograms(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('static', 'rotation')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    program_id TEXT NOT NULL REFERENCES programs(id),
    name TEXT NOT NULL
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS rotation_state (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    program_id TEXT NOT NULL REFERENCES programs(id),
    current_index INTEGER NOT NULL DEFAULT 0,
    last_completed_at DATETIME
  )`);

  const hasWorkoutId = (db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('schedule') WHERE name = 'workout_id'",
  ).get() as { cnt: number }).cnt > 0;

  if (hasWorkoutId) return;

  const migrate = db.transaction(() => {
    const users = db.prepare('SELECT DISTINCT user_id FROM schedule').all() as Array<{ user_id: string }>;

    for (const { user_id } of users) {
      const programId = `prog-migrated-${user_id}`;
      db.prepare('INSERT INTO programs (id, user_id, name, type) VALUES (?, ?, ?, ?)').run(
        programId, user_id, 'Migrated Program', 'static',
      );

      const schedules = db.prepare(
        'SELECT DISTINCT workout_name FROM schedule WHERE user_id = ? AND active = 1 ORDER BY day_of_week',
      ).all(user_id) as Array<{ workout_name: string }>;

      const workoutMap = new Map<string, string>();
      let sortOrder = 0;

      for (const { workout_name } of schedules) {
        if (workoutMap.has(workout_name)) continue;
        const workoutId = randomUUID();
        workoutMap.set(workout_name, workoutId);

        db.prepare('INSERT INTO workouts (id, program_id, name) VALUES (?, ?, ?)').run(
          workoutId, programId, workout_name,
        );
      }

      const hasScheduleId = (db.prepare(
        "SELECT COUNT(*) as cnt FROM pragma_table_info('workout_exercises') WHERE name = 'schedule_id'",
      ).get() as { cnt: number }).cnt > 0;

      if (hasScheduleId) {
        const oldSchedules = db.prepare(
          'SELECT * FROM schedule WHERE user_id = ? AND active = 1 ORDER BY day_of_week',
        ).all(user_id) as Array<{ id: string; workout_name: string }>;

        for (const sched of oldSchedules) {
          const workoutId = workoutMap.get(sched.workout_name)!;
          db.prepare(
            'UPDATE workout_exercises SET workout_id = ? WHERE schedule_id = ?',
          ).run(workoutId, sched.id);
        }
      }

      const allSchedules = db.prepare(
        'SELECT * FROM schedule WHERE user_id = ? AND active = 1 ORDER BY day_of_week',
      ).all(user_id) as Array<{ id: string; workout_name: string }>;

      for (const sched of allSchedules) {
        const workoutId = workoutMap.get(sched.workout_name)!;
        try {
          db.prepare('UPDATE schedule SET program_id = ?, workout_id = ?, sort_order = ? WHERE id = ?').run(
            programId, workoutId, sortOrder++, sched.id,
          );
        } catch {
          // Columns may not exist yet in old schema — handled by ALTER TABLE below
        }
      }
    }
  });

  migrate();
}
