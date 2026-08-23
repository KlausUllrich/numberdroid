import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprint } from '../packages/application/src/value-utils.js';
import { canonicalRgbaPngByteSize } from '../packages/domain/src/index.js';
import { SqliteAgentAttemptStore, SqliteJobStore, SqliteProjectStore } from '../packages/persistence/src/index.js';
import { createHarness, createProject, PROJECT_ID } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const INPUT = Object.freeze({
  schemaVersion: 1,
  sourceDigest: 'a'.repeat(64),
  sourceApprovalRevision: 1,
  extractionMode: 'preserve_exact_rect',
  rectangles: [{ rectangleId: 'rect.1', x: 3, y: 3, width: 622, height: 622, included: true }],
});
const OUTPUT_BYTES = canonicalRgbaPngByteSize(622, 622);

async function fixture(context, { faultInjector = null, prefix = 'numberdroid-jobs-' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const filename = join(directory, 'studio.sqlite');
  const projectStore = await SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector,
  });
  await createProject(createHarness(projectStore).studio);
  context.after(async () => {
    projectStore.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, filename, projectStore, jobs: new SqliteJobStore({ workspace: projectStore.workspace }) };
}

function createJob(jobs, overrides = {}) {
  const input = overrides.input ?? INPUT;
  return jobs.create({
    projectId: PROJECT_ID,
    jobId: 'job.preview.1',
    kind: 'ATLAS_PREVIEW',
    inputRevision: 1,
    atlasId: 'atlas.family-hygiene',
    sourceId: 'source.family-hygiene',
    creator: { actor: { kind: 'human', id: 'designer.one' }, taskId: null, branchId: 'branch.main', grantId: null },
    outputArtifactBytes: OUTPUT_BYTES,
    inputFingerprint: fingerprint(input),
    idempotencyKey: 'idem.job.preview.1',
    input,
    createdAt: '2026-08-21T13:00:00.000Z',
    ...overrides,
  });
}

test('schema v7 creates an idempotent durable job and monotonic initial event', async (context) => {
  const { projectStore, jobs } = await fixture(context);
  assert.equal(projectStore.integrityCheck().userVersion, 11);
  const created = createJob(jobs);
  assert.equal(created.replayed, false);
  assert.equal(created.state, 'QUEUED');
  assert.equal(created.attempt, 1);
  assert.equal(created.inputFingerprint, fingerprint(INPUT));
  assert.deepEqual(jobs.listEvents(PROJECT_ID, created.jobId).map((event) => [event.sequence, event.type, event.state]), [
    [1, 'QUEUED', 'QUEUED'],
  ]);

  const replay = createJob(jobs, { jobId: 'job.preview.replayed' });
  assert.equal(replay.replayed, true);
  assert.equal(replay.jobId, created.jobId);
  await assert.rejects(
    async () => createJob(jobs, {
      input: { ...INPUT, sourceApprovalRevision: 2 },
      inputFingerprint: fingerprint({ ...INPUT, sourceApprovalRevision: 2 }),
    }),
    (error) => error.code === 'IDEMPOTENCY_CONFLICT',
  );
});

test('migration 0007 rolls back at its version boundary and resumes cleanly', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-job-migration-'));
  const filename = join(directory, 'studio.sqlite');
  context.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (point === 'after_migration_7') throw new Error('migration 0007 boundary fault');
    },
  }), /migration 0007 boundary fault/);
  const { DatabaseSync } = await import('node:sqlite');
  const interrupted = new DatabaseSync(filename);
  assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 6);
  assert.equal(interrupted.prepare(`
    SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'jobs'
  `).get().count, 0);
  interrupted.close();
  const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  assert.equal(resumed.integrityCheck().userVersion, 11);
  resumed.close();
});

