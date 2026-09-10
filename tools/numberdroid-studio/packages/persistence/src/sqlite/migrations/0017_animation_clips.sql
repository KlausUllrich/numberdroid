CREATE TABLE clip_identities (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  created_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, asset_id),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TRIGGER clip_identity_native_collision BEFORE INSERT ON clip_identities
WHEN EXISTS (SELECT 1 FROM asset_versions WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
  OR EXISTS (SELECT 1 FROM task_branch_processing_result_adoptions WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
  OR EXISTS (SELECT 1 FROM assembly_identities WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Animation Asset ID is already in use'); END;
CREATE TRIGGER native_asset_clip_collision BEFORE INSERT ON asset_versions
WHEN EXISTS (SELECT 1 FROM clip_identities WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Asset ID belongs to an Animation'); END;
CREATE TRIGGER processing_asset_clip_collision BEFORE INSERT ON task_branch_processing_result_adoptions
WHEN EXISTS (SELECT 1 FROM clip_identities WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Asset ID belongs to an Animation'); END;

CREATE TRIGGER assembly_asset_clip_collision BEFORE INSERT ON assembly_identities
WHEN EXISTS (SELECT 1 FROM clip_identities WHERE project_id = NEW.project_id AND asset_id = NEW.asset_id)
BEGIN SELECT RAISE(ABORT, 'Asset ID belongs to an Animation'); END;

CREATE TABLE clip_proposal_versions (
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
  FOREIGN KEY (project_id, proposal_id, previous_proposal_version) REFERENCES clip_proposal_versions(project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number),
  CHECK ((proposal_version = 1 AND previous_proposal_version IS NULL) OR (proposal_version > 1 AND previous_proposal_version = proposal_version - 1))
) STRICT;
CREATE TABLE clip_proposal_heads (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, proposal_id),
  FOREIGN KEY (project_id, proposal_id, proposal_version) REFERENCES clip_proposal_versions(project_id, proposal_id, proposal_version)
) STRICT;
CREATE TABLE clip_versions (
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
  FOREIGN KEY (project_id, asset_id) REFERENCES clip_identities(project_id, asset_id),
  FOREIGN KEY (project_id, asset_id, previous_asset_version) REFERENCES clip_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, proposal_id, proposal_version) REFERENCES clip_proposal_versions(project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number),
  CHECK ((asset_version = 1 AND previous_asset_version IS NULL) OR (asset_version > 1 AND previous_asset_version = asset_version - 1)),
  CHECK ((proposal_id IS NULL) = (proposal_version IS NULL))
) STRICT;
CREATE TABLE clip_heads (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, asset_id),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES clip_versions(project_id, asset_id, asset_version)
) STRICT;
CREATE TABLE clip_head_tags (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  tag_order INTEGER NOT NULL CHECK (tag_order BETWEEN 0 AND 31),
  PRIMARY KEY (project_id, asset_id, tag),
  UNIQUE (project_id, asset_id, tag_order),
  FOREIGN KEY (project_id, asset_id) REFERENCES clip_heads(project_id, asset_id)
) STRICT;
CREATE TABLE clip_frame_pins (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  pin_order INTEGER NOT NULL CHECK (pin_order BETWEEN 0 AND 255),
  frame_id TEXT NOT NULL,
  slice_id TEXT NOT NULL,
  slice_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, asset_id, asset_version, pin_order),
  UNIQUE (project_id, asset_id, asset_version, frame_id),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES clip_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, slice_id, slice_version) REFERENCES asset_slice_bindings(project_id, slice_id, slice_version)
) STRICT;
CREATE TABLE clip_version_findings (
  project_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  finding_order INTEGER NOT NULL CHECK (finding_order >= 0),
  finding_json TEXT NOT NULL CHECK (json_valid(finding_json)),
  PRIMARY KEY (project_id, asset_id, asset_version, finding_order),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES clip_versions(project_id, asset_id, asset_version)
) STRICT;
CREATE TRIGGER clip_versions_immutable BEFORE UPDATE ON clip_versions
BEGIN SELECT RAISE(ABORT, 'Animation versions are immutable'); END;
CREATE TRIGGER clip_proposals_immutable BEFORE UPDATE ON clip_proposal_versions
BEGIN SELECT RAISE(ABORT, 'Animation proposal versions are immutable'); END;
CREATE TRIGGER clip_pins_immutable BEFORE UPDATE ON clip_frame_pins
BEGIN SELECT RAISE(ABORT, 'Animation component pins are immutable'); END;
CREATE TRIGGER clip_findings_immutable BEFORE UPDATE ON clip_version_findings
BEGIN SELECT RAISE(ABORT, 'Animation findings are immutable'); END;

CREATE TABLE clip_proposal_frame_pins (
  project_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  pin_order INTEGER NOT NULL CHECK (pin_order BETWEEN 0 AND 255),
  frame_id TEXT NOT NULL,
  slice_id TEXT NOT NULL,
  slice_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, proposal_id, proposal_version, pin_order),
  UNIQUE (project_id, proposal_id, proposal_version, frame_id),
  FOREIGN KEY (project_id, proposal_id, proposal_version) REFERENCES clip_proposal_versions(project_id, proposal_id, proposal_version),
  FOREIGN KEY (project_id, slice_id, slice_version) REFERENCES asset_slice_bindings(project_id, slice_id, slice_version)
) STRICT;
CREATE TRIGGER clip_proposal_pins_immutable BEFORE UPDATE ON clip_proposal_frame_pins
BEGIN SELECT RAISE(ABORT, 'Animation component pins are immutable'); END;

