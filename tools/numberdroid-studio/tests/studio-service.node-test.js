import test from 'node:test';
import assert from 'node:assert/strict';

// Kept outside Vitest's discovery pattern; this package uses Node's test runner.
import {
  AGENT, AGENT_CONTEXT, OWNER, OWNER_CONTEXT, PROJECT_ID,
  agentSourceCommand, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';

test('commits immutable revisions with attributed activity and a task-scoped grant', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  await issueGrant(studio);
  const result = await studio.execute(agentSourceCommand(), AGENT_CONTEXT);

  assert.equal(result.revision, 3);
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.event.actor.id, AGENT.id);
  assert.equal(result.event.taskId, 'task.atlas');
  const project = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(project.schemaVersion, 1);
  assert.equal(project.snapshot.sources[0].provenance.seed, 742);
  assert.equal((await studio.listActivityTrusted(PROJECT_ID)).length, 3);
  assert.ok(Object.isFrozen(result));
});

test('command boundary rejects unsupported schema versions without mutation', async () => {
  const { studio } = createHarness();
  await assert.rejects(
    studio.execute(command({ schemaVersion: 2 }), OWNER_CONTEXT),
    (error) => error.code === 'SCHEMA_VERSION_UNSUPPORTED',
  );
  await assert.rejects(studio.readProjectTrusted(PROJECT_ID), (error) => error.code === 'PROJECT_NOT_FOUND');
});

test('command DTO cannot carry actor, task, grant, branch, or binding authority', async () => {
  const { studio } = createHarness();
  for (const [field, value] of [
    ['actor', AGENT],
    ['taskId', 'task.forged'],
    ['grantId', 'grant.forged'],
    ['branchId', 'branch.forged'],
    ['bindingToken', 'secret.forged'],
  ]) {
    await assert.rejects(
      studio.execute({ ...command(), [field]: value }, OWNER_CONTEXT),
      (error) => error.code === 'UNTRUSTED_AUTHORITY_FIELD' && error.details.field === field,
    );
  }
  await assert.rejects(studio.readProjectTrusted(PROJECT_ID), (error) => error.code === 'PROJECT_NOT_FOUND');
});

test('denied and stale commands do not mutate project history', async () => {
  const { studio } = createHarness();
  await createProject(studio);

  await assert.rejects(
    studio.execute(agentSourceCommand({ expectedVersion: 1 }), { ...AGENT_CONTEXT, grantId: null }),
    (error) => error.code === 'GRANT_REQUIRED',
  );
  await studio.execute(command({
    commandId: 'cmd.status', idempotencyKey: 'idem.status', type: 'project.status.set', expectedVersion: 1,
    payload: { status: 'active' },
  }), OWNER_CONTEXT);
  await assert.rejects(
    studio.execute(command({
      commandId: 'cmd.stale', idempotencyKey: 'idem.stale', type: 'project.status.set', expectedVersion: 1,
      payload: { status: 'paused' },
    }), OWNER_CONTEXT),
    (error) => error.code === 'REVISION_CONFLICT',
  );
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
  assert.equal((await studio.listActivityTrusted(PROJECT_ID)).length, 2);
});

test('dry runs validate and authorize but persist no revision, event, or idempotency record', async () => {
  const { studio } = createHarness();
  const preview = await studio.execute(command({
    commandId: 'cmd.preview-create', idempotencyKey: 'idem.preview-create', dryRun: true,
  }), OWNER_CONTEXT);
  assert.equal(preview.dryRun, true);
  assert.equal(preview.revision, 0);
  assert.equal(preview.proposal.wouldCreateRevision, 1);
  await assert.rejects(studio.readProjectTrusted(PROJECT_ID), (error) => error.code === 'PROJECT_NOT_FOUND');

  const committed = await studio.execute(command({
    commandId: 'cmd.preview-create', idempotencyKey: 'idem.preview-create', dryRun: false,
  }), OWNER_CONTEXT);
  assert.equal(committed.revision, 1);

  const statusPreview = await studio.execute(command({
    commandId: 'cmd.preview-status', idempotencyKey: 'idem.preview-status', type: 'project.status.set',
    expectedVersion: 1, dryRun: true, payload: { status: 'paused' },
  }), OWNER_CONTEXT);
  assert.equal(statusPreview.proposal.summary, 'Project status changed to paused.');
  assert.deepEqual(statusPreview.proposal.findings, []);
  assert.deepEqual(statusPreview.proposal.requiredCapabilities, ['project.status.write']);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).snapshot.project.status, 'draft');
  assert.equal((await studio.listActivityTrusted(PROJECT_ID)).length, 1);
});

