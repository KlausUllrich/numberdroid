import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRemoteCredentialFile } from './remote-setup.js';

async function openPrivateTerminal() {
  const terminalPath = process.platform === 'win32' ? 'CONOUT$' : '/dev/tty';
  return open(terminalPath, constants.O_WRONLY);
}

export async function runCreateRemoteCredential(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || !isAbsolute(argv[0])) {
    throw new Error('Usage: remote:credential -- /absolute/path/to/credential.json');
  }
  const terminal = await openPrivateTerminal();
  try {
    const result = await createRemoteCredentialFile({
      filename: resolve(argv[0]),
      revealSecret: async (secret) => {
        await terminal.writeFile(
          `\nNumberdroid Studio owner credential (shown once):\n${secret}\n\nStore it in a password manager. The verifier file contains no reusable secret.\n`,
          'utf8',
        );
      },
    });
    process.stdout.write(`Remote credential verifier created at ${result.path}.\n`);
  } finally {
    await terminal.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCreateRemoteCredential().catch(() => {
    process.stderr.write('Remote credential creation failed. No credential value was logged.\n');
    process.exitCode = 1;
  });
}
