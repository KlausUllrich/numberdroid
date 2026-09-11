import assert from 'node:assert/strict';
import { libraryNavigation, libraryDetailsSelector, libraryReviewSelector } from './library-browser-navigation.js';
import { ANIMATION_FIXTURE_PROJECT as projectId, ANIMATION_FIXTURE_CLIP as clipId,
  ANIMATION_FIXTURE_ASSEMBLY as assemblyId, ANIMATION_FIXTURE_ASSEMBLY_PROPOSAL as proposalId } from './prepare-animation-editor-fixture.js';

/** ND-1 only: native production navigation, exact inspection and existing review. */
export async function captureLibraryNavigation({ devtools, sessionId, captureCheckpoint = async () => {} }) {
  const evaluate = async expression => {
    const value = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(value.exceptionDetails, undefined, JSON.stringify(value.exceptionDetails)); return value.result?.value;
  };
  const settle = () => evaluate('new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)))');
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(done => setTimeout(done, 50)); }
    throw new Error(`${label} did not settle: ${await evaluate('document.body.innerText.slice(-6000)')}`);
  };
  const click = async selector => {
    await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n||n.disabled)throw new Error('Unavailable Library control: '+${JSON.stringify(selector)});n.click();})()`); await settle();
  };
  const navigation = libraryNavigation({ evaluate, click, waitFor });
  const project = () => evaluate(`fetch('/api/projects/${projectId}').then(r=>{if(!r.ok)throw new Error('Project read failed');return r.json()})`);
  const field = async (name, value) => {
    await evaluate(`(()=>{const n=document.querySelector('[data-library-filter="'+${JSON.stringify(name)}+'"]');if(!n)throw new Error('Missing Library filter');n.focus();n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle();
  };
  const cards = () => evaluate(`[...document.querySelectorAll('[data-library-card]')].map(n=>({kind:n.dataset.libraryKind,id:n.dataset.libraryAssetId,text:n.textContent}))`);
  const result = { schemaVersion: 1, projectId, scope: 'ND-1 Library navigation; existing independent reviews', agentProof: 'Separate real semantic agent proof required.' };
  await waitFor(`document.getElementById('connection-label')?.textContent==='Live'&&document.querySelectorAll('[data-library-card]').length>15`, 'Fresh Library inventory');
  const before = await project();
  assert.deepEqual([...new Set((await cards()).map(card => card.kind))].sort(), ['animation', 'assembly', 'image']);
  assert.equal(await evaluate("Boolean(document.querySelector('.activity-panel'))"), false);
  assert.equal(await evaluate("document.querySelectorAll('[data-create-asset-slice]').length"), 0, 'Saved cuts belong in Sources');
  await field('content', 'assembly'); assert.deepEqual((await cards()).map(card => card.id), [assemblyId]);
  await field('use', 'prop'); assert.equal((await cards()).length, 1);
  await field('search', 'no matching Library content'); assert.equal((await cards()).length, 0);
  await waitFor("Boolean(document.querySelector('[data-library-action=\"clear-filters\"]'))", 'Empty results recovery');
  await click('[data-library-action="clear-filters"]');
  await field('search', 'Synthetic animation components');
  assert((await cards()).some(card => card.id === 'asset.animation-graphite'), 'Search must follow the saved source relationship');
  await field('search', 'Library sample');
  const sample = 'asset.library-sample-15', sampleSelector = libraryDetailsSelector('image', sample);
  await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(sampleSelector)});n.scrollIntoView({block:'center'});n.focus({preventScroll:true});})()`); await settle();
  const origin = await evaluate(`({scroll:scrollY,focus:document.activeElement?.dataset.libraryAssetId,search:document.querySelector('[data-library-filter="search"]').value})`);
  assert(origin.scroll > 0, 'Fixture must exercise a real scrolled Library return');
  await navigation.details('image', sample);
  await click('[data-library-action="back"]');
  const returned = await evaluate(`({scroll:scrollY,focus:document.activeElement?.dataset.libraryAssetId,search:document.querySelector('[data-library-filter="search"]').value})`);
  assert.deepEqual(returned, origin, 'Details return must restore search, focus and scroll');
  result.detailReturn = returned;
  await click('[data-library-action="tab"][data-library-tab="pending"]');
  assert.equal(await evaluate("document.querySelectorAll('[data-library-group]').length"), 2, 'Two existing proposals stay independent groups');
  await field('search', 'no pending match');
  await click('[data-library-action="tab"][data-library-tab="assets"]');
  assert.equal(await evaluate("document.querySelector('[data-library-filter=search]').value"), 'Library sample');
  await click('[data-library-action="tab"][data-library-tab="pending"]');
  assert.equal(await evaluate("document.querySelector('[data-library-filter=search]').value"), 'no pending match');
  await field('search', ''); await navigation.assets();
  await field('search', ''); await field('content', 'all'); await field('use', 'all');
  result.independentFilters = true;
  await waitFor("[...document.querySelectorAll('[data-library-card] img')].every(n=>n.complete&&n.naturalWidth>0)", 'Decoded saved card images');
  const previews = await evaluate(`(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};return[...document.querySelectorAll('[data-library-card]')].map(n=>{const link=n.querySelector('[data-library-preview-link]'),img=n.querySelector('img'),box=img?rect(img):null,scale=img?Math.min(box.width/img.naturalWidth,box.height/img.naturalHeight):0;return{id:n.dataset.libraryAssetId,frame:link?rect(link):null,image:img?{fit:getComputedStyle(img).objectFit,width:img.naturalWidth,height:img.naturalHeight,box,painted:{x:box.x+(box.width-img.naturalWidth*scale)/2,y:box.y+(box.height-img.naturalHeight*scale)/2,width:img.naturalWidth*scale,height:img.naturalHeight*scale}}:null};});})()`);
  for (const preview of previews.filter(value => value.image)) {
    assert.equal(preview.image.fit, 'contain', `${preview.id} must preserve its saved image proportions`);
    const { painted } = preview.image, frame = preview.frame;
    assert(painted.x >= frame.x - 1 && painted.y >= frame.y - 1
      && painted.x + painted.width <= frame.x + frame.width + 1
      && painted.y + painted.height <= frame.y + frame.height + 1, `Saved image is clipped by its preview frame: ${JSON.stringify(preview)}`);
  }
  const frames = previews.filter(value => value.frame).map(value => value.frame);
  assert(frames.length >= 3, 'All saved content types need full preview entrances');
  assert(frames.every(frame => frame.width > 0 && frame.height > 0), 'Every preview frame must be visible');
  assert(Math.max(...frames.map(frame => frame.width)) - Math.min(...frames.map(frame => frame.width)) <= 1
    && Math.max(...frames.map(frame => frame.height)) - Math.min(...frames.map(frame => frame.height)) <= 1, 'Saved content shares equal preview frames');
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'), false, 'Library must fit the supported viewport');
  await evaluate('window.scrollTo(0,0)'); await settle();
  await captureCheckpoint('assets');
  result.fullSizePreviews = [];
  for (const [kind, id] of [['image', 'asset.animation-graphite'], ['animation', clipId], ['assembly', assemblyId]]) {
    await navigation.details(kind, id);
    const selector = '[data-library-detail] [data-library-preview-link]';
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)})?.href)`, `${kind} full-size preview link`);
    const link = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});return{href:n.href,target:n.target,rel:n.rel};})()`);
    assert.equal(link.target, '_blank'); assert(link.rel.split(/\s+/).includes('noopener'));
    const expectedPresentation = await evaluate(`(()=>{
      const root=document.querySelector('[data-library-detail]'),art=root.querySelector('[data-library-artwork]'),svg=art.querySelector('svg'),img=art.querySelector('img');
      const image=n=>({url:new URL(n.getAttribute('href'),location.href).href,x:Number(n.getAttribute('x')??0),y:Number(n.getAttribute('y')??0),width:Number(n.getAttribute('width')),height:Number(n.getAttribute('height')),transform:n.getAttribute('transform')??''});
      return{kind:root.dataset.libraryKind,name:root.querySelector('h2')?.textContent,svg:Boolean(svg),
        viewBox:svg?svg.getAttribute('viewBox').trim().split(/\\s+/).map(Number):[0,0,img.naturalWidth,img.naturalHeight],
        images:svg?[...svg.querySelectorAll('image')].map(image):[{url:img.currentSrc||img.src,x:0,y:0,width:img.naturalWidth,height:img.naturalHeight,transform:''}]};
    })()`);
    assert.equal(expectedPresentation.kind, kind);
    if (kind !== 'image') assert.equal(expectedPresentation.svg, true, `${kind} Details must show the exact composition`);
    const oldTargets = new Set((await devtools.send('Target.getTargets')).targetInfos.map(target => target.targetId));
    const point = await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return{x:Math.max(1,Math.min(innerWidth-1,r.x+r.width/2)),y:Math.max(1,Math.min(innerHeight-1,r.y+r.height/2))};})()`);
    // A real browser input gesture is required for target=_blank; scripted
    // HTMLElement.click() is correctly subject to Chrome's popup blocker.
    await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
    await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
    let target; const deadline = Date.now() + 10_000;
    while (Date.now() < deadline && !target) {
      target = (await devtools.send('Target.getTargets')).targetInfos.find(value => !oldTargets.has(value.targetId) && value.type === 'page');
      if (!target) await new Promise(done => setTimeout(done, 50));
    }
    assert(target, `${kind} preview must open a separate browser target`);
    try {
      const attached = await devtools.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
      let loaded = false; const loadDeadline = Date.now() + 8000;
      while (Date.now() < loadDeadline && !loaded) {
        const response = await devtools.send('Runtime.evaluate', { expression: "document.readyState!=='loading'&&document.querySelectorAll('img,image').length>0", returnByValue: true }, attached.sessionId);
        loaded = response.result?.value === true;
        if (!loaded) await new Promise(done => setTimeout(done, 50));
      }
      assert(loaded, `${kind} full-size document must finish loading`);
      const decoded = await devtools.send('Runtime.evaluate', { expression: `Promise.all([...document.querySelectorAll('img,image')].map(async n=>{const url=n.currentSrc||n.src||n.getAttribute('href');const image=new Image();image.src=url;let timer;try{await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Full preview decode timed out')),8000);})]);return{width:image.naturalWidth,height:image.naturalHeight};}finally{clearTimeout(timer);}})).then(images=>{
        const svg=document.querySelector('svg'),img=document.querySelector('img');
        const item=n=>({url:new URL(n.getAttribute('href'),location.href).href,x:Number(n.getAttribute('x')??0),y:Number(n.getAttribute('y')??0),width:Number(n.getAttribute('width')),height:Number(n.getAttribute('height')),transform:n.getAttribute('transform')??''});
        return{images,scripts:document.scripts.length,controls:document.querySelectorAll('button,input,form').length,
          presentation:{title:document.title,svgCount:document.querySelectorAll('svg').length,
            viewBox:svg?svg.getAttribute('viewBox').trim().split(/\\s+/).map(Number):img?[0,0,img.naturalWidth,img.naturalHeight]:null,
            images:svg?[...document.querySelectorAll('image')].map(item):img?[{url:img.currentSrc||img.src,x:0,y:0,width:img.naturalWidth,height:img.naturalHeight,transform:''}]:[]}};
      })`, awaitPromise: true, returnByValue: true }, attached.sessionId);
      assert.equal(decoded.exceptionDetails, undefined, JSON.stringify(decoded.exceptionDetails));
      assert(decoded.result.value.images.length > 0 && decoded.result.value.images.every(image => image.width > 0 && image.height > 0), `${kind} full-size target must decode real pixels`);
      assert.equal(decoded.result.value.scripts, 0); assert.equal(decoded.result.value.controls, 0);
      const actualPresentation = decoded.result.value.presentation;
      if (kind !== 'image') assert.equal(actualPresentation.svgCount, 1, `${kind} full-size must retain its SVG composition rather than a component image`);
      if (actualPresentation.svgCount) {
        const label = { image: 'Image', animation: 'Animation', assembly: 'Assembly' }[kind];
        assert.equal(actualPresentation.title, `${expectedPresentation.name} — Saved ${label}`, 'The opened full-size document must identify this exact saved content kind');
      }
      assert.deepEqual(actualPresentation.viewBox, expectedPresentation.viewBox, `${kind} full-size frame must match the selected detail`);
      assert.deepEqual(actualPresentation.images, expectedPresentation.images, `${kind} full-size must preserve every exact image URL, painter order, dimension, offset and transform`);
      assert.equal(decoded.result.value.images.length, expectedPresentation.images.length, 'A missing component or unrelated extra image cannot pass full-size evidence');
      result.fullSizePreviews.push({ kind, exactDetailPresentation: true, ...decoded.result.value });
    } finally { await devtools.send('Target.closeTarget', { targetId: target.targetId }); await devtools.send('Page.bringToFront', {}, sessionId); }
    const edit = '[data-library-action="edit"]';
    await click(edit);
    const back = kind === 'image' ? '[data-asset-editor-action="back"]' : kind === 'animation' ? '[data-animation-action="back"]' : '[data-assembly-action="back"]';
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(back)}))`, `${kind} contextual editor`);
    await click(back); await waitFor("Boolean(document.querySelector('[data-library-detail]'))", `${kind} editor returns to detail`);
    await navigation.assets();
  }
  await click('[data-library-action="add-from-sources"]');
  await waitFor("document.getElementById('workspace-content')?.dataset.renderedWorkspace==='sources'&&Boolean(document.querySelector('[data-create-asset-slice]'))", 'Source preparation entry');
  await click('[data-workspace="assets"]'); await navigation.assets();
  await click('[data-library-action="create-assembly"]');
  await waitFor("Boolean(document.querySelector('[data-assembly-canvas]'))", 'Library Create Assembly entry');
  await click('[data-assembly-action="back"]'); await navigation.assets();
  assert.deepEqual(await project(), before, 'Navigation, preview and clean editor entrances must not save revisions');
  result.readOnlyNavigation = true; result.editorEntrances = ['image', 'animation', 'assembly'];
  await navigation.review('assembly', proposalId);
  const review = `[data-assembly-proposal="${proposalId}"]`, control = suffix => `${review} ${suffix}`;
  await waitFor(`Boolean(document.querySelector(${JSON.stringify(control('[data-assembly-review-canvas]'))}))`, 'Existing exact Assembly review');
  await click(control('[data-assembly-review-side="current"]'));
  const feedback = 'Library test feedback survives a current-content detail detour.';
  await evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(control('[data-assembly-review-feedback]'))});n.value=${JSON.stringify(feedback)};n.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click(control('[data-assembly-review-details="current"]'));
  await waitFor("Boolean(document.querySelector('[data-library-detail]'))", 'Current review detail');
  await click('[data-library-action="back"]');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(control('[data-assembly-review-feedback]'))})?.value`), feedback);
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(control('[data-assembly-review-side="current"]'))})?.getAttribute('aria-pressed')`), 'true');
  assert.deepEqual(await project(), before);
  result.reviewDetailRetention = true; await captureCheckpoint('review-return');
  await evaluate(`window.__libraryReviewAudit={fetch:window.fetch,requests:[],drop:true};window.fetch=async function(input,options){const a=window.__libraryReviewAudit,url=String(input);if((options?.method??'GET').toUpperCase()==='POST'&&url.includes('/assembly-proposals/')&&url.endsWith('/resolve')){a.requests.push(String(options.body));const response=await a.fetch.call(this,input,options);if(a.drop&&response.ok){a.drop=false;await response.clone().text();throw new TypeError('Synthetic lost Library decision receipt');}return response;}return a.fetch.call(this,input,options);};`);
  try {
    await click(control('[data-assembly-review-action="ACCEPT"]'));
    await waitFor(`document.querySelector(${JSON.stringify(review)})?.dataset.assemblyReviewStatus==='uncertain'`, 'Unconfirmed Library review');
    await evaluate("document.querySelector('[data-library-action=back]')?.click()"); await settle();
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(review)})?.dataset.assemblyReviewStatus`), 'uncertain', 'Back must preserve an unresolved decision');
    await click(control('[data-assembly-review-action="check"]'));
    await waitFor(`document.querySelector(${JSON.stringify(review)})?.textContent.includes('Retry the exact decision')`, 'No inferred receipt after refresh');
    await click(control('[data-assembly-review-action="retry"]'));
    await waitFor(`document.querySelector(${JSON.stringify(review)})?.dataset.assemblyReviewStatus==='done'`, 'Exact Library review retry');
    const requests = await evaluate('window.__libraryReviewAudit.requests'); assert.equal(requests.length, 2); assert.equal(requests[0], requests[1]);
    const after = await project(); assert.equal(after.revision, before.revision + 1);
    assert.equal(after.snapshot.assemblyLibrary.proposals.find(proposal => proposal.proposalId === proposalId).status, 'ACCEPTED');
    assert.deepEqual(after.snapshot.assetLibrary, before.snapshot.assetLibrary); assert.deepEqual(after.snapshot.clipLibrary, before.snapshot.clipLibrary);
    await navigation.assets(); await click('[data-library-action="tab"][data-library-tab="pending"]');
    assert.equal(await evaluate("document.querySelectorAll('[data-library-group]').length"), 1);
    await click('[data-workspace="activity"]');
    const history = libraryReviewSelector('assembly', proposalId);
    await waitFor(`Boolean(document.querySelector(${JSON.stringify(history)}))`, 'Completed review Activity entry');
    await click(history); await waitFor(`Boolean(document.querySelector(${JSON.stringify(review)}))`, 'Completed review history');
    assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(review + ' [data-assembly-review-action="ACCEPT"]:not(:disabled), ' + review + ' [data-assembly-review-action="REQUEST_CHANGES"]:not(:disabled), ' + review + ' [data-assembly-review-action="DISCARD"]:not(:disabled)')}).length`), 0);
    assert.deepEqual(await project(), after, 'History inspection must not save or repeat decisions');
    result.exactUncertainReviewReplay = true; result.completedReviewHistory = true; await captureCheckpoint('history');
  } finally { await evaluate('window.fetch=window.__libraryReviewAudit.fetch;delete window.__libraryReviewAudit;'); }
  return result;
}
