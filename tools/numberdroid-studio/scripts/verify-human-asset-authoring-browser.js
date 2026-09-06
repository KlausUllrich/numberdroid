import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const [chrome, output] = process.argv.slice(2);
if (process.argv.length !== 4 || !isAbsolute(chrome ?? '') || !isAbsolute(output ?? '')) {
  throw new Error('Usage: verify-human-asset-authoring-browser.js ABSOLUTE_CHROME ABSOLUTE_NEW_OUTPUT');
}
const outputDirectory = resolve(output);
await mkdir(outputDirectory, { recursive: false });
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-human-asset-browser-'));
const capture = fileURLToPath(new URL('./capture-studio-browser-evidence.js', import.meta.url));
const prepare = fileURLToPath(new URL('./prepare-checkpoint-2b-visual-evidence.js', import.meta.url));
const run = promisify(execFile);
const projectId = 'numberdroid-studio-checkpoint-2b';
const fingerprint = (view) => createHash('sha256').update(JSON.stringify({ revision: view.revision, snapshot: view.snapshot })).digest('hex');
const closeServer = (running) => new Promise((resolveClose, reject) => running.server.close((error) => error ? reject(error) : resolveClose()));
let complete = false;
try {
  for (const width of [1440, 1060]) {
    const dataDirectory = join(dataRoot, `fixture-${width}`);
    await run(process.execPath, [prepare, dataDirectory], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    const options = { dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null };
    let running = await startStudioHttpServer(options);
    let beforeRestart;
    try {
      const initial = await running.studioService.readProjectTrusted(projectId);
      assert.equal(initial.revision, 7);
      assert.equal(initial.snapshot.assetLibrary?.assets.length ?? 0, 0);
      assert.equal(initial.snapshot.roomLibrary?.variants.length ?? 0, 0);
      const result = await run(process.execPath, [capture, chrome, String(width),
        join(outputDirectory, `human-asset-${width}.png`), `http://127.0.0.1:${running.address.port}/#assets`, 'human-asset',
        join(outputDirectory, `human-asset-${width}.dom.html`)], { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
      process.stdout.write(result.stdout); process.stderr.write(result.stderr);
      beforeRestart = await running.studioService.readProjectTrusted(projectId);
      assert.equal(beforeRestart.snapshot.assetLibrary.assets.length, 1);
      assert.equal(beforeRestart.snapshot.roomLibrary.variants.length, 1);
    } finally { await closeServer(running); }
    running = await startStudioHttpServer(options);
    try {
      const reopened = await running.studioService.readProjectTrusted(projectId);
      assert.equal(fingerprint(reopened), fingerprint(beforeRestart));
      const result = await run(process.execPath, [capture, chrome, String(width),
        join(outputDirectory, `human-asset-${width}-reopened.png`), `http://127.0.0.1:${running.address.port}/?authoringPhase=reopen#rooms`, 'human-asset',
        join(outputDirectory, `human-asset-${width}-reopened.dom.html`)], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
      process.stdout.write(result.stdout); process.stderr.write(result.stderr);
      const afterReads = await running.studioService.readProjectTrusted(projectId);
      assert.equal(fingerprint(afterReads), fingerprint(beforeRestart));
      await writeFile(join(outputDirectory, `human-asset-${width}-restart.json`), JSON.stringify({
        projectId, revision: afterReads.revision, semanticFingerprint: fingerprint(afterReads),
        identicalAfterRestart: true, browserReopenReadOnly: true,
      }, null, 2) + '\n');
    } finally { await closeServer(running); }
  }
  complete = true;
} finally {
  if (complete) await rm(dataRoot, { recursive: true, force: true });
  else process.stderr.write(`Human Asset verification data retained at ${dataRoot}\n`);
}
