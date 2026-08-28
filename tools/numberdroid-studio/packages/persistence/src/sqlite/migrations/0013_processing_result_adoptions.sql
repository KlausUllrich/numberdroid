CREATE TABLE task_branch_processing_result_adoptions (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  branch_revision INTEGER NOT NULL CHECK (branch_revision >= 2),
  branch_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
  asset_id TEXT NOT NULL,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('surface', 'prop', 'item')),
  asset_version INTEGER NOT NULL CHECK (asset_version >= 1),
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  command_fingerprint TEXT NOT NULL CHECK (length(command_fingerprint) = 64),
  semantic_fingerprint TEXT NOT NULL CHECK (length(semantic_fingerprint) = 64),
  authority_binding_fingerprint TEXT NOT NULL CHECK (length(authority_binding_fingerprint) = 64),
  preflight_receipt_fingerprint TEXT NOT NULL CHECK (length(preflight_receipt_fingerprint) = 64),
  processing_binding_fingerprint TEXT NOT NULL CHECK (length(processing_binding_fingerprint) = 64),
  plan_fingerprint TEXT NOT NULL CHECK (length(plan_fingerprint) = 64),
  metadata_fingerprint TEXT NOT NULL CHECK (length(metadata_fingerprint) = 64),
  findings_fingerprint TEXT NOT NULL CHECK (length(findings_fingerprint) = 64),
  result_fingerprint TEXT NOT NULL CHECK (length(result_fingerprint) = 64),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  committed_at TEXT NOT NULL,
  committed_by TEXT NOT NULL,
  PRIMARY KEY (project_id, task_id, branch_revision),
  UNIQUE (project_id, task_id, command_id),
  UNIQUE (project_id, task_id, idempotency_key),
  UNIQUE (project_id, task_id, asset_id, asset_version),
  FOREIGN KEY (project_id, task_id, branch_revision)
    REFERENCES task_branch_revisions(project_id, task_id, branch_revision)
) STRICT;

CREATE INDEX task_branch_processing_result_adoptions_asset
  ON task_branch_processing_result_adoptions(project_id, task_id, asset_id, asset_version);

CREATE TRIGGER task_branch_processing_result_adoptions_immutable
BEFORE UPDATE ON task_branch_processing_result_adoptions
BEGIN
  SELECT RAISE(ABORT, 'task branch processing-result adoptions are immutable');
END;

CREATE TABLE task_branch_processing_result_artifact_references (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  branch_revision INTEGER NOT NULL CHECK (branch_revision >= 2),
  role TEXT NOT NULL CHECK (role IN ('recipe-input', 'selected-output')),
  digest TEXT NOT NULL REFERENCES artifacts(digest),
  artifact_uri TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type = 'image/png'),
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  verified_at TEXT NOT NULL,
  evidence_fingerprint TEXT NOT NULL CHECK (length(evidence_fingerprint) = 64),
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  PRIMARY KEY (project_id, task_id, branch_revision, role),
  FOREIGN KEY (project_id, task_id, branch_revision)
    REFERENCES task_branch_processing_result_adoptions(project_id, task_id, branch_revision)
) STRICT;

CREATE INDEX task_branch_processing_result_artifact_references_digest
  ON task_branch_processing_result_artifact_references(digest);

CREATE TRIGGER task_branch_processing_result_artifact_references_immutable
BEFORE UPDATE ON task_branch_processing_result_artifact_references
BEGIN
  SELECT RAISE(ABORT, 'task branch processing-result artifact references are immutable');
END;
