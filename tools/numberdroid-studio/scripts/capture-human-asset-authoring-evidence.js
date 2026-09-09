import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const PROJECT_ID = 'numberdroid-studio-checkpoint-2b';
const ASSET_NAME = 'Human-authored test prop';
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

export async function captureHumanAssetAuthoring({ devtools, sessionId, width, height, pageUrl, outputPath, domPath, browserVersion }) {
  const evaluate = async (expression) => {
    const result = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(result.exceptionDetails, undefined, `Human Asset browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result?.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    const state = await evaluate(`({ project: document.getElementById('workspace-content')?.dataset.renderedProjectId, workspace: document.getElementById('workspace-content')?.dataset.renderedWorkspace, actions: document.querySelectorAll('[data-create-asset-slice]').length, text: document.getElementById('workspace-content')?.textContent.slice(0,1200) })`);
    throw new Error(`${label} did not become ready: ${JSON.stringify(state)}`);
  };
  const click = (selector) => evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled) throw new Error('Unavailable UI control: ' + ${JSON.stringify(selector)});
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    element.scrollIntoView({ block: 'center' }); element.click(); return true;
  })()`);
  const fill = (selector, values) => evaluate(`(() => {
    const form = document.querySelector(${JSON.stringify(selector)});
    if (!form) throw new Error('Missing authoring form');
    for (let parent = form.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    for (const [key, value] of Object.entries(${JSON.stringify(values)})) {
      const field = form.elements.namedItem(key);
      if (!field) throw new Error('Missing form field: ' + key);
      field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  })()`);
  const project = () => evaluate(`fetch('/api/projects/${PROJECT_ID}').then((response) => { if (!response.ok) throw new Error('Project read failed'); return response.json(); })`);
  const editorAction = (action, value) => `[data-asset-editor-action="${action}"]${value === undefined ? '' : `[data-value="${value}"]`}`;
  const editorField = async (name, value) => {
    await evaluate(`(() => { const field = document.querySelector('[data-asset-editor-field="' + ${JSON.stringify(name)} + '"]'); if (!field || field.disabled) throw new Error('Missing Asset editor field'); field.focus({preventScroll:true}); field.value = ${JSON.stringify(String(value))}; field.dispatchEvent(new Event('input', {bubbles:true})); field.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    await delay(45);
  };
  const physicalKey = async (key, { down = true, up = true, modifiers = 0 } = {}) => {
    const code = key === 'Enter' ? 13 : key === 'Shift' ? 16 : 27;
    if (down) await devtools.send('Input.dispatchKeyEvent', {type:'keyDown',key,code:key === 'Shift' ? 'ShiftLeft' : key,windowsVirtualKeyCode:code,modifiers,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})},sessionId);
    if (up) await devtools.send('Input.dispatchKeyEvent', {type:'keyUp',key,code:key === 'Shift' ? 'ShiftLeft' : key,windowsVirtualKeyCode:code,modifiers},sessionId);
    await delay(35);
  };
  const physicalMouse = (type, point, modifiers = 0) => devtools.send('Input.dispatchMouseEvent', {type,x:point.x,y:point.y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1,modifiers},sessionId);
  const showCanvas = async () => { await evaluate("document.querySelector('[data-asset-editor-scroll=canvas]').scrollIntoView({block:'center'})"); await delay(70); };
  const canvasPoint = (x,y) => evaluate(`(() => {const canvas=document.querySelector('[data-asset-editor-canvas]');const p=new DOMPoint(${x},${y}).matrixTransform(canvas.getScreenCTM());const r=canvas.closest('[data-asset-editor-scroll]').getBoundingClientRect();if(p.x<r.left||p.x>r.right||p.y<r.top||p.y>r.bottom||p.y<0||p.y>innerHeight)throw new Error('Target image point is not visible');return{x:p.x,y:p.y};})()`);
  const pointClick = async (x,y) => {const p=await canvasPoint(x,y);await physicalMouse('mousePressed',p);await physicalMouse('mouseReleased',p);await delay(35);};
  const drag = async (from,to,modifiers=0) => {const a=await canvasPoint(...from),b=await canvasPoint(...to);await physicalMouse('mousePressed',a,modifiers);for(let i=1;i<=4;i+=1)await physicalMouse('mouseMoved',{x:a.x+(b.x-a.x)*i/4,y:a.y+(b.y-a.y)*i/4},modifiers);await physicalMouse('mouseReleased',b,modifiers);await delay(60);};
  const selectedShape = () => evaluate(`(() => {const n=document.querySelector('[data-asset-editor-layer=regions]>.asset-editor-region.selected');if(!n)return null;if(n.tagName==='polygon')return{kind:'polygon',points:[...n.points].map(p=>({x:p.x,y:p.y}))};if(n.tagName==='ellipse'){const rx=Number(n.getAttribute('rx')),ry=Number(n.getAttribute('ry'));return{kind:'oval',x:Number(n.getAttribute('cx'))-rx,y:Number(n.getAttribute('cy'))-ry,width:rx*2,height:ry*2};}return{kind:'rectangle',...Object.fromEntries(['x','y','width','height'].map(k=>[k,Number(n.getAttribute(k))]))};})()`);
  const canvasLayout = () => evaluate(`(() => {const n=document.querySelector('[data-asset-editor-canvas]'),r=n.getBoundingClientRect(),m=n.getScreenCTM();return{x:r.x,y:r.y,width:r.width,height:r.height,matrix:[m.a,m.b,m.c,m.d,m.e,m.f]};})()`);
  const geometryChecks = [];
  const screenshots = [];
  const capture = async (stage, selector, filename = outputPath.replace(/\.png$/, `-${stage}.png`)) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' })`);
    await delay(150);
    const layout = await evaluate(`({ width: innerWidth, height: innerHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth, target: Boolean(document.querySelector(${JSON.stringify(selector)})) })`);
    assert.equal(layout.width, width); assert.equal(layout.height, height);
    assert.equal(layout.target, true, `${stage} target missing`);
    assert.equal(layout.horizontalOverflow, false, `${stage} has horizontal overflow at ${width}`);
    const image = await devtools.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId, 20_000);
    await writeFile(filename, Buffer.from(image.data, 'base64'));
    screenshots.push({ stage, filename, ...layout });
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await waitFor(`document.getElementById('connection-label')?.textContent === 'Live' && document.getElementById('workspace-content')?.dataset.renderedProjectId === '${PROJECT_ID}'`, 'Saved-slice project');
  await evaluate(`(() => {
    const originalFetch = window.fetch.bind(window);
    window.__humanAssetAudit = { posts: [], confirmations: [] };
    window.fetch = async (input, options) => {
      const pathname = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
      if ((options?.method ?? 'GET').toUpperCase() === 'POST') window.__humanAssetAudit.posts.push({ pathname, body: JSON.parse(options.body ?? '{}') });
      const response = await originalFetch(input, options);
      if (window.__humanAssetAudit.dropNextSaveResponse && pathname.endsWith('/save') && response.ok) {
        window.__humanAssetAudit.dropNextSaveResponse = false; await response.arrayBuffer();
        throw new TypeError('Synthetic lost Save response after the server committed.');
      }
      return response;
    };
    window.confirm = (message) => { window.__humanAssetAudit.confirmations.push(message); return true; };
  })()`);
  const reopened = new URL(pageUrl).searchParams.get('authoringPhase') === 'reopen';
  let slice = null;
  let compatibleRefresh = null;
  let previewReturn = null;
  const initial = await project();
  if (!reopened) {
    assert.equal(initial.snapshot.assetLibrary?.assets.length ?? 0, 0);
    await waitFor("document.querySelectorAll('[data-create-asset-slice]').length === 4", 'Four saved-slice actions');
    slice = await evaluate(`(() => { const action = document.querySelector('[data-create-asset-slice]'); return { sliceId: action.dataset.createAssetSlice, sliceVersion: Number(action.dataset.sliceVersion) }; })()`);
    assert.ok(slice.sliceId); assert.ok(slice.sliceVersion > 0);
    await click('[data-create-asset-slice]');
    await waitFor("Boolean(document.querySelector('[data-asset-editor]'))", 'Contextual Asset editor');
    await click(editorAction('view','properties'));
    for (const [key,value] of Object.entries({name:ASSET_NAME,kind:'prop','metadata.role':'authoring-test','metadata.rotationPolicy':'cardinal','metadata.placement.wallSafe':'false','metadata.runtimeEligible':'false'})) await editorField(key,value);
    await evaluate(`(() => { const input = document.querySelector('[data-asset-editor-field="name"]'); input.focus(); input.setSelectionRange(2, 8); })()`);
    await click('#refresh-button');
    await delay(600);
    compatibleRefresh = await evaluate(`(() => { const input = document.querySelector('[data-asset-editor-field="name"]'); return { name: input?.value, focused: document.activeElement === input, selectionStart: input?.selectionStart, selectionEnd: input?.selectionEnd }; })()`);
    assert.equal(compatibleRefresh.name, ASSET_NAME);
    assert.equal(compatibleRefresh.focused, true); assert.equal(compatibleRefresh.selectionStart, 2); assert.equal(compatibleRefresh.selectionEnd, 8);
    assert.equal((await project()).revision, initial.revision);
    await capture('form', '[data-asset-editor]');
    await devtools.send('Page.bringToFront', {}, sessionId);
    await click(editorAction('view','edit')); await click(editorAction('panel','placement'));
    for (const [key,value] of Object.entries({'placement.width':400,'placement.height':400,'scale.x':0.005,'scale.y':0.005,'anchor.x':200,'anchor.y':350})) await editorField(key,value);
    await editorField('anchor.x', '');
    for (const character of '-15.25') await devtools.send('Input.insertText', { text: character }, sessionId);
    assert.equal(await evaluate("document.querySelector('[data-asset-editor-field=\"anchor.x\"]').value"), '-15.25', 'Native negative decimal typing must retain intermediate tokens');
    await editorField('anchor.x', 200);
    await click(editorAction('panel','blocking')); await click(editorAction('zoom','fit'));
    await click('[data-asset-editor-tool="polygon"]'); await showCanvas();
    for (const p of [[30,30],[190,30],[190,90],[90,90],[90,190],[30,190]]) await pointClick(...p);
    assert.equal(await evaluate("document.activeElement===document.querySelector('[data-asset-editor-canvas]')&&document.hasFocus()"),true);
    await physicalKey('Enter'); assert.equal((await selectedShape()).points.length,6); await editorField('region.name','Main concave blocking');
    const polygon = await selectedShape();
    await click('[data-asset-editor-action="region"]');
    await click('[data-asset-editor-tool="remove"]');
    assert.deepEqual(await selectedShape(), polygon, 'Remove without a selected point must retain the polygon');
    assert.match(await evaluate("document.querySelector('[data-asset-editor-status]').textContent"), /Select a polygon point/);

    await click('[data-asset-editor-tool="insert"]'); await showCanvas(); await pointClick(110,30); assert.equal((await selectedShape()).points.length,7);
    await click('[data-asset-editor-tool="remove"]'); assert.equal((await selectedShape()).points.length,6);
    await click('[data-asset-editor-tool="undo"]'); assert.equal((await selectedShape()).points.length,7);
    await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),polygon);
    await showCanvas(); await drag([90,90],[110,110]); const movedPolygon = await selectedShape(); assert.notDeepEqual(movedPolygon,polygon);
    await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),polygon);
    await click('[data-asset-editor-tool="redo"]'); assert.deepEqual(await selectedShape(),movedPolygon);
    await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),polygon);
    geometryChecks.push({name:'native polygon drawing/Enter, concavity, point editing and Undo',passed:true});
    await click('[data-asset-editor-tool="oval"]'); await showCanvas(); await drag([230,40],[350,130]); await editorField('region.name','Oval blocking');
    const oval = await selectedShape(); assert.equal(oval.kind,'oval'); assert.equal(oval.width,120); assert.equal(oval.height,90);
    assert.equal(await evaluate("document.querySelectorAll('[data-asset-editor-handle]').length"),8);
    for (const handle of ['n','s','w','e','nw','ne','sw','se']) {
      await showCanvas(); const p=[handle.includes('w')?oval.x:handle.includes('e')?oval.x+oval.width:oval.x+oval.width/2,handle.includes('n')?oval.y:handle.includes('s')?oval.y+oval.height:oval.y+oval.height/2];
      await drag(p,[p[0]+(handle.includes('w')?-8:handle.includes('e')?8:0),p[1]+(handle.includes('n')?-8:handle.includes('s')?8:0)]);
      const changed=await selectedShape(); if(handle==='n'||handle==='s'){assert.equal(changed.x,oval.x);assert.equal(changed.width,oval.width);} if(handle==='e'||handle==='w'){assert.equal(changed.y,oval.y);assert.equal(changed.height,oval.height);}
      assert.notDeepEqual(changed,oval); await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),oval);
    }
    await showCanvas(); const east=await canvasPoint(350,85), out=await canvasPoint(370,85);
    await physicalMouse('mousePressed',east); await physicalMouse('mouseMoved',out); assert.equal((await selectedShape()).height,90);
    await physicalKey('Shift',{up:false,modifiers:8}); const circle=await selectedShape(); assert.equal(circle.width,circle.height);
    await physicalKey('Shift',{down:false}); assert.equal((await selectedShape()).height,90); await physicalMouse('mouseReleased',out);
    await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),oval);
    geometryChecks.push({name:'oval eight handles, one-axis edges and live Shift press/release',passed:true});
    await click('[data-asset-editor-tool="rectangle"]'); await showCanvas(); await drag([230,230],[330,290]); await editorField('region.name','Rectangular base');
    await editorField('region.width', '');
    await click(editorAction('panel','placement'));
    assert.equal(await evaluate("document.querySelector('[data-asset-editor-field=\"region.width\"]')?.value"), '', 'Incomplete width must remain visible on a blocked panel switch');
    assert.equal(await evaluate("document.querySelector('[data-asset-editor-action=save]').disabled"), true);
    await editorField('region.width',100);

    const rectangle=await selectedShape(); assert.equal(rectangle.kind,'rectangle'); assert.equal(await evaluate("document.querySelectorAll('[data-asset-editor-handle]').length"),8);
    await showCanvas(); await physicalKey('Shift',{up:false,modifiers:8}); await drag([330,290],[350,310],8); await physicalKey('Shift',{down:false}); const square=await selectedShape(); assert.equal(square.width,square.height);
    await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),rectangle);
    await showCanvas(); const stationary=await canvasLayout(), right=await canvasPoint(330,260), outside=await canvasPoint(450,260);
    await physicalMouse('mousePressed',right); await physicalMouse('mouseMoved',outside);
    assert.deepEqual(await canvasLayout(),stationary,'Error reporting moved the canvas during dragging'); assert.equal(await evaluate("document.querySelector('[data-asset-editor-status]').dataset.error"),'true');
    await physicalMouse('mouseReleased',outside); await click('[data-asset-editor-tool="undo"]'); assert.deepEqual(await selectedShape(),rectangle);
    geometryChecks.push({name:'rectangle eight handles, Shift square, stable containment error and exact Undo',passed:true});
    await click(editorAction('view','properties')); await editorField('metadata.navigation.effect','blocked'); await click(editorAction('view','edit'));
    await click('[data-asset-editor-tool="grid"]');
    await editorField('grid.step', ''); await physicalKey('Escape');
    assert.equal(await evaluate("document.querySelector('[data-asset-editor-grid-popup]').hidden"), false, 'An incomplete Grid field must remain reachable');
    assert.equal(await evaluate("document.querySelector('[data-asset-editor-field=\"grid.step\"]').value"), '');
    await editorField('grid.step', 25);
 await click('[data-asset-editor-option="grid.show"]'); await click('[data-asset-editor-option="grid.snap"]'); await editorField('grid.step',25); await click(editorAction('close-grid'));
    await showCanvas(); const gridLayout=await canvasLayout(); await evaluate("document.querySelector('[data-asset-editor-tool=grid]').click()"); assert.deepEqual(await canvasLayout(),gridLayout); await click(editorAction('close-grid'));
    await showCanvas(); await drag([280,260],[288,268]); const snapped=await selectedShape(); assert.notDeepEqual(snapped,rectangle); await click('[data-asset-editor-tool="undo"]');
    await showCanvas(); await drag([280,260],[288,268],1); const bypass=await selectedShape(); assert.equal(bypass.x,rectangle.x+8); assert.equal(bypass.y,rectangle.y+8); await click('[data-asset-editor-tool="undo"]');
    geometryChecks.push({name:'visible grid, stationary popup and Alt snapping bypass',passed:true});
    await click(editorAction('zoom','1')); assert.equal(await evaluate("Number(document.querySelector('[data-asset-editor-canvas]').dataset.scale)"),1);
    await evaluate("(()=>{const n=document.querySelector('[data-asset-editor-zoom]');n.value='200';n.dispatchEvent(new Event('input',{bubbles:true}));})()");
    await evaluate(`(()=>{document.querySelector(${JSON.stringify(editorAction('view','preview'))}).focus({preventScroll:true});const n=document.querySelector('[data-asset-editor-scroll=canvas]');n.scrollLeft=100;n.scrollTop=120;window.scrollTo(0,120);})()`);
    const readContext = () => evaluate(`(()=>{const n=document.querySelector('[data-asset-editor-scroll=canvas]');return{focus:document.activeElement.dataset.assetEditorFocusKey,pageX:scrollX,pageY:scrollY,x:n.scrollLeft,y:n.scrollTop,scale:Number(document.querySelector('[data-asset-editor-canvas]').dataset.scale),shape:document.querySelector('[data-asset-editor-layer=regions]>.asset-editor-region.selected').outerHTML};})()`);
    const beforePreview=await readContext(); assert.ok(beforePreview.pageY>0&&beforePreview.x>0&&beforePreview.y>0,'Return proof requires nonzero page/canvas scroll');
    await physicalKey('Enter'); await waitFor("!document.querySelector('[data-asset-editor-view="+JSON.stringify('preview')+"]').hidden",'Read-only geometry Preview');
    assert.match(await evaluate("document.querySelector('[data-asset-editor-view="+JSON.stringify('preview')+"]').textContent"),/read-only[\s\S]*does not simulate[\s\S]*Nothing is saved/i);
    await capture('preview','[data-asset-editor-view="preview"]'); await click('[data-asset-editor-view="preview"] '+editorAction('view','edit')); await delay(150);
    assert.deepEqual(await readContext(),beforePreview); assert.equal((await project()).revision,initial.revision); previewReturn={nativeEnter:true,exactContext:true,nonzeroScroll:true,readOnly:true};
    await click(editorAction('zoom','fit')); await capture('geometry','[data-asset-editor]');
    await evaluate('window.__humanAssetAudit.dropNextSaveResponse = true');
    await click('.asset-editor-footer '+editorAction('save'));
    await waitFor("Boolean(document.querySelector('[data-asset-editor-action=retry]'))", 'Uncertain Save retains an exact retry');
    assert.equal((await project()).revision, initial.revision + 1, 'The first Save really committed before its response was lost');
    await click(editorAction('retry'));
    await waitFor("document.querySelector('[data-asset-editor-saved-state]')?.textContent.startsWith('Saved Asset v1')",'Identical replay resolves direct owner Save');
    const created=await project(); assert.equal(created.revision,initial.revision+1); assert.equal(created.snapshot.assetLibrary.assets.length,1); assert.equal(created.snapshot.assetLibrary.proposals.length,0);
    await click(editorAction('back')); await waitFor("document.querySelectorAll('.asset-v2-card').length === 1", 'Saved DRAFT Asset');
    await capture('asset', '.asset-v2-card');
    await click('[data-workspace="rooms"]');
    await waitFor("Boolean(document.querySelector('[data-room-form=" + JSON.stringify('archetype') + "]'))", 'Room archetype form');
    await fill('[data-room-form="archetype"]', { displayName: 'Human authoring test template', kind: 'room', width: '8', height: '6' });
    await click('[data-room-form="archetype"] button[type="submit"]');
    await waitFor("document.querySelector('[data-room-form=" + JSON.stringify('variant') + "] [name=" + JSON.stringify('roomArchetypeId') + "]')?.options.length === 1", 'Saved room template');
    await fill('[data-room-form="variant"]', { displayName: 'Human authoring test room', width: '8', height: '6' });
    await click('[data-room-form="variant"] button[type="submit"]');
    await waitFor("Boolean(document.querySelector('[data-room-board]'))", 'Saved DRAFT Room');
    await click('[data-room-control="editor-tool"][data-editor-tool="PROP"]');
    await waitFor("document.querySelector('[data-room-control=" + JSON.stringify('palette-asset') + "] .asset-preview')?.dataset.previewState === 'READY'", 'Prop palette exact image');
    await click('[data-room-control="palette-asset"]');
    await click('[data-room-control="cell"][data-x="2"][data-y="2"]');
    await waitFor("document.querySelectorAll('.room-placement').length === 1", 'Saved interior placement');
    await click('[data-workspace="assets"]');
    await waitFor("Boolean(document.querySelector('[data-select-asset]'))", 'Library edit action');
    await click('[data-select-asset]');
    await waitFor("Boolean(document.querySelector('[data-asset-editor]'))", 'Existing Asset editor');
    await click(editorAction('view','properties')); await editorField('metadata.role','edited-authoring-test');
    const beforeUpdate=(await project()).revision;
    await click('.asset-editor-footer '+editorAction('save'));
    await waitFor("document.querySelector('[data-asset-editor-saved-state]')?.textContent.startsWith('Saved Asset v2')", 'Direct owner Asset revision');
    assert.equal((await project()).revision,beforeUpdate+1);
    await click(editorAction('back')); await click('[data-workspace="rooms"]');
    await waitFor("Boolean(document.querySelector('[data-room-board]')) && document.querySelectorAll('.room-placement').length === 1", 'Room keeps original Asset pin after Library edit');
  } else {
    await waitFor("Boolean(document.querySelector('[data-room-board]')) && document.querySelectorAll('.room-placement').length === 1", 'Read-only reopened Room');
  }
  const saved = await project();
  assert.equal(saved.snapshot.assetLibrary.assets.length, 1);
  const asset = saved.snapshot.assetLibrary.assets[0];
  assert.equal(asset.name, ASSET_NAME); assert.equal(asset.kind, 'prop'); assert.equal(asset.lifecycle, 'DRAFT');
  assert.equal(asset.assetVersion,2); assert.equal(asset.proposal,null);
  if (slice) { assert.equal(asset.sliceBinding.sliceId, slice.sliceId); assert.equal(asset.sliceBinding.sliceVersion, slice.sliceVersion); }
  assert.deepEqual(asset.metadata.spanTiles, { width: 2, height: 2 });
  assert.equal(asset.metadata.role,'edited-authoring-test');
  assert.deepEqual(asset.metadata.spatial.blockingRegions.map(region=>region.shape.kind),['polygon','oval','rectangle']);
  assert.equal(asset.metadata.spatial.blockingRegions[0].name,'Main concave blocking');
  assert.equal(asset.metadata.rotationPolicy, 'cardinal'); assert.equal(asset.metadata.runtimeEligible, false);
  assert.equal(saved.snapshot.roomLibrary.variants.length, 1);
  const roomEntry = saved.snapshot.roomLibrary.variants[0];
  const room = roomEntry.versions.find((version) => version.version === roomEntry.headVersion);
  assert.equal(room.lifecycle, 'DRAFT'); assert.equal(room.placements.length, 1);
  const placement = room.placements[0];
  assert.equal(placement.assetId, asset.assetId); assert.equal(placement.assetVersion, 1); assert.equal(placement.metadataVersion, 1);
  assert.deepEqual(placement.anchor, { x: 2, y: 2 });
  const audit = await evaluate('window.__humanAssetAudit');
  if (reopened) { assert.equal(audit.posts.length, 0, 'Reopening issued a mutation'); assert.equal(saved.revision,initial.revision); }
  else {
    const saves = audit.posts.filter(({pathname})=>pathname.endsWith('/save'));
    assert.equal(saves.length,3); assert.equal(saves[0].body.operation,'create'); assert.deepEqual(saves[1],saves[0], 'Retry must retain the identical payload and idempotency key'); assert.equal(saves[2].body.operation,'update');
    assert.deepEqual(saves[0].body.image,{mode:'saved-slice',sliceId:slice.sliceId,expectedSliceVersion:slice.sliceVersion}); assert.deepEqual(saves[2].body.image,{mode:'retain'});
    for(const {body} of saves) {
      assert.deepEqual(Object.keys(body).sort(),['expectedRevision','idempotencyKey','operation','expectedAssetVersion','expectedMetadataVersion','name','kind','metadata','image'].sort());
      assert.equal(Object.hasOwn(body.metadata,'pixelSize'),false);assert.equal(Object.hasOwn(body.metadata,'pivot'),false);
      assert.equal(/data:image|base64|sourceDigest|sliceBinding/.test(JSON.stringify(body)),false);
    }
    assert.equal(audit.posts.some(({pathname})=>pathname.includes('/asset-proposals')),false,'Own edits must not fabricate an agent proposal/review');
    assert.equal(audit.confirmations.length,0,'Direct owner Save must not ask the owner to approve their own edits again');
  }
  assert.equal(await evaluate("Boolean(document.querySelector('.activity-panel'))"),false,'Duplicate Activity sidebar remains');
  await capture(reopened ? 'reopened-room' : 'room', '[data-room-board]', outputPath);
  const errors = devtools.events.filter((event) => event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
    || event.method === 'Network.loadingFailed'
    || (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400));
  assert.equal(errors.length, 0, `Human Asset browser emitted protocol errors: ${JSON.stringify(errors)}`);
  if (domPath) await writeFile(domPath, `${await evaluate('document.documentElement.outerHTML')}\n`);
  await writeFile(outputPath.replace(/\.png$/, '.observation.json'), `${JSON.stringify({ schemaVersion: 2, mode: 'human-asset', reopened, browser: browserVersion.product, projectId: PROJECT_ID, initialRevision: initial.revision, revision: saved.revision, assetId: asset.assetId, assetVersion: asset.assetVersion, sliceBinding: asset.sliceBinding, spatial: asset.metadata.spatial, roomVariantId: room.roomVariantId, roomVersion: room.version, placement, compatibleRefresh, previewReturn, geometryChecks, directOwnerSave: true, pinnedPriorAssetVersion: true, explicitOwnerConfirmations: audit.confirmations.length, callerDerivedImageFields: false, runtimeNetworkErrors: errors.length, screenshots }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', mode: 'human-asset', reopened, width, screenshotCount: screenshots.length, output: outputPath })}\n`);
}
