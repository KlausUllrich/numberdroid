import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  processingRecipeSha256,
  projectCapabilityManifestSha256,
  validateAgentTaskSpec,
  validateProcessingResultAdoptionAggregate,
  validateProjectCapabilityManifest,
} from '../packages/domain/src/index.js';
import {
  FixedProjectCapabilityProvider,
  ProcessingResultAdoptionCommitService,
  ProcessingResultAdoptionHostBoundCommitService,
} from '../packages/application/src/index.js';
import { fingerprint } from '../packages/application/src/value-utils.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
  SqliteProcessingResultAdoptionStore,
  SqliteProjectStore,
  createWorkspaceBackup,
  verifyWorkspaceBackup,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';
import { NUMBERDROID_PROJECT_CAPABILITY_MANIFEST } from '../packages/numberdroid-adapter/src/index.js';
import { encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import {
  AGENT,
  OWNER,
  PROJECT_ID,
  createHarness,
  createProject,
} from './test-helpers.js';
import {
  afterTestCleanup,
  nodeSqliteDatabaseFactory,
} from './persistence-test-helpers.js';

const SETUP_AT = '2026-08-28T10:00:00.000Z';
const COMMITTED_AT = '2026-08-28T10:01:00.000Z';
const EXPIRES_AT = '2026-09-02T10:00:00.000Z';
const TASK_ID = 'task.processing-adoption';
const GRANT_ID = 'grant.processing-adoption';
const BRANCH_ID = 'branch.processing-adoption';
const ASSET_ID = 'asset.processing-adoption';

class CountingArtifactStore extends ContentAddressedArtifactStore {
  evidenceCalls = 0;

  failEvidence = false;

  async withVerifiedPngEvidence(digest, operation) {
    this.evidenceCalls += 1;
    if (this.failEvidence) throw new Error('CAS evidence must not be consulted during replay.');
    return super.withVerifiedPngEvidence(digest, operation);
  }
}

class CountingCapabilityProvider extends FixedProjectCapabilityProvider {
  calls = 0;

  async getProjectCapabilityManifest(...args) {
    this.calls += 1;
    return super.getProjectCapabilityManifest(...args);
  }
}

function capabilityFixture() {
  const manifest = structuredClone(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST);
  manifest.profileId = 'fixture.processing-adoption';
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

function descriptor(artifact) {
  return {
    artifactUri: artifact.uri,
    sha256: artifact.digest,
    mediaType: artifact.mediaType,
    byteSize: artifact.byteSize,
    width: artifact.width,
    height: artifact.height,
  };
}

function installPrivateGrantRevision(document) {
  const grant = {
    id: GRANT_ID,
    agentId: AGENT.id,
    taskId: TASK_ID,
    branchId: BRANCH_ID,
    scopes: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
    objectScopes: [
      { kind: 'project', id: PROJECT_ID },
      { kind: 'asset', id: ASSET_ID },
    ],
    budget: {
      maxCommands: 20,
      maxJobs: 0,
      maxArtifactBytes: 0,
      maxCostCents: 0,
    },
    usage: { commands: 0, jobs: 0, artifactBytes: 0, costCents: 0 },
    expiresAt: EXPIRES_AT,
    issuedAt: SETUP_AT,
    issuedBy: OWNER.id,
    revokedAt: null,
    revokeReason: null,
    status: 'ACTIVE',
  };
  const prior = document.revisions.at(-1);
  const snapshot = structuredClone(prior.snapshot);
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
      commandId: 'command.private-grant',
      idempotencyKey: 'idempotency.private-grant',
      type: 'grant.issue',
      actor: structuredClone(OWNER),
      taskId: null,
      grantId: null,
      fingerprint: fingerprint(commandIdentity),
    },
    snapshot,
    result: { grantId: GRANT_ID },
    event: {
      id: 'activity:command.private-grant',
      projectId: PROJECT_ID,
      revision: 2,
      occurredAt: SETUP_AT,
      actor: structuredClone(OWNER),
      taskId: null,
      commandId: 'command.private-grant',
      commandType: 'grant.issue',
      status: 'committed',
      summary: 'Private processing-result adoption grant installed for the A1.5 seam.',
      changes: [{ entityType: 'grant', entityId: GRANT_ID, operation: 'created' }],
    },
  };
}

function processingWarning() {
  return {
    severity: 'WARNING',
    ruleId: 'studio.processing.review_recommended',
    objectRef: 'output:rect.adopted',
    explanation: 'The selected exact crop should remain inspectable during later review.',
    remediation: 'Review the DRAFT Asset before an owner-controlled lifecycle transition.',
    validatorVersion: 'studio.processing-validator.v1',
  };
}

function adoptionCommand({
  manifest,
  inputArtifact,
  outputArtifact,
  baseRevision,
  projectId = PROJECT_ID,
  operation = 'create',
  commandId = `command.adopt.${baseRevision}`,
  idempotencyKey = `idempotency.adopt.${baseRevision}`,
  findings = [processingWarning()],
}) {
  const input = descriptor(inputArtifact);
  const output = descriptor(outputArtifact);
  const recipe = createExactPngCropProcessingRecipe({
    recipeId: `recipe.adopt.${baseRevision}`,
    recipeVersion: 1,
    input: { inputId: 'input.source', ...input },
    operationId: 'operation.exact-crop',
    rectangles: [{
      rectangleId: 'rect.adopted',
      x: 0,
      y: 0,
      width: output.width,
      height: output.height,
      included: true,
      pivot: null,
      transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null,
      expectedSliceVersion: null,
    }],
  });
  const recipeOperation = recipe.operations[0];
  const processingResult = {
    schemaVersion: 1,
    kind: 'studio.processing-result',
    recipe: {
      id: recipe.recipeId,
      version: recipe.recipeVersion,
      fingerprint: processingRecipeSha256(recipe),
    },
    operations: [{
      operationId: recipeOperation.operationId,
      kind: recipeOperation.kind,
      processorId: recipeOperation.processorId,
      inputs: structuredClone(recipe.inputs),
      outputs: [{ outputId: 'rect.adopted', ...output }],
    }],
    findings,
  };
  const assetInputSelection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'rect.adopted',
    assetKind: 'surface',
  });
  const request = {
    schemaVersion: 1,
    kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
    project: { projectId, expectedRevision: baseRevision },
    processingRecipe: recipe,
    processingResult,
    assetInputSelection,
    capability: {
      schemaVersion: manifest.schemaVersion,
      kind: manifest.kind,
      profileId: manifest.profileId,
      profileVersion: manifest.profileVersion,
      adapter: structuredClone(manifest.adapter),
      manifestFingerprint: projectCapabilityManifestSha256(manifest),
      operation: { id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID, version: 1 },
    },
    target: {
      operation,
      assetId: ASSET_ID,
      expectedAssetVersion: operation === 'create' ? 0 : baseRevision - 2,
      expectedMetadataVersion: operation === 'create' ? 0 : 1,
    },
  };
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId,
    idempotencyKey,
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId,
    baseRevision,
    expectedVersion: baseRevision,
    payload: {
      preflightRequest: request,
      assetName: operation === 'create' ? 'Processing Adoption Fixture' : null,
    },
  };
}

