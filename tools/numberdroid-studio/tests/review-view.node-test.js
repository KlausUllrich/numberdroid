import assert from 'node:assert/strict';
import test from 'node:test';
import { renderReviewView, reviewPreviewRecord, reviewStatusLabel } from '../apps/studio-server/public/review-view.js';
import { renderActivityRows } from '../apps/studio-server/public/activity-view.js';

class Element {
  constructor(tag) { this.tagName = tag; this.dataset = {}; this.children = []; this.attributes = {}; this.style = {}; this.listeners = {}; this.classList = { add: name => { this.className += ` ${name}`; }, toggle() {} }; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  prepend(...nodes) { for (const node of nodes.reverse()) { node.parentNode = this; this.children.unshift(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  matches(selector) { return selector === this.tagName; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
}
function harness(t) { const prior = globalThis.document; globalThis.document = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) }; t.after(() => { globalThis.document = prior; }); }
const all = node => [node, ...node.children.flatMap(all)];
const find = (node, key, value) => all(node).find(child => child.dataset[key] === value);
const strings = node => all(node).map(child => child.textContent ?? '').join('\n');
const binding = { projectId: 'project.review', sliceId: 'slice.cut', sliceVersion: 1, digest: 'a'.repeat(64), width: 32, height: 96, mediaType: 'image/png' };
function source() {
  const record = { assetId: 'asset.light', assetVersion: 1, metadataVersion: 1, name: 'Ready <light>', kind: 'prop', sliceBinding: binding };
  const item = { itemId: 'item.light', contentKind: 'image', payload: { operation: 'create', name: record.name }, proposed: record, resolvedProposed: record, current: null, resolvedCurrent: null, dependsOn: [], status: 'PENDING' };
  const group = { reviewId: 'review.station', reviewVersion: 2, contentVersion: 1, title: 'Station changes', proposer: { actor: { id: 'agent.artist', kind: 'agent' } }, status: 'CHANGES_REQUESTED', nextActor: { kind: 'agent' }, items: [item], feedback: { summary: 'A smaller light.', reviewVersion: 2, itemComments: [] }, selectionOutcome: { state: 'READY', selectedItemIds: [item.itemId], items: [{ itemId: item.itemId, selected: true, record, resolved: record }] } };
  return { group, projectId: 'project.review', projectRevision: 7, selectedItemIds: [item.itemId], activeItemId: item.itemId, side: 'proposed', selection: {}, feedback: { editing: false, draftSummary: '', draftItemComments: {} }, phase: 'idle', canMutate: true };
}
const gates = { canAccept: true, canEditFeedback: true, canFeedback: true, canDiscard: true, canInspect: true, locked: false };

test('Selected result never substitutes the full prospective creation when it is unselected or unresolved', () => {
  const state = source(), item = state.group.items[0];
  assert.equal(reviewPreviewRecord(state).record, item.resolvedProposed);
  state.selectedItemIds = []; state.group.selectionOutcome = { state: 'READY', selectedItemIds: [], items: [{ itemId: item.itemId, selected: false, record: null, resolved: null }] };
  assert.equal(reviewPreviewRecord(state).record, null); assert.match(reviewPreviewRecord(state).message, /contributes nothing/);
  state.group.selectionOutcome.state = 'UNAVAILABLE'; assert.equal(reviewPreviewRecord(state).record, null);
  assert.equal(reviewPreviewRecord(state, 'current').record, null);
});

test('A late selection preview cannot display the previously selected result', () => {
  const state = source(); state.selectedItemIds = [];
  assert.equal(reviewPreviewRecord(state).record, null); assert.match(reviewPreviewRecord(state).message, /Checking/);
});

test('Next actor distinguishes owner feedback for agent and human proposers', () => {
  const state = source(); assert.equal(reviewStatusLabel(state.group), 'Awaiting agent');
  state.group.proposer.actor.kind = 'human'; state.group.nextActor.kind = 'human'; assert.equal(reviewStatusLabel(state.group), 'Changes requested');
});

test('Saved feedback stays visible, editing and reconsidered acceptance remain separate', t => {
  harness(t); const state = source(), actions = []; const element = renderReviewView({ state, view: gates, onAction: action => actions.push(action) });
  assert.match(strings(element), /A smaller light/); assert.equal(find(element, 'reviewAction', 'accept').disabled, false);
  find(element, 'reviewAction', 'edit-feedback').listeners.click(); assert.deepEqual(actions, ['edit-feedback']);
  assert.equal(all(element).some(node => Object.hasOwn(node, 'innerHTML')), false);
});

test('A feedback draft has per-item inputs and exact Details detours without any accept button', t => {
  harness(t); const state = source(), inputs = [], details = []; state.feedback.editing = true; state.feedback.draftSummary = 'New unsent words'; state.feedback.draftItemComments['item.light'] = 'Keep its shape.';
  const element = renderReviewView({ state, view: { ...gates, canAccept: false }, onInput: (...args) => inputs.push(args), onDetails: value => details.push(value) });
  assert.equal(find(element, 'reviewAction', 'accept'), undefined); assert.equal(find(element, 'reviewInput', 'summary').value, 'New unsent words');
  const comment = find(element, 'reviewItemComment', 'item.light'); assert.equal(comment.value, 'Keep its shape.'); comment.value = 'Move it left.'; comment.listeners.input(); assert.deepEqual(inputs, [['comment', 'Move it left.', 'item.light']]);
  find(element, 'reviewFocus', 'preview-details:proposed').listeners.click(); assert.deepEqual(details, [{ itemId: 'item.light', side: 'proposed' }]);
  assert.ok(find(element, 'reviewDisclosure', 'comment:item.light')); assert.ok(find(element, 'reviewScroll', 'panel'));
});

test('Read-only historical feedback exposes no mutable decision controls', t => {
  harness(t); const state = source(); state.readOnly = true;
  const element = renderReviewView({ state, view: { ...gates, canAccept: false, canEditFeedback: false, canDiscard: false } });
  for (const action of ['accept', 'request-changes', 'edit-feedback', 'discard']) assert.equal(find(element, 'reviewAction', action), undefined);
  assert.match(strings(element), /read-only/); assert.match(strings(element), /A smaller light/);
});

test('Newer content has an explicit action and the old draft cannot masquerade as saved feedback', t => {
  harness(t); const state = source(); state.feedback.olderDraft = { summary: 'Old <draft>', itemComments: {}, contentVersion: 1, reviewVersion: 2 };
  const element = renderReviewView({ state, view: { ...gates, stale: 'content', canAdoptLatest: true, canAccept: false, canEditFeedback: false } });
  assert.match(find(element, 'reviewAction', 'review-latest').textContent, /latest version/); assert.equal(find(element, 'reviewAction', 'accept').disabled, true);
  assert.equal(find(element, 'reviewAction', 'copy-older-draft').disabled, true); assert.match(strings(element), /Not sent/); assert.match(strings(element), /Old <draft>/);
});

test('Activity uses exact historical names, sorted rows, safe text and distinct current-review links', t => {
  harness(t); const calls = [], events = [
    { id: 'old', revision: 3, occurredAt: '2026-09-11T10:00:00Z', summary: 'old raw', presentation: { title: 'Changes requested for Old name', summary: 'Nothing accepted.', actorLabel: 'You', feedback: { summary: '<img src=x>', itemComments: [{ name: 'Old component', comment: 'Keep it.' }] }, inspect: { type: 'review', reviewId: 'review.one', reviewVersion: 2 }, currentReview: { reviewId: 'review.one', reviewVersion: 4 } } },
    { id: 'new', revision: 4, occurredAt: '2026-09-11T11:00:00Z', summary: 'Agent command failed: CUT_NOT_FOUND', commandType: 'review.proposal.submit', actor: { id: 'agent.artist' } },
  ];
  const root = renderActivityRows({ events, onInspect: (...args) => calls.push(args) });
  assert.equal(root.children[0].dataset.activityEvent, 'new'); assert.match(strings(root), /Old name/); assert.match(strings(root), /<img src=x>/); assert.equal(root.querySelectorAll('img').length, 0);
  find(root, 'activityInspect', 'old').listeners.click(); find(root, 'activityCurrentReview', 'review.one').listeners.click(); assert.deepEqual(calls, [[events[0], { current: false }], [events[0], { current: true }]]);
  assert.equal(root.children.length, 2); assert.equal(find(root, 'activityInspect', 'new'), undefined);
});

test('Animation playback uses exact frame occurrences and retains elapsed time across view replacement', t => {
  harness(t); const oldRaf = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame;
  const frames = new Map(); let sequence = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  t.after(() => { globalThis.requestAnimationFrame = oldRaf; globalThis.cancelAnimationFrame = oldCancel; });
  const state = source(), record = { ...state.group.items[0].proposed, contentKind:'animation', clip: { fps:10, playbackMode:'loop', canvas:{width:32,height:96}, frames:[
    {frameId:'frame.one',name:'First',slice:{sliceId:'slice.cut',sliceVersion:1},offset:{x:0,y:0},durationMs:100},
    {frameId:'frame.two',name:'Second',slice:{sliceId:'slice.cut',sliceVersion:1},offset:{x:2,y:3},durationMs:200},
  ] }, frameBindings:[{frameId:'frame.one',sliceBinding:binding},{frameId:'frame.two',sliceBinding:binding}] };
  Object.assign(state.group.items[0],{contentKind:'animation',proposed:record,resolvedProposed:record}); Object.assign(state.group.selectionOutcome.items[0],{record,resolved:record});
  const root = renderReviewView({state,view:gates}); root.isConnected=true; find(root,'reviewPlay','').listeners.click();
  const tick = time => { const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(time)); };
  tick(1000);tick(1150); assert.equal(find(root,'reviewFrame','frame.two').tagName,'svg');
  root.dispose(); assert.equal(frames.size,0);
  const next = renderReviewView({state,view:gates}); next.isConnected=true;
  assert.equal(find(next,'reviewFrame','frame.two').tagName,'svg'); assert.equal(find(next,'reviewPlay','').textContent,'Pause preview');
  next.dispose(); assert.equal(frames.size,0);
});

test('Shared Assembly review preserves exact human-readable movement and resolved source names', async t => {
  harness(t); const { reviewItemChanges } = await import('../apps/studio-server/public/review-view.js');
  const state = source(), base = { assetId:'assembly.station',name:'Coffee station',kind:'prop',metadata:{role:'station',tags:[]},assembly:{schemaVersion:1,coordinateSpace:'assembly-pixels',unitsPerPixel:1/64,placementBounds:{x:0,y:0,width:64,height:128},anchor:{x:0,y:0},states:[{stateId:'idle',name:'Idle'}],variants:[{variantId:'base',name:'Base'}],defaultStateId:'idle',defaultVariantId:'base',blocking:{mode:'components',regions:[]},components:[{componentId:'display',name:'Status display',asset:{assetId:'asset.old',assetVersion:1,metadataVersion:1},position:{x:0,y:-58},rotationDegrees:0,scale:1,stateIds:null,variantOverrides:[]}]} };
  const next=structuredClone(base);next.assembly.components[0].position.y=-62;
  const item={...state.group.items[0],contentKind:'assembly',payload:{operation:'update'},current:base,proposed:next,resolvedCurrent:null,resolvedProposed:null};state.group.items=[item];state.group.selectionOutcome.state='UNAVAILABLE';
  const before=structuredClone(item),summary=reviewItemChanges(item);assert.equal(summary.changes[0].label,'Status display moves 4 px upward');assert.match(summary.changes[0].detail,/Y -58 px → X 0, Y -62 px/);assert.deepEqual(item,before);
  let root=renderReviewView({state,view:gates});assert.match(strings(root),/Status display moves 4 px upward/);assert.match(strings(root),/Placement area unchanged/);
  next.assembly.components[0].asset={assetId:'asset.new',assetVersion:2,metadataVersion:1};item.resolvedCurrent={leafAssets:[{assetId:'asset.old',assetVersion:1,metadataVersion:1,name:'Original display'}]};item.resolvedProposed={leafAssets:[{assetId:'asset.new',assetVersion:2,metadataVersion:1,name:'Brighter display'}]};
  const changed=reviewItemChanges(item).changes.find(change=>change.label.includes('different source'));assert.match(changed.detail,/Original display.*Brighter display/);
});

test('Shared Animation review shows the named exact timing change, preserving all extra changes in disclosure', t => {
  harness(t);const state=source(),clip={fps:10,playbackMode:'loop',canvas:{width:32,height:96},anchor:{x:0,y:0},unitsPerPixel:1/64,frames:[{frameId:'crest',name:'Crest hold',slice:{sliceId:'slice.cut',sliceVersion:1},offset:{x:0,y:0},durationMs:300}]};
  const current={assetId:'clip.brewing',name:'Brewing display',kind:'prop',metadata:{role:'display',tags:[]},clip},next=structuredClone(current);next.clip.frames[0].durationMs=750;
  const item={...state.group.items[0],contentKind:'animation',payload:{operation:'update'},current,proposed:next,resolvedCurrent:null,resolvedProposed:null};state.group.items=[item];state.group.selectionOutcome.state='UNAVAILABLE';
  let root=renderReviewView({state,view:gates});assert.match(strings(root),/“Crest hold” duration: 300 ms → 750 ms/);assert.equal(find(root,'reviewDisclosure','changes:item.light'),undefined);
  next.name='Updated brewing';next.kind='effect';next.clip.fps=20;next.clip.playbackMode='pingpong';
  root=renderReviewView({state,view:gates});const more=find(root,'reviewDisclosure','changes:item.light');assert.ok(more);assert.match(strings(more),/Ping-pong/);assert.match(strings(more),/300 ms → 750 ms/);assert.equal(more.open,undefined,'The additional multiline differences start collapsed');
});

test('Assembly review fits the same visible artwork union on both sides instead of invisible placement extents', async () => {
  const { reviewComparisonBounds } = await import('../apps/studio-server/public/review-view.js');
  const current={scene:{visualBounds:{x:-32,y:-96,width:64,height:96}}},proposed={scene:{visualBounds:{x:-32,y:-100,width:64,height:100}}};
  const item={contentKind:'assembly',resolvedCurrent:current,resolvedProposed:proposed},descriptor={bounds:{x:-445,y:-445,width:890,height:890}};
  const args={item,projectId:'project.review',descriptor};
  assert.deepEqual(reviewComparisonBounds({...args,record:current}),{x:-40,y:-108,width:80,height:116});
  assert.deepEqual(reviewComparisonBounds({...args,record:proposed}),reviewComparisonBounds({...args,record:current}));
  const selectedOutcome={scene:{visualBounds:{x:-60,y:-120,width:130,height:180}}};
  const bounds=reviewComparisonBounds({...args,record:selectedOutcome});
  for(const value of[current,proposed,selectedOutcome]){const visible=value.scene.visualBounds;assert.ok(bounds.x<=visible.x&&bounds.y<=visible.y);assert.ok(bounds.x+bounds.width>=visible.x+visible.width&&bounds.y+bounds.height>=visible.y+visible.height);}
});

test('An Assembly with no visible artwork retains a finite safe frame', async () => {
  const { reviewComparisonBounds } = await import('../apps/studio-server/public/review-view.js');
  const record={scene:{visualBounds:null}},bounds=reviewComparisonBounds({item:{contentKind:'assembly'},record,projectId:'project.review',descriptor:{bounds:{x:0,y:0,width:64,height:96}}});
  assert.ok(Object.values(bounds).every(Number.isFinite));assert.ok(bounds.width>=64&&bounds.height>=96);
});

test('Historical proposal artwork remains exact after current target changes make acceptance outcome unavailable', t => {
  harness(t); const state = source(), item = state.group.items[0], original = item.resolvedProposed;
  const current = {...structuredClone(original),assetVersion:2,name:'Current name',sliceBinding:{...binding,digest:'b'.repeat(64)}};
  item.currentTarget = current; item.conflicts = [{code:'REVIEW_TARGET_CHANGED',message:'The saved target changed after this proposal was prepared.'}];
  state.group.isLatest = false; state.group.latestReviewVersion = 5;
  state.group.selectionOutcome = {basisRevision:12,selectedItemIds:state.selectedItemIds,state:'UNAVAILABLE',items:[],findings:[]};
  state.group.eligibility = {canAccept:false,findings:[{code:'REVIEW_VERSION_CONFLICT',message:'Review latest.'}]};
  assert.equal(reviewPreviewRecord(state).record,null,'The live decision view must still respect unavailable acceptance outcome');
  state.readOnly=true; state.phase='uncertain';
  const before=structuredClone(state),root=renderReviewView({state,view:{...gates,canAccept:false,canDiscard:false,canEditFeedback:false}});
  const canvas=find(root,'reviewCanvas','');assert.equal(canvas.dataset.reviewPreviewState,'ready');
  assert.match(canvas.querySelectorAll('image')[0].getAttribute('href'),new RegExp(binding.digest+'$'));
  assert.equal(canvas.querySelectorAll('image').some(image=>image.getAttribute('href').includes(current.sliceBinding.digest)),false);
  assert.match(canvas.querySelectorAll('svg')[0].getAttribute('aria-label'),/recorded proposed content/);
  for(const action of['accept','save-feedback','request-changes','edit-feedback','discard','retry'])assert.equal(find(root,'reviewAction',action),undefined);
  assert.match(strings(root),/content recorded in this event/);assert.deepEqual(state,before);
  item.resolvedProposed=null;assert.equal(reviewPreviewRecord(state).record,null,'Missing historical artwork must not fall back to the current head');
});

test('An initial read failure offers a safe retry instead of an endless loading state', t => {
  harness(t); const state=source(),actions=[];state.group=null;state.load='unavailable';state.error='The local service could not be reached.';
  let root=renderReviewView({state,view:{},onAction:(...args)=>actions.push(args)});
  assert.match(strings(root),/Review unavailable/);assert.doesNotMatch(strings(root),/Loading review/);
  const retry=find(root,'reviewAction','recheck');assert.equal(retry.textContent,'Retry read');assert.equal(retry.disabled,false);retry.listeners.click();assert.deepEqual(actions,[['recheck',undefined]]);
  assert.equal(find(root,'reviewAction','retry'),undefined,'Read recovery cannot retry a mutation');
  state.load='loading';state.phase='loading';root=renderReviewView({state,view:{}});assert.equal(find(root,'reviewAction','recheck').disabled,true);
});

test('A changed legacy proposal uses neutral explicit adoption and keeps its original draft version', t => {
  harness(t);const state=source();state.group.reviewVersion=0;state.group.legacySource={proposalId:'proposal.legacy',expectedProposalVersion:3};state.feedback.olderDraft={summary:'Original draft',itemComments:{},reviewVersion:0,contentVersion:1,legacySource:{proposalId:'proposal.legacy',expectedProposalVersion:2}};
  const root=renderReviewView({state,view:{...gates,stale:'legacy',canAdoptLatest:true,canAccept:false,canEditFeedback:false}});
  assert.equal(find(root,'reviewAction','review-latest').textContent,'Review latest proposal →');assert.match(strings(root),/original proposal changed/i);assert.match(strings(root),/Original proposal version 2/);assert.doesNotMatch(strings(root),/Content 1 · Review 0/);assert.doesNotMatch(strings(root),/newer content|new pixels|latest saved decision/i);
});


test('A legacy source changed before the first read has a distinct latest-proposal recovery action', t => {
  harness(t);const state=source(),actions=[];state.group=null;state.load='unavailable';state.error='The original proposal changed.';
  const root=renderReviewView({state,view:{stale:'legacy',canAdoptLatest:true},onAction:action=>actions.push(action)});
  assert.ok(find(root,'reviewAction','recheck'));const latest=find(root,'reviewAction','review-latest');assert.equal(latest.textContent,'Review latest proposal →');latest.listeners.click();assert.deepEqual(actions,['review-latest']);
  for(const action of['accept','request-changes','save-feedback','retry'])assert.equal(find(root,'reviewAction',action),undefined);
});

test('An older historical Review is an immutable record, not a stale decision requiring adoption', t => {
  harness(t);const state=source();state.readOnly=true;state.group.reviewVersion=3;state.group.latestReviewVersion=7;state.group.isLatest=false;
  const view={...gates,stale:'review',message:'Feedback or the decision changed. Review the latest saved version before deciding.',canAdoptLatest:false};
  const before=structuredClone(state);let root=renderReviewView({state,view}),notice=find(root,'reviewMessage','');
  assert.match(strings(notice),/recorded review is read-only/);assert.doesNotMatch(strings(notice),/latest saved version|decision changed/);assert.equal(notice.className.includes('warning'),false);assert.equal(find(root,'reviewAction','review-latest'),undefined);assert.equal(root.dataset.reviewVersion,'3');assert.deepEqual(state,before);
  state.error='The exact recorded preview could not be read.';root=renderReviewView({state,view});notice=find(root,'reviewMessage','');
  assert.match(strings(notice),/exact recorded preview could not be read/);assert.equal(notice.className.includes('warning'),true);assert.equal(find(root,'reviewAction','review-latest'),undefined,'Read recovery never replaces the historical pin with latest');
  state.error=null;state.readOnly=false;root=renderReviewView({state,view:{...view,canAdoptLatest:true}});notice=find(root,'reviewMessage','');assert.equal(notice.className.includes('warning'),true);assert.match(strings(notice),/latest saved version/);assert.ok(find(root,'reviewAction','review-latest'),'Live review still offers explicit latest-version reconciliation');
});
