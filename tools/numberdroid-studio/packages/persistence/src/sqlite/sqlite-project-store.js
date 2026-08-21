import { ProjectStore, headRevision, projectSummary } from '../../../application/src/project-store.js';
import { fingerprint } from '../../../application/src/value-utils.js';
import { StudioError, invariant } from '../../../domain/src/errors.js';
import { SqliteWorkspace } from './sqlite-workspace.js';

function parseJson(value, label) {
  try { return JSON.parse(value); } catch (error) {
    throw new StudioError('CORRUPT_PROJECT', `Invalid JSON stored in ${label}.`, { cause: error.message });
  }
}

function authorizationStatus(grant, { legacy = false, now }) {
  if (legacy) return 'LEGACY_UNBOUND';
  if (grant.revokedAt) return 'REVOKED';
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= Date.parse(now)) return 'EXPIRED';
  return 'ACTIVE';
}

function writeGrants(database, projectId, snapshot, options) {
  const insert = database.prepare(`
    INSERT INTO grants(
      project_id, grant_id, agent_id, task_id, scopes_json, issued_at, issued_by,
      expires_at, revoked_at, revoke_reason, authorization_status, branch_id,
      object_scopes_json, budget_json, usage_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, grant_id) DO UPDATE SET
      agent_id = excluded.agent_id,
      task_id = excluded.task_id,
      scopes_json = excluded.scopes_json,
      issued_at = excluded.issued_at,
      issued_by = excluded.issued_by,
      expires_at = excluded.expires_at,
      revoked_at = excluded.revoked_at,
      revoke_reason = excluded.revoke_reason,
      authorization_status = excluded.authorization_status,
      branch_id = excluded.branch_id,
      object_scopes_json = excluded.object_scopes_json,
      budget_json = excluded.budget_json,
      usage_json = excluded.usage_json,
      status = excluded.status
  `);
  for (const grant of snapshot.grants) {
    const effectiveStatus = authorizationStatus(grant, options);
    invariant(
      options.legacy || (grant.branchId && Array.isArray(grant.objectScopes) && grant.budget && grant.usage),
      'INVALID_GRANT_PROJECTION',
      'Active grants require branch, object-scope, budget, and usage fields.',
      { projectId, grantId: grant.id },
    );
    insert.run(
      projectId,
      grant.id,
      grant.agentId,
      grant.taskId,
      JSON.stringify(grant.scopes),
      grant.issuedAt,
      grant.issuedBy,
      grant.expiresAt,
      grant.revokedAt,
      grant.revokeReason,
      effectiveStatus,
      grant.branchId ?? 'branch.legacy-unbound',
      JSON.stringify(grant.objectScopes ?? []),
      JSON.stringify(grant.budget ?? {}),
      JSON.stringify(grant.usage ?? {}),
      options.legacy ? 'LEGACY_UNBOUND' : (grant.status ?? effectiveStatus),
    );
  }
}

