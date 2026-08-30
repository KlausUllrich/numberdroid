import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRemoteMountMarker } from './remote-setup.js';

export async function runCreateRemoteMountMarker(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || !isAbsolute(argv[0])) {
    throw new Error('Usage: remote:mark-mount -- /absolute/private/root mount.id');
  }
  const result = await createRemoteMountMarker({ root: resolve(argv[0]), mountId: argv[1] });
  process.stdout.write(`Remote mount marker ${result.mountId} created at ${result.path}.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCreateRemoteMountMarker().catch(() => {
    process.stderr.write('Remote mount marker creation failed.\n');
    process.exitCode = 1;
  });
}
