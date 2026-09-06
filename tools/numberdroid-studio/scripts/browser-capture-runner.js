import { spawn } from 'node:child_process';

// Test-runner transport only. Timeout first requests cancellation so capture's
// finally can close Chrome; a hard stop retains any uncertain profile/data.
export function runBrowserCapture(command, args, { timeout, maxBuffer = 4 * 1024 * 1024, cancellationGraceMs = 15_000, signal, ...options }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stdout = ''; let stderr = ''; let failure = null; let browser = null; let cleanupComplete = false;
    let forceTimer; let finalTimer; let settled = false;
    const finish = (code, terminationSignal) => {
      if (settled) return; settled = true;
      clearTimeout(deadline); clearTimeout(forceTimer); clearTimeout(finalTimer);
      signal?.removeEventListener('abort', abort);
      if (failure || code !== 0 || !cleanupComplete) {
        const error = failure ?? new Error(code === 0
          ? 'Browser capture exited without a successful cleanup acknowledgement; owned files are retained.'
          : `Browser capture failed (${terminationSignal ?? code}). ${stderr}`);
        Object.assign(error, { stdout, stderr, code, signal: terminationSignal, browser, cleanupComplete });
        rejectRun(error);
      } else resolveRun({ stdout, stderr, browser, cleanupComplete });
    };
    const cancel = (reason) => {
      if (failure) return; failure = reason;
      try { child.send({ type: 'studio-capture-cancel', schemaVersion: 1 }, () => {}); } catch {}
      forceTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        finalTimer = setTimeout(() => finish(null, 'unconfirmed-close'), 2_000);
      }, cancellationGraceMs);
    };
    const deadline = setTimeout(() => cancel(new Error(`Browser capture timed out after ${timeout} ms; cancellation requested.`)), timeout);
    const abort = () => cancel(signal.reason ?? new Error('Browser capture runner cancelled.'));
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > maxBuffer) cancel(new Error('Browser capture output exceeded its limit.')); });
    child.stderr.on('data', (chunk) => { stderr += chunk; if (stderr.length > maxBuffer) cancel(new Error('Browser capture output exceeded its limit.')); });
    child.on('message', (message) => {
      if (message?.type === 'studio-capture-browser-started') browser = { pid: message.pid, profileDirectory: message.profileDirectory };
      if (message?.type === 'studio-capture-cleanup-complete') cleanupComplete = message.ok === true;
    });
    child.once('error', (error) => { failure = error; });
    child.once('close', finish);
  });
}
