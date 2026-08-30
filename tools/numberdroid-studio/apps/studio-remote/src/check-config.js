import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRemoteConfigurationFile } from './remote-config.js';
import { readRemoteCredentialFile } from './remote-credential.js';
import { validateRemoteStorage } from './remote-storage.js';

export async function checkRemoteConfiguration(filename) {
  if (typeof filename !== 'string' || !isAbsolute(filename)) {
    throw new Error('An absolute remote configuration filename is required.');
  }
  const configuration = await readRemoteConfigurationFile(resolve(filename));
  await validateRemoteStorage(configuration);
  await readRemoteCredentialFile(configuration.credentialFile);
  return Object.freeze({ valid: true, publicOrigin: configuration.publicOrigin });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: remote:check -- /absolute/path/to/remote.json\n');
    process.exitCode = 1;
  } else {
    checkRemoteConfiguration(process.argv[2]).then((result) => {
      process.stdout.write(`Remote configuration is valid for ${result.publicOrigin}.\n`);
    }).catch(() => {
      process.stderr.write('Remote configuration validation failed.\n');
      process.exitCode = 1;
    });
  }
}
