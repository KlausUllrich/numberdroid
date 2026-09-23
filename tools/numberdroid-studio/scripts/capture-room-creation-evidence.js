import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function captureRoomCreation({ devtools, sessionId, width, height, pageUrl, outputPath, domPath, browserVersion }) {
  const url = new URL(pageUrl); const projectId = url.searchParams.get('roomCreationProject');
  assert.match(projectId ?? '', /^project\.working\.[0-9a-f-]+$/);
  const reopened = url.searchParams.get('roomCreationPhase') === 'reopen';
  const evaluate = async (expression) => {
    const result = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result?.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((resolveDelay) => setTimeout(resolveDelay, 50)); }
    throw new Error(`${label} did not become ready.`);
  };
  const click = (selector) => evaluate(`(() => { const control = document.querySelector(${JSON.stringify(selector)}); if (!control || control.disabled) throw new Error('Unavailable control: ' + ${JSON.stringify(selector)}); control.scrollIntoView({ block: 'center' }); control.click(); })()`);
  const fill = (kind, fields) => evaluate(`(() => { const form = document.querySelector('[data-room-form="${kind}"]'); if (!form) throw new Error('Missing ${kind} form'); form.closest('details')?.setAttribute('open', ''); for (const [key, value] of Object.entries(${JSON.stringify(fields)})) { const field = form.elements.namedItem(key); if (!field) throw new Error('Missing field ' + key); field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  const read = () => evaluate(`fetch('/api/projects/${projectId}').then((response) => { if (!response.ok) throw new Error('Project read failed'); return response.json(); })`);
  const screenshots = [];
  const creationLandings = [];
  const creationLayouts = [];
  const collectionNavigation = [];
  const discardNavigation = [];
  const creationRecovery = [];
  const resolveDiscard = async (label) => {
    await waitFor(`document.querySelector('[data-room-creation-discard]')?.open === true`, 'Named creation discard dialog');
    const result = await evaluate(`(() => {
      const dialog = document.querySelector('[data-room-creation-discard]');
      const buttons = [...dialog.querySelectorAll('button')];
      const sizes = buttons.map(button => ({ label:button.textContent, height:button.getBoundingClientRect().height, font:Number.parseFloat(getComputedStyle(button).fontSize) }));
      const button = buttons.find(button => button.textContent === ${JSON.stringify(label)}); if (!button) throw new Error('Missing named discard action');
      button.click(); return sizes;
    })()`);
    assert.deepEqual(result.map(button => button.label), ['Keep editing', 'Discard form']);
    for (const button of result) assert.ok(button.height >= 40 && button.font >= 14, 'Discard dialog actions must remain readable');
    await waitFor(`!document.querySelector('[data-room-creation-discard]')`, 'Discard dialog closed');
  };
  const createWithLostResponse = async (kind, endpoint) => {
    const path = `/api/projects/${projectId}/${endpoint}`;
    await evaluate(`(() => {
      const original = window.fetch; window.__roomCreationFault = { original, lost:false, blockReadback:false, requests:[] };
      window.fetch = async (input, options) => {
        const fault=window.__roomCreationFault;
        const pathname=new URL(typeof input==='string'?input:input.url,location.href).pathname;
        const method=(options?.method??'GET').toUpperCase();
        if (method==='GET' && fault.blockReadback && pathname.startsWith(${JSON.stringify(`/api/projects/${projectId}`)})) throw new Error('Synthetic creation readback unavailable');
        if (method==='POST' && pathname===${JSON.stringify(path)}) {
          fault.requests.push({pathname,body:JSON.parse(options.body)});
          const response=await original(input,options);
          if (!fault.lost) { if (!response.ok) throw new Error('Expected successful fixture creation before losing its response'); await response.clone().text(); fault.lost=true; fault.blockReadback=true; throw new Error('Synthetic creation response lost after commit'); }
          return response;
        }
        return original(input,options);
      };
    })()`);
    try {
      await click(`[data-room-form="${kind}"] button[type="submit"]`);
      await waitFor(`document.querySelector('[data-room-form="${kind}"] button[type="submit"]')?.textContent === 'Retry same creation' && !document.querySelector('[data-room-form="${kind}"] button[type="submit"]')?.disabled`, 'Unknown creation result recovery');
      const locked = await evaluate(`({ lost:window.__roomCreationFault.lost, disabled:[...document.querySelectorAll('[data-room-form="${kind}"] input,[data-room-form="${kind}"] select')].every(field=>field.disabled), count:window.__roomCreationFault.requests.length })`);
      assert.equal(locked.lost, true); assert.equal(locked.disabled, true); assert.equal(locked.count, 1);
      await click('[data-room-nav-action="back"]');
      await click('[data-workspace="assets"]');
      await evaluate(`location.hash = 'sources'`);
      await waitFor(`location.hash === '#rooms'`, 'Unresolved creation blocks hash navigation');
      assert.equal(await evaluate(`Boolean(document.querySelector('[data-room-form="${kind}"]')) && !document.querySelector('[data-room-creation-discard]')`), true, 'Unknown result must stay in its original form, not permit discard');
      await evaluate(`window.__roomCreationFault.blockReadback=false`);
      await click(`[data-room-form="${kind}"] button[type="submit"]`);
      await waitFor(`!document.querySelector('[data-room-form="${kind}"]')`, 'Same creation reconciled');
      const requests = await evaluate('window.__roomCreationFault.requests');
      assert.equal(requests.length, 2); assert.deepEqual(requests[1], requests[0], 'Retry must preserve exact body, revision, target ID and idempotency key');
      const saved = await read();
      const names = kind === 'archetype' ? saved.snapshot.roomLibrary.archetypes : saved.snapshot.roomLibrary.variants.flatMap(entry => entry.versions.filter(version => version.version === entry.headVersion));
      assert.equal(names.filter(entry => entry.displayName === (kind === 'archetype' ? 'Browser Room template' : 'First browser Room')).length, 1, 'Lost response retry must create exactly one saved object');
      creationRecovery.push({ kind, exactReplay:true, requestCount:requests.length, savedRevision:saved.revision, fieldsLocked:true, navigationBlocked:true });
    } finally {
      await evaluate(`(() => { const fault=window.__roomCreationFault; if (fault) window.fetch=fault.original; delete window.__roomCreationFault; })()`);
    }
  };
  const checkCollectionReturn = async (room) => {
    await click('[data-room-nav-action="back"]');
    const result = await evaluate(`(async () => {
      const settle = () => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      const set = (selector, value, event) => { const control = document.querySelector(selector); control.value = value; control.dispatchEvent(new Event(event, { bubbles:true })); };
      set('[data-room-nav-filter="search"]', 'First browser', 'input');
      set('[data-room-nav-filter="status"]', 'DRAFT', 'change');
      const geometry = () => Object.fromEntries(['.rooms-nav-heading','.rooms-nav-tabs','.rooms-nav-filters','.rooms-nav-result-count','.rooms-nav-cards'].map(selector => { const r=document.querySelector(selector).getBoundingClientRect(); return [selector,{x:r.left,y:r.top+scrollY}]; }));
      window.scrollTo(0,0); await settle(); const roomsGeometry = geometry();
      document.querySelector('[data-room-nav-action="tab"][data-room-nav-id="templates"]').click(); await settle(); const templatesGeometry = geometry();
      document.querySelector('[data-room-nav-action="tab"][data-room-nav-id="rooms"]').click(); await settle();
      const selector = '[data-room-nav-action="open-room"][data-room-nav-id="' + ${JSON.stringify(room.roomVariantId)} + '"]';
      const card = document.querySelector(selector); card.focus({preventScroll:true}); const beforeScroll = scrollY; card.click(); await settle();
      const editorId = document.querySelector('[data-room-variant-select]')?.value;
      document.querySelector('[data-room-nav-action="back"]').click(); await settle();
      const returned = { search:document.querySelector('[data-room-nav-filter="search"]')?.value,status:document.querySelector('[data-room-nav-filter="status"]')?.value,
        focused:document.activeElement === document.querySelector(selector),scroll:scrollY,editorId,beforeScroll,roomsGeometry,templatesGeometry };
      document.querySelector('[data-room-nav-action="clear-filters"]')?.click();
      set('[data-room-nav-filter="search"]', '', 'input'); set('[data-room-nav-filter="status"]', 'all', 'change');
      document.querySelector(selector).click(); await settle(); return returned;
    })()`);
    assert.equal(result.search, 'First browser'); assert.equal(result.status, 'DRAFT');
    assert.equal(result.editorId, room.roomVariantId); assert.equal(result.focused, true);
    assert.ok(Math.abs(result.scroll - result.beforeScroll) < 1, 'Back must restore collection scroll');
    for (const selector of Object.keys(result.roomsGeometry)) for (const axis of ['x', 'y']) {
      assert.ok(Math.abs(result.roomsGeometry[selector][axis] - result.templatesGeometry[selector][axis]) < 1, `Tab switch moved ${selector} on ${axis}`);
    }
    collectionNavigation.push(result);
  };
  const captureCreationLayout = async (stage) => {
    const layout = await evaluate(`(() => {
      const form = document.querySelector('[data-room-form="archetype"], [data-room-form="variant"]');
      if (!form) throw new Error('The focused creation form is missing');
      const root = form.closest('.room-creation') ?? form.parentElement;
      const bounds = node => { const rect = node.getBoundingClientRect(); return { left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, width:rect.width, height:rect.height }; };
      const contained = (node, parent) => { const a = bounds(node); const b = bounds(parent); return a.left >= b.left - 1 && a.right <= b.right + 1; };
      const number = value => Number.parseFloat(value) || 0;
      const cards = [form].map(card => {
        const submit = form.querySelector('button[type="submit"]');
        const range = document.createRange(); range.selectNodeContents(submit);
        return { bounds:bounds(card),
          form: {
            contained:contained(form, root),
            fields:[...form.querySelectorAll('input, select')].map(node => ({ tag:node.tagName, name:node.name, font:number(getComputedStyle(node).fontSize), height:bounds(node).height, contained:contained(node, form) })),
            labels:[...form.querySelectorAll('label > span')].map(node => ({ text:node.textContent, font:number(getComputedStyle(node).fontSize) })),
            button:{ label:submit.textContent, font:number(getComputedStyle(submit).fontSize), height:bounds(submit).height, textLines:range.getClientRects().length, contained:contained(submit, form), textFits:submit.scrollWidth <= submit.clientWidth + 1 }
          } };
      });
      return { width:innerWidth, inDock:Boolean(root.closest('.room-editor-dock')), root:bounds(root), cards,
        focusedFormCount:document.querySelectorAll('[data-room-form="archetype"], [data-room-form="variant"]').length,
        overflow:document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth };
    })()`);
    assert.equal(layout.cards.length, 1);
    assert.equal(layout.focusedFormCount, 1, `${stage} must show one focused creation action`);
    assert.equal(layout.inDock, false, `${stage} creation must not be buried inside a Room editor`);
    assert.equal(layout.overflow, false, `${stage} must not overflow the page`);
    for (const card of layout.cards) {
      assert.equal(card.form.contained, true);
      assert.equal(card.form.fields.length, 4);
      assert.equal(card.form.labels.length, 4);
      for (const field of card.form.fields) assert.ok(field.font >= 16 && field.height >= 40 && field.contained, `${stage} field is unreadable or clipped: ${JSON.stringify(field)}`);
      for (const label of card.form.labels) assert.ok(label.font >= 13, `${stage} label is too small: ${JSON.stringify(label)}`);
      assert.ok(card.form.button.font >= 16 && card.form.button.height >= 40 && card.form.button.contained && card.form.button.textFits, `${stage} Create action must remain normally sized and contained`);
      assert.equal(card.form.button.textLines, 1, `${stage} Create action must not wrap`);
    }
    creationLayouts.push({ stage, ...layout });
  };
  const captureCreationLanding = async (stage, room) => {
    // Observe the product's own landing before capture() can scroll anything.
    const landing = await evaluate(`(() => {
      const selector = document.querySelector('[data-room-variant-select]');
      const header = document.querySelector('.room-header');
      const bounds = (element) => { const rect = element?.getBoundingClientRect(); return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null; };
      const visible = (rect) => Boolean(rect && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight);
      const headerBounds = bounds(header); const selectorBounds = bounds(selector);
      return { selected: selector?.value, heading: header?.querySelector('h2')?.textContent, selectorFocused: Boolean(selector && document.activeElement === selector), headerBounds, selectorBounds, headerVisible: visible(headerBounds), selectorVisible: visible(selectorBounds), width: innerWidth, height: innerHeight };
    })()`);
    assert.equal(landing.selected, room.roomVariantId); assert.equal(landing.heading, room.displayName);
    assert.equal(landing.selectorFocused, true, `${stage} must focus its new Room selector`);
    assert.equal(landing.headerVisible, true, `${stage} header must be visible without evidence scrolling: ${JSON.stringify(landing)}`);
    assert.equal(landing.selectorVisible, true, `${stage} selector must be visible without evidence scrolling`);
    const path = outputPath.replace(/\.png$/, `-${stage}-landing.png`);
    const image = await devtools.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId, 20_000);
    await writeFile(path, Buffer.from(image.data, 'base64'));
    screenshots.push({ stage: `${stage}-landing`, path, unmodifiedLanding: true, width, height });
    creationLandings.push({ stage, ...landing });
  };
  const capture = async (stage, selector, path = outputPath.replace(/\.png$/, `-${stage}.png`)) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' })`);
    const layout = await evaluate(`({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth })`);
    assert.equal(layout.width, width); assert.equal(layout.height, height); assert.equal(layout.overflow, false, `${stage} overflows horizontally`);
    const image = await devtools.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId, 20_000);
    await writeFile(path, Buffer.from(image.data, 'base64')); screenshots.push({ stage, path, ...layout });
  };
  const context = () => evaluate(`(() => { const board = document.querySelector('[data-room-board]'); return { selected: document.querySelector('[data-room-variant-select]')?.value, heading: document.querySelector('.room-header h2')?.textContent, identity: document.querySelector('.room-header-technical code')?.textContent, width: Number(board?.style.getPropertyValue('--room-width')), height: Number(board?.style.getPropertyValue('--room-height')), cells: board?.querySelectorAll('.room-cell').length, zoom: board?.dataset.zoomMode, tool: document.querySelector('[data-editor-tool][aria-pressed="true"]')?.dataset.editorTool, selectedObjects: document.querySelectorAll('.room-placement[data-selected="true"], .room-connector[data-selected="true"]').length, ghosts: document.querySelectorAll('.room-placement-ghost').length }; })()`);
  const checkContext = (actual, room) => {
    assert.equal(actual.selected, room.roomVariantId); assert.equal(actual.heading, room.displayName);
    assert.ok(actual.identity.includes(room.roomVariantId)); assert.ok(actual.identity.includes(`room version ${room.version}`));
    assert.equal(actual.width, room.width); assert.equal(actual.height, room.height); assert.equal(actual.cells, room.width * room.height);
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await waitFor(`document.getElementById('connection-label')?.textContent === 'Live' && document.getElementById('workspace-content')?.dataset.renderedProjectId === '${projectId}'`, 'Fresh working project');
  await evaluate(`(() => { const original = window.fetch.bind(window); window.__roomCreationOriginals = { fetch:window.fetch, confirm:window.confirm }; window.__roomCreationAudit = { posts: [], confirms: [] }; window.fetch = async (input, options) => { const pathname = new URL(typeof input === 'string' ? input : input.url, location.href).pathname; if ((options?.method ?? 'GET').toUpperCase() === 'POST') window.__roomCreationAudit.posts.push({ pathname, body: JSON.parse(options.body ?? '{}') }); return original(input, options); }; window.confirm = (message) => { window.__roomCreationAudit.confirms.push(message); return true; }; })()`);
  try {
  let firstRoomBefore = null; let immediateSecondContext = null; let dirtyGuard = null;
  if (!reopened) {
    assert.equal((await read()).revision, 1);
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-room-board]'))`), false, 'Rooms opens the collection, not an arbitrary editor');
    await click('[data-room-nav-action="new-template"]');
    await fill('archetype', { displayName:'Unsaved navigation check' });
    await click('[data-room-nav-action="back"]'); await resolveDiscard('Keep editing');
    assert.equal(await evaluate(`document.querySelector('[data-room-form="archetype"] [name="displayName"]')?.value`), 'Unsaved navigation check');
    await evaluate(`location.hash = 'sources'`); await resolveDiscard('Discard form');
    await waitFor(`location.hash === '#sources' && !document.querySelector('[data-room-form="archetype"]')`, 'Discard continues original hash destination');
    discardNavigation.push({ route:'hash', destination:'sources', keepRetained:true, discardContinued:true });
    await click('[data-workspace="rooms"]'); await click('[data-room-nav-action="new-template"]');
    await fill('archetype', { displayName:'Unsaved sidebar check' });
    await click('[data-workspace="assets"]'); await resolveDiscard('Discard form');
    await waitFor(`location.hash === '#assets' && !document.querySelector('[data-room-form="archetype"]')`, 'Discard continues original sidebar destination');
    assert.equal((await read()).revision, 1); assert.equal(await evaluate('window.__roomCreationAudit.posts.length'), 0);
    discardNavigation.push({ route:'sidebar', destination:'assets', discardContinued:true, noWrites:true });
    await click('[data-workspace="rooms"]'); await click('[data-room-nav-action="new-template"]');
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-room-form="archetype"]'))`), true, 'New template opens its focused form');
    await captureCreationLayout('empty-project-template');
    await capture('first-template', '[data-room-form="archetype"]');
    await fill('archetype', { displayName: 'Browser Room template', kind: 'room', width: '8', height: '6' });
    await createWithLostResponse('archetype', 'room-archetypes');
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 2'`, 'Saved first template');
    await click('[data-workspace="rooms"]');
    await click('[data-room-nav-action="tab"][data-room-nav-id="rooms"]');
    await click('[data-room-nav-action="new-room"]');
    await waitFor(`document.querySelector('[data-room-form="variant"] [name="roomArchetypeId"]')?.options.length === 1`, 'Saved first template');
    assert.equal((await read()).revision, 2);
    assert.equal(await evaluate(`Boolean(document.querySelector('[data-room-form="variant"]'))`), true, 'New room opens its focused form');
    await captureCreationLayout('template-saved-first-room');
    await capture('first-room-form', '[data-room-form="variant"]');
    await fill('variant', { displayName: 'First browser Room', width: '8', height: '6' });
    await createWithLostResponse('variant', 'rooms');
    await waitFor(`document.querySelectorAll('.room-cell').length === 48`, 'First saved Room');
    let saved = await read(); assert.equal(saved.revision, 3);
    firstRoomBefore = structuredClone(saved.snapshot.roomLibrary.variants[0]);
    checkContext(await context(), firstRoomBefore.versions[0]);
    await captureCreationLanding('first-room', firstRoomBefore.versions[0]);
    await capture('first-room', '[data-room-board]');
    await checkCollectionReturn(firstRoomBefore.versions[0]);
    await click('[data-room-control="editor-tool"][data-editor-tool="PROP"]');
    await evaluate(`(() => { const zoom = document.querySelector('[data-room-zoom-slider]'); zoom.value = '200'; zoom.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await click('[data-room-control="connector-select"]');
    await click('[data-room-control="editor-panel"][data-editor-panel="properties"]');
    assert.equal(await evaluate(`document.querySelectorAll('[data-room-form="archetype"], [data-room-form="variant"]').length`), 0, 'The focused Room editor has no inline creation forms');
    await click('[data-room-nav-action="back"]');
    await click('[data-room-nav-action="new-room"]');
    await captureCreationLayout('collection-second-room');
    await capture('existing-room-creation', '[data-room-form="variant"]');
    await fill('variant', { displayName: 'Second browser Room', width: '11', height: '7' });
    await click('[data-room-form="variant"] button[type="submit"]');
    // Wait for command completion, never for a passive refresh to repair context.
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 4' && document.querySelector('.room-header h2')?.textContent === 'Second browser Room'`, 'Second Room command completion');
    immediateSecondContext = await context();
    saved = await read(); assert.equal(saved.revision, 4);
    const secondEntry = saved.snapshot.roomLibrary.variants.find((entry) => entry.roomVariantId !== firstRoomBefore.roomVariantId);
    const second = secondEntry.versions.find((entry) => entry.version === secondEntry.headVersion);
    checkContext(immediateSecondContext, second);
    assert.equal(immediateSecondContext.selectedObjects, 0); assert.equal(immediateSecondContext.ghosts, 0);
    assert.equal(immediateSecondContext.zoom, 'fit'); assert.equal(immediateSecondContext.tool, 'SELECT');
    await captureCreationLanding('second-room', second);
    await capture('second-room', '[data-room-board]');
    await click('[data-room-control="editor-panel"][data-editor-panel="properties"]');
    await fill('resize', { width: '12', height: '7' });
    const postsBeforeResize = await evaluate('window.__roomCreationAudit.posts.length');
    await click('[data-room-form="resize"] button[type="submit"]');
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 4' && document.querySelectorAll('.room-cell').length === 84 && document.querySelector('[data-room-control="editor-save"]')?.disabled === false`, 'Immediate local second Room edit');
    assert.equal(await evaluate('window.__roomCreationAudit.posts.length'), postsBeforeResize, 'Resize must remain local until explicit Save');
    assert.equal((await read()).revision, 4);
    await click('[data-room-control="editor-save"]');
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 5' && document.querySelector('[data-room-control="editor-save"]')?.disabled === true`, 'One explicit checked Room save');
    saved = await read();
    assert.deepEqual(saved.snapshot.roomLibrary.variants.find((entry) => entry.roomVariantId === firstRoomBefore.roomVariantId), firstRoomBefore, 'The immediate edit altered Room1');
    await click('[data-room-control="editor-tool"][data-editor-tool="PAINT_VOID"]');
    await click('[data-room-control="cell"][data-x="2"][data-y="2"]');
    const postsBefore = await evaluate('window.__roomCreationAudit.posts.length');
    // Declining a discard decision must retain the actual dirty Room editor.
    await evaluate(`window.confirm = message => { window.__roomCreationAudit.confirms.push(message); return false; }`);
    await click('[data-room-nav-action="back"]');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
    dirtyGuard = { postsBefore, postsAfter: await evaluate('window.__roomCreationAudit.posts.length'), revision: (await read()).revision,
      shapeStillDirty: await evaluate(`document.querySelector('[data-room-control="editor-save"]')?.disabled === false`) };
    assert.equal(dirtyGuard.postsAfter, postsBefore); assert.equal(dirtyGuard.revision, 5);
    assert.equal(dirtyGuard.shapeStillDirty, true, 'Back must retain the unsaved shape when leaving is not confirmed');
    await evaluate(`window.confirm = message => { window.__roomCreationAudit.confirms.push(message); return true; }`);
    await click('[data-room-control="editor-discard"]');
  } else {
    const saved = await read(); const second = saved.snapshot.roomLibrary.variants.find((entry) => entry.versions.at(-1).displayName === 'Second browser Room');
    await click(`[data-room-nav-action="open-room"][data-room-nav-id="${second.roomVariantId}"]`);
  }
  const saved = await read(); assert.equal(saved.revision, 5); assert.equal(saved.snapshot.roomLibrary.variants.length, 2);
  const secondEntry = saved.snapshot.roomLibrary.variants.find((entry) => entry.versions.at(-1).displayName === 'Second browser Room');
  const second = secondEntry.versions.find((entry) => entry.version === secondEntry.headVersion);
  assert.equal(second.version, 2); assert.equal(second.width, 12); assert.equal(second.height, 7); assert.equal(second.lifecycle, 'DRAFT');
  checkContext(await context(), second);
  const audit = await evaluate('window.__roomCreationAudit');
  if (reopened) assert.equal(audit.posts.length, 0);
  else assert.equal(audit.posts.filter(({ pathname }) => pathname.endsWith('/rooms')).length, 3, 'Two Rooms plus the exact first-Room replay');
  await capture(reopened ? 'reopened' : 'edited-second-room', '[data-room-board]', outputPath);
  const errors = devtools.events.filter((event) => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error') || event.method === 'Network.loadingFailed' || (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  if (domPath) await writeFile(domPath, `${await evaluate('document.documentElement.outerHTML')}\n`);
  await writeFile(outputPath.replace(/\.png$/, '.observation.json'), `${JSON.stringify({ schemaVersion: 1, mode: 'room-creation', projectId, reopened, browser: browserVersion.product, revision: saved.revision, immediateSecondContext, creationLandings, creationLayouts, collectionNavigation, discardNavigation, creationRecovery, dirtyGuard, firstRoomUnchanged: !reopened, secondRoomId: second.roomVariantId, secondRoomVersion: second.version, runtimeNetworkErrors: errors.length, screenshots }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', mode: 'room-creation', width, reopened, screenshotCount: screenshots.length, output: outputPath })}\n`);
  } finally {
    await evaluate(`(() => { const original=window.__roomCreationOriginals; if (original) { window.fetch=original.fetch; window.confirm=original.confirm; } delete window.__roomCreationFault; delete window.__roomCreationOriginals; })()`);
  }
}
