import assert from 'node:assert/strict';
import test from 'node:test';
import { lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REMOTE_MOUNT_MARKER_FILENAME } from '../apps/studio-remote/src/remote-config.js';
import { readRemoteCredentialFile, verifyRemoteCredential } from '../apps/studio-remote/src/remote-credential.js';
import {
  createRemoteCredentialFile,
  createRemoteMountMarker,
} from '../apps/studio-remote/src/remote-setup.js';

test('O2a setup creates an exclusive verifier and reveals the generated owner secret only to its sink', {
  timeout: 15_000,
}, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o2a-setup-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const filename = join(root, 'credential.json');
  let revealed = null;
  const result = await createRemoteCredentialFile({
    filename,
    revealSecret: async (secret) => { revealed = secret; },
    tokenRandomSource: (size) => Buffer.alloc(size, 0x31),
    verifierRandomSource: (size) => Buffer.alloc(size, 0x32),
  });
  assert.deepEqual(result, { path: filename, revealed: true });
  assert.equal(revealed.length, 43);
  const raw = await readFile(filename, 'utf8');
  assert.equal(raw.includes(revealed), false);
  const credential = await readRemoteCredentialFile(filename);
  assert.equal(await verifyRemoteCredential(revealed, credential), true);
  if (process.platform !== 'win32') {
    assert.equal((await lstat(filename)).mode & 0o7777, 0o600);
  }
  await assert.rejects(createRemoteCredentialFile({
    filename,
    revealSecret: async () => {},
  }), /EEXIST/);
});

test('O2a setup creates one exact mount marker only in a private canonical root', {
  timeout: 5_000,
}, async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-o2a-marker-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const mount = join(root, 'workspace');
  await mkdir(mount, { mode: 0o700 });
  const result = await createRemoteMountMarker({ root: mount, mountId: 'workspace.primary' });
  assert.equal(result.path, join(mount, REMOTE_MOUNT_MARKER_FILENAME));
  assert.deepEqual(JSON.parse(await readFile(result.path, 'utf8')), {
    schemaVersion: 1,
    mountId: 'workspace.primary',
  });
  await assert.rejects(
    createRemoteMountMarker({ root: mount, mountId: 'workspace.primary' }),
    /EEXIST/,
  );
});
