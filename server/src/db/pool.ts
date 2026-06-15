import 'dotenv/config';
import postgres from 'postgres';

/**
 * Shared database handle type.
 *
 * The `postgres` client instance IS both the connection pool and the
 * tagged-template query function — e.g. `await sql\`SELECT * FROM users\``.
 * The rest of the data layer accepts a value of this type as its first arg.
 * (`postgres` uses `export =`, so the `Sql` type is derived from the default
 * export rather than imported by name.)
 */
export type DB = ReturnType<typeof postgres>;

/**
 * Return `TIMESTAMPTZ` columns as ISO-8601 strings (e.g. `2026-05-19T06:05:00.000Z`)
 * instead of the `postgres` client's default JS `Date`. The data-access layer's
 * TypeScript interfaces type all timestamp fields as `string`, matching the prior
 * SQLite behavior, so consumers and tests keep working unchanged.
 */
const timestampAsIsoString = {
  timestamptz: {
    to: 1184,
    from: [1184],
    serialize: (v: string) => v,
    parse: (v: string) => new Date(v).toISOString(),
  },
};

/**
 * Builds a `postgres` connection pool with this project's standard options
 * (timestamp parsing, pool size). Used for the shared runtime pool and the
 * ephemeral test pool so both behave identically.
 *
 * The Supabase *session* pooler (port 5432) supports prepared statements, so
 * the default is fine. If you switch to the *transaction* pooler (port 6543 /
 * Supavisor transaction mode), add `prepare: false`.
 */
export function createPool(connectionString: string, max = 10): DB {
  return postgres(connectionString, {
    max,
    types: timestampAsIsoString,
  });
}

let pool: DB | null = null;

/**
 * Returns the shared Postgres connection pool, creating it once on first use
 * and reusing it across the agent, cron jobs, and tools.
 *
 * Reads the Supabase connection string from `DATABASE_URL` and fails fast with
 * a clear error if it is missing, rather than silently doing the wrong thing.
 */
export function getPool(): DB {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Add your Supabase session-pooler connection ' +
        'string to server/.env (see .env.example).',
    );
  }

  pool = createPool(connectionString, 10);
  return pool;
}

/** Closes the shared pool. Call on graceful shutdown. */
export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
