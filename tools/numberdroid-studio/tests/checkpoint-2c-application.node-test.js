import assert from 'node:assert/strict';
import test from 'node:test';
import { StudioService } from '../packages/application/src/index.js';
import { StudioError } from '../packages/domain/src/index.js';
import {
  AGENT_CONTEXT, OWNER_CONTEXT, PROJECT_ID, command, createProject, issueGrant,
} from './test-helpers.js';

class AssetReadyMemoryStore {
  supportsAtomicAssetLibrary = true;
  documents = new Map();

  async createProject(document) {
    if (this.documents.has(document.projectId)) throw new StudioError('PROJECT_EXISTS', 'exists');
    this.documents.set(document.projectId, structuredClone(document));
  }

  async loadProject(projectId) {
    const value = this.documents.get(projectId);
    return value ? structuredClone(value) : null;
  }

  async appendRevision(projectId, expectedRevision, revision) {
    const document = this.documents.get(projectId);
    const actual = document.revisions.at(-1)?.number ?? 0;
    if (actual !== expectedRevision) throw new StudioError('REVISION_CONFLICT', 'changed');
    document.revisions.push(structuredClone(revision));
  }

  async listProjects() { return []; }

  updateHead(projectId, update) {
    const document = this.documents.get(projectId);
    update(document.revisions.at(-1).snapshot, document);
  }
}

const digests = [
  'ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318',
];

function slice(ordinal) {
  const x = ordinal % 2 === 0 ? 3 : 629;
  const y = ordinal < 2 ? 3 : 629;
  return {
    schemaVersion: 1,
    sliceId: `slice.family.${ordinal}`,
    version: 1,
    atlasId: 'atlas.family.2b',
    sourceId: 'source.family.2b',
    sourceDigest: '67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e',
    definitionVersion: 1,
    definitionFingerprint: 'ff8ba1f46507e2925b3ca850be6fab082743d0877db816238044597445921617',
    rectangleId: `rect.family.${ordinal}`,
    rectangle: {
      rectangleId: `rect.family.${ordinal}`,
      x, y, width: 622, height: 622, included: true, pivot: null,
      transparentPaddingPolicy: 'preserve_exact_rect', replacesSliceId: null, expectedSliceVersion: null,
    },
    processorId: 'numberdroid-studio.exact-png-crop.v1',
    digest: digests[ordinal],
    artifactUri: `studio://artifacts/sha256/${digests[ordinal]}`,
    mediaType: 'image/png',
    byteSize: 1548341,
    width: 622,
    height: 622,
    priorDigest: null,
    committedAt: '2026-08-21T12:00:00.000Z',
    committedBy: 'designer.one',
    jobId: 'job.family.2b',
  };
}

function metadata() {
  return {
    role: 'base', tags: ['family', 'hygiene'], variantGroup: null,
    compatibilityGroups: ['family-hygiene-floor'], spanTiles: { width: 1, height: 1 },
    anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'fixed',
    placement: { modes: ['manual'], wallSafe: true, tags: ['calm-base'], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] },
    navigation: { effect: 'passable', cost: null }, runtimeEligible: false,
    connectors: [], continuityProfile: null, continuityTags: [], selectionPriority: 0,
    visualWeight: 'medium', extensions: {},
  };
}

function proposalCommand(expectedVersion = 2) {
  return command({
    commandId: 'cmd.asset.proposal', idempotencyKey: 'idem.asset.proposal',
    type: 'asset.proposal.submit', expectedVersion,
    payload: {
      proposalId: 'proposal.family', expectedRevision: expectedVersion,
      items: [0, 1, 2, 3].map((ordinal) => ({
        itemId: `item.family.${ordinal}`, operation: 'create', assetId: `asset.family.${ordinal}`,
        expectedAssetVersion: 0, expectedMetadataVersion: 0,
        sliceId: `slice.family.${ordinal}`, expectedSliceVersion: 1,
        name: `Family Hygiene ${ordinal + 1}`, kind: 'surface', metadata: metadata(),
      })),
    },
  });
}

