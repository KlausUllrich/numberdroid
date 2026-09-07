import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { createWorkingProject } from './working-project.js';
import { runBrowserCapture } from './browser-capture-runner.js';

const [chrome, output] = process.argv.slice(2);
assert.equal(process.argv.length, 4);
assert.ok(isAbsolute(chrome ?? '') && isAbsolute(output ?? ''), 'Use absolute Chrome and new evidence paths.');
const outputDirectory = resolve(output); await mkdir(outputDirectory);
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-room-creation-browser-'));
const captureScript = fileURLToPath(new URL('./capture-studio-browser-evidence.js', import.meta.url));
const fingerprint = (view) => createHash('sha256').update(JSON.stringify({ revision: view.revision, snapshot: view.snapshot })).digest('hex');
const close = (running) => new Promise((resolveClose, rejectClose) => running.server.close((error) => error ? rejectClose(error) : resolveClose()));
const cancellation = new AbortController();
process.once('SIGTERM', () => cancellation.abort(new Error('Room creation proof cancelled.')));
process.once('SIGINT', () => cancellation.abort(new Error('Room creation proof cancelled.')));
let complete = false;
try {
  for (const width of [1440, 1060]) {
    cancellation.signal.throwIfAborted();
    const dataDirectory = join(dataRoot, `project-${width}`);
    const { projectId } = await createWorkingProject(dataDirectory, `Room creation browser ${width}`);
    const options = { dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null };
    const capture = async (running, reopened) => {
      const suffix = reopened ? '-reopened' : '';
      const result = await runBrowserCapture(process.execPath, [captureScript, chrome, String(width),
        join(outputDirectory, `room-creation-${width}${suffix}.png`),
        `http://127.0.0.1:${running.address.port}/?roomCreationProject=${encodeURIComponent(projectId)}${reopened ? '&roomCreationPhase=reopen' : ''}#rooms`,
        'room-creation', join(outputDirectory, `room-creation-${width}${suffix}.dom.html`),
      ], { timeout: reopened ? 120_000 : 180_000, signal: cancellation.signal });
      process.stdout.write(result.stdout); process.stderr.write(result.stderr);
    };
    let running = await startStudioHttpServer(options); let beforeRestart;
    try {
      const initial = await running.studioService.readProjectTrusted(projectId);
      assert.equal(initial.revision, 1); assert.equal(initial.snapshot.roomLibrary?.variants.length ?? 0, 0);
      assert.equal(initial.snapshot.assetLibrary?.assets.length ?? 0, 0);
      await capture(running, false);
      beforeRestart = await running.studioService.readProjectTrusted(projectId);
      assert.equal(beforeRestart.revision, 5); assert.equal(beforeRestart.snapshot.roomLibrary.variants.length, 2);
    } finally { await close(running); }
    cancellation.signal.throwIfAborted();
    running = await startStudioHttpServer(options);
    try {
      const reopened = await running.studioService.readProjectTrusted(projectId);
      assert.equal(fingerprint(reopened), fingerprint(beforeRestart));
      await capture(running, true);
      const after = await running.studioService.readProjectTrusted(projectId);
      assert.equal(fingerprint(after), fingerprint(beforeRestart));
      await writeFile(join(outputDirectory, `room-creation-${width}-restart.json`), `${JSON.stringify({ projectId, revision: after.revision, semanticFingerprint: fingerprint(after), identicalAfterRestart: true, browserReopenReadOnly: true }, null, 2)}\n`);
    } finally { await close(running); }
  }
  complete = true;
} finally {
  if (complete) await rm(dataRoot, { recursive: true, force: true });
  else process.stderr.write(`Room creation verification data retained at ${dataRoot}\n`);
}
