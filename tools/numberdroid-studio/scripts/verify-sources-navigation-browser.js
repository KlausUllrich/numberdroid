import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { runBrowserCapture } from './browser-capture-runner.js';

const [chrome, output] = process.argv.slice(2);
if (process.argv.length !== 4 || !isAbsolute(chrome ?? '') || !isAbsolute(output ?? '')) {
  throw new Error('Usage: verify-sources-navigation-browser.js ABSOLUTE_CHROME ABSOLUTE_NEW_OUTPUT');
}

const outputDirectory = resolve(output);
await mkdir(outputDirectory, { recursive: false });
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-sources-navigation-'));
const dataDirectory = join(dataRoot, 'fixture');
const prepare = fileURLToPath(new URL('./prepare-checkpoint-2b-visual-evidence.js', import.meta.url));
const capture = fileURLToPath(new URL('./capture-studio-browser-evidence.js', import.meta.url));
const run = promisify(execFile);
let complete = false;
let running = null;
const cancellation = new AbortController();
process.once('SIGTERM', () => cancellation.abort(new Error('Sources navigation browser verification cancelled.')));
process.once('SIGINT', () => cancellation.abort(new Error('Sources navigation browser verification cancelled.')));
try {
  await run(process.execPath, [prepare, dataDirectory], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
  cancellation.signal.throwIfAborted();
  running = await startStudioHttpServer({
    dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite',
    pairingEnabled: false, operationsConfigurationFilename: null,
  });
  const address = `http://127.0.0.1:${running.address.port}/?visualFixture=checkpoint-2b#sources`;
  for (const width of [1440, 1060]) {
    cancellation.signal.throwIfAborted();
    const result = await runBrowserCapture(process.execPath, [
      capture, chrome, String(width),
      join(outputDirectory, `sources-image-workbench-${width}.png`),
      address, 'sources-navigation',
      join(outputDirectory, `sources-image-workbench-${width}.dom.html`),
    ], { timeout: 180_000, maxBuffer: 2 * 1024 * 1024, signal: cancellation.signal });
    process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  complete = true;
} finally {
  if (running) {
    await new Promise((resolveClose, reject) => running.server.close((error) => error ? reject(error) : resolveClose()));
  }
  if (complete) await rm(dataRoot, { recursive: true, force: true });
  else process.stderr.write(`Sources navigation verification data retained at ${dataRoot}\n`);
}
