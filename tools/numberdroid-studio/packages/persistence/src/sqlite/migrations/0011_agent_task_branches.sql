CREATE TABLE agent_tasks (
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  grant_id TEXT,
  base_revision INTEGER NOT NULL CHECK (base_revision >= 1),
  head_revision INTEGER NOT NULL CHECK (head_revision >= base_revision),
  state TEXT NOT NULL CHECK (state IN (
    'ACTIVE', 'PAUSED', 'IN_REVIEW', 'CHANGES_REQUESTED',
    'MERGED', 'REJECTED', 'CANCELLED'
  )),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  task_json TEXT NOT NULL,
  base_document_json TEXT NOT NULL,
  head_document_json TEXT NOT NULL,
  PRIMARY KEY (project_id, task_id),
  UNIQUE (project_id, branch_id),
  FOREIGN KEY (project_id, base_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, grant_id)
    REFERENCES grants(project_id, grant_id)
) STRICT;

CREATE INDEX agent_tasks_project_state
  ON agent_tasks(project_id, state, updated_at, task_id);

CREATE TABLE task_branch_revisions (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  branch_revision INTEGER NOT NULL CHECK (branch_revision >= 2),
  revision_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  command_type TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  revision_json TEXT NOT NULL,
  PRIMARY KEY (project_id, task_id, branch_revision),
  UNIQUE (project_id, task_id, revision_id),
  UNIQUE (project_id, task_id, command_id),
  UNIQUE (project_id, task_id, idempotency_key),
  FOREIGN KEY (project_id, task_id)
    REFERENCES agent_tasks(project_id, task_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX task_branch_revisions_branch
  ON task_branch_revisions(project_id, branch_id, branch_revision);

CREATE TRIGGER task_branch_revisions_immutable
BEFORE UPDATE ON task_branch_revisions
BEGIN
  SELECT RAISE(ABORT, 'task_branch_revisions are immutable');
END;

CREATE TABLE task_timeline_events (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  event_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY (project_id, task_id, sequence),
  UNIQUE (project_id, task_id, event_id),
  FOREIGN KEY (project_id, task_id)
    REFERENCES agent_tasks(project_id, task_id) ON DELETE CASCADE
) STRICT;

CREATE TRIGGER task_timeline_events_immutable
BEFORE UPDATE ON task_timeline_events
BEGIN
  SELECT RAISE(ABORT, 'task_timeline_events are immutable');
END;

CREATE TABLE task_reviews (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  review_version INTEGER NOT NULL CHECK (review_version >= 1),
  state TEXT NOT NULL CHECK (state IN ('OPEN', 'MERGED', 'REJECTED', 'SUPERSEDED')),
  created_at TEXT NOT NULL,
  review_json TEXT NOT NULL,
  PRIMARY KEY (project_id, task_id, review_id, review_version),
  FOREIGN KEY (project_id, task_id)
    REFERENCES agent_tasks(project_id, task_id) ON DELETE CASCADE
) STRICT;

CREATE INDEX task_reviews_current
  ON task_reviews(project_id, task_id, review_id, review_version DESC);

CREATE TRIGGER task_reviews_immutable
BEFORE UPDATE ON task_reviews
BEGIN
  SELECT RAISE(ABORT, 'task_reviews are immutable');
END;

CREATE TABLE task_merges (
  project_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  merge_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  main_parent_revision INTEGER NOT NULL CHECK (main_parent_revision >= 1),
  first_revision INTEGER NOT NULL CHECK (first_revision >= 2),
  last_revision INTEGER NOT NULL CHECK (last_revision >= first_revision),
  branch_parent_revision INTEGER NOT NULL CHECK (branch_parent_revision >= 1),
  merged_at TEXT NOT NULL,
  merged_by TEXT NOT NULL,
  merge_json TEXT NOT NULL,
  PRIMARY KEY (project_id, merge_id),
  UNIQUE (project_id, task_id),
  FOREIGN KEY (project_id, task_id)
    REFERENCES agent_tasks(project_id, task_id),
  FOREIGN KEY (project_id, first_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, last_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TABLE task_reverts (
  project_id TEXT NOT NULL,
  revert_id TEXT NOT NULL,
  merge_id TEXT NOT NULL,
  first_revision INTEGER NOT NULL CHECK (first_revision >= 2),
  last_revision INTEGER NOT NULL CHECK (last_revision >= first_revision),
  reverted_at TEXT NOT NULL,
  reverted_by TEXT NOT NULL,
  revert_json TEXT NOT NULL,
  PRIMARY KEY (project_id, revert_id),
  UNIQUE (project_id, merge_id),
  FOREIGN KEY (project_id, merge_id)
    REFERENCES task_merges(project_id, merge_id),
  FOREIGN KEY (project_id, first_revision)
    REFERENCES revisions(project_id, revision_number),
  FOREIGN KEY (project_id, last_revision)
    REFERENCES revisions(project_id, revision_number)
) STRICT;

CREATE TRIGGER task_merges_immutable
BEFORE UPDATE ON task_merges
BEGIN
  SELECT RAISE(ABORT, 'task_merges are immutable');
END;

CREATE TRIGGER task_reverts_immutable
BEFORE UPDATE ON task_reverts
BEGIN
  SELECT RAISE(ABORT, 'task_reverts are immutable');
END;
