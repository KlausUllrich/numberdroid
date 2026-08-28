import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ProcessingResultAdoptionCommitService,
  ProcessingResultAdoptionPlanningService,
  StudioService,
} from '../packages/application/src/index.js';
import { fingerprint } from '../packages/application/src/value-utils.js';
import {
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  StudioError,
  canonicalProcessingResultAdoptionCommitResultJson,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  projectCapabilityManifestSha256,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteArtifactMetadataStore,
  SqliteProcessingResultAdoptionStore,
  SqliteProjectStore,
} from '../packages/persistence/src/index.js';
import {
  createExactPngCropProcessingResult,
  encodeCanonicalRgbaPng,
} from '../packages/preview/src/index.js';
import {
  OWNER,
  PROJECT_ID,
  createProject,
} from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const NOW = '2026-08-28T12:00:00.000Z';
const SETUP_AT = '2026-08-28T10:00:01.000Z';
const EXPIRES_AT = '2026-08-28T18:00:00.000Z';
const AGENT = Object.freeze({
  id: 'agent.processing.persistence',
  kind: 'agent',
  displayName: 'Processing Persistence Agent',
});
const TASK_ID = 'task.processing.persistence';
const GRANT_ID = 'grant.processing.persistence';
const BRANCH_ID = 'branch.task.processing.persistence';
const ASSET_ID = 'asset.processing.persistence';
const BUDGET = Object.freeze({
  maxCommands: 8,
  maxJobs: 0,
  maxArtifactBytes: 0,
  maxCostCents: 0,
});
const OBJECT_SCOPES = Object.freeze([
  Object.freeze({ kind: 'asset', id: ASSET_ID }),
  Object.freeze({ kind: 'project', id: PROJECT_ID }),
]);

function capabilityFixture() {
  const manifest = structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  manifest.profileId = 'fixture.processing-persistence-profile';
  manifest.profileVersion = 2;
  manifest.adapter = { id: 'fixture', version: 'v2' };
  manifest.modules.push({ id: 'studio.image-processing', version: 'v1' });
  manifest.outputFormats.push(
    { id: 'studio.asset-input-selection', version: 1, mediaType: 'application/json' },
    { id: 'studio.processing-adoption-preflight-receipt', version: 1, mediaType: 'application/json' },
    { id: 'studio.processing-recipe', version: 1, mediaType: 'application/json' },
    { id: 'studio.processing-result', version: 1, mediaType: 'application/json' },
  );
  manifest.operations.push({
    id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
    kind: 'validate',
    version: 1,
    moduleIds: ['studio.asset', 'studio.image-processing'],
    inputFormatIds: [
      'studio.asset-input-selection',
      'studio.processing-recipe',
      'studio.processing-result',
    ],
    outputFormatIds: ['studio.processing-adoption-preflight-receipt'],
  });
  return validateProjectCapabilityManifest(manifest);
}

function contextFixture() {
  return {
    actor: AGENT,
    taskId: TASK_ID,
    grantId: GRANT_ID,
    branchId: BRANCH_ID,
    correlationId: 'correlation.processing.persistence',
  };
}

function installPrivateGrantRevision(document) {
  const grant = {
    id: GRANT_ID,
    agentId: AGENT.id,
    taskId: TASK_ID,
    branchId: BRANCH_ID,
    scopes: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
    objectScopes: structuredClone(OBJECT_SCOPES),
    budget: structuredClone(BUDGET),
    usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
    expiresAt: EXPIRES_AT,
    issuedAt: SETUP_AT,
    issuedBy: OWNER.id,
    revokedAt: null,
    revokeReason: null,
    status: 'ACTIVE',
  };
  const snapshot = structuredClone(document.revisions.at(-1).snapshot);
  snapshot.project.updatedAt = SETUP_AT;
  snapshot.grants.push(grant);
  const commandIdentity = {
    schemaVersion: 1,
    type: 'grant.issue',
    projectId: PROJECT_ID,
    baseRevision: 1,
    expectedVersion: 1,
    actor: OWNER,
    taskId: null,
    grantId: null,
    branchId: 'branch.main',
    payload: {
      grantId: GRANT_ID,
      agentId: AGENT.id,
      taskId: TASK_ID,
      branchId: BRANCH_ID,
      scopes: grant.scopes,
      objectScopes: grant.objectScopes,
      budget: grant.budget,
      expiresAt: grant.expiresAt,
    },
  };
  return {
    id: 'revision:2',
    number: 2,
    parentRevision: 1,
    committedAt: SETUP_AT,
    command: {
      schemaVersion: 1,
      commandId: 'command.processing.fixture.grant',
      idempotencyKey: 'idempotency.processing.fixture.grant',
      type: 'grant.issue',
      actor: structuredClone(OWNER),
      taskId: null,
      grantId: null,
      fingerprint: fingerprint(commandIdentity),
    },
    snapshot,
    result: { grantId: GRANT_ID },
    event: {
      id: 'activity:command.processing.fixture.grant',
      projectId: PROJECT_ID,
      revision: 2,
      occurredAt: SETUP_AT,
      actor: structuredClone(OWNER),
      taskId: null,
      commandId: 'command.processing.fixture.grant',
      commandType: 'grant.issue',
      status: 'committed',
      summary: 'Private processing-result adoption grant installed for the A1.5 fixture.',
      changes: [{ entityType: 'grant', entityId: GRANT_ID, operation: 'created' }],
    },
  };
}

function plainRows(database, sql, ...parameters) {
  return JSON.parse(JSON.stringify(database.prepare(sql).all(...parameters)));
}

