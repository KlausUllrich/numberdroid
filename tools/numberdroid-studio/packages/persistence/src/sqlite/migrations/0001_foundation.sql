CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  format_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  head_revision INTEGER NOT NULL CHECK (head_revision >= 1),
  head_snapshot_json TEXT NOT NULL,
  summary_json TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS revisions (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
  revision_id TEXT NOT NULL,
  parent_revision INTEGER NOT NULL CHECK (parent_revision >= 0),
  committed_at TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_type TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  revision_json TEXT NOT NULL,
  PRIMARY KEY (project_id, revision_number),
  UNIQUE (project_id, revision_id),
  UNIQUE (project_id, command_id),
  UNIQUE (project_id, idempotency_key)
) STRICT;

CREATE TABLE IF NOT EXISTS revision_parents (
  project_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  parent_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, revision_number, parent_revision),
  FOREIGN KEY (project_id, revision_number)
    REFERENCES revisions(project_id, revision_number) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS activity_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  occurred_at TEXT NOT NULL,
  event_json TEXT NOT NULL,
  FOREIGN KEY (project_id, revision_number)
    REFERENCES revisions(project_id, revision_number) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS activity_events_project_revision
  ON activity_events(project_id, revision_number);

CREATE TABLE IF NOT EXISTS aggregate_versions (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  revision_number INTEGER NOT NULL,
  PRIMARY KEY (project_id, aggregate_type, aggregate_id),
  FOREIGN KEY (project_id, revision_number)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TABLE IF NOT EXISTS projections (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  projection_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  revision_number INTEGER NOT NULL,
  projection_json TEXT NOT NULL,
  projection_hash TEXT NOT NULL,
  PRIMARY KEY (project_id, projection_type, entity_id),
  FOREIGN KEY (project_id, revision_number)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TABLE IF NOT EXISTS idempotency_records (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  result_json TEXT NOT NULL,
  PRIMARY KEY (project_id, idempotency_key),
  FOREIGN KEY (project_id, revision_number)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TABLE IF NOT EXISTS grants (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  grant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  revoke_reason TEXT,
  authorization_status TEXT NOT NULL CHECK (
    authorization_status IN ('ACTIVE', 'REVOKED', 'EXPIRED', 'LEGACY_UNBOUND')
  ),
  PRIMARY KEY (project_id, grant_id)
) STRICT;

CREATE TABLE IF NOT EXISTS migration_runs (
  migration_id TEXT PRIMARY KEY,
  source_manifest_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'VERIFIED', 'FAILED')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  report_json TEXT
) STRICT;
