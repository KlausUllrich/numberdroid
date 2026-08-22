import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { StudioService } from '../packages/application/src/index.js';
import {
  ContentAddressedArtifactStore,
  canonicalBundleJson,
  SqliteArtifactMetadataStore,
  SqliteJobStore,
  SqliteProjectStore,
  SqliteSourceIntakeStore,
  createSqliteProjectBundle,
  importSqliteProjectBundle,
  projectSqlitePortableDocument,
  validateSqlitePortableProject,
  verifySqliteProjectBundle,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { AtlasPreviewWorker } from '../apps/studio-server/src/atlas-preview-worker.js';
import {
  AGENT_CONTEXT, OWNER_CONTEXT, PROJECT_ID, command, createProject, issueGrant,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory, pngHeader } from './persistence-test-helpers.js';

const approvedSourcePath = resolve('../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png');

async function fixture(context, { stopBefore = null, faultControl = null } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-sqlite-bundle-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const databasePath = join(root, 'live', 'studio.sqlite');
  const store = await SqliteProjectStore.open({
    filename: databasePath,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (!faultControl || faultControl.point !== point) return;
      faultControl.seen = (faultControl.seen ?? 0) + 1;
      if (faultControl.seen === (faultControl.occurrence ?? 1)) throw new Error(`fault:${point}:${faultControl.seen}`);
    },
  });
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(root, 'live', 'artifacts') });
  const jobStore = new SqliteJobStore({ workspace: store.workspace });
  let tick = 0;
  const studio = new StudioService({
    store,
    jobStore,
    agentAttemptAuditReady: true,
    clock: () => new Date(Date.UTC(2026, 7, 22, 14, 0, tick++)).toISOString(),
  });
  await createProject(studio);
  const artifact = await artifactStore.ingest(await readFile(approvedSourcePath), { mediaType: 'image/png' });
  const intakes = new SqliteSourceIntakeStore({ workspace: store.workspace });
  intakes.stage(artifact, {
    projectId: PROJECT_ID,
    intakeId: 'intake.bundle',
    idempotencyKey: 'upload.bundle',
    origin: 'human_upload',
    createdRevision: 1,
  });
  await studio.execute(command({
    commandId: 'cmd.bundle.source', idempotencyKey: 'idem.bundle.source',
    type: 'source.intake.commit', expectedVersion: 1,
    payload: {
      intakeId: 'intake.bundle', sourceId: 'source.bundle', name: 'Bundle source',
      artifactUri: artifact.uri, mediaType: artifact.mediaType, byteSize: artifact.byteSize,
      width: artifact.width, height: artifact.height,
      provenance: {
        origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
        provider: null, model: null, modelVersion: null, generator: null,
        parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
      },
    },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.bundle.review.propose', idempotencyKey: 'idem.bundle.review.propose',
    type: 'source.review.propose', expectedVersion: 2,
    payload: { sourceId: 'source.bundle', note: 'Portable.' },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.bundle.review.approve', idempotencyKey: 'idem.bundle.review.approve',
    type: 'source.review.decide', expectedVersion: 3,
    payload: { sourceId: 'source.bundle', disposition: 'APPROVED', note: 'Approved.' },
  }), OWNER_CONTEXT);
  const rectangle = {
    rectangleId: 'rect.bundle', x: 0, y: 0, width: 8, height: 8,
    included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
    replacesSliceId: null, expectedSliceVersion: null,
  };
  const defined = await studio.execute(command({
    commandId: 'cmd.bundle.atlas', idempotencyKey: 'idem.bundle.atlas',
    type: 'atlas.define.rects', expectedVersion: 4,
    payload: { atlasId: 'atlas.bundle', sourceId: 'source.bundle', name: 'Bundle atlas', expectedAtlasVersion: 0, rectangles: [rectangle] },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.bundle.preview', idempotencyKey: 'idem.bundle.preview',
    type: 'atlas.preview.slices', expectedVersion: 5,
    payload: {
      atlasId: 'atlas.bundle', expectedAtlasVersion: 1,
      expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId: 'job.bundle.preview',
    },
  }), OWNER_CONTEXT);
  const worker = new AtlasPreviewWorker({
    jobStore,
    artifactStore,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: store.workspace }),
    workerId: 'worker.bundle',
  });
  assert.equal(await worker.drain(), 1);
  const committed = await studio.execute(command({
    commandId: 'cmd.bundle.commit', idempotencyKey: 'idem.bundle.commit',
    type: 'atlas.commit.slices', expectedVersion: 6,
    payload: {
      atlasId: 'atlas.bundle', expectedAtlasVersion: 1,
      expectedDefinitionFingerprint: defined.value.definitionFingerprint, jobId: 'job.bundle.preview',
    },
  }), OWNER_CONTEXT);
  await issueGrant(studio, {
    expectedVersion: 7,
    scopes: ['project.read', 'asset.proposal.submit'],
    budget: { maxCommands: 3, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
  });
  const metadata = {
    role: 'fixture', tags: ['bundle'], variantGroup: null,
    compatibilityGroups: [], spanTiles: { width: 1, height: 1 },
    anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'fixed',
    placement: { modes: ['manual'], wallSafe: true, tags: [], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] },
    navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
    connectors: [{ edge: 'north', offset: 0.5 }], continuityProfile: 'fixture-continuity', continuityTags: [], selectionPriority: 0,
    visualWeight: 'medium', extensions: {},
  };
  const slice = committed.value.slices[0];
  const proposalCommand = command({
    commandId: 'cmd.bundle.proposal', idempotencyKey: 'idem.bundle.proposal',
    type: 'asset.proposal.submit', expectedVersion: 8,
    payload: {
      proposalId: 'proposal.bundle', expectedRevision: 8,
      items: [{
        itemId: 'item.bundle', operation: 'create', assetId: 'asset.bundle',
        expectedAssetVersion: 0, expectedMetadataVersion: 0,
        sliceId: slice.sliceId, expectedSliceVersion: 1,
        name: 'Bundle Tile', kind: 'prop', metadata,
      }, {
        itemId: 'item.bundle.second', operation: 'create', assetId: 'asset.bundle.second',
        expectedAssetVersion: 0, expectedMetadataVersion: 0,
        sliceId: slice.sliceId, expectedSliceVersion: 1,
        name: 'Second Bundle Tile', kind: 'prop', metadata,
      }, {
        itemId: 'item.bundle.rejected', operation: 'create', assetId: 'asset.bundle.rejected',
        expectedAssetVersion: 0, expectedMetadataVersion: 0,
        sliceId: slice.sliceId, expectedSliceVersion: 1,
        name: 'Rejected Bundle Tile', kind: 'prop', metadata,
      }],
    },
  });
  const base = { root, store, artifactStore, metadata, slice, studio, proposalCommand };
  if (stopBefore === 'proposal') return base;
  await studio.execute(proposalCommand, AGENT_CONTEXT);
  const decisionCommand = command({
    commandId: 'cmd.bundle.decision', idempotencyKey: 'idem.bundle.decision',
    type: 'asset.proposal.decide', expectedVersion: 9,
    payload: {
      proposalId: 'proposal.bundle', expectedProposalVersion: 1,
      decisions: [
        { itemId: 'item.bundle', disposition: 'ACCEPTED', reason: null },
        { itemId: 'item.bundle.second', disposition: 'ACCEPTED', reason: null },
        { itemId: 'item.bundle.rejected', disposition: 'REJECTED', reason: 'Keep as inspectable review history.' },
      ],
    },
  });
  if (stopBefore === 'decision') return { ...base, decisionCommand };
  await studio.execute(decisionCommand, OWNER_CONTEXT);
  const applyCommand = command({
    commandId: 'cmd.bundle.apply', idempotencyKey: 'idem.bundle.apply',
    type: 'asset.proposal.apply', expectedVersion: 10,
    payload: { proposalId: 'proposal.bundle', expectedProposalVersion: 2 },
  });
  if (stopBefore === 'apply') return { ...base, decisionCommand, applyCommand };
  await studio.execute(applyCommand, OWNER_CONTEXT);
  const lifecycleCommand = command({
    commandId: 'cmd.bundle.lifecycle', idempotencyKey: 'idem.bundle.lifecycle',
    type: 'asset.lifecycle.set', expectedVersion: 11,
    payload: {
      assetId: 'asset.bundle', expectedAssetVersion: 1, expectedMetadataVersion: 1,
      targetLifecycle: 'METADATA_COMPLETE', acceptedWarningFindingIds: [],
    },
  });
  return { ...base, decisionCommand, applyCommand, lifecycleCommand };
}

