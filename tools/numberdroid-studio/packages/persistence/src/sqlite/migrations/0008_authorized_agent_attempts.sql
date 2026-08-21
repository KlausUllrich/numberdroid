CREATE TABLE agent_attempts_v2 (
  attempt_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  task_id TEXT,
  branch_id TEXT NOT NULL,
  command_id TEXT,
  command_type TEXT,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('project', 'job')),
  target_id TEXT NOT NULL,
  observed_revision INTEGER NOT NULL CHECK (observed_revision >= 0),
  status TEXT NOT NULL CHECK (status IN ('AUTHORIZED', 'DENIED', 'FAILED')),
  error_code TEXT,
  redacted_details_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  UNIQUE (project_id, correlation_id),
  CHECK (
    (status = 'AUTHORIZED' AND error_code IS NULL)
    OR (status IN ('DENIED', 'FAILED') AND error_code IS NOT NULL)
  )
) STRICT;

INSERT INTO agent_attempts_v2(
  attempt_id, project_id, correlation_id, actor_id, task_id, branch_id,
  command_id, command_type, target_kind, target_id, observed_revision,
  status, error_code, redacted_details_json, occurred_at
)
SELECT
  attempt_id, project_id, correlation_id, actor_id, task_id, branch_id,
  command_id, command_type, target_kind, target_id, observed_revision,
  status, error_code, redacted_details_json, occurred_at
FROM agent_attempts;

DROP TABLE agent_attempts;
ALTER TABLE agent_attempts_v2 RENAME TO agent_attempts;

CREATE INDEX agent_attempts_project_occurred
  ON agent_attempts(project_id, occurred_at, attempt_id);