async function fixture() {
  const store = new AssetReadyMemoryStore();
  let tick = 0;
  const studio = new StudioService({
    store,
    agentAttemptAuditReady: true,
    clock: () => new Date(Date.UTC(2026, 7, 22, 10, 0, tick++)).toISOString(),
  });
  await createProject(studio);
  store.updateHead(PROJECT_ID, (snapshot) => {
    snapshot.atlases = [{ id: 'atlas.family.2b', sliceHeads: [0, 1, 2, 3].map(slice) }];
  });
  await issueGrant(studio, {
    scopes: ['project.read', 'asset.proposal.submit'],
    budget: { maxCommands: 6, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 },
  });
  return { store, studio };
}

test('durable asset proposal charges every item and preserves exact preview lineage', async () => {
  const { studio } = await fixture();
  const submitted = await studio.execute(proposalCommand(), AGENT_CONTEXT);
  assert.deepEqual(submitted.value, {
    proposalId: 'proposal.family', proposalVersion: 1, state: 'PENDING',
    fingerprint: submitted.value.fingerprint, itemCount: 4,
  });
  assert.match(submitted.value.fingerprint, /^[a-f0-9]{64}$/);
  const project = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(project.snapshot.grants[0].usage.commands, 4);
  assert.equal(project.snapshot.assetLibrary.proposals[0].items[0].sliceBinding.digest, digests[0]);
  assert.equal(project.snapshot.assetLibrary.proposals[0].items[0].sliceBinding.committedRevision, 1);

  const replay = await studio.execute({ ...proposalCommand(), commandId: 'cmd.asset.proposal.replay' }, AGENT_CONTEXT);
  assert.equal(replay.replayed, true);
  assert.equal((await studio.readProjectTrusted(PROJECT_ID)).revision, 3);
});

test('owner decision rejects one item and later atomically applies only the accepted subset', async () => {
  const { studio } = await fixture();
  await studio.execute(proposalCommand(), AGENT_CONTEXT);
  const decisionCommand = command({
    commandId: 'cmd.asset.decision', idempotencyKey: 'idem.asset.decision',
    type: 'asset.proposal.decide', expectedVersion: 3,
    payload: {
      proposalId: 'proposal.family', expectedProposalVersion: 1,
      decisions: [0, 1, 2, 3].map((ordinal) => ({
        itemId: `item.family.${ordinal}`,
        disposition: ordinal === 3 ? 'REJECTED' : 'ACCEPTED',
        reason: ordinal === 3 ? 'Hold this visual variant for a later review.' : null,
      })),
    },
  });
  await assert.rejects(studio.execute(decisionCommand, AGENT_CONTEXT), (error) => error.code === 'FORBIDDEN');
  const decided = await studio.execute(decisionCommand, OWNER_CONTEXT);
  assert.deepEqual(decided.value, {
    proposalId: 'proposal.family', proposalVersion: 2, state: 'DECIDED', acceptedCount: 3, rejectedCount: 1,
  });

  const applied = await studio.execute(command({
    commandId: 'cmd.asset.apply', idempotencyKey: 'idem.asset.apply',
    type: 'asset.proposal.apply', expectedVersion: 4,
    payload: { proposalId: 'proposal.family', expectedProposalVersion: 2 },
  }), OWNER_CONTEXT);
  assert.deepEqual(applied.value.appliedAssetIds, ['asset.family.0', 'asset.family.1', 'asset.family.2']);
  assert.deepEqual(applied.value.rejectedItemIds, ['item.family.3']);
  const project = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(project.snapshot.assetLibrary.assets.length, 3);
  assert.deepEqual(project.snapshot.assetLibrary.assets.map(({ sliceBinding: binding }) => binding.digest), digests.slice(0, 3));
  assert.equal(project.snapshot.assetLibrary.proposals[0].items[3].decision.reason, 'Hold this visual variant for a later review.');
  assert.equal(project.snapshot.assetLibrary.proposals[0].state, 'APPLIED');
});

