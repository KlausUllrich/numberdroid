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
      return originalFetch(input, options);
    };
    window.confirm = (message) => { window.__humanAssetAudit.confirmations.push(message); return true; };
  })()`);
  const reopened = new URL(pageUrl).searchParams.get('authoringPhase') === 'reopen';
  let slice = null;
  let compatibleRefresh = null;
  if (!reopened) {
    const initial = await project();
    assert.equal(initial.revision, 7);
    assert.equal(initial.snapshot.assetLibrary?.assets.length ?? 0, 0);
    await waitFor("document.querySelectorAll('[data-create-asset-slice]').length === 4", 'Four saved-slice actions');
    slice = await evaluate(`(() => { const action = document.querySelector('[data-create-asset-slice]'); return { sliceId: action.dataset.createAssetSlice, sliceVersion: Number(action.dataset.sliceVersion) }; })()`);
    assert.ok(slice.sliceId); assert.ok(slice.sliceVersion > 0);
    await click('[data-create-asset-slice]');
    await waitFor("Boolean(document.querySelector('form[data-asset-authoring-form]'))", 'Human Asset form');
    await fill('form[data-asset-authoring-form]', {
      name: ASSET_NAME, kind: 'prop', role: 'authoring-test', width: '2', height: '1', anchorX: '0', anchorY: '0',
      attachment: 'ground', rotationPolicy: 'cardinal', wallSafe: 'false', movement: 'blocked', visualWeight: 'medium', runtimeEligible: 'false',
    });
    await evaluate(`(() => { const input = document.querySelector('form[data-asset-authoring-form] [name="name"]'); input.focus(); input.setSelectionRange(2, 8); })()`);
    await click('#refresh-button');
    await delay(600);
    compatibleRefresh = await evaluate(`(() => { const input = document.querySelector('form[data-asset-authoring-form] [name="name"]'); return { name: input?.value, width: document.querySelector('form[data-asset-authoring-form] [name="width"]')?.value, focused: document.activeElement === input, selectionStart: input?.selectionStart, selectionEnd: input?.selectionEnd }; })()`);
    assert.equal(compatibleRefresh.name, ASSET_NAME); assert.equal(compatibleRefresh.width, '2');
    assert.equal(compatibleRefresh.focused, true); assert.equal(compatibleRefresh.selectionStart, 2); assert.equal(compatibleRefresh.selectionEnd, 8);
    assert.equal((await project()).revision, 7);
    await capture('form', 'form[data-asset-authoring-form]');
    await click('[data-asset-authoring-submit]');
    await waitFor("document.querySelector('[data-asset-proposal]')?.dataset.proposalState === 'PENDING'", 'Prepared proposal');
    const pending = await project();
    assert.equal(pending.snapshot.assetLibrary.assets.length, 0, 'Preparing a proposal created an Asset without owner acceptance');
    const proposal = pending.snapshot.assetLibrary.proposals.at(-1);
    assert.equal(proposal.items.length, 1); assert.equal(proposal.state, 'PENDING');
    assert.equal(proposal.items[0].sliceId, slice.sliceId);
    await waitFor("document.querySelector('[data-proposal-item] .asset-preview')?.dataset.previewState === 'READY'", 'Exact proposal image');
    await capture('proposal', '[data-asset-proposal]');
    await evaluate(`(() => { const select = document.querySelector('[data-proposal-disposition]'); select.value = 'ACCEPTED'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await click('[data-proposal-decision]');
    await waitFor("document.querySelector('[data-asset-proposal]')?.dataset.proposalState === 'DECIDED'", 'Explicit owner decision');
    assert.equal((await project()).snapshot.assetLibrary.assets.length, 0, 'Recording a decision applied the Asset automatically');
    await click('[data-proposal-apply]');
    await waitFor("document.querySelectorAll('.asset-v2-card').length === 1", 'Applied DRAFT Asset');
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
  } else {
    await waitFor("Boolean(document.querySelector('[data-room-board]')) && document.querySelectorAll('.room-placement').length === 1", 'Read-only reopened Room');
  }
  const saved = await project();
  assert.equal(saved.snapshot.assetLibrary.assets.length, 1);
  const asset = saved.snapshot.assetLibrary.assets[0];
  assert.equal(asset.name, ASSET_NAME); assert.equal(asset.kind, 'prop'); assert.equal(asset.lifecycle, 'DRAFT');
  if (slice) { assert.equal(asset.sliceBinding.sliceId, slice.sliceId); assert.equal(asset.sliceBinding.sliceVersion, slice.sliceVersion); }
  assert.deepEqual(asset.metadata.spanTiles, { width: 2, height: 1 });
  assert.equal(asset.metadata.rotationPolicy, 'cardinal'); assert.equal(asset.metadata.runtimeEligible, false);
  assert.equal(saved.snapshot.roomLibrary.variants.length, 1);
  const roomEntry = saved.snapshot.roomLibrary.variants[0];
  const room = roomEntry.versions.find((version) => version.version === roomEntry.headVersion);
  assert.equal(room.lifecycle, 'DRAFT'); assert.equal(room.placements.length, 1);
  const placement = room.placements[0];
  assert.equal(placement.assetId, asset.assetId); assert.equal(placement.assetVersion, asset.assetVersion); assert.equal(placement.metadataVersion, asset.metadataVersion);
  assert.deepEqual(placement.anchor, { x: 2, y: 2 });
  const audit = await evaluate('window.__humanAssetAudit');
  if (reopened) assert.equal(audit.posts.length, 0, 'Reopening issued a mutation');
  else {
    const submitted = audit.posts.find(({ pathname }) => pathname.endsWith('/asset-proposals'))?.body;
    assert.ok(submitted); assert.equal(submitted.items[0].sliceId, slice.sliceId); assert.equal(submitted.items[0].expectedSliceVersion, slice.sliceVersion);
    assert.deepEqual(Object.keys(submitted.items[0]).sort(), ['assetId', 'expectedAssetVersion', 'expectedMetadataVersion', 'expectedSliceVersion', 'itemId', 'kind', 'metadata', 'name', 'operation', 'sliceId'].sort());
    assert.equal(Object.hasOwn(submitted.items[0].metadata, 'pixelSize'), false); assert.equal(Object.hasOwn(submitted.items[0].metadata, 'pivot'), false);
    assert.equal(/data:image|base64|sourceDigest|sliceBinding/.test(JSON.stringify(submitted)), false);
    assert.equal(audit.confirmations.length, 2, 'Owner decision and application must remain explicit separate confirmations');
  }
  await capture(reopened ? 'reopened-room' : 'room', '[data-room-board]', outputPath);
  const errors = devtools.events.filter((event) => event.method === 'Runtime.exceptionThrown'
    || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
    || (event.method === 'Runtime.consoleAPICalled' && event.params?.type === 'error')
    || event.method === 'Network.loadingFailed'
    || (event.method === 'Network.responseReceived' && event.params?.response?.status >= 400));
  assert.equal(errors.length, 0, `Human Asset browser emitted protocol errors: ${JSON.stringify(errors)}`);
  if (domPath) await writeFile(domPath, `${await evaluate('document.documentElement.outerHTML')}\n`);
  await writeFile(outputPath.replace(/\.png$/, '.observation.json'), `${JSON.stringify({ schemaVersion: 1, mode: 'human-asset', reopened, browser: browserVersion.product, projectId: PROJECT_ID, revision: saved.revision, assetId: asset.assetId, sliceBinding: asset.sliceBinding, roomVariantId: room.roomVariantId, roomVersion: room.version, placement, compatibleRefresh, explicitOwnerConfirmations: audit.confirmations.length, callerDerivedImageFields: false, runtimeNetworkErrors: errors.length, screenshots }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'CAPTURED', mode: 'human-asset', reopened, width, screenshotCount: screenshots.length, output: outputPath })}\n`);
}