function writeRevision(database, projectId, revision) {
  database.prepare(`
    INSERT INTO revisions(
      project_id, revision_number, revision_id, parent_revision, committed_at,
      command_id, idempotency_key, command_type, fingerprint, revision_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    revision.number,
    revision.id,
    revision.parentRevision,
    revision.committedAt,
    revision.command.commandId,
    revision.command.idempotencyKey,
    revision.command.type,
    revision.command.fingerprint,
    JSON.stringify(revision),
  );
  database.prepare(`
    INSERT INTO revision_parents(project_id, revision_number, parent_revision)
    VALUES (?, ?, ?)
  `).run(projectId, revision.number, revision.parentRevision);
}

function writeActivity(database, projectId, revision) {
  database.prepare(`
    INSERT INTO activity_events(event_id, project_id, revision_number, occurred_at, event_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(revision.event.id, projectId, revision.number, revision.event.occurredAt, JSON.stringify(revision.event));
}

function writeIdempotency(database, projectId, revision) {
  database.prepare(`
    INSERT INTO idempotency_records(
      project_id, idempotency_key, command_id, fingerprint, revision_number, result_json
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    revision.command.idempotencyKey,
    revision.command.commandId,
    revision.command.fingerprint,
    revision.number,
    JSON.stringify(revision.result),
  );
}

function writeProjection(database, projectId, revision) {
  const projectionJson = JSON.stringify(revision.snapshot);
  const projectionHash = fingerprint(revision.snapshot);
  database.prepare(`
    INSERT INTO projections(
      project_id, projection_type, entity_id, version, revision_number, projection_json, projection_hash
    ) VALUES (?, 'project_head', ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, projection_type, entity_id) DO UPDATE SET
      version = excluded.version,
      revision_number = excluded.revision_number,
      projection_json = excluded.projection_json,
      projection_hash = excluded.projection_hash
  `).run(projectId, projectId, revision.number, revision.number, projectionJson, projectionHash);
  database.prepare(`
    INSERT INTO aggregate_versions(project_id, aggregate_type, aggregate_id, version, revision_number)
    VALUES (?, 'project', ?, ?, ?)
    ON CONFLICT(project_id, aggregate_type, aggregate_id) DO UPDATE SET
      version = excluded.version,
      revision_number = excluded.revision_number
  `).run(projectId, projectId, revision.number, revision.number);
}

function mapSqliteError(error, details = {}) {
  if (error instanceof StudioError) return error;
  if (String(error.code).startsWith('SQLITE_CONSTRAINT')) {
    return new StudioError('PERSISTENCE_CONSTRAINT', 'SQLite rejected a conflicting persistence record.', {
      ...details,
      cause: error.message,
    });
  }
  return error;
}

export class SqliteProjectStore extends ProjectStore {
  #workspace;

  static async open(options) {
    return new SqliteProjectStore({ workspace: await SqliteWorkspace.open(options) });
  }

  constructor({ workspace }) {
    super();
    invariant(workspace instanceof SqliteWorkspace, 'VALIDATION_ERROR', 'SqliteWorkspace is required.');
    this.#workspace = workspace;
  }

  get workspace() { return this.#workspace; }

  async createProject(document, { legacyGrants = false } = {}) {
    invariant(document.revisions.length === 1, 'INVALID_REVISION', 'A new SQLite project needs exactly one revision.');
    const revision = document.revisions[0];
    invariant(revision.number === 1 && revision.parentRevision === 0, 'INVALID_REVISION', 'Initial revision must be revision 1.');
    try {
      this.#workspace.transaction((database) => {
        const summary = projectSummary(document);
        database.prepare(`
          INSERT INTO projects(project_id, format_version, created_at, head_revision, head_snapshot_json, summary_json)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          document.projectId,
          document.formatVersion,
          document.createdAt,
          revision.number,
          JSON.stringify(revision.snapshot),
          JSON.stringify(summary),
        );
        writeRevision(database, document.projectId, revision);
        this.#workspace.fault('after_revision_insert');
        writeActivity(database, document.projectId, revision);
        this.#workspace.fault('after_activity_insert');
        writeProjection(database, document.projectId, revision);
        this.#workspace.fault('after_projection_update');
        writeIdempotency(database, document.projectId, revision);
        this.#workspace.fault('after_idempotency_insert');
        writeGrants(database, document.projectId, revision.snapshot, {
          legacy: legacyGrants,
          now: revision.committedAt,
        });
        this.#workspace.fault('after_grant_projection');
      });
      return structuredClone(document);
    } catch (error) {
      throw mapSqliteError(error, { projectId: document.projectId });
    }
  }

  async loadProject(projectId) {
    const project = this.#workspace.database.prepare(`
      SELECT project_id, format_version, created_at, head_revision FROM projects WHERE project_id = ?
    `).get(projectId);
    if (!project) return null;
    const revisions = this.#workspace.database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
    `).all(projectId).map((row) => parseJson(row.revision_json, 'revisions.revision_json'));
    invariant(revisions.length > 0, 'CORRUPT_PROJECT', 'SQLite project has no revisions.', { projectId });

    const grantRows = this.#workspace.database.prepare(`
      SELECT grant_id, authorization_status, issued_at, revoked_at, revoke_reason
      FROM grants WHERE project_id = ?
    `).all(projectId);
    const grantStatus = new Map(grantRows.map((row) => [row.grant_id, row]));
    const head = revisions.at(-1);
    head.snapshot.grants = head.snapshot.grants.map((grant) => {
      const stored = grantStatus.get(grant.id);
      if (!stored) return grant;
      if (stored.authorization_status === 'LEGACY_UNBOUND') {
        return {
          ...grant,
          status: 'LEGACY_UNBOUND',
          authorizationStatus: 'LEGACY_UNBOUND',
          revokedAt: grant.revokedAt ?? stored.revoked_at ?? stored.issued_at,
          revokeReason: grant.revokeReason ?? 'LEGACY_UNBOUND',
        };
      }
      return { ...grant, authorizationStatus: stored.authorization_status };
    });
    return {
      formatVersion: Number(project.format_version),
      projectId: project.project_id,
      createdAt: project.created_at,
      revisions,
    };
  }

  async appendRevision(projectId, expectedRevision, revision, { legacyGrants = false } = {}) {
    try {
      this.#workspace.transaction((database) => {
        const project = database.prepare('SELECT head_revision FROM projects WHERE project_id = ?').get(projectId);
        if (!project) throw new StudioError('PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
        const actualRevision = Number(project.head_revision);
        invariant(actualRevision === expectedRevision, 'REVISION_CONFLICT', 'The project changed after it was read.', {
          projectId,
          expectedRevision,
          actualRevision,
        });
        invariant(
          revision.number === expectedRevision + 1 && revision.parentRevision === expectedRevision,
          'INVALID_REVISION',
          'The appended revision does not follow the current head.',
        );
        writeRevision(database, projectId, revision);
        this.#workspace.fault('after_revision_insert');
        writeActivity(database, projectId, revision);
        this.#workspace.fault('after_activity_insert');
        writeProjection(database, projectId, revision);
        this.#workspace.fault('after_projection_update');
        writeIdempotency(database, projectId, revision);
        this.#workspace.fault('after_idempotency_insert');
        writeGrants(database, projectId, revision.snapshot, { legacy: legacyGrants, now: revision.committedAt });
        this.#workspace.fault('after_grant_projection');

        const document = {
          formatVersion: 1,
          projectId,
          createdAt: revision.snapshot.project.createdAt,
          revisions: database.prepare('SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number')
            .all(projectId).map((row) => parseJson(row.revision_json, 'revisions.revision_json')),
        };
        const summary = projectSummary(document);
        const updated = database.prepare(`
          UPDATE projects
          SET head_revision = ?, head_snapshot_json = ?, summary_json = ?
          WHERE project_id = ? AND head_revision = ?
        `).run(revision.number, JSON.stringify(revision.snapshot), JSON.stringify(summary), projectId, expectedRevision);
        invariant(Number(updated.changes) === 1, 'REVISION_CONFLICT', 'Project head compare-and-swap failed.', {
          projectId,
          expectedRevision,
        });
        this.#workspace.fault('before_transaction_commit');
      });
      return this.loadProject(projectId);
    } catch (error) {
      throw mapSqliteError(error, { projectId, expectedRevision });
    }
  }

  async listProjects() {
    return this.#workspace.database.prepare('SELECT summary_json FROM projects ORDER BY project_id')
      .all().map((row) => parseJson(row.summary_json, 'projects.summary_json'))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async importProjectDocument(document, { legacyGrants = true } = {}) {
    const existingRows = this.#workspace.database.prepare(`
      SELECT revision_json FROM revisions WHERE project_id = ? ORDER BY revision_number
    `).all(document.projectId);
    if (existingRows.length > 0) {
      const existingDocument = {
        formatVersion: document.formatVersion,
        projectId: document.projectId,
        createdAt: document.createdAt,
        revisions: existingRows.map((row) => parseJson(row.revision_json, 'revisions.revision_json')),
      };
      invariant(
        fingerprint(existingDocument) === fingerprint(document),
        'MIGRATION_PROJECT_CONFLICT',
        'Destination already contains a different project with the same ID.',
        { projectId: document.projectId },
      );
      return { projectId: document.projectId, imported: false, revision: document.revisions.at(-1).number };
    }
    const initial = { ...structuredClone(document), revisions: [structuredClone(document.revisions[0])] };
    await this.createProject(initial, { legacyGrants });
    for (const revision of document.revisions.slice(1)) {
      await this.appendRevision(document.projectId, revision.parentRevision, revision, { legacyGrants });
    }
    return { projectId: document.projectId, imported: true, revision: document.revisions.at(-1).number };
  }

  async rebuildProjectProjection(projectId) {
    const document = await this.loadProject(projectId);
    if (!document) throw new StudioError('PROJECT_NOT_FOUND', 'The project does not exist.', { projectId });
    const revision = headRevision(document);
    this.#workspace.transaction((database) => {
      writeProjection(database, projectId, revision);
      writeGrants(database, projectId, revision.snapshot, {
        legacy: revision.snapshot.grants.some((grant) => grant.authorizationStatus === 'LEGACY_UNBOUND'),
        now: revision.committedAt,
      });
    });
    return { projectId, revision: revision.number, projectionHash: fingerprint(revision.snapshot) };
  }

  integrityCheck() { return this.#workspace.integrityCheck(); }
  backupTo(destination) { return this.#workspace.backupTo(destination); }
  close() { this.#workspace.close(); }
}
