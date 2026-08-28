import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AgentTaskService,
  StudioService,
  validateTrustedGrantScopes,
} from '../packages/application/src/index.js';
import {
  AUTHORING_V2_COMMAND_FEATURES,
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PRIVATE_GRANT_SCOPES,
  AUTHORING_V2_SCHEMA_VERSION,
  COMMAND_DEFINITIONS,
  KNOWN_GRANT_SCOPES,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  StudioError,
  listAuthoringV2GrantScopes,
  validateAgentTaskSpec,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_ADAPTER_VERSION,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
  NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import * as numberdroidAdapter from '../packages/numberdroid-adapter/src/index.js';
import {
  SqliteAgentTaskStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
} from '../packages/persistence/src/index.js';
import { OWNER, PROJECT_ID, createProject } from './test-helpers.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';

const NOW = '2026-08-28T12:00:00.000Z';
const EXPIRES_AT = '2026-08-28T18:00:00.000Z';
const ASSET_ID = 'asset.authoring-v2.future';

function taskSpec(taskId) {
  return {
    taskId,
    branchId: `branch.${taskId}`,
    agentId: 'agent.authoring-v2',
    title: 'Adopt one processing result',
    objective: 'Prepare one branch-local DRAFT Asset and stop for owner review.',
    capabilities: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
    objectScopes: [
      { kind: 'asset', id: ASSET_ID },
      { kind: 'project', id: PROJECT_ID },
    ],
    budget: { maxCommands: 4, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: EXPIRES_AT,
    autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
  };
}

test('Authoring-v2 registry is a one-command/one-scope overlay while legacy 33/30 stays exact', () => {
  assert.equal(AUTHORING_V2_SCHEMA_VERSION, 2);
  assert.equal(AUTHORING_V2_FEATURE_ID, 'studio.authoring-v2');
  assert.equal(COMMAND_DEFINITIONS.length, 33);
  assert.equal(KNOWN_GRANT_SCOPES.length, 30);
  assert.equal(COMMAND_DEFINITIONS.some(({ type }) => type === PROCESSING_RESULT_ADOPTION_COMMAND_TYPE), false);
  assert.equal(KNOWN_GRANT_SCOPES.includes(PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE), false);
  assert.deepEqual(AUTHORING_V2_PRIVATE_GRANT_SCOPES, [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE]);
  assert.equal(AUTHORING_V2_COMMAND_FEATURES.length, 1);
  assert.deepEqual(AUTHORING_V2_COMMAND_FEATURES[0], {
    schemaVersion: 1,
    kind: 'studio.authoring-v2-command-feature',
    commandType: 'asset.processing-result.adopt',
    toolName: 'studio_processing_result_adopt',
    description: 'Dry-run or atomically adopt one exact processing result as a branch-local DRAFT Asset.',
    requiredScope: 'asset.processing-result.adopt',
    ownerOnly: false,
    requiresTaskBranch: true,
    requiresProcessingResultAdoptionStore: true,
    requiredObjectScopes: ['project', 'asset'],
    autoAcceptAllowed: false,
    capabilityOperation: {
      operationId: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
      operationVersion: 1,
    },
  });
  assert.equal(COMMAND_DEFINITIONS.length + AUTHORING_V2_COMMAND_FEATURES.length, 34);
  assert.equal(listAuthoringV2GrantScopes().length, 31);
  assert.equal(listAuthoringV2GrantScopes().at(-1), PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE);
});

test('Numberdroid profile v2 is additive and pinned while profile v1 remains byte-identical', () => {
  assert.deepEqual(Object.keys(numberdroidAdapter).sort(), [
    'NUMBERDROID_ADAPTER_VERSION',
    'NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT',
    'NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST',
    'NUMBERDROID_CANDIDATE_VALIDATOR_VERSION',
    'NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT',
    'NUMBERDROID_PROJECT_CAPABILITY_MANIFEST',
    'NumberdroidAdapterError',
    'buildNumberdroidCandidate',
    'candidateSha256',
    'canonicalCandidateJson',
    'createNumberdroidExportSnapshot',
    'createNumberdroidProjectCandidateManifest',
    'sanitizeNumberdroidDiagnostic',
  ]);
  assert.equal(NUMBERDROID_ADAPTER_VERSION, 'numberdroid-studio.adapter.v1');
  assert.equal(NUMBERDROID_PROJECT_CAPABILITY_FINGERPRINT, '826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049');
  assert.equal(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT, '5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106');
  assert.equal(NUMBERDROID_PROJECT_CAPABILITY_MANIFEST.profileVersion, 1);
  assert.equal(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileVersion, 2);
  assert.deepEqual(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.adapter, NUMBERDROID_PROJECT_CAPABILITY_MANIFEST.adapter);
  assert.deepEqual(
    NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.operations.find(({ id }) => id === PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID),
    {
      id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
      kind: 'validate',
      version: 1,
      moduleIds: ['studio.asset', 'studio.image-processing'],
      inputFormatIds: ['studio.asset-input-selection', 'studio.processing-recipe', 'studio.processing-result'],
      outputFormatIds: ['studio.processing-adoption-preflight-receipt'],
    },
  );
  assert.deepEqual(
    NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.modules.filter(({ id }) => id === 'studio.image-processing'),
    [{ id: 'studio.image-processing', version: 'v1' }],
  );
  assert.ok(Object.isFrozen(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST));
});

test('only a trusted v2 scope catalog lets an owner provision the private task/grant scope', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'numberdroid-authoring-v2-prerequisites-'));
  const store = await SqliteProjectStore.open({
    filename: join(root, 'studio.sqlite'),
    databaseFactory: nodeSqliteDatabaseFactory,
  });
  context.after(async () => {
    store.close();
    await rm(root, { recursive: true, force: true });
  });
  const grantScopes = listAuthoringV2GrantScopes();
  const studio = new StudioService({ store, clock: () => NOW, grantScopes });
  await createProject(studio);
  const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
  const options = {
    studioService: studio,
    projectStore: store,
    taskStore,
    createBranchStore: ({ projectId, taskId }) => new TaskBranchProjectStore({ taskStore, projectId, taskId }),
    clock: () => NOW,
  };
  const legacyTasks = new AgentTaskService(options);
  await assert.rejects(
    legacyTasks.createTask({ projectId: PROJECT_ID, task: taskSpec('task.authoring-v2.legacy-denied') }, { actor: OWNER }),
    (error) => error instanceof StudioError && error.code === 'UNKNOWN_GRANT_SCOPE',
  );

  const authoringTasks = new AgentTaskService({ ...options, grantScopes });
  const created = await authoringTasks.createTask(
    { projectId: PROJECT_ID, task: taskSpec('task.authoring-v2.allowed') },
    { actor: OWNER },
  );
  assert.deepEqual(created.task.capabilities, [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE]);
  const main = await studio.readProjectTrusted(PROJECT_ID);
  const grant = main.snapshot.grants.find(({ taskId }) => taskId === created.task.taskId);
  assert.deepEqual(grant.scopes, [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE]);
  assert.deepEqual(grant.objectScopes, taskSpec('task.authoring-v2.allowed').objectScopes);
});

