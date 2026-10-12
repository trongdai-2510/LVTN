import { defineConfig, devices } from '@playwright/test';

if (process.env.QA_MUTATING_TESTS_CONFIRMED !== '1') {
  throw new Error(
    'The default Playwright suite writes and permanently deletes QA records. Use tests/readonly.config.ts for safe checks, or set QA_MUTATING_TESTS_CONFIRMED=1 only against an isolated QA database.'
  );
}

const adminBaseURL = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const adminBasePath = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const apiBaseURL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const npmRun = process.platform === 'win32' ? 'npm.cmd run dev:qa' : 'npm run dev:qa';
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome';

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminUrl(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${adminBaseURL}${adminBasePath}${normalizedPath}`;
}

export default defineConfig({
  testDir: './tests/e2e',
  globalTeardown: './tests/e2e/globalteardown.ts',
  timeout: 60_000,
  expect: {
    // Next.js dev evicts inactive route bundles; cold recompilation of the
    // largest admin detail pages can legitimately take just over 10 seconds.
    timeout: 20_000
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: adminBaseURL,
    acceptDownloads: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: browserChannel
      }
    }
  ],
  webServer: {
    command: npmRun,
    url: adminUrl('/login'),
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: apiBaseURL
    }
  }
});