function durableState(store) {
  const database = store.workspace.database;
  return {
    projects: plainRows(database, 'SELECT * FROM projects ORDER BY project_id'),
    mainRevisions: plainRows(database, 'SELECT * FROM revisions ORDER BY project_id, revision_number'),
    mainActivity: plainRows(database, 'SELECT * FROM activity_events ORDER BY project_id, revision_number'),
    mainIdempotency: plainRows(database, 'SELECT * FROM idempotency_records ORDER BY project_id, idempotency_key'),
    grants: plainRows(database, 'SELECT * FROM grants ORDER BY project_id, grant_id'),
    tasks: plainRows(database, 'SELECT * FROM agent_tasks ORDER BY project_id, task_id'),
    branchRevisions: plainRows(database, 'SELECT * FROM task_branch_revisions ORDER BY project_id, task_id, branch_revision'),
    timeline: plainRows(database, 'SELECT * FROM task_timeline_events ORDER BY project_id, task_id, sequence'),
    adoptions: plainRows(database, 'SELECT * FROM task_branch_processing_result_adoptions ORDER BY project_id, task_id, branch_revision'),
    adoptionReferences: plainRows(database, 'SELECT * FROM task_branch_processing_result_artifact_references ORDER BY project_id, task_id, branch_revision, role'),
    artifacts: plainRows(database, 'SELECT * FROM artifacts ORDER BY digest'),
    artifactReferences: plainRows(database, 'SELECT * FROM artifact_references ORDER BY project_id, owner_kind, owner_id, digest'),
    casMarks: plainRows(database, 'SELECT * FROM cas_gc_marks ORDER BY digest'),
    cp2cBindings: plainRows(database, 'SELECT * FROM asset_slice_bindings ORDER BY project_id, slice_id, slice_version'),
    cp2cVersions: plainRows(database, 'SELECT * FROM asset_versions ORDER BY project_id, asset_id, asset_version'),
    cp2cFindings: plainRows(database, 'SELECT * FROM asset_version_findings ORDER BY project_id, asset_id, asset_version, finding_order'),
    cp2cHeads: plainRows(database, 'SELECT * FROM asset_heads ORDER BY project_id, asset_id'),
  };
}

function countCalls(calls) {
  return { clock: calls.clock, capability: calls.capability, cas: calls.cas };
}

function taskUsage(state) {
  const task = JSON.parse(state.tasks[0].task_json);
  const document = JSON.parse(state.tasks[0].head_document_json);
  const grant = document.revisions.at(-1).snapshot.grants.find(({ id }) => id === GRANT_ID);
  return { task: task.usage.commands, grant: grant.usage.commands };
}

function casObjectPath(root, digest) {
  return join(root, 'sha256', digest.slice(0, 2), digest.slice(2, 4), digest);
}

function assertMainAndCp2cUnchanged(before, after) {
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.mainRevisions, before.mainRevisions);
  assert.deepEqual(after.mainActivity, before.mainActivity);
  assert.deepEqual(after.mainIdempotency, before.mainIdempotency);
  assert.deepEqual(after.cp2cBindings, before.cp2cBindings);
  assert.deepEqual(after.cp2cVersions, before.cp2cVersions);
  assert.deepEqual(after.cp2cFindings, before.cp2cFindings);
  assert.deepEqual(after.cp2cHeads, before.cp2cHeads);
  assert.deepEqual(after.artifactReferences, before.artifactReferences);
}

async function expectStudioError(operation, code) {
  let observed;
  await assert.rejects(operation, (error) => {
    observed = error;
    return error instanceof StudioError && error.code === code;
  });
  return observed;
}