test('SQLite v9 portable bundle round-trips canonical semantics and CAS without authority', async (context) => {
  const value = await fixture(context);
  context.after(() => value.store.close());
  const bundle = join(value.root, 'bundle');
  await createSqliteProjectBundle({
    destinationDirectory: bundle,
    projectStore: value.store,
    artifactStore: value.artifactStore,
    projectId: PROJECT_ID,
  });
  const firstProject = await readFile(join(bundle, 'project.json'));
  const projectText = firstProject.toString('utf8');
  assert.doesNotMatch(projectText, /grant\.atlas|branch\.task|intake\.bundle|studio:\/\/|\.sqlite|writer\.lock/);
  assert.equal((await verifySqliteProjectBundle(bundle)).ok, true);

  const destination = join(value.root, 'imported');
  const imported = await importSqliteProjectBundle({
    bundleDirectory: bundle,
    destinationDirectory: destination,
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  assert.equal(imported.ok, true);
  const importedStore = await SqliteProjectStore.open({
    filename: join(destination, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory,
  });
  context.after(() => importedStore.close());
  const importedCas = new ContentAddressedArtifactStore({ rootDirectory: join(destination, 'artifacts') });
  const database = importedStore.workspace.database;
  for (const table of ['jobs', 'job_events', 'grants', 'host_bindings', 'agent_attempts', 'idempotency_records', 'source_intakes', 'human_agent_access_operations']) {
    assert.equal(Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count), 0, table);
  }
  const importedRevisions = database.prepare('SELECT revision_json FROM revisions ORDER BY revision_number').all()
    .map((row) => JSON.parse(row.revision_json));
  assert.ok(importedRevisions.every((revision) => revision.command.grantId === null));
  assert.equal(Number(database.prepare('SELECT count(*) AS count FROM bundle_import_applied_jobs').get().count), 1);
  assert.equal(Number(database.prepare("SELECT count(*) AS count FROM artifact_references WHERE owner_kind = 'asset_version'").get().count), 2);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: importedStore, artifactStore: importedCas })).ok, true);

  const secondBundle = join(value.root, 'bundle-again');
  await createSqliteProjectBundle({
    destinationDirectory: secondBundle,
    projectStore: importedStore,
    artifactStore: importedCas,
    projectId: PROJECT_ID,
  });
  assert.deepEqual(JSON.parse(await readFile(join(secondBundle, 'project.json'))), JSON.parse(firstProject));
  assert.deepEqual(await readFile(join(secondBundle, 'manifest.json')), await readFile(join(bundle, 'manifest.json')));
  const verifiedFirst = await verifySqliteProjectBundle(bundle);
  const verifiedSecond = await verifySqliteProjectBundle(secondBundle);
  assert.deepEqual(verifiedSecond.manifest.artifacts, verifiedFirst.manifest.artifacts);
  for (const artifact of verifiedFirst.artifacts) {
    assert.deepEqual(await readFile(artifact.path), await readFile(verifiedSecond.artifacts.find((candidate) => candidate.digest === artifact.digest).path));
  }

  const versionReference = database.prepare(`
    SELECT * FROM artifact_references WHERE project_id = ? AND owner_kind = 'asset_version'
  `).get(PROJECT_ID);
  database.prepare(`
    DELETE FROM artifact_references WHERE project_id = ? AND owner_kind = 'asset_version'
  `).run(PROJECT_ID);
  assert.equal((await verifyWorkspaceIntegrity({ projectStore: importedStore, artifactStore: importedCas })).assets.ok, false);
  await assert.rejects(createSqliteProjectBundle({
    destinationDirectory: join(value.root, 'tampered-export'),
    projectStore: importedStore,
    artifactStore: importedCas,
    projectId: PROJECT_ID,
  }), (error) => error.code === 'BUNDLE_SOURCE_INTEGRITY_FAILED');
  database.prepare(`
    INSERT INTO artifact_references(project_id, owner_kind, owner_id, digest, created_revision)
    VALUES (?, ?, ?, ?, ?)
  `).run(versionReference.project_id, versionReference.owner_kind, versionReference.owner_id, versionReference.digest, versionReference.created_revision);

  const importedJobs = new SqliteJobStore({ workspace: importedStore.workspace });
  const studio = new StudioService({ store: importedStore, jobStore: importedJobs, agentAttemptAuditReady: true });
  await issueGrant(studio, {
    expectedVersion: 11,
    scopes: ['project.read', 'asset.proposal.submit'],
    budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
  });
  const future = await studio.execute(command({
    commandId: 'cmd.bundle.future', idempotencyKey: 'idem.bundle.future',
    type: 'asset.proposal.submit', expectedVersion: 12,
    payload: {
      proposalId: 'proposal.bundle.future', expectedRevision: 12,
      items: [{
        itemId: 'item.bundle.future', operation: 'create', assetId: 'asset.bundle.future',
        expectedAssetVersion: 0, expectedMetadataVersion: 0,
        sliceId: value.slice.sliceId, expectedSliceVersion: 1,
        name: 'Future Bundle Tile', kind: 'prop', metadata: value.metadata,
      }],
    },
  }), AGENT_CONTEXT);
  assert.equal(future.value.state, 'PENDING');
});

