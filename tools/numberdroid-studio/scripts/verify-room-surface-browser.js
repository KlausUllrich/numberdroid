import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { closeBrowserAndRemoveProfile, finishCapture, trackProcessClose } from './browser-process-teardown.js';
import { openDevtoolsSocket, waitForDevtoolsEndpoint } from './browser-devtools-startup.js';

const [chromePath, output] = process.argv.slice(2);
if (process.argv.length !== 4 || !isAbsolute(chromePath ?? '') || !isAbsolute(output ?? '')) {
  throw new Error('Usage: verify-room-surface-browser.js ABSOLUTE_CHROME ABSOLUTE_NEW_OUTPUT');
}

const PROJECT_ID = 'numberdroid-studio-checkpoint-2b';
const EMPTY_ROOM_ID = 'room.surface.empty';
const OVERLAP_ROOM_ID = 'room.surface.overlap';
const OWNER = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
const outputDirectory = resolve(output);
await mkdir(outputDirectory, { recursive: false });
const dataRoot = await mkdtemp(join(tmpdir(), 'numberdroid-room-surface-browser-'));
const cancellation = new AbortController();
const cancel = () => cancellation.abort(new Error('Room Surface browser verification cancelled.'));
process.once('SIGTERM', cancel); process.once('SIGINT', cancel);

const closeServer = running => new Promise((done, reject) => running.server.close(error => error ? reject(error) : done()));
const projectFingerprint = view => createHash('sha256').update(JSON.stringify({ revision: view.revision, snapshot: view.snapshot })).digest('hex');
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));

function surfaceMetadata() {
  return {
    role: 'base', tags: ['surface-browser'], variantGroup: 'surface-browser', compatibilityGroups: ['surface-browser'],
    spanTiles: { width: 1, height: 1 }, anchor: { x: 0, y: 0 }, attachment: 'ground', rotationPolicy: 'cardinal',
    placement: { modes: ['manual'], wallSafe: true, tags: ['surface-browser'], confirmation: 'confirmed' },
    collision: { mode: 'none', bounds: null, parts: [] }, navigation: { effect: 'passable', cost: null }, runtimeEligible: true,
    connectors: [], continuityProfile: null, continuityTags: ['surface-browser'], selectionPriority: 1,
    visualWeight: 'medium', extensions: {},
  };
}

function intentTrace() {
  return ['game_design', 'level_design', 'room_design'].map(layer => ({
    layer, ruleId: `surface-browser:${layer}`, summary: 'Exercise deterministic Surface tools.', disposition: 'governing',
  }));
}

async function execute(running, type, suffix, payload) {
  const { revision } = await running.studioService.readProjectTrusted(PROJECT_ID);
  return running.studioService.execute({ schemaVersion: 1, commandId: `surface.browser.${suffix}.${revision}`,
    idempotencyKey: `surface.browser.${suffix}.${revision}`, type, projectId: PROJECT_ID,
    baseRevision: revision, expectedVersion: revision, dryRun: false, payload }, OWNER);
}

