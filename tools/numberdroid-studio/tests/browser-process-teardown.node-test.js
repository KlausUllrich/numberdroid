import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { closeBrowserAndRemoveProfile, finishCapture, trackProcessClose } from '../scripts/browser-process-teardown.js';

function childProcess() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.signals = [];
  child.kill = (signal) => { child.signals.push(signal); return true; };
  return child;
}

test('profile removal waits for close even after the browser parent exits', { timeout: 2_000 }, async () => {
  const child = childProcess(); const trackedClose = trackProcessClose(child);
  const steps = [];
  let releaseClose;
  const exited = new Promise((resolveExited) => { releaseClose = resolveExited; });
  const stopped = closeBrowserAndRemoveProfile({
    child, trackedClose,
    requestBrowserClose() {
      steps.push('Browser.close'); child.exitCode = 0; child.emit('exit', 0, null); releaseClose();
    },
    closeConnection() { steps.push('CDP.close'); },
    removeProfile() { steps.push('remove'); },
  });
  await exited;
  await new Promise((resolveTurn) => setImmediate(resolveTurn));
  assert.deepEqual(steps, ['Browser.close']);
  child.emit('close', 0, null);
  await stopped;
  assert.deepEqual(steps, ['Browser.close', 'CDP.close', 'remove']);
  assert.deepEqual(child.signals, []);
});

test('shutdown deadline retains the owned profile and uses bounded signal fallbacks', { timeout: 2_000 }, async () => {
  const profile = await mkdtemp(join(tmpdir(), 'studio-browser-teardown-test-'));
  await writeFile(join(profile, 'keep'), 'retained');
  const child = childProcess(); const trackedClose = trackProcessClose(child);
  let disconnected = false;
  try {
    await assert.rejects(closeBrowserAndRemoveProfile({
      child, trackedClose, requestBrowserClose: async () => {},
      closeConnection() { disconnected = true; },
      removeProfile: () => rm(profile, { recursive: true }),
      commandTimeoutMs: 5, gracefulTimeoutMs: 5, terminateTimeoutMs: 5, killTimeoutMs: 5,
    }), /profile was retained/);
    assert.equal(await readFile(join(profile, 'keep'), 'utf8'), 'retained');
    assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
    assert.equal(disconnected, true);
  } finally { await rm(profile, { recursive: true, force: true }); }
});

test('a closed browser after signal fallback permits only subsequent profile removal', { timeout: 2_000 }, async () => {
  const child = childProcess(); const trackedClose = trackProcessClose(child);
  child.kill = (signal) => {
    child.signals.push(signal); child.signalCode = signal;
    child.emit('exit', null, signal);
    setImmediate(() => child.emit('close', null, signal));
    return true;
  };
  let removed = false;
  await closeBrowserAndRemoveProfile({
    child, trackedClose, requestBrowserClose: async () => { throw new Error('CDP unavailable'); },
    closeConnection() {}, removeProfile() { assert.equal(trackedClose.closed, true); removed = true; },
    gracefulTimeoutMs: 5,
  });
  assert.deepEqual(child.signals, ['SIGTERM']);
  assert.equal(removed, true);
});

test('teardown preserves the capture error and still closes remaining resources', async () => {
  const captureError = new Error('O1b assertion failed');
  const cleanupError = Object.assign(new Error('profile busy'), { code: 'ENOTEMPTY' });
  let remainingClosed = false;
  await assert.rejects(finishCapture(captureError, [
    async () => { throw cleanupError; },
    async () => { remainingClosed = true; },
  ]), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [captureError, cleanupError]);
    assert.equal(error.cause, captureError);
    return true;
  });
  assert.equal(remainingClosed, true);
  await assert.rejects(finishCapture(captureError, [async () => {}]), (error) => error === captureError);
});
