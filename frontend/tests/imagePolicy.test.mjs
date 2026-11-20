import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const inspectConfig = "import('./next.config.ts').then(({default: config}) => process.stdout.write(JSON.stringify(config.images.remotePatterns)))";

function imagePatterns(nodeEnv) {
  const result = spawnSync(process.execPath, ['-e', inspectConfig], {
    cwd: frontendRoot,
    env: { ...process.env, NODE_ENV: nodeEnv },
    encoding: 'utf8',
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('production image optimizer cannot fetch loopback hosts', () => {
  const patterns = imagePatterns('production');
  assert.ok(patterns.some((pattern) => pattern.hostname === 'images.unsplash.com'));
  assert.ok(patterns.every((pattern) => !['localhost', '127.0.0.1'].includes(pattern.hostname)));
});

test('local development retains loopback image sources', () => {
  const patterns = imagePatterns('development');
  assert.ok(patterns.some((pattern) => pattern.hostname === 'localhost'));
  assert.ok(patterns.some((pattern) => pattern.hostname === '127.0.0.1'));
});
