import assert from 'node:assert/strict';
import { EventEmitter, getEventListeners } from 'node:events';
import test from 'node:test';
import { openDevtoolsSocket, waitForDevtoolsEndpoint } from '../scripts/browser-devtools-startup.js';

const endpoint = 'ws://127.0.0.1:43210/devtools/browser/example';
const bound = { timeout: 2_000 };

function childProcess() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter(); child.stderr.setEncoding = () => {};
  child.exitCode = null; child.signalCode = null;
  return child;
}

function assertStartupReleased(child, signal) {
  assert.equal(child.stderr.listenerCount('data'), 0);
  for (const name of ['error', 'exit', 'close']) assert.equal(child.listenerCount(name), 0, name);
  assert.equal(getEventListeners(signal, 'abort').length, 0);
}

test('delayed split endpoint waits for the complete line and releases startup listeners', bound, async () => {
  const child = childProcess(); const cancellation = new AbortController();
  let resolved = false;
  const pending = waitForDevtoolsEndpoint(child, { signal: cancellation.signal, timeoutMs: 1_000 });
  pending.then(() => { resolved = true; });
  child.stderr.emit('data', 'DBus startup warning\nDevTools listen');
  await new Promise((done) => setTimeout(done, 20));
  child.stderr.emit('data', 'ing on ws://127.0.0.1:43210/devtools/brow');
  await Promise.resolve();
  assert.equal(resolved, false, 'A partial socket URL must not resolve readiness');
  child.stderr.emit('data', 'ser/example\n');
  const result = await pending;
  assert.equal(result.url, endpoint);
  assert.ok(Number.isInteger(result.elapsedMs) && result.elapsedMs >= 0);
  assertStartupReleased(child, cancellation.signal);
});

test('startup rejects the original spawn error immediately', bound, async () => {
  const child = childProcess(); const cancellation = new AbortController();
  const failure = Object.assign(new Error('Executable missing'), { code: 'ENOENT' });
  const pending = waitForDevtoolsEndpoint(child, { signal: cancellation.signal });
  child.emit('error', failure);
  await assert.rejects(pending, (error) => error === failure);
  assertStartupReleased(child, cancellation.signal);
});

for (const event of ['exit', 'close']) {
  test(`startup rejects early process ${event} with bounded diagnostics`, bound, async () => {
    const child = childProcess(); const cancellation = new AbortController();
    const pending = waitForDevtoolsEndpoint(child, { signal: cancellation.signal });
    child.stderr.emit('data', 'x'.repeat(20_000) + '\nFinal diagnostic');
    child.emit(event, null, 'SIGTERM');
    await assert.rejects(pending, (error) => {
      assert.match(error.message, /SIGTERM/);
      assert.match(error.message, /Final diagnostic$/);
      assert.ok(error.message.length < 8_300);
      return true;
    });
    assertStartupReleased(child, cancellation.signal);
  });
}

for (const alreadyAborted of [true, false]) {
  test(`startup propagates ${alreadyAborted ? 'pre-existing' : 'mid-start'} cancellation`, bound, async () => {
    const child = childProcess(); const cancellation = new AbortController();
    const reason = new Error('Owner cancelled capture');
    if (alreadyAborted) cancellation.abort(reason);
    const pending = waitForDevtoolsEndpoint(child, { signal: cancellation.signal });
    if (!alreadyAborted) cancellation.abort(reason);
    await assert.rejects(pending, (error) => error === reason);
    assertStartupReleased(child, cancellation.signal);
  });
}

test('startup timeout fails with bounded last diagnostics and releases listeners', bound, async () => {
  const child = childProcess(); const cancellation = new AbortController();
  const pending = waitForDevtoolsEndpoint(child, { signal: cancellation.signal, timeoutMs: 20 });
  child.stderr.emit('data', 'x'.repeat(20_000) + '\nStill starting');
  await assert.rejects(pending, (error) => {
    assert.match(error.message, /within 20 milliseconds/);
    assert.match(error.message, /Still starting$/);
    assert.ok(error.message.length < 8_300);
    return true;
  });
  assertStartupReleased(child, cancellation.signal);
});

