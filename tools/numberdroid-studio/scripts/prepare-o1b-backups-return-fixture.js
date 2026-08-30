import { lstat, mkdir, realpath, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const rootArgument = process.argv[2];
if (typeof rootArgument !== 'string' || !isAbsolute(rootArgument)) {
  throw new Error('Usage: prepare-o1b-backups-return-fixture.js ABSOLUTE_EMPTY_DIRECTORY');
}

const inputStat = await lstat(rootArgument);
if (!inputStat.isDirectory() || inputStat.isSymbolicLink()) {
  throw new Error('The O1b return fixture root must be a real directory.');
}
if ((await readdir(rootArgument)).length !== 0) {
  throw new Error('The O1b return fixture root must be empty.');
}

const fixtureRoot = await realpath(rootArgument);
const liveWorkspaceRoot = join(fixtureRoot, 'live-workspace');
const controlRoot = join(fixtureRoot, 'operations-control');
const backupRoot = join(fixtureRoot, 'backups');
const restoredCopiesRoot = join(fixtureRoot, 'restored-copies');
for (const directory of [liveWorkspaceRoot, controlRoot, backupRoot, restoredCopiesRoot]) {
  await mkdir(directory, { mode: 0o700 });
}

await writeFile(join(fixtureRoot, 'operations.json'), `${JSON.stringify({
  schemaVersion: 1,
  controlRoot,
  backupDestinations: [{
    destinationId: 'backup.return-test',
    label: 'Return-test backups',
    root: backupRoot,
  }],
  restoreDestinations: [{
    destinationId: 'restore.return-test',
    label: 'Return-test restored copies',
    root: restoredCopiesRoot,
  }],
}, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

process.stdout.write('O1b return fixture prepared in the supplied empty directory.\n');
