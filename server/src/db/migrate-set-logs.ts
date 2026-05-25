import Database from 'better-sqlite3';

export function migrateToSetLogs(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS set_logs (
    id TEXT PRIMARY KEY,
    exercise_log_id TEXT NOT NULL REFERENCES exercise_logs(id),
    set_number INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight REAL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const rows = db
    .prepare(
      `SELECT id, actual_sets, actual_reps, actual_weight, completed_at
       FROM exercise_logs
       WHERE actual_sets IS NOT NULL OR actual_reps IS NOT NULL`,
    )
    .all() as Array<{
    id: string;
    actual_sets: number | null;
    actual_reps: string | null;
    actual_weight: number | null;
    completed_at: string | null;
  }>;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO set_logs (id, exercise_log_id, set_number, reps, weight, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const migrate = db.transaction(() => {
    for (const row of rows) {
      const repsList = row.actual_reps?.split(',').map((r) => parseInt(r.trim(), 10)) ?? [];
      const setCount = row.actual_sets ?? repsList.length ?? 1;

      for (let i = 0; i < setCount; i++) {
        const reps = repsList[i] ?? repsList[repsList.length - 1] ?? 0;
        const id = `${row.id}-set-${i + 1}`;
        insert.run(id, row.id, i + 1, reps, row.actual_weight, row.completed_at);
      }
    }
  });

  migrate();
}