test('migration 0008 rolls back before/after its boundary, preserves failures, and enables authorized job targets', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-attempt-v8-migration-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const { DatabaseSync } = await import('node:sqlite');
  for (const boundary of ['before_migration_8', 'after_migration_8']) {
    const filename = join(directory, `${boundary}.sqlite`);
    await assert.rejects(SqliteProjectStore.open({
      filename,
      databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(point) { if (point === boundary) throw new Error(`${boundary} fault`); },
    }), new RegExp(`${boundary} fault`));
    const interrupted = new DatabaseSync(filename);
    assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 7);
    interrupted.prepare(`
      INSERT INTO projects(project_id, format_version, created_at, head_revision, head_snapshot_json, summary_json)
      VALUES (?, 1, ?, 1, '{}', '{}')
    `).run(PROJECT_ID, '2026-08-21T12:00:00.000Z');
    interrupted.prepare(`
      INSERT INTO agent_attempts(
        attempt_id, project_id, correlation_id, actor_id, task_id, branch_id,
        command_id, command_type, target_kind, target_id, observed_revision,
        status, error_code, redacted_details_json, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'job.retry', 'project', ?, 1, 'DENIED', 'GRANT_REVOKED', '{}', ?)
    `).run(`attempt.${boundary}`, PROJECT_ID, `mcp.${boundary}`, 'atlas.agent', 'task.atlas', 'branch.task.atlas', PROJECT_ID, '2026-08-21T12:00:01.000Z');
    interrupted.close();
    const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
    assert.equal(resumed.integrityCheck().userVersion, 11);
    assert.equal(resumed.workspace.database.prepare('SELECT status FROM agent_attempts').get().status, 'DENIED');
    assert.ok(resumed.workspace.database.prepare(`
      SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'agent_attempts_project_occurred'
    `).get());
    const attempts = new SqliteAgentAttemptStore({ workspace: resumed.workspace });
    assert.equal(attempts.recordAuthorized({
      attemptId: `attempt.authorized.${boundary}`,
      projectId: PROJECT_ID,
      correlationId: `mcp.authorized.${boundary}`,
      actorId: 'atlas.agent',
      taskId: 'task.atlas',
      branchId: 'branch.task.atlas',
      commandType: 'job.read',
      targetKind: 'job',
      targetId: 'job.preview.1',
      observedRevision: 1,
    }).status, 'AUTHORIZED');
    resumed.close();
  }
});

test('claim, progress, cooperative cancellation, retry, success, and apply are fully audited', async (context) => {
  const { jobs } = await fixture(context, { prefix: 'numberdroid-job-lifecycle-' });
  createJob(jobs);
  let job = jobs.claimNext({ workerId: 'worker.one', leaseMs: 10_000, now: '2026-08-21T13:00:01.000Z' });
  assert.equal(job.state, 'RUNNING');
  assert.equal(job.recovered, false);
  job = jobs.updateProgress(PROJECT_ID, job.jobId, {
    workerId: 'worker.one',
    current: 1,
    total: 4,
    safePoint: 'slice.1',
    leaseMs: 10_000,
    now: '2026-08-21T13:00:02.000Z',
  });
  assert.deepEqual(job.progress, { current: 1, total: 4 });
  assert.equal(jobs.requestCancellation(PROJECT_ID, job.jobId, {
    operationIdempotencyKey: 'op.cancel.request.1',
    now: '2026-08-21T13:00:03.000Z',
  }).cancelRequested, true);
  job = jobs.cancelAtSafePoint(PROJECT_ID, job.jobId, {
    workerId: 'worker.one',
    safePoint: 'slice.1.complete',
    operationIdempotencyKey: 'op.cancel.safe.1',
    now: '2026-08-21T13:00:04.000Z',
  });
  assert.equal(job.state, 'CANCELLED');

  job = jobs.retry(PROJECT_ID, job.jobId, {
    expectedAttempt: 1,
    operationIdempotencyKey: 'op.retry.1',
    now: '2026-08-21T13:00:05.000Z',
  });
  assert.equal(job.state, 'QUEUED');
  assert.equal(job.attempt, 2);
  assert.equal(jobs.retry(PROJECT_ID, job.jobId, {
    expectedAttempt: 1,
    operationIdempotencyKey: 'op.retry.1',
    now: '2026-08-21T13:00:05.000Z',
  }).replayed, true);

  job = jobs.claimNext({ workerId: 'worker.two', leaseMs: 10_000, now: '2026-08-21T13:00:06.000Z' });
  assert.equal(job.attempt, 2);
  job = jobs.succeed(PROJECT_ID, job.jobId, {
    workerId: 'worker.two',
    outputs: [{
      rectangleId: 'rect.1', digest: 'b'.repeat(64), mediaType: 'image/png',
      byteSize: OUTPUT_BYTES, width: 622, height: 622,
    }],
    result: { completed: 1 },
    operationIdempotencyKey: 'op.succeed.1',
    now: '2026-08-21T13:00:07.000Z',
  });
  assert.equal(job.state, 'SUCCEEDED');
  assert.equal(job.outputs[0].rectangleId, 'rect.1');
  assert.deepEqual(job.result, { completed: 1 });
  assert.equal(jobs.succeed(PROJECT_ID, job.jobId, {
    workerId: 'worker.two',
    outputs: [{
      rectangleId: 'rect.1', digest: 'b'.repeat(64), mediaType: 'image/png',
      byteSize: OUTPUT_BYTES, width: 622, height: 622,
    }],
    result: { completed: 1 },
    operationIdempotencyKey: 'op.succeed.1',
    now: '2026-08-21T13:00:07.000Z',
  }).replayed, true);
  job = jobs.markApplied(PROJECT_ID, job.jobId, {
    appliedRevision: 1,
    operationIdempotencyKey: 'op.apply.1',
    now: '2026-08-21T13:00:08.000Z',
  });
  assert.equal(job.state, 'APPLIED');
  assert.equal(job.appliedRevision, 1);

  const events = jobs.listEvents(PROJECT_ID, job.jobId);
  assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
  assert.deepEqual(events.map((event) => event.type), [
    'QUEUED', 'RUNNING', 'PROGRESS', 'CANCEL_REQUESTED', 'CANCELLED',
    'RETRIED', 'RUNNING', 'SUCCEEDED', 'APPLIED',
  ]);
});

