import assert from 'node:assert/strict';
import test from 'node:test';
import { assemblyFixture, assemblyPayload, owner, projectId } from './assembly-test-helpers.js';
import { clipPayload } from './clip-test-helpers.js';
import { verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { createWorkspaceBackup, restoreWorkspaceBackup, verifyWorkspaceBackup, SqliteProjectStore, ContentAddressedArtifactStore } from '../packages/persistence/src/index.js';
import { StudioService } from '../packages/application/src/index.js';
import { nodeSqliteDatabaseFactory } from './persistence-test-helpers.js';
import { join } from 'node:path';

async function submit(f, kind, extra = {}) {
  const proposalId = `proposal.legacy.${kind}`;
  if (kind === 'image') {
    const { image, ...payload } = f.payload(extra), revision = (await f.studio.readProjectTrusted(projectId)).revision;
    await f.execute('asset.proposal.submit', { proposalId, expectedRevision: revision, items: [{ ...payload, itemId: 'item.image', sliceId: image.sliceId, expectedSliceVersion: image.expectedSliceVersion }] });
  } else {
    if (kind === 'assembly') await f.execute('asset.save', f.payload());
    await f.execute(`${kind === 'animation' ? 'clip' : kind}.proposal.submit`, { ...(kind === 'animation' ? clipPayload(f.slice) : assemblyPayload()), ...extra, proposalId, expectedProposalVersion: 0 });
  }
  return { contentKind: kind, proposalId, expectedProposalVersion: 1 };
}
const read = (f, legacySource, extra = {}) => f.studio.queryLegacyReview({ schemaVersion: 1, projectId, legacySource, includeHistory: true, ...extra }, owner);
const first = (group, extra = {}) => ({ reviewId: group.reviewId, expectedReviewVersion: 0, legacySource: group.legacySource, confirmed: true, ...extra });
const check = async f => { const result = await verifyWorkspaceIntegrity({ projectStore: f.store, artifactStore: f.artifacts }); assert.equal(result.ok, true, JSON.stringify(result)); };

for (const kind of ['image', 'animation', 'assembly']) test(`legacy ${kind}: reads do not write; first acceptance is atomic, frozen and durable`, { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, kind), before = await f.studio.readProjectTrusted(projectId);
  const group = (await read(f, source)).groups[0];
  assert.equal(group.reviewVersion, 0); assert.equal(group.isLegacyProjection, true); assert.equal(group.eligibility.canAccept, true);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  const request = await f.request('review.accept', first(group, { selectedItemIds: group.items.map(item => item.itemId) }));
  const result = await f.studio.execute(request, owner); assert.equal(result.value.reviewVersion, 1); assert.equal(result.value.accepted.length, 1);
  assert.equal((await f.studio.execute(request, owner)).replayed, true);
  const after = await f.studio.readProjectTrusted(projectId); assert.equal(after.revision, before.revision + 1);
  for (const library of ['assetLibrary', 'clipLibrary', 'assemblyLibrary']) assert.deepEqual(after.snapshot[library]?.proposals, before.snapshot[library]?.proposals);
  assert.equal((await read(f, source)).groups[0].legacyAdopted, true);
  await assert.rejects(f.execute('review.discard', first(group)), { code: 'LEGACY_PROPOSAL_ADOPTED' });
  const oldType = kind === 'image' ? 'asset.proposal.decide' : `${kind === 'animation' ? 'clip' : 'assembly'}.proposal.resolve`;
  const oldPayload = kind === 'image' ? { proposalId: source.proposalId, expectedProposalVersion: 1, decisions: [{ itemId: 'item.image', disposition: 'ACCEPTED', reason: null }] }
    : { proposalId: source.proposalId, expectedProposalVersion: 1, decision: 'ACCEPT', confirmed: true };
  await assert.rejects(f.execute(oldType, oldPayload), { code: 'LEGACY_PROPOSAL_ADOPTED' });
  await check(f); await f.restart(); await check(f);
  assert.equal((await read(f, source)).groups[0].status, 'ACCEPTED');
});

