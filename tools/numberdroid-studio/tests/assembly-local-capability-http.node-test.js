import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { createProject, PROJECT_ID } from './test-helpers.js';

for (const [storeMode, expected] of [['sqlite', 'AVAILABLE'], ['json', 'SQLITE_REQUIRED']]) {
  test(`local ${storeMode} Assembly capability follows its store with pairing disabled`, { timeout: 20000 }, async context => {
    const directory = await mkdtemp(join(tmpdir(), `studio-assembly-capability-${storeMode}-`));
    let running;
    context.after(async () => {
      if (running) await new Promise((resolve, reject) => running.server.close(error => error ? reject(error) : resolve()));
      await rm(directory, { recursive: true, force: true });
    });
    running = await startStudioHttpServer({ dataDirectory: directory, port: 0, storeMode, pairingEnabled: false });
    await createProject(running.studioService);
    const base = `http://127.0.0.1:${running.address.port}`;
    const response = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`);
    assert.equal(response.status, 200); const access = await response.json();
    assert.equal(access.hostBindingSupport, 'SQLITE_REQUIRED', 'Pairing availability keeps its existing independent meaning.');
    assert.equal(access.mcpLauncherConfig, null);
    assert.equal(access.assemblyAuthoringSupport, expected);
    if (storeMode === 'sqlite') {
      const assemblies = await fetch(`${base}/api/projects/${PROJECT_ID}/assemblies`);
      assert.equal(assemblies.status, 200); assert.deepEqual((await assemblies.json()).assets, []);
    }
    const change = await fetch(`${base}/api/projects/${PROJECT_ID}/agent-access`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base, 'sec-fetch-site': 'same-origin', 'x-numberdroid-studio-csrf': access.csrfToken },
      body: JSON.stringify({ mode: 'off', idempotencyKey: `capability.${storeMode}`, confirmBroaderAccess: true }),
    });
    assert.equal(change.status, 200); const changed = await change.json();
    assert.equal(changed.assemblyAuthoringSupport, expected); assert.equal(changed.hostBindingSupport, 'SQLITE_REQUIRED');
  });
}