test('an expired running lease is recovered after restart as a new audited attempt', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-job-restart-'));
  const filename = join(directory, 'studio.sqlite');
  let projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  await createProject(createHarness(projectStore).studio);
  let jobs = new SqliteJobStore({ workspace: projectStore.workspace });
  createJob(jobs);
  jobs.claimNext({ workerId: 'worker.crashed', leaseMs: 1000, now: '2026-08-21T13:00:01.000Z' });
  projectStore.close();

  projectStore = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(async () => {
    projectStore.close();
    await rm(directory, { recursive: true, force: true });
  });
  jobs = new SqliteJobStore({ workspace: projectStore.workspace });
  const recovered = jobs.claimNext({ workerId: 'worker.recovered', leaseMs: 1000, now: '2026-08-21T13:00:03.000Z' });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.attempt, 2);
  assert.equal(recovered.lease.owner, 'worker.recovered');
  assert.deepEqual(jobs.listEvents(PROJECT_ID, recovered.jobId).map((event) => event.type), [
    'QUEUED', 'RUNNING', 'RECOVERED',
  ]);
});

test('a cancellation request survives worker loss and closes at the expired-lease safe point', async (context) => {
  const { jobs } = await fixture(context, { prefix: 'numberdroid-job-cancel-recovery-' });
  createJob(jobs);
  const running = jobs.claimNext({ workerId: 'worker.crashed', leaseMs: 1000, now: '2026-08-21T13:00:01.000Z' });
  jobs.requestCancel(PROJECT_ID, running.jobId, {
    operationIdempotencyKey: 'op.cancel.before-crash',
    now: '2026-08-21T13:00:01.500Z',
  });
  assert.equal(jobs.claimNext({ workerId: 'worker.recovery', leaseMs: 1000, now: '2026-08-21T13:00:03.000Z' }), null);
  assert.equal(jobs.get(PROJECT_ID, running.jobId).state, 'CANCELLED');
  assert.deepEqual(jobs.listEvents(PROJECT_ID, running.jobId).map((event) => event.type), [
    'QUEUED', 'RUNNING', 'CANCEL_REQUESTED', 'CANCELLED',
  ]);
  assert.equal(jobs.listEvents(PROJECT_ID, running.jobId).at(-1).safePoint, 'lease_expired_after_cancel');
});

