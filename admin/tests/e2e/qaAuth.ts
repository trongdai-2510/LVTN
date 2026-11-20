import type { APIRequestContext } from '@playwright/test';

export type QaAuth = {
  access_token: string;
  refresh_token: string;
  user: { display_name: string; [key: string]: unknown };
  permissions: string[];
  roles: string[];
};

const sessions = new Map<string, { data: QaAuth; expiresAt: number }>();

export async function getQaAuth(request: APIRequestContext, apiBaseUrl: string): Promise<QaAuth> {
  const existing = sessions.get(apiBaseUrl);
  if (existing && existing.expiresAt > Date.now()) return existing.data;

  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  if (!response.ok()) throw new Error(`Admin QA login returned HTTP ${response.status()}`);

  const body = await response.json() as { data: QaAuth };
  // Access tokens expire after 15 minutes; keep the in-worker cache shorter.
  sessions.set(apiBaseUrl, { data: body.data, expiresAt: Date.now() + 13 * 60_000 });
  return body.data;
}