test('legacy requested feedback remains historical; amendments and reconsideration use shared versions', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation');
  await f.execute('clip.proposal.resolve', { proposalId: source.proposalId, expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', feedback: 'Earlier feedback', confirmed: true });
  source.expectedProposalVersion = 2;
  const group = (await read(f, source)).groups[0];
  assert.equal(group.feedback.summary, 'Earlier feedback'); assert.equal(group.status, 'CHANGES_REQUESTED');
  await f.execute('review.feedback.save', first(group, { summary: 'Amended feedback', itemComments: [] }));
  let current = (await read(f, source)).groups[0];
  assert.equal(current.legacyProvenance.history.at(-1).feedback, 'Earlier feedback');
  assert.equal(current.feedback.summary, 'Amended feedback');
  await f.execute('review.accept', { reviewId: current.reviewId, expectedReviewVersion: 1, selectedItemIds: ['item.content'], confirmed: true });
  current = (await read(f, source)).groups[0]; assert.equal(current.status, 'ACCEPTED'); await check(f);
});

for (const kind of ['animation', 'assembly']) test(`legacy ${kind}: inherited feedback keeps the owner's decision provenance after agent resubmission`, { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), type = kind === 'animation' ? 'clip' : 'assembly';
  if (kind === 'assembly') await f.execute('asset.save', f.payload());
  const actor = { actor: { id: `agent.feedback.${kind}`, kind: 'agent' }, taskId: `task.feedback.${kind}`, grantId: `grant.feedback.${kind}`, branchId: 'branch.main' };
  await f.execute('grant.issue', { grantId: actor.grantId, agentId: actor.actor.id, taskId: actor.taskId, branchId: actor.branchId,
    scopes: ['project.read', `${type}.proposal.submit`], objectScopes: [{ kind: 'project', id: projectId }],
    budget: { maxCommands: 10, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 } });
  const content = kind === 'animation' ? clipPayload(f.slice) : assemblyPayload();
  const source = { contentKind: kind, proposalId: `proposal.feedback.${kind}`, expectedProposalVersion: 3 };
  await f.execute(`${type}.proposal.submit`, { ...content, proposalId: source.proposalId, expectedProposalVersion: 0 }, actor);
  const feedback = 'Please clarify the display name.';
  await f.execute(`${type}.proposal.resolve`, { proposalId: source.proposalId, expectedProposalVersion: 1, decision: 'REQUEST_CHANGES', feedback, confirmed: true });
  const ownerSnapshot = await f.studio.readProjectTrusted(projectId);
  const ownerDecision = ownerSnapshot.snapshot[kind === 'animation' ? 'clipLibrary' : 'assemblyLibrary'].proposals.find(proposal => proposal.proposalId === source.proposalId);
  await f.execute(`${type}.proposal.submit`, { ...content, name: 'Clarified display', proposalId: source.proposalId, expectedProposalVersion: 2 }, actor);
  const group = (await read(f, source)).groups[0];
  const expectedFeedback = { summary: feedback, itemComments: [], reviewVersion: 0, contentVersion: 1,
    actorId: owner.actor.id, createdAt: ownerDecision.createdAt, revision: ownerSnapshot.revision };
  assert.equal(group.status, 'PENDING'); assert.equal(group.updatedBy, actor.actor.id);
  assert.deepEqual(group.feedback, expectedFeedback);
  await f.execute('review.discard', first(group));
  const adopted = (await read(f, source)).groups[0];
  assert.deepEqual(adopted.feedback, expectedFeedback);
  assert.deepEqual(adopted.history[0].feedback, expectedFeedback);
  assert.equal(adopted.legacyProvenance.history.find(entry => entry.proposalVersion === 2).updatedBy, owner.actor.id);
  await check(f);
});

test('changed targets block acceptance but do not stop feedback or replace original proposed content', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation');
  await f.execute('clip.save', { ...clipPayload(f.slice), name: 'A later saved target' });
  const before = await f.studio.readProjectTrusted(projectId), group = (await read(f, source)).groups[0];
  assert.equal(group.eligibility.canAccept, false); assert.notEqual(group.items[0].proposed.name, 'A later saved target');
  await assert.rejects(f.execute('review.accept', first(group, { selectedItemIds: ['item.content'] })));
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  await f.execute('review.feedback.save', first(group, { summary: 'Rebase on the saved target.', itemComments: [] }));
  assert.deepEqual((await f.studio.readProjectTrusted(projectId)).snapshot.clipLibrary.assets, before.snapshot.clipLibrary.assets);
  await check(f);
});

test('first discard preserves content; stale competing adoption fails without a second decision', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation'), group = (await read(f, source)).groups[0];
  const accept = await f.request('review.accept', first(group, { selectedItemIds: ['item.content'] }));
  await f.execute('review.discard', first(group));
  await assert.rejects(f.studio.execute(accept, owner), { code: 'REVISION_CONFLICT' });
  const after = await f.studio.readProjectTrusted(projectId); assert.equal(after.snapshot.clipLibrary.assets.length, 0); await check(f);
});

