import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  ContentAddressedArtifactStore,
  createSqliteProjectBundle,
  importSqliteProjectBundle,
  SqliteProjectStore,
  verifySqliteProjectBundle,
  verifyWorkspaceIntegrity,
} from '../packages/persistence/src/index.js';

const [sourceArgument, projectId, firstBundleArgument, importArgument, secondBundleArgument, outputArgument] = process.argv.slice(2);
if (!sourceArgument || !projectId || !firstBundleArgument || !importArgument || !secondBundleArgument || !outputArgument) {
  throw new Error('Usage: verify-checkpoint-2c-bundle-roundtrip.js SOURCE_DATA PROJECT_ID FIRST_BUNDLE IMPORT_DATA SECOND_BUNDLE OUTPUT_JSON');
}

const sourceDirectory = resolve(sourceArgument);
const firstBundleDirectory = resolve(firstBundleArgument);
const importDirectory = resolve(importArgument);
const secondBundleDirectory = resolve(secondBundleArgument);
const outputPath = resolve(outputArgument);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function workspace(directory, operation) {
  const projectStore = await SqliteProjectStore.open({ filename: join(directory, 'studio.sqlite') });
  const artifactStore = new ContentAddressedArtifactStore({ rootDirectory: join(directory, 'artifacts') });
  await artifactStore.initialize();
  try {
    return await operation({ projectStore, artifactStore });
  } finally {
    projectStore.close();
  }
}

const sourceIntegrity = await workspace(sourceDirectory, ({ projectStore, artifactStore }) => (
  verifyWorkspaceIntegrity({ projectStore, artifactStore })
));
if (!sourceIntegrity.ok) throw new Error('Source fixture failed full workspace integrity.');

await workspace(sourceDirectory, ({ projectStore, artifactStore }) => createSqliteProjectBundle({
  destinationDirectory: firstBundleDirectory,
  projectStore,
  artifactStore,
  projectId,
}));
const firstVerified = await verifySqliteProjectBundle(firstBundleDirectory);
const imported = await importSqliteProjectBundle({
  bundleDirectory: firstBundleDirectory,
  destinationDirectory: importDirectory,
});

const authorityRows = await workspace(importDirectory, async ({ projectStore, artifactStore }) => {
  const integrity = await verifyWorkspaceIntegrity({ projectStore, artifactStore });
  if (!integrity.ok) throw new Error('Imported fixture failed full workspace integrity.');
  const database = projectStore.workspace.database;
  const counts = Object.fromEntries([
    'grants', 'host_bindings', 'agent_attempts', 'jobs', 'job_events',
    'idempotency_records', 'source_intakes', 'human_agent_access_operations',
  ].map((table) => [table, Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count)]));
  if (Object.values(counts).some((count) => count !== 0)) {
    throw new Error(`Imported portable bundle retained live authority or operational state: ${JSON.stringify(counts)}`);
  }
  const importedJobCount = Number(database.prepare(
    'SELECT count(*) AS count FROM bundle_import_applied_jobs WHERE provenance = ?'
  ).get('bundle_import').count);
  const importCount = Number(database.prepare(
    'SELECT count(*) AS count FROM bundle_imports WHERE provenance = ?'
  ).get('bundle_import').count);
  await createSqliteProjectBundle({
    destinationDirectory: secondBundleDirectory,
    projectStore,
    artifactStore,
    projectId,
  });
  return { integrity, counts, importedJobCount, importCount };
});
const secondVerified = await verifySqliteProjectBundle(secondBundleDirectory);

const [firstProject, secondProject, firstManifest, secondManifest, firstManifestDigest, secondManifestDigest] = await Promise.all([
  readFile(join(firstBundleDirectory, 'project.json')),
  readFile(join(secondBundleDirectory, 'project.json')),
  readFile(join(firstBundleDirectory, 'manifest.json')),
  readFile(join(secondBundleDirectory, 'manifest.json')),
  readFile(join(firstBundleDirectory, 'manifest.sha256'), 'ascii'),
  readFile(join(secondBundleDirectory, 'manifest.sha256'), 'ascii'),
]);
if (!firstProject.equals(secondProject) || !firstManifest.equals(secondManifest)
    || firstManifestDigest !== secondManifestDigest) {
  throw new Error('Export → import → export did not preserve canonical semantic and CAS manifests byte-for-byte.');
}

const evidence = {
  schemaVersion: 1,
  status: 'VERIFIED',
  bundleKind: 'numberdroid-studio-project',
  projectId,
  revision: firstVerified.manifest.revision,
  projectSha256: sha256(firstProject),
  manifestSha256: sha256(firstManifest),
  artifactCount: firstVerified.artifacts.length,
  artifactDigests: firstVerified.artifacts.map(({ digest }) => digest),
  canonicalRoundTrip: {
    projectJsonByteIdentical: true,
    manifestJsonByteIdentical: true,
    manifestDigestIdentical: true,
    casDigestsIdentical: JSON.stringify(firstVerified.artifacts.map(({ digest }) => digest))
      === JSON.stringify(secondVerified.artifacts.map(({ digest }) => digest)),
  },
  importedWorkspace: {
    integrityOk: authorityRows.integrity.ok,
    liveAuthorityAndOperationalRows: authorityRows.counts,
    sanitizedAppliedJobHistoryCount: authorityRows.importedJobCount,
    importRecordCount: authorityRows.importCount,
    publishedAtomically: imported.ok,
  },
};
if (!evidence.canonicalRoundTrip.casDigestsIdentical) throw new Error('Round-trip CAS digests differ.');
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