test('SQLite bundle import conflicts and materializer faults leave destinations absent', async (context) => {
  const value = await fixture(context);
  context.after(() => value.store.close());
  const bundle = join(value.root, 'bundle');
  await createSqliteProjectBundle({ destinationDirectory: bundle, projectStore: value.store, artifactStore: value.artifactStore, projectId: PROJECT_ID });
  const destination = join(value.root, 'import-fault');
  await assert.rejects(importSqliteProjectBundle({
    bundleDirectory: bundle,
    destinationDirectory: destination,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) { if (point === 'after_bundle_materialize') throw new Error('materializer fault'); },
  }), /materializer fault/);
  await assert.rejects(access(destination), (error) => error.code === 'ENOENT');
  await importSqliteProjectBundle({ bundleDirectory: bundle, destinationDirectory: destination, databaseFactory: nodeSqliteDatabaseFactory });
  await assert.rejects(importSqliteProjectBundle({ bundleDirectory: bundle, destinationDirectory: destination, databaseFactory: nodeSqliteDatabaseFactory }), (error) => error.code === 'BUNDLE_DESTINATION_EXISTS');
});

test('SQLite portable verifier rejects re-signed unknown fields at every typed semantic envelope', async (context) => {
  const value = await fixture(context);
  context.after(() => value.store.close());
  const bundle = join(value.root, 'strict-bundle');
  await createSqliteProjectBundle({ destinationDirectory: bundle, projectStore: value.store, artifactStore: value.artifactStore, projectId: PROJECT_ID });
  const base = JSON.parse(await readFile(join(bundle, 'project.json')));
  const unknown = (record) => { record.benignUnknownField = true; };
  const finding = {
    findingId: 'f'.repeat(64), severity: 'WARNING', ruleId: 'studio.asset.test',
    targetKind: 'asset', targetId: 'asset.bundle', path: '/metadata',
    explanation: 'Test.', remediation: 'Remove.', validatorVersion: 'numberdroid-studio.asset-validator.v1',
  };
  const cases = [
    ['source', (project) => unknown(project.sources[0])],
    ['source provenance', (project) => unknown(project.sources[0].provenance)],
    ['source lifecycle', (project) => unknown(project.sources[0].lifecycle)],
    ['source review', (project) => unknown(project.sources[0].review)],
    ['atlas', (project) => unknown(project.atlases[0])],
    ['atlas rectangle', (project) => unknown(project.atlases[0].rectangles[0])],
    ['atlas slice', (project) => unknown(project.atlases[0].slices[0])],
    ['atlas slice rectangle', (project) => unknown(project.atlases[0].slices[0].rectangle)],
    ['legacy asset', (project) => {
      project.legacyAssets.push({ assetId: 'asset.legacy', name: 'Legacy', sourceId: 'source.bundle', kind: 'surface', region: { x: 0, y: 0, width: 1, height: 1 }, properties: {}, status: 'draft', definedAt: project.projectHead.updatedAt, definedBy: 'designer.one', benignUnknownField: true });
    }],
    ['legacy region', (project) => {
      project.legacyAssets.push({ assetId: 'asset.legacy', name: 'Legacy', sourceId: 'source.bundle', kind: 'surface', region: { x: 0, y: 0, width: 1, height: 1, benignUnknownField: true }, properties: {}, status: 'draft', definedAt: project.projectHead.updatedAt, definedBy: 'designer.one' });
    }],
    ['slice binding', (project) => unknown(project.assetLibrary.sliceBindings[0])],
    ['binding rectangle', (project) => unknown(project.assetLibrary.sliceBindings[0].rectangle)],
    ['asset version', (project) => unknown(project.assetLibrary.versions[0])],
    ['typed metadata', (project) => unknown(project.assetLibrary.versions[0].metadata)],
    ['metadata placement', (project) => unknown(project.assetLibrary.versions[0].metadata.placement)],
    ['asset head', (project) => unknown(project.assetLibrary.heads[0])],
    ['asset semantic head', (project) => unknown(project.assetLibrary.heads[0].semantic)],
    ['asset exact binding', (project) => unknown(project.assetLibrary.heads[0].semantic.sliceBinding)],
    ['asset proposal link', (project) => unknown(project.assetLibrary.heads[0].semantic.proposal)],
    ['finding wrapper', (project) => project.assetLibrary.findings.push({ assetId: 'asset.bundle', assetVersion: 1, findingOrder: 0, finding, benignUnknownField: true })],
    ['finding', (project) => project.assetLibrary.findings.push({ assetId: 'asset.bundle', assetVersion: 1, findingOrder: 0, finding: { ...finding, benignUnknownField: true } })],
    ['proposal', (project) => unknown(project.proposals[0])],
    ['proposal semantic', (project) => unknown(project.proposals[0].semantic)],
    ['proposer', (project) => unknown(project.proposals[0].semantic.proposer)],
    ['proposer actor', (project) => unknown(project.proposals[0].semantic.proposer.actor)],
    ['proposal item', (project) => unknown(project.proposals[0].semantic.items[0])],
    ['proposal item binding', (project) => unknown(project.proposals[0].semantic.items[0].sliceBinding)],
    ['proposal item finding', (project) => project.proposals[0].semantic.items[0].findings.push({ ...finding, benignUnknownField: true })],
    ['proposal decision', (project) => unknown(project.proposals[0].semantic.items[0].decision)],
    ['proposal diff', (project) => unknown(project.proposals[0].semantic.items[0].diff)],
    ['proposal diff after', (project) => unknown(project.proposals[0].semantic.items[0].diff.after)],
    ['applied job', (project) => unknown(project.appliedJobHistory[0])],
    ['job input', (project) => unknown(project.appliedJobHistory[0].input)],
    ['job input rectangle', (project) => unknown(project.appliedJobHistory[0].input.rectangles[0])],
    ['job output', (project) => unknown(project.appliedJobHistory[0].outputs[0])],
    ['job result', (project) => unknown(project.appliedJobHistory[0].result)],
    ['job result output', (project) => unknown(project.appliedJobHistory[0].result.outputs[0])],
    ['job event', (project) => unknown(project.appliedJobHistory[0].events[0])],
    ['job event progress', (project) => unknown(project.appliedJobHistory[0].events[0].progress)],
    ['activity', (project) => unknown(project.activity[0])],
    ['activity change', (project) => unknown(project.activity[0].changes[0])],
  ];
  for (const [label, mutate] of cases) {
    const project = structuredClone(base);
    mutate(project);
    assert.throws(() => validateSqlitePortableProject(project), (error) => error.code === 'BUNDLE_SCHEMA_INVALID', label);
  }

  const resigned = join(value.root, 'resigned-unknown');
  await cp(bundle, resigned, { recursive: true });
  const tampered = structuredClone(base);
  tampered.sources[0].benignUnknownField = true;
  const projectBytes = Buffer.from(canonicalBundleJson(tampered));
  const manifest = JSON.parse(await readFile(join(resigned, 'manifest.json')));
  manifest.project = { sha256: createHash('sha256').update(projectBytes).digest('hex'), byteSize: projectBytes.length };
  const manifestBytes = Buffer.from(canonicalBundleJson(manifest));
  await writeFile(join(resigned, 'project.json'), projectBytes);
  await writeFile(join(resigned, 'manifest.json'), manifestBytes);
  await writeFile(join(resigned, 'manifest.sha256'), createHash('sha256').update(manifestBytes).digest('hex'));
  await assert.rejects(verifySqliteProjectBundle(resigned), (error) => error.code === 'BUNDLE_SCHEMA_INVALID');
});

