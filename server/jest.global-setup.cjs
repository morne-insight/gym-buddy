// Starts a disposable Postgres container for the test suite (Docker).
// Kept intentionally in plain CommonJS so Jest can load it without a transform.
const { execSync } = require('node:child_process');

const CONTAINER = 'gym-buddy-test-pg';
const PORT = '5433';
const IMAGE = 'postgres:17-alpine';

function sh(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', ...opts }).toString().trim();
}

module.exports = async function globalSetup() {
  let running = '';
  try {
    running = sh(`docker ps --filter "name=^/${CONTAINER}$" --format "{{.Names}}"`);
  } catch {
    throw new Error(
      'Docker does not appear to be running. Start Docker Desktop before running the test suite.',
    );
  }

  if (running !== CONTAINER) {
    try {
      sh(`docker rm -f ${CONTAINER}`);
    } catch {
      /* no existing container to remove */
    }
    sh(
      `docker run -d --name ${CONTAINER} ` +
        `-e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres ` +
        `-p ${PORT}:5432 ${IMAGE}`,
    );
  }

  // Wait until Postgres is accepting connections.
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      sh(`docker exec ${CONTAINER} pg_isready -U postgres -d postgres`);
      break;
    } catch {
      if (Date.now() > deadline) {
        throw new Error('Postgres test container did not become ready within 60s.');
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};
