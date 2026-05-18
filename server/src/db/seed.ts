import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createDatabase, runMigrations } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const db = createDatabase();
console.log('Running migrations...');
runMigrations(db);

console.log('Seeding data...');
const seedSql = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
db.exec(seedSql);

console.log('Done. Database seeded successfully.');
db.close();
