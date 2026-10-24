import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['adminsearch.spec.ts', 'auditWorkspace.spec.ts', 'auditlayout.spec.ts', 'authBoundary.spec.ts', 'bannerpicker.spec.ts', 'contentWorkflow.spec.ts', 'contentownership.spec.ts', 'contentreadiness.spec.ts', 'contentsave.spec.ts', 'dashboard.spec.ts', 'menusave.spec.ts', 'productdetail.spec.ts', 'productreadiness.spec.ts', 'productworkspace.spec.ts', 'publicCopy.spec.ts', 'publiccatalog.spec.ts', 'recordSearch.spec.ts', 'rolelayout.spec.ts', 'rolesWorkspace.spec.ts', 'servicedetail.spec.ts', 'usersWorkspace.spec.ts'],
  outputDir: '../tmp/qa-artifacts/contentownership',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    channel: 'chrome',
    baseURL: (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '')
  },
  webServer: {
    command: process.platform === 'win32' ? 'npm.cmd run dev:qa' : 'npm run dev:qa',
    url: 'http://localhost:3001/admin/login',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
