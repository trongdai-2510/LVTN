import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForExit(child, timeoutMs) {
  if (hasExited(child)) return true;

  return Promise.race([
    new Promise((resolve) => {
      child.once('exit', () => resolve(true));
      child.once('error', () => resolve(true));
    }),
    delay(timeoutMs).then(() => false)
  ]);
}

/**
 * Chrome/Edge keeps profile files open briefly after the root process receives
 * SIGTERM on Windows. Kill only the exact browser process tree created by the
 * QA run, wait for exit, then retry removal of its exact temporary profile.
 */
export async function closeSpawnedBrowser(child, userDataDir) {
  if (!hasExited(child)) {
    if (process.platform === 'win32' && child.pid) {
      const killer = spawn(
        'taskkill.exe',
        ['/PID', String(child.pid), '/T', '/F'],
        { stdio: 'ignore', windowsHide: true }
      );
      await waitForExit(killer, 7000);
      await waitForExit(child, 3000);
    } else {
      child.kill('SIGTERM');
      const exited = await waitForExit(child, 5000);
      if (!exited && !hasExited(child)) {
        child.kill('SIGKILL');
        await waitForExit(child, 3000);
      }
    }
  }

  await delay(500);
  rmSync(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 12,
    retryDelay: 250
  });
}
