import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteArtifactMetadataStore,
  SqliteProjectStore,
  createWorkspaceBackup,
  projectSqlitePortableDocument,
  verifyWorkspaceBackup,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { PROJECT_ID, createHarness, createProject } from './test-helpers.js';
import { afterTestCleanup, nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const HASH = 'a'.repeat(64);

async function workspace(context, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  afterTestCleanup(context, () => rm(root, { recursive: true, force: true }));
  const store = await SqliteProjectStore.open({
    filename: join(root, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  afterTestCleanup(context, () => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  return { root, store, studio };
}

function seedPrivateAdoption(database, { state = 'CANCELLED', digest = HASH } = {}) {
  const taskId = 'task.processing.compatibility';
  const branchId = 'branch.task.processing.compatibility';
  const now = '2026-08-28T15:00:00.000Z';
  database.prepare(`
    INSERT INTO agent_tasks(
      project_id, task_id, branch_id, agent_id, grant_id, base_revision, head_revision,
      state, expires_at, created_at, updated_at, task_json, base_document_json, head_document_json
    ) VALUES (?, ?, ?, 'agent.compatibility', NULL, 1, 2, ?, ?, ?, ?, '{}', '{}', '{}')
  `).run(PROJECT_ID, taskId, branchId, state, '2026-08-29T15:00:00.000Z', now, now);
  database.prepare(`
    INSERT INTO task_branch_revisions(
      project_id, task_id, branch_id, branch_revision, revision_id, command_id,
      idempotency_key, command_type, committed_at, revision_json
    ) VALUES (?, ?, ?, 2, 'revision.processing.compatibility', 'cmd.processing.compatibility',
      'idem.processing.compatibility', 'asset.processing-result.adopt', ?, '{}')
  `).run(PROJECT_ID, taskId, branchId, now);
  database.prepare(`
    INSERT INTO task_branch_processing_result_adoptions(
      project_id, task_id, branch_revision, branch_id, command_id, idempotency_key,
      operation, asset_id, asset_kind, asset_version, metadata_version,
      command_fingerprint, semantic_fingerprint, authority_binding_fingerprint,
      preflight_receipt_fingerprint, processing_binding_fingerprint, plan_fingerprint,
      metadata_fingerprint, findings_fingerprint, result_fingerprint,
      record_json, result_json, committed_at, committed_by
    ) VALUES (?, ?, 2, ?, 'cmd.processing.compatibility', 'idem.processing.compatibility',
      'create', 'asset.processing.compatibility', 'prop', 1, 1,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}', ?, 'agent.compatibility')
  `).run(PROJECT_ID, taskId, branchId, HASH, HASH, HASH, HASH, HASH, HASH, HASH, HASH, HASH, now);
  database.prepare(`
    INSERT INTO artifacts(
      digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
    ) VALUES (?, 'studio://artifacts/sha256/' || ?, 'image/png', 33, 1, 1, 'LIVE', ?, ?)
  `).run(digest, digest, now, now);
  database.prepare(`
    INSERT INTO task_branch_processing_result_artifact_references(
      project_id, task_id, branch_revision, role, digest, artifact_uri, media_type,
      byte_size, width, height, verified_at, evidence_fingerprint, evidence_json
    ) VALUES (?, ?, 2, 'recipe-input', ?, 'studio://artifacts/sha256/' || ?,
      'image/png', 33, 1, 1, ?, ?, '{}')
  `).run(PROJECT_ID, taskId, digest, digest, now, HASH);
  return { taskId, branchId, digest };
}

test('private adoption references extend retention roots without widening project authority', async (context) => {
  const { store } = await workspace(context, 'numberdroid-adoption-roots-');
  const seeded = seedPrivateAdoption(store.workspace.database);
  const metadata = new SqliteArtifactMetadataStore({ workspace: store.workspace });
  assert.deepEqual([...metadata.listReferencedDigests()], [seeded.digest]);
  assert.equal(metadata.hasProjectReference(PROJECT_ID, seeded.digest), false);
});

test('portable v1-v3 projection omits terminal private state and rejects merged adoption state', async (context) => {
  const { store } = await workspace(context, 'numberdroid-adoption-bundle-');
  const seeded = seedPrivateAdoption(store.workspace.database, { state: 'CANCELLED' });
  for (const state of ['CANCELLED', 'REJECTED']) {
    store.workspace.database.prepare(`
      UPDATE agent_tasks SET state = ? WHERE project_id = ? AND task_id = ?
    `).run(state, PROJECT_ID, seeded.taskId);
    const portable = projectSqlitePortableDocument({ projectStore: store, projectId: PROJECT_ID });
    assert.deepEqual(portable.artifacts, []);
    assert.doesNotMatch(JSON.stringify(portable.project), /processing\.compatibility|asset\.processing\.compatibility/);
  }
  store.workspace.database.prepare(`
    UPDATE agent_tasks SET state = 'MERGED' WHERE project_id = ? AND task_id = ?
  `).run(PROJECT_ID, seeded.taskId);
  assert.throws(
    () => projectSqlitePortableDocument({ projectStore: store, projectId: PROJECT_ID }),
    (error) => error.code === 'BUNDLE_NOT_QUIESCENT'
      && error.details.taskIds.includes(seeded.taskId),
  );
});

test('v13 verifier and backup remain schema-aware for a v12 workspace', async (context) => {
  const { root, store } = await workspace(context, 'numberdroid-adoption-v12-backup-');
  const database = store.workspace.database;
  database.exec(`
    DROP TABLE task_branch_processing_result_artifact_references;
    DROP TABLE task_branch_processing_result_adoptions;
    DELETE FROM schema_migrations WHERE version = 13;
    PRAGMA user_version = 12;
  `);
  assert.deepEqual(
    [...new SqliteArtifactMetadataStore({ workspace: store.workspace }).listReferencedDigests()],
    [],
  );
  assert.doesNotThrow(() => projectSqlitePortableDocument({ projectStore: store, projectId: PROJECT_ID }));
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'artifacts') });
  const backupDirectory = join(root, 'backup-v12');
  const manifest = await createWorkspaceBackup({
    projectStore: store,
    artifactStore: artifacts,
    destinationDirectory: backupDirectory,
    clock: () => '2026-08-28T16:00:00.000Z',
  });
  assert.equal(manifest.integrity.database.userVersion, 12);
  assert.deepEqual(manifest.artifacts.entries, []);
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
  assert.equal((await new StudioService({ store }).readProjectTrusted(PROJECT_ID)).revision, 1);
});

test('read-only integrity and backup verification reject a re-signed v16 snapshot', async (context) => {
  const { root, store } = await workspace(context, 'numberdroid-adoption-v16-backup-');
  const artifacts = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'artifacts') });
  const backupDirectory = join(root, 'backup-v13');
  await createWorkspaceBackup({
    projectStore: store,
    artifactStore: artifacts,
    destinationDirectory: backupDirectory,
    clock: () => '2026-08-28T16:30:00.000Z',
  });

  store.workspace.database.exec('PRAGMA user_version = 16');
  await assert.rejects(
    verifyWorkspaceIntegrity({ projectStore: store, artifactStore: artifacts }),
    (error) => error.code === 'DATABASE_SCHEMA_TOO_NEW'
      && error.details.userVersion === 16
      && error.details.latestSupported === 15,
  );
  await assert.rejects(
    createWorkspaceBackup({
      projectStore: store,
      artifactStore: artifacts,
      destinationDirectory: join(root, 'backup-v16'),
    }),
    (error) => error.code === 'DATABASE_SCHEMA_TOO_NEW',
  );

  const databasePath = join(backupDirectory, 'studio.sqlite');
  const backupDatabase = nodeSqliteDatabaseFactory(databasePath);
  backupDatabase.exec('PRAGMA user_version = 16');
  backupDatabase.close();
  const manifestPath = join(backupDirectory, 'workspace-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.database.sha256 = createHash('sha256').update(await readFile(databasePath)).digest('hex');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(
    verifyWorkspaceBackup(backupDirectory),
    (error) => error.code === 'DATABASE_SCHEMA_TOO_NEW',
  );
});
