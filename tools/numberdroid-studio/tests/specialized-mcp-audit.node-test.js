import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { fingerprint } from '../packages/application/src/value-utils.js';
import {
  SqliteAgentAttemptStore,
  SqliteHostBindingStore,
  SqliteJobStore,
  SqliteProjectStore,
} from '../packages/persistence/src/index.js';
import { createStudioHttpServer } from '../apps/studio-server/src/server.js';
import {
  AGENT, OWNER, OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const JOB_INPUT = Object.freeze({
  schemaVersion: 1,
  sourceDigest: 'a'.repeat(64),
  sourceApprovalRevision: 2,
  extractionMode: 'preserve_exact_rect',
  rects: [{ rectangleId: 'rect.audit.1', x: 0, y: 0, width: 1, height: 1 }],
});

async function fixture(context, { faultInjector = null } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-specialized-mcp-audit-'));
  const store = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector,
  });
  const { studio: setupStudio } = createHarness(store);
  await createProject(setupStudio);
  await issueGrant(setupStudio, {
    scopes: ['project.read', 'atlas.write', 'project.status.write'],
  });
  const jobs = new SqliteJobStore({ workspace: store.workspace });
  jobs.create({
    projectId: PROJECT_ID,
    jobId: 'job.audit.1',
    kind: 'ATLAS_PREVIEW',
    inputRevision: 2,
    atlasId: 'atlas.audit',
    sourceId: 'source.audit',
    creator: { actor: AGENT, taskId: 'task.atlas', branchId: 'branch.task.atlas', grantId: 'grant.atlas' },
    outputArtifactBytes: 1,
    inputFingerprint: fingerprint(JOB_INPUT),
    idempotencyKey: 'idem.job.audit.1',
    input: JOB_INPUT,
  });
  const attempts = new SqliteAgentAttemptStore({ workspace: store.workspace });
  const bindings = new SqliteHostBindingStore({ workspace: store.workspace });
  const binding = bindings.issue({
    projectId: PROJECT_ID,
    grantId: 'grant.atlas',
    agentId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    issuedBy: OWNER.id,
  });
  const studio = new StudioService({
    store,
    jobStore: jobs,
    agentAttemptAuditReady: true,
  });
  const server = createStudioHttpServer({
    studioService: studio,
    hostBindingStore: bindings,
    agentAttemptStore: attempts,
    jobStore: jobs,
  });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(async () => {
    await new Promise((resolveClose) => server.close(resolveClose));
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    store,
    studio,
    jobs,
    token: binding.token,
    baseUrl: `http://127.0.0.1:${server.address().port}`,
  };
}