async function fixture(context, {
  faultPoint = null,
  sameDigest = false,
  atomicClock = () => COMMITTED_AT,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'numberdroid-processing-adoption-'));
  afterTestCleanup(context, () => rm(directory, { recursive: true, force: true }));
  const fault = { armed: false, point: faultPoint };
  const projectStore = await SqliteProjectStore.open({
    filename: join(directory, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
    faultInjector(point) {
      if (fault.armed && point === fault.point) throw new Error(`simulated fault: ${point}`);
    },
  });
  afterTestCleanup(context, () => projectStore.close());
  const { studio } = createHarness(projectStore);
  await createProject(studio);
  const initialDocument = await projectStore.loadProject(PROJECT_ID);
  await projectStore.appendRevision(PROJECT_ID, 1, installPrivateGrantRevision(initialDocument));
  const baseDocument = await projectStore.loadProject(PROJECT_ID);
  const task = validateAgentTaskSpec({
    taskId: TASK_ID,
    branchId: BRANCH_ID,
    agentId: AGENT.id,
    title: 'Adopt exact processing outputs',
    objective: 'Exercise the private A1.5 atomic processing-result adoption seam.',
    capabilities: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
    objectScopes: [
      { kind: 'project', id: PROJECT_ID },
      { kind: 'asset', id: ASSET_ID },
    ],
    budget: {
      maxCommands: 20,
      maxJobs: 0,
      maxArtifactBytes: 0,
      maxCostCents: 0,
    },
    expiresAt: EXPIRES_AT,
    autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  }, { now: SETUP_AT, projectId: PROJECT_ID, baseRevision: 2 });
  const taskStore = new SqliteAgentTaskStore({ workspace: projectStore.workspace });
  taskStore.createTask({ task, baseDocument, grantId: GRANT_ID, issuedBy: OWNER.id, now: SETUP_AT });

  const artifactStore = new CountingArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  const inputBytes = sameDigest
    ? encodeCanonicalRgbaPng({ width: 1, height: 1, rgba: Buffer.from([20, 40, 60, 255]) })
    : encodeCanonicalRgbaPng({
      width: 2,
      height: 1,
      rgba: Buffer.from([20, 40, 60, 255, 80, 100, 120, 255]),
    });
  const firstOutputBytes = sameDigest
    ? inputBytes
    : encodeCanonicalRgbaPng({ width: 1, height: 1, rgba: Buffer.from([20, 40, 60, 255]) });
  const secondOutputBytes = encodeCanonicalRgbaPng({
    width: 1,
    height: 1,
    rgba: Buffer.from([80, 100, 120, 255]),
  });
  const inputArtifact = await artifactStore.ingest(inputBytes, { mediaType: 'image/png' });
  const firstOutputArtifact = sameDigest
    ? inputArtifact
    : await artifactStore.ingest(firstOutputBytes, { mediaType: 'image/png' });
  const secondOutputArtifact = await artifactStore.ingest(secondOutputBytes, { mediaType: 'image/png' });
  const artifactMetadata = new SqliteArtifactMetadataStore({ workspace: projectStore.workspace });
  for (const [index, artifact] of [...new Map([
    inputArtifact,
    firstOutputArtifact,
    secondOutputArtifact,
  ].map((value) => [value.digest, value])).values()].entries()) {
    artifactMetadata.registerAndReference(artifact, {
      projectId: PROJECT_ID,
      ownerKind: 'processing_fixture',
      ownerId: `artifact.${index + 1}`,
      createdRevision: 2,
    }, { createdAt: SETUP_AT });
  }
  const manifest = capabilityFixture();
  const capabilityProvider = new CountingCapabilityProvider({ manifest });
  const dependencyCalls = { clock: 0 };
  const atomicStore = new SqliteProcessingResultAdoptionStore({
    workspace: projectStore.workspace,
    artifactStore,
    capabilityProvider,
    clock: () => {
      dependencyCalls.clock += 1;
      return atomicClock();
    },
  });
  const service = new ProcessingResultAdoptionCommitService({ atomicStore: atomicStore.asAtomicStore() });
  const contextValue = {
    actor: structuredClone(AGENT),
    taskId: TASK_ID,
    grantId: GRANT_ID,
    branchId: BRANCH_ID,
    correlationId: 'correlation.processing-adoption',
  };
  return {
    projectStore,
    taskStore,
    artifactStore,
    artifactMetadata,
    capabilityProvider,
    dependencyCalls,
    atomicStore,
    service,
    manifest,
    inputArtifact,
    firstOutputArtifact,
    secondOutputArtifact,
    contextValue,
    fault,
  };
}

async function committedCreateFixture(context) {
  const value = await fixture(context);
  const command = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
  });
  await value.service.commit(command, value.contextValue);
  return value;
}

function hostBoundCommitService(value, { expiresAt = EXPIRES_AT } = {}) {
  const hostBindingStore = new SqliteHostBindingStore({
    workspace: value.projectStore.workspace,
    clock: () => COMMITTED_AT,
  });
  const issued = hostBindingStore.issue({
    projectId: PROJECT_ID,
    grantId: GRANT_ID,
    agentId: AGENT.id,
    taskId: TASK_ID,
    branchId: BRANCH_ID,
    issuedBy: OWNER.id,
    expiresAt,
  });
  const binding = hostBindingStore.resolve(issued.token);
  return {
    binding,
    bindingStore: hostBindingStore,
    issued,
    service: new ProcessingResultAdoptionHostBoundCommitService({
      atomicStore: value.atomicStore.asHostBoundAtomicStore(binding),
    }),
  };
}

