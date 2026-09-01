ALTER TABLE agent_tasks
  ADD COLUMN branch_origin_revision INTEGER CHECK (branch_origin_revision IS NULL OR branch_origin_revision >= 1);

CREATE TABLE derived_task_relations (
  project_id TEXT NOT NULL,
  child_task_id TEXT NOT NULL,
  parent_task_id TEXT NOT NULL,
  root_task_id TEXT NOT NULL,
  parent_grant_id TEXT NOT NULL,
  child_grant_id TEXT NOT NULL,
  parent_head_revision INTEGER NOT NULL CHECK (parent_head_revision >= 1),
  parent_head_fingerprint TEXT NOT NULL,
  idempotency_key_hash TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  reservation_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  relation_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  PRIMARY KEY (project_id, child_task_id),
  UNIQUE (project_id, parent_task_id, idempotency_key_hash),
  UNIQUE (project_id, child_grant_id),
  FOREIGN KEY (project_id, child_task_id)
    REFERENCES agent_tasks(project_id, task_id) ON DELETE CASCADE,
  FOREIGN KEY (project_id, parent_task_id)
    REFERENCES agent_tasks(project_id, task_id),
  FOREIGN KEY (project_id, root_task_id)
    REFERENCES agent_tasks(project_id, task_id),
  FOREIGN KEY (project_id, parent_grant_id)
    REFERENCES grants(project_id, grant_id),
  FOREIGN KEY (project_id, child_grant_id)
    REFERENCES grants(project_id, grant_id)
) STRICT;

CREATE INDEX derived_task_relations_parent
  ON derived_task_relations(project_id, parent_task_id, created_at, child_task_id);

CREATE TRIGGER derived_task_relations_immutable
BEFORE UPDATE ON derived_task_relations
BEGIN
  SELECT RAISE(ABORT, 'derived_task_relations are immutable');
END;

CREATE TRIGGER derived_task_relations_delete_forbidden
BEFORE DELETE ON derived_task_relations
BEGIN
  SELECT RAISE(ABORT, 'derived_task_relations cannot be deleted');
END;
