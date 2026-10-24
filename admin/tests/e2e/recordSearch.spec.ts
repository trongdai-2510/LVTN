import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

test('file usage and audit searches accept a text query against UUID records', async ({ request }) => {
  const auth = await getQaAuth(request, api);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  for (const path of ['files/usage-records', 'audit-logs']) {
    const response = await request.get(`${api}/song-thanh/${path}?q=codexsearchprobe`, { headers });
    expect(response.status(), path).toBe(200);
    const result = await response.json();
    expect(result).toHaveProperty('data');
  }
});
