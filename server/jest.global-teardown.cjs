// Removes the disposable Postgres test container created in global setup.
const { execSync } = require('node:child_process');

const CONTAINER = 'gym-buddy-test-pg';

module.exports = async function globalTeardown() {
  try {
    execSync(`docker rm -f ${CONTAINER}`, { stdio: 'ignore' });
  } catch {
    /* container already gone */
  }
};