test('SQLite projector excludes staged nonsemantic CAS and rejects unapplied terminal work', async (context) => {
  const value = await fixture(context);
  context.after(() => value.store.close());
  const metadata = await value.artifactStore.ingest(pngHeader({ width: 3, height: 3, tail: 'staged-nonsemantic' }), { mediaType: 'image/png' });
  const stagedDigest = metadata.digest;
  const intakes = new SqliteSourceIntakeStore({ workspace: value.store.workspace });
  intakes.stage(metadata, {
    projectId: PROJECT_ID,
    intakeId: 'intake.staged.nonsemantic',
    idempotencyKey: 'upload.staged.nonsemantic',
    origin: 'human_upload',
    createdRevision: 11,
  });
  const projected = projectSqlitePortableDocument({ projectStore: value.store, projectId: PROJECT_ID });
  assert.equal(projected.project.artifactDigests.includes(stagedDigest), false);
  assert.equal(projected.artifacts.some((artifact) => artifact.digest === stagedDigest), false);

  value.store.workspace.database.prepare(`
    UPDATE jobs SET state = 'SUCCEEDED', applied_revision = NULL WHERE project_id = ? AND job_id = 'job.bundle.preview'
  `).run(PROJECT_ID);
  assert.throws(
    () => projectSqlitePortableDocument({ projectStore: value.store, projectId: PROJECT_ID }),
    (error) => error.code === 'BUNDLE_NOT_QUIESCENT',
  );
});

