CREATE TABLE asset_slice_bindings (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  slice_id TEXT NOT NULL,
  slice_version INTEGER NOT NULL CHECK (slice_version >= 1),
  atlas_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_digest TEXT NOT NULL REFERENCES artifacts(digest) CHECK (length(source_digest) = 64),
  atlas_definition_version INTEGER NOT NULL CHECK (atlas_definition_version >= 1),
  atlas_definition_fingerprint TEXT NOT NULL CHECK (length(atlas_definition_fingerprint) = 64),
  rectangle_id TEXT NOT NULL,
  rectangle_json TEXT NOT NULL CHECK (json_valid(rectangle_json)),
  rect_x INTEGER NOT NULL CHECK (rect_x >= 0),
  rect_y INTEGER NOT NULL CHECK (rect_y >= 0),
  rect_width INTEGER NOT NULL CHECK (rect_width >= 1),
  rect_height INTEGER NOT NULL CHECK (rect_height >= 1),
  pivot_x INTEGER,
  pivot_y INTEGER,
  processor_id TEXT NOT NULL,
  artifact_digest TEXT NOT NULL REFERENCES artifacts(digest) CHECK (length(artifact_digest) = 64),
  artifact_uri TEXT NOT NULL CHECK (
    artifact_uri = 'studio://artifacts/sha256/' || artifact_digest
  ),
  media_type TEXT NOT NULL CHECK (media_type = 'image/png'),
  byte_size INTEGER NOT NULL CHECK (byte_size >= 1),
  width INTEGER NOT NULL CHECK (width >= 1),
  height INTEGER NOT NULL CHECK (height >= 1),
  prior_digest TEXT CHECK (prior_digest IS NULL OR length(prior_digest) = 64),
  committed_revision INTEGER NOT NULL CHECK (committed_revision >= 1),
  bound_revision INTEGER NOT NULL CHECK (bound_revision >= 1),
  committed_at TEXT NOT NULL,
  committed_by TEXT NOT NULL,
  job_id TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance IN ('native_revision', 'bundle_import')),
  PRIMARY KEY (project_id, slice_id, slice_version),
  FOREIGN KEY (project_id, committed_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, bound_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK ((pivot_x IS NULL) = (pivot_y IS NULL)),
  CHECK (width = rect_width AND height = rect_height)
) STRICT;

CREATE INDEX asset_slice_bindings_project_atlas
  ON asset_slice_bindings(project_id, atlas_id, slice_id, slice_version);

CREATE INDEX asset_slice_bindings_artifact
  ON asset_slice_bindings(artifact_digest);

CREATE TRIGGER asset_slice_bindings_immutable
BEFORE UPDATE ON asset_slice_bindings
BEGIN
  SELECT RAISE(ABORT, 'asset_slice_bindings are immutable');
END;