test('a recut after proposal preparation conflicts without partial asset creation', async () => {
  const { store, studio } = await fixture();
  await studio.execute(proposalCommand(), AGENT_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.asset.decision.all', idempotencyKey: 'idem.asset.decision.all',
    type: 'asset.proposal.decide', expectedVersion: 3,
    payload: {
      proposalId: 'proposal.family', expectedProposalVersion: 1,
      decisions: [0, 1, 2, 3].map((ordinal) => ({ itemId: `item.family.${ordinal}`, disposition: 'ACCEPTED', reason: null })),
    },
  }), OWNER_CONTEXT);
  store.updateHead(PROJECT_ID, (snapshot) => {
    snapshot.atlases[0].sliceHeads[0] = { ...snapshot.atlases[0].sliceHeads[0], version: 2, digest: digests[1], artifactUri: `studio://artifacts/sha256/${digests[1]}` };
  });
  await assert.rejects(studio.execute(command({
    commandId: 'cmd.asset.apply.stale', idempotencyKey: 'idem.asset.apply.stale',
    type: 'asset.proposal.apply', expectedVersion: 4,
    payload: { proposalId: 'proposal.family', expectedProposalVersion: 2 },
  }), OWNER_CONTEXT), (error) => error.code === 'ASSET_SLICE_STALE');
  const project = await studio.readProjectTrusted(PROJECT_ID);
  assert.equal(project.revision, 4);
  assert.deepEqual(project.snapshot.assetLibrary.assets, []);
});

test('owner lifecycle promotion creates immutable versions without changing metadata version', async () => {
  const { studio } = await fixture();
  await studio.execute(proposalCommand(), AGENT_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.asset.decision.lifecycle', idempotencyKey: 'idem.asset.decision.lifecycle',
    type: 'asset.proposal.decide', expectedVersion: 3,
    payload: {
      proposalId: 'proposal.family', expectedProposalVersion: 1,
      decisions: [0, 1, 2, 3].map((ordinal) => ({
        itemId: `item.family.${ordinal}`,
        disposition: ordinal === 0 ? 'ACCEPTED' : 'REJECTED',
        reason: ordinal === 0 ? null : 'Not part of this lifecycle check.',
      })),
    },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.asset.apply.lifecycle', idempotencyKey: 'idem.asset.apply.lifecycle',
    type: 'asset.proposal.apply', expectedVersion: 4,
    payload: { proposalId: 'proposal.family', expectedProposalVersion: 2 },
  }), OWNER_CONTEXT);
  let revision = 5;
  let expectedAssetVersion = 1;
  for (const targetLifecycle of ['METADATA_COMPLETE', 'VALIDATED', 'FINAL']) {
    const result = await studio.execute(command({
      commandId: `cmd.asset.lifecycle.${targetLifecycle}`,
      idempotencyKey: `idem.asset.lifecycle.${targetLifecycle}`,
      type: 'asset.lifecycle.set', expectedVersion: revision,
      payload: {
        assetId: 'asset.family.0', expectedAssetVersion, expectedMetadataVersion: 1,
        targetLifecycle, acceptedWarningFindingIds: [],
      },
    }), OWNER_CONTEXT);
    revision += 1;
    expectedAssetVersion += 1;
    assert.equal(result.value.lifecycle, targetLifecycle);
    assert.equal(result.value.metadataVersion, 1);
    assert.equal(result.value.assetVersion, expectedAssetVersion);
  }
});

