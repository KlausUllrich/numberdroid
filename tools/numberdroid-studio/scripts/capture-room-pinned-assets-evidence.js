import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const PROJECT = 'numberdroid-studio-checkpoint-2b';
const OLD_ROOM = 'room.metadata.pinned';
const MIXED_ROOM = 'room.pinned.mixed';

export async function captureRoomLabelSeparation({ evaluate, devtools, sessionId }) {
  // Page-local geometry probe: clone actual rendered controls under the actual
  // stylesheet. No original inline attributes, editor state or fixture changes.
  await evaluate(`(() => {
    const placement = document.querySelector('.room-placement').cloneNode(true);
    const entrance = document.querySelector('.room-connector').cloneNode(true);
    const board = document.createElement('div'); board.className = 'room-board';
    board.dataset.roomLabelGeometryProbe = 'true';
    board.style.cssText = 'position:fixed;left:20px;top:20px;--room-width:1;--room-height:1;z-index:99999';
    placement.style.cssText = entrance.style.cssText = 'left:0;top:0;width:var(--room-cell);height:var(--room-cell)';
    placement.dataset.selected = 'false'; entrance.dataset.selected = 'true';
    board.append(placement, entrance);
    window.__roomLabelGeometryProbe = { board, active:document.activeElement, scrollX, scrollY };
    document.body.append(board);
  })()`);
  const observations = [];
  try {
    for (const cell of [38, 28, 12]) {
      await evaluate(`(() => {
        const board = window.__roomLabelGeometryProbe.board;
        board.style.setProperty('--room-cell', '${cell}px');
        board.querySelector('.room-connector').focus({ preventScroll:true });
      })()`);
      // Shift+Tab from the following entrance reaches the underlying placement
      // without activating it or clearing the independently selected entrance.
      await devtools.send('Input.dispatchKeyEvent', { type:'keyDown', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8 }, sessionId);
      await devtools.send('Input.dispatchKeyEvent', { type:'keyUp', key:'Tab', code:'Tab', windowsVirtualKeyCode:9, modifiers:8 }, sessionId);
      const observation = await evaluate(`(() => {
        const board = window.__roomLabelGeometryProbe.board;
        const placement = board.querySelector('.room-placement');
        const a = placement.querySelector('.room-placement-label');
        const b = board.querySelector('.room-connector-label');
        const x = a.getBoundingClientRect(); const y = b.getBoundingClientRect();
        return { cell:${cell}, keyboardFocused:document.activeElement === placement && placement.matches(':focus-visible'),
          placementOpacity:getComputedStyle(a).opacity, entranceOpacity:getComputedStyle(b).opacity,
          placementHeight:x.height, entranceHeight:y.height,
          overlap:Math.max(0, Math.min(x.bottom,y.bottom) - Math.max(x.top,y.top)),
          placementTitle:placement.title, placementAria:placement.getAttribute('aria-label') };
      })()`);
      assert.equal(observation.keyboardFocused, true);
      assert.equal(observation.placementOpacity, '1'); assert.equal(observation.entranceOpacity, '1');
      assert.equal(observation.overlap, 0, 'Same-cell entrance and placement labels overlap at ' + cell + 'px');
      assert.ok(observation.placementTitle && observation.placementAria, 'Clipped labels retain complete accessible and tooltip text');
      observations.push(observation);
    }
  } finally {
    await evaluate(`(() => {
      const saved = window.__roomLabelGeometryProbe; saved.board.remove();
      if (saved.active?.isConnected) saved.active.focus({ preventScroll:true });
      window.scrollTo(saved.scrollX, saved.scrollY); delete window.__roomLabelGeometryProbe;
    })()`);
  }
  assert.equal(await evaluate('document.querySelector("[data-room-label-geometry-probe]") === null && window.__roomLabelGeometryProbe === undefined'), true);
  return { pageLocalClonedGeometry:true, restored:true, observations };
}