CREATE TABLE asset_proposals (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  created_revision INTEGER NOT NULL CHECK (created_revision >= 1),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DECIDED', 'APPLIED')),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 64),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  proposer_actor_kind TEXT NOT NULL CHECK (proposer_actor_kind IN ('human', 'agent', 'bundle_import')),
  proposer_actor_id TEXT NOT NULL,
  proposer_task_id TEXT,
  proposer_branch_id TEXT NOT NULL,
  proposer_grant_id TEXT,
  created_at TEXT NOT NULL,
  decided_revision INTEGER,
  applied_revision INTEGER,
  PRIMARY KEY (project_id, proposal_id),
  FOREIGN KEY (project_id, base_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, created_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, decided_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, applied_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (
    (proposer_actor_kind = 'agent' AND proposer_task_id IS NOT NULL AND proposer_grant_id IS NOT NULL)
    OR (proposer_actor_kind IN ('human', 'bundle_import') AND proposer_grant_id IS NULL)
  ),
  CHECK (
    (status = 'PENDING' AND decided_revision IS NULL AND applied_revision IS NULL)
    OR (status = 'DECIDED' AND decided_revision IS NOT NULL AND applied_revision IS NULL)
    OR (status = 'APPLIED' AND decided_revision IS NOT NULL AND applied_revision IS NOT NULL)
  )
) STRICT;

CREATE INDEX asset_proposals_project_status_created
  ON asset_proposals(project_id, status, created_revision, proposal_id);

CREATE TABLE asset_proposal_items (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_order INTEGER NOT NULL CHECK (item_order BETWEEN 0 AND 63),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update')),
  asset_id TEXT NOT NULL,
  expected_asset_version INTEGER NOT NULL CHECK (expected_asset_version >= 0),
  expected_metadata_version INTEGER NOT NULL CHECK (expected_metadata_version >= 0),
  slice_id TEXT NOT NULL,
  slice_version INTEGER NOT NULL CHECK (slice_version >= 1),
  desired_name TEXT NOT NULL CHECK (length(desired_name) BETWEEN 1 AND 160),
  desired_kind TEXT NOT NULL CHECK (desired_kind IN ('surface', 'prop', 'item')),
  desired_metadata_json TEXT NOT NULL CHECK (json_valid(desired_metadata_json)),
  desired_metadata_fingerprint TEXT NOT NULL CHECK (length(desired_metadata_fingerprint) = 64),
  diff_json TEXT NOT NULL CHECK (json_valid(diff_json)),
  finding_fingerprint TEXT NOT NULL CHECK (length(finding_fingerprint) = 64),
  PRIMARY KEY (project_id, proposal_id, item_id),
  UNIQUE (project_id, proposal_id, item_order),
  UNIQUE (project_id, proposal_id, asset_id),
  FOREIGN KEY (project_id, proposal_id)
    REFERENCES asset_proposals(project_id, proposal_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, slice_id, slice_version)
    REFERENCES asset_slice_bindings(project_id, slice_id, slice_version),
  CHECK (
    (operation = 'create' AND expected_asset_version = 0 AND expected_metadata_version = 0)
    OR operation = 'update'
  )
) STRICT;

CREATE INDEX asset_proposal_items_project_asset
  ON asset_proposal_items(project_id, asset_id, proposal_id);

CREATE TRIGGER asset_proposal_items_immutable
BEFORE UPDATE ON asset_proposal_items
BEGIN
  SELECT RAISE(ABORT, 'asset_proposal_items are immutable');
END;

CREATE TABLE asset_proposal_item_findings (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  finding_order INTEGER NOT NULL CHECK (finding_order >= 0),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
  rule_id TEXT NOT NULL CHECK (rule_id GLOB 'studio.asset.*'),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('asset', 'metadata', 'slice')),
  target_id TEXT NOT NULL,
  path TEXT NOT NULL,
  explanation TEXT NOT NULL,
  remediation TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  PRIMARY KEY (project_id, proposal_id, item_id, finding_id),
  UNIQUE (project_id, proposal_id, item_id, finding_order),
  FOREIGN KEY (project_id, proposal_id, item_id)
    REFERENCES asset_proposal_items(project_id, proposal_id, item_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX asset_proposal_item_findings_project_severity
  ON asset_proposal_item_findings(project_id, severity, rule_id);

CREATE TRIGGER asset_proposal_item_findings_immutable
BEFORE UPDATE ON asset_proposal_item_findings
BEGIN
  SELECT RAISE(ABORT, 'asset_proposal_item_findings are immutable');
END;

CREATE TABLE asset_proposal_decisions (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('ACCEPTED', 'REJECTED')),
  rejection_reason TEXT,
  decision_revision INTEGER NOT NULL CHECK (decision_revision >= 1),
  decided_at TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  PRIMARY KEY (project_id, proposal_id, item_id),
  FOREIGN KEY (project_id, proposal_id, item_id)
    REFERENCES asset_proposal_items(project_id, proposal_id, item_id),
  FOREIGN KEY (project_id, decision_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (
    (decision = 'ACCEPTED' AND rejection_reason IS NULL)
    OR (decision = 'REJECTED'
      AND length(trim(rejection_reason)) BETWEEN 1 AND 2000)
  )
) STRICT;

CREATE INDEX asset_proposal_decisions_project_proposal
  ON asset_proposal_decisions(project_id, proposal_id, decision, item_id);

CREATE TRIGGER asset_proposal_decisions_immutable
BEFORE UPDATE ON asset_proposal_decisions
BEGIN
  SELECT RAISE(ABORT, 'asset_proposal_decisions are immutable');
END;

CREATE TABLE asset_proposal_applications (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  application_revision INTEGER NOT NULL CHECK (application_revision >= 1),
  accepted_count INTEGER NOT NULL CHECK (accepted_count BETWEEN 0 AND 64),
  rejected_count INTEGER NOT NULL CHECK (rejected_count BETWEEN 0 AND 64),
  applied_at TEXT NOT NULL,
  applied_by TEXT NOT NULL,
  PRIMARY KEY (project_id, proposal_id),
  FOREIGN KEY (project_id, proposal_id)
    REFERENCES asset_proposals(project_id, proposal_id),
  FOREIGN KEY (project_id, application_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (accepted_count + rejected_count BETWEEN 1 AND 64)
) STRICT;

CREATE TRIGGER asset_proposal_applications_immutable
BEFORE UPDATE ON asset_proposal_applications
BEGIN
  SELECT RAISE(ABORT, 'asset_proposal_applications are immutable');
END;

CREATE TABLE asset_versions (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL CHECK (asset_version >= 1),
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  previous_asset_version INTEGER,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  kind TEXT NOT NULL CHECK (kind IN ('surface', 'prop', 'item')),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL')),
  slice_id TEXT NOT NULL,
  slice_version INTEGER NOT NULL CHECK (slice_version >= 1),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json)),
  metadata_fingerprint TEXT NOT NULL CHECK (length(metadata_fingerprint) = 64),
  findings_fingerprint TEXT NOT NULL CHECK (length(findings_fingerprint) = 64),
  accepted_warning_ids_json TEXT NOT NULL CHECK (json_valid(accepted_warning_ids_json)),
  created_revision INTEGER NOT NULL CHECK (created_revision >= 1),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  proposal_id TEXT,
  proposal_item_id TEXT,
  provenance TEXT NOT NULL CHECK (provenance IN ('native_revision', 'bundle_import')),
  PRIMARY KEY (project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, slice_id, slice_version)
    REFERENCES asset_slice_bindings(project_id, slice_id, slice_version),
  FOREIGN KEY (project_id, created_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, asset_id, previous_asset_version)
    REFERENCES asset_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, proposal_id, proposal_item_id)
    REFERENCES asset_proposal_items(project_id, proposal_id, item_id),
  CHECK (
    (asset_version = 1 AND previous_asset_version IS NULL)
    OR (asset_version > 1 AND previous_asset_version = asset_version - 1)
  ),
  CHECK ((proposal_id IS NULL) = (proposal_item_id IS NULL))
) STRICT;