async function privatePost(fixtureValue, path, body) {
  const response = await fetch(`${fixtureValue.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${fixtureValue.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test('specialized MCP routes suppress authorized read polling while persisting failed and denied attempts', async (context) => {
  const value = await fixture(context);

  const read = await privatePost(value, '/internal/mcp/job-read', {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    jobId: 'job.audit.1',
  });
  assert.equal(read.response.status, 200);
  assert.equal(read.body.job.jobId, 'job.audit.1');
  for (let poll = 0; poll < 3; poll += 1) {
    const repeated = await privatePost(value, '/internal/mcp/job-read', {
      schemaVersion: 1, projectId: PROJECT_ID, jobId: 'job.audit.1',
    });
    assert.equal(repeated.response.status, 200);
  }
  assert.equal(value.store.workspace.database.prepare(`
    SELECT count(*) AS count FROM agent_attempts WHERE command_type = 'job.read' AND status = 'AUTHORIZED'
  `).get().count, 0);
  assert.equal((await value.studio.readProjectTrusted(PROJECT_ID)).revision, 2);

  const secret = 'secret-operation-key-must-not-persist';
  const failed = await privatePost(value, '/internal/mcp/job-retry', {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    jobId: 'job.audit.1',
    expectedAttempt: 1,
    operationIdempotencyKey: secret,
  });
  assert.equal(failed.response.status, 409);
  assert.equal(failed.body.error.code, 'JOB_STATE_CONFLICT');
  const failedRow = value.store.workspace.database.prepare(`
    SELECT * FROM agent_attempts WHERE command_type = 'job.retry'
  `).get();
  assert.equal(failedRow.status, 'FAILED');
  assert.equal(failedRow.error_code, 'JOB_STATE_CONFLICT');
  assert.deepEqual(JSON.parse(failedRow.redacted_details_json), { state: 'QUEUED' });
  assert.doesNotMatch(JSON.stringify(failedRow), new RegExp(secret));
  assert.doesNotMatch(JSON.stringify(failedRow), /grant\.atlas|Bearer|studio:\/\/|\/workspace/);

  const badGrid = await privatePost(value, '/internal/mcp/atlas-grid-proposal', {
    schemaVersion: 1,
    projectId: PROJECT_ID,
  });
  assert.equal(badGrid.response.status, 400);
  assert.equal(badGrid.body.error.code, 'VALIDATION_ERROR');
  assert.equal(value.store.workspace.database.prepare(`
    SELECT status FROM agent_attempts WHERE command_type = 'atlas.propose.grid'
  `).get().status, 'FAILED');

  await value.studio.execute(command({
    commandId: 'cmd.audit.revoke',
    idempotencyKey: 'idem.audit.revoke',
    type: 'grant.revoke',
    expectedVersion: 2,
    payload: { grantId: 'grant.atlas', reason: 'Specialized MCP audit denial test.' },
  }), OWNER_CONTEXT);
  const denied = await privatePost(value, '/internal/mcp/job-read', {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    jobId: 'job.audit.1',
  });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.body.error.code, 'GRANT_REVOKED');
  const deniedRow = value.store.workspace.database.prepare(`
    SELECT * FROM agent_attempts WHERE command_type = 'job.read' AND status = 'DENIED'
  `).get();
  assert.equal(deniedRow.project_id, PROJECT_ID);
  assert.equal(deniedRow.target_kind, 'job');
  assert.equal(deniedRow.target_id, 'job.audit.1');
  assert.equal(deniedRow.error_code, 'GRANT_REVOKED');
  assert.deepEqual(JSON.parse(deniedRow.redacted_details_json), {});
  assert.doesNotMatch(JSON.stringify(deniedRow), /grant\.atlas|Bearer|studio:\/\/|\/workspace/);
});

test('authorized attempt rows enforce null error codes and redacted allow-listed details', async (context) => {
  const value = await fixture(context);
  const attempts = new SqliteAgentAttemptStore({ workspace: value.store.workspace });
  const row = attempts.recordAuthorized({
    attemptId: 'attempt.authorized.unit',
    projectId: PROJECT_ID,
    correlationId: 'mcp.authorized.unit',
    actorId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    commandType: 'job.read',
    targetId: PROJECT_ID,
    observedRevision: 2,
    details: { state: 'QUEUED', path: '/secret/path', token: 'secret-token' },
  });
  assert.equal(row.status, 'AUTHORIZED');
  assert.equal(row.errorCode, null);
  assert.deepEqual(row.details, { state: 'QUEUED' });
});

test('successful MCP job mutation and AUTHORIZED audit row roll back together on audit fault', async (context) => {
  let armed = false;
  const value = await fixture(context, {
    faultInjector(point) {
      if (armed && point === 'after_job_authorized_attempt_insert') throw new Error('/private/audit-ledger-path');
    },
  });
  armed = true;
  const response = await privatePost(value, '/internal/mcp/job-cancel', {
    schemaVersion: 1,
    projectId: PROJECT_ID,
    jobId: 'job.audit.1',
    operationIdempotencyKey: 'secret-cancel-key',
  });
  assert.equal(response.response.status, 500);
  assert.equal(response.body.error.code, 'INTERNAL_ERROR');
  assert.doesNotMatch(JSON.stringify(response.body), /private|audit-ledger-path|secret-cancel-key/);
  assert.equal(value.store.workspace.database.prepare(`
    SELECT state FROM jobs WHERE project_id = ? AND job_id = ?
  `).get(PROJECT_ID, 'job.audit.1').state, 'QUEUED');
  const rows = value.store.workspace.database.prepare(`
    SELECT status, target_kind, target_id, redacted_details_json FROM agent_attempts
    WHERE command_type = 'job.cancel'
  `).all();
  assert.deepEqual(rows.map((row) => row.status), ['FAILED']);
  assert.equal(rows[0].target_kind, 'job');
  assert.equal(rows[0].target_id, 'job.audit.1');
  assert.doesNotMatch(JSON.stringify(rows), /private|secret-cancel-key|grant\.atlas/);
});

test('cancel and discard recheck the originating grant inside the audited mutation transaction', async (context) => {
  const value = await fixture(context);
  value.jobs.create({
    projectId: PROJECT_ID,
    jobId: 'job.audit.terminal',
    kind: 'ATLAS_PREVIEW',
    inputRevision: 2,
    atlasId: 'atlas.audit',
    sourceId: 'source.audit',
    creator: { actor: AGENT, taskId: 'task.atlas', branchId: 'branch.task.atlas', grantId: 'grant.atlas' },
    outputArtifactBytes: 1,
    inputFingerprint: fingerprint(JOB_INPUT),
    idempotencyKey: 'idem.job.audit.terminal',
    input: JOB_INPUT,
  });
  value.jobs.requestCancel(PROJECT_ID, 'job.audit.terminal', {
    operationIdempotencyKey: 'owner.cancel.audit.terminal',
  });
  await value.studio.execute(command({
    commandId: 'cmd.audit.revoke.interleaving',
    idempotencyKey: 'idem.audit.revoke.interleaving',
    type: 'grant.revoke',
    expectedVersion: 2,
    payload: { grantId: 'grant.atlas', reason: 'Forced mutation interleaving test.' },
  }), OWNER_CONTEXT);
  const attempt = (jobId, commandType) => ({
    attemptId: `attempt.${commandType}.${jobId}`,
    projectId: PROJECT_ID,
    correlationId: `mcp.${commandType}.${jobId}`,
    actorId: AGENT.id,
    taskId: 'task.atlas',
    branchId: 'branch.task.atlas',
    commandType,
    targetKind: 'job',
    targetId: jobId,
    observedRevision: 3,
  });
  assert.throws(() => value.jobs.requestCancel(PROJECT_ID, 'job.audit.1', {
    operationIdempotencyKey: 'agent.cancel.after-revoke',
    authorizedAttempt: attempt('job.audit.1', 'job.cancel'),
  }), (error) => error.code === 'GRANT_REVOKED');
  assert.equal(value.jobs.get(PROJECT_ID, 'job.audit.1').state, 'QUEUED');
  assert.throws(() => value.jobs.discard(PROJECT_ID, 'job.audit.terminal', {
    operationIdempotencyKey: 'agent.discard.after-revoke',
    authorizedAttempt: attempt('job.audit.terminal', 'job.discard'),
  }), (error) => error.code === 'GRANT_REVOKED');
  assert.equal(value.jobs.get(PROJECT_ID, 'job.audit.terminal').state, 'CANCELLED');
  assert.equal(value.store.workspace.database.prepare(`
    SELECT count(*) AS count FROM agent_attempts WHERE status = 'AUTHORIZED'
  `).get().count, 0);
});
