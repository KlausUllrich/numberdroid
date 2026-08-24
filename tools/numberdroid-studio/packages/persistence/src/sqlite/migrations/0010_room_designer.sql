CREATE TABLE room_archetype_versions (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  room_archetype_id TEXT NOT NULL,
  archetype_version INTEGER NOT NULL CHECK (archetype_version >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('room', 'hallway')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  archetype_json TEXT NOT NULL CHECK (json_valid(archetype_json)),
  content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
  created_revision INTEGER NOT NULL CHECK (created_revision >= 1),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  provenance TEXT NOT NULL CHECK (provenance IN ('native_revision', 'bundle_import')),
  PRIMARY KEY (project_id, room_archetype_id, archetype_version),
  FOREIGN KEY (project_id, created_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE INDEX room_archetype_versions_project_kind
  ON room_archetype_versions(project_id, kind, room_archetype_id, archetype_version);

CREATE TRIGGER room_archetype_versions_immutable
BEFORE UPDATE ON room_archetype_versions
BEGIN
  SELECT RAISE(ABORT, 'room_archetype_versions are immutable');
END;

CREATE TABLE room_archetype_heads (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  room_archetype_id TEXT NOT NULL,
  archetype_version INTEGER NOT NULL CHECK (archetype_version >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('room', 'hallway')),
  display_name TEXT NOT NULL,
  updated_revision INTEGER NOT NULL CHECK (updated_revision >= 1),
  PRIMARY KEY (project_id, room_archetype_id),
  FOREIGN KEY (project_id, room_archetype_id, archetype_version)
    REFERENCES room_archetype_versions(project_id, room_archetype_id, archetype_version),
  FOREIGN KEY (project_id, updated_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE INDEX room_archetype_heads_project_kind
  ON room_archetype_heads(project_id, kind, display_name, room_archetype_id);

CREATE TABLE room_archetype_governing_rules (
  project_id TEXT NOT NULL,
  room_archetype_id TEXT NOT NULL,
  archetype_version INTEGER NOT NULL,
  rule_id TEXT NOT NULL,
  rule_order INTEGER NOT NULL CHECK (rule_order BETWEEN 0 AND 31),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 256),
  PRIMARY KEY (project_id, room_archetype_id, archetype_version, rule_id),
  UNIQUE (project_id, room_archetype_id, archetype_version, rule_order),
  FOREIGN KEY (project_id, room_archetype_id, archetype_version)
    REFERENCES room_archetype_versions(project_id, room_archetype_id, archetype_version) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER room_archetype_governing_rules_immutable
BEFORE UPDATE ON room_archetype_governing_rules
BEGIN
  SELECT RAISE(ABORT, 'room_archetype_governing_rules are immutable');
END;

CREATE TABLE room_placement_proposals (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  room_variant_id TEXT NOT NULL,
  expected_room_variant_version INTEGER NOT NULL CHECK (expected_room_variant_version >= 1),
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  created_revision INTEGER NOT NULL CHECK (created_revision >= 1),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DECIDED', 'APPLIED')),
  item_count INTEGER NOT NULL CHECK (item_count BETWEEN 1 AND 64),
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  finding_fingerprint TEXT NOT NULL CHECK (length(finding_fingerprint) = 64),
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

CREATE INDEX room_placement_proposals_project_room_status
  ON room_placement_proposals(project_id, room_variant_id, status, created_revision, proposal_id);

CREATE TABLE room_placement_proposal_items (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_order INTEGER NOT NULL CHECK (item_order BETWEEN 0 AND 63),
  operation TEXT NOT NULL CHECK (operation IN ('add', 'move', 'remove')),
  placement_id TEXT NOT NULL,
  expected_asset_id TEXT,
  desired_json TEXT NOT NULL CHECK (json_valid(desired_json)),
  diff_json TEXT NOT NULL CHECK (json_valid(diff_json)),
  PRIMARY KEY (project_id, proposal_id, item_id),
  UNIQUE (project_id, proposal_id, item_order),
  UNIQUE (project_id, proposal_id, placement_id),
  FOREIGN KEY (project_id, proposal_id)
    REFERENCES room_placement_proposals(project_id, proposal_id) ON DELETE CASCADE,
  CHECK (
    (operation = 'add' AND expected_asset_id IS NULL)
    OR (operation IN ('move', 'remove') AND expected_asset_id IS NOT NULL)
  )
) STRICT;

CREATE TRIGGER room_placement_proposal_items_immutable
BEFORE UPDATE ON room_placement_proposal_items
BEGIN
  SELECT RAISE(ABORT, 'room_placement_proposal_items are immutable');
END;

CREATE TABLE room_placement_proposal_findings (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  finding_order INTEGER NOT NULL CHECK (finding_order >= 0),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
  rule_id TEXT NOT NULL CHECK (rule_id GLOB 'studio.room.*'),
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  path TEXT NOT NULL,
  explanation TEXT NOT NULL,
  remediation TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  PRIMARY KEY (project_id, proposal_id, finding_id),
  UNIQUE (project_id, proposal_id, finding_order),
  FOREIGN KEY (project_id, proposal_id)
    REFERENCES room_placement_proposals(project_id, proposal_id) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER room_placement_proposal_findings_immutable
BEFORE UPDATE ON room_placement_proposal_findings
BEGIN
  SELECT RAISE(ABORT, 'room_placement_proposal_findings are immutable');
END;

CREATE TABLE room_placement_proposal_decisions (
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
    REFERENCES room_placement_proposal_items(project_id, proposal_id, item_id),
  FOREIGN KEY (project_id, decision_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (
    (decision = 'ACCEPTED' AND rejection_reason IS NULL)
    OR (decision = 'REJECTED' AND length(trim(rejection_reason)) BETWEEN 1 AND 2000)
  )
) STRICT;

CREATE TRIGGER room_placement_proposal_decisions_immutable
BEFORE UPDATE ON room_placement_proposal_decisions
BEGIN
  SELECT RAISE(ABORT, 'room_placement_proposal_decisions are immutable');
END;

CREATE TABLE room_variant_versions (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL CHECK (variant_version >= 1),
  room_archetype_id TEXT NOT NULL,
  archetype_version INTEGER NOT NULL CHECK (archetype_version >= 1),
  previous_variant_version INTEGER,
  parent_final_version INTEGER,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 160),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('DRAFT', 'VALIDATED', 'FINAL')),
  width INTEGER NOT NULL CHECK (width BETWEEN 3 AND 64),
  height INTEGER NOT NULL CHECK (height BETWEEN 3 AND 64),
  variant_json TEXT NOT NULL CHECK (json_valid(variant_json)),
  content_fingerprint TEXT NOT NULL CHECK (length(content_fingerprint) = 64),
  findings_fingerprint TEXT NOT NULL CHECK (length(findings_fingerprint) = 64),
  created_revision INTEGER NOT NULL CHECK (created_revision >= 1),
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  proposal_id TEXT,
  provenance TEXT NOT NULL CHECK (provenance IN ('native_revision', 'bundle_import')),
  PRIMARY KEY (project_id, room_variant_id, variant_version),
  FOREIGN KEY (project_id, room_archetype_id, archetype_version)
    REFERENCES room_archetype_versions(project_id, room_archetype_id, archetype_version),
  FOREIGN KEY (project_id, room_variant_id, previous_variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version),
  FOREIGN KEY (project_id, room_variant_id, parent_final_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version),
  FOREIGN KEY (project_id, proposal_id)
    REFERENCES room_placement_proposals(project_id, proposal_id),
  FOREIGN KEY (project_id, created_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (width * height <= 4096),
  CHECK (
    (variant_version = 1 AND previous_variant_version IS NULL)
    OR (variant_version > 1 AND previous_variant_version = variant_version - 1)
  )
) STRICT;

CREATE INDEX room_variant_versions_project_archetype
  ON room_variant_versions(project_id, room_archetype_id, archetype_version, room_variant_id, variant_version);

CREATE INDEX room_variant_versions_project_lifecycle
  ON room_variant_versions(project_id, lifecycle, created_revision, room_variant_id, variant_version);

CREATE TRIGGER room_variant_versions_immutable
BEFORE UPDATE ON room_variant_versions
BEGIN
  SELECT RAISE(ABORT, 'room_variant_versions are immutable');
END;

CREATE TABLE room_variant_heads (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL CHECK (variant_version >= 1),
  room_archetype_id TEXT NOT NULL,
  archetype_version INTEGER NOT NULL CHECK (archetype_version >= 1),
  display_name TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('DRAFT', 'VALIDATED', 'FINAL')),
  width INTEGER NOT NULL CHECK (width BETWEEN 3 AND 64),
  height INTEGER NOT NULL CHECK (height BETWEEN 3 AND 64),
  updated_revision INTEGER NOT NULL CHECK (updated_revision >= 1),
  PRIMARY KEY (project_id, room_variant_id),
  FOREIGN KEY (project_id, room_variant_id, variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version),
  FOREIGN KEY (project_id, updated_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (width * height <= 4096)
) STRICT;

CREATE INDEX room_variant_heads_project_lifecycle
  ON room_variant_heads(project_id, lifecycle, display_name, room_variant_id);

CREATE TABLE room_variant_intent (
  project_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL,
  intent_order INTEGER NOT NULL CHECK (intent_order BETWEEN 0 AND 31),
  layer TEXT NOT NULL CHECK (layer IN ('game_design', 'level_design', 'room_design')),
  rule_id TEXT NOT NULL,
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 256),
  disposition TEXT NOT NULL CHECK (disposition IN ('governing', 'proposed')),
  PRIMARY KEY (project_id, room_variant_id, variant_version, layer, rule_id),
  UNIQUE (project_id, room_variant_id, variant_version, intent_order),
  FOREIGN KEY (project_id, room_variant_id, variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER room_variant_intent_immutable
BEFORE UPDATE ON room_variant_intent
BEGIN
  SELECT RAISE(ABORT, 'room_variant_intent are immutable');
END;

CREATE TABLE room_variant_connectors (
  project_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL,
  connector_id TEXT NOT NULL,
  connector_order INTEGER NOT NULL CHECK (connector_order BETWEEN 0 AND 31),
  side TEXT NOT NULL CHECK (side IN ('north', 'east', 'south', 'west')),
  offset INTEGER NOT NULL CHECK (offset >= 0),
  aperture_width INTEGER NOT NULL CHECK (aperture_width >= 1),
  clearance_inside INTEGER NOT NULL CHECK (clearance_inside BETWEEN 0 AND 16),
  clearance_outside INTEGER NOT NULL CHECK (clearance_outside BETWEEN 0 AND 16),
  connector_json TEXT NOT NULL CHECK (json_valid(connector_json)),
  PRIMARY KEY (project_id, room_variant_id, variant_version, connector_id),
  UNIQUE (project_id, room_variant_id, variant_version, connector_order),
  FOREIGN KEY (project_id, room_variant_id, variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER room_variant_connectors_immutable
BEFORE UPDATE ON room_variant_connectors
BEGIN
  SELECT RAISE(ABORT, 'room_variant_connectors are immutable');
END;

CREATE TABLE room_variant_placements (
  project_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL,
  placement_id TEXT NOT NULL,
  placement_order INTEGER NOT NULL CHECK (placement_order BETWEEN 0 AND 255),
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL CHECK (asset_version >= 1),
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  layer TEXT NOT NULL CHECK (layer IN ('STRUCTURAL_SURFACE', 'SET_DRESSING')),
  anchor_x INTEGER NOT NULL CHECK (anchor_x BETWEEN 0 AND 63),
  anchor_y INTEGER NOT NULL CHECK (anchor_y BETWEEN 0 AND 63),
  rotation INTEGER NOT NULL CHECK (rotation IN (0, 90, 180, 270)),
  placement_json TEXT NOT NULL CHECK (json_valid(placement_json)),
  PRIMARY KEY (project_id, room_variant_id, variant_version, placement_id),
  UNIQUE (project_id, room_variant_id, variant_version, placement_order),
  FOREIGN KEY (project_id, room_variant_id, variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version) ON DELETE CASCADE,
  FOREIGN KEY (project_id, asset_id, asset_version)
    REFERENCES asset_versions(project_id, asset_id, asset_version)
) STRICT;

CREATE INDEX room_variant_placements_project_asset
  ON room_variant_placements(project_id, asset_id, asset_version, room_variant_id, variant_version);

CREATE TRIGGER room_variant_placements_immutable
BEFORE UPDATE ON room_variant_placements
BEGIN
  SELECT RAISE(ABORT, 'room_variant_placements are immutable');
END;

CREATE TABLE room_variant_findings (
  project_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL,
  finding_id TEXT NOT NULL,
  finding_order INTEGER NOT NULL CHECK (finding_order >= 0),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR')),
  rule_id TEXT NOT NULL CHECK (rule_id GLOB 'studio.room.*'),
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  path TEXT NOT NULL,
  explanation TEXT NOT NULL,
  remediation TEXT NOT NULL,
  validator_version TEXT NOT NULL,
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  PRIMARY KEY (project_id, room_variant_id, variant_version, finding_id),
  UNIQUE (project_id, room_variant_id, variant_version, finding_order),
  FOREIGN KEY (project_id, room_variant_id, variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version) ON DELETE CASCADE
) STRICT;

CREATE INDEX room_variant_findings_project_severity
  ON room_variant_findings(project_id, severity, rule_id);

CREATE TRIGGER room_variant_findings_immutable
BEFORE UPDATE ON room_variant_findings
BEGIN
  SELECT RAISE(ABORT, 'room_variant_findings are immutable');
END;

CREATE TABLE room_variant_warning_dispositions (
  project_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL,
  finding_id TEXT NOT NULL,
  disposition_order INTEGER NOT NULL CHECK (disposition_order BETWEEN 0 AND 127),
  PRIMARY KEY (project_id, room_variant_id, variant_version, finding_id),
  UNIQUE (project_id, room_variant_id, variant_version, disposition_order),
  FOREIGN KEY (project_id, room_variant_id, variant_version, finding_id)
    REFERENCES room_variant_findings(project_id, room_variant_id, variant_version, finding_id) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER room_variant_warning_dispositions_immutable
BEFORE UPDATE ON room_variant_warning_dispositions
BEGIN
  SELECT RAISE(ABORT, 'room_variant_warning_dispositions are immutable');
END;

CREATE TABLE room_placement_proposal_applications (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  application_revision INTEGER NOT NULL CHECK (application_revision >= 1),
  created_room_variant_version INTEGER NOT NULL CHECK (created_room_variant_version >= 2),
  accepted_count INTEGER NOT NULL CHECK (accepted_count BETWEEN 0 AND 64),
  rejected_count INTEGER NOT NULL CHECK (rejected_count BETWEEN 0 AND 64),
  applied_at TEXT NOT NULL,
  applied_by TEXT NOT NULL,
  PRIMARY KEY (project_id, proposal_id),
  FOREIGN KEY (project_id, proposal_id)
    REFERENCES room_placement_proposals(project_id, proposal_id),
  FOREIGN KEY (project_id, application_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, room_variant_id, created_room_variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version),
  CHECK (accepted_count + rejected_count BETWEEN 1 AND 64)
) STRICT;

CREATE TRIGGER room_placement_proposal_applications_immutable
BEFORE UPDATE ON room_placement_proposal_applications
BEGIN
  SELECT RAISE(ABORT, 'room_placement_proposal_applications are immutable');
END;
