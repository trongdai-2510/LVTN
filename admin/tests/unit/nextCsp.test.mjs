import assert from 'node:assert/strict';
import test from 'node:test';

test('production admin CSP permits its configured browser API origin', async () => {
  const previousMode = process.env.NODE_ENV;
  const previousApi = process.env.NEXT_PUBLIC_API_BASE_URL;
  const previousPublicSite = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL;
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000';
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = 'http://localhost:3000';

  try {
    const { default: config } = await import('../../next.config.ts');
    const headers = await config.headers();
    const policy = headers[0].headers.find((header) => header.key === 'Content-Security-Policy')?.value;
    assert.ok(policy);
    const connectSource = policy.split('; ').find((directive) => directive.startsWith('connect-src '));
    const imageSource = policy.split('; ').find((directive) => directive.startsWith('img-src '));
    const frameSource = policy.split('; ').find((directive) => directive.startsWith('frame-src '));
    assert.match(connectSource, /http:\/\/localhost:4000/);
    assert.match(imageSource, /http:\/\/localhost:4000/);
    assert.match(frameSource, /http:\/\/localhost:3000/);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
    if (previousApi === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
    else process.env.NEXT_PUBLIC_API_BASE_URL = previousApi;
    if (previousPublicSite === undefined) delete process.env.NEXT_PUBLIC_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_PUBLIC_SITE_URL = previousPublicSite;
  }
});
