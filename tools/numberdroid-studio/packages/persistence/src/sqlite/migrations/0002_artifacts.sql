CREATE TABLE IF NOT EXISTS artifacts (
  digest TEXT PRIMARY KEY CHECK (length(digest) = 64),
  uri TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  width INTEGER,
  height INTEGER,
  state TEXT NOT NULL CHECK (state IN ('LIVE', 'MISSING', 'CORRUPT', 'QUARANTINED')),
  created_at TEXT NOT NULL,
  verified_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS artifact_references (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  digest TEXT NOT NULL REFERENCES artifacts(digest),
  created_revision INTEGER NOT NULL,
  PRIMARY KEY (project_id, owner_kind, owner_id, digest),
  FOREIGN KEY (project_id, created_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE INDEX IF NOT EXISTS artifact_references_digest
  ON artifact_references(digest);

CREATE TABLE IF NOT EXISTS cas_gc_marks (
  digest TEXT PRIMARY KEY,
  marked_at TEXT NOT NULL,
  reason TEXT NOT NULL
) STRICT;
