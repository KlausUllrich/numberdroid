import assert from 'node:assert/strict';
import { ANIMATION_FIXTURE_PROJECT as projectId, ANIMATION_FIXTURE_CLIP as clipId } from './prepare-animation-editor-fixture.js';

export async function captureAnimationCut({ evaluate, settle, waitFor, click, action, field, project, devtools, sessionId }) {
  const cutAction = name => `[data-animation-cut-action="${name}"]`;
  const cutField = async (name, value) => { await evaluate(`(()=>{const n=document.querySelector('[data-animation-cut-field='+CSS.escape(${JSON.stringify(name)})+']');if(!n||n.disabled)throw new Error('Unavailable cut field');n.focus({preventScroll:true});n.value=${JSON.stringify(String(value))};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); };
  const cutView = () => evaluate(`(()=>{const n=document.querySelector('[data-animation-cut-canvas]'),r=n?.getBoundingClientRect();return{canvas:r?[r.x,r.y,r.width,r.height]:null,fields:Object.fromEntries([...document.querySelectorAll('[data-animation-cut-field]')].map(n=>[n.dataset.animationCutField,n.value])),scope:document.querySelector('[data-animation-cut-scope]')?.value};})()`);
  const open = async () => { await click(action('edit-cut')); await waitFor(`Boolean(document.querySelector('[data-animation-cut-editor]'))`, 'Contextual cut editor'); };
  const back = async () => { await click(cutAction('back')); await waitFor(`Boolean(document.querySelector('[data-animation-editor]'))`, 'Retained Animation draft'); };
  const apply = async scope => {
    await evaluate(`(()=>{const n=document.querySelector('[data-animation-cut-scope]');if(n){n.value=${JSON.stringify(scope)};n.dispatchEvent(new Event('change',{bubbles:true}));}else if(${JSON.stringify(scope)}!=='frame')throw new Error('Missing multiple-use scope choice');})()`);
    await click(cutAction('use')); await waitFor(`Boolean(document.querySelector('[data-animation-editor]'))&&!document.querySelector('[data-animation-cut-editor]')`, 'Applied revised cut and retained Animation');
  };
  const inspectFrame = async id => {
    await click(action('frame', id)); await click(action('panel','alignment'));
    const found=await evaluate(`({x:Number(document.querySelector('[data-animation-field="offset.x"]').value),y:Number(document.querySelector('[data-animation-field="offset.y"]').value),source:document.querySelector('.animation-source-reference').textContent})`);
    await click(action('panel','timing'));return found;
  };
  const ids = await evaluate(`[...document.querySelectorAll('[data-animation-frame]')].map(n=>n.dataset.animationFrame)`);
  const original = 'frame.brewing-1', duplicate = ids.find(id=>!['frame.brewing-1','frame.brewing-2','frame.brewing-3','frame.brewing-4'].includes(id));
  assert(duplicate, 'This capture needs the duplicated first frame.');
  await click(action('frame', duplicate));
  const originalBefore = await inspectFrame(original), duplicateBefore = await inspectFrame(duplicate), before = await project();
  await open();const first = await cutView();
  const handle = await evaluate(`(()=>{const n=document.querySelector('[data-animation-cut-handle="w"]');n.scrollIntoView({block:'nearest',inline:'nearest'});const r=n.getBoundingClientRect(),m=document.querySelector('[data-animation-cut-canvas]').getScreenCTM();return{x:r.x+r.width/2,y:r.y+r.height/2,scale:m.a};})()`);
  const gestureFrame = await cutView(), end = { x: handle.x + handle.scale, y: handle.y };
  const pointer = (type, point) => devtools.send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button:'left', buttons:type==='mouseReleased'?0:1, ...(type==='mousePressed'?{clickCount:1}:{}) }, sessionId);
  try { await pointer('mousePressed',handle);await pointer('mouseMoved',end);await settle();assert.deepEqual((await cutView()).canvas,gestureFrame.canvas); }
  finally { await pointer('mouseReleased',end); } await settle();
  const moved = await cutView();assert.equal(Number(moved.fields.x),Number(first.fields.x)+1);assert.equal(moved.fields.y,first.fields.y);assert.equal(Number(moved.fields.width),Number(first.fields.width)-1);assert.equal(moved.fields.height,first.fields.height);
  const stable = moved.canvas;await cutField('width',0);assert.deepEqual((await cutView()).canvas,stable,'Cut validation must not move its canvas');
  assert.equal(await evaluate(`document.querySelector('[data-animation-cut-action="use"]').disabled`),true);
  await back();assert.deepEqual(await project(),before,'Returning from a cut draft must not save it');
  await open();assert.equal((await cutView()).fields.width,'0','Unfinished cut fields must survive Back and reopening');
  await cutField('width',Number(first.fields.width)-1);await apply('clip');
  const firstApplied = await project();assert.equal(firstApplied.revision,before.revision+2);
  assert.equal(firstApplied.snapshot.clipLibrary.assets.find(a=>a.assetId===clipId).assetVersion,1,'Revising a cut must leave saved Clip content pinned');
  const originalAfter = await inspectFrame(original), duplicateAfter = await inspectFrame(duplicate);
  assert.equal(originalAfter.x,originalBefore.x+1);assert.equal(duplicateAfter.x,duplicateBefore.x+1);
  assert.match(originalAfter.source,/cut v2/);assert.match(duplicateAfter.source,/cut v2/);
  await click(action('undo'));const undone=await inspectFrame(duplicate);assert.equal(undone.x,duplicateBefore.x);assert.match(undone.source,/cut v1/);assert.deepEqual(await project(),firstApplied,'Animation Undo must not erase shared cut history');
  await click(action('redo'));
  await click(action('frame',original));await open();await cutField('x',Number(first.fields.x)+2);await cutField('width',Number(first.fields.width)-2);await apply('frame');
  assert.match((await inspectFrame(original)).source,/cut v3/);assert.match((await inspectFrame(duplicate)).source,/cut v2/);
  await click(action('frame',original));await open();await cutField('x',Number(first.fields.x)+3);await cutField('width',Number(first.fields.width)-3);await apply('clip');
  const finalOriginal=await inspectFrame(original),finalDuplicate=await inspectFrame(duplicate);
  assert.equal(finalOriginal.x,originalBefore.x+3);assert.equal(finalDuplicate.x,duplicateBefore.x+3);
  assert.match(finalOriginal.source,/cut v4/);assert.match(finalDuplicate.source,/cut v4/);
  return { passed:true,retainedInvalidDraft:true,westHandleAxisIsolation:true,stableGestureAndValidation:true,scopeFrameAndAll:true,mixedVersionOrigins:true,
    undoRetainsSavedCutHistory:true,projectRevisionDelta:6,expectedFrames:[{frameId:original,sliceVersion:4,offset:{x:originalBefore.x+3,y:originalBefore.y}},
      {frameId:duplicate,sliceVersion:4,offset:{x:duplicateBefore.x+3,y:duplicateBefore.y}}] };
}
