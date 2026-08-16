# Numberdroid — Navigation + Forbidden Zones

Status: **v0.2 contract + v0.3.1 Door-Clearance hardening**

This stage consumes `GeometryCompilePlan` and produces navigation/circulation data that later placement stages must respect.

```text
LevelSpec
  ↓
SemanticCompilePlan
  ↓
GeometryCompilePlan
  ↓
NavigationCompilePlan
  ↓
Prop / Encounter Placement
  ↓
Tiled / FloorDefinition output
```

The purpose is not final NPC pathfinding. It establishes **authoring constraints** before Props, Heroes and actors are placed.

## 1. Walkable-cell graph

Every generated Space rectangle is decomposed into unit floor cells.

Two orthogonally neighboring cells are connected when:

- they belong to the same Space; or
- they lie on opposite sides of a compiled connection aperture.

Two rooms touching along a wall therefore do **not** become mutually walkable merely because their floor rectangles are adjacent. The Shared Wall Graph remains authoritative and only a real aperture creates a cross-space portal.

The complete graph must be connected when the LevelSpec requires reachability.

## 2. Portal cells

Each compiled opening/door produces explicit cell pairs across its aperture. This distinguishes:

- geometric shared boundary;
- wall segment;
- wall aperture;
- walkable threshold cells.

## 3. Primary circulation skeleton

Before furnishing exists, the compiler reserves a deterministic circulation skeleton from the first semantic Space toward every other generated Space. The union is `primaryPathCells`.

This is conservative authoring data rather than final aesthetic pathing. It answers which cells ordinary blocking Props should avoid to preserve comfortable basic reachability.

## 4. Forbidden zones

### `door-clearance`

A real door reserves clearance on both sides.

As of **v0.3.1**, the lateral span along the wall is always:

```text
½ aperture width | DOOR APERTURE | ½ aperture width
```

Therefore the complete Door-Clearance width along the wall axis is **2× the door aperture width**.

The authored `before` / `after` values still control how deeply that zone extends into each connected room. Widening the lateral zone does not silently change its depth.

Example for a two-tile door:

```text
wall axis
<---- 4 tiles reserved ---->
  1 tile | 2 tile door | 1 tile
```

Props, use-space and actor homes that respect Door Clearance may not occupy these cells.

### `primary-circulation`

Cells in the provisional primary circulation skeleton are reserved against ordinary blocking furniture. Hero placement may later consume some of them only after reachability validation.

One cell may carry several reservation reasons simultaneously.

## 5. Wall attachment slots

The Shared Wall Graph is also converted into semantic wall-adjacent placement slots.

Each slot knows:

- canonical wall segment;
- Space;
- wall side;
- interior floor cell;
- whether that cell is blocked by clearance/circulation.

A doorway aperture produces **no wall slot** at the missing wall section. The v0.3.1 widened Door Clearance additionally blocks nearby wall slots, preventing wall furniture from crowding the sides of a doorway.

## 6. Debug preview

The Workbench preview at:

```text
?levelgen=ts01
```

visualizes generated Spaces, Shared Walls, apertures, widened Door Clearance, primary circulation, wall slots, Props, use-space, actors and routes as later stages are compiled.

The view is compiler QA, not final gameplay art.

## 7. Downstream ownership

Later stages must consume these reservations rather than recreating independent doorway/path rules:

- Prop Placement uses them for furniture and Hero constraints;
- Actor Placement uses the same widened Door Clearance and furnished free-space model;
- Trigger/Event staging should also use the same generated topology/route IDs.
