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
  await evaluate(`(() => { const original = window.fetch.bind(window); window.__roomCreationAudit = { posts: [], confirms: [] }; window.fetch = async (input, options) => { const pathname = new URL(typeof input === 'string' ? input : input.url, location.href).pathname; if ((options?.method ?? 'GET').toUpperCase() === 'POST') window.__roomCreationAudit.posts.push({ pathname, body: JSON.parse(options.body ?? '{}') }); return original(input, options); }; window.confirm = (message) => { window.__roomCreationAudit.confirms.push(message); return true; }; })()`);
  let firstRoomBefore = null; let immediateSecondContext = null; let dirtyGuard = null;
  if (!reopened) {
    assert.equal((await read()).revision, 1);
    assert.equal(await evaluate(`document.querySelector('[data-room-form="archetype"]')?.closest('details')?.open`), true, 'First Room template must be open');
    await capture('first-template', '[data-room-form="archetype"]');
    await fill('archetype', { displayName: 'Browser Room template', kind: 'room', width: '8', height: '6' });
    await click('[data-room-form="archetype"] button[type="submit"]');
    await waitFor(`document.querySelector('[data-room-form="variant"] [name="roomArchetypeId"]')?.options.length === 1`, 'Saved first template');
    assert.equal((await read()).revision, 2);
    assert.equal(await evaluate(`document.querySelector('[data-room-form="variant"]')?.closest('details')?.open`), true, 'First Room form must open after template creation');
    await fill('variant', { displayName: 'First browser Room', width: '8', height: '6' });
    await click('[data-room-form="variant"] button[type="submit"]');
    await waitFor(`document.querySelectorAll('.room-cell').length === 48`, 'First saved Room');
    let saved = await read(); assert.equal(saved.revision, 3);
    firstRoomBefore = structuredClone(saved.snapshot.roomLibrary.variants[0]);
    checkContext(await context(), firstRoomBefore.versions[0]);
    await captureCreationLanding('first-room', firstRoomBefore.versions[0]);
    await capture('first-room', '[data-room-board]');
    await click('[data-room-control="editor-tool"][data-editor-tool="PROP"]');
    await evaluate(`(() => { const zoom = document.querySelector('[data-room-zoom-slider]'); zoom.value = '200'; zoom.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await click('[data-room-control="connector-select"]');
    await click('[data-room-control="editor-panel"][data-editor-panel="properties"]');
    await fill('variant', { displayName: 'Second browser Room', width: '11', height: '7' });
    await click('[data-room-form="variant"] button[type="submit"]');
    // Wait for command completion, never for a passive refresh to repair context.
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 4' && document.querySelector('[data-room-form="variant"] button[type="submit"]')?.disabled === false`, 'Second Room command completion');
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
    await click('[data-room-form="resize"] button[type="submit"]');
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 5' && document.querySelectorAll('.room-cell').length === 84`, 'Immediate second Room edit');
    saved = await read();
    assert.deepEqual(saved.snapshot.roomLibrary.variants.find((entry) => entry.roomVariantId === firstRoomBefore.roomVariantId), firstRoomBefore, 'The immediate edit altered Room1');
    await click('[data-room-control="editor-tool"][data-editor-tool="PAINT_VOID"]');
    await click('[data-room-control="cell"][data-x="2"][data-y="2"]');
    const postsBefore = await evaluate('window.__roomCreationAudit.posts.length');
    await click('[data-room-control="editor-panel"][data-editor-panel="properties"]');
    await fill('variant', { displayName: 'Must not create while dirty', width: '6', height: '6' });
    await evaluate(`document.querySelector('[data-room-form="variant"] button[type="submit"]')?.click()`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
    dirtyGuard = { postsBefore, postsAfter: await evaluate('window.__roomCreationAudit.posts.length'), revision: (await read()).revision };
    assert.equal(dirtyGuard.postsAfter, postsBefore); assert.equal(dirtyGuard.revision, 5);
    await click('[data-room-control="shape-reset"]');
  } else {
    const saved = await read(); const second = saved.snapshot.roomLibrary.variants.find((entry) => entry.versions.at(-1).displayName === 'Second browser Room');
    await evaluate(`(() => { const select = document.querySelector('[data-room-variant-select]'); select.value = ${JSON.stringify(second.roomVariantId)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  }
  const saved = await read(); assert.equal(saved.revision, 5); assert.equal(saved.snapshot.roomLibrary.variants.length, 2);
  const secondEntry = saved.snapshot.roomLibrary.variants.find((entry) => entry.versions.at(-1).displayName === 'Second browser Room');
  const second = secondEntry.versions.find((entry) => entry.version === secondEntry.headVersion);
  assert.equal(second.version, 2); assert.equal(second.width, 12); assert.equal(second.height, 7); assert.equal(second.lifecycle, 'DRAFT');
  checkContext(await context(), second);
  const audit = await evaluate('window.__roomCreationAudit');
  if (reopened) assert.equal(audit.posts.length, 0);
  else assert.equal(audit.posts.filter(({ pathname }) => pathname.endsWith('/rooms')).length, 2);
  await capture(reopened ? 'reopened' : 'edited-second-room', '[data-room-board]', outputPath);
  const errors = devtools.events.filter((event) => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error') || event.method === 'Network.loadingFailed' || (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  if (domPath) await writeFile(domPath, `${await evaluate('document.documentElement.outerHTML')}\n`);
  await writeFile(outputPath.replace(/\.png$/, '.observation.json'), `${JSON.stringify({ schemaVersion: 1, mode: 'room-creation', projectId, reopened, browser: browserVersion.product, revision: saved.revision, immediateSecondContext, creationLandings, dirtyGuard, firstRoomUnchanged: !reopened, secondRoomId: second.roomVariantId, secondRoomVersion: second.version, runtimeNetworkErrors: errors.length, screenshots }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', mode: 'room-creation', width, reopened, screenshotCount: screenshots.length, output: outputPath })}\n`);
}
