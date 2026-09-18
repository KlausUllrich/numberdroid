import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { assemblyFixture, assemblyPayload, projectId } from '../tests/assembly-test-helpers.js';
import { SourceLibraryService } from '../packages/application/src/index.js';
import { SqliteJobStore, SqliteArtifactMetadataStore, SourceLibraryOperationStore, verifyWorkspaceIntegrity } from '../packages/persistence/src/index.js';
import { openDevtoolsSocket, waitForDevtoolsEndpoint } from './browser-devtools-startup.js';
import { closeBrowserAndRemoveProfile, finishCapture, trackProcessClose } from './browser-process-teardown.js';

const [chromePath, outputDirectory] = process.argv.slice(2);
if (!isAbsolute(chromePath ?? '') || !isAbsolute(outputDirectory ?? '')) throw new Error('Usage: verify-source-library-recovery-browser.js ABSOLUTE_CHROME ABSOLUTE_NEW_OUTPUT');
await mkdir(outputDirectory, { recursive: false });
const cleanups = [], abort = new AbortController();
let socket, chrome, trackedClose, profileDirectory, error = null, nextId = 0;
const pending = new Map(), observations = [];
const cancel = () => abort.abort(new Error('Library recovery browser cancelled.'));
process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
try {
  const fixture = await assemblyFixture({ after: fn => cleanups.push(fn) });
  await fixture.execute('asset.save', fixture.payload());
  await fixture.execute('assembly.save', assemblyPayload());
  const initial = await fixture.studio.readProjectTrusted(projectId);
  const oldAsset = structuredClone(initial.snapshot.assetLibrary.assets.find(value => value.assetId === 'asset.fixture'));
  const oldAssembly = structuredClone(initial.snapshot.assemblyLibrary.assets.find(value => value.assetId === 'assembly.fixture'));
  assert.ok(oldAssembly, 'Fixture must retain a real Assembly pin to the original Image.');
  const service = new SourceLibraryService({ projectStore: fixture.store, jobStore: new SqliteJobStore({ workspace: fixture.store.workspace }),
    operationStore: new SourceLibraryOperationStore({ workspace: fixture.store.workspace }) });
  const base = await fixture.http({ sourceLibraryService: service,
    artifactMetadataStore: new SqliteArtifactMetadataStore({ workspace: fixture.store.workspace }) });
  profileDirectory = await mkdtemp(join(tmpdir(), 'numberdroid-library-recovery-chrome-'));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--disable-background-networking',
    '--disable-extensions', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profileDirectory}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  trackedClose = trackProcessClose(chrome);
  const startup = await waitForDevtoolsEndpoint(chrome, { signal: abort.signal, trackedClose });
  socket = await openDevtoolsSocket(startup.url, { signal: abort.signal });
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data)), handler = pending.get(message.id); if (!handler) return;
    pending.delete(message.id); clearTimeout(handler.timer);
    if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result);
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result?.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) { if (abort.signal.aborted) throw abort.signal.reason; if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 60)); }
    throw new Error(`${label}: ${await evaluate('document.body.textContent.slice(-2500)')}`);
  };
  const mount = async () => {
    await send('Page.navigate', { url: `${base}/health` }, sessionId);
    await waitFor(`location.pathname === '/health' && document.readyState === 'complete'`, 'Native page load');
    await evaluate(`(async () => {
      const { createSourceLibraryController } = await import('/source-library-controller.js');
      const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/styles.css'; document.head.append(style);
      // Isolate controller layout from the separately tested app-shell minimum width.
      document.body.replaceChildren(); document.body.style.cssText = 'display:block;padding:24px;margin:0;min-width:0';
      const csrf = (await (await fetch('/api/ui-session')).json()).csrfToken;
      const path = '/api/projects/${projectId}/atlases/atlas.fixture/library/';
      window.audit = []; window.saved = [];
      window.refreshContext = async () => { const project = await (await fetch('/api/projects/${projectId}')).json();
        window.current = { projectId: project.projectId, revision: project.revision, atlas: project.snapshot.atlases.find(value => value.id === 'atlas.fixture'), job: null };
        window.workflow?.update(window.current); };
      await window.refreshContext();
      window.workflow = createSourceLibraryController({ context: window.current,
        request: async (action, body) => { window.audit.push({ action, body: structuredClone(body) });
          const response = await fetch(path + action, { method: 'POST', headers: { 'content-type': 'application/json', 'x-numberdroid-studio-csrf': csrf }, body: JSON.stringify(body) });
          const result = await response.json();
          if (!response.ok) throw Object.assign(new Error(result.error?.message ?? 'Request failed'), { status: response.status, code: result.error?.code });
          if (action === 'save' && window.dropNextSaveResponse) { window.dropNextSaveResponse = false; throw new TypeError('Synthetic lost response after committed Save'); }
          return result; },
        onBusy: value => { window.saveBusy = value; }, onSaved: async result => { window.saved.push(result); await window.refreshContext(); },
        onRecheck: () => window.refreshContext(), onOpenAsset() {} });
      document.body.append(window.workflow.element);
    })()`);
  };
  const click = action => evaluate(`(() => { const node = document.querySelector('[data-source-library-action="${action}"]'); if (!node || node.disabled) throw new Error('Unavailable ${action}'); node.click(); })()`);
  const field = (name, value) => evaluate(`(() => { const node = document.querySelector('[data-source-library-field="${name}"]'); if (!node || node.disabled) throw new Error('Unavailable ${name}'); node.value = ${JSON.stringify(value)}; node.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  const check = async () => { await click('plan'); await waitFor(`document.querySelector('[data-source-library-action="save"]')?.disabled === false`, 'Checked save'); };
  await mount();
  await waitFor('document.querySelector("[data-source-library-field=target]")', 'Destination choices');
  await field('target', 'new'); await field('name', 'Browser recovery machine'); await check();
  await evaluate('window.dropNextSaveResponse = true'); await click('save');
  await waitFor('document.body.textContent.includes("Confirm the previous save")', 'Unknown outcome');
  const firstIntent = await evaluate('window.audit.find(value => value.action === "save").body');
  const committed = await fixture.studio.readProjectTrusted(projectId);
  assert.equal(committed.revision, initial.revision + 1); assert.equal(committed.snapshot.assetLibrary.assets.length, 2);
  observations.push({ step: 'lost-response-after-commit', revision: committed.revision });
  await mount();
  await waitFor('document.body.textContent.includes("Confirm the previous save")', 'Reloaded pending intent');
  await click('save'); await waitFor('window.saved.length === 1 && !window.workflow.hasPending()', 'Exact replay');
  assert.deepEqual(await evaluate('window.audit.find(value => value.action === "save").body'), firstIntent);
  assert.equal((await fixture.studio.readProjectTrusted(projectId)).revision, committed.revision);
  assert.equal(await evaluate('window.saved[0].replayed'), true);
  observations.push({ step: 'reload-exact-replay', revision: committed.revision });
  await field('target', 'asset.fixture'); await field('name', 'Renamed original machine'); await check();
  await fixture.execute('asset.save', fixture.payload({ assetId: 'asset.unrelated', name: 'Independent image' }));
  await evaluate('window.refreshContext()');
  assert.equal(await evaluate('document.querySelector("[data-source-library-action=save]").disabled'), true);
  await click('recheck'); await waitFor('document.querySelector("[data-source-library-action=plan]")?.disabled === false', 'Current version recheck');
  await check(); await click('save'); await waitFor('window.saved.length === 2 && !window.workflow.hasPending()', 'Named update');
  const updated = await fixture.studio.readProjectTrusted(projectId), asset = updated.snapshot.assetLibrary.assets.find(value => value.assetId === 'asset.fixture');
  assert.equal(asset.assetVersion, 2); assert.equal(asset.name, 'Renamed original machine');
  assert.deepEqual(asset.metadata.extensions, oldAsset.metadata.extensions);
  assert.deepEqual(updated.snapshot.assemblyLibrary.assets.find(value => value.assetId === 'assembly.fixture'), oldAssembly);
  assert.deepEqual(asset.sliceBinding, oldAsset.sliceBinding);
  const oldVersion = fixture.store.workspace.database.prepare('SELECT name, metadata_version FROM asset_versions WHERE project_id=? AND asset_id=? AND asset_version=1').get(projectId, 'asset.fixture');
  assert.equal(oldVersion.name, oldAsset.name); assert.equal(oldVersion.metadata_version, oldAsset.metadataVersion);
  observations.push({ step: 'stale-recheck-named-update-retains-hidden-metadata-and-assembly-pin', revision: updated.revision });
  for (const width of [1440, 1060]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await evaluate('window.scrollTo(0, 0)');
    await waitFor('[...document.querySelectorAll(".source-library-image img")].every(image => image.complete && image.naturalWidth > 0)', 'Exact image pixels');
    assert.equal(await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, `Horizontal overflow at ${width}`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    await writeFile(join(outputDirectory, `source-library-recovery-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    observations.push({ step: 'layout', width, overflow: false });
  }
  const integrity = await verifyWorkspaceIntegrity({ projectStore: fixture.store, artifactStore: fixture.artifacts });
  assert.equal(integrity.ok, true, JSON.stringify(integrity));
  await writeFile(join(outputDirectory, 'source-library-recovery.observation.json'), JSON.stringify({ ok: true, observations }, null, 2));
  process.stdout.write(`${JSON.stringify({ ok: true, outputDirectory, observations })}\n`);
} catch (failure) { error = failure; }
await finishCapture(error, [
  () => !chrome ? undefined : closeBrowserAndRemoveProfile({ child: chrome, trackedClose, requestBrowserClose: () => send('Browser.close'), closeConnection: () => {
    socket?.close(); for (const handler of pending.values()) { clearTimeout(handler.timer); handler.reject(new Error('Browser closed')); } pending.clear();
  }, removeProfile: () => rm(profileDirectory, { recursive: true, force: true }) }),
  ...cleanups,
]);
