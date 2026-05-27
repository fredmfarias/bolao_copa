import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: resolve(__dirname, '.env.e2e') });

const ROOT = resolve(__dirname, '..');
const API_PORT = process.env.PORT ?? '3001';
const WEB_PORT = process.env.FRONTEND_PORT ?? '3000';
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testMatch: /tests[\\/](authz|aposta|ranking|notificacoes)[\\/].*\.api\.spec\.ts/ },
    {
      name: 'ui-chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /\.api\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @bolao/backend dev',
      cwd: ROOT,
      url: `http://localhost:${API_PORT}/jogos`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)),
    },
    {
      command: `pnpm --filter @bolao/frontend exec next dev -p ${WEB_PORT}`,
      cwd: ROOT,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)), PORT: WEB_PORT },
    },
  ],
});