async function fixture(context, { sameDigest = false, manifestOverride = null } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-processing-adoption-persistence-'));
  const filename = join(root, 'studio.sqlite');
  const artifactRoot = join(root, 'artifacts');
  const manifest = manifestOverride ?? capabilityFixture();
  const calls = { clock: 0, capability: 0, cas: 0 };
  const fault = { point: null, seen: 0, occurrence: 1 };
  let adoptionNow = NOW;
  let store = await SqliteProjectStore.open({
    filename,
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (point !== fault.point) return;
      fault.seen += 1;
      if (fault.seen === fault.occurrence) {
        fault.point = null;
        throw new Error(`fault:${point}`);
      }
    },
  });
  context.after(async () => {
    try { store?.close(); } catch {}
    await rm(root, { recursive: true, force: true });
  });

  let studioTick = 0;
  const studio = new StudioService({
    store,
    clock: () => new Date(Date.UTC(2026, 7, 28, 10, 0, studioTick++)).toISOString(),
    agentAttemptAuditReady: true,
  });
  await createProject(studio);
  const initialDocument = await store.loadProject(PROJECT_ID);
  await store.appendRevision(PROJECT_ID, 1, installPrivateGrantRevision(initialDocument));
  const syntheticBranchDocument = await store.loadProject(PROJECT_ID);
  const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
  taskStore.createTask({
    task: {
      schemaVersion: 1,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
      branchId: BRANCH_ID,
      agentId: AGENT.id,
      title: 'Adopt one processing result',
      objective: 'Exercise the private A1.5 persistence boundary.',
      baseRevision: 2,
      capabilities: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
      objectScopes: OBJECT_SCOPES,
      budget: BUDGET,
      usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
      expiresAt: EXPIRES_AT,
      autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
    },
    baseDocument: syntheticBranchDocument,
    grantId: GRANT_ID,
    issuedBy: OWNER.id,
    now: '2026-08-28T10:00:02.000Z',
  });

  const sourceBytes = encodeCanonicalRgbaPng({
    width: 2,
    height: 2,
    rgba: Buffer.from([
      20, 40, 60, 255, 80, 100, 120, 255,
      140, 160, 180, 255, 200, 220, 240, 255,
    ]),
  });
  let artifactStore = new ContentAddressedArtifactStore({ rootDirectory: artifactRoot });
  const sourceArtifact = await artifactStore.ingest(sourceBytes, { mediaType: 'image/png' });
  const rectangle = {
    rectangleId: 'output.processing.primary',
    x: 0,
    y: 0,
    width: sameDigest ? 2 : 1,
    height: sameDigest ? 2 : 1,
    included: true,
    pivot: null,
    transparentPaddingPolicy: 'preserve_exact_rect',
    replacesSliceId: null,
    expectedSliceVersion: null,
  };
  const recipe = createExactPngCropProcessingRecipe({
    recipeId: sameDigest ? 'recipe.processing.same-digest' : 'recipe.processing.create',
    recipeVersion: 1,
    input: {
      inputId: 'input.processing.source',
      artifactUri: sourceArtifact.uri,
      sha256: sourceArtifact.digest,
      mediaType: sourceArtifact.mediaType,
      byteSize: sourceArtifact.byteSize,
      width: sourceArtifact.width,
      height: sourceArtifact.height,
    },
    operationId: 'operation.processing.crop',
    rectangles: [rectangle],
  });
  const processingResult = createExactPngCropProcessingResult({ recipe, sourceBytes });
  const selectedOutput = processingResult.operations[0].outputs[0];
  const outputBytes = sameDigest
    ? sourceBytes
    : encodeCanonicalRgbaPng({ width: 1, height: 1, rgba: Buffer.from([20, 40, 60, 255]) });
  const outputArtifact = await artifactStore.ingest(outputBytes, {
    mediaType: 'image/png',
    expectedDigest: selectedOutput.sha256,
  });
  assert.equal(sourceArtifact.digest === outputArtifact.digest, sameDigest);
  const metadata = new SqliteArtifactMetadataStore({ workspace: store.workspace });
  metadata.registerAndReference(sourceArtifact, {
    projectId: PROJECT_ID,
    ownerKind: 'processing_fixture',
    ownerId: 'recipe-input',
    createdRevision: 2,
  }, { createdAt: NOW });
  metadata.registerAndReference(outputArtifact, {
    projectId: PROJECT_ID,
    ownerKind: 'processing_fixture',
    ownerId: 'selected-output',
    createdRevision: 2,
  }, { createdAt: NOW });

  const selection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: selectedOutput.outputId,
    assetKind: 'surface',
  });
  const request = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    project: { projectId: PROJECT_ID, expectedRevision: 2 },
    processingRecipe: recipe,
    processingResult,
    assetInputSelection: selection,
    capability: {
      schemaVersion: manifest.schemaVersion,
      kind: manifest.kind,
      profileId: manifest.profileId,
      profileVersion: manifest.profileVersion,
      adapter: { ...manifest.adapter },
      manifestFingerprint: projectCapabilityManifestSha256(manifest),
      operation: { id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID, version: 1 },
    },
    target: {
      operation: 'create',
      assetId: ASSET_ID,
      expectedAssetVersion: 0,
      expectedMetadataVersion: 0,
    },
  };
  const adoptionCommand = {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId: 'command.processing.adopt.create',
    idempotencyKey: 'idempotency.processing.adopt.create',
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId: PROJECT_ID,
    baseRevision: 2,
    expectedVersion: 2,
    payload: { preflightRequest: request, assetName: 'Processing Fixture Surface' },
  };

  let capabilityOperation = async () => manifest;
  const capabilityProvider = {
    async getProjectCapabilityManifest(...arguments_) {
      calls.capability += 1;
      return capabilityOperation(...arguments_);
    },
  };

  const instrumentedCasStores = new WeakSet();

  function instrumentCas(value) {
    if (instrumentedCasStores.has(value)) return;
    instrumentedCasStores.add(value);
    const verify = value.withVerifiedPngEvidence.bind(value);
    value.withVerifiedPngEvidence = async (...arguments_) => {
      calls.cas += 1;
      return verify(...arguments_);
    };
  }

  function adoptionPersistence() {
    instrumentCas(artifactStore);
    return new SqliteProcessingResultAdoptionStore({
      workspace: store.workspace,
      artifactStore,
      capabilityProvider,
      clock() {
        calls.clock += 1;
        return adoptionNow;
      },
    });
  }

  function commitService() {
    const adoptionStore = adoptionPersistence();
    return new ProcessingResultAdoptionCommitService({
      atomicStore: adoptionStore.asAtomicStore(),
    });
  }

  function planningService() {
    const ports = planningPorts();
    return new ProcessingResultAdoptionPlanningService({
      ...ports,
      clock() {
        calls.clock += 1;
        return adoptionNow;
      },
    });
  }

  function planningPorts() {
    return adoptionPersistence().asPlanningPorts();
  }

  async function updateCommand({ changedDimensions = false } = {}) {
    let updateRecipe = recipe;
    let updateResult = processingResult;
    if (changedDimensions) {
      const changedRectangle = {
        ...rectangle,
        rectangleId: 'output.processing.changed-dimensions',
        width: 2,
        height: 1,
      };
      updateRecipe = createExactPngCropProcessingRecipe({
        recipeId: 'recipe.processing.update.changed-dimensions',
        recipeVersion: 1,
        input: structuredClone(recipe.inputs[0]),
        operationId: 'operation.processing.update.changed-dimensions',
        rectangles: [changedRectangle],
      });
      updateResult = createExactPngCropProcessingResult({
        recipe: updateRecipe,
        sourceBytes,
      });
      const changedOutput = updateResult.operations[0].outputs[0];
      const changedBytes = encodeCanonicalRgbaPng({
        width: 2,
        height: 1,
        rgba: Buffer.from([20, 40, 60, 255, 80, 100, 120, 255]),
      });
      const changedArtifact = await artifactStore.ingest(changedBytes, {
        mediaType: 'image/png',
        expectedDigest: changedOutput.sha256,
      });
      new SqliteArtifactMetadataStore({ workspace: store.workspace }).registerAndReference(
        changedArtifact,
        {
          projectId: PROJECT_ID,
          ownerKind: 'processing_fixture',
          ownerId: 'selected-output-update-changed',
          createdRevision: 2,
        },
        { createdAt: NOW },
      );
    }
    const updateOutput = updateResult.operations[0].outputs[0];
    const updateSelection = createPrimaryVisualAssetInputSelection({
      processingResult: updateResult,
      outputId: updateOutput.outputId,
      assetKind: 'surface',
    });
    const updateRequest = {
      schemaVersion: 1,
      kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
      project: { projectId: PROJECT_ID, expectedRevision: 3 },
      processingRecipe: updateRecipe,
      processingResult: updateResult,
      assetInputSelection: updateSelection,
      capability: structuredClone(request.capability),
      target: {
        operation: 'update',
        assetId: ASSET_ID,
        expectedAssetVersion: 1,
        expectedMetadataVersion: 1,
      },
    };
    return {
      schemaVersion: 1,
      kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
      commandId: changedDimensions
        ? 'command.processing.adopt.update.changed'
        : 'command.processing.adopt.update.same',
      idempotencyKey: changedDimensions
        ? 'idempotency.processing.adopt.update.changed'
        : 'idempotency.processing.adopt.update.same',
      type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
      projectId: PROJECT_ID,
      baseRevision: 3,
      expectedVersion: 3,
      payload: { preflightRequest: updateRequest, assetName: null },
    };
  }

  let service = commitService();
  return {
    root,
    filename,
    artifactRoot,
    manifest,
    calls,
    fault,
    sourceArtifact,
    outputArtifact,
    taskStore,
    command: adoptionCommand,
    context: contextFixture(),
    get store() { return store; },
    get service() { return service; },
    armFault(point, occurrence = 1) {
      fault.point = point;
      fault.seen = 0;
      fault.occurrence = occurrence;
    },
    updateCommand,
    planningService,
    planningPorts,
    setAdoptionNow(value) {
      adoptionNow = value;
    },
    replaceCapabilityProvider(operation) {
      capabilityOperation = operation;
    },
    replaceCasVerifier(operation) {
      artifactStore.withVerifiedPngEvidence = operation;
      instrumentedCasStores.delete(artifactStore);
    },
    wrapCasVerifier(operation) {
      const verify = artifactStore.withVerifiedPngEvidence.bind(artifactStore);
      artifactStore.withVerifiedPngEvidence = (...arguments_) => operation(verify, ...arguments_);
      instrumentedCasStores.delete(artifactStore);
    },
    async reopen() {
      store.close();
      store = await SqliteProjectStore.open({
        filename,
        databaseFactory: nodeSqliteDatabaseFactory,
        faultInjector(point) {
          if (point !== fault.point) return;
          fault.seen += 1;
          if (fault.seen === fault.occurrence) {
            fault.point = null;
            throw new Error(`fault:${point}`);
          }
        },
      });
      artifactStore = new ContentAddressedArtifactStore({ rootDirectory: artifactRoot });
      service = commitService();
      return service;
    },
  };
}

