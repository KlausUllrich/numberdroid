import test from 'node:test';
import assert from 'node:assert/strict';
import { applyReviewCommand, queryReviewDocument } from '../packages/application/src/review-service.js';
import { invariant } from '../packages/domain/src/errors.js';

const now = '2026-09-11T12:00:00.000Z';
const owner = { kind: 'human', id: 'owner' }, agent = { kind: 'agent', id: 'agent' };
const fixture = () => ({ projectId: 'project.test', revisions: [{ number: 1, committedAt: now, snapshot: { project: { ownerId: 'owner' }, assetLibrary: { assets: [], proposals: [] }, clipLibrary: { assets: [], proposals: [] }, assemblyLibrary: { assets: [], proposals: [] } } }] });
const payload = (assetId, extra = {}) => ({ assetId, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: assetId, kind: 'prop', metadata: { tag: 'initial' }, ...extra });
const image = { itemId: 'item.image', contentKind: 'image', payload: payload('asset.image', { image: { mode: 'saved-slice', sliceId: 'slice.one', expectedSliceVersion: 1 } }), dependsOn: [] };
const assembly = { itemId: 'item.assembly', contentKind: 'assembly', payload: payload('asset.assembly', { assembly: { schemaVersion: 1, components: [{ componentId: 'component.one', asset: { assetId: 'asset.image', assetVersion: 1, metadataVersion: 1 }, variantOverrides: [] }] } }), dependsOn: ['item.image'] };
const keys = { image: 'assetLibrary', animation: 'clipLibrary', assembly: 'assemblyLibrary' };
function adapter({ item, snapshot }) {
  const library = snapshot[keys[item.contentKind]], content = item.payload;
  const old = library.assets.find(record => record.assetId === content.assetId);
  invariant(content.operation === 'create' ? !old : old?.assetVersion === content.expectedAssetVersion && old?.metadataVersion === content.expectedMetadataVersion, 'TARGET_CHANGED', 'Target changed.');
  if (item.contentKind === 'assembly') {
    for (const component of content.assembly.components) invariant(snapshot.assetLibrary.assets.some(record => record.assetId === component.asset.assetId && record.assetVersion === component.asset.assetVersion), 'LEAF_MISSING', 'The exact leaf is unavailable.');
  }
  const record = { assetId: content.assetId, assetVersion: (old?.assetVersion ?? 0) + 1, metadataVersion: 1, name: content.name, kind: content.kind,
    metadata: structuredClone(content.metadata), findings: content.metadata.invalid ? [{ severity: 'ERROR', ruleId: 'invalid' }] : [],
    ...(content.assembly ? { assembly: structuredClone(content.assembly) } : {}), ...(content.clip ? { clip: structuredClone(content.clip) } : {}),
    ...(content.image ? { sliceBinding: { sliceId: content.image.sliceId, sliceVersion: content.image.expectedSliceVersion } } : {}) };
  if (old) library.assets[library.assets.indexOf(old)] = record; else library.assets.push(record);
  return { snapshot, record };
}
function command(document, type, fields, actor = owner) {
  return { type, projectId: document.projectId, baseRevision: document.revisions.at(-1).number, actor, taskId: actor.kind === 'agent' ? 'task.test' : null,
    payload: { reviewId: 'review.test', expectedReviewVersion: document.revisions.at(-1).snapshot.reviewLibrary?.groups[0]?.reviewVersion ?? 0, ...fields } };
}
function run(document, type, fields, actor = owner, applyItem = adapter) {
  const cmd = command(document, type, fields, actor);
  const applied = applyReviewCommand(cmd, structuredClone(document.revisions.at(-1).snapshot), document, now, { applyItem });
  document.revisions.push({ number: cmd.baseRevision + 1, committedAt: now, command: cmd, ...applied });
  return applied;
}
const submit = (document, items = [image, assembly]) => run(document, 'review.proposal.submit', { title: 'Coffee station', items }, agent);
const feedback = (document, summary) => run(document, 'review.feedback.save', { summary, itemComments: [], confirmed: true });
const accept = (document, selectedItemIds) => run(document, 'review.accept', { selectedItemIds, confirmed: true });

