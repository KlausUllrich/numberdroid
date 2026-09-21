CREATE TABLE source_library_operations (
  project_id TEXT NOT NULL,
  operation_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  atlas_id TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL CHECK (length(request_fingerprint) = 64),
  request_json TEXT NOT NULL CHECK (json_valid(request_json)),
  receipt_json TEXT NOT NULL CHECK (json_valid(receipt_json)),
  receipt_fingerprint TEXT NOT NULL CHECK (length(receipt_fingerprint) = 64),
  first_revision INTEGER NOT NULL CHECK (first_revision >= 1),
  last_revision INTEGER NOT NULL CHECK (last_revision >= first_revision),
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, operation_key),
  FOREIGN KEY (project_id, first_revision) REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, last_revision) REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE INDEX source_library_operations_atlas
  ON source_library_operations(project_id, atlas_id, last_revision DESC);

CREATE TRIGGER source_library_operations_immutable BEFORE UPDATE ON source_library_operations
BEGIN SELECT RAISE(ABORT, 'Source to Library operation receipts are immutable'); END;

CREATE TRIGGER source_library_operations_no_delete BEFORE DELETE ON source_library_operations
BEGIN SELECT RAISE(ABORT, 'Source to Library operation receipts are retained history'); END;