test('real A1.6a dry-run observes SQLite/CAS truth without persistence, retention, or budget effects', async (context) => {
  const value = await fixture(context, {
    manifestOverride: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  });
  const before = durableState(value.store);
  const authority = await value.planningPorts().taskAuthorityReader.readTaskAuthority({
    schemaVersion: 1,
    projectId: PROJECT_ID,
    branchId: BRANCH_ID,
    revision: 2,
    actorId: AGENT.id,
    taskId: TASK_ID,
    grantId: GRANT_ID,
    requiredScope: PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
    targetAssetId: ASSET_ID,
  });
  assert.equal(authority.task.taskId, TASK_ID);
  const service = value.planningService();
  const result = await service.prepare(value.command, value.context);
  const after = durableState(value.store);

  assert.equal(result.status, 'READY');
  assert.equal(result.plan.authority.commandBudgetCharge, 1);
  assert.equal(result.plan.target.assetId, ASSET_ID);
  assert.deepEqual(after, before);
  assert.deepEqual(taskUsage(after), { task: 0, grant: 0 });
  assert.equal(value.calls.capability, 1);
  assert.equal(value.calls.cas, 2);

  const committed = await value.service.commit(value.command, value.context);
  assert.equal(committed.status, 'COMMITTED');
  assert.deepEqual(taskUsage(durableState(value.store)), { task: 1, grant: 1 });
});

