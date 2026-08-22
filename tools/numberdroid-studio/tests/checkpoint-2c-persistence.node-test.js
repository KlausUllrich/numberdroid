import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteArtifactMetadataStore,
  SqliteJobStore,
  SqliteProjectStore,
  SqliteSourceIntakeStore,
  loadMigrationDefinitions,
  runSqliteMigrations,
} from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import {
  AGENT_CONTEXT, OWNER_CONTEXT, PROJECT_ID, command, createHarness, createProject, issueGrant,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const SOURCE_DIGEST = 'a'.repeat(64);
const SLICE_DIGEST = 'b'.repeat(64);
const FINGERPRINT = 'c'.repeat(64);
const FINDINGS_FINGERPRINT = 'd'.repeat(64);
const BUNDLE_DIGEST = 'e'.repeat(64);
const MANIFEST_DIGEST = 'f'.repeat(64);
const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const approvedSourcePath = resolve(studioRoot, '../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');

async function tempDatabase(context, prefix = 'numberdroid-2c-persistence-') {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return join(directory, 'studio.sqlite');
}

async function createV8Database(filename) {
  const migrations = (await loadMigrationDefinitions()).filter(({ version }) => version <= 8);
  const database = nodeSqliteDatabaseFactory(filename);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    ) STRICT
  `);
  for (const migration of migrations) {
    database.exec('BEGIN EXCLUSIVE');
    database.exec(migration.sql);
    database.prepare(`
      INSERT INTO schema_migrations(version, name, checksum, applied_at)
      VALUES (?, ?, ?, ?)
    `).run(migration.version, migration.name, migration.checksum, '2026-08-22T00:00:00.000Z');
    database.exec(`PRAGMA user_version = ${migration.version}`);
    database.exec('COMMIT');
  }
  database.close();
}

function insertArtifacts(database) {
  const insert = database.prepare(`
    INSERT INTO artifacts(
      digest, uri, media_type, byte_size, width, height, state, created_at, verified_at
    ) VALUES (?, ?, 'image/png', ?, ?, ?, 'LIVE', ?, ?)
  `);
  insert.run(
    SOURCE_DIGEST,
    `studio://artifacts/sha256/${SOURCE_DIGEST}`,
    256,
    8,
    8,
    '2026-08-22T00:00:00.000Z',
    '2026-08-22T00:00:00.000Z',
  );
  insert.run(
    SLICE_DIGEST,
    `studio://artifacts/sha256/${SLICE_DIGEST}`,
    320,
    8,
    8,
    '2026-08-22T00:00:00.000Z',
    '2026-08-22T00:00:00.000Z',
  );
}

function insertSliceBinding(database) {
  database.prepare(`
    INSERT INTO asset_slice_bindings(
      project_id, slice_id, slice_version, atlas_id, source_id, source_digest,
      atlas_definition_version, atlas_definition_fingerprint, rectangle_id,
      rectangle_json, rect_x, rect_y, rect_width, rect_height, pivot_x, pivot_y, processor_id,
      artifact_digest, artifact_uri, media_type, byte_size, width, height,
      prior_digest, committed_revision, bound_revision, committed_at,
      committed_by, job_id, provenance
    ) VALUES (?, 'slice.family.1', 1, 'atlas.family', 'source.family', ?,
      1, ?, 'rect.family.1', ?, 0, 0, 8, 8, 4, 7, 'studio.png.crop.v1',
      ?, ?, 'image/png', 320, 8, 8, NULL, 1, 1, ?, 'owner.test',
      'job.family.preview', 'native_revision')
  `).run(
    PROJECT_ID,
    SOURCE_DIGEST,
    FINGERPRINT,
    JSON.stringify({
      x: 0, y: 0, width: 8, height: 8, included: true,
      pivot: { x: 4, y: 7 }, transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null, expectedSliceVersion: null,
    }),
    SLICE_DIGEST,
    `studio://artifacts/sha256/${SLICE_DIGEST}`,
    '2026-08-22T00:00:00.000Z',
  );
}

