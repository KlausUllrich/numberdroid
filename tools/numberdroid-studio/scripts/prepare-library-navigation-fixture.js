import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { prepareAnimationEditorFixture, ANIMATION_FIXTURE_PROJECT } from './prepare-animation-editor-fixture.js';

/** Fresh independent Library data, authored exclusively through existing APIs. */
export async function prepareLibraryNavigationFixture(directory) {
  const fixture = await prepareAnimationEditorFixture(directory);
  const running = await startStudioHttpServer({ dataDirectory: directory, host: '127.0.0.1', port: 0,
    storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null });
  const owner = { actor: { id: 'local.designer', kind: 'human', displayName: 'Fixture designer' },
    taskId: null, grantId: null, branchId: 'branch.main' };
  try {
    const initial = await running.studioService.readProjectTrusted(ANIMATION_FIXTURE_PROJECT);
    const original = initial.snapshot.assetLibrary.assets.find(asset => asset.assetId === 'asset.animation-graphite');
    const metadata = structuredClone(original.metadata);
    // These read-model facts are supplied by the exact saved slice, never by
    // the author's metadata command (same boundary as the native Asset editor).
    delete metadata.pixelSize; delete metadata.pivot;
    for (let index = 1; index <= 15; index += 1) {
      const current = await running.studioService.readProjectTrusted(ANIMATION_FIXTURE_PROJECT);
      const id = `fixture.library.sample.${index}`;
      await running.studioService.execute({ schemaVersion: 1, commandId: id, idempotencyKey: id,
        type: 'asset.save', projectId: ANIMATION_FIXTURE_PROJECT, baseRevision: current.revision, expectedVersion: current.revision,
        payload: { assetId: `asset.library-sample-${index}`, operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0,
          name: `Library sample ${String(index).padStart(2, '0')}`, kind: original.kind, metadata,
          image: { mode: 'saved-slice', sliceId: original.sliceBinding.sliceId, expectedSliceVersion: original.sliceBinding.sliceVersion } },
      }, owner);
    }
    const saved = await running.studioService.readProjectTrusted(ANIMATION_FIXTURE_PROJECT);
    return { ...fixture, revision: saved.revision, libraryFixture: true, savedImageCount: saved.snapshot.assetLibrary.assets.length };
  } finally { await new Promise((done, reject) => running.server.close(error => error ? reject(error) : done())); }
}
