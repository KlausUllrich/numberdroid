import assert from 'node:assert/strict';
import test from 'node:test';
import { assemblyFixture, owner, projectId } from './assembly-test-helpers.js';
import { verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';

export function assemblyPayload(overrides = {}) {
  return { assetId: 'assembly.fixture', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0,
    name: 'Assembled fixture', kind: 'prop', metadata: { role: 'machine', tags: ['fixture'] },
    assembly: { schemaVersion: 1, coordinateSpace: 'assembly-pixels', unitsPerPixel: 1 / 64,
      placementBounds: { x: -64, y: -64, width: 128, height: 128 }, anchor: { x: 0, y: 0 },
      states: [{ stateId: 'idle', name: 'Idle' }], variants: [{ variantId: 'default', name: 'Default' }], defaultStateId: 'idle', defaultVariantId: 'default',
      components: [{ componentId: 'body', name: 'Body', asset: { assetId: 'asset.fixture', assetVersion: 1, metadataVersion: 1 }, position: { x: 0, y: 0 }, rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [] }],
      blocking: { mode: 'components', regions: [] } }, ...overrides };
}

test('Assembly owner Save preserves exact old leaf closure, versions, replay and restart', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context);
  await f.execute('asset.save', f.payload());
  const request = await f.request('assembly.save', assemblyPayload());
  const saved = await f.studio.execute(request, owner);
  assert.equal(saved.value.assetVersion, 1);
  const replay = await f.studio.execute(request, owner); assert.equal(replay.replayed, true);
  const query = () => f.studio.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture' }, owner);
  const first = await query(); assert.equal(first.assets[0].leafAssets[0].assetVersion, 1);
  await f.execute('asset.save', f.payload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, name: 'Leaf changed', image: { mode: 'retain' } }));
  assert.deepEqual((await query()).assets[0], first.assets[0]);
  await f.execute('assembly.save', assemblyPayload({ operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, name: 'Assembly renamed' }));
  assert.equal((await query()).assets[0].metadataVersion, 1);
  await f.restart(); assert.equal((await query()).assets[0].assetVersion, 2);
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});

test('Assembly writes reject invalid pins, namespace collisions, authority and roll back at every stage', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('asset.save', f.payload());
  await assert.rejects(f.execute('assembly.save', assemblyPayload({ assetId: 'asset.fixture' })), { code: 'ASSEMBLY_ID_CONFLICT' });
  const invalid = assemblyPayload(); invalid.assembly.components[0].asset.assetVersion = 99;
  await assert.rejects(f.execute('assembly.save', invalid));
  await assert.rejects(f.execute('assembly.save', assemblyPayload(), { ...owner, actor: { id: 'agent.foreign', kind: 'agent' } }), { code: 'FORBIDDEN' });
  const before = await f.studio.readProjectTrusted(projectId);
  for (const point of ['after_assembly_identity','after_assembly_version','after_assembly_pins','after_assembly_findings','after_assembly_references','after_assembly_head','before_transaction_commit']) {
    f.fault(point); await assert.rejects(f.execute('assembly.save', assemblyPayload()), /injected/); f.fault(null);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
    assert.equal(f.store.workspace.database.prepare('SELECT count(*) AS n FROM assembly_versions').get().n, 0);
  }
  await f.execute('assembly.save', assemblyPayload());
  await assert.rejects(f.execute('asset.save', f.payload({ assetId: 'assembly.fixture' })), { code: 'ASSEMBLY_ID_CONFLICT' });
});

test('Assembly proposal request changes, exact resubmission and atomic owner acceptance', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('asset.save', f.payload());
  const submit = { ...assemblyPayload(), proposalId: 'proposal.assembly', expectedProposalVersion: 0 };
  await f.execute('assembly.proposal.submit', submit);
  assert.equal((await f.studio.readProjectTrusted(projectId)).snapshot.assemblyLibrary.assets.length, 0);
  await f.execute('assembly.proposal.resolve', { proposalId: submit.proposalId, expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', feedback: 'Rename the fixture.', confirmed: true });
  await assert.rejects(f.execute('assembly.proposal.submit', submit), { code: 'ASSEMBLY_PROPOSAL_CONFLICT' });
  await f.execute('assembly.proposal.submit', { ...submit, expectedProposalVersion: 2, name: 'Revised assembly' });
  f.fault('after_assembly_version');
  await assert.rejects(f.execute('assembly.proposal.resolve', { proposalId: submit.proposalId, expectedProposalVersion: 3, decision: 'ACCEPT', confirmed: true }), /injected/);
  f.fault(null);
  await f.execute('assembly.proposal.resolve', { proposalId: submit.proposalId, expectedProposalVersion: 3, decision: 'ACCEPT', confirmed: true });
  const query = await f.studio.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture', proposalId: submit.proposalId }, owner);
  assert.equal(query.assets[0].name, 'Revised assembly'); assert.equal(query.proposals[0].status, 'ACCEPTED');
  assert.deepEqual(query.assets[0].proposal, { proposalId: submit.proposalId, proposalVersion: 4 });
});