test('real A1.6a authority reader honors current grant state before capability or CAS', async (context) => {
  const cases = [
    {
      name: 'revoked row',
      code: 'GRANT_REVOKED',
      mutate(value) {
        value.store.workspace.database.prepare(`
          UPDATE grants
          SET authorization_status = 'REVOKED', status = 'REVOKED', revoked_at = ?
          WHERE project_id = ? AND grant_id = ?
        `).run(NOW, PROJECT_ID, GRANT_ID);
      },
    },
    {
      name: 'legacy-unbound row',
      code: 'GRANT_REQUIRED',
      mutate(value) {
        value.store.workspace.database.prepare(`
          UPDATE grants
          SET authorization_status = 'LEGACY_UNBOUND', status = 'LEGACY_UNBOUND'
          WHERE project_id = ? AND grant_id = ?
        `).run(PROJECT_ID, GRANT_ID);
      },
    },
    {
      name: 'missing current row',
      code: 'PROCESSING_ADOPTION_PORT_FAILED',
      clock: 0,
      mutate(value) {
        const database = value.store.workspace.database;
        database.exec('PRAGMA foreign_keys = OFF;');
        database.prepare(`
          DELETE FROM grants WHERE project_id = ? AND grant_id = ?
        `).run(PROJECT_ID, GRANT_ID);
        database.exec('PRAGMA foreign_keys = ON;');
      },
    },
    {
      name: 'authorization-status drift',
      code: 'GRANT_REVOKED',
      mutate(value) {
        value.store.workspace.database.prepare(`
          UPDATE grants SET authorization_status = 'REVOKED'
          WHERE project_id = ? AND grant_id = ?
        `).run(PROJECT_ID, GRANT_ID);
      },
    },
    {
      name: 'budget drift',
      code: 'PROCESSING_ADOPTION_PORT_FAILED',
      clock: 0,
      mutate(value) {
        value.store.workspace.database.prepare(`
          UPDATE grants SET budget_json = ?
          WHERE project_id = ? AND grant_id = ?
        `).run(JSON.stringify({ ...BUDGET, maxCommands: 7 }), PROJECT_ID, GRANT_ID);
      },
    },
    {
      name: 'expired task and grant',
      code: 'TASK_EXPIRED',
      mutate(value) {
        value.setAdoptionNow('2026-08-28T19:00:00.000Z');
      },
    },
  ];
  for (const candidate of cases) {
    await context.test(candidate.name, async (subtest) => {
      const value = await fixture(subtest);
      candidate.mutate(value);
      const before = durableState(value.store);
      await expectStudioError(
        () => value.planningService().prepare(value.command, value.context),
        candidate.code,
      );
      assert.deepEqual(durableState(value.store), before);
      assert.deepEqual(countCalls(value.calls), { clock: candidate.clock ?? 1, capability: 0, cas: 0 });
    });
  }
});

test('real A1.6a dry-run reports current artifact blockers without retaining or mutating', async (context) => {
  const value = await fixture(context);
  value.store.workspace.database.prepare(`
    UPDATE artifacts SET state = 'QUARANTINED' WHERE digest = ?
  `).run(value.outputArtifact.digest);
  const before = durableState(value.store);
  const result = await value.planningService().prepare(value.command, value.context);
  const after = durableState(value.store);

  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.plan, null);
  assert.ok(result.freshPreflightReceipt.blockers.some(({ code, subject }) => (
    code === 'PROCESSING_ADOPTION_ARTIFACT_NOT_LIVE' && subject === 'selected-output'
  )));
  assert.deepEqual(after, before);
  assert.deepEqual(taskUsage(after), { task: 0, grant: 0 });
  assert.equal(value.calls.capability, 1);
  assert.equal(value.calls.cas, 1);
});

test('real A1.6a maps project reference, metadata, and physical CAS blockers without effects', async (context) => {
  const cases = [
    {
      name: 'project reference missing',
      blocker: 'PROCESSING_ADOPTION_ARTIFACT_PROJECT_REFERENCE_MISSING',
      cas: 1,
      async mutate(value) {
        value.store.workspace.database.prepare(`
          DELETE FROM artifact_references
          WHERE project_id = ? AND digest = ?
        `).run(PROJECT_ID, value.outputArtifact.digest);
      },
    },
    {
      name: 'metadata missing',
      blocker: 'PROCESSING_ADOPTION_ARTIFACT_METADATA_MISSING',
      cas: 1,
      async mutate(value) {
        const database = value.store.workspace.database;
        database.exec('PRAGMA foreign_keys = OFF;');
        database.prepare('DELETE FROM artifacts WHERE digest = ?').run(value.outputArtifact.digest);
        database.exec('PRAGMA foreign_keys = ON;');
      },
    },
    {
      name: 'physical content missing',
      blocker: 'PROCESSING_ADOPTION_ARTIFACT_CONTENT_MISSING',
      cas: 2,
      async mutate(value) {
        await unlink(casObjectPath(value.artifactRoot, value.outputArtifact.digest));
      },
    },
    {
      name: 'physical content corrupt',
      blocker: 'PROCESSING_ADOPTION_ARTIFACT_CONTENT_CORRUPT',
      cas: 2,
      async mutate(value) {
        await writeFile(
          casObjectPath(value.artifactRoot, value.outputArtifact.digest),
          Buffer.from('not a PNG'),
        );
      },
    },
  ];
  for (const candidate of cases) {
    await context.test(candidate.name, async (subtest) => {
      const value = await fixture(subtest);
      await candidate.mutate(value);
      const before = durableState(value.store);
      const result = await value.planningService().prepare(value.command, value.context);
      assert.equal(result.status, 'BLOCKED');
      assert.ok(result.freshPreflightReceipt.blockers.some(({ code, subject }) => (
        code === candidate.blocker && subject === 'selected-output'
      )));
      assert.deepEqual(durableState(value.store), before);
      assert.deepEqual(taskUsage(before), { task: 0, grant: 0 });
      assert.deepEqual(countCalls(value.calls), { clock: 1, capability: 1, cas: candidate.cas });
    });
  }
});

test('real A1.6a preserves current registered-state precedence across a CAS error race', async (context) => {
  const value = await fixture(context);
  let stateAfterExternalChange = null;
  value.wrapCasVerifier(async (verify, digest, ...arguments_) => {
    if (digest === value.outputArtifact.digest) {
      value.store.workspace.database.prepare(`
        UPDATE artifacts SET state = 'QUARANTINED' WHERE digest = ?
      `).run(digest);
      await unlink(casObjectPath(value.artifactRoot, digest));
      stateAfterExternalChange = durableState(value.store);
    }
    return verify(digest, ...arguments_);
  });
  const result = await value.planningService().prepare(value.command, value.context);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.freshPreflightReceipt.blockers.some(({ code, subject }) => (
    code === 'PROCESSING_ADOPTION_ARTIFACT_NOT_LIVE' && subject === 'selected-output'
  )));
  assert.ok(!result.freshPreflightReceipt.blockers.some(({ code }) => (
    code === 'PROCESSING_ADOPTION_ARTIFACT_CONTENT_MISSING'
  )));
  assert.deepEqual(durableState(value.store), stateAfterExternalChange);
  assert.deepEqual(taskUsage(stateAfterExternalChange), { task: 0, grant: 0 });
});

