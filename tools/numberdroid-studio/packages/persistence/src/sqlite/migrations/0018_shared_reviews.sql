CREATE TABLE review_versions (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL CHECK (review_version >= 1),
  previous_review_version INTEGER,
  content_version INTEGER NOT NULL CHECK (content_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('PENDING','CHANGES_REQUESTED','ACCEPTED','DISCARDED')),
  created_revision INTEGER NOT NULL,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  record_fingerprint TEXT NOT NULL CHECK (length(record_fingerprint) = 64),
  PRIMARY KEY (project_id, review_id, review_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, review_id, previous_review_version) REFERENCES review_versions(project_id, review_id, review_version),
  CHECK ((review_version = 1 AND previous_review_version IS NULL) OR (review_version > 1 AND previous_review_version = review_version - 1))
) STRICT;
CREATE TABLE review_heads (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  PRIMARY KEY (project_id, review_id),
  FOREIGN KEY (project_id, review_id, review_version) REFERENCES review_versions(project_id, review_id, review_version)
) STRICT;
CREATE TABLE review_items (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  item_order INTEGER NOT NULL CHECK (item_order BETWEEN 0 AND 63),
  content_kind TEXT NOT NULL CHECK (content_kind IN ('image','animation','assembly')),
  status TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','DISCARDED')),
  item_json TEXT NOT NULL CHECK (json_valid(item_json)),
  PRIMARY KEY (project_id, review_id, review_version, item_id),
  UNIQUE (project_id, review_id, review_version, item_order),
  FOREIGN KEY (project_id, review_id, review_version) REFERENCES review_versions(project_id, review_id, review_version)
) STRICT;
CREATE TABLE review_dependencies (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  dependency_id TEXT NOT NULL,
  dependency_order INTEGER NOT NULL CHECK (dependency_order BETWEEN 0 AND 63),
  PRIMARY KEY (project_id, review_id, review_version, item_id, dependency_id),
  UNIQUE (project_id, review_id, review_version, item_id, dependency_order),
  FOREIGN KEY (project_id, review_id, review_version, item_id) REFERENCES review_items(project_id, review_id, review_version, item_id),
  FOREIGN KEY (project_id, review_id, review_version, dependency_id) REFERENCES review_items(project_id, review_id, review_version, item_id)
) STRICT;
CREATE TABLE review_events (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  command_type TEXT NOT NULL,
  feedback_json TEXT CHECK (feedback_json IS NULL OR json_valid(feedback_json)),
  decision_json TEXT CHECK (decision_json IS NULL OR json_valid(decision_json)),
  PRIMARY KEY (project_id, review_id, review_version),
  FOREIGN KEY (project_id, review_id, review_version) REFERENCES review_versions(project_id, review_id, review_version)
) STRICT;
CREATE TABLE review_image_acceptances (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  created_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, review_id, item_id),
  UNIQUE (project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, review_id, review_version, item_id) REFERENCES review_items(project_id, review_id, review_version, item_id),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES asset_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number)
) STRICT;
CREATE TABLE review_animation_acceptances (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  created_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, review_id, item_id),
  UNIQUE (project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, review_id, review_version, item_id) REFERENCES review_items(project_id, review_id, review_version, item_id),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES clip_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number)
) STRICT;
CREATE TABLE review_assembly_acceptances (
  project_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  asset_version INTEGER NOT NULL,
  metadata_version INTEGER NOT NULL CHECK (metadata_version >= 1),
  created_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, review_id, item_id),
  UNIQUE (project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, review_id, review_version, item_id) REFERENCES review_items(project_id, review_id, review_version, item_id),
  FOREIGN KEY (project_id, asset_id, asset_version) REFERENCES assembly_versions(project_id, asset_id, asset_version),
  FOREIGN KEY (project_id, created_revision) REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TRIGGER review_versions_immutable BEFORE UPDATE ON review_versions
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;

CREATE TRIGGER review_items_immutable BEFORE UPDATE ON review_items
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;

CREATE TRIGGER review_dependencies_immutable BEFORE UPDATE ON review_dependencies
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;

CREATE TRIGGER review_events_immutable BEFORE UPDATE ON review_events
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;

CREATE TRIGGER review_image_acceptances_immutable BEFORE UPDATE ON review_image_acceptances
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;

CREATE TRIGGER review_animation_acceptances_immutable BEFORE UPDATE ON review_animation_acceptances
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;

CREATE TRIGGER review_assembly_acceptances_immutable BEFORE UPDATE ON review_assembly_acceptances
BEGIN SELECT RAISE(ABORT, 'Review history is immutable'); END;
