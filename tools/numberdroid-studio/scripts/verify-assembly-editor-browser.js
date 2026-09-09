import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { prepareAssemblyEditorFixture, ASSEMBLY_FIXTURE_PROJECT } from './prepare-assembly-editor-fixture.js';
import { captureAssemblyEditor } from './capture-assembly-editor-evidence.js';
import { closeBrowserAndRemoveProfile, finishCapture, trackProcessClose } from './browser-process-teardown.js';
import { openDevtoolsSocket, waitForDevtoolsEndpoint } from './browser-devtools-startup.js';

const [chromePath, output] = process.argv.slice(2);
if (process.argv.length !== 4 || !isAbsolute(chromePath ?? '') || !isAbsolute(output ?? '')) throw new Error('Usage: verify-assembly-editor-browser.js ABSOLUTE_CHROME ABSOLUTE_NEW_OUTPUT');
const outputDirectory = resolve(output); await mkdir(outputDirectory, { recursive: false });
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-assembly-browser-')), cancellation = new AbortController();
const cancel = () => cancellation.abort(new Error('Assembly browser verification cancelled.'));
process.once('SIGTERM', cancel); process.once('SIGINT', cancel);
const fingerprint = view => createHash('sha256').update(JSON.stringify({ revision: view.revision, snapshot: view.snapshot })).digest('hex');
const closeServer = running => new Promise((done, reject) => running.server.close(error => error ? reject(error) : done()));

async function browserCapture({ width, url, reopen = false }) {
  const profile = await mkdtemp(join(tmpdir(), 'numberdroid-assembly-chrome-'));
  const child = spawn(chromePath, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--lang=en-US', '--force-device-scale-factor=1', `--window-size=${width},900`,
    '--remote-debugging-port=0', '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const tracked = trackProcessClose(child), pending = new Map(), exceptions = []; let nextId = 0, socket, shuttingDown = false, failure = null;
  const deadline = setTimeout(() => failPending(new Error('Assembly capture exceeded its 180-second deadline.')), 180_000);
  const failPending = error => { failure ??= error; for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); } pending.clear(); };
  const aborted = () => failPending(cancellation.signal.reason); cancellation.signal.addEventListener('abort', aborted, { once: true });
  const devtools = { send(method, params = {}, sessionId) {
    if (!shuttingDown && (failure || cancellation.signal.aborted)) return Promise.reject(failure ?? cancellation.signal.reason);
    const id = ++nextId;
    return new Promise((done, reject) => { const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} exceeded its ten-second deadline.`)); }, 10_000);
      pending.set(id, { done, reject, timer }); try { socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); } catch (error) { clearTimeout(timer); pending.delete(id); reject(error); } });
  } };
  let captureError = null, result;
  try {
    const startup = await waitForDevtoolsEndpoint(child, { trackedClose: tracked, signal: cancellation.signal, timeoutMs: 30_000 });
    process.stdout.write(`${JSON.stringify({ phase: 'chrome-ready', width, reopen, elapsedMs: startup.elapsedMs })}\n`);
    socket = await openDevtoolsSocket(startup.url, { signal: cancellation.signal });
    socket.addEventListener('message', event => { const message = JSON.parse(String(event.data));
      if (message.id) { const p = pending.get(message.id); if (!p) return; clearTimeout(p.timer); pending.delete(message.id); if (message.error) p.reject(new Error(message.error.message)); else p.done(message.result); }
      else if (message.method === 'Runtime.exceptionThrown' && exceptions.length < 100) exceptions.push(message.params.exceptionDetails);
    });
    socket.addEventListener('close', () => { if (!shuttingDown) failPending(new Error('Chrome DevTools closed before capture completed.')); });
    socket.addEventListener('error', () => { if (!shuttingDown) failPending(new Error('Chrome DevTools reported a connection error.')); });
    const browser = await devtools.send('Browser.getVersion'), target = await devtools.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await devtools.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await Promise.all([devtools.send('Page.enable', {}, sessionId), devtools.send('Runtime.enable', {}, sessionId), devtools.send('Network.enable', {}, sessionId),
      devtools.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId)]);
    await devtools.send('Page.navigate', { url }, sessionId); result = await captureAssemblyEditor({ devtools, sessionId, reopen });
    assert.deepEqual(exceptions, [], 'Native browser raised an unhandled runtime error.');
    const screenshot = await devtools.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    const dom = await devtools.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }, sessionId);
    const name = `assembly-${width}${reopen ? '-reopened' : ''}`;
    await writeFile(join(outputDirectory, `${name}.png`), Buffer.from(screenshot.data, 'base64'), { flag: 'wx' });
    await writeFile(join(outputDirectory, `${name}.dom.html`), dom.result.value, { flag: 'wx' });
    await writeFile(join(outputDirectory, `${name}.observation.json`), `${JSON.stringify({ browser, width, ...result }, null, 2)}\n`, { flag: 'wx' });
  } catch (error) { captureError = error; }
  finally {
    clearTimeout(deadline); cancellation.signal.removeEventListener('abort', aborted); shuttingDown = true;
    await finishCapture(captureError, [() => closeBrowserAndRemoveProfile({ child, trackedClose: tracked,
      requestBrowserClose: () => socket ? devtools.send('Browser.close') : Promise.resolve(),
      closeConnection: () => { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Capture connection closed.')); } pending.clear(); socket?.close(); },
      removeProfile: () => rm(profile, { recursive: true, force: true }),
    })]);
  }
  return result;
}

let complete = false;
try {
  for (const width of [1440, 1060]) {
    if (cancellation.signal.aborted) throw cancellation.signal.reason;
    const dataDirectory = join(dataRoot, `fixture-${width}`), fixture = await prepareAssemblyEditorFixture(dataDirectory);
    process.stdout.write(`${JSON.stringify({ phase: 'fixture-ready', width, revision: fixture.revision })}\n`);
    const options = { dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null };
    let running = await startStudioHttpServer(options), saved;
    try { await browserCapture({ width, url: `http://127.0.0.1:${running.address.port}/#assets` }); saved = await running.studioService.readProjectTrusted(ASSEMBLY_FIXTURE_PROJECT); }
    finally { await closeServer(running); }
    running = await startStudioHttpServer(options);
    try { const reopened = await running.studioService.readProjectTrusted(ASSEMBLY_FIXTURE_PROJECT); assert.equal(fingerprint(reopened), fingerprint(saved));
      await browserCapture({ width, url: `http://127.0.0.1:${running.address.port}/#assets`, reopen: true });
      const after = await running.studioService.readProjectTrusted(ASSEMBLY_FIXTURE_PROJECT); assert.equal(fingerprint(after), fingerprint(saved));
      await writeFile(join(outputDirectory, `assembly-${width}-restart.json`), `${JSON.stringify({ schemaVersion: 1, projectId: ASSEMBLY_FIXTURE_PROJECT, revision: after.revision, semanticFingerprint: fingerprint(after), identicalAfterRestart: true, reopenReadOnly: true }, null, 2)}\n`, { flag: 'wx' });
    } finally { await closeServer(running); }
  }
  complete = true;
} finally {
  process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  if (complete) await rm(dataRoot, { recursive: true, force: true }); else process.stderr.write(`Assembly verification data retained at ${dataRoot}\n`);
}
