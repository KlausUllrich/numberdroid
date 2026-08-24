import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const projectId = 'numberdroid-studio-checkpoint-2c';
const owner = { id: 'local.designer', kind: 'human', displayName: 'Local designer' };
const agent = { id: 'asset.catalog.agent', kind: 'agent', displayName: 'Asset catalog agent' };
const taskId = 'task.checkpoint-2c-family-hygiene';
const branchId = 'branch.checkpoint-2c-family-hygiene';
const grantId = 'grant.checkpoint-2c-family-hygiene';
const ownerContext = { actor: owner, taskId: null, grantId: null, branchId: 'branch.main' };
const sourcePath = resolve(
  moduleDirectory,
  '../../../art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png',
);
const sourceDigest = '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e';
const outputDigests = [
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
];
const rectangles = [
  ['rect.family.0.0', 3, 3],
  ['rect.family.0.1', 629, 3],
  ['rect.family.1.0', 3, 629],
  ['rect.family.1.1', 629, 629],
].map(([rectangleId, x, y]) => ({
  rectangleId,
  x,
  y,
  width: 622,
  height: 622,
  included: true,
  pivot: null,
  transparentPaddingPolicy: 'preserve_exact_rect',
  replacesSliceId: null,
  expectedSliceVersion: null,
}));
const assetNames = [
  'Family Hygiene · Calm Grid',
  'Family Hygiene · Sterile Grid',
  'Family Hygiene · Service Grid',
  'Family Hygiene · Reserve Grid',
];
const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-checkpoint-2c-visual');
const phase = process.argv[3] ?? 'applied';
if (!['pending', 'applied'].includes(phase)) throw new Error('Fixture phase must be pending or applied.');
let tick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 22, 11, 0, tick++)).toISOString(),
});

function command(type, revision, id, payload) {
  return {
    schemaVersion: 1,
    commandId: `visual.2c.${id}`,
    idempotencyKey: `visual.2c.${id}`,
    type,
    projectId,
    baseRevision: revision,
    expectedVersion: revision,
    dryRun: false,
    payload,
  };
}

function metadata(ordinal) {
  return {
    role: 'base',
    tags: ['family-hygiene', 'floor', `variant-${ordinal + 1}`],
    variantGroup: 'family-hygiene-floor',
    compatibilityGroups: ['family-hygiene-floor'],
    spanTiles: { width: 1, height: 1 },
    anchor: { x: 0, y: 0 },
    attachment: 'ground',
    rotationPolicy: 'fixed',
    placement: {
      modes: ['manual'],
      wallSafe: true,
      tags: ['calm-base'],
      confirmation: ordinal === 3 ? 'proposed' : 'confirmed',
    },
    collision: { mode: 'none', bounds: null, parts: [] },
    navigation: { effect: 'passable', cost: null },
    runtimeEligible: false,
    connectors: [],
    continuityProfile: null,
    continuityTags: [],
    selectionPriority: ordinal,
    visualWeight: ordinal === 2 ? 'heavy' : 'medium',
    extensions: {},
  };
}