test('mixed content is proposed without saving; full accept uses dependency order and one result', () => {
  const document = fixture(); submit(document, [assembly, image]);
  assert.equal(document.revisions.at(-1).snapshot.assetLibrary.assets.length, 0);
  const result = accept(document, ['item.assembly', 'item.image']);
  assert.deepEqual(result.result.accepted.map(pin => pin.itemId), ['item.image', 'item.assembly']);
  assert.equal(result.result.status, 'ACCEPTED');
  assert.deepEqual(result.snapshot.assemblyLibrary.assets[0].review, { reviewId: 'review.test', reviewVersion: 2, itemId: 'item.assembly' });
  assert.equal(result.snapshot.assemblyLibrary.assets[0].proposal, null);
  assert.equal(document.revisions.length, 3);
});
test('partial acceptance leaves dependent work, retains its exact earlier acceptance pin', () => {
  const document = fixture(); submit(document);
  assert.throws(() => accept(document, ['item.assembly']), { code: 'REVIEW_DEPENDENCY_REQUIRED' });
  accept(document, ['item.image']);
  const priorAccepted = structuredClone(document.revisions.at(-1).snapshot.reviewLibrary.groups[0].items[0]);
  feedback(document, 'Move the marker.');
  const revised = structuredClone(assembly); revised.payload.name = 'Revised machine';
  run(document, 'review.proposal.submit', { title: 'Coffee station', items: [revised] }, agent);
  assert.deepEqual(document.revisions.at(-1).snapshot.reviewLibrary.groups[0].items[0], priorAccepted);
  const done = accept(document, ['item.assembly']);
  assert.equal(done.snapshot.assetLibrary.assets[0].assetVersion, 1);
  assert.equal(done.result.status, 'ACCEPTED');
});
test('feedback amendments preserve immutable history and permit reconsideration', () => {
  const document = fixture(); submit(document, [image]);
  feedback(document, 'Make it lighter.'); feedback(document, 'Keep the original; compare first.');
  const group = document.revisions.at(-1).snapshot.reviewLibrary.groups[0];
  assert.equal(group.contentVersion, 1); assert.equal(group.reviewVersion, 3);
  accept(document, ['item.image']);
  const read = queryReviewDocument({ schemaVersion: 1, projectId: document.projectId, reviewId: 'review.test', includeHistory: true }, document, { applyItem: adapter });
  assert.deepEqual(read.groups[0].history.map(version => version.feedback?.summary ?? null), [null, 'Make it lighter.', 'Keep the original; compare first.', 'Keep the original; compare first.']);
  assert.equal(read.groups[0].feedback.summary, 'Keep the original; compare first.');
  assert.equal(read.groups[0].nextActor, null);
});
test('an old viewed revision remains inspectable but cannot receive feedback or acceptance', () => {
  const document = fixture(); submit(document, [image]); feedback(document, 'Revise.');
  const revised = structuredClone(image); revised.payload.name = 'New content';
  run(document, 'review.proposal.submit', { title: 'Returned work', items: [revised] }, agent);
  const snapshot = document.revisions.at(-1).snapshot;
  const stale = command(document, 'review.feedback.save', { expectedReviewVersion: 1, summary: 'Old draft', itemComments: [], confirmed: true });
  assert.throws(() => applyReviewCommand(stale, structuredClone(snapshot), document, now, { applyItem: adapter }), { code: 'REVIEW_VERSION_CONFLICT' });
  const read = queryReviewDocument({ schemaVersion: 1, projectId: document.projectId, reviewId: 'review.test', reviewVersion: 1 }, document, { applyItem: adapter });
  assert.equal(read.groups[0].items[0].proposed.name, 'asset.image');
  assert.equal(read.groups[0].isLatest, false); assert.equal(read.groups[0].eligibility.canAccept, false);
  assert.equal(snapshot.reviewLibrary.groups[0].contentVersion, 2);
});
test('target conflicts block content acceptance while actionable feedback remains possible', () => {
  const document = fixture(); submit(document, [image]);
  document.revisions.at(-1).snapshot.assetLibrary.assets.push({ assetId: 'asset.image', assetVersion: 1, metadataVersion: 1 });
  assert.throws(() => accept(document, ['item.image']), { code: 'TARGET_CHANGED' });
  feedback(document, 'Rebase against my new saved asset.');
  assert.equal(document.revisions.at(-1).snapshot.reviewLibrary.groups[0].status, 'CHANGES_REQUESTED');
});
test('late typed failure leaves supplied snapshot and immutable review wholly unchanged', () => {
  const document = fixture(); submit(document);
  const snapshot = structuredClone(document.revisions.at(-1).snapshot), before = structuredClone(snapshot);
  const applyItem = args => { if (args.item.contentKind === 'assembly') throw Object.assign(new Error('Unavailable'), { code: 'TEST_FAILURE' }); return adapter(args); };
  assert.throws(() => applyReviewCommand(command(document, 'review.accept', { selectedItemIds: ['item.image', 'item.assembly'], confirmed: true }), snapshot, document, now, { applyItem }), { code: 'TEST_FAILURE' });
  assert.deepEqual(snapshot, before);
});
test('accepted items cannot be resubmitted, commented on or accepted again', () => {
  const document = fixture(); submit(document); accept(document, ['item.image']); feedback(document, 'Revise remaining.');
  assert.throws(() => submit(document), { code: 'REVIEW_ACCEPTED_IMMUTABLE' });
  assert.throws(() => run(document, 'review.feedback.save', { summary: 'Wrong item', itemComments: [{ itemId: 'item.image', text: 'No' }], confirmed: true }), { code: 'REVIEW_FEEDBACK_ITEM' });
  assert.throws(() => accept(document, ['item.image']), { code: 'REVIEW_SELECTION_INVALID' });
});
test('discard affects only remaining work and closed decisions cannot be edited', () => {
  const document = fixture(); submit(document); accept(document, ['item.image']);
  const result = run(document, 'review.discard', { confirmed: true });
  assert.deepEqual(result.snapshot.reviewLibrary.groups[0].items.map(item => item.status), ['ACCEPTED', 'DISCARDED']);
  assert.equal(result.snapshot.assetLibrary.assets.length, 1);
  assert.throws(() => feedback(document, 'Rewrite'), { code: 'REVIEW_CLOSED' });
});
test('technical errors, undeclared references, cycles and duplicate targets fail before publication', () => {
  const invalid = structuredClone(image); invalid.payload.metadata.invalid = true;
  assert.throws(() => submit(fixture(), [invalid]), { code: 'REVIEW_CONTENT_INVALID' });
  const undeclared = structuredClone(assembly); undeclared.dependsOn = [];
  assert.throws(() => submit(fixture(), [image, undeclared]), { code: 'REVIEW_DEPENDENCY_UNDECLARED' });
  const cycle = structuredClone(image); cycle.dependsOn = ['item.assembly'];
  assert.throws(() => submit(fixture(), [cycle, assembly]), { code: 'REVIEW_DEPENDENCY_CYCLE' });
  const duplicate = { ...structuredClone(image), itemId: 'item.other' };
  assert.throws(() => submit(fixture(), [image, duplicate]), { code: 'REVIEW_DUPLICATE_TARGET' });
});
test('owner decisions and original author revisions remain distinct authority boundaries', () => {
  const document = fixture(); submit(document, [image]);
  assert.throws(() => run(document, 'review.accept', { selectedItemIds: ['item.image'], confirmed: true }, agent), { code: 'FORBIDDEN' });
  feedback(document, 'Revise');
  assert.throws(() => run(document, 'review.proposal.submit', { title: 'Stolen', items: [image] }, { kind: 'agent', id: 'other' }), { code: 'FORBIDDEN' });
});
test('query is read-only and reports unavailable inspection without losing other content', () => {
  const document = fixture(); submit(document);
  const before = structuredClone(document);
  const response = queryReviewDocument({ schemaVersion: 1, projectId: document.projectId, reviewId: 'review.test' }, document, {
    applyItem: adapter, resolveItem: ({ item, record }) => { if (item.contentKind === 'assembly') throw Object.assign(new Error('Missing exact component'), { code: 'COMPONENT_MISSING' }); return record; },
  });
  assert.equal(response.groups[0].items[0].resolvedProposed.assetId, 'asset.image');
  assert.equal(response.groups[0].items[1].conflicts[0].code, 'COMPONENT_MISSING');
  assert.equal(response.groups[0].eligibility.canAccept, false);
  assert.deepEqual(document, before);
});
test('historical current and accepted records retain their exact pins when a newer saved head exists', () => {
  const document = fixture();
  document.revisions[0].snapshot.assetLibrary.assets.push({ assetId: 'asset.image', assetVersion: 1, metadataVersion: 1, name: 'Before review' });
  const update = structuredClone(image); Object.assign(update.payload, { operation: 'update', expectedAssetVersion: 1, expectedMetadataVersion: 1, name: 'Accepted name' });
  submit(document, [update]); accept(document, ['item.image']);
  const snapshot = structuredClone(document.revisions.at(-1).snapshot);
  Object.assign(snapshot.assetLibrary.assets[0], { assetVersion: 3, name: 'Later human edit' });
  document.revisions.push({ number: 4, committedAt: now, snapshot });
  const read = queryReviewDocument({ schemaVersion: 1, projectId: document.projectId, reviewId: 'review.test' }, document);
  const item = read.groups[0].items[0];
  assert.equal(item.current.name, 'Before review'); assert.equal(item.current.assetVersion, 1);
  assert.equal(item.currentTarget.name, 'Later human edit'); assert.equal(item.currentTarget.assetVersion, 3);
  assert.equal(item.acceptedRecord.name, 'Accepted name'); assert.equal(item.acceptedRecord.assetVersion, 2);
  assert.equal(item.proposedIsSaved, false);
});
test('shared creation cannot reuse a legacy or other content-kind identity', () => {
  const legacy = fixture(); legacy.revisions[0].snapshot.assets = [{ id: 'asset.image' }];
  assert.throws(() => submit(legacy, [image]), { code: 'REVIEW_TARGET_EXISTS' });
  const otherKind = fixture(); otherKind.revisions[0].snapshot.clipLibrary.assets.push({ assetId: 'asset.image' });
  assert.throws(() => submit(otherKind, [image]), { code: 'REVIEW_TARGET_EXISTS' });
});