test('real A1.6a dry-run rejects a stale branch before capability or CAS reads', async (context) => {
  const value = await fixture(context);
  const stale = structuredClone(value.command);
  stale.baseRevision = 1;
  stale.expectedVersion = 1;
  stale.payload.preflightRequest.project.expectedRevision = 1;
  const before = durableState(value.store);
  await expectStudioError(
    () => value.planningService().prepare(stale, value.context),
    'REVISION_CONFLICT',
  );
  assert.deepEqual(durableState(value.store), before);
  assert.deepEqual(countCalls(value.calls), { clock: 1, capability: 0, cas: 0 });
});

test('real A1.6a dry-run preserves cancellation during a real capability read with no effects', async (context) => {
  const value = await fixture(context);
  let startedResolve;
  let releaseResolve;
  const started = new Promise((resolve) => { startedResolve = resolve; });
  const release = new Promise((resolve) => { releaseResolve = resolve; });
  value.replaceCapabilityProvider(async () => {
    startedResolve();
    await release;
    return value.manifest;
  });
  const controller = new AbortController();
  const before = durableState(value.store);
  const pending = value.planningService().prepare(
    value.command,
    value.context,
    { signal: controller.signal },
  );
  await started;
  controller.abort();
  releaseResolve();
  await assert.rejects(pending, (error) => error?.name === 'AbortError');
  assert.deepEqual(durableState(value.store), before);
  assert.deepEqual(countCalls(value.calls), { clock: 1, capability: 1, cas: 0 });
});

test('real A1.6a dry-run cannot return READY across a concurrent branch commit', async (context) => {
  const value = await fixture(context);
  let advanced = false;
  let stateAfterCommit = null;
  value.wrapCasVerifier(async (verify, ...arguments_) => {
    const evidence = await verify(...arguments_);
    if (!advanced) {
      advanced = true;
      const committed = await value.service.commit(value.command, value.context);
      assert.equal(committed.status, 'COMMITTED');
      stateAfterCommit = durableState(value.store);
    }
    return evidence;
  });
  await expectStudioError(
    () => value.planningService().prepare(value.command, value.context),
    'PROCESSING_ADOPTION_PORT_FAILED',
  );
  assert.equal(advanced, true);
  assert.deepEqual(durableState(value.store), stateAfterCommit);
  assert.deepEqual(taskUsage(stateAfterCommit), { task: 1, grant: 1 });
});

test('A1.5 commit revalidates and rejects authority revoked after an A1.6a READY dry-run', async (context) => {
  const value = await fixture(context);
  const planned = await value.planningService().prepare(value.command, value.context);
  assert.equal(planned.status, 'READY');
  value.store.workspace.database.prepare(`
    UPDATE grants
    SET authorization_status = 'REVOKED', status = 'REVOKED', revoked_at = ?
    WHERE project_id = ? AND grant_id = ?
  `).run(NOW, PROJECT_ID, GRANT_ID);
  const beforeCommit = durableState(value.store);
  await expectStudioError(
    () => value.service.commit(value.command, value.context),
    'GRANT_REVOKED',
  );
  assert.deepEqual(durableState(value.store), beforeCommit);
  assert.deepEqual(taskUsage(beforeCommit), { task: 0, grant: 0 });
  assert.deepEqual(countCalls(value.calls), { clock: 2, capability: 1, cas: 2 });
});

