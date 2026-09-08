import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/cutter-agent-session.js', import.meta.url));
const clientModule = import.meta.resolve('@modelcontextprotocol/client');

async function session(context, { seconds = 30, slow = false, failClose = false } = {}) {
  const scratch = await mkdtemp(join(tmpdir(), 'cutter-session-test-'));
  const hook = join(scratch, 'hook.mjs');
  await writeFile(hook, `
    import { Client } from ${JSON.stringify(clientModule)};
    const originalClose = Client.prototype.close;
    let cancel = null;
    if (${slow}) Client.prototype.callTool = function () {
      process.stdout.write(JSON.stringify({event:'probe-call'})+'\\n');
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve({structuredContent:{late:true}}), 30000);
        cancel = () => { clearTimeout(timer); reject(new Error('cancelled')); };
      });
    };
    Client.prototype.close = async function () {
      cancel?.();
      await originalClose.call(this);
      if (${failClose}) throw Object.assign(new Error('injected close failure'), {code:'TEST_CLIENT_CLOSE_FAILED'});
    };
  `);
  const child = spawn(process.execPath, ['--import', pathToFileURL(hook).href, script, '--timeout-seconds', String(seconds)], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  const rows = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output += chunk;
    let newline;
    while ((newline = output.indexOf('\n')) >= 0) {
      rows.push(JSON.parse(output.slice(0, newline)));
      output = output.slice(newline + 1);
    }
  });
  child.stderr.on('data', (chunk) => { errors += chunk; });
  const exited = new Promise((resolveExit) => child.once('close', (code) => resolveExit(code)));
  const watchdog = setTimeout(() => child.kill('SIGKILL'), 25_000);
  context.after(async () => {
    clearTimeout(watchdog);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
    // The process has drained or has been killed; no writer can hold this
    // test-owned hook directory. Retained fixture data is handled explicitly.
    await rm(scratch, { recursive: true, force: true });
  });
  const until = async (predicate, milliseconds = 5000) => {
    const end = Date.now() + milliseconds;
    while (!predicate()) {
      assert.ok(Date.now() < end, `Timed out; rows=${JSON.stringify(rows)} stderr=${errors}`);
      await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    }
  };
  await until(() => rows.some(({ event }) => event === 'ready'));
  const ready = rows.find(({ event }) => event === 'ready');
  return { child, rows, exited, ready, until,
    send(value) { child.stdin.write(`${JSON.stringify(value)}\n`); },
  };
}

for (const reason of ['deadline', 'SIGTERM']) {
  test(`cutter host ${reason} cancels active work and skips its queued backlog`, {
    timeout: 20_000,
    skip: reason === 'SIGTERM' && process.platform === 'win32'
      ? 'Windows terminates the process for SIGTERM; deadline and host/stop cover portable shutdown.' : false,
  }, async (context) => {
    const running = await session(context, { seconds: reason === 'deadline' ? 10 : 30, slow: true });
    for (let index = 0; index < 12; index += 1) running.send({
      id: index, method: 'tools/call', params: { name: 'studio_project_read', arguments: {} },
    });
    await running.until(() => running.rows.some(({ event }) => event === 'probe-call'));
    const started = Date.now();
    if (reason === 'SIGTERM') running.child.kill('SIGTERM');
    assert.equal(await running.exited, 0);
    assert.ok(Date.now() - started < (reason === 'deadline' ? 13_000 : 4000));
    assert.equal(running.rows.filter(({ event }) => event === 'probe-call').length, 1);
    assert.equal(running.rows.find(({ event }) => event === 'stopped').reason, reason);
    await assert.rejects(access(running.ready.fixtureDirectory), { code: 'ENOENT' });
  });
}

test('failed client close still closes the fixture and retains uncertain data', { timeout: 15_000 }, async (context) => {
  const running = await session(context, { failClose: true });
  running.send({ id: 'stop', method: 'host/stop' });
  assert.equal(await running.exited, 1);
  const failure = running.rows.find(({ event }) => event === 'stop-failed');
  assert.equal(failure.code, 'TEST_CLIENT_CLOSE_FAILED');
  assert.equal(failure.retainedDirectory, running.ready.fixtureDirectory);
  await access(failure.retainedDirectory);
  // Natural process exit proves the fixture server/workers were closed even
  // though SDK close failed. Only now remove this exact test-owned fixture.
  await rm(failure.retainedDirectory, { recursive: true, force: true });
});

test('ordinary cutter host restart preserves the semantic bridge and stops cleanly', { timeout: 15_000 }, async (context) => {
  const running = await session(context);
  running.send({ id: 'restart', method: 'host/restart' });
  await running.until(() => running.rows.some(({ id }) => id === 'restart'));
  assert.equal(running.rows.find(({ id }) => id === 'restart').result.restarted, true);
  running.send({ id: 'stop', method: 'host/stop' });
  assert.equal(await running.exited, 0);
  await assert.rejects(access(running.ready.fixtureDirectory), { code: 'ENOENT' });
});