function insertProposalAssetFixture(database) {
  database.prepare(`
    INSERT INTO asset_proposals(
      project_id, proposal_id, schema_version, base_revision, created_revision,
      status, item_count, request_fingerprint, proposer_actor_kind,
      proposer_actor_id, proposer_task_id, proposer_branch_id,
      proposer_grant_id, created_at, decided_revision, applied_revision
    ) VALUES (?, 'proposal.family', 1, 1, 1, 'APPLIED', 1, ?, 'human',
      'owner.test', NULL, 'branch.main', NULL, ?, 1, 1)
  `).run(PROJECT_ID, FINGERPRINT, '2026-08-22T00:01:00.000Z');
  database.prepare(`
    INSERT INTO asset_proposal_items(
      project_id, proposal_id, item_id, item_order, operation, asset_id,
      expected_asset_version, expected_metadata_version, slice_id, slice_version,
      desired_name, desired_kind, desired_metadata_json,
      desired_metadata_fingerprint, diff_json, finding_fingerprint
    ) VALUES (?, 'proposal.family', 'item.1', 0, 'create', 'asset.family.1',
      0, 0, 'slice.family.1', 1, 'Family Tile 1', 'surface', ?, ?, ?, ?)
  `).run(
    PROJECT_ID,
    JSON.stringify({ tags: ['family', 'floor'], runtimeEligible: false }),
    FINGERPRINT,
    JSON.stringify([{ path: '/name', after: 'Family Tile 1' }]),
    FINDINGS_FINGERPRINT,
  );
  const findingJson = JSON.stringify({
    findingId: 'finding.runtime',
    severity: 'WARNING',
    ruleId: 'studio.asset.runtime_ineligible',
    targetKind: 'metadata',
    targetId: 'asset.family.1',
    path: '/runtimeEligible',
    explanation: 'Runtime integration is intentionally deferred.',
    remediation: 'Confirm runtime integration in a later checkpoint.',
    validatorVersion: 'studio.asset.validator.v1',
  });
  const findingValues = [
    PROJECT_ID,
    'finding.runtime',
    'WARNING',
    'studio.asset.runtime_ineligible',
    'metadata',
    'asset.family.1',
    '/runtimeEligible',
    'Runtime integration is intentionally deferred.',
    'Confirm runtime integration in a later checkpoint.',
    'studio.asset.validator.v1',
    findingJson,
  ];
  database.prepare(`
    INSERT INTO asset_proposal_item_findings(
      project_id, proposal_id, item_id, finding_id, finding_order, severity,
      rule_id, target_kind, target_id, path, explanation, remediation,
      validator_version, finding_json
    ) VALUES (?, 'proposal.family', 'item.1', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...findingValues);
  database.prepare(`
    INSERT INTO asset_proposal_decisions(
      project_id, proposal_id, item_id, decision, rejection_reason,
      decision_revision, decided_at, decided_by
    ) VALUES (?, 'proposal.family', 'item.1', 'ACCEPTED', NULL, 1, ?, 'owner.test')
  `).run(PROJECT_ID, '2026-08-22T00:02:00.000Z');
  database.prepare(`
    INSERT INTO asset_proposal_applications(
      project_id, proposal_id, application_revision, accepted_count,
      rejected_count, applied_at, applied_by
    ) VALUES (?, 'proposal.family', 1, 1, 0, ?, 'owner.test')
  `).run(PROJECT_ID, '2026-08-22T00:03:00.000Z');
  database.prepare(`
    INSERT INTO asset_versions(
      project_id, asset_id, asset_version, metadata_version,
      previous_asset_version, name, kind, lifecycle, slice_id, slice_version,
      metadata_json, metadata_fingerprint, findings_fingerprint,
      accepted_warning_ids_json, created_revision, created_at, created_by,
      proposal_id, proposal_item_id, provenance
    ) VALUES (?, 'asset.family.1', 1, 1, NULL, 'Family Tile 1', 'surface',
      'DRAFT', 'slice.family.1', 1, ?, ?, ?, '[]', 1, ?, 'owner.test',
      'proposal.family', 'item.1', 'native_revision')
  `).run(
    PROJECT_ID,
    JSON.stringify({ tags: ['family', 'floor'], runtimeEligible: false }),
    FINGERPRINT,
    FINDINGS_FINGERPRINT,
    '2026-08-22T00:03:00.000Z',
  );
  database.prepare(`
    INSERT INTO asset_version_findings(
      project_id, asset_id, asset_version, finding_id, finding_order, severity,
      rule_id, target_kind, target_id, path, explanation, remediation,
      validator_version, finding_json
    ) VALUES (?, 'asset.family.1', 1, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(...findingValues);
  database.prepare(`
    INSERT INTO asset_heads(
      project_id, asset_id, asset_version, metadata_version, name, kind,
      lifecycle, slice_id, slice_version, updated_revision
    ) VALUES (?, 'asset.family.1', 1, 1, 'Family Tile 1', 'surface', 'DRAFT',
      'slice.family.1', 1, 1)
  `).run(PROJECT_ID);
  const insertTag = database.prepare(`
    INSERT INTO asset_head_tags(project_id, asset_id, tag, tag_order)
    VALUES (?, 'asset.family.1', ?, ?)
  `);
  insertTag.run(PROJECT_ID, 'family', 0);
  insertTag.run(PROJECT_ID, 'floor', 1);
}

test('schema v9 is fixed, strict, normalized, and leaves migrations 1-8 unchanged', async (context) => {
  const filename = await tempDatabase(context);
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const migrations = await loadMigrationDefinitions();
  assert.deepEqual(migrations.map(({ version }) => version), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(migrations.at(-1).checksum, 'e387c3e56fb0bb03bd14743c6a7c7a6baad230c02dde8f158e485e25776e7175');
  assert.deepEqual(migrations.slice(6, 8).map(({ checksum }) => checksum), [
    'aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9',
    '2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730',
  ]);
  const expected = [
    'asset_head_tags',
    'asset_heads',
    'asset_proposal_applications',
    'asset_proposal_decisions',
    'asset_proposal_item_findings',
    'asset_proposal_items',
    'asset_proposals',
    'asset_slice_bindings',
    'asset_version_findings',
    'asset_versions',
    'bundle_import_applied_jobs',
    'bundle_imports',
  ];
  const tables = store.workspace.database.prepare(`
    SELECT name, strict FROM pragma_table_list
    WHERE name LIKE 'asset_%' OR name LIKE 'bundle_import%'
    ORDER BY name
  `).all();
  assert.deepEqual(tables.map(({ name }) => name), expected);
  assert.ok(tables.every(({ strict }) => Number(strict) === 1));
  assert.equal(store.supportsDurableAssetStore, true);
  assert.equal(store.integrityCheck().userVersion, 9);
});

test('a v8 workspace rolls migration 0009 back completely and resumes safely', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-2c-v8-v9-');
  await createV8Database(filename);
  await assert.rejects(
    SqliteProjectStore.open({
      filename,
      databaseFactory: nodeSqliteDatabaseFactory,
      faultInjector(point) {
        if (point === 'after_migration_9') throw new Error('simulated v9 migration crash');
      },
    }),
    /simulated v9 migration crash/,
  );
  const interrupted = nodeSqliteDatabaseFactory(filename);
  assert.equal(Number(interrupted.prepare('PRAGMA user_version').get().user_version), 8);
  assert.deepEqual(
    interrupted.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(({ version }) => Number(version)),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(interrupted.prepare(`
    SELECT count(*) AS count FROM sqlite_schema WHERE type = 'table' AND name = 'asset_versions'
  `).get().count, 0);
  interrupted.close();

  const resumed = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => resumed.close());
  assert.equal(resumed.integrityCheck().userVersion, 9);
  assert.deepEqual(
    resumed.workspace.database.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(({ version }) => Number(version)),
    [1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test('v9 enforces project-scoped lineage, immutable records, and proposal decision constraints', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-2c-constraints-');
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  const database = store.workspace.database;
  insertArtifacts(database);
  insertSliceBinding(database);
  insertProposalAssetFixture(database);

  assert.throws(
    () => database.prepare(`
      UPDATE asset_slice_bindings SET artifact_digest = ?
      WHERE project_id = ? AND slice_id = 'slice.family.1' AND slice_version = 1
    `).run(SOURCE_DIGEST, PROJECT_ID),
    /asset_slice_bindings are immutable/,
  );
  assert.throws(
    () => database.prepare(`
      UPDATE asset_versions SET name = 'Retargeted'
      WHERE project_id = ? AND asset_id = 'asset.family.1' AND asset_version = 1
    `).run(PROJECT_ID),
    /asset_versions are immutable/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO asset_proposal_decisions(
        project_id, proposal_id, item_id, decision, rejection_reason,
        decision_revision, decided_at, decided_by
      ) VALUES (?, 'proposal.family', 'item.1', 'REJECTED', '  ', 1, ?, 'owner.test')
    `).run(PROJECT_ID, '2026-08-22T00:04:00.000Z'),
    /constraint failed/i,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO asset_proposal_items(
        project_id, proposal_id, item_id, item_order, operation, asset_id,
        expected_asset_version, expected_metadata_version, slice_id, slice_version,
        desired_name, desired_kind, desired_metadata_json,
        desired_metadata_fingerprint, diff_json, finding_fingerprint
      ) VALUES (?, 'proposal.family', 'item.cross', 1, 'update', 'asset.cross',
        1, 1, 'slice.other-project', 1, 'Cross project', 'surface', '{}', ?, '[]', ?)
    `).run(PROJECT_ID, FINGERPRINT, FINDINGS_FINGERPRINT),
    /foreign key constraint failed/i,
  );
  assert.equal(store.integrityCheck().ok, true);
});

test('asset query helpers return ordered heads, exact lineage, findings, and durable review state', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-2c-query-');
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  insertArtifacts(store.workspace.database);
  insertSliceBinding(store.workspace.database);
  insertProposalAssetFixture(store.workspace.database);

  const heads = store.listAssetHeads(PROJECT_ID, { kind: 'surface', tag: 'floor', search: 'Family' });
  assert.equal(heads.length, 1);
  assert.deepEqual(heads[0].tags, ['family', 'floor']);
  assert.equal(heads[0].imagery.digest, SLICE_DIGEST);
  assert.equal(heads[0].sliceVersion, 1);
  assert.deepEqual(store.listAssetHeads(PROJECT_ID, { lifecycle: 'FINAL' }), []);

  const asset = store.getAsset(PROJECT_ID, 'asset.family.1');
  assert.equal(asset.head.assetVersion, 1);
  assert.equal(asset.versions[0].sliceBinding.sourceDigest, SOURCE_DIGEST);
  assert.deepEqual(asset.versions[0].sliceBinding.rectangle.pivot, { x: 4, y: 7 });
  assert.equal(asset.versions[0].findings[0].findingId, 'finding.runtime');

  const proposal = store.getAssetProposal(PROJECT_ID, 'proposal.family');
  assert.equal(proposal.status, 'APPLIED');
  assert.equal(proposal.items[0].decision.decision, 'ACCEPTED');
  assert.equal(proposal.items[0].findings[0].ruleId, 'studio.asset.runtime_ineligible');
  assert.deepEqual(proposal.application, {
    applicationRevision: 1,
    acceptedCount: 1,
    rejectedCount: 0,
    appliedAt: '2026-08-22T00:03:00.000Z',
    appliedBy: 'owner.test',
  });
  assert.equal(store.listAssetProposals(PROJECT_ID, { status: 'APPLIED' }).length, 1);
  assert.equal(store.getAsset(PROJECT_ID, 'asset.missing'), null);
  assert.equal(store.getAssetProposal(PROJECT_ID, 'proposal.missing'), null);
  assert.throws(() => store.listAssetHeads(PROJECT_ID, { limit: 501 }), /between 1 and 500/);
});

test('real SQLite proposal, decision, apply, lifecycle, restart, and references share appendRevision atomicity', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-2c-real-flow-');
  const directory = join(filename, '..');
  let armedFault = null;
  let store = await SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (point === armedFault) throw new Error(`simulated ${point}`);
    },
  });
  context.after(() => store?.close());
  const cas = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const jobs = new SqliteJobStore({ workspace: store.workspace });
  let tick = 0;
  let studio = new StudioService({
    store,
    jobStore: jobs,
    agentAttemptAuditReady: true,
    clock: () => new Date(Date.UTC(2026, 7, 22, 12, 0, tick++)).toISOString(),
  });
  await createProject(studio);
  const sourceArtifact = await cas.ingest(await readFile(approvedSourcePath), { mediaType: 'image/png' });
  const intakes = new SqliteSourceIntakeStore({ workspace: store.workspace });
  intakes.stage(sourceArtifact, {
    projectId: PROJECT_ID,
    intakeId: 'intake.2c',
    idempotencyKey: 'intake-upload.2c',
    origin: 'human_upload',
    createdRevision: 1,
  });
  await studio.execute(command({
    commandId: 'cmd.2c.source', idempotencyKey: 'idem.2c.source',
    type: 'source.intake.commit', expectedVersion: 1,
    payload: {
      intakeId: 'intake.2c', sourceId: 'source.2c', name: '2C source',
      artifactUri: sourceArtifact.uri, mediaType: 'image/png', byteSize: sourceArtifact.byteSize,
      width: sourceArtifact.width, height: sourceArtifact.height,
      provenance: {
        origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
        provider: null, model: null, modelVersion: null, generator: null,
        parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
      },
    },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.2c.source.propose', idempotencyKey: 'idem.2c.source.propose',
    type: 'source.review.propose', expectedVersion: 2,
    payload: { sourceId: 'source.2c', note: 'Ready for exact slicing.' },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.2c.source.approve', idempotencyKey: 'idem.2c.source.approve',
    type: 'source.review.decide', expectedVersion: 3,
    payload: { sourceId: 'source.2c', disposition: 'APPROVED', note: 'Approved fixture.' },
  }), OWNER_CONTEXT);
  const rectangle = {
    rectangleId: 'rect.2c', x: 0, y: 0, width: 8, height: 8,
    included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
    replacesSliceId: null, expectedSliceVersion: null,
  };
  const defined = await studio.execute(command({
    commandId: 'cmd.2c.atlas', idempotencyKey: 'idem.2c.atlas',
    type: 'atlas.define.rects', expectedVersion: 4,
    payload: {
      atlasId: 'atlas.2c', sourceId: 'source.2c', name: '2C atlas',
      expectedAtlasVersion: 0, rectangles: [rectangle],
    },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.2c.preview', idempotencyKey: 'idem.2c.preview',
    type: 'atlas.preview.slices', expectedVersion: 5,
    payload: {
      atlasId: 'atlas.2c', expectedAtlasVersion: 1,
      expectedDefinitionFingerprint: defined.value.definitionFingerprint,
      jobId: 'job.2c.preview',
    },
  }), OWNER_CONTEXT);
  const worker = new AtlasPreviewWorker({
    jobStore: jobs,
    artifactStore: cas,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: store.workspace }),
    workerId: 'worker.2c',
  });
  assert.equal(await worker.drain(), 1);
  const committed = await studio.execute(command({
    commandId: 'cmd.2c.commit', idempotencyKey: 'idem.2c.commit',
    type: 'atlas.commit.slices', expectedVersion: 6,
    payload: {
      atlasId: 'atlas.2c', expectedAtlasVersion: 1,
      expectedDefinitionFingerprint: defined.value.definitionFingerprint,
      jobId: 'job.2c.preview',
    },
  }), OWNER_CONTEXT);
  const exactSlice = committed.value.slices[0];
  await issueGrant(studio, {
    expectedVersion: 7,
    scopes: ['project.read', 'asset.proposal.submit'],
    budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
  });
  const authoredMetadata = {
    role: 'base', tags: ['floor', 'family'], variantGroup: null,
    compatibilityGroups: ['family-floor'], spanTiles: { width: 1, height: 1 },
    anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'fixed',
    placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] },
    navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0,
    visualWeight: 'medium', extensions: {},
  };
  const submitted = await studio.execute(command({
    commandId: 'cmd.2c.proposal', idempotencyKey: 'idem.2c.proposal',
    type: 'asset.proposal.submit', expectedVersion: 8,
    payload: {
      proposalId: 'proposal.2c', expectedRevision: 8,
      items: [{
        itemId: 'item.2c', operation: 'create', assetId: 'asset.2c',
        expectedAssetVersion: 0, expectedMetadataVersion: 0,
        sliceId: exactSlice.sliceId, expectedSliceVersion: 1,
        name: '2C Family Tile', kind: 'surface', metadata: authoredMetadata,
      }],
    },
  }), AGENT_CONTEXT);
  assert.equal(submitted.value.state, 'PENDING');
  assert.equal(store.getAssetProposal(PROJECT_ID, 'proposal.2c').items[0].sliceId, exactSlice.sliceId);
  await studio.execute(command({
    commandId: 'cmd.2c.decision', idempotencyKey: 'idem.2c.decision',
    type: 'asset.proposal.decide', expectedVersion: 9,
    payload: {
      proposalId: 'proposal.2c', expectedProposalVersion: 1,
      decisions: [{ itemId: 'item.2c', disposition: 'ACCEPTED', reason: null }],
    },
  }), OWNER_CONTEXT);
  const applyCommand = command({
    commandId: 'cmd.2c.apply', idempotencyKey: 'idem.2c.apply',
    type: 'asset.proposal.apply', expectedVersion: 10,
    payload: { proposalId: 'proposal.2c', expectedProposalVersion: 2 },
  });
  armedFault = 'after_asset_version_reference_insert';
  await assert.rejects(studio.execute(applyCommand, OWNER_CONTEXT), /simulated after_asset_version_reference_insert/);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 10);
  assert.equal(store.workspace.database.prepare('SELECT count(*) AS count FROM asset_versions').get().count, 0);
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references WHERE owner_kind = 'asset_version'
  `).get().count, 0);
  assert.equal(store.getAssetProposal(PROJECT_ID, 'proposal.2c').status, 'DECIDED');
  armedFault = null;
  await studio.execute(applyCommand, OWNER_CONTEXT);
  let persisted = store.getAsset(PROJECT_ID, 'asset.2c');
  assert.equal(persisted.head.assetVersion, 1);
  assert.equal(persisted.versions[0].sliceBinding.digest, exactSlice.digest);
  assert.deepEqual(persisted.head.tags, ['floor', 'family']);
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'asset_version' AND owner_id = 'asset.2c.v1'
  `).get(PROJECT_ID).count, 1);
  await studio.execute(command({
    commandId: 'cmd.2c.lifecycle', idempotencyKey: 'idem.2c.lifecycle',
    type: 'asset.lifecycle.set', expectedVersion: 11,
    payload: {
      assetId: 'asset.2c', expectedAssetVersion: 1, expectedMetadataVersion: 1,
      targetLifecycle: 'METADATA_COMPLETE', acceptedWarningFindingIds: [],
    },
  }), OWNER_CONTEXT);
  persisted = store.getAsset(PROJECT_ID, 'asset.2c');
  assert.equal(persisted.head.assetVersion, 2);
  assert.equal(persisted.head.metadataVersion, 1);
  assert.equal(persisted.head.lifecycle, 'METADATA_COMPLETE');
  assert.equal(store.workspace.database.prepare(`
    SELECT count(*) AS count FROM artifact_references
    WHERE project_id = ? AND owner_kind = 'asset_version' AND owner_id LIKE 'asset.2c.v%'
  `).get(PROJECT_ID).count, 2);

  store.close();
  store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  studio = new StudioService({ store, jobStore: new SqliteJobStore({ workspace: store.workspace }), agentAttemptAuditReady: true });
  assert.equal(studio.durableAssetStoreReady, true);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).snapshot.assetLibrary.assets[0].assetVersion, 2);
  assert.equal(store.getAssetProposal(PROJECT_ID, 'proposal.2c').status, 'APPLIED');
  assert.equal(store.getAsset(PROJECT_ID, 'asset.2c').versions.length, 2);
  const rebuilt = await store.rebuildProjectProjection(PROJECT_ID);
  assert.equal(rebuilt.revision, 12);
  assert.equal(store.getAsset(PROJECT_ID, 'asset.2c').head.assetVersion, 2);
  assert.equal(store.integrityCheck().ok, true);
});

