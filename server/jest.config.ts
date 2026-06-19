import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // Tests share a single Docker Postgres database and isolate via truncation,
  // so they must run serially to avoid cross-file data races.
  maxWorkers: 1,
  globalSetup: '<rootDir>/jest.global-setup.cjs',
  globalTeardown: '<rootDir>/jest.global-teardown.cjs',
  testTimeout: 30000,
  moduleNameMapper: {
    // Resolve the shared contracts package to its TypeScript source so the test
    // suite (TDD) runs without a prior `npm run build -w @gym-buddy/contracts`.
    '^@gym-buddy/contracts$': '<rootDir>/../packages/contracts/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
};

export default config;
