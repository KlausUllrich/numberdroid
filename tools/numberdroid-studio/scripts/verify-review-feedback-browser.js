import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { prepareReviewFeedbackEvidence } from './prepare-review-feedback-evidence.js';

const [chrome, output] = process.argv.slice(2);
if (process.argv.length !== 4 || !isAbsolute(chrome ?? '') || !isAbsolute(output ?? '')) {
  throw new Error('Usage: verify-review-feedback-browser.js ABSOLUTE_CHROME ABSOLUTE_NEW_OUTPUT');
}
const outputDirectory = resolve(output);
await mkdir(outputDirectory, { recursive: false });
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-feedback-browser-'));
const capture = fileURLToPath(new URL('./capture-studio-browser-evidence.js', import.meta.url));
const run = promisify(execFile);
let complete = false;
try {
  for (const width of [1440, 1060]) {
    const dataDirectory = join(dataRoot, `fixture-${width}`);
    await prepareReviewFeedbackEvidence(dataDirectory);
    const running = await startStudioHttpServer({
      dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite',
      pairingEnabled: false, operationsConfigurationFilename: null,
    });
    try {
      const address = `http://127.0.0.1:${running.address.port}/#tasks`;
      const result = await run(process.execPath, [capture, chrome, String(width),
        join(outputDirectory, `review-feedback-${width}.png`), address, 'review-feedback',
        join(outputDirectory, `review-feedback-${width}.dom.html`)], {
        timeout: 180_000, maxBuffer: 2 * 1024 * 1024,
      });
      process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    } finally {
      await new Promise((resolveClose, reject) => running.server.close((error) => error ? reject(error) : resolveClose()));
    }
  }
  complete = true;
} finally {
  if (complete) await rm(dataRoot, { recursive: true, force: true });
  else process.stderr.write(`Feedback verification data retained at ${dataRoot}\n`);
}