test('bundle-import applied job history is immutable and cannot become a live controllable job', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-2c-bundle-history-');
  const store = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
  context.after(() => store.close());
  const { studio } = createHarness(store);
  await createProject(studio);
  const database = store.workspace.database;
  database.prepare(`
    INSERT INTO bundle_imports(
      project_id, import_id, schema_version, source_bundle_digest,
      manifest_digest, imported_revision, imported_at, provenance
    ) VALUES (?, 'import.family', 1, ?, ?, 1, ?, 'bundle_import')
  `).run(PROJECT_ID, BUNDLE_DIGEST, MANIFEST_DIGEST, '2026-08-22T01:00:00.000Z');
  database.prepare(`
    INSERT INTO bundle_import_applied_jobs(
      project_id, import_id, job_id, job_kind, input_revision,
      applied_revision, atlas_id, source_id, input_fingerprint, processor_id,
      input_json, output_json, result_json, events_json,
      created_at, started_at, finished_at, provenance
    ) VALUES (?, 'import.family', 'job.imported.applied', 'ATLAS_PREVIEW', 1, 1,
      'atlas.family', 'source.family', ?, 'studio.png.crop.v1', '{}', '[]', '{}',
      '[]', ?, ?, ?, 'bundle_import')
  `).run(
    PROJECT_ID,
    FINGERPRINT,
    '2026-08-22T00:00:00.000Z',
    '2026-08-22T00:00:01.000Z',
    '2026-08-22T00:00:02.000Z',
  );
  assert.equal(database.prepare(`
    SELECT count(*) AS count FROM bundle_import_applied_jobs
    WHERE project_id = ? AND job_id = 'job.imported.applied'
  `).get(PROJECT_ID).count, 1);
  assert.equal(database.prepare(`
    SELECT count(*) AS count FROM jobs
    WHERE project_id = ? AND job_id = 'job.imported.applied'
  `).get(PROJECT_ID).count, 0);
  assert.throws(
    () => database.prepare(`
      UPDATE bundle_import_applied_jobs SET provenance = 'native_revision'
      WHERE project_id = ? AND job_id = 'job.imported.applied'
    `).run(PROJECT_ID),
    /bundle_import_applied_jobs are immutable/,
  );
});

test('v9 migration checksum mismatch fails before any schema write', async (context) => {
  const filename = await tempDatabase(context, 'numberdroid-2c-checksum-');
  await createV8Database(filename);
  const database = nodeSqliteDatabaseFactory(filename);
  database.prepare(`
    INSERT INTO schema_migrations(version, name, checksum, applied_at)
    VALUES (9, 'asset_library', 'corrupt', ?)
  `).run('2026-08-22T00:00:00.000Z');
  database.exec('PRAGMA user_version = 9');
  await assert.rejects(
    runSqliteMigrations(database),
    (error) => error.code === 'MIGRATION_CHECKSUM_MISMATCH'
      && error.details.version === 9,
  );
  assert.equal(database.prepare(`
    SELECT count(*) AS count FROM sqlite_schema WHERE name = 'asset_versions'
  `).get().count, 0);
  database.close();
});