CREATE TABLE assembly_content_pins (
 project_id TEXT NOT NULL, asset_id TEXT NOT NULL, asset_version INTEGER NOT NULL,
 pin_order INTEGER NOT NULL CHECK(pin_order>=0), component_id TEXT NOT NULL,
 slot_kind TEXT NOT NULL CHECK(slot_kind IN ('base','state','variant')), slot_id TEXT,
 content_kind TEXT NOT NULL CHECK(content_kind IN ('image','animation','none')),
 image_asset_id TEXT, image_asset_version INTEGER, clip_asset_id TEXT, clip_asset_version INTEGER,
 target_metadata_version INTEGER,
 PRIMARY KEY(project_id,asset_id,asset_version,pin_order),
 FOREIGN KEY(project_id,asset_id,asset_version) REFERENCES assembly_versions(project_id,asset_id,asset_version),
 FOREIGN KEY(project_id,image_asset_id,image_asset_version) REFERENCES asset_versions(project_id,asset_id,asset_version),
 FOREIGN KEY(project_id,clip_asset_id,clip_asset_version) REFERENCES clip_versions(project_id,asset_id,asset_version),
 CHECK((slot_kind='base' AND slot_id IS NULL) OR (slot_kind!='base' AND slot_id IS NOT NULL)),
 CHECK((content_kind='none' AND image_asset_id IS NULL AND image_asset_version IS NULL AND clip_asset_id IS NULL AND clip_asset_version IS NULL AND target_metadata_version IS NULL)
 OR (content_kind='image' AND image_asset_id IS NOT NULL AND image_asset_version IS NOT NULL AND clip_asset_id IS NULL AND clip_asset_version IS NULL AND target_metadata_version IS NOT NULL)
 OR (content_kind='animation' AND clip_asset_id IS NOT NULL AND clip_asset_version IS NOT NULL AND image_asset_id IS NULL AND image_asset_version IS NULL AND target_metadata_version IS NOT NULL))
) STRICT;
CREATE TRIGGER assembly_content_pins_immutable BEFORE UPDATE ON assembly_content_pins
BEGIN SELECT RAISE(ABORT,'Assembly content pins are immutable'); END;
CREATE TRIGGER assembly_content_pins_metadata BEFORE INSERT ON assembly_content_pins
WHEN (NEW.content_kind='image' AND NOT EXISTS (SELECT 1 FROM asset_versions WHERE project_id=NEW.project_id AND asset_id=NEW.image_asset_id AND asset_version=NEW.image_asset_version AND metadata_version=NEW.target_metadata_version))
 OR (NEW.content_kind='animation' AND NOT EXISTS (SELECT 1 FROM clip_versions WHERE project_id=NEW.project_id AND asset_id=NEW.clip_asset_id AND asset_version=NEW.clip_asset_version AND metadata_version=NEW.target_metadata_version))
BEGIN SELECT RAISE(ABORT,'Assembly content metadata version mismatch'); END;

CREATE TABLE assembly_proposal_content_pins (
 project_id TEXT NOT NULL, proposal_id TEXT NOT NULL, proposal_version INTEGER NOT NULL,
 pin_order INTEGER NOT NULL CHECK(pin_order>=0), component_id TEXT NOT NULL,
 slot_kind TEXT NOT NULL CHECK(slot_kind IN ('base','state','variant')), slot_id TEXT,
 content_kind TEXT NOT NULL CHECK(content_kind IN ('image','animation','none')),
 image_asset_id TEXT, image_asset_version INTEGER, clip_asset_id TEXT, clip_asset_version INTEGER,
 target_metadata_version INTEGER,
 PRIMARY KEY(project_id,proposal_id,proposal_version,pin_order),
 FOREIGN KEY(project_id,proposal_id,proposal_version) REFERENCES assembly_proposal_versions(project_id,proposal_id,proposal_version),
 FOREIGN KEY(project_id,image_asset_id,image_asset_version) REFERENCES asset_versions(project_id,asset_id,asset_version),
 FOREIGN KEY(project_id,clip_asset_id,clip_asset_version) REFERENCES clip_versions(project_id,asset_id,asset_version),
 CHECK((slot_kind='base' AND slot_id IS NULL) OR (slot_kind!='base' AND slot_id IS NOT NULL)),
 CHECK((content_kind='none' AND image_asset_id IS NULL AND image_asset_version IS NULL AND clip_asset_id IS NULL AND clip_asset_version IS NULL AND target_metadata_version IS NULL)
 OR (content_kind='image' AND image_asset_id IS NOT NULL AND image_asset_version IS NOT NULL AND clip_asset_id IS NULL AND clip_asset_version IS NULL AND target_metadata_version IS NOT NULL)
 OR (content_kind='animation' AND clip_asset_id IS NOT NULL AND clip_asset_version IS NOT NULL AND image_asset_id IS NULL AND image_asset_version IS NULL AND target_metadata_version IS NOT NULL))
) STRICT;
CREATE TRIGGER assembly_proposal_content_pins_immutable BEFORE UPDATE ON assembly_proposal_content_pins
BEGIN SELECT RAISE(ABORT,'Assembly content pins are immutable'); END;
CREATE TRIGGER assembly_proposal_content_pins_metadata BEFORE INSERT ON assembly_proposal_content_pins
WHEN (NEW.content_kind='image' AND NOT EXISTS (SELECT 1 FROM asset_versions WHERE project_id=NEW.project_id AND asset_id=NEW.image_asset_id AND asset_version=NEW.image_asset_version AND metadata_version=NEW.target_metadata_version))
 OR (NEW.content_kind='animation' AND NOT EXISTS (SELECT 1 FROM clip_versions WHERE project_id=NEW.project_id AND asset_id=NEW.clip_asset_id AND asset_version=NEW.clip_asset_version AND metadata_version=NEW.target_metadata_version))
BEGIN SELECT RAISE(ABORT,'Assembly content metadata version mismatch'); END;
