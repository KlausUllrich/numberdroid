import assert from 'node:assert/strict';

const CANONICAL_RECTS = [[3, 3, 622, 622], [629, 3, 622, 622], [3, 629, 622, 622], [629, 629, 622, 622]];
const DIGESTS = ['ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2',
  '3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e',
  '9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526',
  'a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318'];

function driver(devtools, sessionId) {
  const evaluate = async (expression) => {
    const result = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`${label} did not settle within five seconds.`);
  };
  const click = async selector => { await evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n || n.disabled) throw new Error('Unavailable cutter control: ' + ${JSON.stringify(selector)}); n.click(); })()`); await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))'); };
  const fill = (selector, value, event = 'change') => evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n || n.disabled) throw new Error('Unavailable cutter field'); n.value = ${JSON.stringify(String(value))}; n.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); })()`);
  const state = () => evaluate(`(() => {
    const rect = n => { const r = n?.getBoundingClientRect(); return r ? [r.x,r.y,r.width,r.height] : null; };
    const canvas = document.querySelector('.cutter-canvas'), scroll = document.querySelector('.cutter-scroll');
    return { geometry: [...document.querySelectorAll('[data-cutter-move]')].map(n => ['x','y','width','height'].map(k => Number(n.getAttribute(k)))),
      names: [...document.querySelectorAll('[data-cutter-select] strong')].map(n => n.textContent),
      included: [...document.querySelectorAll('[data-rectangle-field="included"]')].map(n => n.checked),
      canvas: rect(canvas), scale: Number(canvas?.dataset.scale), zoom: canvas?.dataset.zoom,
      scroll: scroll ? [scroll.scrollLeft, scroll.scrollTop] : null, page: [window.scrollX,window.scrollY],
      selection: document.querySelector('[data-cutter-select][aria-pressed="true"]')?.dataset.cutterSelect,
      name: document.querySelector('[data-rectangle-field="name"]')?.value,
      invalid: document.querySelector('[data-cutter-validation]')?.dataset.invalid,
      validation: document.querySelector('[data-cutter-validation]')?.textContent,
      interaction: window.__numberdroidStudioVisualTest?.cutterInteractionState() };
  })()`);
  return { evaluate, waitFor, click, fill, state };
}

/** Verify saved pixels independently of which contextual view is being captured. */
export async function inspectCutterEditor({ devtools, sessionId, focus }) {
  const { evaluate, waitFor, click, state } = driver(devtools, sessionId);
  await click('[data-cutter-view="edit"]');
  await waitFor(`document.querySelector('.cutter-canvas img')?.complete && document.querySelector('.cutter-canvas img')?.naturalWidth === 1254`, 'Cutter source image');
  const editor = await state(); assert.deepEqual(editor.geometry, CANONICAL_RECTS);
  const controls = await evaluate(`({ moves:document.querySelectorAll('[data-cutter-move][tabindex="0"]').length,
    handles:document.querySelectorAll('[data-cutter-resize][tabindex="0"]').length,
    fields:document.querySelectorAll('[data-rectangle-field][type="number"]').length,
    choices:document.querySelectorAll('[data-rectangle-field="included"]').length,
    remaps:document.querySelectorAll('[data-rectangle-field="replacesSliceId"] option').length,
    slider:document.querySelector('[data-cutter-zoom]')?.type,
    toolRail:Boolean(document.querySelector('.cutter-tool-rail')),
    source:[document.querySelector('.cutter-canvas img')?.naturalWidth,document.querySelector('.cutter-canvas img')?.naturalHeight],
    status:document.querySelector('.cutter-job-status')?.textContent,
    historyText:document.querySelector('.cutter-job-events')?.textContent ?? '',
    events:[...document.querySelectorAll('[data-job-event-sequence]')].map(n=>[Number(n.dataset.jobEventSequence),n.dataset.jobEventType]),
    hasCommit:Boolean(document.querySelector('[data-commit-atlas]')) })`);
  assert.deepEqual([controls.moves, controls.handles, controls.fields, controls.choices, controls.remaps], [4, 8, 4, 4, 5]);
  assert.equal(controls.slider, 'range'); assert.equal(controls.toolRail, true);
  assert.deepEqual(controls.source, [1254, 1254]); assert.match(controls.status, /4\/4/);
  assert.equal(controls.hasCommit, false);
  assert.doesNotMatch(controls.historyText, /operationIdempotencyKey|grantId|lease|workerId|token|\/workspace|file:/i, 'Visible processing history exposes internal fields');
  assert.deepEqual(controls.events, [[1,'QUEUED'],[2,'RUNNING'],[3,'PROGRESS'],[4,'PROGRESS'],[5,'PROGRESS'],[6,'PROGRESS'],[7,'SUCCEEDED'],[8,'APPLIED']]);
  await click('[data-cutter-view="outputs"]');
  await waitFor(`document.querySelectorAll('.committed .slice-preview img').length === 4 && [...document.querySelectorAll('.committed .slice-preview img')].every(n => n.complete && n.naturalWidth > 0)`, 'Saved cut images');
  const outputs = await evaluate(`[...document.querySelectorAll('.committed .slice-preview')].map(n=>{ const img=n.querySelector('img'),link=n.querySelector('a'); return { width:img.naturalWidth,height:img.naturalHeight,fit:getComputedStyle(img).objectFit,digest:new URL(img.src).pathname.split('/').at(-1),target:link.target,noopener:link.relList.contains('noopener'),name:n.querySelector('strong')?.textContent }; })`);
  assert.deepEqual(outputs.map(n=>n.digest), DIGESTS);
  assert(outputs.every(n=>n.width===622 && n.height===622 && n.fit==='contain' && n.target==='_blank' && n.noopener));
  if (focus !== 'committed-slices') await click('[data-cutter-view="edit"]');
  await evaluate(`document.querySelector(${JSON.stringify(focus === 'committed-slices' ? '.slice-preview-grid.committed' : focus === 'rectangle-inspector' ? '.rectangle-inspector' : '.cutter-scroll')})?.scrollIntoView({block:'center'})`);
  return { editor, controls, committedPreviews: outputs };
}