export async function captureRoomPinnedAssets({ devtools, sessionId, width, height, pageUrl, outputPath, domPath, browserVersion }) {
  const reopened = new URL(pageUrl).searchParams.get('pinnedPhase') === 'reopen';
  const evaluate = async (expression) => { const value = await devtools.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); assert.equal(value.exceptionDetails, undefined, JSON.stringify(value.exceptionDetails)); return value.result?.value; };
  const waitFor = async (expression, label) => { const deadline = Date.now() + 12_000; while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise((done) => setTimeout(done, 50)); } throw new Error(`${label} did not become ready.`); };
  const click = (selector) => evaluate(`(() => { const target = document.querySelector(${JSON.stringify(selector)}); if (!target || target.disabled) throw new Error('Unavailable ' + ${JSON.stringify(selector)}); target.scrollIntoView({ block: 'center' }); target.click(); })()`);
  const nativePoint = async (selector) => evaluate(`(async () => {
    let target = document.querySelector(${JSON.stringify(selector)}); if (!target || target.disabled) throw new Error('Unavailable native target ' + ${JSON.stringify(selector)});
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    const initialRect = target.getBoundingClientRect();
    // Flush scroll/paint before native hit testing: an immediate CDP click can
    // still hit the previously painted canvas despite an updated DOM rect.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    target = document.querySelector(${JSON.stringify(selector)}); const rect = target.getBoundingClientRect();
    if (window.__pinnedAudit) (window.__pinnedAudit.nativeTargetGeometry ??= []).push({ selector:${JSON.stringify(selector)},
      before:{ x:initialRect.left + initialRect.width / 2, y:initialRect.top + initialRect.height / 2 },
      settled:{ x:rect.left + rect.width / 2, y:rect.top + rect.height / 2 } });
    const x = rect.left + rect.width / 2; const y = rect.top + rect.height / 2;
    if (!target.contains(document.elementFromPoint(x, y))) throw new Error('Native target is obscured: ' + ${JSON.stringify(selector)});
    return { x, y };
  })()`);
  const nativeClick = async (selector, confirm = false) => {
    const point = await nativePoint(selector);
    await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point }, sessionId);
    await devtools.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }, sessionId);
    const start = devtools.events.length;
    const released = devtools.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point }, sessionId);
    if (confirm) {
      const deadline = Date.now() + 2_000;
      while (!devtools.events.slice(start).some((event) => event.method === 'Page.javascriptDialogOpening') && Date.now() < deadline) await new Promise((done) => setTimeout(done, 20));
      const dialog = devtools.events.slice(start).find((event) => event.method === 'Page.javascriptDialogOpening');
      assert.match(dialog?.params?.message ?? '', /Discard the unsaved shape changes/);
      await devtools.send('Page.handleJavaScriptDialog', { accept: true }, sessionId);
    }
    await released;
  };
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
  await waitFor(`document.getElementById('connection-label')?.textContent === 'Live' && document.getElementById('workspace-content')?.dataset.renderedProjectId === '${PROJECT}' && Boolean(document.querySelector('[data-room-nav-action="open-room"][data-room-nav-id="${OLD_ROOM}"]'))`, 'Pinned Room collection');
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
  await click(`[data-room-nav-action="open-room"][data-room-nav-id="${OLD_ROOM}"]`);
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
  const readabilityBefore = await read(); const postsBeforeReadability = await evaluate('window.__pinnedAudit.posts.length');
  const actionReadability = () => evaluate(`(() => {
    const measure = (node) => {
      const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
      const parent = node.parentElement.getBoundingClientRect();
      return { label:node.textContent, height:rect.height, font:Number.parseFloat(style.fontSize),
        disabled:node.disabled, background:style.backgroundColor, selected:node.dataset.selected,
        textFits:node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1,
        contained:rect.left >= parent.left - 1 && rect.right <= parent.right + 1,
        borderBottom:style.borderBottomWidth, borderRadius:style.borderRadius };
    };
    return { save:measure(document.querySelector('[data-room-control="shape-save"]')),
      discard:measure(document.querySelector('[data-room-control="shape-reset"]')),
      tabs:[...document.querySelectorAll('.room-dock-navigation button')].map(measure),
      dockActions:[...document.querySelectorAll('.room-move-controls button, .room-lifecycle-actions button')].map(measure),
      overflow:document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth };
  })()`);
  const assertReadableActions = (observation, dirty) => {
    assert.equal(observation.save.disabled, !dirty, 'Save shape must reflect the actual shape draft');
    assert.equal(observation.discard.disabled, !dirty);
    for (const control of [observation.save, observation.discard, ...observation.tabs, ...observation.dockActions]) {
      assert.ok(control.height >= 40 && control.font >= 14, `Room control is too small: ${JSON.stringify(control)}`);
      assert.equal(control.textFits, true, `Room control text is clipped: ${control.label}`);
      assert.equal(control.contained, true, `Room control escaped its container: ${control.label}`);
    }
    assert.notEqual(observation.save.background, observation.discard.background, 'Save must have primary emphasis, distinct from Discard');
    assert.equal(observation.tabs.length, 3);
    assert.equal(observation.tabs.filter(tab => tab.selected === 'true').length, 1);
    assert.equal(observation.overflow, false);
  };
  const savedActions = await actionReadability(); assertReadableActions(savedActions, false);
  await nativeClick('[data-room-control="editor-tool"][data-editor-tool="SELECT"]');
  await nativeClick('[data-room-control="zoom"][data-room-zoom="fit"]');
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const multiCellSelector = '.room-placement[data-placement-id="placement.mixed.new"]';
  await nativeClick(multiCellSelector);
  const selectedActions = await actionReadability(); assertReadableActions(selectedActions, false);
  assert.ok(selectedActions.dockActions.length > 0, 'Selected placement must exercise ordinary move controls');
  const placementReadability = await evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(multiCellSelector)}); const rect = node.getBoundingClientRect();
    const visual = node.querySelector('.room-placement-visual'); const image = node.querySelector('img'); const art = visual.getBoundingClientRect();
    const label = node.querySelector('.room-placement-label'); const labelRect = label.getBoundingClientRect();
    const cell = Number.parseFloat(getComputedStyle(document.querySelector('[data-room-board]')).getPropertyValue('--room-cell'));
    const rail = document.querySelector('.room-toolbox');
    return { imageCount: node.querySelectorAll('img').length, imageLoaded: image.complete && image.naturalWidth > 0,
      cell, width: rect.width, height: rect.height, artWidth: art.width, artHeight: art.height,
      imageFit: getComputedStyle(image).objectFit, labelBottomGap: rect.bottom - labelRect.bottom,
      labelOpacity: getComputedStyle(label).opacity, labelFont: Number.parseFloat(getComputedStyle(label).fontSize),
      railWidth: rail.getBoundingClientRect().width, toolTextFits: [...rail.querySelectorAll('.room-tool > span:last-child')].every(text => text.scrollWidth <= text.clientWidth + 1),
      overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      labelRect: { left: labelRect.left, right: labelRect.right, top: labelRect.top, bottom: labelRect.bottom } };
  })()`);
  assert.equal(placementReadability.imageCount, 1, 'A multi-cell Asset must be one continuous image, not repeated cell thumbnails');
  assert.equal(placementReadability.imageLoaded, true);
  assert.ok(Math.abs(placementReadability.width - 3 * placementReadability.cell) < 1);
  assert.ok(Math.abs(placementReadability.height - 2 * placementReadability.cell) < 1);
  assert.ok(Math.abs(placementReadability.artWidth - placementReadability.width) < 1 && Math.abs(placementReadability.artHeight - placementReadability.height) < 1, 'One image frame must span the complete 3×2 logical footprint');
  assert.equal(placementReadability.imageFit, 'contain'); assert.ok(Math.abs(placementReadability.labelBottomGap) < 1);
  assert.equal(placementReadability.labelOpacity, '1'); assert.ok(placementReadability.labelFont <= 12);
  assert.ok(placementReadability.railWidth >= 116); assert.equal(placementReadability.toolTextFits, true); assert.equal(placementReadability.overflow, false);
  const entrancePoint = await nativePoint('.room-connector');
  await devtools.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...entrancePoint }, sessionId);
  const entranceReadability = await evaluate(`(() => {
    const node = document.querySelector('.room-connector'); const label = node.querySelector('.room-connector-label');
    const rect = node.getBoundingClientRect(); const text = label.getBoundingClientRect();
    const placed = document.querySelector(${JSON.stringify(multiCellSelector)}).querySelector('.room-placement-label').getBoundingClientRect();
    return { opacity: getComputedStyle(label).opacity, topGap: text.top - rect.top,
      labelsIntersect: text.left < placed.right && text.right > placed.left && text.top < placed.bottom && text.bottom > placed.top };
  })()`);
  assert.equal(entranceReadability.opacity, '1'); assert.ok(entranceReadability.topGap >= 0 && entranceReadability.topGap <= 5);
  assert.equal(entranceReadability.labelsIntersect, false);
  const sameCellLabels = await captureRoomLabelSeparation({ evaluate, devtools, sessionId });
  await nativeClick('[data-room-control="editor-tool"][data-editor-tool="PAINT_BLOCKED"]');
  await nativeClick('[data-room-control="cell"][data-x="5"][data-y="2"]');
  await waitFor(`document.querySelector('[data-room-control="cell"][data-x="5"][data-y="2"]')?.dataset.cellKind === 'BLOCKED' && document.querySelector('.room-editor-status')?.dataset.dirty === 'true'`, 'Native painting through the middle of the multi-cell Asset');
  const dirtyActions = await actionReadability(); assertReadableActions(dirtyActions, true);
  const dirtyDockNavigation = [];
  for (const panel of ['properties', 'check', 'tool']) {
    await evaluate(`(() => { window.__pinnedAudit.lastPanelClick = null; document.addEventListener('click', event => {
      window.__pinnedAudit.lastPanelClick = event.target.closest('[data-room-control]')?.dataset.editorPanel ?? null;
    }, { once:true, capture:true }); })()`);
    await nativeClick(`[data-room-control="editor-panel"][data-editor-panel="${panel}"]`);
    assert.equal(await evaluate('window.__pinnedAudit.lastPanelClick'), panel, 'Native pointer must actually hit the named dock tab');
    await waitFor(`document.querySelector('[data-room-control="editor-panel"][data-editor-panel="${panel}"]')?.dataset.selected === 'true'`, `Native ${panel} panel selection with unsaved shape`);
    const controls = await actionReadability(); assertReadableActions(controls, true);
    if (panel === 'check') assert.ok(controls.dockActions.length > 0, 'Check panel must exercise ordinary lifecycle controls');
    assert.equal(controls.tabs.find(tab => tab.selected === 'true')?.label,
      { properties:'Purpose & settings', check:'Check room', tool:'Tool options' }[panel]);
    dirtyDockNavigation.push({ panel, controls });
  }
  await capture(reopened ? 'reopened-dirty-shape-controls' : 'dirty-shape-controls');
  assert.equal(await evaluate('window.__pinnedAudit.posts.length'), postsBeforeReadability, 'Painting must not save a Room or place an Asset');
  assert.deepEqual(await read(), readabilityBefore, 'A painted shape draft changed persisted project data');
  await nativeClick('[data-room-control="shape-reset"]', true);
  await waitFor(`document.querySelector('[data-room-control="cell"][data-x="5"][data-y="2"]')?.dataset.cellKind === 'ROOM' && document.querySelector('.room-editor-status')?.dataset.dirty === 'false'`, 'Discard restores the exact saved cell');
  const restoredActions = await actionReadability(); assertReadableActions(restoredActions, false);
  await nativeClick('[data-room-control="editor-tool"][data-editor-tool="SELECT"]');
  assert.equal(await evaluate('window.__pinnedAudit.posts.length'), postsBeforeReadability);
  assert.deepEqual(await read(), readabilityBefore, 'Discarding a shape draft changed persisted project data');
  const roomReadability = { placement: placementReadability, entrance: entranceReadability, sameCellLabels, actions: { saved:savedActions, selected:selectedActions, dirty:dirtyActions, restored:restoredActions, dirtyDockNavigation }, nativeTargetGeometry: await evaluate('window.__pinnedAudit.nativeTargetGeometry'), nativePaintThroughMultiCell: true, discardConfirmed: true, addedPosts: 0, revisionUnchanged: true };
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
    await waitFor(`Boolean(document.querySelector('[data-room-nav-action="open-room"][data-room-nav-id="${OLD_ROOM}"]'))`, 'Returning to the Rooms collection');
    assert.equal(await evaluate('window.__pinnedAudit.oldReads'), readsBeforeReturn, 'Opening the collection must not fetch an arbitrary Room');
    await click(`[data-room-nav-action="open-room"][data-room-nav-id="${OLD_ROOM}"]`);
    await waitFor(`window.__pinnedAudit.oldReads > ${readsBeforeReturn}`, 'Opening the old Room starts a fresh exact-Asset read');
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
  await writeFile(outputPath.replace(/\.png$/, '.observation.json'), `${JSON.stringify({ schemaVersion: 1, mode: 'room-pinned-assets', reopened, browser: browserVersion.product, revision: final.revision, roomVersion: oldRoom.headVersion, oldVisual, mixedVisual, finalVisual, roomReadability, delayedResponseIgnored, workspaceNavigation, previewCompletion, postCount: posts.length, runtimeNetworkErrors: errors.length, screenshots }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', mode: 'room-pinned-assets', width, reopened, screenshotCount: screenshots.length, output: outputPath })}\n`);
}
