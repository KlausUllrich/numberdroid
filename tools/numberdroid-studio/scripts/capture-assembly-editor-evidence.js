import assert from 'node:assert/strict';
import { libraryNavigation, libraryDetailsSelector } from './library-browser-navigation.js';
import { ASSEMBLY_FIXTURE_PROJECT as projectId, ASSEMBLY_FIXTURE_ASSET as assetId, ASSEMBLY_FIXTURE_PROPOSAL as proposalId } from './prepare-assembly-editor-fixture.js';

/** Actual production UI interactions against the fresh deterministic fixture. */
export async function captureAssemblyEditor({ devtools, sessionId, reopen = false, captureCheckpoint = async () => {} }) {
  const evaluate = async expression => { const result = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result?.value; };
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const waitFor = async (expression, label) => { const deadline = Date.now() + 10_000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(done => setTimeout(done, 50)); } const diagnostic = await evaluate('document.body.innerText.slice(-12000)'); throw new Error(`${label} did not settle within ten seconds.\n${diagnostic}`); };
  const click = async selector => { await evaluate(`(() => { const n=document.querySelector(${JSON.stringify(selector)}); if(!n||n.disabled)throw new Error('Unavailable Assembly control: '+${JSON.stringify(selector)}); n.click(); })()`); await settle(); };
  const fill = async (key, value) => { await evaluate(`(() => { const n=document.querySelector('[data-assembly-field='+CSS.escape(${JSON.stringify(key)})+']'); if(!n||n.disabled)throw new Error('Unavailable Assembly field'); n.focus({preventScroll:true}); n.value=${JSON.stringify(String(value))}; n.dispatchEvent(new Event('input',{bubbles:true})); n.dispatchEvent(new Event('change',{bubbles:true})); })()`); await settle(); };
  const inspect = () => evaluate(`(() => { const r=n=>{const b=n?.getBoundingClientRect();return b?[b.x,b.y,b.width,b.height]:null}; const canvas=document.querySelector('[data-assembly-canvas]');return {
    canvas:r(canvas), matrix:canvas?Array.from(['a','b','c','d','e','f'],k=>canvas.getScreenCTM()[k]):null,
    components:[...document.querySelectorAll('[data-assembly-action="component"]')].map(n=>({id:n.dataset.value,selected:n.getAttribute('aria-pressed')==='true'})),
    images:[...document.querySelectorAll('[data-assembly-canvas] [data-assembly-image-key]')].map(n=>({key:n.dataset.assemblyImageKey,componentId:n.dataset.assemblyComponent,transform:n.getAttribute('transform'),image:n.querySelector('image')?.getAttribute('href'),hidden:n.style.display==='none'})),
    blocking:[...document.querySelectorAll('[data-assembly-layer="blocking"]>*')].map(n=>n.outerHTML),
    selection:{variantId:document.querySelector('[data-assembly-field="preview.variantId"]')?.value,stateId:document.querySelector('[data-assembly-field="preview.stateId"]')?.value},
    numeric:Object.fromEntries([...document.querySelectorAll('[data-assembly-field][type="number"]')].map(n=>[n.dataset.assemblyField,Number(n.value)])),
    saved:document.querySelector('[data-assembly-saved-state]')?.textContent,status:document.querySelector('[data-assembly-status]')?.textContent,
    focus:document.activeElement?.dataset.assemblyFocusKey,scroll:[...document.querySelectorAll('[data-assembly-scroll]')].map(n=>[n.dataset.assemblyScroll,n.scrollLeft,n.scrollTop]),page:[scrollX,scrollY]}; })()`);
  const project = () => evaluate(`fetch('/api/projects/${projectId}').then(async r=>{if(!r.ok)throw new Error('Project read failed');return r.json()})`);
  const pointer = (type, point) => devtools.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1 }, sessionId);
  const navigation = libraryNavigation({ evaluate, click, waitFor });
  async function captureReview() {
    await navigation.review('assembly', proposalId);
    const root = `[data-assembly-proposal="${proposalId}"]`;
    const control = suffix => `${root} ${suffix}`;
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(control('[data-assembly-review-action="ACCEPT"]'))})) && !document.querySelector(${JSON.stringify(control('[data-assembly-review-action="ACCEPT"]'))})?.disabled`, 'Resolved Assembly proposal');
    await evaluate(`document.querySelector(${JSON.stringify(root)}).scrollIntoView({block:'start'})`); await settle();
    const before = await project();
    const preview = () => evaluate(`(() => {const root=document.querySelector(${JSON.stringify(root)}),canvas=root.querySelector('[data-assembly-review-canvas]'),feedback=root.querySelector('[data-assembly-review-feedback]');const r=n=>{const b=n.getBoundingClientRect();return[b.x,b.y,b.width,b.height]};return{frame:canvas?.getAttribute('viewBox'),bounds:r(root.querySelector('[data-assembly-review-preview]')),images:[...canvas.querySelectorAll('[data-assembly-image-key]')].map(n=>({componentId:n.dataset.assemblyComponent,key:n.dataset.assemblyImageKey,transform:n.getAttribute('transform')})),feedback:feedback.value,feedbackBounds:r(feedback),feedbackFont:parseFloat(getComputedStyle(feedback).fontSize),changes:root.querySelector('[data-assembly-review-changes]').innerText,selection:[...root.querySelectorAll('[data-assembly-review-selection]')].map(n=>[n.dataset.assemblyReviewSelection,n.value]),technicalOpen:root.querySelector('[data-assembly-review-comparison]').open};})()`);
    const initial = await preview();
    assert.match(initial.changes, /Status display moves 4 px upward/);
    assert.equal(initial.technicalOpen, false);
    assert(!initial.changes.includes('component.display') && !initial.changes.includes('metadataVersion'), 'Human summary must not expose raw metadata');
    assert(initial.feedbackBounds[2] >= 300 && initial.feedbackBounds[3] >= 80 && initial.feedbackFont >= 14, JSON.stringify(initial));
    await captureCheckpoint('review-proposed');
    await click(control('[data-assembly-review-side="current"]'));
    const current = await preview();
    assert.equal(current.frame, initial.frame, 'Current and Proposed must share a frame');
    assert.deepEqual(current.bounds, initial.bounds, 'Comparison toggle must keep the preview fixed');
    const changed = initial.images.filter(image => image.transform !== current.images.find(other => other.componentId === image.componentId)?.transform);
    assert.deepEqual(changed.map(image => image.componentId), ['component.display'], 'The comparison must visualize only the authored display movement');
    await captureCheckpoint('review-current');
    await click(control('[data-assembly-review-side="proposed"]'));
    for (const [key, value] of [['variantId', 'variant.copper'], ['stateId', 'state.ready']]) {
      await evaluate(`(() => {const control=document.querySelector(${JSON.stringify(root)}).querySelector('[data-assembly-review-selection="'+${JSON.stringify(key)}+'"]');control.value=${JSON.stringify(value)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await waitFor(`!document.querySelector(${JSON.stringify(control('[data-assembly-review-action="ACCEPT"]'))})?.disabled`, 'Review choice preview');
    }
    const selected = await preview();
    await click(control('[data-assembly-review-side="current"]'));
    assert.deepEqual((await preview()).selection, selected.selection, 'Current/Proposed must retain state and variant');
    await click(control('[data-assembly-review-side="proposed"]'));
    assert.deepEqual((await preview()).selection, selected.selection);
    await click(control('[data-assembly-review-action="REQUEST_CHANGES"]'));
    assert.match(await evaluate(`document.querySelector(${JSON.stringify(root)}).textContent`), /Write feedback before requesting changes/);
    assert.deepEqual((await preview()).bounds, initial.bounds, 'Feedback validation must not move the preview');
    const feedback = 'Please keep the original display height; it aligns with the body.';
    await evaluate(`(() => {const field=document.querySelector(${JSON.stringify(control('[data-assembly-review-feedback]'))});field.focus({preventScroll:true});field.value=${JSON.stringify(feedback)};field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click(control('[data-assembly-review-more] summary'));
    await click(control('[data-assembly-review-action="recheck"]'));
    await waitFor(`!document.querySelector(${JSON.stringify(control('[data-assembly-review-action="ACCEPT"]'))})?.disabled`, 'Rechecked Assembly proposal');
    assert.equal((await preview()).feedback, feedback);
    assert.deepEqual(await project(), before, 'Review inspection and recheck must not persist changes');
    await evaluate(`window.__assemblyReviewEvidence={originalFetch:window.fetch,requests:[],drop:true};window.fetch=async function(input,options){const evidence=window.__assemblyReviewEvidence,url=String(input);if((options?.method??'GET').toUpperCase()==='POST'&&url.includes('/assembly-proposals/')&&url.endsWith('/resolve')){evidence.requests.push(String(options.body));const response=await evidence.originalFetch.call(this,input,options);if(evidence.drop&&response.ok){evidence.drop=false;await response.clone().text();throw new TypeError('Synthetic loss after successful Assembly review');}return response;}return evidence.originalFetch.call(this,input,options);};`);
    try {
      await click(control('[data-assembly-review-action="REQUEST_CHANGES"]'));
      await waitFor(`Boolean(document.querySelector(${JSON.stringify(control('[data-assembly-review-action="retry"]'))}))`, 'Unconfirmed Assembly decision');
      await click(control('[data-assembly-review-action="check"]'));
      await waitFor(`document.querySelector(${JSON.stringify(root)})?.textContent.includes('Retry the exact decision')`, 'Saved outcome refresh');
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(root)}).dataset.assemblyReviewStatus`), 'uncertain');
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(control('[data-assembly-review-feedback]'))}).value`), feedback);
      await click(control('[data-assembly-review-action="retry"]'));
      await waitFor(`!document.querySelector(${JSON.stringify(control('[data-assembly-review-action="retry"]'))})`, 'Replayed Assembly review');
      const requests = await evaluate('window.__assemblyReviewEvidence.requests');
      assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]);
      const after = await project(), proposal = after.snapshot.assemblyLibrary.proposals.find(item => item.proposalId === proposalId);
      assert.equal(after.revision, before.revision + 1); assert.equal(proposal.status, 'CHANGES_REQUESTED'); assert.equal(proposal.feedback, feedback);
      assert.deepEqual(after.snapshot.assemblyLibrary.assets, before.snapshot.assemblyLibrary.assets);
      assert.deepEqual(after.snapshot.assetLibrary, before.snapshot.assetLibrary);
      return { changedOnlySummary: initial.changes, sharedFrame: initial.frame, visualizedMovementOnly: true, stablePreviewValidation: true,
        readableFeedback: true, feedbackSurvivesRecheck: true, sideSelectionRetained: true, requestChanges: true, exactDecisionReplay: true, refreshDoesNotInferDelivery: true, oneRevision: true };
    } finally { await evaluate('window.fetch=window.__assemblyReviewEvidence.originalFetch;delete window.__assemblyReviewEvidence;'); }
  }
  await waitFor(`document.getElementById('connection-label')?.textContent==='Live' && Boolean(document.querySelector(${JSON.stringify(libraryDetailsSelector('assembly', assetId))}))`, 'Assembly Library');
  const reviewEvidence = reopen ? null : await captureReview();
  if (!reopen) {
    await navigation.assets();
    await waitFor(`Boolean(document.querySelector('[data-library-action="create-assembly"]')) && !document.querySelector('[data-library-action="create-assembly"]').disabled`, 'Library unlocked after review');
    const beforeCreate = await project();
    await click('[data-library-action="create-assembly"]');
    await waitFor(`Boolean(document.querySelector('[data-assembly-canvas]'))`, 'New Assembly editor');
    await click('[data-assembly-action="panel"][data-value="properties"]');
    await fill('name', 'Independent Assembly creation');
    await click('[data-assembly-action="add"]');
    await click('[data-assembly-action="pick-asset"][data-value="asset.assembly-graphite@2:1"]');
    await click('[data-assembly-action="save"]');
    await waitFor(`document.querySelector('[data-assembly-saved-state]')?.textContent.includes('Saved Assembly v1')`, 'Created Assembly Save');
    const created = await project();
    assert.equal(created.revision, beforeCreate.revision + 1);
    const saved = created.snapshot.assemblyLibrary.assets.find(asset => asset.name === 'Independent Assembly creation');
    assert.equal(saved.assetVersion, 1);
    assert.deepEqual(saved.assembly.components[0].asset, { assetId: 'asset.assembly-graphite', assetVersion: 2, metadataVersion: 1 });
    assert.deepEqual(created.snapshot.assetLibrary, beforeCreate.snapshot.assetLibrary);
    await click('[data-assembly-action="back"]');
    await navigation.assets();
  }
  await navigation.details('assembly', assetId);
  await click('[data-library-action="edit"]'); await waitFor(`document.querySelectorAll('[data-assembly-canvas] image').length>=2 && !document.querySelector('[data-assembly-status]')?.textContent.includes('Resolving')`, 'Resolved exact Assembly');
  const evidence = { schemaVersion: 1, projectId, assetId, phase: reopen ? 'reopen' : 'edit', ...(reopen ? {} : { independentCreation: true, review: reviewEvidence }), agentReview: 'Separate real-agent semantic proof is required.' };
  if (reopen) { evidence.reopened = await inspect(); assert.match(evidence.reopened.saved, /Saved Assembly v2/); assert(evidence.reopened.images.length >= 2); return evidence; }
  const beforeProject = await project(), nativeBefore = JSON.stringify(beforeProject.snapshot.assetLibrary.assets);
  await evaluate(`window.__assemblyEvidence={images:[...document.querySelectorAll('[data-assembly-canvas] image')],originalFetch:window.fetch,requests:[],drop:false};`);
  try {
    await click('[data-assembly-action="component"][data-value="component.graphite"]');
    assert.match(await evaluate(`document.querySelector('.assembly-inspector').textContent`), /Library now has v2/);
    const beforeDrag = await inspect();
    const start = await evaluate(`(() => {const n=document.querySelector('[data-assembly-component="component.graphite"] image');n.scrollIntoView({block:'center',inline:'center'});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    const positioned = await inspect(), end = { x: start.x + 18 * positioned.matrix[0], y: start.y + 12 * positioned.matrix[3] };
    try { await pointer('mousePressed', start); await pointer('mouseMoved', end); await settle();
      assert.deepEqual((await inspect()).canvas, positioned.canvas, 'An active drag must keep the canvas transform fixed');
    } finally { await pointer('mouseReleased', end); } await settle();
    const moved = await inspect();
    // Chrome quantizes dispatched pointer coordinates before SVG inversion. Test
    // the resulting error in CSS pixels, independent of the current fit zoom.
    // Exact authored numeric values and serialized replay are checked below.
    const movementError = { x: moved.numeric['position.x'] - positioned.numeric['position.x'] - 18, y: moved.numeric['position.y'] - positioned.numeric['position.y'] - 12 };
    const [a, b, c, d] = positioned.matrix;
    const screenError = Math.hypot(a * movementError.x + c * movementError.y, b * movementError.x + d * movementError.y);
    assert(screenError < 0.001, JSON.stringify({ screenError, start, end, before: positioned, after: moved }));
    assert.equal(await evaluate(`window.__assemblyEvidence.images.every(n=>n.isConnected)`), true, 'Moving a component remounted an unchanged image');
    evidence.nativeMove = { before: beforeDrag.numeric, after: moved.numeric, fixedCanvas: true, imageNodesRetained: true }; await click('[data-assembly-action="undo"]');

    await fill('preview.variantId', 'variant.copper'); const copper = await inspect(); await fill('preview.stateId', 'state.ready'); const ready = await inspect();
    assert.equal(ready.selection.variantId, 'variant.copper'); assert.equal(ready.images.length, copper.images.length + 1);
    assert.equal(ready.images.find(i => i.componentId === 'component.graphite').image, copper.images.find(i => i.componentId === 'component.graphite').image);
    const blocking = ready.blocking; await click('[data-assembly-action="eye"][data-value="component.graphite"]'); assert.deepEqual((await inspect()).blocking, blocking); await click('[data-assembly-action="eye"][data-value="component.graphite"]');
    evidence.previewAndEye = { stateRetainsVariant: true, cupMembership: true, inspectionDoesNotRemoveBlocking: true };

    await fill('position.x', 15.125); await fill('rotationDegrees', 27.5); await fill('scale', 1.1);
    await evaluate(`(() => {const n=document.querySelector('[data-assembly-field="position.x"]');n.focus({preventScroll:true});const s=document.querySelector('.assembly-inspector');s.scrollTop=110;})()`); const beforeSource = await inspect();
    await click('[data-assembly-action="source"]'); assert.match(await evaluate(`document.querySelector('[data-assembly-view="source"]').textContent`), /Source inspection|source.assembly-sheet/);
    await click('[data-assembly-action="return-source"]'); const returned = await inspect(); assert.deepEqual(returned.selection, beforeSource.selection); assert.deepEqual(returned.images, beforeSource.images); assert.equal(returned.numeric['position.x'], 15.125);
    assert.deepEqual(returned.scroll, beforeSource.scroll); evidence.readOnlySourceReturn = true;

    await click('[data-assembly-action="add"]'); await click('[data-assembly-action="pick-asset"][data-value^="asset.assembly-cup@"]');
    const added = await inspect(); assert.equal(added.components.length, 4); await fill('position.x', 100); await fill('position.y', 70);
    await click('[data-assembly-action="backward"]'); await click('[data-assembly-action="remove"]'); assert.equal((await inspect()).components.length, 3);
    await click('[data-assembly-action="undo"]'); assert.equal((await inspect()).components.length, 4); await click('[data-assembly-action="remove"]'); evidence.componentAddOrderRemoveUndo = true;

    await click('[data-assembly-action="panel"][data-value="blocking"]');
    assert.equal(await evaluate(`document.querySelectorAll('input[type="radio"][data-assembly-field="blocking-mode"]').length`), 2);
    await click('input[data-assembly-field="blocking-mode"][value="custom"]'); const customBefore = (await inspect()).blocking;
    const beforeVisibility = await inspect(), visibilityProject = await project();
    const visibilityHistory = await evaluate(`['undo','redo'].map(a=>document.querySelector('[data-assembly-action="'+a+'"]').disabled)`);
    await click('input[data-assembly-option="show-blocking"]');
    assert.deepEqual((await inspect()).blocking, []);
    assert.deepEqual((await inspect()).images, beforeVisibility.images);
    assert.deepEqual((await inspect()).canvas, beforeVisibility.canvas, 'Show blocking must not move the canvas');
    assert.deepEqual(await project(), visibilityProject, 'Show blocking must not persist a project change');
    assert.deepEqual(await evaluate(`['undo','redo'].map(a=>document.querySelector('[data-assembly-action="'+a+'"]').disabled)`), visibilityHistory);
    await captureCheckpoint('blocking-choices');
    await click('[data-assembly-action="custom-geometry"]'); await waitFor(`Boolean(document.querySelector('[data-asset-editor-canvas]'))`, 'Embedded custom geometry');
    await click('[data-asset-editor-tool="polygon"]');
    for (const p of [{ x: -80, y: 40 }, { x: -60, y: 50 }]) {
      const screen = await evaluate(`(() => {const c=document.querySelector('[data-asset-editor-canvas]');c.scrollIntoView({block:'center'});const p=new DOMPoint(${p.x},${p.y}).matrixTransform(c.getScreenCTM());return{x:p.x,y:p.y};})()`);
      await pointer('mousePressed', screen); await pointer('mouseReleased', screen);
    }
    assert.equal(await evaluate(`document.querySelectorAll('[data-asset-editor-draft-point]').length`), 2);
    await click('[data-asset-editor-action="back"]'); await waitFor(`Boolean(document.querySelector('[data-assembly-canvas]'))`, 'Assembly return with unfinished polygon');
    assert.equal(await evaluate(`document.querySelector('input[data-assembly-option="show-blocking"]').checked`), false, 'Embedded Back must retain Show blocking');
    assert.deepEqual((await inspect()).blocking, []);
    assert.match((await inspect()).status, /unfinished|polygon/i); assert.equal(await evaluate(`document.querySelector('[data-assembly-action="save"]').disabled`), true);
    await click('[data-assembly-action="custom-geometry"]'); assert.equal(await evaluate(`document.querySelectorAll('[data-asset-editor-draft-point]').length`), 2);
    await evaluate(`document.querySelector('[data-asset-editor-canvas]').focus({preventScroll:true})`);
    await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' }, sessionId); await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
    await click('[data-asset-editor-action="back"]'); await waitFor(`Boolean(document.querySelector('[data-assembly-canvas]'))`, 'Completed custom geometry return');
    await click('input[data-assembly-option="show-blocking"]');
    assert.deepEqual((await inspect()).blocking, customBefore, 'Inspection toggle must restore the exact custom shapes');
    await click('[data-assembly-action="panel"][data-value="component"]'); await click('[data-assembly-action="component"][data-value="component.graphite"]'); await fill('position.x', 31.125);
    assert.deepEqual((await inspect()).blocking, customBefore); evidence.customBlocking = { unfinishedPolygonRetained: true, incompleteSaveBlocked: true, independentOfComponentMovement: true, visibleModeChoices: true, inspectionToggleDoesNotMutate: true, inspectionToggleRetainedOnBack: true };

    await evaluate(`(() => {const p=window.__assemblyEvidence;p.drop=true;window.fetch=async function(input,options){const url=String(input);if((options?.method??'GET').toUpperCase()==='POST'&&url.includes('/assemblies/')&&url.endsWith('/save')){p.requests.push(String(options.body));const response=await p.originalFetch.call(this,input,options);if(p.drop&&response.ok){p.drop=false;await response.clone().text();throw new TypeError('Synthetic loss after successful Assembly Save');}return response;}return p.originalFetch.call(this,input,options);};})()`);
    await click('[data-assembly-action="save"]'); await waitFor(`Boolean(document.querySelector('[data-assembly-action="retry"]'))`, 'Uncertain committed Save');
    await click('[data-assembly-action="retry"]'); await waitFor(`document.querySelector('[data-assembly-saved-state]')?.textContent.includes('Saved Assembly v2')`, 'Idempotent Assembly replay');
    const requests = await evaluate(`window.__assemblyEvidence.requests`); assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]);
    const afterProject = await project(); assert.equal(afterProject.revision, beforeProject.revision + 1); assert.equal(JSON.stringify(afterProject.snapshot.assetLibrary.assets), nativeBefore);
    evidence.ownerSave = { identicalReplay: true, oneRevision: true, nativeSourcesUnchanged: true, revision: afterProject.revision }; evidence.final = await inspect(); return evidence;
  } finally { await evaluate(`(() => {if(window.__assemblyEvidence){window.fetch=window.__assemblyEvidence.originalFetch;delete window.__assemblyEvidence;}})()`); }
}