/** Native interactions edit only the local draft; fixture revision 7 stays immutable. */
export async function captureCutterEditor({ devtools, sessionId }) {
  const { evaluate, waitFor, click, fill, state } = driver(devtools, sessionId);
  const evidence = { schemaVersion: 2 };
  const undo = () => click('[data-cutter-tool="undo"]');
  const rectField = field => `[data-rectangle-field="${field}"]:not([type="checkbox"])`;
  const key = async (name, modifiers = 0) => {
    await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, modifiers }, sessionId);
    await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, modifiers }, sessionId);
  };
  const refresh = async () => {
    await click('#refresh-button');
    await waitFor(`document.getElementById('refresh-button')?.disabled === false`, 'Project refresh');
  };
  // CDP must describe a consistently held left button. With button:none, Chrome
  // can synthesize lostpointercapture before a move despite buttons:1.
  const pointer = (type, point, modifiers = 0) => devtools.send('Input.dispatchMouseEvent', {
    type, x: point.x, y: point.y, button: 'left',
    buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1, modifiers,
  }, sessionId);
  const locate = selector => evaluate(`(() => { const n=document.querySelector(${JSON.stringify(selector)}); if(!n) throw new Error('Missing pointer target'); n.scrollIntoView({block:'center',inline:'center'}); const r=n.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  const nativeDrag = async (selector, dx, dy, { alt = false, defer = false } = {}) => {
    const start = await locate(selector); const before = await state();
    await evaluate(`(() => { window.__cutterEvidence.target = document.querySelector(${JSON.stringify(selector)}); window.__cutterDragProbeTarget = window.__cutterEvidence.target; window.__numberdroidStudioVisualTest.resetCutterPointerTrace(); })()`);
    const end = { x: start.x + dx * before.scale, y: start.y + dy * before.scale };
    let pressed; let moved; let during; let after;
    try {
      await pointer('mousePressed', start, alt ? 1 : 0);
      pressed = await state(); assert.equal(pressed.interaction.dragActive, true); assert.equal(pressed.interaction.hasPointerCapture, true);
      await pointer('mouseMoved', end, alt ? 1 : 0);
      await waitFor(`window.__numberdroidStudioVisualTest.cutterInteractionState().pointerTrace.some(e => e.type === 'pointermove' && e.pointerId === ${pressed.interaction.pointerId} && e.buttons === 1 && e.exactProbeTarget)`, 'Same-pointer held move').catch(async error => { throw new Error(error.message + JSON.stringify({selector,start,end,pressed,now:await state()})); });
      moved = await state(); assert.equal(moved.interaction.dragActive, true, JSON.stringify({selector,start,end,before,pressed,moved}));
      assert.equal(moved.interaction.pointerId, pressed.interaction.pointerId);
      assert(moved.interaction.pointerTrace.some(e => e.type === 'pointerdown' && e.pointerId === pressed.interaction.pointerId && e.buttons === 1 && e.exactProbeTarget));
      assert(moved.interaction.pointerTrace.some(e => e.type === 'pointermove' && e.pointerId === pressed.interaction.pointerId && e.buttons === 1 && e.exactProbeTarget));
      assert.deepEqual(moved.canvas, before.canvas, 'Dragging/validation moved the canvas');
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}) === window.__cutterEvidence.target`), true);
      if (defer) {
        assert.equal(moved.interaction.changed, true); assert.equal(moved.interaction.dirty, true);
        // Repeated pointer positions cross valid/overlap states without changing
        // the captured image transform or producing alternating geometry.
        for (const position of [start, end, start, end]) {
          await pointer('mouseMoved', position, alt ? 1 : 0);
          await evaluate('new Promise(resolve=>requestAnimationFrame(resolve))');
          const repeated = await state();
          assert.deepEqual(repeated.canvas, before.canvas, 'Validation feedback shifted the active canvas');
          assert.deepEqual(repeated.geometry, position === start ? before.geometry : moved.geometry,
            'The same pointer position produced different source geometry');
        }
        await evaluate('window.__numberdroidStudioVisualTest.forceChangedCutterProjectionRender()');
        during = await state(); assert.equal(during.interaction.deferred, true);
        assert.equal(during.interaction.pointerId, pressed.interaction.pointerId);
        assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}) === window.__cutterEvidence.target`), true);
        assert.deepEqual(during.scroll, before.scroll); assert.deepEqual(during.page, before.page);
      }
    } finally { await pointer('mouseReleased', end, alt ? 1 : 0); }
    await waitFor('!window.__numberdroidStudioVisualTest.cutterInteractionState().dragActive', 'Captured drag release');
    after = await state();
    assert.equal(after.interaction.deferred, false); assert.equal(after.interaction.hasPointerCapture, false);
    if (defer) {
      const settled = await evaluate(`(() => { const old=window.__cutterEvidence.target; const replacement=document.querySelector(${JSON.stringify(selector)}); return {replaced:replacement!==old,oldDisconnected:!old.isConnected,inspector:['x','y','width','height'].map(key=>Number(document.querySelector('[data-rectangle-field="'+key+'"]').value))}; })()`);
      assert(!settled.replaced && !settled.oldDisconnected, 'Settling an external projection must retain the active canvas nodes');
      assert.deepEqual(settled.inspector, after.geometry[0]);
    }
    const cleanup = await evaluate(`(() => { const h=window.__numberdroidStudioVisualTest; const trace=h.cutterInteractionState().pointerTrace; const released=trace.some(e=>e.type==='pointerup' && e.pointerId===${pressed.interaction.pointerId}); const targetReleased=!window.__cutterEvidence.target.hasPointerCapture(${pressed.interaction.pointerId}); h.clearCutterPointerTrace(); window.__cutterEvidence.target=null; window.__cutterDragProbeTarget=null; return {released,targetReleased,traceCleared:h.cutterInteractionState().pointerTrace.length===0}; })()`);
    assert.deepEqual(cleanup, { released: true, targetReleased: true, traceCleared: true });
    return { before, pressed, moved, during, after, cleanup };
  };
  await evaluate(`(() => { window.__cutterEvidence={target:null,posts:[],originalFetch:window.fetch,originalConfirm:window.confirm}; window.fetch=function(input,options){ if((options?.method??'GET').toUpperCase()==='POST') window.__cutterEvidence.posts.push(String(input)); return window.__cutterEvidence.originalFetch.call(this,input,options); }; })()`);
  try {
    await click('[data-cutter-view="edit"]');
    const secondPoint = await locate('[data-cutter-move="1"]');
    await pointer('mousePressed', secondPoint); await pointer('mouseReleased', secondPoint);
    await waitFor(`document.querySelector('[data-rectangle-row]')?.dataset.rectangleRow === '1'`, 'Click-only cut selection');
    await fill(rectField('name'), 'Selected second cut');
    const selectedName = await state(); assert(selectedName.names[1].includes('Selected second cut'));
    assert(!selectedName.names[0].includes('Selected second cut')); evidence.clickSelectionRename = true;
    await undo(); await click('[data-cutter-select="0"]');
    await click('[data-cutter-zoom-action="1"]');
    const actual = await state(); assert.equal(actual.scale, 1); assert.equal(actual.canvas[2], 1254); assert.equal(actual.canvas[3], 1254);
    await fill('[data-cutter-zoom]', 200, 'input');
    const zoomed = await state(); assert.equal(zoomed.scale, 2); assert.equal(zoomed.canvas[2], 2508);
    evidence.zoomCssWidths = [actual.canvas[2], zoomed.canvas[2]];

    // Leave a valid but uncommitted field value in the DOM through passive refresh.
    await evaluate(`(() => { const scroll=document.querySelector('.cutter-scroll'); scroll.scrollLeft=321; scroll.scrollTop=417; const field=document.querySelector('[data-rectangle-field="name"]'); field.value='Refresh draft name'; field.focus({preventScroll:true}); window.__cutterEvidence.passive={scroll,canvas:document.querySelector('.cutter-canvas'),field,left:scroll.scrollLeft,top:scroll.scrollTop,page:[scrollX,scrollY]}; })()`);
    await refresh(); await refresh();
    const passive = await evaluate(`(() => {const p=window.__cutterEvidence.passive,s=document.querySelector('.cutter-scroll'),f=document.querySelector('[data-rectangle-field="name"]'); return {sameScroller:s===p.scroll,sameCanvas:document.querySelector('.cutter-canvas')===p.canvas,sameField:f===p.field,focused:document.activeElement===f,value:f.value,scroll:[s.scrollLeft,s.scrollTop],before:[p.left,p.top],page:[scrollX,scrollY],beforePage:p.page};})()`);
    assert(passive.sameScroller && passive.sameCanvas && passive.sameField && passive.focused);
    assert.equal(passive.value, 'Refresh draft name'); assert.deepEqual(passive.scroll, passive.before); assert.deepEqual(passive.page, passive.beforePage);
    assert(passive.scroll.every(n=>n>0)); evidence.scrollPreservation=passive;
    await evaluate('window.__numberdroidStudioVisualTest.forceChangedCutterProjectionRender()');
    const projection = await evaluate(`(() => {const p=window.__cutterEvidence.passive,s=document.querySelector('.cutter-scroll'),f=document.querySelector('[data-rectangle-field="name"]'); return {scrollerReplaced:s!==p.scroll,fieldReplaced:f!==p.field,focused:document.activeElement===f,value:f.value,scroll:[s.scrollLeft,s.scrollTop],page:[scrollX,scrollY]};})()`);
    assert(!projection.scrollerReplaced && projection.fieldReplaced && projection.focused, JSON.stringify(projection)); assert.equal(projection.value,passive.value);
    assert.deepEqual(projection.scroll,passive.scroll); assert.deepEqual(projection.page,passive.page); evidence.necessaryRerender=projection;
    await fill(rectField('name'), 'North floor'); assert((await state()).names[0].includes('North floor'));
    await undo(); await click('[data-cutter-tool="redo"]'); assert.equal((await state()).name,'North floor');
    await fill('[data-cutter-zoom]', 100, 'input');
    const beforeOutputs = await state();
    await click('[data-cutter-view="outputs"]'); await click('[data-cutter-output-kind="saved"][data-cutter-output="0"]');
    assert.match(await evaluate(`document.querySelector('.cutter-output-detail')?.textContent`), /Left 3, top 3 · 622 × 622 source pixels/);
    await click('[data-cutter-view="outputs"]'); await click('[data-cutter-view="edit"]');
    const returned = await state(); assert.deepEqual(returned.geometry,beforeOutputs.geometry); assert.deepEqual(returned.names,beforeOutputs.names);
    assert.equal(returned.selection,beforeOutputs.selection); assert.equal(returned.zoom,beforeOutputs.zoom); assert.deepEqual(returned.scroll,beforeOutputs.scroll); assert.deepEqual(returned.page,beforeOutputs.page);
    evidence.outputDetailReturn={before:beforeOutputs,after:returned}; await undo();

    await click('[data-cutter-zoom-action="fit"]');
    await evaluate(`document.querySelector('[data-cutter-move="0"]').focus({preventScroll:true})`);
    const keyBefore=(await state()).geometry[0]; await key('ArrowRight'); const keyAfter=await state();
    assert.equal(keyAfter.geometry[0][0],keyBefore[0]+1);
    assert.equal(await evaluate(`document.activeElement===document.querySelector('[data-cutter-move="0"]')`),true,'Arrow editing must retain focus');
    await key('ArrowDown',8); assert.equal((await state()).geometry[0][1],keyBefore[1]+10); await undo(); await undo();
    evidence.keyboardMove={before:keyBefore,after:keyAfter.geometry[0]};
    const handle='[data-cutter-resize="0"][data-cutter-edge="s"]';
    await evaluate(`document.querySelector(${JSON.stringify(handle)}).focus({preventScroll:true})`);
    await key('ArrowUp'); assert.equal((await state()).geometry[0][3],621);
    assert.equal(await evaluate(`document.activeElement===document.querySelector(${JSON.stringify(handle)})`),true); await undo();

    evidence.dragContinuity=await nativeDrag('[data-cutter-move="0"]',17,11,{defer:true});
    assert.deepEqual(evidence.dragContinuity.after.geometry[0],[20,14,622,622]); await undo();
    evidence.edgeHandles=[];
    for(const edge of ['n','e','s','w','nw','ne','se','sw']) {
      const result=await nativeDrag(`[data-cutter-resize="0"][data-cutter-edge="${edge}"]`,17,11);
      const g=result.after.geometry[0],b=result.before.geometry[0];
      if(['n','s'].includes(edge)) {assert.equal(g[0],b[0]);assert.equal(g[2],b[2]);}
      if(['w','e'].includes(edge)) {assert.equal(g[1],b[1]);assert.equal(g[3],b[3]);}
      assert.notDeepEqual(g,b); evidence.edgeHandles.push({edge,before:b,after:g}); await undo();
    }

    const popupBefore=await state(); await click('[data-cutter-tool="grid"]');
    assert.deepEqual((await state()).canvas,popupBefore.canvas,'Grid popup moved the canvas');
    for(const [name,value] of Object.entries({width:1,height:1,x:0,y:0,gapX:0,gapY:0})) await fill(`[data-cutter-guide-field="${name}"]`,value,'input');
    assert.equal(await evaluate(`document.querySelector('[data-cutter-grid-create]').disabled`),true);
    assert.match(await evaluate(`document.querySelector('[data-cutter-grid-summary]').textContent`),/limit is 64/);
    assert.deepEqual((await state()).geometry,CANONICAL_RECTS); assert.deepEqual((await state()).canvas,popupBefore.canvas);
    for(const [name,value] of Object.entries({width:100,height:100})) await fill(`[data-cutter-guide-field="${name}"]`,value,'input');
    await evaluate(`(() => {const n=document.querySelector('[data-cutter-snap]');n.checked=true;n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await click('[data-cutter-grid-close]');
    assert.deepEqual((await state()).canvas,popupBefore.canvas);
    const snapped=await nativeDrag('[data-cutter-move="0"]',17,11); assert.deepEqual(snapped.after.geometry[0],[0,0,622,622]); await undo();
    const bypass=await nativeDrag('[data-cutter-move="0"]',17,11,{alt:true}); assert.deepEqual(bypass.after.geometry[0],[20,14,622,622]); await undo();
    evidence.gridSnap={snapped:snapped.after.geometry[0],alt:bypass.after.geometry[0],canvasStable:true,limitEnforced:true};
    await click('[data-cutter-tool="grid"]');
    for(const [name,value] of Object.entries({width:622,height:622,x:3,y:3,gapX:4,gapY:4})) await fill(`[data-cutter-guide-field="${name}"]`,value,'input');
    await evaluate(`(() => {const n=document.querySelector('[data-cutter-snap]');n.checked=false;n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await fill(rectField('name'),'Before grid replacement'); const beforeGrid=await state();
    await click('[data-cutter-grid-create]'); const replacedGrid=await state(); assert.deepEqual(replacedGrid.geometry,CANONICAL_RECTS); assert.notDeepEqual(replacedGrid.names,beforeGrid.names);
    await undo(); const restoredGrid=await state(); assert.deepEqual(restoredGrid.names,beforeGrid.names); assert.deepEqual(restoredGrid.geometry,beforeGrid.geometry);
    evidence.gridReplacementUndo={before:beforeGrid.names,replaced:replacedGrid.names,restored:restoredGrid.names}; await undo();

    await click('[data-cutter-tool="draw"]');
    const drawStart=await evaluate(`(() => {const svg=document.querySelector('[data-cutter-overlay]'),p=new DOMPoint(40,50).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y,scale:Number(svg.closest('.cutter-canvas').dataset.scale)};})()`);
    try { await pointer('mousePressed',drawStart); await pointer('mouseMoved',{x:drawStart.x+80*drawStart.scale,y:drawStart.y+60*drawStart.scale}); }
    finally {await pointer('mouseReleased',{x:drawStart.x+80*drawStart.scale,y:drawStart.y+60*drawStart.scale});}
    assert.deepEqual((await state()).geometry.at(-1),[40,50,80,60]); assert.equal((await state()).geometry.length,5);
    await fill(rectField('name'),'Small detail'); assert((await state()).names.at(-1).includes('Small detail'));
    await click('[data-cutter-tool="remove"]'); assert.equal((await state()).geometry.length,4); await undo(); assert.equal((await state()).geometry.length,5); await undo(); await undo();
    assert.deepEqual((await state()).geometry,CANONICAL_RECTS); await click('[data-cutter-tool="select"]');
    await click('[data-cutter-select="0"]');
    await click('[data-rectangle-index="0"][data-rectangle-field="included"]');
    assert.equal((await state()).included[0],false); assert.equal(await evaluate(`document.querySelector('[data-cutter-move="0"]').closest('g').classList.contains('excluded')`),true);
    await undo(); await evaluate(`document.querySelector('.cutter-identity').open=true`);
    const slice=await evaluate(`document.querySelector('[data-rectangle-field="replacesSliceId"]').options[1].value`);
    await fill('[data-rectangle-field="replacesSliceId"]',slice); assert.equal(await evaluate(`document.querySelector('[data-rectangle-field="replacesSliceId"]').value`),slice); await undo();
    evidence.selectiveAndNamedEditing=true;

    await fill('[data-cutter-zoom]',200,'input'); await fill(rectField('name'),'Discard this local draft');
    await evaluate(`(() => { const scroller=document.querySelector('.cutter-scroll'); scroller.scrollLeft=321; scroller.scrollTop=417; window.scrollTo(0,50); })()`);
    const closing=await state(); assert(closing.scroll.every(n=>n>0),'Close/reopen must begin with both scroll axes nonzero');
    await evaluate(`window.confirm=()=>false`); await click('[data-close-cutter]'); assert.equal((await state()).name,'Discard this local draft');
    await evaluate(`window.confirm=()=>true`); await click('[data-close-cutter]');
    await click('[data-open-cutter="source.family-hygiene-approved"]');
    await waitFor(`Boolean(document.querySelector('[data-job-event-type="APPLIED"]'))`,'Reopened saved cuts');
    const reopened=await state(); assert.deepEqual(reopened.geometry,CANONICAL_RECTS); assert.equal(reopened.name,''); assert.equal(reopened.zoom,'fit'); assert.deepEqual(reopened.scroll,[0,0]);
    assert.deepEqual(reopened.page,closing.page,'Close/reopen changed the retained page position');
    evidence.closeReopenReset={before:closing,after:reopened};
    const final=await evaluate(`fetch('/api/projects/numberdroid-studio-checkpoint-2b').then(r=>r.json())`);
    assert.equal(final.revision,7); assert.equal(await evaluate('window.__cutterEvidence.posts.length'),0,'Local inspection must not mutate saved fixture state');
    assert.equal(await evaluate('Number(document.documentElement.dataset.visualErrorCount)'),0);
    evidence.savedRevisionUnchanged=7; evidence.postInteractionRuntimeNetworkErrors=0;
    return evidence;
  } finally {
    await evaluate(`(() => {const audit=window.__cutterEvidence;if(audit){window.fetch=audit.originalFetch;window.confirm=audit.originalConfirm;delete window.__cutterEvidence;}})()`);
  }
}
