import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const PROJECT = 'numberdroid-studio-checkpoint-2b';
const OLD_ROOM = 'room.metadata.pinned';
const MIXED_ROOM = 'room.pinned.mixed';

export async function captureRoomPinnedAssets({ devtools, sessionId, width, height, pageUrl, outputPath, domPath, browserVersion }) {
  const reopened = new URL(pageUrl).searchParams.get('pinnedPhase') === 'reopen';
  const evaluate = async (expression) => { const value = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); assert.equal(value.exceptionDetails, undefined, JSON.stringify(value.exceptionDetails)); return value.result?.value; };
  const waitFor = async (expression, label) => { const deadline = Date.now() + 12_000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((done) => setTimeout(done, 50)); } throw new Error(`${label} did not become ready.`); };
  const click = (selector) => evaluate(`(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (!target || target.disabled) throw new Error('Unavailable ' + ${JSON.stringify(selector)}); target.scrollIntoView({ block: 'center' }); target.click(); })()`);
  const read = () => evaluate(`fetch('/api/projects/${PROJECT}').then((response) => response.json())`);
  const selectRoom = async (roomId, count) => {
    await evaluate(`(() => { const select = document.querySelector('[data-room-variant-select]'); if (select.value !== ${JSON.stringify(roomId)}) { select.value = ${JSON.stringify(roomId)}; select.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
    await evaluate(`document.querySelector('[data-room-board]')?.scrollIntoView({ block: 'center' })`);
    await waitFor(`Boolean(document.querySelector('[data-room-pinned-assets-state="ready"]')) && document.querySelectorAll('.room-placement').length === ${count} && [...document.querySelectorAll('.room-placement img')].length === ${count} && [...document.querySelectorAll('.room-placement img')].every((image) => image.complete && image.naturalWidth > 0)`, 'Exact historical Room images');
  };
  const screenshots = [];
  const capture = async (stage, path = outputPath.replace(/\.png$/, `-${stage}.png`)) => {
    await evaluate(`document.querySelector('[data-room-board]')?.scrollIntoView({ block: 'center' })`);
    const layout = await evaluate(`({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth })`);
    assert.equal(layout.width, width); assert.equal(layout.height, height); assert.equal(layout.overflow, false);
    const image = await devtools.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId, 20_000);
    await writeFile(path, Buffer.from(image.data, 'base64')); screenshots.push({ stage, path, ...layout });
  };
  const visual = () => evaluate(`[...document.querySelectorAll('.room-placement')].map((node) => ({ placementId: node.dataset.placementId, width: node.style.width, height: node.style.height, label: node.getAttribute('aria-label'), image: node.querySelector('img')?.getAttribute('src'), ready: node.querySelector('.asset-preview')?.dataset.previewState }))`);
  await mkdir(dirname(outputPath), { recursive: true });
  await waitFor(`document.getElementById('connection-label')?.textContent === 'Live' && document.getElementById('workspace-content')?.dataset.renderedProjectId === '${PROJECT}' && Boolean(document.querySelector('[data-room-variant-select]'))`, 'Pinned Room project');
  await evaluate(`(() => {
    const original = window.fetch.bind(window);
    window.__pinnedAudit = { posts: [], holdMixed: false, held: false, release: null, holdOld: false, oldHeld: false, oldReads: 0, releaseOld: null, rejectOld: null };
    window.fetch = async (input, options) => {
      const pathname = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
      if ((options?.method ?? 'GET').toUpperCase() === 'POST') window.__pinnedAudit.posts.push({ pathname, body: JSON.parse(options.body ?? '{}') });
      const oldRead = pathname.includes('/${OLD_ROOM}/') && pathname.endsWith('/pinned-assets');
      if (oldRead) window.__pinnedAudit.oldReads += 1;
      const response = await original(input, options);
      if (window.__pinnedAudit.holdMixed && pathname.includes('/${MIXED_ROOM}/') && pathname.endsWith('/pinned-assets')) {
        window.__pinnedAudit.holdMixed = false; await response.clone().arrayBuffer();
        return new Promise((release) => { window.__pinnedAudit.release = () => release(response); window.__pinnedAudit.held = true; });
      }
      if (window.__pinnedAudit.holdOld && oldRead) {
        window.__pinnedAudit.holdOld = false; await response.clone().arrayBuffer();
        return new Promise((release, reject) => {
          window.__pinnedAudit.releaseOld = () => release(response);
          window.__pinnedAudit.rejectOld = () => reject(new Error('Delayed inactive Room read rejected by the browser probe.'));
          window.__pinnedAudit.oldHeld = true;
        });
      }
      return response;
    };
  })()`);
  const initial = await read(); assert.equal(initial.snapshot.assetLibrary.assets[0].assetVersion, 2);
  const latestImage = `/api/projects/${PROJECT}/artifacts/sha256/${initial.snapshot.assetLibrary.assets[0].sliceBinding.digest}`;
  const oldPin = await evaluate(`fetch('/api/projects/${PROJECT}/revisions/${initial.revision}/room-variants/${OLD_ROOM}/versions/${reopened ? 3 : 1}/pinned-assets').then((response) => response.json())`);
  const expectedOldImage = oldPin.assets[0].preview.resourceUri;
  assert.notEqual(expectedOldImage, latestImage, 'Fixture versions must have different image URLs');
  const mixedBefore = structuredClone(initial.snapshot.roomLibrary.variants.find((room) => room.roomVariantId === MIXED_ROOM));
  await selectRoom(OLD_ROOM, 1); const oldVisual = await visual();
  assert.ok(oldVisual[0].width.includes('2 *')); assert.ok(oldVisual[0].height.includes('1 *')); assert.match(oldVisual[0].label, /^Metadata test prop at /); assert.equal(oldVisual[0].ready, 'READY');
  assert.equal(oldVisual[0].image, expectedOldImage);
  await capture(reopened ? 'reopened-old' : 'historical-old');
  let delayedResponseIgnored = null;
  if (!reopened) {
    await evaluate(`(() => { window.__pinnedAudit.holdMixed = true; const select = document.querySelector('[data-room-variant-select]'); select.value = '${MIXED_ROOM}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor('window.__pinnedAudit.held === true', 'Delayed exact mixed-Room response');
    await selectRoom(OLD_ROOM, 1);
    await evaluate('window.__pinnedAudit.release()');
    await new Promise((done) => setTimeout(done, 100));
    assert.equal(await evaluate("document.querySelector('[data-room-variant-select]').value"), OLD_ROOM);
    assert.deepEqual(await visual(), oldVisual, 'A late response replaced the active Room with another Room\'s assets');
    delayedResponseIgnored = true;
  }
  await selectRoom(MIXED_ROOM, 2); const mixedVisual = await visual();
  assert.ok(mixedVisual.find((item) => item.placementId === 'placement.mixed.old').width.includes('2 *'));
  assert.ok(mixedVisual.find((item) => item.placementId === 'placement.mixed.new').width.includes('3 *'));
  assert.equal(mixedVisual.find((item) => item.placementId === 'placement.mixed.old').image, expectedOldImage);
  assert.equal(mixedVisual.find((item) => item.placementId === 'placement.mixed.new').image, latestImage);
  await capture(reopened ? 'reopened-mixed' : 'mixed-versions');
  let workspaceNavigation = null;
  if (!reopened) {
    await evaluate(`(() => { window.__pinnedAudit.holdOld = true; const select = document.querySelector('[data-room-variant-select]'); select.value = '${OLD_ROOM}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor('window.__pinnedAudit.oldHeld === true', 'Already-fetched Room read held for workspace navigation');
    await click('[data-workspace="assets"]');
    await waitFor("document.getElementById('workspace-content')?.dataset.renderedWorkspace === 'assets'", 'Normal navigation away from Rooms');
    const completion = width === 1440 ? 'fulfilled' : 'rejected';
    await evaluate(completion === 'fulfilled' ? 'window.__pinnedAudit.releaseOld()' : 'window.__pinnedAudit.rejectOld()');
    await new Promise((done) => setTimeout(done, 100));
    assert.equal(await evaluate("document.getElementById('workspace-content')?.dataset.renderedWorkspace"), 'assets', 'Late Room completion replaced the active workspace');
    assert.equal(await evaluate("document.querySelector('[data-room-pinned-assets-state]') === null"), true);
    const readsBeforeReturn = await evaluate('window.__pinnedAudit.oldReads');
    await click('[data-workspace="rooms"]');
    await waitFor(`window.__pinnedAudit.oldReads > ${readsBeforeReturn}`, 'Returning to Rooms starts a fresh exact-Asset read');
    await selectRoom(OLD_ROOM, 1);
    assert.deepEqual(await visual(), oldVisual, 'Normal workspace return lost the exact old Asset image or footprint');
    workspaceNavigation = { completionWhileAway: completion, usedNormalNavigation: true, readsBeforeReturn, readsAfterReturn: await evaluate('window.__pinnedAudit.oldReads'), freshReadReady: true, oldGeometryPreserved: true };
  }
  let previewCompletion = null;
  if (!reopened) {
    await selectRoom(MIXED_ROOM, 2);
    await evaluate(`(() => { window.__pinnedAudit.holdOld = true; window.__pinnedAudit.oldHeld = false; const select = document.querySelector('[data-room-variant-select]'); select.value = '${OLD_ROOM}'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor('window.__pinnedAudit.oldHeld === true', 'Room read held while entering Preview');
    await click('[data-room-view="preview"]');
    await waitFor(`document.querySelector('[data-room-preview-state="READY"]') && document.querySelector('[data-preview-inspect]')`, 'Independent Studio Preview scene');
    // Constrain only this test viewport so both scroll axes are exercised.
    // The actual helper must restore the new DOM after the late editor read.
    await evaluate(`(() => { const sheet = [...document.styleSheets].find(sheet => sheet.href?.endsWith('/styles.css')); if (!sheet) throw new Error('Studio stylesheet unavailable'); window.__pinnedPreviewRules = { sheet, start:sheet.cssRules.length }; for (const rule of ['body { min-height:1800px; }', '.room-preview-stage { min-height:260px; max-height:260px; }', '.room-preview-stage svg { min-width:1600px; }']) sheet.insertRule(rule, sheet.cssRules.length); })()`);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await evaluate(`(() => { document.querySelector('[data-preview-inspect]').focus({ preventScroll:true }); const stage = document.querySelector('[data-room-scroll="studio-preview"]'); stage.scrollLeft = 53; stage.scrollTop = 41; window.scrollTo(0, 67); })()`);
    const previewState = () => evaluate(`(() => { const stage = document.querySelector('[data-room-scroll="studio-preview"]'); return { focus:document.activeElement?.dataset.previewInspect, x:stage.scrollLeft, y:stage.scrollTop, page:window.scrollY }; })()`);
    const before = await previewState(); assert.ok(before.focus && before.x > 0 && before.y > 0 && before.page > 0, JSON.stringify(before));
    const completion = width === 1440 ? 'fulfilled' : 'rejected';
    await evaluate(completion === 'fulfilled' ? 'window.__pinnedAudit.releaseOld()' : 'window.__pinnedAudit.rejectOld()');
    await waitFor(`Boolean(document.querySelector('[data-room-pinned-assets-state="${completion === 'fulfilled' ? 'ready' : 'unavailable'}"]'))`, 'Pinned read completion updates status in Preview');
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    assert.deepEqual(await previewState(), before, 'Late editor read lost Preview focus or scroll');
    previewCompletion = { completion, constrainedScrollProbe:true, before, after:await previewState() };
    await evaluate(`(() => { const { sheet, start } = window.__pinnedPreviewRules; while (sheet.cssRules.length > start) sheet.deleteRule(start); delete window.__pinnedPreviewRules; })()`);
    await click('[data-room-view="editor"]');
    if (completion === 'rejected') await click('[data-room-pinned-assets-retry]');
  }
  await selectRoom(OLD_ROOM, 1);
  if (!reopened) {
    assert.equal(initial.revision, 16);
    await click('[data-room-control="editor-tool"][data-editor-tool="SELECT"]');
    await click('.room-placement');
    await devtools.send('Page.bringToFront', {}, sessionId);
    await evaluate(`document.querySelector('.room-placement')?.focus()`);
    await devtools.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, sessionId);
    await devtools.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }, sessionId);
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 17'`, 'Historical-pin move');
    await selectRoom(OLD_ROOM, 1);
    await click('[data-room-control="editor-panel"][data-editor-panel="properties"]');
    await evaluate(`(() => { const form = document.querySelector('[data-room-form="resize"]'); form.elements.width.value = '5'; form.elements.height.value = '6'; })()`);
    await click('[data-room-form="resize"] button[type="submit"]');
    await waitFor(`document.getElementById('revision-label')?.textContent === 'Revision 18'`, 'Resize using old footprint');
    await selectRoom(OLD_ROOM, 1);
  }
  const final = await read(); assert.equal(final.revision, 18);
  const oldRoom = final.snapshot.roomLibrary.variants.find((room) => room.roomVariantId === OLD_ROOM); const head = oldRoom.versions.find((value) => value.version === oldRoom.headVersion);
  assert.equal(oldRoom.headVersion, 3); assert.equal(head.width, 5); assert.equal(head.placements[0].assetVersion, 1); assert.equal(head.placements[0].metadataVersion, 1); assert.deepEqual(head.placements[0].anchor, { x: 3, y: 2 });
  assert.deepEqual(final.snapshot.roomLibrary.variants.find((room) => room.roomVariantId === MIXED_ROOM), mixedBefore);
  const posts = await evaluate('window.__pinnedAudit.posts'); if (reopened) assert.equal(posts.length, 0); else assert.equal(posts.length, 2);
  const finalVisual = await visual(); assert.ok(finalVisual[0].width.includes('2 *')); assert.equal(finalVisual[0].image, oldVisual[0].image);
  await capture(reopened ? 'reopened-final' : 'edited-old-pin', outputPath);
  const errors = devtools.events.filter((event) => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error') || event.method === 'Network.loadingFailed' || (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  if (domPath) await writeFile(domPath, `${await evaluate('document.documentElement.outerHTML')}\n`);
  await writeFile(outputPath.replace(/\.png$/, '.observation.json'), `${JSON.stringify({ schemaVersion: 1, mode: 'room-pinned-assets', reopened, browser: browserVersion.product, revision: final.revision, roomVersion: oldRoom.headVersion, oldVisual, mixedVisual, finalVisual, delayedResponseIgnored, workspaceNavigation, previewCompletion, postCount: posts.length, runtimeNetworkErrors: errors.length, screenshots }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', mode: 'room-pinned-assets', width, reopened, screenshotCount: screenshots.length, output: outputPath })}\n`);
}
