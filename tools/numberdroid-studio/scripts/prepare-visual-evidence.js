import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { ensureDemoProject } from '../apps/studio-server/src/demo-project.js';

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(value) {
  let crc = 0xffffffff;
  for (const byte of value) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function previewPng(width = 96, height = 96) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    rows[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      const seam = x % 24 < 2 || y % 24 < 2;
      rows[offset] = seam ? 44 : 94 + ((x + y) % 22);
      rows[offset + 1] = seam ? 116 : 142 + ((x * 3) % 34);
      rows[offset + 2] = seam ? 126 : 150 + ((y * 2) % 28);
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const dataDirectory = resolve(process.argv[2] ?? '.numberdroid-studio-visual');
const running = await startStudioHttpServer({ dataDirectory, port: 0 });
try {
  const project = await ensureDemoProject(running.studioService);
  if (!project.snapshot.sources.some((source) => source.id === 'source.visual-ready')) {
    const artifact = await running.artifactStore.ingest(previewPng(), { mediaType: 'image/png' });
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