test('deep v9 integrity rejects schema-valid proposal, finding, decision, head, lifecycle, and reference tampering', async (context) => {
  const cases = [
    ['proposal header', (db) => db.prepare("UPDATE asset_proposals SET request_fingerprint = ? WHERE proposal_id = 'proposal.bundle'").run('0'.repeat(64))],
    ['rejected proposal item deletion', (db) => {
      db.prepare("DELETE FROM asset_proposal_decisions WHERE proposal_id = 'proposal.bundle' AND item_id = 'item.bundle.rejected'").run();
      db.prepare("DELETE FROM asset_proposal_items WHERE proposal_id = 'proposal.bundle' AND item_id = 'item.bundle.rejected'").run();
    }],
    ['proposal finding deletion', (db) => db.prepare(`DELETE FROM asset_proposal_item_findings WHERE rowid = (SELECT rowid FROM asset_proposal_item_findings LIMIT 1)`).run()],
    ['proposal decision deletion', (db) => db.prepare("DELETE FROM asset_proposal_decisions WHERE proposal_id = 'proposal.bundle' AND item_id = 'item.bundle.rejected'").run()],
    ['proposal application deletion', (db) => db.prepare("DELETE FROM asset_proposal_applications WHERE proposal_id = 'proposal.bundle'").run()],
    ['version finding deletion', (db) => db.prepare(`DELETE FROM asset_version_findings WHERE rowid = (SELECT rowid FROM asset_version_findings LIMIT 1)`).run()],
    ['asset version reference deletion', (db) => db.prepare("DELETE FROM artifact_references WHERE owner_kind = 'asset_version'").run()],
    ['head name', (db) => db.prepare("UPDATE asset_heads SET name = 'Tampered head' WHERE asset_id = 'asset.bundle'").run()],
    ['head tag deletion', (db) => db.prepare("DELETE FROM asset_head_tags WHERE asset_id = 'asset.bundle'").run()],
    ['head lifecycle', (db) => db.prepare("UPDATE asset_heads SET lifecycle = 'FINAL' WHERE asset_id = 'asset.bundle'").run()],
  ];
  for (const [label, tamper] of cases) {
    await test(label, async () => {
      const value = await fixture(context);
      const before = await verifyWorkspaceIntegrity({ projectStore: value.store, artifactStore: value.artifactStore });
      assert.equal(before.assets.ok, true);
      tamper(value.store.workspace.database);
      const integrity = await verifyWorkspaceIntegrity({ projectStore: value.store, artifactStore: value.artifactStore });
      assert.equal(integrity.assets.ok, false, label);
      await assert.rejects(createSqliteProjectBundle({
        destinationDirectory: join(value.root, `tampered-${label.replaceAll(' ', '-')}`),
        projectStore: value.store,
        artifactStore: value.artifactStore,
        projectId: PROJECT_ID,
      }), (error) => error.code === 'BUNDLE_SOURCE_INTEGRITY_FAILED');
      value.store.close();
    });
  }
});