CREATE INDEX asset_versions_project_created
  ON asset_versions(project_id, created_revision, asset_id, asset_version);

CREATE INDEX asset_versions_project_slice
  ON asset_versions(project_id, slice_id, slice_version);

CREATE TRIGGER asset_versions_immutable
BEFORE UPDATE ON asset_versions
BEGIN
  SELECT RAISE(ABORT, 'asset_versions are immutable');
END;

CREATE TABLE asset_version_findings (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  finding_id TEXT NOT NULL,
  finding_order INTEGER NOT NULL CHECK (finding_order >= 0),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
  rule_id TEXT NOT NULL CHECK (rule_id GLOB 'studio.asset.*'),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('asset', 'metadata', 'slice')),
  target_id TEXT NOT NULL,
  path TEXT NOT NULL,
  explanation TEXT NOT NULL,
  remediation TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  PRIMARY KEY (project_id, asset_id, asset_version, finding_id),
  UNIQUE (project_id, asset_id, asset_version, finding_order),
  FOREIGN KEY (project_id, asset_id, asset_version)
    REFERENCES asset_versions(project_id, asset_id, asset_version) ON DELETE CASCADE
) STRICT;

CREATE INDEX asset_version_findings_project_severity
  ON asset_version_findings(project_id, severity, rule_id);

