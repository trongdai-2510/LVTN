import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createServer as createPortServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const aggregateRoutes = [
  '/gioi-thieu', '/san-pham', '/ho-so-nang-luc', '/dich-vu',
  '/du-an', '/doi-tac-thuong-hieu', '/tin-tuc', '/lien-he'
];

async function freePort() {
  const reservation = createPortServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise((resolve) => reservation.close(resolve));
  return port;
}

test('hidden system pages return 404 without changing independently published child routes', { timeout: 120_000 }, async () => {
  const requests = [];
  let pageContentStatus = 404;
  const api = createServer((request, response) => {
    requests.push(request.url ?? '');
    if (request.url === '/public/projects/project-example') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        ok: true,
        data: {
          project: {
            id: 'project-example', title: 'Dự án độc lập', slug: 'project-example',
            location: null, project_year: null, client_name: null, description: null,
            content_html: null, image_file_id: null, image_file: null,
            seo_title: null, seo_description: null
          },
          gallery: [], related_product_groups: []
        },
        meta: {}
      }));
      return;
    }
    const status = request.url?.startsWith('/public/page-contents/') ? pageContentStatus : 404;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      ok: false, error: { code: status === 404 ? 'NOT_FOUND' : 'UNAVAILABLE', message: 'Not found', details: null }
    }));
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const apiAddress = api.address();
  assert.ok(apiAddress && typeof apiAddress !== 'string');
  const sitePort = await freePort();
  const site = `http://127.0.0.1:${sitePort}`;
  let output = '';
  const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', String(sitePort)], {
    cwd: process.cwd(),
    env: { ...process.env, API_BASE_URL: `http://127.0.0.1:${apiAddress.port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  next.stdout.on('data', (chunk) => { output += String(chunk).slice(-1000); });
  next.stderr.on('data', (chunk) => { output += String(chunk).slice(-1000); });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (next.exitCode !== null) break;
      try {
        await fetch(`${site}/robots.txt`);
        ready = true;
        break;
      } catch {
        await delay(250);
      }
    }
    assert.equal(ready, true, `Public server did not start: ${output}`);

    for (const route of aggregateRoutes) {
      const response = await fetch(`${site}${route}`);
      assert.equal(response.status, 404, `${route} should be hidden when its page record is not public`);
      const body = await response.text();
      assert.match(body, /Trang này hiện không khả dụng/);
      assert.ok(!body.includes('<meta name="robots" content="index, follow"'), 'the 404 page must not emit a conflicting index directive');
    }

    pageContentStatus = 503;
    const unavailableResponse = await fetch(`${site}/du-an`);
    assert.equal(unavailableResponse.status, 500, 'an API outage must not masquerade as a hidden page');
    pageContentStatus = 404;

    const sitemapResponse = await fetch(`${site}/sitemap.xml`);
    const sitemapBody = await sitemapResponse.text();
    assert.equal(sitemapResponse.status, 200);
    assert.ok(sitemapBody.includes('/san-pham/danh-sach'), 'an independent child route stays in the sitemap');
    for (const route of aggregateRoutes) {
      assert.ok(!sitemapBody.includes(`<loc>https://songthanhelectric.com.vn${route}</loc>`), `${route} must not be advertised while hidden`);
    }

    requests.length = 0;
    const childResponse = await fetch(`${site}/du-an/project-example`);
    assert.equal(childResponse.status, 200, 'a published child remains accessible when its aggregate page is hidden');
    assert.match(await childResponse.text(), /Dự án độc lập/);
    assert.ok(requests.some((path) => path.includes('/public/projects/project-example')));
    assert.ok(!requests.some((path) => path.includes('/public/page-contents/du-an')));
  } finally {
    next.kill();
    await Promise.race([once(next, 'exit'), delay(5000)]);
    await new Promise((resolve) => api.close(resolve));
  }
});
