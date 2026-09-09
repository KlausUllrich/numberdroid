CREATE TABLE assembly_identities (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  created_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, asset_id),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TRIGGER assembly_identity_native_collision BEFORE INSERT ON assembly_identities
WHEN EXISTS (SELECT 1 FROM asset_versions WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
  OR EXISTS (SELECT 1 FROM task_branch_processing_result_adoptions WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Assembly Asset ID is already in use'); END;
CREATE TRIGGER native_asset_assembly_collision BEFORE INSERT ON asset_versions
WHEN EXISTS (SELECT 1 FROM assembly_identities WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Asset ID belongs to an Assembly'); END;
CREATE TRIGGER processing_asset_assembly_collision BEFORE INSERT ON task_branch_processing_result_adoptions
WHEN EXISTS (SELECT 1 FROM assembly_identities WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Asset ID belongs to an Assembly'); END;

CREATE TABLE assembly_proposal_versions (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL CHECK (proposal_version >= 1),
  previous_proposal_version INTEGER,
  status TEXT NOT NULL CHECK (status IN ('PENDING','CHANGES_REQUESTED','ACCEPTED','DISCARDED')),
  created_revision INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  record_fingerprint TEXT NOT NULL CHECK (length(record_fingerprint) = 64),
  provenance TEXT NOT NULL CHECK (provenance IN ('native_revision','bundle_import')),
  PRIMARY KEY (project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, proposal_id, previous_proposal_version) REFERENCES assembly_proposal_versions(project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number),
  CHECK ((proposal_version = 1 AND previous_proposal_version IS NULL) OR (proposal_version > 1 AND previous_proposal_version = proposal_version - 1))
) STRICT;
CREATE TABLE assembly_proposal_heads (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, proposal_id),
  FOREIGN KEY (project_id, proposal_id, proposal_version) REFERENCES assembly_proposal_versions(project_id, proposal_id, proposal_version)
) STRICT;
CREATE TABLE assembly_versions (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL CHECK (asset_version >= 1),
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  previous_asset_version INTEGER,
  created_revision INTEGER NOT NULL,
  proposal_id TEXT,
  proposal_version INTEGER,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  record_fingerprint TEXT NOT NULL CHECK (length(record_fingerprint) = 64),
  provenance TEXT NOT NULL CHECK (provenance IN ('native_revision','bundle_import')),
  PRIMARY KEY (project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, asset_id) REFERENCES assembly_identities(project_id, asset_id),
  FOREIGN KEY (project_id, asset_id, previous_asset_version) REFERENCES assembly_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, proposal_id, proposal_version) REFERENCES assembly_proposal_versions(project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number),
  CHECK ((asset_version = 1 AND previous_asset_version IS NULL) OR (asset_version > 1 AND previous_asset_version = asset_version - 1)),
  CHECK ((proposal_id IS NULL) = (proposal_version IS NULL))
) STRICT;
CREATE TABLE assembly_heads (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, asset_id),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES assembly_versions(project_id, asset_id, asset_version)
) STRICT;
CREATE TABLE assembly_head_tags (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  tag_order INTEGER NOT NULL CHECK (tag_order BETWEEN 0 AND 31),
  PRIMARY KEY (project_id, asset_id, tag),
  UNIQUE (project_id, asset_id, tag_order),
  FOREIGN KEY (project_id, asset_id) REFERENCES assembly_heads(project_id, asset_id)
) STRICT;
CREATE TABLE assembly_component_pins (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  pin_order INTEGER NOT NULL CHECK (pin_order >= 0),
  component_id TEXT NOT NULL,
  variant_id TEXT,
  leaf_asset_id TEXT NOT NULL,
  leaf_asset_version INTEGER NOT NULL,
  leaf_metadata_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, asset_id, asset_version, pin_order),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES assembly_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, leaf_asset_id, leaf_asset_version) REFERENCES asset_versions(project_id, asset_id, asset_version)
) STRICT;
CREATE TABLE assembly_version_findings (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  finding_order INTEGER NOT NULL CHECK (finding_order >= 0),
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  PRIMARY KEY (project_id, asset_id, asset_version, finding_order),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES assembly_versions(project_id, asset_id, asset_version)
) STRICT;
CREATE TRIGGER assembly_pin_metadata BEFORE INSERT ON assembly_component_pins
WHEN NOT EXISTS (SELECT 1 FROM asset_versions WHERE project_id = NEW.project_id AND asset_id = NEW.leaf_asset_id AND asset_version = NEW.leaf_asset_version AND metadata_version = NEW.leaf_metadata_version)
BEGIN SELECT RAISE(ABORT, 'Assembly component metadata version mismatch'); END;
CREATE TRIGGER assembly_versions_immutable BEFORE UPDATE ON assembly_versions
BEGIN SELECT RAISE(ABORT, 'Assembly versions are immutable'); END;
CREATE TRIGGER assembly_proposals_immutable BEFORE UPDATE ON assembly_proposal_versions
BEGIN SELECT RAISE(ABORT, 'Assembly proposal versions are immutable'); END;
CREATE TRIGGER assembly_pins_immutable BEFORE UPDATE ON assembly_component_pins
BEGIN SELECT RAISE(ABORT, 'Assembly component pins are immutable'); END;
CREATE TRIGGER assembly_findings_immutable BEFORE UPDATE ON assembly_version_findings
BEGIN SELECT RAISE(ABORT, 'Assembly findings are immutable'); END;

CREATE TABLE assembly_proposal_component_pins (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  pin_order INTEGER NOT NULL CHECK (pin_order >= 0),
  component_id TEXT NOT NULL,
  variant_id TEXT,
  leaf_asset_id TEXT NOT NULL,
  leaf_asset_version INTEGER NOT NULL,
  leaf_metadata_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, proposal_id, proposal_version, pin_order),
  FOREIGN KEY (project_id, proposal_id, proposal_version) REFERENCES assembly_proposal_versions(project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, leaf_asset_id, leaf_asset_version) REFERENCES asset_versions(project_id, asset_id, asset_version)
) STRICT;
CREATE TRIGGER assembly_proposal_pin_metadata BEFORE INSERT ON assembly_proposal_component_pins
WHEN NOT EXISTS (SELECT 1 FROM asset_versions WHERE project_id = NEW.project_id AND asset_id = NEW.leaf_asset_id AND asset_version = NEW.leaf_asset_version AND metadata_version = NEW.leaf_metadata_version)
BEGIN SELECT RAISE(ABORT, 'Assembly component metadata version mismatch'); END;
CREATE TRIGGER assembly_proposal_pins_immutable BEFORE UPDATE ON assembly_proposal_component_pins
BEGIN SELECT RAISE(ABORT, 'Assembly component pins are immutable'); END;
