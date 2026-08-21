import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ContentAddressedArtifactStore,
  JsonProjectStore,
  SqliteProjectStore,
  createJsonSourceManifest,
  migrateJsonToSqlite,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { StudioService } from '../packages/application/src/index.js';
import { DEMO_PROJECT_ID, ensureDemoProject, runDemoAction } from '../apps/studio-server/src/demo-project.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultEvidenceDirectory = join(studioRoot, 'fixtures/checkpoint-1a');
const baselineCommit = '2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function databaseAdapter() {
  try {
    await import('better-sqlite3');
    return { name: 'better-sqlite3', options: {} };
  } catch (productionError) {
    if (process.env.NUMBERDROID_EVIDENCE_REQUIRE_PRODUCTION_ADAPTER === '1') throw productionError;
    const { DatabaseSync } = await import('node:sqlite');
    return {
      name: 'node:sqlite-local-fallback',
      options: {
        databaseFactory(filename, { timeout = 5000, readonly = false } = {}) {
          return new DatabaseSync(filename, { timeout, readOnly: readonly });
        },
      },
    };
  }
}

function normalizeSourceManifest(manifest) {
  return { ...manifest, sourceDirectory: 'fixtures/checkpoint-1a/rev6-json' };
}

function normalizeParityReport(report, workspaceIntegrity, casManifest) {
  // Checkpoint 1A protects the accepted migration evidence identity at the
  // Checkpoint 1B schema boundary. Later additive migrations are verified by
  // current integrity tests, then projected out of this historical contract.
  const {
    sourceIntakes: _sourceIntakes,
    agentAttempts: _agentAttempts,
    jobs: _jobs,
    ...checkpointWorkspaceIntegrity
  } = workspaceIntegrity;
  const checkpointIntegrity = { ...report.integrity, userVersion: 5 };
  checkpointWorkspaceIntegrity.database = {
    ...checkpointWorkspaceIntegrity.database,
    userVersion: 5,
  };
  return {
    schemaVersion: report.schemaVersion,
    migrationId: report.migrationId,
    sourceManifestHash: report.sourceManifest.manifestHash,
    destinationSchemaVersion: 5,
    status: report.status,
    integrity: checkpointIntegrity,
    workspaceIntegrity: checkpointWorkspaceIntegrity,
    casManifest,
    cutoverPerformed: report.cutoverPerformed,
    projects: report.projects.map((project) => ({
      projectId: project.projectId,
      aggregateIds: project.aggregateIds,
      imported: project.imported,
      headRevision: project.headRevision,
      revisionCount: project.revisionCount,
      activityCount: project.activityCount,
      eventOrder: project.eventOrder,
      grantAudit: project.grantAudit,
      historicalDocumentHash: project.historicalDocumentHash,
      sourceProjectionHash: project.sourceProjectionHash,
      expectedEffectiveProjectionHash: project.expectedEffectiveProjectionHash,
      effectiveProjectionHash: project.effectiveProjectionHash,
      legacyGrantCount: project.legacyGrantCount,
      artifactReferences: project.artifactReferences,
      unresolvedArtifacts: project.unresolvedArtifacts,
      validationSummary: project.validationSummary,
    })),
  };
}

export async function captureCheckpoint1aEvidence({ evidenceDirectory = defaultEvidenceDirectory } = {}) {
  const sourceDirectory = join(evidenceDirectory, 'rev6-json');
  const temporary = await mkdtemp(join(tmpdir(), 'numberdroid-c1a-parity-'));
  const adapter = await databaseAdapter();
  let store;
  try {
    const before = await createJsonSourceManifest(sourceDirectory);
    const sourceManifest = normalizeSourceManifest(before);
    const destinationDirectory = join(temporary, 'sqlite-destination');
    store = await SqliteProjectStore.open({
      filename: join(destinationDirectory, 'studio.sqlite'),
      ...adapter.options,
    });
    const migrationOptions = {
      sourceDirectory,
      destinationDirectory,
      store,
      migrationId: 'checkpoint-1a-to-1b',
      clock: () => '2026-08-21T14:00:00.000Z',
    };
    const report = await migrateJsonToSqlite(migrationOptions);
    assert.deepEqual(await createJsonSourceManifest(sourceDirectory), before, 'Migration changed its frozen source.');
    const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(destinationDirectory, 'artifacts') });
    await artifactStore.initialize();
    const workspaceIntegrity = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore });
    assert.equal(workspaceIntegrity.ok, true, JSON.stringify(workspaceIntegrity));
    const casManifest = await artifactStore.createManifest();
    const parityReport = normalizeParityReport(report, workspaceIntegrity, casManifest);
    const retry = await migrateJsonToSqlite(migrationOptions);
    assert.deepEqual(
      normalizeParityReport(retry, workspaceIntegrity, casManifest),
      parityReport,
      'Idempotent migration retry changed parity evidence.',
    );
    return { sourceManifest, parityReport, databaseAdapter: adapter.name };
  } finally {
    store?.close();
    await rm(temporary, { recursive: true, force: true });
  }
}

