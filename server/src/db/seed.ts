import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createDatabase, runMigrations, closePool } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const db = createDatabase();

  console.log('Running migrations...');
  await runMigrations(db);

  console.log('Seeding data...');
  const seedSql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  await db.unsafe(seedSql);

  console.log('Done. Database seeded successfully.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
