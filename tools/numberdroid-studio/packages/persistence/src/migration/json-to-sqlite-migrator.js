import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fingerprint } from '../../../application/src/value-utils.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { SqliteProjectStore } from '../sqlite/sqlite-project-store.js';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function projectFiles(sourceDirectory) {
  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
}

function validateDocument(document, filename) {
  invariant(document && typeof document === 'object', 'MIGRATION_INVALID_SOURCE', 'JSON project must be an object.', { filename });
  invariant(document.formatVersion === 1, 'MIGRATION_INVALID_SOURCE', 'Unsupported JSON project format.', { filename });
  invariant(typeof document.projectId === 'string' && document.projectId.length > 0, 'MIGRATION_INVALID_SOURCE', 'Project ID is missing.', { filename });
  invariant(Array.isArray(document.revisions) && document.revisions.length > 0, 'MIGRATION_INVALID_SOURCE', 'Project has no revisions.', { filename });
  document.revisions.forEach((revision, index) => {
    invariant(
      revision.number === index + 1 && revision.parentRevision === index,
      'MIGRATION_INVALID_SOURCE',
      'Revision history is not contiguous.',
      { filename, projectId: document.projectId, revision: revision.number },
    );
    invariant(revision.event?.revision === revision.number, 'MIGRATION_INVALID_SOURCE', 'Activity revision differs.', {
      filename,
      revision: revision.number,
    });
  });
}

function unresolvedArtifacts(snapshot) {
  return snapshot.sources
    .filter((source) => !/^studio:\/\/artifacts\/sha256\/[a-f0-9]{64}$/.test(source.artifactUri))
    .map((source) => ({ sourceId: source.id, artifactUri: source.artifactUri, finding: 'MISSING_ARTIFACT' }));
}

function aggregateIds(document) {
  const snapshot = document.revisions.at(-1).snapshot;
  return {
    project: [document.projectId],
    grant: (snapshot.grants ?? []).map((grant) => grant.id).sort(),
    source: (snapshot.sources ?? []).map((source) => source.id).sort(),
    asset: (snapshot.assets ?? []).map((asset) => asset.id).sort(),
    room: (snapshot.rooms ?? []).map((room) => room.id).sort(),
    level: (snapshot.levels ?? []).map((level) => level.id).sort(),
  };
}

function validationSummary(snapshot) {
  return snapshot.validationSummary ?? snapshot.validation ?? {
    status: 'NOT_AVAILABLE_IN_C1A',
    findingCount: 0,
  };
}

function artifactReferences(snapshot) {
  return (snapshot.sources ?? []).map((source) => ({
    sourceId: source.id,
    artifactUri: source.artifactUri,
    mediaType: source.mediaType,
  })).sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

function legacyEffectiveSnapshot(snapshot) {
  const effective = structuredClone(snapshot);
  effective.grants = (effective.grants ?? []).map((grant) => ({
    ...grant,
    status: 'LEGACY_UNBOUND',
    authorizationStatus: 'LEGACY_UNBOUND',
    revokedAt: grant.revokedAt ?? grant.issuedAt,
    revokeReason: grant.revokeReason ?? 'LEGACY_UNBOUND',
  }));
  return effective;
}

function projectEvidence(document, filename) {
  const head = document.revisions.at(-1);
  return {
    filename,
    projectId: document.projectId,
    aggregateIds: aggregateIds(document),
    headRevision: head.number,
    revisionCount: document.revisions.length,
    revisionOrder: document.revisions.map((revision) => revision.number),
    eventOrder: document.revisions.map((revision) => revision.event.id),
    activityCount: document.revisions.length,
    grantAudit: (head.snapshot.grants ?? []).map((grant) => ({
      grantId: grant.id,
      revokedAt: grant.revokedAt,
      revokeReason: grant.revokeReason,
      status: grant.status ?? (grant.revokedAt ? 'REVOKED' : 'ACTIVE'),
    })).sort((left, right) => left.grantId.localeCompare(right.grantId)),
    artifactReferences: artifactReferences(head.snapshot),
    validationSummary: validationSummary(head.snapshot),
    sourceProjectionHash: fingerprint(head.snapshot),
    expectedEffectiveProjectionHash: fingerprint(legacyEffectiveSnapshot(head.snapshot)),
  };
}

async function atomicWriteJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temporary, path);
}

export async function createJsonSourceManifest(sourceDirectory) {
  const source = resolve(sourceDirectory);
  const files = [];
  const projects = [];
  for (const name of await projectFiles(source)) {
    const path = join(source, name);
    const info = await lstat(path);
    invariant(info.isFile() && !info.isSymbolicLink(), 'MIGRATION_INVALID_SOURCE', 'Source ledger entry is not a regular file.', {
      name,
    });
    const bytes = await readFile(path);
    files.push({ name, byteSize: bytes.length, sha256: sha256(bytes) });
    const document = JSON.parse(bytes.toString('utf8'));
    validateDocument(document, name);
    projects.push(projectEvidence(document, name));
  }
  invariant(files.length > 0, 'MIGRATION_EMPTY_SOURCE', 'No JSON projects were found in the source directory.');
  const manifest = {
    schemaVersion: 1,
    sourceLedgerFormat: 'numberdroid-studio-json-ledger',
    sourceFormatVersion: 1,
    sourceDirectory: source,
    files,
    projects,
  };
  return {
    ...manifest,
    manifestHash: fingerprint({
      schemaVersion: manifest.schemaVersion,
      sourceLedgerFormat: manifest.sourceLedgerFormat,
      sourceFormatVersion: manifest.sourceFormatVersion,
      files,
      projects,
    }),
  };
}