function activityProjection(events) {
  return events.map((event) => ({
    id: event.id,
    actorId: event.actor.id,
    actorKind: event.actor.kind,
    taskId: event.taskId,
  }));
}

async function readThroughRestartedService(dataDirectory) {
  const child = spawn(process.execPath, [join(studioRoot, 'apps/studio-server/src/server.js')], {
    cwd: studioRoot,
    env: {
      ...process.env,
      NUMBERDROID_STUDIO_DATA: dataDirectory,
      NUMBERDROID_STUDIO_STORE: 'json',
      NUMBERDROID_STUDIO_PORT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    const origin = await new Promise((resolveOrigin, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Restarted service did not listen. ${stderr}`)), 5_000);
      const inspect = () => {
        const match = /Numberdroid Studio: (http:\/\/[^\s]+)/.exec(stdout);
        if (!match) return;
        clearTimeout(timeout);
        resolveOrigin(match[1]);
      };
      child.stdout.on('data', inspect);
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Restarted service exited ${code}. ${stderr}`));
      });
      inspect();
    });
    const [project, activity] = await Promise.all([
      fetch(`${origin}/api/projects/${DEMO_PROJECT_ID}`).then((response) => response.json()),
      fetch(`${origin}/api/projects/${DEMO_PROJECT_ID}/activity`).then((response) => response.json()),
    ]);
    return {
      revision: project.revision,
      activityCount: activity.events.length,
      activity: activityProjection(activity.events),
    };
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolveExit) => {
      if (child.exitCode !== null) resolveExit();
      else child.once('exit', resolveExit);
    });
  }
}

