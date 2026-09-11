import assert from 'node:assert/strict';
import { libraryNavigation, libraryDetailsSelector } from './library-browser-navigation.js';
import { captureAnimationCut } from './capture-animation-cut-evidence.js';
import { ANIMATION_FIXTURE_PROJECT as projectId, ANIMATION_FIXTURE_CLIP as clipId, ANIMATION_FIXTURE_ASSEMBLY as assemblyId, ANIMATION_FIXTURE_CLIP_PROPOSAL as proposalId } from './prepare-animation-editor-fixture.js';

/** Native production editor and contextual Cutter evidence against real saved PNGs. */
export async function captureAnimationEditor({ devtools, sessionId, reopen = false, captureCheckpoint = async () => {}, captureContextualCut = captureAnimationCut }) {
  const evaluate = async expression => { const result = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result?.value; };
  const settle = () => evaluate('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))');
  const waitFor = async (expression, label) => { const deadline = Date.now() + 12000; while (Date.now() < deadline) {
    if (await evaluate(expression)) return; await new Promise(done => setTimeout(done, 50));
  } throw new Error(`${label} did not settle. ${await evaluate('document.body.innerText.slice(-12000)')}`); };
  const click = async selector => { await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw new Error('Unavailable control: '+${JSON.stringify(selector)});n.click();})()`); await settle(); };
  const action = (name, value) => `[data-animation-action="${name}"]${value === undefined ? '' : `[data-value="${value}"]`}`;
  const field = async (name, value) => { await evaluate(`(()=>{const n=document.querySelector('[data-animation-field='+CSS.escape(${JSON.stringify(name)})+']');if(!n||n.disabled)throw new Error('Unavailable Animation field');n.focus({preventScroll:true});n.value=${JSON.stringify(String(value))};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
  const project = () => evaluate(`fetch('/api/projects/${projectId}').then(r=>r.json())`);
  const view = () => evaluate(`(()=>{const canvas=document.querySelector('[data-animation-canvas]'),r=canvas?.getBoundingClientRect();return{canvas:r?[r.x,r.y,r.width,r.height]:null,image:document.querySelector('[data-animation-image]')?.getAttribute('href'),frames:[...document.querySelectorAll('[data-animation-frame]')].map(n=>n.dataset.animationFrame),status:document.querySelector('[data-animation-status]')?.textContent,fps:document.querySelector('[data-animation-field="fps"]')?.value,mode:document.querySelector('[data-animation-field="playbackMode"]')?.value,source:document.querySelector('.animation-source-reference')?.textContent};})()`);
  const navigation = libraryNavigation({ evaluate, click, waitFor });
  await waitFor(`document.getElementById('connection-label')?.textContent==='Live'&&Boolean(document.querySelector(${JSON.stringify(libraryDetailsSelector('animation', clipId))}))`, 'Animation Library');
  const review = reopen ? null : await captureReview();
  if (!reopen) await navigation.assets();
  await navigation.details('animation', clipId);
  await click('[data-library-action="edit"]');
  await waitFor(`Boolean(document.querySelector('[data-animation-image]')?.getAttribute('href'))&&!document.querySelector('[data-animation-action="save"]')?.disabled`, 'Exact Animation frames');
  const result = { schemaVersion: 1, projectId, clipId, phase: reopen ? 'reopen' : 'edit', review, contextualCut: null };
  if (reopen) { const p = await project(), saved = p.snapshot.clipLibrary.assets.find(asset=>asset.assetId===clipId);
    assert.equal(saved.assetVersion, 2); assert.equal(saved.clip.fps, 9); assert.equal((await view()).frames.length, 5); result.exactReopen=true; return result; }
  const before = await project(), initial = await view();
  assert.equal(initial.frames.length, 4); assert.equal(initial.mode, 'pingpong');
  await click(action('play'));
  await waitFor(`document.querySelector('[data-animation-image]')?.getAttribute('href')!==${JSON.stringify(initial.image)}`, 'Actual PNG playback');
  assert.deepEqual((await view()).canvas, initial.canvas, 'Playback must not move its preview canvas');
  await click(action('play')); assert.deepEqual(await project(), before, 'Playback must not save project revisions');
  result.realPngPlayback = true; await captureCheckpoint('playback');
  await click(action('frame', 'frame.brewing-1')); await click(action('duplicate')); const duplicate = (await view()).frames[1];
  assert.equal((await view()).frames.length, 5);
  await field('frame.name', 'First frame echo'); await field('fps', 9);
  await click(action('later')); await click(action('undo')); await click(action('redo'));
  assert.equal((await view()).frames[2], duplicate);
  await click(action('frame', duplicate));
  await click(action('inspect')); await waitFor(`!document.querySelector('[data-animation-source]')?.hidden`, 'Source inspection');
  await click(action('return-source')); assert.equal((await view()).fps, '9'); assert.equal((await view()).frames[2], duplicate);
  result.inspectRetainsDraft = true;
  await click(action('panel', 'alignment')); await field('offset.x', 1); await field('offset.y', 2);
  await click(action('panel', 'timing'));
  const positioned = await view(); await field('fps', 0);
  assert.deepEqual((await view()).canvas, positioned.canvas, 'Validation must not move the active canvas');
  assert.equal(await evaluate(`document.querySelector('[data-animation-action="save"]').disabled`), true);
  await field('fps', 9);
  if (captureContextualCut) { result.contextualCut = await captureContextualCut({ evaluate, settle, waitFor, click, action, field, project, view, devtools, sessionId }); }
  await captureCheckpoint('draft');
  await evaluate(`window.__animationSaveEvidence={originalFetch:window.fetch,requests:[],drop:true};window.fetch=async function(input,options){const e=window.__animationSaveEvidence,url=String(input);if((options?.method??'GET').toUpperCase()==='POST'&&url.includes('/clips/')&&url.endsWith('/save')){e.requests.push(String(options.body));const response=await e.originalFetch.call(this,input,options);if(e.drop&&response.ok){e.drop=false;await response.clone().text();throw new TypeError('Synthetic lost Animation Save receipt');}return response;}return e.originalFetch.call(this,input,options);};`);
  try {
    const preSave = await project(); await click(action('save'));
    await waitFor(`!document.querySelector('[data-animation-action="retry"]')?.hidden`, 'Retained uncertain Save');
    await click(action('check-outcome'));
    await waitFor(`document.querySelector('[data-animation-status]')?.textContent.includes('Retry the exact Save')`, 'Outcome check without inferred success');
    await click(action('retry'));
    await waitFor(`document.querySelector('[data-animation-status]')?.textContent.includes('Saved Animation v2')&&document.querySelector('[data-animation-action="retry"]')?.hidden`, 'Exact Save replay');
    const requests=await evaluate('window.__animationSaveEvidence.requests');assert.equal(requests.length,2);assert.equal(requests[0],requests[1]);
    const after=await project();assert.equal(after.revision,preSave.revision+1);const saved=after.snapshot.clipLibrary.assets.find(asset=>asset.assetId===clipId);
    assert.equal(saved.assetVersion,2);assert.equal(saved.clip.frames.length,5);assert.equal(saved.clip.fps,9);
    assert.equal(result.contextualCut?.passed,true,'Contextual cut evidence must complete before the gate passes');
    for(const expected of result.contextualCut.expectedFrames){const actual=saved.clip.frames.find(f=>f.frameId===expected.frameId);assert.equal(actual.slice.sliceVersion,expected.sliceVersion);assert.deepEqual(actual.offset,expected.offset);}
    assert.deepEqual(after.snapshot.assemblyLibrary.assets,preSave.snapshot.assemblyLibrary.assets,'Saving a Clip must not retarget Assemblies');result.exactSaveReplay=true;
  } finally { await evaluate('window.fetch=window.__animationSaveEvidence.originalFetch;delete window.__animationSaveEvidence;'); }
  await click(action('back'));
  await navigation.assets();
  result.assembly = await captureAssembly();
  result.sourceMutationsOnlyThroughExplicitCutSave=true;result.savedAssemblyStillPinsClipV1=true;return result;
  async function captureReview() {
    await navigation.review('animation', proposalId);
    const selector=`[data-animation-proposal="${proposalId}"]`, control=name=>`${selector} [data-animation-review-action="${name}"]`;
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}+' [data-animation-review-canvas]'))`, 'Exact Clip review preview');
    const before=await project();
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'});`);await settle();
    const bounds=()=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}+' [data-animation-review-canvas]').getBoundingClientRect();return[r.x,r.y,r.width,r.height];})()`);
    const first=await bounds();
    assert.match(await evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`),/750 ms/);
    await click(control('current'));assert.deepEqual(await bounds(),first);await click(control('proposed'));assert.deepEqual(await bounds(),first);
    await click(control('REQUEST_CHANGES'));assert.match(await evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`),/Write feedback before requesting changes/);
    assert.deepEqual(await bounds(),first,'Review validation must not move the preview');
    const feedback='Keep the quick brewing rhythm; use a shorter final hold.';
    await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)}+' [data-animation-review-feedback]');n.value=${JSON.stringify(feedback)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await captureCheckpoint('review');await click(control('REQUEST_CHANGES'));
    await waitFor(`document.querySelector(${JSON.stringify(selector)})?.textContent.includes('Changes requested')`, 'Recorded owner feedback');
    const after=await project(),proposal=after.snapshot.clipLibrary.proposals.find(p=>p.proposalId===proposalId);
    assert.equal(after.revision,before.revision+1);assert.equal(proposal.status,'CHANGES_REQUESTED');assert.equal(proposal.feedback,feedback);
    assert.deepEqual(after.snapshot.clipLibrary.assets,before.snapshot.clipLibrary.assets);
    await evaluate('window.scrollTo(0,0)');await settle();
    return {plainTimingChange:true,currentProposedStable:true,feedbackValidationStable:true,requestChangesWithoutApplying:true};
  }
  async function captureAssembly() {
    const before=await project();await navigation.details('assembly', assemblyId);await click('[data-library-action="edit"]');
    const assemblyField=async(name,value)=>{await evaluate(`(()=>{const n=document.querySelector('[data-assembly-field='+CSS.escape(${JSON.stringify(name)})+']');if(!n)throw new Error('Missing Assembly field');n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('change',{bubbles:true}));})()`);await settle();};
    await waitFor(`Boolean(document.querySelector('[data-assembly-canvas]'))`,'Saved Assembly editor');await assemblyField('preview.stateId','state.brewing');
    const group='[data-assembly-component="component.display"][data-assembly-content-kind="animation"]';
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(group)}))`,'Saved clip presentation');
    const clocks=()=>evaluate(`import('/assembly-artwork-view.js').then(m=>m.assemblyArtworkPlayback(document.querySelector('[data-assembly-artwork]')))`);
    const initial=await evaluate(`document.querySelector(${JSON.stringify(group)}).dataset.assemblyFrame`);
    await waitFor(`document.querySelector(${JSON.stringify(group)})?.dataset.assemblyFrame!==${JSON.stringify(initial)}`,'Assembly PNG frame playback');
    await click('[data-assembly-action="playback"]');const paused=await clocks();assert(paused[0].elapsedMs>0);assert.match(paused[0].key,/clip.brewing-display@1:1/);
    const body=await evaluate(`document.querySelector('[data-assembly-component="component.body"] image').getAttribute('href')`);
    await assemblyField('preview.variantId','variant.copper');assert.deepEqual(await clocks(),paused,'Body variants must retain clip phase');
    assert.equal(await evaluate(`document.querySelector('[data-assembly-field="preview.stateId"]').value`),'state.brewing');
    assert.notEqual(await evaluate(`document.querySelector('[data-assembly-component="component.body"] image').getAttribute('href')`),body);
    await click('[data-assembly-action="component"][data-value="component.display"]');
    await click('[data-assembly-action="state-content"][data-value="state.brewing"]');
    await click('[data-assembly-action="pick-asset"][data-value="clip.brewing-display@2:2"]');
    await waitFor(`document.querySelector(${JSON.stringify(group)})?.dataset.assemblyImageKey.includes('@2:2')`,'Explicit newer saved clip choice');
    await captureCheckpoint('assembly');await click('[data-assembly-action="undo"]');
    await waitFor(`document.querySelector(${JSON.stringify(group)})?.dataset.assemblyImageKey.includes('@1:1')`,'Restored original clip binding');
    assert.deepEqual(await project(),before,'Assembly playback, selection and Undo must not mutate saved project state');
    await click('[data-assembly-action="back"]');
    return {realSavedClipPlayback:true,variantRetainsStateAndPausedPhase:true,oldVersionPinPreserved:true,newVersionChoiceExplicit:true,inspectionReadOnly:true};
  }

}
