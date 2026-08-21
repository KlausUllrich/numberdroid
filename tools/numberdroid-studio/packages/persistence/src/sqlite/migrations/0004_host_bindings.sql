CREATE TABLE IF NOT EXISTS host_bindings (
  binding_id TEXT PRIMARY KEY,
  token_digest TEXT NOT NULL UNIQUE CHECK (length(token_digest) = 64),
  project_id TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  revoke_reason TEXT,
  FOREIGN KEY (project_id, grant_id)
    REFERENCES grants(project_id, grant_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS host_bindings_project_status
  ON host_bindings(project_id, revoked_at, expires_at);