test('imagery-only updates preserve metadataVersion while typed changes increment it', async () => {
  const { studio } = await fixture();
  await studio.execute(proposalCommand(), AGENT_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.asset.decision.metadata-base', idempotencyKey: 'idem.asset.decision.metadata-base',
    type: 'asset.proposal.decide', expectedVersion: 3,
    payload: {
      proposalId: 'proposal.family', expectedProposalVersion: 1,
      decisions: [0, 1, 2, 3].map((ordinal) => ({
        itemId: `item.family.${ordinal}`,
        disposition: ordinal === 0 ? 'ACCEPTED' : 'REJECTED',
        reason: ordinal === 0 ? null : 'Not part of this metadata-version check.',
      })),
    },
  }), OWNER_CONTEXT);
  await studio.execute(command({
    commandId: 'cmd.asset.apply.metadata-base', idempotencyKey: 'idem.asset.apply.metadata-base',
    type: 'asset.proposal.apply', expectedVersion: 4,
    payload: { proposalId: 'proposal.family', expectedProposalVersion: 2 },
  }), OWNER_CONTEXT);

  const update = async ({
    proposalId, itemId, expectedRevision, expectedAssetVersion, expectedMetadataVersion,
    sliceOrdinal, authoredMetadata,
  }) => {
    await studio.execute(command({
      commandId: `cmd.${proposalId}.submit`, idempotencyKey: `idem.${proposalId}.submit`,
      type: 'asset.proposal.submit', expectedVersion: expectedRevision,
      payload: {
        proposalId, expectedRevision,
        items: [{
          itemId, operation: 'update', assetId: 'asset.family.0',
          expectedAssetVersion, expectedMetadataVersion,
          sliceId: `slice.family.${sliceOrdinal}`, expectedSliceVersion: 1,
          name: 'Family Hygiene 1', kind: 'surface', metadata: authoredMetadata,
        }],
      },
    }), AGENT_CONTEXT);
    await studio.execute(command({
      commandId: `cmd.${proposalId}.decide`, idempotencyKey: `idem.${proposalId}.decide`,
      type: 'asset.proposal.decide', expectedVersion: expectedRevision + 1,
      payload: {
        proposalId, expectedProposalVersion: 1,
        decisions: [{ itemId, disposition: 'ACCEPTED', reason: null }],
      },
    }), OWNER_CONTEXT);
    await studio.execute(command({
      commandId: `cmd.${proposalId}.apply`, idempotencyKey: `idem.${proposalId}.apply`,
      type: 'asset.proposal.apply', expectedVersion: expectedRevision + 2,
      payload: { proposalId, expectedProposalVersion: 2 },
    }), OWNER_CONTEXT);
  };

  const base = (await studio.readProjectTrusted(PROJECT_ID)).snapshot.assetLibrary.assets[0];
  await update({
    proposalId: 'proposal.imagery-only', itemId: 'item.imagery-only', expectedRevision: 5,
    expectedAssetVersion: 1, expectedMetadataVersion: 1, sliceOrdinal: 1,
    authoredMetadata: metadata(),
  });
  const imageryOnly = (await studio.readProjectTrusted(PROJECT_ID)).snapshot.assetLibrary.assets[0];
  assert.equal(imageryOnly.assetVersion, 2);
  assert.equal(imageryOnly.metadataVersion, 1);
  assert.equal(imageryOnly.metadataFingerprint, base.metadataFingerprint);
  assert.equal(imageryOnly.sliceBinding.digest, digests[1]);

  await update({
    proposalId: 'proposal.metadata-change', itemId: 'item.metadata-change', expectedRevision: 8,
    expectedAssetVersion: 2, expectedMetadataVersion: 1, sliceOrdinal: 1,
    authoredMetadata: { ...metadata(), selectionPriority: 1 },
  });
  const semanticChange = (await studio.readProjectTrusted(PROJECT_ID)).snapshot.assetLibrary.assets[0];
  assert.equal(semanticChange.assetVersion, 3);
  assert.equal(semanticChange.metadataVersion, 2);
  assert.notEqual(semanticChange.metadataFingerprint, base.metadataFingerprint);
});
