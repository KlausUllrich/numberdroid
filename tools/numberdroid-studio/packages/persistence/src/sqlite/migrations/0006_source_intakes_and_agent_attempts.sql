CREATE TABLE IF NOT EXISTS source_intakes (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  intake_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  digest TEXT NOT NULL REFERENCES artifacts(digest),
  origin TEXT NOT NULL CHECK (origin IN ('human_upload', 'imported_generation')),
  state TEXT NOT NULL CHECK (state IN ('STAGED', 'CLAIMED', 'ABANDONED')),
  created_at TEXT NOT NULL,
  created_revision INTEGER NOT NULL,
  claimed_source_id TEXT,
  claimed_revision INTEGER,
  abandoned_at TEXT,
  abandoned_by TEXT,
  abandon_idempotency_key TEXT,
  intake_json TEXT NOT NULL,
  PRIMARY KEY (project_id, intake_id),
  UNIQUE (project_id, idempotency_key),
  UNIQUE (project_id, abandon_idempotency_key),
  FOREIGN KEY (project_id, created_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, claimed_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (
    (state = 'STAGED' AND claimed_source_id IS NULL AND claimed_revision IS NULL
      AND abandoned_at IS NULL AND abandoned_by IS NULL AND abandon_idempotency_key IS NULL)
    OR (state = 'CLAIMED' AND claimed_source_id IS NOT NULL AND claimed_revision IS NOT NULL
      AND abandoned_at IS NULL AND abandoned_by IS NULL AND abandon_idempotency_key IS NULL)
    OR (state = 'ABANDONED' AND claimed_source_id IS NULL AND claimed_revision IS NULL
      AND abandoned_at IS NOT NULL AND abandoned_by IS NOT NULL AND abandon_idempotency_key IS NOT NULL)
  )
) STRICT;

CREATE INDEX IF NOT EXISTS source_intakes_project_state
  ON source_intakes(project_id, state, created_at);

CREATE TABLE IF NOT EXISTS agent_attempts (
  attempt_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  task_id TEXT,
  branch_id TEXT NOT NULL,
  command_id TEXT,
  command_type TEXT,
  target_kind TEXT NOT NULL CHECK (target_kind = 'project'),
  target_id TEXT NOT NULL,
  observed_revision INTEGER NOT NULL CHECK (observed_revision >= 0),
  status TEXT NOT NULL CHECK (status IN ('DENIED', 'FAILED')),
  error_code TEXT NOT NULL,
  redacted_details_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (project_id, correlation_id)
) STRICT;

CREATE INDEX IF NOT EXISTS agent_attempts_project_occurred
  ON agent_attempts(project_id, occurred_at, attempt_id);
