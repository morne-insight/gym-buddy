import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createDatabase, runMigrations, truncateAll, closePool } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Provisions a fresh Supabase/Postgres database: applies the schema, clears any
 * existing rows, and loads the seed data. Greenfield — no row-by-row migration
 * of prior SQLite data. Safe to re-run; it always leaves the seed data in place.
 *
 *   npm run provision
 */
async function main(): Promise<void> {
  const db = createDatabase();

  console.log('Applying schema...');
  await runMigrations(db);

  console.log('Clearing existing data...');
  await truncateAll(db);

  console.log('Seeding data...');
  const seedSql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  await db.unsafe(seedSql);

  console.log('Done. Fresh database provisioned and seeded.');
}

main()
  .catch((err) => {
    console.error('Provision failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
