const DIAGNOSTIC_LIMIT = 8_192;

// Install immediately after spawn. Only startup output is retained; capture's
// existing teardown continues to own process closure and profile removal.
export function waitForDevtoolsEndpoint(child, {
  signal, trackedClose, timeoutMs = 30_000,
} = {}) {
  const started = performance.now();
  return new Promise((resolveEndpoint, rejectEndpoint) => {
    let diagnostics = ''; let settled = false; let timer;
    const finish = (error, url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stderr.removeListener('data', inspect);
      child.removeListener('error', failed);
      child.removeListener('exit', exited);
      child.removeListener('close', exited);
      signal?.removeEventListener('abort', aborted);
      if (error) rejectEndpoint(error);
      else resolveEndpoint({ url, elapsedMs: Math.round(performance.now() - started) });
    };
    const failed = (error) => finish(error);
    const exited = (code, terminationSignal) => finish(new Error(
      `Chrome exited before DevTools started (${terminationSignal ?? code}). ${diagnostics}`,
    ));
    const aborted = () => finish(signal.reason ?? new Error('Chrome startup cancelled.'));
    const inspect = (chunk) => {
      diagnostics = (diagnostics + chunk).slice(-DIAGNOSTIC_LIMIT);
      // Require a terminator: stderr can split even the endpoint across chunks.
      const match = /DevTools listening on (ws:\/\/[^\s]+)\s/.exec(diagnostics);
      if (match) finish(null, match[1]);
    };
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', inspect);
    child.on('error', failed);
    child.on('exit', exited);
    child.on('close', exited);
    signal?.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(() => finish(new Error(
      `Chrome DevTools did not start within ${timeoutMs} milliseconds. ${diagnostics}`,
    )), timeoutMs);
    if (signal?.aborted) aborted();
    else if (trackedClose?.spawnError) failed(trackedClose.spawnError);
    else if (trackedClose?.closed || child.exitCode !== null || child.signalCode !== null) {
      exited(child.exitCode, child.signalCode);
    }
  });
}

// The returned open socket transfers to DevTools; an unsuccessful opening owns
// its own close request and releases every temporary listener and timer.
export async function openDevtoolsSocket(url, {
  signal, timeoutMs = 10_000, createSocket = (endpoint) => new WebSocket(endpoint),
} = {}) {
  if (signal?.aborted) throw signal.reason ?? new Error('Chrome DevTools connection cancelled.');
  const socket = createSocket(url);
  return new Promise((resolveSocket, rejectSocket) => {
    let settled = false; let timer;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.removeEventListener('open', opened);
      socket.removeEventListener('error', failed);
      socket.removeEventListener('close', closed);
      signal?.removeEventListener('abort', aborted);
      if (error) {
        try { socket.close(); } catch {}
        rejectSocket(error);
      } else resolveSocket(socket);
    };
    const opened = () => finish();
    const failed = (event) => finish(new Error('Chrome DevTools connection failed before opening.', { cause: event.error }));
    const closed = () => finish(new Error('Chrome DevTools connection closed before opening.'));
    const aborted = () => finish(signal.reason ?? new Error('Chrome DevTools connection cancelled.'));
    socket.addEventListener('open', opened);
    socket.addEventListener('error', failed);
    socket.addEventListener('close', closed);
    signal?.addEventListener('abort', aborted, { once: true });
    timer = setTimeout(() => finish(new Error(
      `Chrome DevTools connection did not open within ${timeoutMs} milliseconds.`,
    )), timeoutMs);
    if (signal?.aborted) aborted();
    else if (socket.readyState === 1) opened();
    else if (socket.readyState === 3) closed();
  });
}