test('startup sees a process already recorded as failed or closed', bound, async () => {
  for (const trackedClose of [{ spawnError: new Error('Recorded spawn error') }, { closed: true }]) {
    const child = childProcess(); const cancellation = new AbortController();
    await assert.rejects(waitForDevtoolsEndpoint(child, { signal: cancellation.signal, trackedClose }));
    assertStartupReleased(child, cancellation.signal);
  }
});

test('readiness removes only its own listeners', bound, async () => {
  const child = childProcess(); const cancellation = new AbortController();
  const unrelated = () => {};
  child.stderr.on('data', unrelated); child.on('exit', unrelated);
  cancellation.signal.addEventListener('abort', unrelated);
  const pending = waitForDevtoolsEndpoint(child, { signal: cancellation.signal });
  child.stderr.emit('data', `DevTools listening on ${endpoint}\n`);
  await pending;
  assert.deepEqual(child.stderr.listeners('data'), [unrelated]);
  assert.deepEqual(child.listeners('exit'), [unrelated]);
  assert.deepEqual(getEventListeners(cancellation.signal, 'abort'), [unrelated]);
});

class Socket extends EventTarget {
  readyState = 0;
  closes = 0;
  close() { this.closes += 1; this.readyState = 3; }
}

function assertSocketReleased(socket, signal) {
  for (const name of ['open', 'error', 'close']) assert.equal(getEventListeners(socket, name).length, 0, name);
  assert.equal(getEventListeners(signal, 'abort').length, 0);
}

test('an open DevTools socket transfers without being closed and releases opening listeners', bound, async () => {
  const socket = new Socket(); const cancellation = new AbortController();
  const pending = openDevtoolsSocket(endpoint, { signal: cancellation.signal, createSocket: () => socket });
  socket.readyState = 1; socket.dispatchEvent(new Event('open'));
  assert.equal(await pending, socket);
  assert.equal(socket.closes, 0);
  assertSocketReleased(socket, cancellation.signal);
});

for (const event of ['error', 'close']) {
  test(`DevTools socket ${event} before opening rejects and releases resources`, bound, async () => {
    const socket = new Socket(); const cancellation = new AbortController();
    const pending = openDevtoolsSocket(endpoint, { signal: cancellation.signal, createSocket: () => socket });
    socket.dispatchEvent(new Event(event));
    await assert.rejects(pending, /before opening/);
    assert.equal(socket.closes, 1);
    assertSocketReleased(socket, cancellation.signal);
  });
}

test('DevTools opening timeout closes its socket and releases resources', bound, async () => {
  const socket = new Socket(); const cancellation = new AbortController();
  await assert.rejects(openDevtoolsSocket(endpoint, {
    signal: cancellation.signal, createSocket: () => socket, timeoutMs: 20,
  }), /within 20 milliseconds/);
  assert.equal(socket.closes, 1);
  assertSocketReleased(socket, cancellation.signal);
});

test('pre-aborted DevTools opening does not create a socket', bound, async () => {
  const cancellation = new AbortController(); const reason = new Error('Cancelled before connecting');
  cancellation.abort(reason);
  await assert.rejects(openDevtoolsSocket(endpoint, {
    signal: cancellation.signal, createSocket: () => { assert.fail('Socket must not be created'); },
  }), (error) => error === reason);
  assert.equal(getEventListeners(cancellation.signal, 'abort').length, 0);
});

test('cancellation during DevTools opening closes its socket and preserves the reason', bound, async () => {
  const socket = new Socket(); const cancellation = new AbortController();
  const reason = new Error('Cancelled while connecting');
  const pending = openDevtoolsSocket(endpoint, { signal: cancellation.signal, createSocket: () => socket });
  cancellation.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(socket.closes, 1);
  assertSocketReleased(socket, cancellation.signal);
});