test('DECIDED and terminal legacy records retain their old path', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'image');
  await f.execute('asset.proposal.decide', { proposalId: source.proposalId, expectedProposalVersion: 1, decisions: [{ itemId: 'item.image', disposition: 'ACCEPTED', reason: null }] });
  source.expectedProposalVersion = 2;
  await assert.rejects(read(f, source), { code: 'LEGACY_REVIEW_UNSUPPORTED' });
  await f.execute('asset.proposal.apply', { proposalId: source.proposalId, expectedProposalVersion: 2 });
  source.expectedProposalVersion = 3; await assert.rejects(read(f, source), { code: 'LEGACY_REVIEW_UNSUPPORTED' });
  await check(f);
});

test('invalid old Image proposals remain unchanged and cannot enter the valid shared Review store', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'image', { metadata: { ...f.payload().metadata, role: null } });
  const before = await f.studio.readProjectTrusted(projectId);
  await assert.rejects(read(f, source), { code: 'LEGACY_REVIEW_CONTENT_INVALID' });
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before); await check(f);
});

test('legacy content resolves its original cut after a newer cut has been committed', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation');
  const original = (await read(f, source)).groups[0];
  await f.cut(f.slice);
  const later = (await read(f, source)).groups[0];
  assert.deepEqual(later.items[0].proposed, original.items[0].proposed);
  assert.equal(later.items[0].resolvedProposed.frameBindings[0].sliceBinding.sliceVersion, 1);
  await f.execute('review.accept', first(later, { selectedItemIds: ['item.content'] })); await check(f);
});

test('first adoption faults roll back the link and acceptance, then backup/restore preserves the frozen legacy history', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation'), group = (await read(f, source)).groups[0];
  const before = await f.studio.readProjectTrusted(projectId);
  for (const point of ['after_review_version', 'after_review_animation_asset', 'after_review_acceptance', 'after_review_head', 'before_transaction_commit']) {
    f.fault(point); await assert.rejects(f.execute('review.accept', first(group, { selectedItemIds: ['item.content'] })), /injected/); f.fault(null);
    assert.deepEqual(await f.studio.readProjectTrusted(projectId), before); await check(f);
  }
  await f.execute('review.feedback.save', first(group, { summary: 'Retain for the next agent round.', itemComments: [] }));
  const saved = await f.studio.readProjectTrusted(projectId), backupDirectory = join(f.root, 'legacy-backup');
  await createWorkspaceBackup({ projectStore: f.store, artifactStore: f.artifacts, destinationDirectory: backupDirectory });
  assert.equal((await verifyWorkspaceBackup(backupDirectory)).ok, true);
  const destination = join(f.root, 'legacy-restored-copy');
  await restoreWorkspaceBackup({ backupDirectory, databaseDestination: join(destination, 'studio.sqlite'), artifactDestination: join(destination, 'artifacts') });
  const store = await SqliteProjectStore.open({ filename: join(destination, 'studio.sqlite'), databaseFactory: nodeSqliteDatabaseFactory });
  try {
    const service = new StudioService({ store }); assert.deepEqual(await service.readProjectTrusted(projectId), saved);
    const restored = await service.queryLegacyReview({ schemaVersion: 1, projectId, legacySource: source, includeHistory: true }, owner);
    assert.equal(restored.groups[0].feedback.summary, 'Retain for the next agent round.');
    const result = await verifyWorkspaceIntegrity({ projectStore: store, artifactStore: new ContentAddressedArtifactStore({ rootDirectory: join(destination, 'artifacts') }) });
    assert.equal(result.ok, true, JSON.stringify(result));
  } finally { store.close(); }
});

test('owner HTTP keeps legacy projections separate from opaque Review IDs and validates first-decision CSRF', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation'), base = await f.http();
  await f.execute('review.proposal.submit', { reviewId: 'legacy', expectedReviewVersion: 0, title: 'Opaque identifier', items: [{ itemId: 'image', contentKind: 'image', payload: f.payload(), dependsOn: [] }] });
  const existing = await (await fetch(`${base}/api/projects/${projectId}/reviews/legacy`)).json(); assert.equal(existing.groups[0].title, 'Opaque identifier');
  const path = `${base}/api/projects/${projectId}/legacy-reviews/animation/${source.proposalId}`;
  const before = await f.studio.readProjectTrusted(projectId);
  const response = await fetch(`${path}?expectedProposalVersion=1&includeHistory=true`); assert.equal(response.status, 200);
  const group = (await response.json()).groups[0]; assert.equal(group.reviewVersion, 0);
  const csrf = (await (await fetch(`${base}/api/ui-session`)).json()).csrfToken;
  const headers = { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': csrf };
  const preview = await fetch(`${path}/preview`, { method: 'POST', headers, body: JSON.stringify({ expectedProposalVersion: 1, selectedItemIds: [] }) });
  assert.equal(preview.status, 200); assert.equal((await preview.json()).groups[0].eligibility.canAccept, false);
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before);
  const body = { expectedReviewVersion: 0, legacySource: source, expectedRevision: before.revision, idempotencyKey: 'http.legacy.feedback', summary: 'Await the agent.', itemComments: [], confirmed: true };
  const feedbackPath = `${base}/api/projects/${projectId}/reviews/${group.reviewId}/feedback`;
  const denied = await fetch(feedbackPath, { method: 'POST', headers: { ...headers, 'x-numberdroid-studio-csrf': '' }, body: JSON.stringify(body) }); assert.equal(denied.status, 403); await denied.arrayBuffer();
  const accepted = await fetch(feedbackPath, { method: 'POST', headers, body: JSON.stringify(body) }); assert.equal(accepted.status, 200, await accepted.clone().text()); await accepted.arrayBuffer();
  const replayed = await (await fetch(feedbackPath, { method: 'POST', headers, body: JSON.stringify(body) })).json(); assert.equal(replayed.replayed, true);
  const adopted = await (await fetch(`${path}?expectedProposalVersion=1`)).json(); assert.equal(adopted.groups[0].legacyAdopted, true); assert.equal(adopted.groups[0].reviewVersion, 1);
  await check(f);
});