test('fault after a state update rolls back both job state and its event', async (context) => {
  let armed = false;
  const { jobs } = await fixture(context, {
    prefix: 'numberdroid-job-fault-',
    faultInjector(point) {
      if (armed && point === 'after_job_transition_update') throw new Error('simulated job transition fault');
    },
  });
  createJob(jobs);
  const running = jobs.claimNext({ workerId: 'worker.one', leaseMs: 10_000, now: '2026-08-21T13:00:01.000Z' });
  armed = true;
  assert.throws(() => jobs.succeed(PROJECT_ID, running.jobId, {
    workerId: 'worker.one',
    outputs: [{
      rectangleId: 'rect.1', digest: 'b'.repeat(64), mediaType: 'image/png',
      byteSize: OUTPUT_BYTES, width: 622, height: 622,
    }],
    result: { completed: 0 },
    operationIdempotencyKey: 'op.succeed.fault',
    now: '2026-08-21T13:00:02.000Z',
  }), /simulated job transition fault/);
  assert.equal(jobs.get(PROJECT_ID, running.jobId).state, 'RUNNING');
  assert.deepEqual(jobs.listEvents(PROJECT_ID, running.jobId).map((event) => event.type), ['QUEUED', 'RUNNING']);
});

test('queued cancellation is immediate and failure/retry cannot bypass state or attempt guards', async (context) => {
  const { jobs } = await fixture(context, { prefix: 'numberdroid-job-guards-' });
  let job = createJob(jobs);
  job = jobs.requestCancellation(PROJECT_ID, job.jobId, {
    operationIdempotencyKey: 'op.cancel.queued',
    now: '2026-08-21T13:00:01.000Z',
  });
  assert.equal(job.state, 'CANCELLED');
  assert.equal(jobs.claimNext({ workerId: 'worker.one', leaseMs: 1000, now: '2026-08-21T13:00:02.000Z' }), null);
  assert.throws(() => jobs.markApplied(PROJECT_ID, job.jobId, {
    appliedRevision: 1,
    operationIdempotencyKey: 'op.apply.invalid',
    now: '2026-08-21T13:00:02.000Z',
  }), (error) => error.code === 'JOB_STATE_CONFLICT');
  assert.throws(() => jobs.retry(PROJECT_ID, job.jobId, {
    expectedAttempt: 2,
    operationIdempotencyKey: 'op.retry.invalid',
    now: '2026-08-21T13:00:03.000Z',
  }), (error) => error.code === 'JOB_ATTEMPT_CONFLICT');

  const failedJob = createJob(jobs, {
    jobId: 'job.preview.failed',
    idempotencyKey: 'idem.job.preview.failed',
  });
  const running = jobs.claimNext({ workerId: 'worker.failure', leaseMs: 1000, now: '2026-08-21T13:00:04.000Z' });
  assert.equal(running.jobId, failedJob.jobId);
  const failed = jobs.fail(PROJECT_ID, running.jobId, {
    workerId: 'worker.failure',
    error: { code: 'PNG_AUDIT_FAILED', retryable: true },
    operationIdempotencyKey: 'op.fail.1',
    now: '2026-08-21T13:00:05.000Z',
  });
  assert.equal(failed.state, 'FAILED');
  assert.deepEqual(failed.error, { code: 'PNG_AUDIT_FAILED', retryable: true });
  assert.equal(jobs.retry(PROJECT_ID, failed.jobId, {
    expectedAttempt: 1,
    operationIdempotencyKey: 'op.retry.failed',
    now: '2026-08-21T13:00:06.000Z',
  }).attempt, 2);
});

