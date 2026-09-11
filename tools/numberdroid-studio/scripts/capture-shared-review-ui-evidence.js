import assert from 'node:assert/strict';
import { SHARED_REVIEW_UI_PROJECT as projectId, SHARED_REVIEW_UI_ID as reviewId } from './prepare-shared-review-ui-fixture.js';

/** Actual owner UI with fresh synthetic content; semantic-agent proof is a separate gate. */
export async function captureSharedReviewUi({ devtools, sessionId, captureCheckpoint = async () => {}, reviseProposal }) {
  const evaluate = async expression => { const response = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); assert.equal(response.exceptionDetails, undefined, JSON.stringify(response.exceptionDetails)); return response.result?.value; };
  const settle = () => evaluate('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))');
  const waitFor = async (expression, label) => { const deadline = Date.now() + 12000; while (Date.now() < deadline) { if (await evaluate(expression)) { await settle(); return; } await new Promise(done => setTimeout(done, 60)); } throw new Error(`${label}: ${await evaluate('document.body.innerText.slice(-6500)')}`); };
  const click = async (selector, preserveFocus = false) => {
    if (preserveFocus) await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});n.click()})()`);
    else {
      const point = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw Error('Unavailable '+${JSON.stringify(selector)});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
    }
    await settle();
  };
  const action = name => `[data-review-action="${name}"]`;
  const groupRoute = `[data-library-action="review"][data-library-proposal-id="${reviewId}"]`;
  const project = () => evaluate(`fetch('/api/projects/${projectId}').then(r=>{if(!r.ok)throw Error('Project read');return r.json()})`);
  const previewPresentation = () => evaluate(`(()=>{const canvas=document.querySelector('[data-review-canvas]'),svg=canvas?.querySelector('svg');return{state:canvas?.dataset.reviewPreviewState,viewBox:svg?.getAttribute('viewBox'),images:[...canvas.querySelectorAll('image')].map(n=>{const transforms=[];for(let parent=n;parent&&parent!==svg;parent=parent.parentElement)if(parent.hasAttribute('transform'))transforms.push(parent.getAttribute('transform'));return{href:n.getAttribute('href'),x:n.getAttribute('x'),y:n.getAttribute('y'),width:n.getAttribute('width'),height:n.getAttribute('height'),transforms}})}})()`);
  const group = async () => (await project()).snapshot.reviewLibrary.groups.find(item => item.reviewId === reviewId);
  const version = async expected => waitFor(`document.querySelector('[data-review-workspace]')?.dataset.reviewVersion==='${expected}'&&document.querySelector('.shared-review-controller')?.dataset.reviewPhase==='idle'`, `Review ${expected}`);
  const summary = async value => { await evaluate(`(()=>{const n=document.querySelector('[data-review-input="summary"]');if(!n)throw Error('Missing feedback editor');n.focus({preventScroll:true});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle(); };
  const selected = async (id, checked) => { if (await evaluate(`document.querySelector('[data-review-select="${id}"]')?.checked!==${checked}`)) await click(`[data-review-select="${id}"]`); await waitFor("document.querySelector('.shared-review-controller')?.dataset.reviewPhase==='idle'", 'Selection check'); };
  const result = { schemaVersion: 1, projectId, reviewId, fixtureOnly: true, nativeInput: true, contextProbe: 'Programmatic Details activation preserves the initiating textarea focus; other primary actions use native pointer input.', realAgentProof: 'Required separately; this capture uses authorized fixture commands.' };
  await waitFor("document.getElementById('connection-label')?.textContent==='Live'", 'Live owner workspace');
  const before = await project();
  await click('[data-library-action="tab"][data-library-tab="pending"]'); await click(groupRoute); await version(1);
  assert.equal(await evaluate("document.querySelectorAll('[data-review-item]').length"), 3);
  await waitFor("document.querySelector('[data-review-canvas]')?.dataset.reviewPreviewState==='ready'", 'Original proposed Assembly artwork');
  const originalPresentation = await previewPresentation();
  assert(originalPresentation.images.length >= 2, 'Historical baseline must contain the original composed artwork, not a placeholder');
  assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
  await selected('assembly', false); await selected('animation', false);
  assert.equal(await evaluate("document.querySelector('[data-review-canvas] svg')!==null"), false, 'Unselected new Assembly must not leak into the selected result');
  assert.match(await evaluate("document.querySelector('[data-review-canvas]').textContent"), /not selected/);
  await selected('image', false);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(action('accept'))}).disabled`), true, 'Empty selection cannot accept');
  await selected('image', true); await selected('animation', true);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(action('accept'))}).disabled`), false, 'Independent leaf subset is eligible');
  await click('[data-review-focus="item:animation"]');
  await waitFor("document.querySelector('[data-review-canvas]').dataset.reviewPreviewState==='ready'", 'Exact selected animation preview');
  const frameBefore = await evaluate("document.querySelector('[data-review-canvas] svg').dataset.reviewFrame");
  await click('[data-review-play]');
  await waitFor(`document.querySelector('[data-review-canvas] svg').dataset.reviewFrame!==${JSON.stringify(frameBefore)}`, 'Real animation playback frame change');
  await click('[data-review-play]');
  await click('[data-review-focus="item:assembly"]');
  result.animationPlayback = true;
  assert.deepEqual(await project(), before, 'Selection reads save nothing'); result.selectionOnlyPreview = true;
  await captureCheckpoint('selected-subset');

  const viewportWidth = await evaluate('innerWidth');
  await devtools.send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: 650, deviceScaleFactor: 1, mobile: false }, sessionId); await settle();
  await click(action('request-changes')); const draft = 'Keep the compact body. Hold the brewing crest a little longer.'; await summary(draft);
  const canvasBounds = () => evaluate("(()=>{const r=document.querySelector('[data-review-canvas]').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}})()");
  const validCanvas = await canvasBounds(); await summary(''); assert.deepEqual(await canvasBounds(), validCanvas, 'Feedback validation must not move the preview canvas'); await summary(draft);
  result.feedbackValidationKeepsCanvasStable = true;
  await evaluate(`(()=>{for(const n of document.querySelectorAll('[data-review-disclosure]'))n.open=true;const panel=document.querySelector('[data-review-scroll="panel"]');panel.scrollTop=panel.scrollHeight;window.scrollTo(0,Math.min(220,document.documentElement.scrollHeight-innerHeight));const n=document.querySelector('[data-review-input="summary"]');n.focus({preventScroll:true});n.setSelectionRange(5,17);})()`); await settle();
  const context = () => evaluate(`({draft:document.querySelector('[data-review-input="summary"]')?.value,focus:document.activeElement?.dataset.reviewFocus,selection:[document.activeElement?.selectionStart,document.activeElement?.selectionEnd],page:scrollY,panel:document.querySelector('[data-review-scroll="panel"]')?.scrollTop,disclosures:[...document.querySelectorAll('[data-review-disclosure]')].map(n=>[n.dataset.reviewDisclosure,n.open])})`);
  const origin = await context(); assert(origin.page > 0 && origin.panel > 0, `Context proof needs two real scroll positions: ${JSON.stringify(origin)}`);
  await click('[data-review-details="proposed"]', true);
  await waitFor("Boolean(document.querySelector('[data-library-detail]'))", 'Proposed exact details');
  await click('[data-library-action="back"]'); await version(1);
  assert.deepEqual(await context(), origin, 'Details return preserves raw draft, initiating focus/caret, disclosures and both scroll positions');
  result.detailContext = origin; await captureCheckpoint('feedback-return');
  await devtools.send('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId); await settle();
  await click(action('save-feedback')); await version(2);
  assert.equal((await group()).feedback.summary, draft); assert.equal((await group()).status, 'CHANGES_REQUESTED');
  await click('[data-library-action="back"]'); await waitFor(`Boolean(document.querySelector(${JSON.stringify(groupRoute)}))`, 'Pending group after feedback');
  assert.match(await evaluate(`document.querySelector(${JSON.stringify(groupRoute)}).closest('[data-library-group]').textContent`), /Awaiting agent/);
  await click(groupRoute); await version(2);
  await click(action('edit-feedback')); const amended = 'Keep the compact body. Use a 650 ms brewing crest.'; await summary(amended); await click(action('save-feedback')); await version(3);
  await click(action('edit-feedback')); await summary('Cancelled feedback must never replace the saved request.'); await click(action('cancel-feedback'));
  assert.equal((await group()).feedback.summary, amended); assert.equal((await group()).reviewVersion, 3);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(action('accept'))}).disabled`), false, 'Owner may reconsider after requesting changes');
  result.feedback = { first: draft, amended, cancelledEditDidNotWrite: true, reconsiderationAvailable: true };

  await click(action('edit-feedback')); const oldDraft = 'Unsent thought about the old animation, with exact whitespace.  '; await summary(oldDraft);
  assert.equal(typeof reviseProposal, 'function'); await reviseProposal(3);
  await click(action('recheck')); await waitFor(`Boolean(document.querySelector(${JSON.stringify(action('review-latest'))}))`, 'Explicit newer-content gate');
  assert.match(await evaluate(`document.querySelector(${JSON.stringify(action('review-latest'))}).textContent`), /latest version/);
  assert.equal(await evaluate("document.querySelector('[data-review-workspace]').dataset.reviewVersion"), '3');
  assert.equal(await evaluate("document.querySelector('[data-review-input=summary]')?.value"), oldDraft);
  await click(action('review-latest')); await version(4);
  assert.equal(await evaluate("document.querySelector('[data-review-input=summary]')!==null"), false, 'Old draft does not silently become feedback on new content');
  assert.match(await evaluate("document.querySelector('[data-review-disclosure=older-draft]').textContent"), /Unsent thought about the old animation/);
  await waitFor(`!document.querySelector(${JSON.stringify(action('copy-older-draft'))})?.disabled`, 'Latest project context reconciled');
  await click('[data-review-disclosure="older-draft"] summary');
  await click(action('copy-older-draft')); assert.equal(await evaluate("document.querySelector('[data-review-input=summary]').value"), oldDraft); await click(action('cancel-feedback'));
  result.newerContent = { oldReview: 3, newReview: 4, contentVersion: 2, draftRetainedExplicitly: true };

  await selected('assembly', false); await selected('image', true); await selected('animation', true);
  const beforePartial = await project(); await click(action('accept')); await version(5);
  const partial = await project(), partialGroup = await group();
  assert.equal(partial.revision, beforePartial.revision + 1); assert.equal(partialGroup.items.filter(item => item.status === 'ACCEPTED').length, 2);
  assert.deepEqual(partialGroup.items.filter(item => item.status === 'PENDING').map(item => item.itemId), ['assembly']);
  assert.equal(partial.snapshot.assemblyLibrary.assets.some(item => item.assetId === 'assembly.review-coffee'), false);
  const pins = structuredClone(partialGroup.items.filter(item => item.status === 'ACCEPTED'));
  await selected('assembly', true); await click(action('edit-feedback')); await summary('The Assembly is useful as proposed; preserve its exact accepted components.'); await click(action('save-feedback')); await version(6);
  await evaluate("window.__sharedReviewFault={fetch:window.fetch,requests:[],drop:true};window.fetch=async function(input,options){const a=window.__sharedReviewFault,url=String(input);if((options?.method??'GET').toUpperCase()==='POST'&&url.includes('/reviews/')&&url.endsWith('/accept')){a.requests.push(String(options.body));const response=await a.fetch.call(this,input,options);if(a.drop&&response.ok){a.drop=false;await response.clone().text();throw new TypeError('Synthetic lost shared Review receipt');}return response;}return a.fetch.call(this,input,options);};");
  const beforeFinal = await project();
  try {
    await click(action('accept')); await waitFor("document.querySelector('.shared-review-controller')?.dataset.reviewPhase==='uncertain'", 'Unknown outcome');
    await click('[data-library-action="back"]', true); assert.equal(await evaluate("document.querySelector('.shared-review-controller')?.dataset.reviewPhase"), 'uncertain');
    await click(action('check')); await waitFor(`document.querySelector(${JSON.stringify(action('retry'))})&&!document.querySelector(${JSON.stringify(action('retry'))}).disabled`, 'Explicit receipt retry');
    await click(action('retry')); await version(7);
    const requests = await evaluate('window.__sharedReviewFault.requests'); assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]);
  } finally { await evaluate('window.fetch=window.__sharedReviewFault.fetch;delete window.__sharedReviewFault;'); }
  const finalProject = await project(), finalGroup = await group(); assert.equal(finalProject.revision, beforeFinal.revision + 1); assert.equal(finalGroup.status, 'ACCEPTED');
  assert.deepEqual(finalGroup.items.filter(item => ['image', 'animation'].includes(item.itemId)), pins, 'Earlier accepted exact pins remain immutable');
  assert.equal(finalProject.snapshot.assemblyLibrary.assets.filter(item => item.assetId === 'assembly.review-coffee').length, 1);
  result.partialAcceptance = { acceptedFirst: ['image', 'animation'], acceptedFinally: ['assembly'], earlierPinsUnchanged: true, oneRevisionPerDecision: true, exactUncertainRetryOnce: true };

  await click('[data-workspace="activity"]'); await waitFor("document.querySelectorAll('[data-activity-event]').length>5", 'Readable Activity rows');
  const rows = await evaluate("[...document.querySelectorAll('[data-activity-event]')].map(n=>{const r=n.getBoundingClientRect();return{id:n.dataset.activityEvent,x:r.x,y:r.y,width:r.width,height:r.height,title:n.querySelector('h3')?.textContent,text:n.textContent,inspect:n.querySelector('[data-activity-inspect]')?.dataset.activityInspect}})");
  for (let index = 1; index < rows.length; index++) assert(rows[index].y >= rows[index - 1].y + rows[index - 1].height - 1, 'Activity is one full-width row per event');
  const feedbackEvent = rows.find(row => row.text.includes(amended) && row.inspect); assert(feedbackEvent, 'Exact saved feedback is readable in Activity');
  await captureCheckpoint('activity');
  await click(`[data-activity-inspect="${feedbackEvent.inspect}"]`); await version(3);
  assert.match(await evaluate("document.querySelector('[data-review-workspace]').textContent"), /read-only/);
  await waitFor("document.querySelector('[data-review-canvas]')?.dataset.reviewPreviewState==='ready'", 'Recorded proposed artwork remains available after later content and acceptance');
  assert.deepEqual(await previewPresentation(), originalPresentation, 'Historical Proposed must retain every original exact image digest, scene transform and frame after later content and saved heads advance');
  assert.equal(await evaluate("document.querySelectorAll('[data-review-action=accept]:not(:disabled),[data-review-action=save-feedback]:not(:disabled)').length"), 0);
  assert.equal(await evaluate("document.querySelector('[data-review-status]').dataset.reviewStatus"), 'CHANGES_REQUESTED', 'History pins the event version rather than the later acceptance');
  assert.deepEqual(await project(), finalProject, 'Historical inspection cannot rewrite current decisions');
  result.history = { event: feedbackEvent.id, exactReviewVersion: 3, latestReviewVersion: 7, readOnly: true, originalProposedPresentation: originalPresentation, activityRows: rows.length };
  await captureCheckpoint('historical-feedback');
  return result;
}