async function prepareFixture(directory) {
  const prepare = fileURLToPath(new URL('./prepare-checkpoint-2b-visual-evidence.js', import.meta.url));
  await promisify(execFile)(process.execPath, [prepare, directory], { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
  const running = await startStudioHttpServer({ dataDirectory: directory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null });
  try {
    const initial = await running.studioService.readProjectTrusted(PROJECT_ID);
    assert.equal(initial.revision, 7);
    const slices = initial.snapshot.atlases[0].sliceHeads.slice(0, 2);
    const proposalId = 'proposal.surface-browser';
    const items = slices.map((slice, index) => ({ itemId: `item.surface.${index}`, operation: 'create',
      assetId: `asset.surface.${index}`, expectedAssetVersion: 0, expectedMetadataVersion: 0,
      sliceId: slice.sliceId, expectedSliceVersion: slice.version, name: `Surface ${index + 1}`, kind: 'surface', metadata: surfaceMetadata() }));
    await execute(running, 'asset.proposal.submit', 'asset-submit', { proposalId, expectedRevision: 7, items });
    await execute(running, 'asset.proposal.decide', 'asset-decide', { proposalId, expectedProposalVersion: 1,
      decisions: items.map(({ itemId }) => ({ itemId, disposition: 'ACCEPTED', reason: null })) });
    await execute(running, 'asset.proposal.apply', 'asset-apply', { proposalId, expectedProposalVersion: 2 });
    await execute(running, 'room.archetype.create', 'archetype', {
      roomArchetypeId: 'archetype.surface-browser', kind: 'room', displayName: 'Surface browser room', tags: [],
      dimensionPolicy: { width: { min: 3, preferred: 6, max: 8 }, height: { min: 3, preferred: 6, max: 8 } },
      structuralBands: { left: 0, right: 0, top: 0, bottom: 0 }, orientation: 'any',
      connectorPolicy: { min: 0, max: 8, requiredSides: [] }, allowedAssetKinds: ['surface', 'prop', 'item'],
      allowedTags: [], requiredTags: [], rationality: 'neutral', governingRuleRefs: [],
    });
    const base = { roomArchetypeId: 'archetype.surface-browser', archetypeVersion: 1, width: 6, height: 6,
      intentTrace: intentTrace(), connectors: [] };
    await execute(running, 'room.variant.create', 'empty-room', { ...base, roomVariantId: EMPTY_ROOM_ID, displayName: 'Surface tools room', placements: [] });
    const assets = (await running.studioService.readProjectTrusted(PROJECT_ID)).snapshot.assetLibrary.assets;
    const pin = assetId => assets.find(asset => asset.assetId === assetId);
    const placement = (placementId, asset) => ({ placementId, assetId: asset.assetId, assetVersion: asset.assetVersion,
      metadataVersion: asset.metadataVersion, layer: 'STRUCTURAL_SURFACE', anchor: { x: 1, y: 1 }, rotation: 0,
      variantTag: null, proposalId: null, proposalItemId: null });
    await execute(running, 'room.variant.create', 'overlap-room', { ...base, roomVariantId: OVERLAP_ROOM_ID,
      displayName: 'Overlap repair room', placements: [placement('surface.overlap.a', pin('asset.surface.0')), placement('surface.overlap.b', pin('asset.surface.1'))] });
    return await running.studioService.readProjectTrusted(PROJECT_ID);
  } finally { await closeServer(running); }
}

async function browserCapture({ running, width }) {
  const profile = await mkdtemp(join(tmpdir(), 'numberdroid-room-surface-chrome-'));
  const child = spawn(chromePath, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--lang=en-US', '--force-device-scale-factor=1',
    `--window-size=${width},900`, '--remote-debugging-port=0', '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const tracked = trackProcessClose(child), pending = new Map(), exceptions = [], requests = [], responses = [], dialogs = [];
  let nextId = 0, socket, sessionId, shuttingDown = false, failure = null, dropNextApply = false;
  const failPending = error => { failure ??= error; for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); } pending.clear(); };
  const devtools = { send(method, params = {}, targetSession = sessionId) {
    if (!shuttingDown && (failure || cancellation.signal.aborted)) return Promise.reject(failure ?? cancellation.signal.reason);
    const id = ++nextId;
    return new Promise((done, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} exceeded its ten-second deadline.`)); }, 10_000);
      pending.set(id, { done, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(targetSession ? { sessionId: targetSession } : {}) }));
    });
  } };
  const evaluate = async (expression, awaitPromise = true) => {
    const response = await devtools.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? 'Browser evaluation failed.');
    return response.result.value;
  };
  const until = async (expression, label, timeout = 15_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = await evaluate(expression); if (value) return value; await delay(50); }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const untilValue = async (read, predicate, label, timeout = 15_000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const value = read(); if (predicate(value)) return value; await delay(50); }
    throw new Error(`Timed out waiting for ${label}.`);
  };
  const click = selector => evaluate(`(() => { const value=document.querySelector(${JSON.stringify(selector)}); if(!value) return false; value.click(); return true; })()`);
  const setChecked = (selector, checked = true) => evaluate(`(() => { const value=document.querySelector(${JSON.stringify(selector)}); if(!value || value.disabled) return false; if(value.checked!==${checked}) { value.checked=${checked}; value.dispatchEvent(new Event('change',{bubbles:true})); } return true; })()`);
  const setSelect = (selector, value) => evaluate(`(() => { const control=document.querySelector(${JSON.stringify(selector)}); if(!control) return false; control.value=${JSON.stringify(value)}; control.dispatchEvent(new Event('change',{bubbles:true})); return control.value; })()`);
  const cellSelector = (x, y) => `[data-room-board] [data-room-control="cell"][data-x="${x}"][data-y="${y}"]`;
  const drag = async (from, to, modifiers = 0) => {
    const boxes = await evaluate(`(() => [${JSON.stringify(cellSelector(from.x, from.y))},${JSON.stringify(cellSelector(to.x, to.y))}].map(selector => { const r=document.querySelector(selector).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; }))()`);
    await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxes[0].x, y: boxes[0].y, button: 'left', buttons: 1, clickCount: 1, modifiers });
    await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: boxes[1].x, y: boxes[1].y, button: 'left', buttons: 1, modifiers });
    await devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxes[1].x, y: boxes[1].y, button: 'left', buttons: 0, clickCount: 1, modifiers });
  };
  const version = () => evaluate(`(() => { const match=/room version (\\d+)/.exec(document.querySelector('.room-header-technical code')?.textContent||''); return match?Number(match[1]):null; })()`);
  let captureError = null, result;
  try {
    const startup = await waitForDevtoolsEndpoint(child, { trackedClose: tracked, signal: cancellation.signal, timeoutMs: 30_000 });
    socket = await openDevtoolsSocket(startup.url, { signal: cancellation.signal });
    socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.id) { const item = pending.get(message.id); if (!item) return; clearTimeout(item.timer); pending.delete(message.id); if (message.error) item.reject(new Error(message.error.message)); else item.done(message.result); return; }
      if (message.method === 'Runtime.exceptionThrown' && exceptions.length < 100) exceptions.push(message.params.exceptionDetails);
      if (message.method === 'Network.requestWillBeSent') requests.push({ time: Date.now(), method: message.params.request.method, url: message.params.request.url, postData: message.params.request.postData ?? null });
      if (message.method === 'Network.responseReceived') responses.push({ time: Date.now(), status: message.params.response.status, url: message.params.response.url });
      if (message.method === 'Page.javascriptDialogOpening') { dialogs.push(message.params.message); void devtools.send('Page.handleJavaScriptDialog', { accept: true }); }
      if (message.method === 'Fetch.requestPaused') {
        const request = message.params.request;
        if (dropNextApply && request.url.includes('/surfaces-apply') && message.params.responseStatusCode) {
          dropNextApply = false; void devtools.send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'Aborted' });
        } else void devtools.send('Fetch.continueRequest', { requestId: message.params.requestId });
      }
    });
    socket.addEventListener('close', () => { if (!shuttingDown) failPending(new Error('Chrome DevTools closed before Surface capture completed.')); });
    const target = await devtools.send('Target.createTarget', { url: 'about:blank' }, undefined);
    ({ sessionId } = await devtools.send('Target.attachToTarget', { targetId: target.targetId, flatten: true }, undefined));
    await Promise.all([devtools.send('Page.enable'), devtools.send('Runtime.enable'), devtools.send('Network.enable'),
      devtools.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })]);
    await devtools.send('Page.navigate', { url: `http://127.0.0.1:${running.address.port}/#rooms` });
    await until(`document.querySelector('[data-room-card="${EMPTY_ROOM_ID}"] [data-room-nav-action="open-room"]') !== null`, 'Surface room card');
    await click(`[data-room-card="${EMPTY_ROOM_ID}"] [data-room-nav-action="open-room"]`);
    await until(`document.querySelector('[data-room-board]') !== null`, 'Room canvas');
    await click('[data-room-control="editor-tool"][data-editor-tool="SURFACE"]');
    await until(`document.querySelector('[data-surface-tools] input[data-surface-pool-pin]:not(:disabled)') !== null`, 'READY Surface choices');
    await evaluate(`(() => {
      const shell=document.querySelector('.room-editor-shell'), dock=document.querySelector('.room-editor-dock');
      const tools=document.querySelector('[data-surface-tools]');
      shell.scrollIntoView({block:'start'});
      dock.scrollTop += tools.getBoundingClientRect().top - dock.getBoundingClientRect().top;
    })()`);
    await delay(100);
    const horizontalOverflow = await evaluate('document.documentElement.scrollWidth > window.innerWidth');
    assert.equal(horizontalOverflow, false, `${width}px Surface workspace must not overflow horizontally.`);
    const simultaneousToolCanvasPixels = await evaluate(`(() => {
      const board=document.querySelector('[data-room-board]').getBoundingClientRect();
      const tools=document.querySelector('[data-surface-tools]').getBoundingClientRect();
      return Math.max(0, Math.min(board.bottom, tools.bottom, window.innerHeight) - Math.max(board.top, tools.top, 0));
    })()`);
    assert.ok(simultaneousToolCanvasPixels >= 80,
      `${width}px must show actionable Surface controls and the canvas together (only ${simultaneousToolCanvasPixels}px overlap).`);
    const firstPin = await evaluate(`document.querySelector('[data-surface-tools] input[data-surface-pool-pin]:not(:disabled)').dataset.surfacePoolPin`);
    assert.equal(await setChecked(`[data-surface-pool-pin="${firstPin}"]`), true);
    await evaluate('window.__surfaceBoard=document.querySelector("[data-room-board]")');
    const paintStart = requests.length;
    await click(cellSelector(0, 0)); await click(cellSelector(1, 0));
    await until(`document.querySelectorAll('.room-placement.structural_surface').length===2 && /Saved/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'queued paint saves', 30_000);
    assert.equal(await evaluate('window.__surfaceBoard===document.querySelector("[data-room-board]")'), true, 'Paint must retain the canvas node.');
    const paintRequests = requests.slice(paintStart);
    const immediateProjectGets = paintRequests.filter(value => value.method === 'GET' && /\/api\/projects\//.test(value.url));
    assert.ok(immediateProjectGets.length < 5, `Surface paint regressed to whole-workspace GET churn (${immediateProjectGets.length}).`);
    const afterPaintVersion = await version();
    await click(cellSelector(0, 0));
    await until(`/Already matches/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'paint no-op');
    assert.equal(await version(), afterPaintVersion, 'No-op paint must not create a room version.');

    await devtools.send('Fetch.enable', { patterns: [{ urlPattern: '*surfaces-apply', requestStage: 'Response' }] }); dropNextApply = true;
    await click(cellSelector(2, 0));
    await until(`/Save not confirmed/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'unknown result guidance', 30_000);
    await devtools.send('Fetch.disable');
    await click('[data-surface-action="retry-same-surface-change"]');
    await until(`document.querySelectorAll('.room-placement.structural_surface').length===3 && /Saved/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'exact unknown-result replay', 30_000);

    await click('[data-surface-action="fill"]');
    await until(`document.querySelector('[data-surface-action="preview-fill"]') !== null`, 'Fill controls');
    const pins = await evaluate(`[...document.querySelectorAll('[data-surface-pool-pin]:not(:disabled)')].map(value=>value.dataset.surfacePoolPin)`);
    for (const pin of pins) assert.equal(await setChecked(`[data-surface-pool-pin="${pin}"]`, true), true);
    assert.equal(await setSelect('select[aria-label="Fill area"]', 'selection'), 'selection');
    await drag({ x: 0, y: 1 }, { x: 2, y: 2 });
    await drag({ x: 3, y: 1 }, { x: 3, y: 2 }, 8);
    assert.equal(await evaluate(`document.querySelectorAll('[data-surface-selected="true"]').length`), 8);
    await click('[data-surface-action="preview-fill"]');
    await until(`/Preview only/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'stable fill preview', 30_000);
    const previewCount = await evaluate(`document.querySelectorAll('.room-surface-preview').length`);
    await evaluate(`window.dispatchEvent(new Event('resize'))`); await delay(100);
    assert.equal(await evaluate(`document.querySelectorAll('.room-surface-preview').length`), previewCount, 'Passive render must not reshuffle preview.');
    const previewFingerprints = () => requests.filter(value => value.url.includes('/surfaces-preview') && value.postData).map(value => JSON.parse(value.postData).planFingerprint);
    const stableFingerprint = previewFingerprints().at(-1);
    const stablePreviewRequestCount = previewFingerprints().length;
    await click('[data-surface-action="shuffle"]');
    const shuffledFingerprints = await untilValue(previewFingerprints,
      values => values.length > stablePreviewRequestCount && values.at(-1) !== stableFingerprint,
      'distinct shuffled fill request', 30_000);
    const shuffledFingerprint = shuffledFingerprints.at(-1);
    assert.notEqual(shuffledFingerprint, stableFingerprint, 'Shuffle must request a distinct exact plan.');
    await until(`!document.querySelector('[data-surface-action="cancel"]')?.disabled
      && /Preview only/.test(document.querySelector('.room-surface-status')?.textContent||'')`,
    'completed shuffled fill preview', 30_000);
    const beforeCancelVersion = await version();
    await click('[data-surface-action="cancel"]');
    await until(`document.querySelectorAll('.room-surface-preview').length===0
      && /Preview cancelled/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'cancelled fill preview');
    assert.equal(await version(), beforeCancelVersion, 'Cancel must not create a room version.');
    await click('[data-surface-action="preview-fill"]');
    await until(`/Preview only/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'fill preview after cancel', 30_000);
    await click('[data-surface-action="apply-fill"]');
    await until(`document.querySelectorAll('.room-placement.structural_surface').length===11 && /Saved/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'fill apply', 30_000);
    await click('[data-surface-action="undo-last-surface-change"]');
    await until(`document.querySelectorAll('.room-placement.structural_surface').length===3 && /undone/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'one-step undo', 30_000);

    await setSelect('[data-room-variant-select]', OVERLAP_ROOM_ID);
    await until(`document.querySelector('.room-surface-overlaps') !== null`, 'visible overlap repair');
    await click('.room-surface-overlaps [data-surface-action^="cell-"]');
    await until(`document.querySelector('.room-surface-overlaps [data-surface-action^="keep-"]') !== null`, 'explicit keep choices');
    await click('.room-surface-overlaps [data-surface-action^="keep-"]');
    await until(`document.querySelectorAll('.room-placement.structural_surface').length===1 && /Saved/.test(document.querySelector('.room-surface-status')?.textContent||'')`, 'overlap repair save', 30_000);
    assert.ok(dialogs.some(value => value.includes('Library assets are not deleted')), 'Repair must confirm its whole-placement consequence.');
    assert.deepEqual(exceptions, [], 'Native browser raised an unhandled runtime error.');

    const screenshot = await devtools.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(join(outputDirectory, `room-surfaces-${width}.png`), Buffer.from(screenshot.data, 'base64'), { flag: 'wx' });
    result = { schemaVersion: 1, width, queuedPaint: true, paintNoOp: true, unknownResultReplay: true,
      retainedCanvas: true, immediateProjectGetCount: immediateProjectGets.length, selectionCells: 8,
      previewStableAcrossResize: true, shuffleChangedFingerprint: true, cancelPreservedSavedState: true,
      fillApplied: true, undoRestoredPriorSurfaceSet: true, overlapRepairConfirmed: true, horizontalOverflow: false,
      simultaneousToolCanvasPixels };
    await writeFile(join(outputDirectory, `room-surfaces-${width}.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    captureError = error;
    let browserState = null;
    try {
      browserState = await evaluate(`({
        status: document.querySelector('.room-surface-status')?.textContent ?? null,
        room: document.querySelector('.room-header-technical code')?.textContent ?? null,
        selectedCells: document.querySelectorAll('[data-surface-selected="true"]').length,
        previews: document.querySelectorAll('.room-surface-preview').length,
        boardRect: document.querySelector('[data-room-board]')?.getBoundingClientRect().toJSON() ?? null,
        dockRect: document.querySelector('.room-editor-dock')?.getBoundingClientRect().toJSON() ?? null,
        toolsRect: document.querySelector('[data-surface-tools]')?.getBoundingClientRect().toJSON() ?? null,
      })`);
    } catch { /* The retained fixture path remains available if Chrome already failed. */ }
    await writeFile(join(outputDirectory, `room-surfaces-${width}-failure.json`), `${JSON.stringify({
      schemaVersion: 1, width, error: error.message, browserState, exceptions,
      requests: requests.slice(-20), responses: responses.slice(-20),
    }, null, 2)}\n`, { flag: 'wx' });
  }
  finally {
    shuttingDown = true;
    await finishCapture(captureError, [() => closeBrowserAndRemoveProfile({ child, trackedClose: tracked,
      requestBrowserClose: () => socket ? devtools.send('Browser.close', {}, null) : Promise.resolve(),
      closeConnection: () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Capture connection closed.')); } pending.clear(); socket?.close(); },
      removeProfile: () => rm(profile, { recursive: true, force: true }),
    })]);
  }
  return result;
}

let complete = false;
try {
  for (const width of [1440, 1060]) {
    cancellation.signal.throwIfAborted();
    const dataDirectory = join(dataRoot, `fixture-${width}`);
    const fixture = await prepareFixture(dataDirectory);
    const options = { dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null };
    let running = await startStudioHttpServer(options), saved;
    try { await browserCapture({ running, width }); saved = await running.studioService.readProjectTrusted(PROJECT_ID); }
    finally { await closeServer(running); }
    running = await startStudioHttpServer(options);
    try {
      const reopened = await running.studioService.readProjectTrusted(PROJECT_ID);
      assert.equal(projectFingerprint(reopened), projectFingerprint(saved), 'Surface project changed across server restart.');
      assert.ok(reopened.revision > fixture.revision);
      await writeFile(join(outputDirectory, `room-surfaces-${width}-restart.json`), `${JSON.stringify({ schemaVersion: 1,
        width, projectId: PROJECT_ID, revision: reopened.revision, identicalAfterRestart: true,
        semanticFingerprint: projectFingerprint(reopened) }, null, 2)}\n`, { flag: 'wx' });
    } finally { await closeServer(running); }
  }
  complete = true;
} finally {
  process.removeListener('SIGTERM', cancel); process.removeListener('SIGINT', cancel);
  if (complete) {
    await rm(dataRoot, { recursive: true, force: true });
    await assert.rejects(lstat(dataRoot), { code: 'ENOENT' });
    await writeFile(join(outputDirectory, 'room-surfaces-teardown.json'), `${JSON.stringify({ schemaVersion: 1,
      browserProfilesClosedBeforeRemoval: 2, serverClosuresBeforeRemoval: 6,
      temporaryDataRoot: dataRoot, temporaryDataRemovedAfterWritersClosed: true }, null, 2)}\n`, { flag: 'wx' });
  } else process.stderr.write(`Room Surface verification data retained at ${dataRoot}\n`);
}
