import { mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AgentTaskService,
  FixedProjectCapabilityProvider,
  StudioService,
} from '../packages/application/src/index.js';
import {
  AUTHORING_V2_FEATURE_ID,
  AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
  AUTHORING_V2_SCHEMA_VERSION,
  PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID,
  PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
  PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
  PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE,
  createExactPngCropProcessingRecipe,
  createPrimaryVisualAssetInputSelection,
  listAuthoringV2GrantScopes,
  processingRecipeSha256,
} from '../packages/domain/src/index.js';
import {
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
  NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
} from '../packages/numberdroid-adapter/src/index.js';
import {
  ContentAddressedArtifactStore,
  SqliteAgentTaskStore,
  SqliteArtifactMetadataStore,
  SqliteHostBindingStore,
  SqliteProjectStore,
  TaskBranchProjectStore,
} from '../packages/persistence/src/index.js';
import { cropSupportedPng, encodeCanonicalRgbaPng } from '../packages/preview/src/index.js';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

if (!process.argv[2]) throw new Error('A1.7 visual evidence requires one explicit fresh data directory.');
const dataDirectory = resolve(process.argv[2]);
await mkdir(dataDirectory, { recursive: true });
if ((await readdir(dataDirectory)).length !== 0) {
  throw new Error('A1.7 visual evidence refuses a non-empty data directory.');
}
const filename = resolve(dataDirectory, 'studio.sqlite');
const projectId = 'numberdroid-studio-a1-7';
const taskId = 'task.a1-7.processed-asset-review';
const branchId = 'branch.task.a1-7.processed-asset-review';
const assetId = 'asset.a1-7.transfer-console';
const startedAt = Date.now();
const now = new Date(startedAt).toISOString();
const expiresAt = new Date(startedAt + (24 * 60 * 60 * 1_000)).toISOString();
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const agent = { id: 'studio.processing.agent', kind: 'agent', displayName: 'Processing agent' };
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };

function closeRunning(running) {
  return new Promise((resolveClose, rejectClose) => {
    running.server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
}

function projectCreateCommand() {
  return {
    schemaVersion: 1,
    commandId: 'visual.a1-7.project-create',
    idempotencyKey: 'visual.a1-7.project-create',
    type: 'project.create',
    projectId,
    baseRevision: 0,
    expectedVersion: 0,
    dryRun: false,
    payload: {
      name: 'A1.7 processed asset review',
      ownerId: owner.id,
      description: 'A branch-local processing DRAFT stops for visual review without entering Main.',
    },
  };
}

function visualSourceBytes() {
  const width = 96; const height = 64; const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      const panel = Math.floor(x / 8) % 2 === Math.floor(y / 8) % 2;
      rgba[offset] = panel ? 42 : 18;
      rgba[offset + 1] = 92 + ((x * 2) % 90);
      rgba[offset + 2] = panel ? 132 : 82;
      rgba[offset + 3] = (x < 10 || x > 85 || y < 5 || y > 58) ? 0 : 255;
      if ((x > 25 && x < 31) || (y > 28 && y < 34)) {
        rgba[offset] = 224; rgba[offset + 1] = 181; rgba[offset + 2] = 74; rgba[offset + 3] = 255;
      }
    }
  }
  return encodeCanonicalRgbaPng({ width, height, rgba });
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

function adoptionCommand(inputArtifact, outputArtifact, baseRevision) {
  const input = descriptor(inputArtifact); const output = descriptor(outputArtifact);
  const recipe = createExactPngCropProcessingRecipe({
    recipeId: 'recipe.a1-7.transfer-console',
    recipeVersion: 1,
    input: { inputId: 'input.source', ...input },
    operationId: 'operation.a1-7.exact-crop',
    rectangles: [{
      rectangleId: 'rect.a1-7.transfer-console',
      x: 16, y: 0, width: output.width, height: output.height,
      included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null, expectedSliceVersion: null,
    }],
  });
  const operation = recipe.operations[0];
  const processingResult = {
    schemaVersion: 1,
    kind: 'studio.processing-result',
    recipe: { id: recipe.recipeId, version: recipe.recipeVersion, fingerprint: processingRecipeSha256(recipe) },
    operations: [{
      operationId: operation.operationId,
      kind: operation.kind,
      processorId: operation.processorId,
      inputs: structuredClone(recipe.inputs),
      outputs: [{ outputId: 'rect.a1-7.transfer-console', ...output }],
    }],
    findings: [{
      severity: 'WARNING',
      ruleId: 'studio.processing.review-recommended',
      objectRef: 'output:rect.a1-7.transfer-console',
      explanation: 'The processed image needs human visual inspection before any later lifecycle decision.',
      remediation: 'Inspect the exact pixels and keep this task open until a separately authorized correction path exists.',
      validatorVersion: 'studio.processing-validator.v1',
    }],
  };
  const assetInputSelection = createPrimaryVisualAssetInputSelection({
    processingResult,
    outputId: 'rect.a1-7.transfer-console',
    assetKind: 'prop',
  });
  return {
    schemaVersion: 1,
    kind: PROCESSING_RESULT_ADOPTION_COMMAND_KIND,
    commandId: 'visual.a1-7.processing-result-adopt',
    idempotencyKey: 'visual.a1-7.processing-result-adopt',
    type: PROCESSING_RESULT_ADOPTION_COMMAND_TYPE,
    projectId,
    baseRevision,
    expectedVersion: baseRevision,
    payload: {
      preflightRequest: {
        schemaVersion: 1,
        kind: PROCESSING_ADOPTION_PREFLIGHT_REQUEST_KIND,
        project: { projectId, expectedRevision: baseRevision },
        processingRecipe: recipe,
        processingResult,
        assetInputSelection,
        capability: {
          schemaVersion: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.schemaVersion,
          kind: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.kind,
          profileId: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileId,
          profileVersion: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.profileVersion,
          adapter: structuredClone(NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST.adapter),
          manifestFingerprint: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_FINGERPRINT,
          operation: { id: PROCESSING_ADOPTION_PREFLIGHT_OPERATION_ID, version: 1 },
        },
        target: { operation: 'create', assetId, expectedAssetVersion: 0, expectedMetadataVersion: 0 },
      },
      assetName: 'Transfer console processed draft',
    },
  };
}

async function provision() {
  const store = await SqliteProjectStore.open({ filename });
  try {
    const capabilityProvider = new FixedProjectCapabilityProvider({
      manifest: NUMBERDROID_AUTHORING_V2_PROJECT_CAPABILITY_MANIFEST,
    });
    const grantScopes = listAuthoringV2GrantScopes();
    const studioService = new StudioService({ store, clock: () => now, capabilityProvider, grantScopes });
    await studioService.execute(projectCreateCommand(), ownerContext);
    const taskStore = new SqliteAgentTaskStore({ workspace: store.workspace });
    const agentTaskService = new AgentTaskService({
      studioService,
      projectStore: store,
      taskStore,
      createBranchStore: ({ projectId: selectedProjectId, taskId: selectedTaskId }) => new TaskBranchProjectStore({
        taskStore, projectId: selectedProjectId, taskId: selectedTaskId,
      }),
      clock: () => now,
      capabilityProvider,
      grantScopes,
    });
    const created = await agentTaskService.createTask({
      projectId,
      task: {
        taskId,
        branchId,
        agentId: agent.id,
        title: 'Inspect processed transfer-console draft',
        objective: 'Inspect the exact branch-local processed image and its correction facts. Do not submit, merge, finalize, materialize, publish, or release.',
        capabilities: [PROCESSING_RESULT_ADOPTION_REQUIRED_SCOPE],
        objectScopes: [{ kind: 'project', id: projectId }, { kind: 'asset', id: assetId }],
        budget: { maxCommands: 1, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
        expiresAt,
        autoAcceptPolicy: { enabled: false, allowedCommandTypes: [], maxChanges: 0 },
      },
    }, ownerContext);

    const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: resolve(dataDirectory, 'artifacts') });
    const inputBytes = visualSourceBytes();
    const inputArtifact = await artifactStore.ingest(inputBytes, { mediaType: 'image/png' });
    const cropped = cropSupportedPng(inputBytes, [{
      rectangleId: 'rect.a1-7.transfer-console',
      x: 16, y: 0, width: 64, height: 64,
      included: true, pivot: null, transparentPaddingPolicy: 'preserve_exact_rect',
      replacesSliceId: null, expectedSliceVersion: null,
    }], {
      expectedSource: {
        digest: inputArtifact.digest,
        mediaType: inputArtifact.mediaType,
        byteSize: inputArtifact.byteSize,
        width: inputArtifact.width,
        height: inputArtifact.height,
      },
    });
    const outputBytes = cropped.outputs[0].bytes;
    const outputArtifact = await artifactStore.ingest(outputBytes, { mediaType: 'image/png' });
    const metadata = new SqliteArtifactMetadataStore({ workspace: store.workspace });
    for (const [index, artifact] of [inputArtifact, outputArtifact].entries()) {
      metadata.registerAndReference(artifact, {
        projectId,
        ownerKind: 'a1_7_visual_fixture',
        ownerId: `artifact.${index + 1}`,
        createdRevision: created.task.baseRevision,
      }, { createdAt: now });
    }
    const bindings = new SqliteHostBindingStore({ workspace: store.workspace, clock: () => now });
    const issued = bindings.issue({
      projectId,
      grantId: created.task.grantId,
      agentId: agent.id,
      taskId,
      branchId,
      issuedBy: owner.id,
      expiresAt,
    });
    const mainReferenceCount = Number(store.workspace.database.prepare(
      'SELECT COUNT(*) AS count FROM artifact_references WHERE project_id = ?',
    ).get(projectId).count);
    return { created, inputArtifact, outputArtifact, outputBytes, token: issued.token, mainReferenceCount };
  } finally {
    store.close();
  }
}