test('adoption preserves the original agent and task, requires new Review scope, and blocks old resubmission', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), actor = { actor: { id: 'agent.legacy', kind: 'agent' }, taskId: 'task.legacy', grantId: 'grant.legacy', branchId: 'branch.main' };
  const grant = { agentId: actor.actor.id, taskId: actor.taskId, branchId: actor.branchId, objectScopes: [{ kind: 'project', id: projectId }], budget: { maxCommands: 10, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 } };
  await f.execute('grant.issue', { ...grant, grantId: actor.grantId, scopes: ['project.read', 'clip.proposal.submit'] });
  const content = clipPayload(f.slice), source = { contentKind: 'animation', proposalId: 'proposal.agent.legacy', expectedProposalVersion: 1 };
  await f.execute('clip.proposal.submit', { ...content, proposalId: source.proposalId, expectedProposalVersion: 0 }, actor);
  await assert.rejects(f.studio.queryLegacyReview({ schemaVersion: 1, projectId, legacySource: source }, actor), { code: 'FORBIDDEN' });
  const group = (await read(f, source)).groups[0]; assert.equal(group.proposer.actor.id, actor.actor.id); assert.equal(group.proposer.taskId, actor.taskId);
  await f.execute('review.feedback.save', first(group, { summary: 'Improve the name.', itemComments: [] }));
  await assert.rejects(f.execute('clip.proposal.submit', { ...content, proposalId: source.proposalId, expectedProposalVersion: 1 }, actor), { code: 'LEGACY_PROPOSAL_ADOPTED' });
  const next = { reviewId: group.reviewId, expectedReviewVersion: 1, title: 'Improved animation', items: [{ itemId: 'item.content', contentKind: 'animation', payload: { ...content, name: 'Improved animation' }, dependsOn: [] }] };
  await assert.rejects(f.execute('review.proposal.submit', next, actor));
  await f.execute('grant.issue', { ...grant, grantId: 'grant.review.new', scopes: ['project.read', 'review.proposal.submit'] });
  await f.execute('review.proposal.submit', next, { ...actor, grantId: 'grant.review.new' });
  const revised = (await read(f, source)).groups[0]; assert.equal(revised.reviewVersion, 2); assert.equal(revised.contentVersion, 2);
  assert.deepEqual(revised.legacySource, source); assert.deepEqual(revised.legacyProvenance, group.legacyProvenance);
  await f.execute('review.accept', { reviewId: group.reviewId, expectedReviewVersion: 2, selectedItemIds: ['item.content'], confirmed: true }); await check(f);
});

test('an occupied derived Review ID fails closed without hiding or replacing its unrelated content', { timeout: 120000 }, async context => {
  const f = await assemblyFixture(context), source = await submit(f, 'animation'), group = (await read(f, source)).groups[0];
  await f.execute('review.proposal.submit', { reviewId: group.reviewId, expectedReviewVersion: 0, title: 'Already present', items: [{ itemId: 'image', contentKind: 'image', payload: f.payload(), dependsOn: [] }] });
  const before = await f.studio.readProjectTrusted(projectId);
  await assert.rejects(read(f, source), { code: 'LEGACY_REVIEW_ID_CONFLICT' });
  await assert.rejects(f.execute('review.feedback.save', first(group, { summary: 'Do not overwrite.', itemComments: [] })), { code: 'LEGACY_REVIEW_ID_CONFLICT' });
  assert.deepEqual(await f.studio.readProjectTrusted(projectId), before); await check(f);
});