function mcpPayload(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find((entry) => entry.type === 'text')?.text;
  if (typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function officialMcpClient(token) {
  const { address, port } = running.address;
  const host = address === '::' ? '127.0.0.1' : address;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(moduleDirectory, '../apps/studio-mcp/src/main.js')],
    cwd: resolve(moduleDirectory, '..'),
    env: {
      ...process.env,
      NUMBERDROID_STUDIO_PROJECT_ID: projectId,
      NUMBERDROID_STUDIO_SERVICE_URL: `http://${host}:${port}/`,
      NUMBERDROID_STUDIO_BINDING_TOKEN: token,
      NUMBERDROID_STUDIO_AGENT_AUDIT_READY: '1',
      NUMBERDROID_STUDIO_JOB_STORE_READY: '1',
      NUMBERDROID_STUDIO_ASSET_STORE_READY: '1',
    },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'checkpoint-2c-evidence', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(transport);
  return {
    client,
    close: () => client.close(),
  };
}

try {
  if ((await running.studioService.listProjectsTrusted()).length !== 0) {
    throw new Error('Checkpoint 2C visual evidence requires a new data directory.');
  }
  await running.studioService.execute(command('project.create', 0, 'project-create', {
    name: 'Checkpoint 2C · Family Hygiene asset library',
    description: 'Exact slice-bound V2 assets, durable agent proposal review, one human rejection, and atomic accepted-subset apply.',
    ownerId: owner.id,
  }), ownerContext);

  const artifact = await running.artifactStore.ingest(await readFile(sourcePath), {
    mediaType: 'image/png',
    expectedDigest: sourceDigest,
    limits: { maxBytes: 16 * 1024 * 1024, maxWidth: 4096, maxHeight: 4096 },
  });
  running.sourceIntakeStore.stage(artifact, {
    projectId,
    intakeId: 'intake.family-hygiene-2c',
    idempotencyKey: 'visual.2c.intake.family-hygiene',
    origin: 'human_upload',
    createdRevision: 1,
    createdAt: '2026-08-22T11:00:01.000Z',
  });
  await running.studioService.execute(command('source.intake.commit', 1, 'source-commit', {
    intakeId: 'intake.family-hygiene-2c',
    sourceId: 'source.family-hygiene-approved',
    name: 'Family Hygiene floor 2×2',
    artifactUri: artifact.uri,
    mediaType: artifact.mediaType,
    byteSize: artifact.byteSize,
    width: artifact.width,
    height: artifact.height,
    provenance: {
      origin: 'human_upload', prompt: null, negativePrompt: null, seed: null,
      provider: null, model: null, modelVersion: null, generator: null,
      parameters: {}, referenceArtifactUris: [], parentSourceIds: [],
    },
  }), ownerContext);
  await running.studioService.execute(command('source.review.propose', 2, 'source-propose', {
    sourceId: 'source.family-hygiene-approved',
    note: 'Prepared for exact Checkpoint 2C asset binding.',
  }), ownerContext);
  await running.studioService.execute(command('source.review.decide', 3, 'source-approve', {
    sourceId: 'source.family-hygiene-approved',
    disposition: 'APPROVED',
    note: 'Approved source fixture.',
  }), ownerContext);
  const defined = await running.studioService.execute(command('atlas.define.rects', 4, 'atlas-define', {
    atlasId: 'atlas.family-hygiene-2c',
    sourceId: 'source.family-hygiene-approved',
    name: 'Family Hygiene exact 2×2 cuts',
    expectedAtlasVersion: 0,
    rectangles,
  }), ownerContext);
  const jobId = 'job.family-hygiene-2c.preview';
  await running.studioService.execute(command('atlas.preview.slices', 5, 'atlas-preview', {
    atlasId: 'atlas.family-hygiene-2c',
    expectedAtlasVersion: defined.value.definitionVersion,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId,
  }), ownerContext);
  await running.atlasPreviewWorker.kick();
  const succeeded = running.jobStore.get(projectId, jobId);
  if (succeeded.state !== 'SUCCEEDED') throw new Error(`Visual preview job ended in ${succeeded.state}.`);
  if (JSON.stringify(succeeded.outputs.map(({ digest }) => digest)) !== JSON.stringify(outputDigests)) {
    throw new Error('Visual preview output digests differ from the Checkpoint 2C pins.');
  }
  const committed = await running.studioService.execute(command('atlas.commit.slices', 6, 'atlas-commit', {
    atlasId: 'atlas.family-hygiene-2c',
    expectedAtlasVersion: defined.value.definitionVersion,
    expectedDefinitionFingerprint: defined.value.definitionFingerprint,
    jobId,
  }), ownerContext);

  await running.studioService.execute(command('grant.issue', 7, 'grant', {
    grantId,
    agentId: agent.id,
    taskId,
    branchId,
    scopes: ['project.read', 'asset.proposal.submit'],
    objectScopes: [{ kind: 'project', id: projectId }],
    budget: { maxCommands: 4, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
    expiresAt: '2026-08-23T11:00:00.000Z',
  }), ownerContext);
  const binding = running.hostBindingStore.issue({
    projectId,
    grantId,
    agentId: agent.id,
    taskId,
    branchId,
    issuedBy: owner.id,
    expiresAt: '2026-08-23T11:00:00.000Z',
  });
  const mcp = await officialMcpClient(binding.token);
  const proposalId = 'proposal.family-hygiene-2c';
  const proposalCommand = command('asset.proposal.submit', 8, 'proposal-submit', {
    proposalId,
    expectedRevision: 8,
    items: committed.value.slices.map((slice, ordinal) => ({
      itemId: `item.family-hygiene.${ordinal + 1}`,
      operation: 'create',
      assetId: `asset.family-hygiene.${ordinal + 1}`,
      expectedAssetVersion: 0,
      expectedMetadataVersion: 0,
      sliceId: slice.sliceId,
      expectedSliceVersion: slice.version,
      name: assetNames[ordinal],
      kind: 'surface',
      metadata: metadata(ordinal),
    })),
  });
  const { type: _proposalType, ...proposalArguments } = proposalCommand;
  const submittedResult = await mcp.client.callTool({
    name: 'studio_asset_proposal_submit',
    arguments: proposalArguments,
  });
  const submitted = mcpPayload(submittedResult);
  if (submittedResult.isError) {
    throw new Error(`Official MCP proposal submission failed: ${JSON.stringify({ result: submittedResult, payload: submitted })}`);
  }
  if (submitted.revision !== 9 || submitted.value.itemCount !== 4) {
    throw new Error('Durable HostBinding proposal submission did not create the expected revision-9 batch.');
  }

  if (phase === 'pending') {
    await mcp.close();
    const pendingProject = await running.studioService.readProjectTrusted(projectId);
    const pendingProposal = pendingProject.snapshot.assetLibrary.proposals[0];
    if (pendingProject.revision !== 9 || pendingProposal.state !== 'PENDING'
        || pendingProject.snapshot.assetLibrary.assets.length !== 0) {
      throw new Error('Checkpoint 2C pending fixture did not stop before owner mutation.');
    }
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      phase,
      projectId,
      revision: 9,
      activityCount: 9,
      proposalId,
      proposalVersion: 1,
      proposalState: 'PENDING',
      submittedThrough: 'official-mcp-2026-07-28-host-binding',
      itemCount: 4,
      outputDigests,
    }, null, 2)}\n`);
  } else {
    const rejectedItemId = 'item.family-hygiene.4';
    const rejectionReason = 'Reserve this fourth variant for a later visual review.';
    await running.studioService.execute(command('asset.proposal.decide', 9, 'proposal-decision', {
    proposalId,
    expectedProposalVersion: 1,
    decisions: committed.value.slices.map((_slice, ordinal) => ({
      itemId: `item.family-hygiene.${ordinal + 1}`,
      disposition: ordinal === 3 ? 'REJECTED' : 'ACCEPTED',
      reason: ordinal === 3 ? rejectionReason : null,
    })),
  }), ownerContext);
  await running.studioService.execute(command('asset.proposal.apply', 10, 'proposal-apply', {
    proposalId,
    expectedProposalVersion: 2,
  }), ownerContext);

  const deniedCommand = command('asset.proposal.submit', 11, 'final-denied-budget-probe', {
    proposalId: 'proposal.family-hygiene-budget-probe',
    expectedRevision: 11,
    items: [{
      itemId: 'item.family-hygiene.budget-probe',
      operation: 'create',
      assetId: 'asset.family-hygiene.budget-probe',
      expectedAssetVersion: 0,
      expectedMetadataVersion: 0,
      sliceId: committed.value.slices[3].sliceId,
      expectedSliceVersion: committed.value.slices[3].version,
      name: 'Budget probe must not persist',
      kind: 'surface',
      metadata: metadata(3),
    }],
  });
  const { type: _deniedType, ...deniedArguments } = deniedCommand;
  const deniedResult = await mcp.client.callTool({
    name: 'studio_asset_proposal_submit',
    arguments: deniedArguments,
  });
  const denied = mcpPayload(deniedResult);
  if (!deniedResult.isError || denied?.error?.code !== 'BUDGET_EXCEEDED') {
    throw new Error(`Final MCP budget denial did not fail closed: ${JSON.stringify({ result: deniedResult, payload: denied })}`);
  }
  await mcp.close();

  const finalProject = await running.studioService.readProjectTrusted(projectId);
  const proposal = finalProject.snapshot.assetLibrary.proposals[0];
  const assets = finalProject.snapshot.assetLibrary.assets;
  if (finalProject.revision !== 11 || assets.length !== 3 || proposal.state !== 'APPLIED') {
    throw new Error('Checkpoint 2C fixture did not reach the exact applied accepted-subset state.');
  }
  if (JSON.stringify(assets.map(({ sliceBinding }) => sliceBinding.digest)) !== JSON.stringify(outputDigests.slice(0, 3))) {
    throw new Error('Checkpoint 2C READY assets differ from the exact committed slice digests.');
  }
  if (assets.some(({ lifecycle }) => lifecycle === 'FINAL')) {
    throw new Error('Checkpoint 2C fixture assets must not be finalized.');
  }
    process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId,
    revision: finalProject.revision,
    activityCount: 12,
    source: { path: sourcePath, digest: sourceDigest, byteSize: artifact.byteSize, width: artifact.width, height: artifact.height },
    atlas: {
      atlasId: committed.value.atlasId,
      definitionVersion: defined.value.definitionVersion,
      jobId,
      jobState: running.jobStore.get(projectId, jobId).state,
      rectangles,
      outputDigests,
    },
    proposal: {
      proposalId,
      proposalVersion: proposal.proposalVersion,
      state: proposal.state,
      submittedThrough: 'official-mcp-2026-07-28-host-binding',
      proposer: { actorId: agent.id, taskId, branchId },
      itemCount: proposal.items.length,
      rejectedItemId,
      rejectionReason,
    },
    assets: assets.map((asset) => ({
      assetId: asset.assetId,
      name: asset.name,
      kind: asset.kind,
      lifecycle: asset.lifecycle,
      assetVersion: asset.assetVersion,
      metadataVersion: asset.metadataVersion,
      sliceId: asset.sliceBinding.sliceId,
      sliceVersion: asset.sliceBinding.sliceVersion,
      digest: asset.sliceBinding.digest,
      findings: asset.findings.map(({ findingId, severity, ruleId }) => ({ findingId, severity, ruleId })),
    })),
    authorityEvidence: {
      hostBindingIssued: Boolean(binding.binding.bindingId),
      deniedOrFailedAttemptCount: running.agentAttemptStore.listForProject(projectId).length,
      finalAttemptCode: denied.error.code,
      grantCommandUsage: finalProject.snapshot.grants[0].usage.commands,
    },
    }, null, 2)}\n`);
  }
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
