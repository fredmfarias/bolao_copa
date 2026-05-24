import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  modulePathIgnorePatterns: ['<rootDir>/.next/standalone'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@bolao/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
};

export default createJestConfig(config);
