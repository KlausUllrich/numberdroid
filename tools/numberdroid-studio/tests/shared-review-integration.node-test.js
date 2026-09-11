import assert from 'node:assert/strict';
import test from 'node:test';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { clipPayload } from './clip-test-helpers.js';
import { verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';

function group(f, reviewId = 'review.integration') {
  const assembly = assemblyPayload();
  assembly.assembly.schemaVersion = 2;
  const body = assembly.assembly.components[0];
  body.content = { kind: 'image', asset: body.asset }; delete body.asset; body.stateOverrides = [];
  assembly.assembly.components.push({ componentId: 'display', name: 'Animated display',
    content: { kind: 'animation', asset: { assetId: 'clip.fixture', assetVersion: 1, metadataVersion: 1 } },
    position: { x: 12, y: -10 }, rotationDegrees: 0, scale: 1, stateIds: null, variantOverrides: [], stateOverrides: [] });
  return { reviewId, expectedReviewVersion: 0, title: 'A complete machine with its display', items: [
    { itemId: 'assembly', contentKind: 'assembly', payload: assembly, dependsOn: ['image', 'animation'] },
    { itemId: 'animation', contentKind: 'animation', payload: clipPayload(f.slice), dependsOn: [] },
    { itemId: 'image', contentKind: 'image', payload: f.payload(), dependsOn: [] },
  ] };
}
const decision = (reviewVersion, selectedItemIds) => ({ reviewId: 'review.integration', expectedReviewVersion: reviewVersion, selectedItemIds, confirmed: true });

test('shared Review accepts three typed assets in one revision and preserves the resolved exact history', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), proposal = group(f), before = await f.studio.readProjectTrusted(projectId);
  await f.execute('review.proposal.submit', proposal);
  let review = await f.studio.queryReviews({ schemaVersion: 1, projectId, reviewId: proposal.reviewId, includeHistory: true }, owner);
  assert.equal(review.groups[0].contentVersion, 1);
  assert.equal(review.groups[0].items.length, 3);
  const submitted = await f.studio.readProjectTrusted(projectId);
  assert.equal(submitted.snapshot.assetLibrary?.assets.length ?? 0, 0);
  const accept = await f.request('review.accept', decision(1, ['assembly', 'animation', 'image']));
  const result = await f.studio.execute(accept, owner);
  assert.equal(result.value.accepted.length, 3);
  assert.equal((await f.studio.execute(accept, owner)).replayed, true);
  const accepted = await f.studio.readProjectTrusted(projectId);
  assert.equal(accepted.revision, submitted.revision + 1);
  assert.equal(accepted.revision, before.revision + 2);
  for (const key of ['assetLibrary', 'clipLibrary', 'assemblyLibrary']) assert.equal(accepted.snapshot[key].assets.length, 1);
  const assembly = await f.studio.queryAssemblies({ schemaVersion: 1, projectId, assetId: 'assembly.fixture' }, owner);
  assert.equal(assembly.assets[0].leafAssets.length, 2);
  assert.equal(assembly.assets[0].leafAssets.find(item => item.contentKind === 'animation').frameBindings.length, 1);
  await f.restart();
  review = await f.studio.queryReviews({ schemaVersion: 1, projectId, reviewId: proposal.reviewId, reviewVersion: 1 }, owner);
  assert.equal(review.groups[0].status, 'PENDING');
  assert.equal((await f.studio.queryReviews({ schemaVersion: 1, projectId, reviewId: proposal.reviewId }, owner)).groups[0].status, 'ACCEPTED');
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});

test('shared Review partial acceptance, amended feedback and reconsidered acceptance preserve earlier receipt pins', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context); await f.execute('review.proposal.submit', group(f));
  const before = await f.studio.readProjectTrusted(projectId);
  await assert.rejects(f.execute('review.accept', decision(1, ['assembly'])));
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  await f.execute('review.accept', decision(1, ['image', 'animation']));
  const leaf = (await f.studio.readProjectTrusted(projectId)).snapshot.assetLibrary.assets[0];
  await f.execute('review.feedback.save', { reviewId: 'review.integration', expectedReviewVersion: 2, summary: 'Keep the first layout.', itemComments: [{ itemId: 'assembly', text: 'Retain its geometry.' }], confirmed: true });
  await f.execute('review.feedback.save', { reviewId: 'review.integration', expectedReviewVersion: 3, summary: 'Actually this proposal is useful as it is.', itemComments: [], confirmed: true });
  await f.execute('review.accept', decision(4, ['assembly']));
  const after = await f.studio.readProjectTrusted(projectId);
  assert.deepEqual(after.snapshot.assetLibrary.assets[0], leaf);
  const old = await f.studio.queryReviews({ schemaVersion: 1, projectId, reviewId: 'review.integration', reviewVersion: 3 }, owner);
  assert.equal(old.groups[0].feedback.summary, 'Keep the first layout.');
  assert.equal(old.groups[0].contentVersion, 1);
  const integrity = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
});
