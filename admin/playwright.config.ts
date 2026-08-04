import { defineConfig, devices } from '@playwright/test';

const adminBaseURL = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const adminBasePath = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const apiBaseURL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const npmRun = process.platform === 'win32' ? 'npm.cmd run dev' : 'npm run dev';
const browserChannel =
  process.env.PLAYWRIGHT_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined);

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
  timeout: 60_000,
  expect: {
    timeout: 10_000
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
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {})
      }
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox']
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
