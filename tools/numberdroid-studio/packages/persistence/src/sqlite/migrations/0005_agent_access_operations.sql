CREATE TABLE IF NOT EXISTS human_agent_access_operations (
  project_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
  result_json TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (project_id, idempotency_key),
  FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
) STRICT;