test('real A1.6a dry-run sanitizes hostile CAS failures without consulting thrown proxy traps', async (context) => {
  const value = await fixture(context);
  let trapCalls = 0;
  const hostile = new Proxy({}, {
    get() { trapCalls += 1; throw new Error('private trap'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('private trap'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('private trap'); },
    ownKeys() { trapCalls += 1; throw new Error('private trap'); },
  });
  value.replaceCasVerifier(async () => { throw hostile; });
  const error = await expectStudioError(
    () => value.planningService().prepare(value.command, value.context),
    'PROCESSING_ADOPTION_PORT_FAILED',
  );
  assert.deepEqual(error.details, { port: 'taskBranchPreflightReader' });
  assert.equal(trapCalls, 0);
  assert.deepEqual(taskUsage(durableState(value.store)), { task: 0, grant: 0 });
});

test('real SQLite/CAS create commits once and exact replay survives process-store reopen without dependencies', async (context) => {
  const value = await fixture(context);
  const before = durableState(value.store);
  assert.deepEqual(taskUsage(before), { task: 0, grant: 0 });

  const committed = await value.service.commit(value.command, value.context);
  const after = durableState(value.store);

  assert.equal(committed.status, 'COMMITTED');
  assert.equal(committed.branchRevision, 3);
  assert.equal(after.branchRevisions.length - before.branchRevisions.length, 1);
  assert.equal(after.adoptions.length - before.adoptions.length, 1);
  assert.equal(after.adoptionReferences.length - before.adoptionReferences.length, 2);
  assert.equal(after.timeline.length - before.timeline.length, 1);
  assert.deepEqual(taskUsage(after), { task: 1, grant: 1 });
  assert.deepEqual(after.adoptionReferences.map(({ role }) => role), [
    'recipe-input',
    'selected-output',
  ]);
  assertMainAndCp2cUnchanged(before, after);
  assert.equal(JSON.parse(after.adoptions[0].record_json).asset.findings.length, 8);
  assert.deepEqual(JSON.parse(after.adoptions[0].record_json).asset.warningDispositions, []);

  const dependencyCalls = countCalls(value.calls);
  const serialReplay = await value.service.commit(value.command, value.context);
  assert.equal(
    canonicalProcessingResultAdoptionCommitResultJson(serialReplay),
    canonicalProcessingResultAdoptionCommitResultJson(committed),
  );
  assert.deepEqual(countCalls(value.calls), dependencyCalls);
  assert.deepEqual(durableState(value.store), after);

  await value.reopen();
  const reopenedReplay = await value.service.commit(value.command, value.context);
  assert.equal(
    canonicalProcessingResultAdoptionCommitResultJson(reopenedReplay),
    canonicalProcessingResultAdoptionCommitResultJson(committed),
  );
  assert.deepEqual(countCalls(value.calls), dependencyCalls);
  assert.deepEqual(durableState(value.store), after);
  assert.equal(value.store.integrityCheck().ok, true);
});

test('task-branch idempotency rejects semantic-key and command-ID conflicts without revalidation or writes', async (context) => {
  const value = await fixture(context);
  await value.service.commit(value.command, value.context);
  const committed = durableState(value.store);
  const dependencyCalls = countCalls(value.calls);

  const semanticConflict = structuredClone(value.command);
  semanticConflict.payload.assetName = 'Different semantic name';
  await expectStudioError(
    () => value.service.commit(semanticConflict, value.context),
    'IDEMPOTENCY_CONFLICT',
  );
  assert.deepEqual(countCalls(value.calls), dependencyCalls);
  assert.deepEqual(durableState(value.store), committed);

  const commandIdConflict = structuredClone(value.command);
  commandIdConflict.idempotencyKey = 'idempotency.processing.adopt.other';
  await expectStudioError(
    () => value.service.commit(commandIdConflict, value.context),
    'COMMAND_ID_CONFLICT',
  );
  assert.deepEqual(countCalls(value.calls), dependencyCalls);
  assert.deepEqual(durableState(value.store), committed);
});

test('real update preserves authored metadata and applies exact M versus M+1 fingerprint policy', async (context) => {
  for (const changedDimensions of [false, true]) {
    await context.test(changedDimensions ? 'changed fingerprint increments M' : 'same fingerprint preserves M', async (nested) => {
      const value = await fixture(nested);
      const initial = durableState(value.store);
      const created = await value.service.commit(value.command, value.context);
      const update = await value.updateCommand({ changedDimensions });
      const beforeUpdate = durableState(value.store);

      const committed = await value.service.commit(update, value.context);
      const after = durableState(value.store);
      const aggregates = after.adoptions.map((row) => JSON.parse(row.record_json));
      const createdAsset = aggregates[0].asset;
      const updatedAsset = aggregates[1].asset;

      assert.equal(created.asset.assetVersion, 1);
      assert.equal(committed.asset.assetVersion, 2);
      assert.equal(committed.asset.metadataVersion, changedDimensions ? 2 : 1);
      assert.equal(updatedAsset.assetVersion, 2);
      assert.equal(updatedAsset.metadataVersion, changedDimensions ? 2 : 1);
      assert.equal(updatedAsset.name, createdAsset.name);
      assert.equal(updatedAsset.lifecycle, 'DRAFT');
      assert.equal(updatedAsset.previousAssetVersion, 1);
      assert.equal(updatedAsset.previousMetadataVersion, 1);
      assert.deepEqual(updatedAsset.warningDispositions, []);
      const authored = (asset) => {
        const metadataValue = structuredClone(asset.metadata);
        delete metadataValue.pixelSize;
        delete metadataValue.pivot;
        return metadataValue;
      };
      assert.deepEqual(authored(updatedAsset), authored(createdAsset));
      assert.equal(
        updatedAsset.metadataFingerprint === createdAsset.metadataFingerprint,
        !changedDimensions,
      );
      assert.equal(after.branchRevisions.length, 2);
      assert.equal(after.adoptions.length, 2);
      assert.equal(after.adoptionReferences.length, 4);
      assert.equal(after.timeline.length - initial.timeline.length, 2);
      assert.deepEqual(taskUsage(after), { task: 2, grant: 2 });
      assertMainAndCp2cUnchanged(beforeUpdate, after);
      assert.equal(value.store.integrityCheck().ok, true);
    });
  }
});

test('same physical digest persists two immutable processing roles while verifying CAS once', async (context) => {
  const value = await fixture(context, { sameDigest: true });
  assert.equal(value.sourceArtifact.digest, value.outputArtifact.digest);

  const committed = await value.service.commit(value.command, value.context);
  const after = durableState(value.store);

  assert.equal(value.calls.cas, 1);
  assert.deepEqual(committed.permanentReferences, [
    { role: 'recipe-input', digest: value.sourceArtifact.digest },
    { role: 'selected-output', digest: value.sourceArtifact.digest },
  ]);
  assert.deepEqual(after.adoptionReferences.map(({ role, digest }) => ({ role, digest })), [
    { role: 'recipe-input', digest: value.sourceArtifact.digest },
    { role: 'selected-output', digest: value.sourceArtifact.digest },
  ]);
  assert.equal(after.adoptions.length, 1);
  assert.equal(after.branchRevisions.length, 1);
  assert.equal(value.store.integrityCheck().ok, true);
});

test('stale task authority, branch head, and CAS state each fail with an unchanged durable snapshot', async (context) => {
  await context.test('task authority stops before capability and CAS', async (nested) => {
    const value = await fixture(nested);
    const row = value.store.workspace.database.prepare(`
      SELECT task_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const task = JSON.parse(row.task_json);
    task.state = 'PAUSED';
    value.store.workspace.database.prepare(`
      UPDATE agent_tasks SET state = 'PAUSED', task_json = ?
      WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(task), PROJECT_ID, TASK_ID);
    const before = durableState(value.store);

    await expectStudioError(
      () => value.service.commit(value.command, value.context),
      'TASK_PAUSED',
    );
    assert.deepEqual(durableState(value.store), before);
    assert.equal(value.calls.capability, 0);
    assert.equal(value.calls.cas, 0);
  });

  await context.test('branch revision drift stops before capability and CAS', async (nested) => {
    const value = await fixture(nested);
    const document = value.taskStore.loadBranchDocument(PROJECT_ID, TASK_ID);
    const snapshot = structuredClone(document.revisions.at(-1).snapshot);
    value.taskStore.appendBranchRevision(PROJECT_ID, TASK_ID, 2, {
      id: `${BRANCH_ID}:revision:3`,
      number: 3,
      parentRevision: 2,
      committedAt: '2026-08-28T11:00:00.000Z',
      command: {
        schemaVersion: 1,
        commandId: 'command.processing.unrelated',
        idempotencyKey: 'idempotency.processing.unrelated',
        type: 'project.status.set',
        actor: AGENT,
        taskId: TASK_ID,
        grantId: GRANT_ID,
        branchId: BRANCH_ID,
        payload: { status: 'active' },
        fingerprint: '0'.repeat(64),
      },
      snapshot,
      result: { status: 'active' },
      event: {
        id: 'activity:command.processing.unrelated',
        projectId: PROJECT_ID,
        revision: 3,
        occurredAt: '2026-08-28T11:00:00.000Z',
        actor: AGENT,
        taskId: TASK_ID,
        branchId: BRANCH_ID,
        commandId: 'command.processing.unrelated',
        commandType: 'project.status.set',
        status: 'committed',
        summary: 'Unrelated branch drift.',
        changes: [],
      },
    });
    const before = durableState(value.store);

    await expectStudioError(
      () => value.service.commit(value.command, value.context),
      'REVISION_CONFLICT',
    );
    assert.deepEqual(durableState(value.store), before);
    assert.equal(value.calls.capability, 0);
    assert.equal(value.calls.cas, 0);
  });

  await context.test('CAS state drift rolls back after fresh physical verification', async (nested) => {
    const value = await fixture(nested);
    value.store.workspace.database.prepare(`
      UPDATE artifacts SET state = 'MISSING' WHERE digest = ?
    `).run(value.sourceArtifact.digest);
    const before = durableState(value.store);

    await expectStudioError(
      () => value.service.commit(value.command, value.context),
      'PROCESSING_ADOPTION_ARTIFACT_NOT_LIVE',
    );
    assert.deepEqual(durableState(value.store), before);
    assert.equal(value.calls.capability, 1);
    assert.equal(value.calls.cas, 2);
  });
});

test('every processing-adoption transaction fault rolls back across reopen, then retries exactly once', async (context) => {
  const faultPoints = [
    'after_processing_result_adoption_branch_revision',
    'after_processing_result_adoption_aggregate',
    'after_processing_result_adoption_reference_recipe-input',
    'after_processing_result_adoption_reference_selected-output',
    'after_processing_result_adoption_head_and_usage',
    'after_processing_result_adoption_activity',
    'before_processing_result_adoption_commit',
  ];
  for (const point of faultPoints) {
    await context.test(point, async (nested) => {
      const value = await fixture(nested);
      const before = durableState(value.store);
      value.armFault(point);

      await expectStudioError(
        () => value.service.commit(value.command, value.context),
        'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
      );
      assert.deepEqual(durableState(value.store), before);
      await value.reopen();
      assert.deepEqual(durableState(value.store), before);
      assert.equal(value.store.integrityCheck().ok, true);

      const committed = await value.service.commit(value.command, value.context);
      assert.equal(committed.status, 'COMMITTED');
      const after = durableState(value.store);
      assert.equal(after.branchRevisions.length, 1);
      assert.equal(after.adoptions.length, 1);
      assert.equal(after.adoptionReferences.length, 2);
      assert.equal(after.timeline.length - before.timeline.length, 1);
      assert.deepEqual(taskUsage(after), { task: 1, grant: 1 });
      const replay = await value.service.commit(value.command, value.context);
      assert.equal(
        canonicalProcessingResultAdoptionCommitResultJson(replay),
        canonicalProcessingResultAdoptionCommitResultJson(committed),
      );
      assert.deepEqual(durableState(value.store), after);
    });
  }
});

test('lost response after commit is recovered by exact replay after reopen without a second effect', async (context) => {
  const value = await fixture(context);
  const before = durableState(value.store);
  value.armFault('after_processing_result_adoption_commit');

  await expectStudioError(
    () => value.service.commit(value.command, value.context),
    'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
  );
  const committedState = durableState(value.store);
  assert.equal(committedState.branchRevisions.length, 1);
  assert.equal(committedState.adoptions.length, 1);
  assert.equal(committedState.adoptionReferences.length, 2);
  assert.equal(committedState.timeline.length - before.timeline.length, 1);
  assert.deepEqual(taskUsage(committedState), { task: 1, grant: 1 });
  const dependencyCalls = countCalls(value.calls);

  await value.reopen();
  const replay = await value.service.commit(value.command, value.context);
  assert.equal(replay.status, 'COMMITTED');
  assert.equal(replay.branchRevision, 3);
  assert.deepEqual(countCalls(value.calls), dependencyCalls);
  assert.deepEqual(durableState(value.store), committedState);
  assert.equal(value.store.integrityCheck().ok, true);
});