const fixture = await provision();
const running = await startStudioHttpServer({ dataDirectory, port: 0, clock: () => now });
try {
  const serviceUrl = `http://127.0.0.1:${running.address.port}`;
  const command = adoptionCommand(fixture.inputArtifact, fixture.outputArtifact, fixture.created.task.baseRevision);
  const response = await fetch(`${serviceUrl}/internal/mcp/authoring-v2/processing-result-adopt`, {
    method: 'POST',
    headers: { authorization: `Bearer ${fixture.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: AUTHORING_V2_SCHEMA_VERSION,
      featureId: AUTHORING_V2_FEATURE_ID,
      toolName: AUTHORING_V2_PROCESSING_RESULT_ADOPTION_TOOL,
      dryRun: false,
      command,
    }),
  });
  const committed = await response.json();
  if (!response.ok || committed.asset?.lifecycle !== 'DRAFT'
      || committed.branchRevision !== fixture.created.task.baseRevision + 1) {
    throw new Error(`A1.7 production adoption did not commit the exact DRAFT: ${response.status} ${JSON.stringify(committed)}`);
  }
  const task = running.agentTaskService.readTask(projectId, taskId);
  const project = await running.studioService.readProjectTrusted(projectId);
  const database = running.agentTaskStore.workspace.database;
  const mainReferenceCount = Number(database.prepare(
    'SELECT COUNT(*) AS count FROM artifact_references WHERE project_id = ?',
  ).get(projectId).count);
  const mainAssetVersionCount = Number(database.prepare(
    'SELECT COUNT(*) AS count FROM asset_versions WHERE project_id = ?',
  ).get(projectId).count);
  const privateReferenceCount = Number(database.prepare(`
    SELECT COUNT(*) AS count
    FROM task_branch_processing_result_artifact_references
    WHERE project_id = ? AND task_id = ?
  `).get(projectId, taskId).count);
  if (task.task.state !== 'ACTIVE' || task.review !== null
      || project.revision !== fixture.created.task.baseRevision
      || project.snapshot.assetLibrary?.assets?.some(({ assetId: mainAssetId }) => mainAssetId === assetId)
      || mainReferenceCount !== fixture.mainReferenceCount
      || mainAssetVersionCount !== 0
      || privateReferenceCount !== 2) {
    throw new Error('A1.7 fixture crossed its ACTIVE/DRAFT/Main authority boundary.');
  }
  const projectionResponse = await fetch(`${serviceUrl}/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/processing-result-adoptions`);
  const projection = await projectionResponse.json();
  const adoption = projection.adoptions?.at(-1);
  const expectedPreviewPath = `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`
    + `/processing-result-adoptions/${committed.branchRevision}/selected-output`;
  if (!projectionResponse.ok || projection.availability !== 'AVAILABLE' || projection.adoptions.length !== 1
      || adoption.displayState !== 'WAITING_FOR_YOUR_REVIEW' || adoption.asset.lifecycle !== 'DRAFT'
      || adoption.asset.preview.resourceUri !== expectedPreviewPath
      || adoption.quality.correctionItems.length !== 8 || adoption.quality.unresolvedWarnings.length !== 1) {
    throw new Error('A1.7 public projection does not expose the exact bounded review facts.');
  }
  const previewResponse = await fetch(new URL(adoption.asset.preview.resourceUri, serviceUrl));
  const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
  if (!previewResponse.ok || previewResponse.headers.get('content-type') !== 'image/png'
      || !previewBytes.equals(fixture.outputBytes)) {
    throw new Error('A1.7 selected-output preview differs from the committed exact crop.');
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: project.revision,
    taskId,
    taskState: task.task.state,
    review: task.review,
    branchRevision: committed.branchRevision,
    asset: {
      assetId,
      lifecycle: committed.asset.lifecycle,
      width: adoption.asset.pixelSize.width,
      height: adoption.asset.pixelSize.height,
    },
    adoptionCount: projection.adoptions.length,
    correctionCount: adoption.quality.correctionItems.length,
    warningCount: adoption.quality.unresolvedWarnings.length,
    status: 'implemented candidate — not user accepted',
  }, null, 2)}\n`);
} finally {
  await closeRunning(running);
}