CREATE TRIGGER asset_version_findings_immutable
BEFORE UPDATE ON asset_version_findings
BEGIN
  SELECT RAISE(ABORT, 'asset_version_findings are immutable');
END;

CREATE TABLE asset_heads (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL CHECK (asset_version >= 1),
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('surface', 'prop', 'item')),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('DRAFT', 'METADATA_COMPLETE', 'VALIDATED', 'FINAL')),
  slice_id TEXT NOT NULL,
  slice_version INTEGER NOT NULL CHECK (slice_version >= 1),
  updated_revision INTEGER NOT NULL CHECK (updated_revision >= 1),
  PRIMARY KEY (project_id, asset_id),
  FOREIGN KEY (project_id, asset_id, asset_version)
    REFERENCES asset_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, updated_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE INDEX asset_heads_project_filter
  ON asset_heads(project_id, kind, lifecycle, name, asset_id);

CREATE INDEX asset_heads_project_slice
  ON asset_heads(project_id, slice_id, slice_version);

CREATE TABLE asset_head_tags (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  tag TEXT NOT NULL CHECK (length(tag) BETWEEN 1 AND 64),
  tag_order INTEGER NOT NULL CHECK (tag_order BETWEEN 0 AND 31),
  PRIMARY KEY (project_id, asset_id, tag),
  UNIQUE (project_id, asset_id, tag_order),
  FOREIGN KEY (project_id, asset_id)
    REFERENCES asset_heads(project_id, asset_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX asset_head_tags_project_tag
  ON asset_head_tags(project_id, tag, asset_id);

CREATE TABLE bundle_imports (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  import_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  source_bundle_digest TEXT NOT NULL CHECK (length(source_bundle_digest) = 64),
  manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64),
  imported_revision INTEGER NOT NULL CHECK (imported_revision >= 1),
  imported_at TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance = 'bundle_import'),
  PRIMARY KEY (project_id, import_id),
  FOREIGN KEY (project_id, imported_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TRIGGER bundle_imports_immutable
BEFORE UPDATE ON bundle_imports
BEGIN
  SELECT RAISE(ABORT, 'bundle_imports are immutable');
END;

CREATE TABLE bundle_import_applied_jobs (
  project_id TEXT NOT NULL,
  import_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  job_kind TEXT NOT NULL CHECK (job_kind = 'ATLAS_PREVIEW'),
  input_revision INTEGER NOT NULL CHECK (input_revision >= 1),
  applied_revision INTEGER NOT NULL CHECK (applied_revision >= 1),
  atlas_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL CHECK (length(input_fingerprint) = 64),
  processor_id TEXT NOT NULL,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  output_json TEXT NOT NULL CHECK (json_valid(output_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  events_json TEXT NOT NULL CHECK (json_valid(events_json)),
  created_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance = 'bundle_import'),
  PRIMARY KEY (project_id, import_id, job_id),
  UNIQUE (project_id, job_id),
  FOREIGN KEY (project_id, import_id)
    REFERENCES bundle_imports(project_id, import_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, input_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, applied_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE INDEX bundle_import_applied_jobs_project_atlas
  ON bundle_import_applied_jobs(project_id, atlas_id, applied_revision, job_id);

CREATE TRIGGER bundle_import_applied_jobs_immutable
BEFORE UPDATE ON bundle_import_applied_jobs
BEGIN
  SELECT RAISE(ABORT, 'bundle_import_applied_jobs are immutable');
END;