async function verifyProtectedBehavior(evidenceDirectory, expected) {
  const temporary = await mkdtemp(join(tmpdir(), 'numberdroid-c1a-behavior-'));
  const workingDirectory = join(temporary, 'json-ledger');
  try {
    await mkdir(workingDirectory, { recursive: true });
    const fixturePath = join(workingDirectory, expected.fixtureFilename);
    const baselineTimes = [
      '2026-08-21T13:42:52.274Z',
      '2026-08-21T13:42:52.279Z',
      '2026-08-21T13:42:52.283Z',
      '2026-08-21T13:42:52.287Z',
      '2026-08-21T13:42:52.290Z',
    ];
    let clockIndex = 0;
    const studio = new StudioService({
      store: new JsonProjectStore({ directory: workingDirectory }),
      clock: () => baselineTimes[clockIndex++] ?? '2026-08-21T13:44:00.000Z',
    });
    const before = await ensureDemoProject(studio);
    assert.deepEqual(
      await readFile(fixturePath),
      await readFile(join(evidenceDirectory, 'json-ledger', expected.fixtureFilename)),
      'Create/load demo no longer produces the frozen revision-5 ledger.',
    );
    const beforeActivity = await studio.listActivityTrusted(DEMO_PROJECT_ID);
    const retry = await runDemoAction(studio, 'idempotent-retry');
    let staleCode;
    try { await runDemoAction(studio, 'stale-write'); } catch (error) { staleCode = error.code; }
    const revoke = await runDemoAction(studio, 'revoke-grant');
    let deniedCode;
    try { await runDemoAction(studio, 'post-revoke-attempt'); } catch (error) { deniedCode = error.code; }
    const after = await studio.readProjectTrusted(DEMO_PROJECT_ID);
    const afterActivity = await studio.listActivityTrusted(DEMO_PROJECT_ID);
    const restarted = await readThroughRestartedService(workingDirectory);
    const observed = {
      revision5: {
        headRevision: before.revision,
        activityCount: beforeActivity.length,
        activity: activityProjection(beforeActivity),
        counts: {
          grants: before.snapshot.grants.length,
          sources: before.snapshot.sources.length,
          assets: before.snapshot.assets.length,
          rooms: before.snapshot.rooms.length,
          levels: before.snapshot.levels.length,
        },
        projectStatus: before.snapshot.project.status,
      },
      controls: {
        idempotentRetry: { resultRevision: retry.revision, replayed: retry.replayed },
        staleWrite: { errorCode: staleCode },
        revokeGrant: { resultRevision: revoke.revision },
        postRevokeAttempt: { errorCode: deniedCode },
      },
      revision6: {
        headRevision: after.revision,
        activityCount: afterActivity.length,
        activity: activityProjection(afterActivity),
        sourceCount: after.snapshot.sources.length,
        absentSourceId: !after.snapshot.sources.some((source) => source.id === 'source.should-be-denied'),
        grant: {
          id: after.snapshot.grants[0].id,
          status: after.snapshot.grants[0].status,
          revokeReason: after.snapshot.grants[0].revokeReason,
          commandsUsed: after.snapshot.grants[0].usage.commands,
        },
      },
      restarted,
    };
    assert.deepEqual(observed, expected.observed, 'Protected 1A control behavior changed.');
    assert.deepEqual(
      await readFile(fixturePath),
      await readFile(join(evidenceDirectory, 'rev6-json', expected.fixtureFilename)),
      'Protected control flow no longer produces the frozen revision-6 ledger.',
    );
    return observed;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function verifyCommitProvenance() {
  if (process.env.GITHUB_ACTIONS !== 'true') return 'EXPORTED_WORKSPACE_NOT_GIT_VERIFIED';
  const child = spawn('git', ['cat-file', '-e', `${baselineCommit}^{commit}`], { cwd: studioRoot });
  const code = await new Promise((resolveExit) => child.once('exit', resolveExit));
  assert.equal(code, 0, `Baseline commit ${baselineCommit} is absent from the CI checkout.`);
  return 'GIT_COMMIT_VERIFIED';
}

export async function verifyCheckpoint1aEvidence({ evidenceDirectory = defaultEvidenceDirectory } = {}) {
  const captured = await captureCheckpoint1aEvidence({ evidenceDirectory });
  const expectedManifest = JSON.parse(await readFile(join(evidenceDirectory, 'source-manifest.json'), 'utf8'));
  const expectedParity = JSON.parse(await readFile(join(evidenceDirectory, 'parity-report.json'), 'utf8'));
  const acceptance = JSON.parse(await readFile(join(evidenceDirectory, 'acceptance-manifest.json'), 'utf8'));
  const expectedBehavior = JSON.parse(await readFile(join(evidenceDirectory, 'expected-behavior.json'), 'utf8'));
  assert.deepEqual(captured.sourceManifest, expectedManifest, 'Frozen 1A JSON fixture or manifest changed.');
  assert.deepEqual(captured.parityReport, expectedParity, '1A to 1B SQLite/CAS parity changed.');
  assert.equal(acceptance.baselineCommit, baselineCommit);
  assert.equal(acceptance.sourceManifestHash, expectedManifest.manifestHash);
  assert.equal(acceptance.visualFixtureSha256, sha256(await readFile(
    join(evidenceDirectory, 'json-ledger', expectedBehavior.fixtureFilename),
  )));
  const observed = await verifyProtectedBehavior(evidenceDirectory, expectedBehavior);
  const project = expectedParity.projects[0];
  assert.deepEqual(acceptance.expected, {
    projectId: project.projectId,
    visualHeadRevision: observed.revision5.headRevision,
    visualActivityCount: observed.revision5.activityCount,
    migrationHeadRevision: project.headRevision,
    migrationActivityCount: project.activityCount,
    sourceCount: observed.revision5.counts.sources,
    assetCount: observed.revision5.counts.assets,
    projectStatus: observed.revision5.projectStatus,
  });
  const commitProvenance = await verifyCommitProvenance();
  return {
    schemaVersion: 1,
    status: 'VERIFIED',
    baselineCommit: acceptance.baselineCommit,
    commitProvenance,
    databaseAdapter: captured.databaseAdapter,
    sourceManifestHash: expectedManifest.manifestHash,
    projectId: project.projectId,
    headRevision: project.headRevision,
    activityCount: project.activityCount,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyCheckpoint1aEvidence();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
