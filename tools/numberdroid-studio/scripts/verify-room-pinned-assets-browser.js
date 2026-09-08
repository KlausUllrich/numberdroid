import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { PROJECT_ID, closeServer, prepareRoomPinnedAssetsFixture, serverOptions } from './room-pinned-assets-fixture.js';
import { runBrowserCapture } from './browser-capture-runner.js';
const [chrome, output] = process.argv.slice(2); assert.equal(process.argv.length, 4); assert.ok(isAbsolute(chrome ?? '') && isAbsolute(output ?? ''));
const outputDirectory = resolve(output); await mkdir(outputDirectory);
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-pinned-browser-'));
const captureScript = fileURLToPath(new URL('./capture-studio-browser-evidence.js', import.meta.url));
const fingerprint = (view) => createHash('sha256').update(JSON.stringify({ revision: view.revision, snapshot: view.snapshot })).digest('hex');
const cancellation = new AbortController(); process.once('SIGTERM', () => cancellation.abort(new Error('Pinned Asset proof cancelled.'))); process.once('SIGINT', () => cancellation.abort(new Error('Pinned Asset proof cancelled.')));
let complete = false;
try {
  for (const width of [1440, 1060]) {
    cancellation.signal.throwIfAborted(); const directory = join(dataRoot, `fixture-${width}`); await prepareRoomPinnedAssetsFixture(directory);
    const capture = async (running, reopened) => {
      const suffix = reopened ? '-reopened' : '';
      const result = await runBrowserCapture(process.execPath, [captureScript, chrome, String(width), join(outputDirectory, `room-pinned-${width}${suffix}.png`), `http://127.0.0.1:${running.address.port}/${reopened ? '?pinnedPhase=reopen' : ''}#rooms`, 'room-pinned-assets', join(outputDirectory, `room-pinned-${width}${suffix}.dom.html`)], { timeout: reopened ? 120_000 : 180_000, signal: cancellation.signal });
      process.stdout.write(result.stdout); process.stderr.write(result.stderr);
    };
    let running = await startStudioHttpServer(serverOptions(directory)); let beforeRestart;
    try { await capture(running, false); beforeRestart = await running.studioService.readProjectTrusted(PROJECT_ID); assert.equal(beforeRestart.revision, 18); }
    finally { await closeServer(running); }
    cancellation.signal.throwIfAborted(); running = await startStudioHttpServer(serverOptions(directory));
    try {
      assert.equal(fingerprint(await running.studioService.readProjectTrusted(PROJECT_ID)), fingerprint(beforeRestart));
      await capture(running, true); const after = await running.studioService.readProjectTrusted(PROJECT_ID); assert.equal(fingerprint(after), fingerprint(beforeRestart));
      await writeFile(join(outputDirectory, `room-pinned-${width}-restart.json`), `${JSON.stringify({ projectId: PROJECT_ID, revision: after.revision, semanticFingerprint: fingerprint(after), identicalAfterRestart: true, browserReopenReadOnly: true }, null, 2)}\n`);
    } finally { await closeServer(running); }
  }
  complete = true;
} finally { if (complete) await rm(dataRoot, { recursive: true, force: true }); else process.stderr.write(`Pinned Asset verification data retained at ${dataRoot}\n`); }
