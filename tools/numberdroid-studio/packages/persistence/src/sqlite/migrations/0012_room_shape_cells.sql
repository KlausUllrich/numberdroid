CREATE TABLE room_variant_shape_cells (
  project_id TEXT NOT NULL,
  room_variant_id TEXT NOT NULL,
  variant_version INTEGER NOT NULL CHECK (variant_version >= 1),
  cell_order INTEGER NOT NULL CHECK (cell_order >= 0),
  cell_kind TEXT NOT NULL CHECK (cell_kind IN ('VOID', 'BLOCKED')),
  x INTEGER NOT NULL CHECK (x BETWEEN 0 AND 63),
  y INTEGER NOT NULL CHECK (y BETWEEN 0 AND 63),
  PRIMARY KEY (project_id, room_variant_id, variant_version, x, y),
  UNIQUE (project_id, room_variant_id, variant_version, cell_order),
  FOREIGN KEY (project_id, room_variant_id, variant_version)
    REFERENCES room_variant_versions(project_id, room_variant_id, variant_version)
    ON DELETE CASCADE
) STRICT;

CREATE INDEX room_variant_shape_cells_kind
  ON room_variant_shape_cells(project_id, room_variant_id, variant_version, cell_kind, cell_order);

CREATE TRIGGER room_variant_shape_cells_immutable
BEFORE UPDATE ON room_variant_shape_cells
BEGIN
  SELECT RAISE(ABORT, 'room_variant_shape_cells are immutable');
END;
