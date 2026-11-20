import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalTeardown() {
  if (process.env.QA_CLEANUP_CONFIRMED !== '1') {
    console.log('QA cleanup skipped; QA_CLEANUP_CONFIRMED=1 was not supplied.');
    return;
  }

  const apiDirectory = resolve(__dirname, '../../../api');
  const cleanupScript = resolve(apiDirectory, 'scripts/cleanuptestdata.js');
  const result = spawnSync(process.execPath, [cleanupScript], {
    cwd: apiDirectory,
    encoding: 'utf8',
    env: process.env
  });

  if (result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'QA cleanup failed after Playwright completed.');
  }
}