async function copyProtectedBaseline(sourceDirectory, backupDirectory, manifest) {
  await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  for (const file of manifest.files) {
    const target = join(backupDirectory, file.name);
    try {
      await copyFile(join(sourceDirectory, file.name), target, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const copied = await readFile(target);
    invariant(sha256(copied) === file.sha256, 'MIGRATION_BACKUP_MISMATCH', 'Protected JSON copy differs from its source.', {
      name: file.name,
    });
  }
  await atomicWriteJson(join(backupDirectory, 'source-manifest.json'), manifest).catch(async (error) => {
    if (error.code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(join(backupDirectory, 'source-manifest.json'), 'utf8'));
    invariant(existing.manifestHash === manifest.manifestHash, 'MIGRATION_BACKUP_MISMATCH', 'Existing backup manifest differs.');
  });
}

function tableCount(database, table) {
  const exists = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return exists ? Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count) : 0;
}

async function assertDestinationIdentity({ database, source, manifest, migrationId }) {
  const sourceProjects = new Map(manifest.projects.map((project) => [project.projectId, project]));
  invariant(
    sourceProjects.size === manifest.projects.length,
    'MIGRATION_INVALID_SOURCE',
    'The JSON source contains duplicate project IDs.',
  );
  const runs = database.prepare('SELECT migration_id, source_manifest_hash, status, report_json FROM migration_runs ORDER BY migration_id').all();
  const existingRun = runs.find((run) => run.migration_id === migrationId) ?? null;
  invariant(
    runs.every((run) => run.migration_id === migrationId),
    'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
    'Destination belongs to a different JSON migration.',
    { migrationId, existingMigrationIds: runs.map((run) => run.migration_id) },
  );
  if (existingRun) {
    invariant(
      existingRun.source_manifest_hash === manifest.manifestHash,
      'MIGRATION_SOURCE_CHANGED',
      'Migration source changed between attempts.',
    );
  }

  const projectIds = database.prepare('SELECT project_id FROM projects ORDER BY project_id').all()
    .map((row) => row.project_id);
  if (!existingRun) {
    invariant(
      projectIds.length === 0,
      'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
      'A new JSON migration requires an empty destination project store.',
      { projectIds },
    );
  }
  invariant(
    projectIds.every((projectId) => sourceProjects.has(projectId)),
    'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
    'Destination contains a project outside this JSON source manifest.',
    { projectIds },
  );

  for (const table of [
    'artifacts',
    'artifact_references',
    'cas_gc_marks',
    'host_bindings',
    'human_agent_access_operations',
  ]) {
    invariant(
      tableCount(database, table) === 0,
      'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
      `Destination contains non-migration data in ${table}.`,
      { table },
    );
  }

  for (const projectId of projectIds) {
    const evidence = sourceProjects.get(projectId);
    const sourceDocument = JSON.parse(await readFile(join(source, evidence.filename), 'utf8'));
    const revisionRows = database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
    `).all(projectId);
    const destinationDocument = {
      formatVersion: sourceDocument.formatVersion,
      projectId: sourceDocument.projectId,
      createdAt: sourceDocument.createdAt,
      revisions: revisionRows.map((row) => JSON.parse(row.revision_json)),
    };
    invariant(
      fingerprint(destinationDocument) === fingerprint(sourceDocument),
      'MIGRATION_DESTINATION_IDENTITY_MISMATCH',
      'A partially migrated destination project differs from the protected JSON source.',
      { projectId },
    );
  }
  return existingRun;
}

export async function migrateJsonToSqlite({
  sourceDirectory,
  destinationDirectory,
  store,
  migrationId,
  clock = () => new Date().toISOString(),
  faultInjector = null,
}) {
  invariant(store instanceof SqliteProjectStore, 'VALIDATION_ERROR', 'SqliteProjectStore is required.');
  invariant(/^[A-Za-z0-9._:-]{1,128}$/.test(migrationId), 'VALIDATION_ERROR', 'migrationId is invalid.');
  const source = resolve(sourceDirectory);
  const destination = resolve(destinationDirectory);
  invariant(source !== destination && !destination.startsWith(`${source}/`), 'MIGRATION_UNSAFE_DESTINATION', 'Destination must be separate from the source baseline.');
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const manifest = await createJsonSourceManifest(source);
  const database = store.workspace.database;
  const existingRun = await assertDestinationIdentity({ database, source, manifest, migrationId });
  const backupDirectory = join(destination, 'protected-json', migrationId);
  await copyProtectedBaseline(source, backupDirectory, manifest);
  if (existingRun?.status === 'VERIFIED') {
    return JSON.parse(existingRun.report_json);
  }
  if (existingRun) {
    database.prepare(`UPDATE migration_runs SET status = 'RUNNING', completed_at = NULL, report_json = NULL WHERE migration_id = ?`).run(migrationId);
  } else {
    database.prepare(`
      INSERT INTO migration_runs(migration_id, source_manifest_hash, status, started_at)
      VALUES (?, ?, 'RUNNING', ?)
    `).run(migrationId, manifest.manifestHash, clock());
  }

  try {
    const projects = [];
    for (const [index, file] of manifest.files.entries()) {
      const document = JSON.parse(await readFile(join(source, file.name), 'utf8'));
      validateDocument(document, file.name);
      const sourceHash = fingerprint(document);
      const outcome = await store.importProjectDocument(document, { legacyGrants: true });
      faultInjector?.(`after_project_${index + 1}`);
      const rawRows = database.prepare(`
        SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
      `).all(document.projectId);
      const rawDocument = {
        formatVersion: document.formatVersion,
        projectId: document.projectId,
        createdAt: document.createdAt,
        revisions: rawRows.map((row) => JSON.parse(row.revision_json)),
      };
      invariant(fingerprint(rawDocument) === sourceHash, 'MIGRATION_PARITY_FAILED', 'Stored revision ledger differs from JSON source.', {
        projectId: document.projectId,
      });
      const loaded = await store.loadProject(document.projectId);
      const sourceHead = document.revisions.at(-1);
      const destinationHead = loaded.revisions.at(-1);
      const evidence = projectEvidence(document, file.name);
      const legacyGrantCount = destinationHead.snapshot.grants
        .filter((grant) => grant.authorizationStatus === 'LEGACY_UNBOUND').length;
      invariant(
        legacyGrantCount === sourceHead.snapshot.grants.length,
        'MIGRATION_PARITY_FAILED',
        'Not every legacy grant was made inactive.',
        { projectId: document.projectId },
      );
      invariant(
        fingerprint(destinationHead.snapshot) === evidence.expectedEffectiveProjectionHash,
        'MIGRATION_PARITY_FAILED',
        'Effective SQLite projection differs from the safely deactivated legacy projection.',
        { projectId: document.projectId },
      );
      const destinationEvents = rawRows.map((row) => JSON.parse(row.revision_json).event.id);
      invariant(
        fingerprint(destinationEvents) === fingerprint(evidence.eventOrder),
        'MIGRATION_PARITY_FAILED',
        'Event/activity ordering differs from the JSON source.',
        { projectId: document.projectId },
      );
      projects.push({
        projectId: document.projectId,
        aggregateIds: evidence.aggregateIds,
        imported: outcome.imported,
        headRevision: sourceHead.number,
        revisionCount: document.revisions.length,
        activityCount: document.revisions.length,
        eventOrder: evidence.eventOrder,
        grantAudit: evidence.grantAudit,
        historicalDocumentHash: sourceHash,
        sourceProjectionHash: evidence.sourceProjectionHash,
        expectedEffectiveProjectionHash: evidence.expectedEffectiveProjectionHash,
        effectiveProjectionHash: fingerprint(destinationHead.snapshot),
        legacyGrantCount,
        artifactReferences: evidence.artifactReferences,
        unresolvedArtifacts: unresolvedArtifacts(sourceHead.snapshot),
        validationSummary: evidence.validationSummary,
      });
    }
    const integrity = store.integrityCheck();
    invariant(integrity.ok, 'MIGRATION_INTEGRITY_FAILED', 'SQLite integrity checks failed after import.', integrity);
    const report = {
      schemaVersion: 1,
      migrationId,
      sourceManifest: manifest,
      protectedBackupDirectory: backupDirectory,
      destinationDatabase: store.workspace.filename,
      status: 'VERIFIED',
      completedAt: clock(),
      integrity,
      projects,
      cutoverPerformed: false,
    };
    const reportPath = join(destination, `migration-report-${migrationId}.json`);
    await atomicWriteJson(reportPath, report).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
      const existing = JSON.parse(await readFile(reportPath, 'utf8'));
      invariant(existing.sourceManifest.manifestHash === manifest.manifestHash, 'MIGRATION_REPORT_CONFLICT', 'Existing report belongs to another source.');
    });
    database.prepare(`
      UPDATE migration_runs SET status = 'VERIFIED', completed_at = ?, report_json = ? WHERE migration_id = ?
    `).run(report.completedAt, JSON.stringify(report), migrationId);
    return report;
  } catch (error) {
    database.prepare(`
      UPDATE migration_runs SET status = 'FAILED', completed_at = ?, report_json = ? WHERE migration_id = ?
    `).run(clock(), JSON.stringify({ code: error.code ?? 'INTERNAL_ERROR', message: error.message }), migrationId);
    throw error;
  }
}