async function assertTaskIntegrityFinding(value, code, predicate = () => true) {
  const integrity = await verifyWorkspaceIntegrity({
    projectStore: value.projectStore,
    artifactStore: value.artifactStore,
  });
  assert.equal(integrity.ok, false);
  assert.equal(integrity.tasks.ok, false);
  assert.ok(
    integrity.tasks.findings.some((entry) => entry.code === code && predicate(entry)),
    `${code} missing from ${JSON.stringify(integrity.tasks.findings)}`,
  );
}

function durableTaskBranchState(database) {
  return JSON.stringify({
    task: database.prepare(`
      SELECT * FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID),
    revisions: database.prepare(`
      SELECT * FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? ORDER BY branch_revision
    `).all(PROJECT_ID, TASK_ID),
    adoptions: database.prepare(`
      SELECT * FROM task_branch_processing_result_adoptions
      WHERE project_id = ? AND task_id = ? ORDER BY branch_revision
    `).all(PROJECT_ID, TASK_ID),
    references: database.prepare(`
      SELECT * FROM task_branch_processing_result_artifact_references
      WHERE project_id = ? AND task_id = ? ORDER BY branch_revision, role
    `).all(PROJECT_ID, TASK_ID),
    timeline: database.prepare(`
      SELECT * FROM task_timeline_events
      WHERE project_id = ? AND task_id = ? ORDER BY sequence
    `).all(PROJECT_ID, TASK_ID),
  });
}

test('host-bound atomic admission rejects hostile captures without invoking traps or accessors', async (context) => {
  const value = await fixture(context);
  const { binding } = hostBoundCommitService(value);
  let trapCalls = 0;
  const proxy = new Proxy({}, {
    get() { trapCalls += 1; throw new Error('private trap'); },
    getOwnPropertyDescriptor() { trapCalls += 1; throw new Error('private trap'); },
    getPrototypeOf() { trapCalls += 1; throw new Error('private trap'); },
    ownKeys() { trapCalls += 1; throw new Error('private trap'); },
  });
  assert.throws(
    () => value.atomicStore.asHostBoundAtomicStore(proxy),
    (error) => error.code === 'HOST_BINDING_INVALID',
  );
  assert.equal(trapCalls, 0);

  let getterCalls = 0;
  const accessor = { ...binding };
  Object.defineProperty(accessor, 'actor', {
    enumerable: true,
    get() { getterCalls += 1; throw new Error('private getter'); },
  });
  assert.throws(
    () => value.atomicStore.asHostBoundAtomicStore(accessor),
    (error) => error.code === 'HOST_BINDING_INVALID',
  );
  assert.equal(getterCalls, 0);
});

test('host-bound atomic admission rejects every command and execution-context coordinate drift before dependencies', async (context) => {
  const value = await fixture(context);
  const bound = hostBoundCommitService(value);
  const command = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
  });
  const before = durableTaskBranchState(value.projectStore.workspace.database);
  const candidates = [
    {
      name: 'project',
      command: adoptionCommand({
        manifest: value.manifest,
        inputArtifact: value.inputArtifact,
        outputArtifact: value.firstOutputArtifact,
        baseRevision: 2,
        projectId: 'project.coordinate-drift',
      }),
      executionContext: value.contextValue,
    },
    {
      name: 'actor',
      command,
      executionContext: { ...value.contextValue, actor: { ...value.contextValue.actor, id: 'agent.coordinate-drift' } },
    },
    {
      name: 'task',
      command,
      executionContext: { ...value.contextValue, taskId: 'task.coordinate-drift' },
    },
    {
      name: 'grant',
      command,
      executionContext: { ...value.contextValue, grantId: 'grant.coordinate-drift' },
    },
    {
      name: 'branch',
      command,
      executionContext: { ...value.contextValue, branchId: 'branch.coordinate-drift' },
    },
  ];
  for (const candidate of candidates) {
    await assert.rejects(
      bound.service.commit(candidate.command, candidate.executionContext),
      (error) => error.code === 'HOST_BINDING_GRANT_MISMATCH',
      candidate.name,
    );
  }
  assert.equal(value.dependencyCalls.clock, 0);
  assert.equal(value.capabilityProvider.calls, 0);
  assert.equal(value.artifactStore.evidenceCalls, 0);
  assert.equal(durableTaskBranchState(value.projectStore.workspace.database), before);
});

test('host-bound replay requires a currently live HostBinding and Grant before ledger lookup', async (context) => {
  for (const candidate of [
    {
      name: 'HostBinding revoked',
      code: 'HOST_BINDING_REVOKED',
      revoke(value, bound) {
        bound.bindingStore.revoke(bound.binding.bindingId, {
          revokedBy: OWNER.id,
          reason: 'replay admission test',
        });
      },
    },
    {
      name: 'Grant revoked',
      code: 'GRANT_REVOKED',
      revoke(value) {
        value.projectStore.workspace.database.prepare(`
          UPDATE grants
          SET authorization_status = 'REVOKED', status = 'REVOKED', revoked_at = ?
          WHERE project_id = ? AND grant_id = ?
        `).run(COMMITTED_AT, PROJECT_ID, GRANT_ID);
      },
    },
  ]) {
    await context.test(candidate.name, async (subtest) => {
      const value = await fixture(subtest);
      const bound = hostBoundCommitService(value);
      const command = adoptionCommand({
        manifest: value.manifest,
        inputArtifact: value.inputArtifact,
        outputArtifact: value.firstOutputArtifact,
        baseRevision: 2,
      });
      const committed = await bound.service.commit(command, value.contextValue);
      candidate.revoke(value, bound);
      const beforeReplay = durableTaskBranchState(value.projectStore.workspace.database);
      const capabilityCalls = value.capabilityProvider.calls;
      const evidenceCalls = value.artifactStore.evidenceCalls;

      await assert.rejects(
        bound.service.commit(command, value.contextValue),
        (error) => error.code === candidate.code,
      );
      assert.equal(durableTaskBranchState(value.projectStore.workspace.database), beforeReplay);
      assert.equal(value.capabilityProvider.calls, capabilityCalls);
      assert.equal(value.artifactStore.evidenceCalls, evidenceCalls);
      assert.equal(committed.branchRevision, 3);
    });
  }
});

test('host-bound atomic admission rechecks HostBinding liveness inside the mutation UoW', async (context) => {
  for (const candidate of ['capability', 'CAS']) {
    await context.test(`revoked during ${candidate}`, async (subtest) => {
      const value = await fixture(subtest);
      const bound = hostBoundCommitService(value);
      const command = adoptionCommand({
        manifest: value.manifest,
        inputArtifact: value.inputArtifact,
        outputArtifact: value.firstOutputArtifact,
        baseRevision: 2,
      });
      const database = value.projectStore.workspace.database;
      const before = durableTaskBranchState(database);
      let revoked = false;
      const revoke = () => {
        if (revoked) return;
        revoked = true;
        bound.bindingStore.revoke(bound.binding.bindingId, {
          revokedBy: OWNER.id,
          reason: `${candidate} race test`,
        });
      };
      if (candidate === 'capability') {
        const readCapability = value.capabilityProvider.getProjectCapabilityManifest
          .bind(value.capabilityProvider);
        value.capabilityProvider.getProjectCapabilityManifest = async (...arguments_) => {
          const manifest = await readCapability(...arguments_);
          revoke();
          return manifest;
        };
      } else {
        const verify = value.artifactStore.withVerifiedPngEvidence.bind(value.artifactStore);
        value.artifactStore.withVerifiedPngEvidence = (digest, operation) => (
          verify(digest, async (evidence) => {
            revoke();
            return operation(evidence);
          })
        );
      }

      await assert.rejects(
        bound.service.commit(command, value.contextValue),
        (error) => error.code === 'HOST_BINDING_REVOKED',
      );
      assert.equal(revoked, true);
      assert.equal(durableTaskBranchState(database), before);
      assert.equal(Number(database.prepare(`
        SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions
        WHERE project_id = ? AND task_id = ?
      `).get(PROJECT_ID, TASK_ID).count), 0);
    });
  }
});

test('host-bound transaction clock rejects Binding or Grant expiry crossed during dependency work', async (context) => {
  for (const candidate of [
    { name: 'HostBinding expiry', bindingExpiresAt: EXPIRES_AT, code: 'HOST_BINDING_EXPIRED' },
    { name: 'Grant expiry', bindingExpiresAt: null, code: 'GRANT_EXPIRED' },
  ]) {
    await context.test(candidate.name, async (subtest) => {
      let clockReads = 0;
      const value = await fixture(subtest, {
        atomicClock() {
          clockReads += 1;
          return clockReads === 1 ? COMMITTED_AT : EXPIRES_AT;
        },
      });
      const bound = hostBoundCommitService(value, { expiresAt: candidate.bindingExpiresAt });
      const command = adoptionCommand({
        manifest: value.manifest,
        inputArtifact: value.inputArtifact,
        outputArtifact: value.firstOutputArtifact,
        baseRevision: 2,
      });
      const before = durableTaskBranchState(value.projectStore.workspace.database);

      await assert.rejects(
        bound.service.commit(command, value.contextValue),
        (error) => error.code === candidate.code,
      );
      assert.ok(clockReads >= 2);
      assert.equal(durableTaskBranchState(value.projectStore.workspace.database), before);
      assert.equal(Number(value.projectStore.workspace.database.prepare(`
        SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions
        WHERE project_id = ? AND task_id = ?
      `).get(PROJECT_ID, TASK_ID).count), 0);
    });
  }
});

test('host-bound transaction admission runs before a concurrently committed replay', async (context) => {
  const value = await fixture(context);
  const bound = hostBoundCommitService(value);
  const command = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
  });
  const readCapability = value.capabilityProvider.getProjectCapabilityManifest
    .bind(value.capabilityProvider);
  let injected = false;
  let concurrentlyCommitted = null;
  let stateAfterConcurrentCommit = null;
  value.capabilityProvider.getProjectCapabilityManifest = async (...arguments_) => {
    const manifest = await readCapability(...arguments_);
    if (!injected) {
      injected = true;
      concurrentlyCommitted = await value.service.commit(command, value.contextValue);
      bound.bindingStore.revoke(bound.binding.bindingId, {
        revokedBy: OWNER.id,
        reason: 'concurrent replay admission test',
      });
      stateAfterConcurrentCommit = durableTaskBranchState(value.projectStore.workspace.database);
    }
    return manifest;
  };

  await assert.rejects(
    bound.service.commit(command, value.contextValue),
    (error) => error.code === 'HOST_BINDING_REVOKED',
  );
  assert.equal(concurrentlyCommitted.status, 'COMMITTED');
  assert.equal(concurrentlyCommitted.branchRevision, 3);
  assert.equal(durableTaskBranchState(value.projectStore.workspace.database), stateAfterConcurrentCommit);
});

test('SQLite adoption commits create/update lineage atomically and replay never revalidates CAS', async (context) => {
  const value = await fixture(context);
  const database = value.projectStore.workspace.database;
  const mainReferencesBefore = Number(database.prepare('SELECT COUNT(*) AS count FROM artifact_references').get().count);
  const createCommand = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
  });
  const created = await value.service.commit(createCommand, value.contextValue);
  assert.equal(created.kind, PROCESSING_RESULT_ADOPTION_COMMIT_RESULT_KIND);
  assert.equal(created.status, 'COMMITTED');
  assert.equal(created.branchRevision, 3);
  assert.equal(created.asset.assetVersion, 1);
  assert.equal(created.asset.metadataVersion, 1);
  assert.equal(created.commandBudgetCharge, 1);
  assert.deepEqual(created.permanentReferences.map(({ role }) => role), ['recipe-input', 'selected-output']);

  const adoptionRow = database.prepare(`
    SELECT * FROM task_branch_processing_result_adoptions
    WHERE project_id = ? AND task_id = ? AND branch_revision = 3
  `).get(PROJECT_ID, TASK_ID);
  const aggregate = validateProcessingResultAdoptionAggregate(JSON.parse(adoptionRow.record_json));
  assert.equal(aggregate.kind, PROCESSING_RESULT_ADOPTION_AGGREGATE_KIND);
  assert.deepEqual(aggregate.commitResult, created);
  assert.equal(aggregate.unresolvedProcessingWarnings.length, 1);
  assert.deepEqual(JSON.parse(adoptionRow.result_json), created);
  const createdReferences = database.prepare(`
    SELECT role, digest FROM task_branch_processing_result_artifact_references
    WHERE project_id = ? AND task_id = ? AND branch_revision = 3 ORDER BY role
  `).all(PROJECT_ID, TASK_ID).map((row) => ({ role: row.role, digest: row.digest }));
  assert.deepEqual(createdReferences, [
    { role: 'recipe-input', digest: value.inputArtifact.digest },
    { role: 'selected-output', digest: value.firstOutputArtifact.digest },
  ]);
  const branchRevision = JSON.parse(database.prepare(`
    SELECT revision_json FROM task_branch_revisions
    WHERE project_id = ? AND task_id = ? AND branch_revision = 3
  `).get(PROJECT_ID, TASK_ID).revision_json);
  assert.deepEqual(branchRevision.result, created);
  assert.equal(branchRevision.snapshot.processingResultAdoptionHeads.schemaVersion, 1);
  assert.equal(branchRevision.snapshot.processingResultAdoptionHeads.assets[0].assetId, ASSET_ID);
  assert.equal(branchRevision.snapshot.grants[0].usage.commands, 1);
  assert.equal(value.taskStore.getTask(PROJECT_ID, TASK_ID).usage.commands, 1);
  assert.equal(JSON.parse(database.prepare('SELECT usage_json FROM grants WHERE grant_id = ?').get(GRANT_ID).usage_json).commands, 0);
  assert.equal(Number(database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(PROJECT_ID).head_revision), 2);
  assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM revisions').get().count), 2);
  assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM asset_versions').get().count), 0);
  assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM artifact_references').get().count), mainReferencesBefore);

  const callsAfterCreate = value.artifactStore.evidenceCalls;
  const capabilityCallsAfterCreate = value.capabilityProvider.calls;
  const clockCallsAfterCreate = value.dependencyCalls.clock;
  const durableStateAfterCreate = {
    branchRevisions: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    adoptions: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    references: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_branch_processing_result_artifact_references
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    timeline: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_timeline_events
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    taskRow: JSON.stringify(database.prepare(`
      SELECT head_revision, updated_at, task_json, head_document_json
      FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID)),
  };
  value.artifactStore.failEvidence = true;
  assert.deepEqual(await value.service.commit(createCommand, value.contextValue), created);
  assert.equal(value.artifactStore.evidenceCalls, callsAfterCreate);
  const aliasCommand = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
    commandId: 'command.adopt.alias',
    idempotencyKey: createCommand.idempotencyKey,
  });
  assert.deepEqual(await value.service.commit(aliasCommand, value.contextValue), created);
  assert.equal(value.capabilityProvider.calls, capabilityCallsAfterCreate);
  assert.equal(value.dependencyCalls.clock, clockCallsAfterCreate);
  assert.equal(value.artifactStore.evidenceCalls, callsAfterCreate);
  assert.deepEqual({
    branchRevisions: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    adoptions: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    references: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_branch_processing_result_artifact_references
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    timeline: Number(database.prepare(`
      SELECT COUNT(*) AS count FROM task_timeline_events
      WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID).count),
    taskRow: JSON.stringify(database.prepare(`
      SELECT head_revision, updated_at, task_json, head_document_json
      FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID)),
  }, durableStateAfterCreate);
  value.artifactStore.failEvidence = false;

  const updateCommand = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.secondOutputArtifact,
    baseRevision: 3,
    operation: 'update',
    commandId: 'command.adopt.update',
    idempotencyKey: 'idempotency.adopt.update',
    findings: [],
  });
  const updated = await value.service.commit(updateCommand, value.contextValue);
  assert.equal(updated.branchRevision, 4);
  assert.equal(updated.asset.assetVersion, 2);
  assert.equal(updated.asset.metadataVersion, 1);
  assert.equal(value.taskStore.getTask(PROJECT_ID, TASK_ID).usage.commands, 2);
  assert.equal(Number(database.prepare(`
    SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions
    WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, TASK_ID).count), 2);
  assert.equal(Number(database.prepare(`
    SELECT COUNT(*) AS count FROM task_branch_processing_result_artifact_references
    WHERE project_id = ? AND task_id = ?
  `).get(PROJECT_ID, TASK_ID).count), 4);
  assert.equal(value.taskStore.loadBranchDocument(PROJECT_ID, TASK_ID)
    .revisions.at(-1).snapshot.processingResultAdoptionHeads.assets[0].assetVersion, 2);

  const integrity = await verifyWorkspaceIntegrity({
    projectStore: value.projectStore,
    artifactStore: value.artifactStore,
  });
  assert.equal(integrity.ok, true, JSON.stringify(integrity.tasks.findings));
  assert.equal(integrity.tasks.ok, true);
  const backupRoot = await mkdtemp(join(tmpdir(), 'numberdroid-processing-adoption-backup-'));
  afterTestCleanup(context, () => rm(backupRoot, { recursive: true, force: true }));
  const backupDirectory = join(backupRoot, 'backup');
  const backup = await createWorkspaceBackup({
    projectStore: value.projectStore,
    artifactStore: value.artifactStore,
    destinationDirectory: backupDirectory,
    clock: () => '2026-08-28T10:02:00.000Z',
  });
  assert.equal(backup.integrity.ok, true);
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
});

test('same digest remains two permanent reference roles while using one held CAS handle', async (context) => {
  const value = await fixture(context, { sameDigest: true });
  const command = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
    findings: [],
  });
  const result = await value.service.commit(command, value.contextValue);
  assert.equal(value.artifactStore.evidenceCalls, 1);
  assert.deepEqual(result.permanentReferences, [
    { role: 'recipe-input', digest: value.inputArtifact.digest },
    { role: 'selected-output', digest: value.inputArtifact.digest },
  ]);
  const references = value.projectStore.workspace.database.prepare(`
    SELECT role, digest FROM task_branch_processing_result_artifact_references
    WHERE project_id = ? AND task_id = ? ORDER BY role
  `).all(PROJECT_ID, TASK_ID).map((row) => ({ role: row.role, digest: row.digest }));
  assert.deepEqual(references, [
    { role: 'recipe-input', digest: value.inputArtifact.digest },
    { role: 'selected-output', digest: value.inputArtifact.digest },
  ]);
});

test('private adoption roots remain sufficient after temporary main references are released', async (context) => {
  const value = await committedCreateFixture(context);
  const database = value.projectStore.workspace.database;
  database.prepare('DELETE FROM artifact_references WHERE project_id = ?').run(PROJECT_ID);
  const metadata = new SqliteArtifactMetadataStore({ workspace: value.projectStore.workspace });
  const expectedDigests = [value.inputArtifact.digest, value.firstOutputArtifact.digest].sort();
  assert.equal(metadata.hasProjectReference(PROJECT_ID, value.inputArtifact.digest), false);
  assert.equal(metadata.hasProjectReference(PROJECT_ID, value.firstOutputArtifact.digest), false);
  assert.deepEqual([...metadata.listReferencedDigests()], expectedDigests);

  const integrity = await verifyWorkspaceIntegrity({
    projectStore: value.projectStore,
    artifactStore: value.artifactStore,
  });
  assert.equal(integrity.ok, true, JSON.stringify(integrity.tasks.findings));
  const backupRoot = await mkdtemp(join(tmpdir(), 'numberdroid-processing-private-roots-backup-'));
  afterTestCleanup(context, () => rm(backupRoot, { recursive: true, force: true }));
  const backupDirectory = join(backupRoot, 'backup');
  const backup = await createWorkspaceBackup({
    projectStore: value.projectStore,
    artifactStore: value.artifactStore,
    destinationDirectory: backupDirectory,
    clock: () => '2026-08-28T10:03:00.000Z',
  });
  assert.deepEqual(backup.artifacts.entries.map((entry) => entry.digest), expectedDigests);
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
});

test('a foreign branch command sharing command ID and key is a command-ID conflict without effects', async (context) => {
  const value = await fixture(context);
  const database = value.projectStore.workspace.database;
  const command = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
  });
  database.prepare(`
    INSERT INTO task_branch_revisions(
      project_id, task_id, branch_id, branch_revision, revision_id, command_id,
      idempotency_key, command_type, committed_at, revision_json
    ) VALUES (?, ?, ?, 3, ?, ?, ?, 'asset.proposal.submit', ?, '{}')
  `).run(
    PROJECT_ID, TASK_ID, BRANCH_ID, `${BRANCH_ID}:revision:foreign`,
    command.commandId, command.idempotencyKey, COMMITTED_AT,
  );
  const before = durableTaskBranchState(database);

  await assert.rejects(
    value.service.commit(command, value.contextValue),
    (error) => error.code === 'COMMAND_ID_CONFLICT',
  );
  assert.equal(value.capabilityProvider.calls, 0);
  assert.equal(value.dependencyCalls.clock, 0);
  assert.equal(value.artifactStore.evidenceCalls, 0);
  assert.equal(durableTaskBranchState(database), before);
});

test('cross-project task branch documents fail closed without mutation', async (context) => {
  for (const [label, mutate] of [
    ['document identity', (document) => { document.projectId = 'project.cross-project'; }],
    ['head snapshot identity', (document) => { document.revisions.at(-1).snapshot.project.id = 'project.cross-project'; }],
  ]) {
    await context.test(label, async (childContext) => {
      const value = await fixture(childContext);
      const database = value.projectStore.workspace.database;
      const command = adoptionCommand({
        manifest: value.manifest,
        inputArtifact: value.inputArtifact,
        outputArtifact: value.firstOutputArtifact,
        baseRevision: 2,
      });
      const taskRow = database.prepare(`
        SELECT head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
      `).get(PROJECT_ID, TASK_ID);
      const document = JSON.parse(taskRow.head_document_json);
      mutate(document);
      database.prepare(`
        UPDATE agent_tasks SET head_document_json = ?
        WHERE project_id = ? AND task_id = ?
      `).run(JSON.stringify(document), PROJECT_ID, TASK_ID);
      const before = durableTaskBranchState(database);

      await assert.rejects(
        value.atomicStore.commitProcessingResultAdoption(command, value.contextValue),
        (error) => error.code === 'CORRUPT_PROCESSING_RESULT_ADOPTION',
      );
      assert.equal(value.capabilityProvider.calls, 0);
      assert.equal(value.artifactStore.evidenceCalls, 0);
      assert.equal(durableTaskBranchState(database), before);
    });
  }
});

test('mutable same-project branch heads cannot invent Asset or grant state beyond the revision ledger', async (context) => {
  await context.test('base revision fake Asset', async (childContext) => {
    const value = await fixture(childContext);
    const database = value.projectStore.workspace.database;
    const command = adoptionCommand({
      manifest: value.manifest,
      inputArtifact: value.inputArtifact,
      outputArtifact: value.firstOutputArtifact,
      baseRevision: 2,
    });
    const taskRow = database.prepare(`
      SELECT head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const document = JSON.parse(taskRow.head_document_json);
    document.revisions.at(-1).snapshot.assets.push({ id: ASSET_ID });
    database.prepare(`
      UPDATE agent_tasks SET head_document_json = ?
      WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(document), PROJECT_ID, TASK_ID);
    const before = durableTaskBranchState(database);

    await assert.rejects(
      value.atomicStore.commitProcessingResultAdoption(command, value.contextValue),
      (error) => error.code === 'CORRUPT_PROCESSING_RESULT_ADOPTION',
    );
    assert.equal(value.capabilityProvider.calls, 0);
    assert.equal(value.artifactStore.evidenceCalls, 0);
    assert.equal(durableTaskBranchState(database), before);
  });

  await context.test('private branch revision fake grant', async (childContext) => {
    const value = await fixture(childContext);
    const database = value.projectStore.workspace.database;
    const createCommand = adoptionCommand({
      manifest: value.manifest,
      inputArtifact: value.inputArtifact,
      outputArtifact: value.firstOutputArtifact,
      baseRevision: 2,
    });
    await value.service.commit(createCommand, value.contextValue);
    const updateCommand = adoptionCommand({
      manifest: value.manifest,
      inputArtifact: value.inputArtifact,
      outputArtifact: value.secondOutputArtifact,
      baseRevision: 3,
      operation: 'update',
      commandId: 'command.adopt.tampered-grant-update',
      idempotencyKey: 'idempotency.adopt.tampered-grant-update',
      findings: [],
    });
    const taskRow = database.prepare(`
      SELECT head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const document = JSON.parse(taskRow.head_document_json);
    document.revisions.at(-1).snapshot.grants
      .find((grant) => grant.id === GRANT_ID).agentId = OWNER.id;
    database.prepare(`
      UPDATE agent_tasks SET head_document_json = ?
      WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(document), PROJECT_ID, TASK_ID);
    const before = durableTaskBranchState(database);
    const capabilityCalls = value.capabilityProvider.calls;
    const evidenceCalls = value.artifactStore.evidenceCalls;

    await assert.rejects(
      value.atomicStore.commitProcessingResultAdoption(updateCommand, value.contextValue),
      (error) => error.code === 'CORRUPT_PROCESSING_RESULT_ADOPTION',
    );
    assert.equal(value.capabilityProvider.calls, capabilityCalls);
    assert.equal(value.artifactStore.evidenceCalls, evidenceCalls);
    assert.equal(durableTaskBranchState(database), before);
  });
});

test('deep integrity rejects every private adoption projection and evidence tamper class', async (context) => {
  await context.test('invalid Aggregate JSON', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.exec('DROP TRIGGER task_branch_processing_result_adoptions_immutable');
    database.prepare(`
      UPDATE task_branch_processing_result_adoptions SET record_json = '{}'
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_RECORD_INVALID');
  });

  await context.test('invalid CommitResult JSON', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.exec('DROP TRIGGER task_branch_processing_result_adoptions_immutable');
    database.prepare(`
      UPDATE task_branch_processing_result_adoptions SET result_json = '{}'
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_RECORD_INVALID');
  });

  await context.test('normalized fingerprint projection', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.exec('DROP TRIGGER task_branch_processing_result_adoptions_immutable');
    database.prepare(`
      UPDATE task_branch_processing_result_adoptions SET metadata_fingerprint = ?
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run('0'.repeat(64), PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_PROJECTION_MISMATCH');
  });

  for (const role of ['recipe-input', 'selected-output']) {
    await context.test(`missing ${role} role`, async (childContext) => {
      const value = await committedCreateFixture(childContext);
      value.projectStore.workspace.database.prepare(`
        DELETE FROM task_branch_processing_result_artifact_references
        WHERE project_id = ? AND task_id = ? AND branch_revision = 3 AND role = ?
      `).run(PROJECT_ID, TASK_ID, role);
      await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_REFERENCE_SET_INVALID');
    });

    await context.test(`${role} evidence cross-field closure`, async (childContext) => {
      const value = await committedCreateFixture(childContext);
      const database = value.projectStore.workspace.database;
      database.exec('DROP TRIGGER task_branch_processing_result_artifact_references_immutable');
      const row = database.prepare(`
        SELECT evidence_json FROM task_branch_processing_result_artifact_references
        WHERE project_id = ? AND task_id = ? AND branch_revision = 3 AND role = ?
      `).get(PROJECT_ID, TASK_ID, role);
      const evidence = JSON.parse(row.evidence_json);
      evidence.descriptor.artifactUri = `studio://artifacts/sha256/${'0'.repeat(64)}`;
      const { evidenceFingerprint: ignoredFingerprint, ...evidenceBody } = evidence;
      evidence.evidenceFingerprint = fingerprint(evidenceBody);
      database.prepare(`
        UPDATE task_branch_processing_result_artifact_references
        SET evidence_fingerprint = ?, evidence_json = ?
        WHERE project_id = ? AND task_id = ? AND branch_revision = 3 AND role = ?
      `).run(evidence.evidenceFingerprint, JSON.stringify(evidence), PROJECT_ID, TASK_ID, role);
      await assertTaskIntegrityFinding(
        value,
        'TASK_PROCESSING_ADOPTION_EVIDENCE_FINGERPRINT_MISMATCH',
        (entry) => entry.role === role,
      );
    });

    await context.test(`${role} physical CAS`, async (childContext) => {
      const value = await committedCreateFixture(childContext);
      const reference = value.projectStore.workspace.database.prepare(`
        SELECT digest FROM task_branch_processing_result_artifact_references
        WHERE project_id = ? AND task_id = ? AND branch_revision = 3 AND role = ?
      `).get(PROJECT_ID, TASK_ID, role);
      const physical = await value.artifactStore.verify(reference.digest);
      await writeFile(physical.path, Buffer.from('corrupt processing adoption artifact'));
      await assertTaskIntegrityFinding(
        value,
        'ARTIFACT_CORRUPT',
        (entry) => entry.role === role && entry.digest === reference.digest,
      );
    });
  }

  for (const [label, field, valueForField] of [
    ['role', 'role', 'recipe-input'],
    ['verifiedAt', 'verifiedAt', '2026-08-28T10:01:01.000Z'],
  ]) {
    await context.test(`selected-output evidence ${label} cross-field closure`, async (childContext) => {
      const value = await committedCreateFixture(childContext);
      const database = value.projectStore.workspace.database;
      database.exec('DROP TRIGGER task_branch_processing_result_artifact_references_immutable');
      const row = database.prepare(`
        SELECT evidence_json FROM task_branch_processing_result_artifact_references
        WHERE project_id = ? AND task_id = ? AND branch_revision = 3 AND role = 'selected-output'
      `).get(PROJECT_ID, TASK_ID);
      const evidence = JSON.parse(row.evidence_json);
      evidence[field] = valueForField;
      const { evidenceFingerprint: ignoredFingerprint, ...evidenceBody } = evidence;
      evidence.evidenceFingerprint = fingerprint(evidenceBody);
      database.prepare(`
        UPDATE task_branch_processing_result_artifact_references
        SET evidence_fingerprint = ?, evidence_json = ?
        WHERE project_id = ? AND task_id = ? AND branch_revision = 3 AND role = 'selected-output'
      `).run(evidence.evidenceFingerprint, JSON.stringify(evidence), PROJECT_ID, TASK_ID);
      await assertTaskIntegrityFinding(
        value,
        'TASK_PROCESSING_ADOPTION_EVIDENCE_FINGERPRINT_MISMATCH',
        (entry) => entry.role === 'selected-output',
      );
    });
  }

  await context.test('additional orphaned private Asset head', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.exec('DROP TRIGGER task_branch_revisions_immutable');
    const revisionRow = database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).get(PROJECT_ID, TASK_ID);
    const revision = JSON.parse(revisionRow.revision_json);
    const orphan = structuredClone(revision.snapshot.processingResultAdoptionHeads.assets[0]);
    orphan.assetId = 'asset.orphaned-processing-head';
    revision.snapshot.processingResultAdoptionHeads.assets.push(orphan);
    revision.snapshot.processingResultAdoptionHeads.assets.sort(
      (left, right) => left.assetId.localeCompare(right.assetId),
    );
    database.prepare(`
      UPDATE task_branch_revisions SET revision_json = ?
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(JSON.stringify(revision), PROJECT_ID, TASK_ID);
    const taskRow = database.prepare(`
      SELECT head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const headDocument = JSON.parse(taskRow.head_document_json);
    const headIndex = headDocument.revisions.findIndex((entry) => entry.number === 3);
    headDocument.revisions[headIndex] = structuredClone(revision);
    database.prepare(`
      UPDATE agent_tasks SET head_document_json = ? WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(headDocument), PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_HEAD_PROJECTION_MISMATCH');
  });

  await context.test('private Asset head orphaned from every Adoption row', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.prepare(`
      DELETE FROM task_branch_processing_result_artifact_references
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(PROJECT_ID, TASK_ID);
    database.prepare(`
      DELETE FROM task_branch_processing_result_adoptions
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_HEAD_PROJECTION_MISMATCH');
  });

  await context.test('task and embedded grant usage exceed canonical branch charge', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.exec('DROP TRIGGER task_branch_revisions_immutable');
    const revision = JSON.parse(database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).get(PROJECT_ID, TASK_ID).revision_json);
    revision.snapshot.grants.find((grant) => grant.id === GRANT_ID).usage.commands = 2;
    database.prepare(`
      UPDATE task_branch_revisions SET revision_json = ?
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(JSON.stringify(revision), PROJECT_ID, TASK_ID);
    const taskRow = database.prepare(`
      SELECT task_json, head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const taskValue = JSON.parse(taskRow.task_json);
    taskValue.usage.commands = 2;
    const headDocument = JSON.parse(taskRow.head_document_json);
    const headIndex = headDocument.revisions.findIndex((entry) => entry.number === 3);
    headDocument.revisions[headIndex] = structuredClone(revision);
    database.prepare(`
      UPDATE agent_tasks SET task_json = ?, head_document_json = ?
      WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(taskValue), JSON.stringify(headDocument), PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_USAGE_MISMATCH');
  });

  await context.test('proposal-submit charge is rederived from item cardinality', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    database.exec('DROP TRIGGER task_branch_revisions_immutable');
    const revision = JSON.parse(database.prepare(`
      SELECT revision_json FROM task_branch_revisions
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).get(PROJECT_ID, TASK_ID).revision_json);
    revision.command.type = 'asset.proposal.submit';
    revision.command.payload = { items: [{}, {}, {}] };
    database.prepare(`
      UPDATE task_branch_revisions SET command_type = ?, revision_json = ?
      WHERE project_id = ? AND task_id = ? AND branch_revision = 3
    `).run(revision.command.type, JSON.stringify(revision), PROJECT_ID, TASK_ID);
    const taskRow = database.prepare(`
      SELECT head_document_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const headDocument = JSON.parse(taskRow.head_document_json);
    const headIndex = headDocument.revisions.findIndex((entry) => entry.number === 3);
    headDocument.revisions[headIndex] = structuredClone(revision);
    database.prepare(`
      UPDATE agent_tasks SET head_document_json = ? WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(headDocument), PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_USAGE_MISMATCH');
  });

  await context.test('forbidden MERGED task state', async (childContext) => {
    const value = await committedCreateFixture(childContext);
    const database = value.projectStore.workspace.database;
    const taskRow = database.prepare(`
      SELECT task_json FROM agent_tasks WHERE project_id = ? AND task_id = ?
    `).get(PROJECT_ID, TASK_ID);
    const taskValue = JSON.parse(taskRow.task_json);
    taskValue.state = 'MERGED';
    database.prepare(`
      UPDATE agent_tasks SET state = 'MERGED', task_json = ?
      WHERE project_id = ? AND task_id = ?
    `).run(JSON.stringify(taskValue), PROJECT_ID, TASK_ID);
    await assertTaskIntegrityFinding(value, 'TASK_PROCESSING_ADOPTION_MERGE_FORBIDDEN');
  });
});

const rollbackFaultPoints = [
  'after_processing_result_adoption_branch_revision',
  'after_processing_result_adoption_aggregate',
  'after_processing_result_adoption_reference_recipe-input',
  'after_processing_result_adoption_reference_selected-output',
  'after_processing_result_adoption_head_and_usage',
  'after_processing_result_adoption_activity',
  'before_processing_result_adoption_commit',
];

test('every in-transaction adoption fault rolls back the complete private unit of work', async (context) => {
  for (const faultPoint of rollbackFaultPoints) {
    await context.test(faultPoint, async (childContext) => {
      const value = await fixture(childContext, { faultPoint });
      const command = adoptionCommand({
        manifest: value.manifest,
        inputArtifact: value.inputArtifact,
        outputArtifact: value.firstOutputArtifact,
        baseRevision: 2,
      });
      value.fault.armed = true;
      await assert.rejects(
        value.service.commit(command, value.contextValue),
        (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
      );
      value.fault.armed = false;
      const database = value.projectStore.workspace.database;
      assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM task_branch_revisions').get().count), 0);
      assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions').get().count), 0);
      assert.equal(Number(database.prepare('SELECT COUNT(*) AS count FROM task_branch_processing_result_artifact_references').get().count), 0);
      assert.equal(value.taskStore.getTask(PROJECT_ID, TASK_ID).headRevision, 2);
      assert.equal(value.taskStore.getTask(PROJECT_ID, TASK_ID).usage.commands, 0);
      const retried = await value.service.commit(command, value.contextValue);
      assert.equal(retried.branchRevision, 3);
    });
  }
});

test('a post-commit fault reports unknown outcome but ledger-first retry resolves it', async (context) => {
  const value = await fixture(context, { faultPoint: 'after_processing_result_adoption_commit' });
  const command = adoptionCommand({
    manifest: value.manifest,
    inputArtifact: value.inputArtifact,
    outputArtifact: value.firstOutputArtifact,
    baseRevision: 2,
  });
  value.fault.armed = true;
  await assert.rejects(
    value.service.commit(command, value.contextValue),
    (error) => error.code === 'PROCESSING_RESULT_ADOPTION_COMMIT_PORT_FAILED',
  );
  value.fault.armed = false;
  const calls = value.artifactStore.evidenceCalls;
  const replayed = await value.service.commit(command, value.contextValue);
  assert.equal(replayed.branchRevision, 3);
  assert.equal(value.artifactStore.evidenceCalls, calls);
  assert.equal(Number(value.projectStore.workspace.database.prepare(`
    SELECT COUNT(*) AS count FROM task_branch_processing_result_adoptions
  `).get().count), 1);
});