test('idempotency replays exact commands and rejects changed payloads or duplicate command IDs', async () => {
  const { studio } = createHarness();
  const first = await createProject(studio);
  const replay = await studio.execute(command({ commandId: 'cmd.create.retry', idempotencyKey: 'idem.create' }), OWNER_CONTEXT);
  assert.equal(first.revision, replay.revision);
  assert.equal(replay.replayed, true);

  await assert.rejects(
    studio.execute(command({ idempotencyKey: 'idem.create', payload: { name: 'Changed', ownerId: OWNER.id } }), OWNER_CONTEXT),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
  await assert.rejects(
    studio.execute(command({
      commandId: 'cmd.create', idempotencyKey: 'idem.other', type: 'project.status.set', expectedVersion: 1,
      payload: { status: 'active' },
    }), OWNER_CONTEXT),
    (error) => error.code === 'COMMAND_ID_CONFLICT',
  );
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 1);
});

test('generic project lifecycle cannot claim approval or export', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  for (const forbiddenStatus of ['approved', 'exported']) {
    await assert.rejects(
      studio.execute(command({
        commandId: `cmd.${forbiddenStatus}`, idempotencyKey: `idem.${forbiddenStatus}`,
        type: 'project.status.set', expectedVersion: 1, payload: { status: forbiddenStatus },
      }), OWNER_CONTEXT),
      (error) => error.code === 'VALIDATION_ERROR',
    );
  }
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 1);
});

test('asset.write cannot claim approval and C1A enforces project/aggregate version equality', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  await issueGrant(studio);
  await studio.execute(agentSourceCommand(), AGENT_CONTEXT);
  await assert.rejects(
    studio.execute(command({
      commandId: 'cmd.asset-approved', idempotencyKey: 'idem.asset-approved', type: 'asset.define',
      expectedVersion: 3,
      payload: {
        assetId: 'tile.fake-approved', sourceId: 'source.atlas', name: 'Not approved', kind: 'surface',
        region: { x: 0, y: 0, width: 128, height: 128 }, status: 'approved',
      },
    }), AGENT_CONTEXT),
    (error) => error.code === 'VALIDATION_ERROR',
  );
  await assert.rejects(
    studio.execute(command({
      commandId: 'cmd.version-mismatch', idempotencyKey: 'idem.version-mismatch', type: 'project.status.set',
      baseRevision: 2, expectedVersion: 3, payload: { status: 'active' },
    }), OWNER_CONTEXT),
    (error) => error.code === 'VERSION_INVARIANT_VIOLATION',
  );
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 3);
});

test('artifact payloads are references rather than embedded base64 data', async () => {
  const { studio } = createHarness();
  await createProject(studio);
  await issueGrant(studio);
  await assert.rejects(
    studio.execute(agentSourceCommand({
      payload: { ...agentSourceCommand().payload, artifactUri: 'data:image/png;base64,abc' },
    }), AGENT_CONTEXT),
    (error) => error.code === 'EMBEDDED_ARTIFACT_FORBIDDEN',
  );
  await assert.rejects(
    studio.execute(agentSourceCommand({
      commandId: 'cmd.nested-data-uri',
      idempotencyKey: 'idem.nested-data-uri',
      payload: {
        ...agentSourceCommand().payload,
        provenance: {
          ...agentSourceCommand().payload.provenance,
          references: [{ uri: '  data:image/png;base64,nested' }],
        },
      },
    }), AGENT_CONTEXT),
    (error) => error.code === 'EMBEDDED_ARTIFACT_FORBIDDEN' && error.details.field === 'payload.provenance.references[0].uri',
  );
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 2);
});
