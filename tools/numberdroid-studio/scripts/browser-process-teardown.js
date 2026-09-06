// Register immediately after spawn: exit alone does not mean stdio is closed.
export function trackProcessClose(child) {
  let closed = false;
  let spawnError = null;
  child.on('error', (error) => { spawnError = error; });
  const completion = new Promise((resolveClose) => {
    child.once('close', (code, signal) => {
      closed = true;
      resolveClose({ code, signal });
    });
  });
  return { completion, get closed() { return closed; }, get spawnError() { return spawnError; } };
}

async function waitAtMost(promise, milliseconds) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((resolveDeadline) => { timer = setTimeout(resolveDeadline, milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}

// removeProfile must remove only the caller's uniquely allocated browser profile.
export async function closeBrowserAndRemoveProfile({
  child,
  trackedClose,
  requestBrowserClose,
  closeConnection,
  removeProfile,
  commandTimeoutMs = 2_000,
  gracefulTimeoutMs = 5_000,
  terminateTimeoutMs = 2_000,
  killTimeoutMs = 2_000,
}) {
  try {
    if (!trackedClose.closed) {
      // Browser.close may close CDP before its reply; process closure owns success.
      await waitAtMost(Promise.resolve().then(requestBrowserClose).catch(() => {}), commandTimeoutMs);
      await waitAtMost(trackedClose.completion, gracefulTimeoutMs);
    }
    for (const [signal, timeout] of [['SIGTERM', terminateTimeoutMs], ['SIGKILL', killTimeoutMs]]) {
      if (trackedClose.closed) break;
      if (child.exitCode === null && child.signalCode === null) {
        try { child.kill(signal); } catch {}
      }
      await waitAtMost(trackedClose.completion, timeout);
    }
    if (!trackedClose.closed) {
      throw new Error('Chrome did not fully close within its shutdown deadline; its owned profile was retained.');
    }
  } finally { closeConnection(); }
  await removeProfile();
}

// Cleanup must not hide a product/capture assertion behind a filesystem error.
export async function finishCapture(captureError, cleanupSteps) {
  const errors = [];
  if (captureError !== null) errors.push(captureError);
  for (const cleanup of cleanupSteps) {
    try { await cleanup(); } catch (error) { errors.push(error); }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, 'Capture and/or teardown failed; all original errors are retained.', { cause: errors[0] });
  }
}
