import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { getEventListeners } from 'node:events';
import { lstat, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runBrowserCapture } from '../scripts/browser-capture-runner.js';

test('hard-stop fallback rejects without shadowing the cancellation signal or leaking its listener', { timeout: 3_000 }, async () => {
  const cancellation = new AbortController();
  await assert.rejects(runBrowserCapture(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    timeout: 20, cancellationGraceMs: 20, signal: cancellation.signal,
  }), (error) => {
    assert.match(error.message, /timed out/);
    assert.equal(error.cleanupComplete, false);
    return true;
  });
  assert.equal(getEventListeners(cancellation.signal, 'abort').length, 0);
});

test('zero exit without cleanup acknowledgement cannot pass and removes its abort listener', { timeout: 3_000 }, async () => {
  const cancellation = new AbortController();
  await assert.rejects(runBrowserCapture(process.execPath, ['-e', 'process.exit(0)'], {
    timeout: 1_000, signal: cancellation.signal,
  }), (error) => {
    assert.match(error.message, /without a successful cleanup acknowledgement/);
    assert.equal(error.code, 0); assert.equal(error.cleanupComplete, false);
    return true;
  });
  assert.equal(getEventListeners(cancellation.signal, 'abort').length, 0);
});

test('timed-out real capture closes Chrome before rejecting and releases its owned profile', {
  timeout: 30_000, skip: !process.env.NUMBERDROID_BROWSER_TEST_CHROME,
}, async () => {
  const root = await mkdtemp(join(tmpdir(), 'studio-capture-cancel-test-'));
  const profiles = join(root, 'profiles'); await mkdir(profiles);
  const server = createServer((_request, response) => response.end('<!doctype html><title>Deliberately never ready</title>'));
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  let captureFailure;
  try {
    await assert.rejects(runBrowserCapture(process.execPath, [
      fileURLToPath(new URL('../scripts/capture-studio-browser-evidence.js', import.meta.url)),
      process.env.NUMBERDROID_BROWSER_TEST_CHROME, '1440', join(root, 'unused.png'),
      `http://127.0.0.1:${server.address().port}/#assets`, 'human-asset',
    ], { timeout: 1_500, env: { ...process.env, TMPDIR: profiles, TMP: profiles, TEMP: profiles } }), (error) => {
      captureFailure = error;
      assert.match(error.message, /timed out/);
      assert.ok(error.browser?.pid, 'Capture never reported its owned Chrome process');
      assert.equal(error.cleanupComplete, true, error.stderr);
      return true;
    });
    assert.throws(() => process.kill(captureFailure.browser.pid, 0), { code: 'ESRCH' });
    await assert.rejects(lstat(captureFailure.browser.profileDirectory), { code: 'ENOENT' });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    // Never remove uncertain ownership on a failed cleanup proof.
    if (!captureFailure || captureFailure.cleanupComplete) await rm(root, { recursive: true, force: true });
    else process.stderr.write(`Uncertain capture test files retained at ${root}\n`);
  }
});