function durableAssetState(store) {
  const db = store.workspace.database;
  const rows = (table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
  return {
    project: rows('projects'),
    revisions: rows('revisions'),
    activity: rows('activity_events'),
    idempotency: rows('idempotency_records'),
    grants: rows('grants'),
    bindings: rows('asset_slice_bindings'),
    proposals: rows('asset_proposals'),
    items: rows('asset_proposal_items'),
    proposalFindings: rows('asset_proposal_item_findings'),
    decisions: rows('asset_proposal_decisions'),
    applications: rows('asset_proposal_applications'),
    versions: rows('asset_versions'),
    versionFindings: rows('asset_version_findings'),
    heads: rows('asset_heads'),
    tags: rows('asset_head_tags'),
    versionReferences: db.prepare("SELECT * FROM artifact_references WHERE owner_kind = 'asset_version' ORDER BY owner_id, digest").all(),
  };
}

test('every material asset append stage rolls back, restarts, retries once, and replays idempotently', async (context) => {
  const common = [
    'after_revision_insert',
    'after_activity_insert',
    'after_projection_update',
    'after_idempotency_insert',
    'after_grant_projection',
    'after_asset_library_revision',
    'before_transaction_commit',
  ];
  const groups = [
    {
      operation: 'proposal',
      context: AGENT_CONTEXT,
      points: [
        ['after_asset_slice_binding', 2],
        ['after_asset_proposal_insert', 1],
        ['after_asset_proposal_item_insert', 2],
        ['after_asset_proposal_finding_insert', 2],
        ...common.map((point) => [point, 1]),
      ],
    },
    {
      operation: 'decision',
      context: OWNER_CONTEXT,
      points: [
        ['after_asset_proposal_decision_insert', 2],
        ['after_asset_proposal_decision_status', 1],
        ...common.map((point) => [point, 1]),
      ],
    },
    {
      operation: 'apply',
      context: OWNER_CONTEXT,
      points: [
        ['after_asset_version_slice_binding', 2],
        ['after_asset_version_insert', 2],
        ['after_asset_version_finding_insert', 2],
        ['after_asset_version_reference_insert', 2],
        ['after_asset_head_update', 2],
        ['after_asset_head_tags_update', 2],
        ['after_asset_proposal_application_insert', 1],
        ['after_asset_proposal_application_status', 1],
        ...common.map((point) => [point, 1]),
      ],
    },
    {
      operation: 'lifecycle',
      context: OWNER_CONTEXT,
      points: [
        ['after_asset_version_slice_binding', 1],
        ['after_asset_version_insert', 1],
        ['after_asset_version_finding_insert', 1],
        ['after_asset_version_reference_insert', 1],
        ['after_asset_head_update', 1],
        ['after_asset_head_tags_update', 1],
        ['after_asset_lifecycle_write', 1],
        ...common.map((point) => [point, 1]),
      ],
    },
  ];
  for (const group of groups) {
    for (const [point, occurrence] of group.points) {
      await context.test(`${group.operation}:${point}@${occurrence}`, async () => {
        const faultControl = { point: null, occurrence, seen: 0 };
        const value = await fixture(context, {
          stopBefore: group.operation === 'lifecycle' ? null : group.operation,
          faultControl,
        });
        const target = group.operation === 'proposal'
          ? value.proposalCommand
          : group.operation === 'decision'
            ? value.decisionCommand
            : group.operation === 'apply'
              ? value.applyCommand
              : value.lifecycleCommand;
        const before = durableAssetState(value.store);
        const beforeIntegrity = value.store.integrityCheck();
        faultControl.point = point;
        await assert.rejects(value.studio.execute(target, group.context), new RegExp(`fault:${point}:${occurrence}`));
        assert.equal(faultControl.seen, occurrence);
        assert.deepEqual(durableAssetState(value.store), before);
        assert.deepEqual(value.store.integrityCheck(), beforeIntegrity);
        const filename = value.store.workspace.filename;
        value.store.close();
        faultControl.point = null;
        const reopened = await SqliteProjectStore.open({ filename, databaseFactory: nodeSqliteDatabaseFactory });
        const studio = new StudioService({
          store: reopened,
          jobStore: new SqliteJobStore({ workspace: reopened.workspace }),
          agentAttemptAuditReady: true,
        });
        const committed = await studio.execute(target, group.context);
        assert.equal(committed.replayed, false);
        const after = durableAssetState(reopened);
        const replay = await studio.execute(target, group.context);
        assert.equal(replay.replayed, true);
        assert.deepEqual(durableAssetState(reopened), after);
        assert.equal(reopened.integrityCheck().ok, true);
        if (group.operation === 'proposal') {
          const usage = JSON.parse(reopened.workspace.database.prepare("SELECT usage_json FROM grants WHERE grant_id = 'grant.atlas'").get().usage_json);
          assert.equal(usage.commands, 3);
        }
        reopened.close();
      });
    }
  }
});
