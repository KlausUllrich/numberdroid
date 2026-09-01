CREATE TABLE task_level_candidate_submissions (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  branch_head_revision INTEGER NOT NULL CHECK (branch_head_revision > base_revision),
  actor_id TEXT NOT NULL,
  grant_id TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL
    CHECK (length(idempotency_key_hash) = 64 AND idempotency_key_hash NOT GLOB '*[^a-f0-9]*'),
  request_fingerprint TEXT NOT NULL
    CHECK (length(request_fingerprint) = 64 AND request_fingerprint NOT GLOB '*[^a-f0-9]*'),
  authority_binding_fingerprint TEXT NOT NULL
    CHECK (length(authority_binding_fingerprint) = 64 AND authority_binding_fingerprint NOT GLOB '*[^a-f0-9]*'),
  submission_fingerprint TEXT NOT NULL
    CHECK (length(submission_fingerprint) = 64 AND submission_fingerprint NOT GLOB '*[^a-f0-9]*'),
  projection_fingerprint TEXT NOT NULL
    CHECK (length(projection_fingerprint) = 64 AND projection_fingerprint NOT GLOB '*[^a-f0-9]*'),
  candidate_fingerprint TEXT NOT NULL
    CHECK (length(candidate_fingerprint) = 64 AND candidate_fingerprint NOT GLOB '*[^a-f0-9]*'),
  review_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  configured_binding_json TEXT NOT NULL CHECK (json_valid(configured_binding_json)),
  aggregate_json TEXT NOT NULL CHECK (json_valid(aggregate_json)),
  submission_json TEXT NOT NULL CHECK (json_valid(submission_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  PRIMARY KEY (project_id, task_id, submission_id),
  UNIQUE (project_id, submission_id),
  UNIQUE (project_id, task_id),
  UNIQUE (project_id, task_id, idempotency_key_hash),
  FOREIGN KEY (project_id, task_id)
    REFERENCES agent_tasks(project_id, task_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, task_id, branch_head_revision)
    REFERENCES task_branch_revisions(project_id, task_id, branch_revision)
) STRICT;

CREATE INDEX task_level_candidate_submissions_review
  ON task_level_candidate_submissions(project_id, task_id, review_id);

CREATE TRIGGER task_level_candidate_submissions_immutable
BEFORE UPDATE ON task_level_candidate_submissions
BEGIN
  SELECT RAISE(ABORT, 'task_level_candidate_submissions are immutable');
END;

CREATE TRIGGER task_level_candidate_submissions_delete_forbidden
BEFORE DELETE ON task_level_candidate_submissions
BEGIN
  SELECT RAISE(ABORT, 'task_level_candidate_submissions cannot be deleted');
END;
