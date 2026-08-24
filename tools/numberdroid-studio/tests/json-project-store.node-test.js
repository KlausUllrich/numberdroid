import test from 'node:test';
import assert from 'node:assert/strict';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import { JsonProjectStore } from '../packages/persistence/src/index.js';
import { OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject } from './test-helpers.js';

test('JSON adapter atomically persists and reloads the append-only revision ledger', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-studio-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonProjectStore({ directory });
  const { studio } = createHarness(store);
  await createProject(studio);
  await studio.execute(command({
    commandId: 'cmd.active', idempotencyKey: 'idem.active', type: 'project.status.set', expectedVersion: 1,
    payload: { status: 'active' },
  }), OWNER_CONTEXT);

  const reloaded = new StudioService({ store: new JsonProjectStore({ directory }) });
  const project = await reloaded.readProjectTrusted(PROJECT_ID);
  assert.equal(project.revision, 2);
  assert.equal(project.snapshot.project.status, 'active');
  const files = await readdir(directory);
  assert.equal(files.filter((file) => file.endsWith('.json')).length, 1);
  assert.equal(files.filter((file) => file.endsWith('.tmp')).length, 0);
});

test('store compare-and-swap permits only one command at the same expectedVersion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-studio-cas-'));
  try {
    const store = new JsonProjectStore({ directory });
    const { studio } = createHarness(store);
    await createProject(studio);
    const commands = ['active', 'paused'].map((status) => studio.execute(command({
      commandId: `cmd.${status}`, idempotencyKey: `idem.${status}`, type: 'project.status.set', expectedVersion: 1,
      payload: { status },
    }), OWNER_CONTEXT));
    const settled = await Promise.allSettled(commands);
    assert.equal(settled.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(settled.filter((result) => result.status === 'rejected' && result.reason.code === 'REVISION_CONFLICT').length, 1);
    assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
