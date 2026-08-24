CREATE TABLE IF NOT EXISTS jobs (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  job_kind TEXT NOT NULL CHECK (job_kind = 'ATLAS_PREVIEW'),
  input_revision INTEGER NOT NULL CHECK (input_revision >= 1),
  atlas_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  creator_actor_kind TEXT NOT NULL CHECK (creator_actor_kind IN ('human', 'agent')),
  creator_actor_id TEXT NOT NULL,
  creator_task_id TEXT,
  creator_branch_id TEXT NOT NULL,
  creator_grant_id TEXT,
  output_artifact_bytes INTEGER NOT NULL CHECK (output_artifact_bytes >= 1),
  input_fingerprint TEXT NOT NULL CHECK (length(input_fingerprint) = 64),
  idempotency_key TEXT NOT NULL,
  input_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DISCARDED', 'APPLIED')
  ),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  progress_current INTEGER NOT NULL DEFAULT 0 CHECK (progress_current >= 0),
  progress_total INTEGER NOT NULL DEFAULT 0 CHECK (progress_total >= 0),
  cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
  lease_owner TEXT,
  lease_expires_at TEXT,
  output_json TEXT,
  result_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL,
  applied_revision INTEGER,
  PRIMARY KEY (project_id, job_id),
  UNIQUE (project_id, idempotency_key),
  FOREIGN KEY (project_id, input_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, applied_revision)
    REFERENCES revisions(project_id, revision_number),
  CHECK (
    (state = 'QUEUED' AND lease_owner IS NULL AND lease_expires_at IS NULL
      AND finished_at IS NULL AND applied_revision IS NULL)
    OR (state = 'RUNNING' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL
      AND started_at IS NOT NULL AND finished_at IS NULL AND applied_revision IS NULL)
    OR (state IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'DISCARDED')
      AND lease_owner IS NULL AND lease_expires_at IS NULL
      AND finished_at IS NOT NULL AND applied_revision IS NULL)
    OR (state = 'APPLIED' AND lease_owner IS NULL AND lease_expires_at IS NULL
      AND finished_at IS NOT NULL AND applied_revision IS NOT NULL)
  ),
  CHECK (
    (creator_actor_kind = 'human' AND creator_task_id IS NULL AND creator_grant_id IS NULL)
    OR (creator_actor_kind = 'agent' AND creator_task_id IS NOT NULL AND creator_grant_id IS NOT NULL)
  )
) STRICT;

CREATE INDEX IF NOT EXISTS jobs_project_state_updated
  ON jobs(project_id, state, updated_at, job_id);

CREATE INDEX IF NOT EXISTS jobs_claimable
  ON jobs(state, cancel_requested, lease_expires_at, created_at, job_id);

CREATE TABLE IF NOT EXISTS job_events (
  project_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  event_sequence INTEGER NOT NULL CHECK (event_sequence >= 1),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
  event_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'DISCARDED', 'APPLIED')
  ),
  safe_point TEXT,
  progress_current INTEGER NOT NULL CHECK (progress_current >= 0),
  progress_total INTEGER NOT NULL CHECK (progress_total >= 0),
  operation_idempotency_key TEXT,
  details_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  PRIMARY KEY (project_id, job_id, event_sequence),
  UNIQUE (project_id, operation_idempotency_key),
  FOREIGN KEY (project_id, job_id)
    REFERENCES jobs(project_id, job_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS job_events_project_occurred
  ON job_events(project_id, occurred_at, job_id, event_sequence);