test('v2 catalog validation rejects weakening and adoption can never enter auto-accept', () => {
  assert.deepEqual(validateTrustedGrantScopes(KNOWN_GRANT_SCOPES), [...KNOWN_GRANT_SCOPES].sort());
  assert.deepEqual(
    validateTrustedGrantScopes(listAuthoringV2GrantScopes()),
    listAuthoringV2GrantScopes().sort(),
  );
  assert.throws(
    () => validateTrustedGrantScopes([PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE]),
    (error) => error instanceof StudioError && error.code === 'GRANT_SCOPE_CATALOG_INVALID',
  );
  assert.throws(
    () => validateTrustedGrantScopes([...listAuthoringV2GrantScopes(), 'authority.smuggled']),
    (error) => error instanceof StudioError && error.code === 'GRANT_SCOPE_CATALOG_INVALID',
  );
  const sparse = listAuthoringV2GrantScopes();
  sparse.length += 1;
  assert.throws(
    () => validateTrustedGrantScopes(sparse),
    (error) => error instanceof StudioError && error.code === 'GRANT_SCOPE_CATALOG_INVALID',
  );
  let getterCalls = 0;
  const accessor = listAuthoringV2GrantScopes();
  Object.defineProperty(accessor, '0', {
    enumerable: true,
    get() { getterCalls += 1; return KNOWN_GRANT_SCOPES[0]; },
  });
  assert.throws(
    () => validateTrustedGrantScopes(accessor),
    (error) => error instanceof StudioError && error.code === 'GRANT_SCOPE_CATALOG_INVALID',
  );
  assert.equal(getterCalls, 0);
  for (const invalid of [
    Object.assign(listAuthoringV2GrantScopes(), { extra: 'scope' }),
    Object.assign(listAuthoringV2GrantScopes(), { [Symbol('scope')]: 'scope' }),
    listAuthoringV2GrantScopes().map((scope, index) => (index === 0 ? 42 : scope)),
  ]) {
    assert.throws(
      () => validateTrustedGrantScopes(invalid),
      (error) => error instanceof StudioError && error.code === 'GRANT_SCOPE_CATALOG_INVALID',
    );
  }
  assert.throws(
    () => validateAgentTaskSpec({
      ...taskSpec('task.authoring-v2.auto-accept'),
      autoAcceptPolicy: {
        enabled: true,
        allowedCommandTypes: [PROCESSING_RESULT_ADOPTION_COMMAND_TYPE],
        maxChanges: 1,
      },
    }, { now: NOW, projectId: PROJECT_ID, baseRevision: 2 }),
    (error) => error instanceof StudioError && error.code === 'AUTO_ACCEPT_FORBIDDEN',
  );
});
