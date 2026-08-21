import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  JsonProjectStore,
  SqliteProjectStore,
  createJsonSourceManifest,
  migrateJsonToSqlite,
} from '../packages/persistence/src/index.js';
import { StudioService } from '../packages/application/src/index.js';
import { DEMO_PROJECT_ID, runDemoAction } from '../apps/studio-server/src/demo-project.js';

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultEvidenceDirectory = join(studioRoot, 'fixtures/checkpoint-1a');

function databaseFactory(filename, { timeout = 5000, readonly = false } = {}) {
  return new DatabaseSync(filename, { timeout, readOnly: readonly });
}

function normalizeSourceManifest(manifest) {
  return {
    ...manifest,
    sourceDirectory: 'fixtures/checkpoint-1a/rev6-json',
  };
}

function normalizeParityReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    migrationId: report.migrationId,
    sourceManifestHash: report.sourceManifest.manifestHash,
    destinationSchemaVersion: 1,
    status: report.status,
    integrity: report.integrity,
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
  let store;
  try {
    const sourceManifest = normalizeSourceManifest(await createJsonSourceManifest(sourceDirectory));
    const destinationDirectory = join(temporary, 'sqlite-destination');
    store = await SqliteProjectStore.open({
      filename: join(destinationDirectory, 'studio.sqlite'),
      databaseFactory,
    });
    const report = await migrateJsonToSqlite({
      sourceDirectory,
      destinationDirectory,
      store,
      migrationId: 'checkpoint-1a-to-1b',
      clock: () => '2026-08-21T14:00:00.000Z',
    });
    return {
      sourceManifest,
      parityReport: normalizeParityReport(report),
    };
  } finally {
    store?.close();
    await rm(temporary, { recursive: true, force: true });
  }
}

async function verifyProtectedBehavior(evidenceDirectory, expected) {
  const temporary = await mkdtemp(join(tmpdir(), 'numberdroid-c1a-behavior-'));
  const workingDirectory = join(temporary, 'json-ledger');
  try {
    await mkdir(workingDirectory, { recursive: true });
    await copyFile(
      join(evidenceDirectory, 'json-ledger', expected.fixtureFilename),
      join(workingDirectory, expected.fixtureFilename),
    );
    const studio = new StudioService({
      store: new JsonProjectStore({ directory: workingDirectory }),
      clock: () => '2026-08-21T13:44:00.000Z',
    });
    const before = await studio.readProjectTrusted(DEMO_PROJECT_ID);
    const retry = await runDemoAction(studio, 'idempotent-retry');
    let staleCode;
    try { await runDemoAction(studio, 'stale-write'); } catch (error) { staleCode = error.code; }
    const revoke = await runDemoAction(studio, 'revoke-grant');
    let deniedCode;
    try { await runDemoAction(studio, 'post-revoke-attempt'); } catch (error) { deniedCode = error.code; }
    const restarted = new StudioService({
      store: new JsonProjectStore({ directory: workingDirectory }),
      clock: () => '2026-08-21T13:45:00.000Z',
    });
    const after = await restarted.readProjectTrusted(DEMO_PROJECT_ID);
    const observed = {
      revision5: {
        headRevision: before.revision,
        activityCount: before.revision,
        counts: {
          grants: before.snapshot.grants.length,
          sources: before.snapshot.sources.length,
          assets: before.snapshot.assets.length,
          rooms: before.snapshot.rooms.length,
          levels: before.snapshot.levels.length,
        },
      },
      controls: {
        idempotentRetry: { resultRevision: retry.revision, replayed: retry.replayed },
        staleWrite: { errorCode: staleCode },
        revokeGrant: { resultRevision: revoke.revision },
        postRevokeAttempt: { errorCode: deniedCode },
      },
      revision6: {
        headRevision: after.revision,
        activityCount: after.revision,
        sourceCount: after.snapshot.sources.length,
        absentSourceId: !after.snapshot.sources.some((source) => source.id === 'source.should-be-denied'),
        grant: {
          id: after.snapshot.grants[0].id,
          status: after.snapshot.grants[0].status,
          revokeReason: after.snapshot.grants[0].revokeReason,
          commandsUsed: after.snapshot.grants[0].usage.commands,
        },
      },
    };
    assert.deepEqual(observed, expected.observed, 'Protected 1A control behavior changed.');
    assert.deepEqual(
      await readFile(join(workingDirectory, expected.fixtureFilename)),
      await readFile(join(evidenceDirectory, 'rev6-json', expected.fixtureFilename)),
      'Protected control flow no longer produces the frozen revision-6 ledger.',
    );
    return observed;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function verifyCheckpoint1aEvidence({ evidenceDirectory = defaultEvidenceDirectory } = {}) {
  const captured = await captureCheckpoint1aEvidence({ evidenceDirectory });
  const expectedManifest = JSON.parse(await readFile(join(evidenceDirectory, 'source-manifest.json'), 'utf8'));
  const expectedParity = JSON.parse(await readFile(join(evidenceDirectory, 'parity-report.json'), 'utf8'));
  const acceptance = JSON.parse(await readFile(join(evidenceDirectory, 'acceptance-manifest.json'), 'utf8'));
  const expectedBehavior = JSON.parse(await readFile(join(evidenceDirectory, 'expected-behavior.json'), 'utf8'));
  assert.deepEqual(captured.sourceManifest, expectedManifest, 'Frozen 1A JSON fixture or manifest changed.');
  assert.deepEqual(captured.parityReport, expectedParity, '1A to 1B SQLite parity changed.');
  assert.equal(acceptance.baselineCommit, '2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d');
  assert.equal(acceptance.sourceManifestHash, expectedManifest.manifestHash);
  assert.equal(acceptance.expected.projectId, expectedParity.projects[0].projectId);
  assert.equal(acceptance.expected.migrationHeadRevision, expectedParity.projects[0].headRevision);
  assert.equal(acceptance.expected.migrationActivityCount, expectedParity.projects[0].activityCount);
  await verifyProtectedBehavior(evidenceDirectory, expectedBehavior);
  return {
    schemaVersion: 1,
    status: 'VERIFIED',
    baselineCommit: acceptance.baselineCommit,
    sourceManifestHash: expectedManifest.manifestHash,
    projectId: expectedParity.projects[0].projectId,
    headRevision: expectedParity.projects[0].headRevision,
    activityCount: expectedParity.projects[0].activityCount,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyCheckpoint1aEvidence();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
