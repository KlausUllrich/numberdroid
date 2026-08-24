import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { ensureDemoProject } from '../apps/studio-server/src/demo-project.js';

const previewBytes = Buffer.from(
  (await readFile(new URL('../fixtures/visual-evidence/hygiene-ready-preview.png.base64', import.meta.url), 'utf8'))
    .replace(/\s/g, ''),
  'base64',
);

const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-visual');
let clockTick = 0;
const running = await startStudioHttpServer({
  dataDirectory,
  port: 0,
  clock: () => new Date(Date.UTC(2026, 7, 21, 15, 0, clockTick++)).toISOString(),
});
try {
  const project = await ensureDemoProject(running.studioService);
  const hasVisualSource = project.snapshot.sources.some((source) => source.id === 'source.visual-ready');
  const hasVisualAsset = project.snapshot.assets.some((asset) => asset.id === 'tile.hygiene.floor.visual-ready');
  if (hasVisualSource !== hasVisualAsset) {
    throw new Error('The visual evidence fixture is partially initialized; use a new data directory.');
  }
  if (!hasVisualSource) {
    const artifact = await running.artifactStore.ingest(previewBytes, { mediaType: 'image/png' });
    running.artifactMetadataStore.registerAndReference(artifact, {
      projectId: project.projectId,
      ownerKind: 'upload',
      ownerId: 'upload.visual-evidence',
      createdRevision: project.revision,
    });
    const ownerContext = {
      actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' },
      taskId: null,
      grantId: null,
      branchId: 'branch.main',
    };
    await running.studioService.execute({
      schemaVersion: 1,
      commandId: 'visual.register-ready-source',
      idempotencyKey: 'visual.register-ready-source',
      type: 'source.register',
      projectId: project.projectId,
      baseRevision: project.revision,
      expectedVersion: project.revision,
      dryRun: false,
      payload: {
        sourceId: 'source.visual-ready',
        name: 'Verified hygiene preview source',
        artifactUri: artifact.uri,
        mediaType: artifact.mediaType,
        width: artifact.width,
        height: artifact.height,
        provenance: { prompt: 'Deterministic visual evidence pattern.', seed: 742 },
      },
    }, ownerContext);
    await running.studioService.execute({
      schemaVersion: 1,
      commandId: 'visual.define-ready-asset',
      idempotencyKey: 'visual.define-ready-asset',
      type: 'asset.define',
      projectId: project.projectId,
      baseRevision: project.revision + 1,
      expectedVersion: project.revision + 1,
      dryRun: false,
      payload: {
        assetId: 'tile.hygiene.floor.visual-ready',
        sourceId: 'source.visual-ready',
        name: 'Verified full-source preview',
        kind: 'surface',
        region: { x: 0, y: 0, width: artifact.width, height: artifact.height },
        properties: { role: 'floor', topology: 'fill', collision: 'none', family: 'family-hygiene' },
        status: 'in_review',
      },
    }, ownerContext);
  }
  const finalProject = await running.studioService.readProjectTrusted(project.projectId);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    projectId: finalProject.projectId,
    revision: finalProject.revision,
    assetCount: finalProject.snapshot.assets.length,
  })}\n`);
} finally {
  await new Promise((resolveClose) => running.server.close(resolveClose));
}