test('job kind and retry work are bounded to the audited Checkpoint 2B contract', async (context) => {
  const { jobs } = await fixture(context, { prefix: 'numberdroid-job-bounds-' });
  assert.throws(() => createJob(jobs, { kind: 'OTHER_JOB', jobId: 'job.unsupported', idempotencyKey: 'idem.unsupported' }),
    (error) => error.code === 'JOB_KIND_UNSUPPORTED');
  let job = createJob(jobs);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    job = jobs.requestCancel(PROJECT_ID, job.jobId, {
      operationIdempotencyKey: `op.bound.cancel.${attempt}`,
      now: `2026-08-21T13:00:0${attempt}.000Z`,
    });
    assert.equal(job.state, 'CANCELLED');
    if (attempt < 3) {
      job = jobs.retry(PROJECT_ID, job.jobId, {
        expectedAttempt: attempt,
        operationIdempotencyKey: `op.bound.retry.${attempt}`,
        now: `2026-08-21T13:00:1${attempt}.000Z`,
      });
    }
  }
  assert.throws(() => jobs.retry(PROJECT_ID, job.jobId, {
    expectedAttempt: 3,
    operationIdempotencyKey: 'op.bound.retry.exhausted',
    now: '2026-08-21T13:00:20.000Z',
  }), (error) => error.code === 'JOB_ATTEMPT_LIMIT');
});

test('a stale reclaimed worker cannot publish or recreate a temporary reference after apply', async (context) => {
  const { projectStore, jobs } = await fixture(context, { prefix: 'numberdroid-job-stale-publish-' });
  const created = createJob(jobs);
  jobs.claimNext({ workerId: 'worker.stale', leaseMs: 1_000, now: '2026-08-21T13:00:01.000Z' });
  const current = jobs.claimNext({ workerId: 'worker.current', leaseMs: 10_000, now: '2026-08-21T13:00:03.000Z' });
  assert.equal(current.recovered, true);
  assert.equal(current.attempt, 2);
  const artifact = {
    digest: 'c'.repeat(64),
    uri: `studio://artifacts/sha256/${'c'.repeat(64)}`,
    mediaType: 'image/png', byteSize: OUTPUT_BYTES, width: 622, height: 622,
  };
  assert.throws(() => jobs.publishOutput(PROJECT_ID, created.jobId, {
    workerId: 'worker.stale', rectangleId: 'rect.1', artifact,
    current: 1, total: 1, safePoint: 'stale.after.crop', leaseMs: 1_000,
    now: '2026-08-21T13:00:03.100Z',
  }), (error) => error.code === 'JOB_LEASE_LOST');
  assert.equal(projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).get(PROJECT_ID, created.jobId).count, 0);

  jobs.publishOutput(PROJECT_ID, created.jobId, {
    workerId: 'worker.current', rectangleId: 'rect.1', artifact,
    current: 1, total: 1, safePoint: 'current.after.crop', leaseMs: 10_000,
    now: '2026-08-21T13:00:03.200Z',
  });
  jobs.succeed(PROJECT_ID, created.jobId, {
    workerId: 'worker.current', outputs: [{
      rectangleId: 'rect.1', digest: artifact.digest, mediaType: artifact.mediaType,
      byteSize: artifact.byteSize, width: artifact.width, height: artifact.height,
    }],
    result: { completed: 1 }, operationIdempotencyKey: 'op.stale-race.succeed',
    now: '2026-08-21T13:00:04.000Z',
  });
  jobs.markApplied(PROJECT_ID, created.jobId, {
    appliedRevision: 1, operationIdempotencyKey: 'op.stale-race.apply',
    now: '2026-08-21T13:00:05.000Z',
  });
  projectStore.workspace.database.prepare(`
    DELETE FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).run(PROJECT_ID, created.jobId);
  assert.throws(() => jobs.publishOutput(PROJECT_ID, created.jobId, {
    workerId: 'worker.stale', rectangleId: 'rect.1', artifact,
    current: 1, total: 1, safePoint: 'stale.after.apply', leaseMs: 1_000,
    now: '2026-08-21T13:00:06.000Z',
  }), (error) => ['JOB_STATE_CONFLICT', 'JOB_LEASE_LOST'].includes(error.code));
  assert.equal(projectStore.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'job_output' AND owner_id = ?
  `).get(PROJECT_ID, created.jobId).count, 0);
});
