# Numberdroid — Navigation + Forbidden Zones

Status: **v0.2 compiler contract**

This stage consumes `GeometryCompilePlan` and produces navigation/circulation data that later placement stages must respect.

```text
LevelSpec
  ↓
SemanticCompilePlan
  ↓
GeometryCompilePlan
  ↓
NavigationCompilePlan   ← this document
  ↓
Prop / Encounter Placement
  ↓
Tiled / FloorDefinition output
```

The purpose is not yet final NPC pathfinding. The purpose is to establish **authoring constraints** before props, heroes and enemies are placed.

## 1. Walkable-cell graph

Every generated Space rectangle is decomposed into unit floor cells.

Two orthogonally neighboring cells are connected when:

- they belong to the same Space; or
- they lie on opposite sides of a compiled connection aperture.

Two rooms touching along a wall therefore do **not** become mutually walkable merely because their floor rectangles are adjacent. The Shared Wall Graph remains authoritative and only a real aperture creates a cross-space portal.

The complete graph must be connected when the LevelSpec requires reachability. v0.2 fails compilation rather than emitting a disconnected authored Floor.

## 2. Portal cells

Each compiled opening/door produces explicit cell pairs across its aperture.

For a two-tile doorway there are two walkable portal pairs. The middle pair is also exposed as a stable representative for debug/placement logic.

This gives later stages a concrete distinction between:

- geometric shared boundary;
- wall segment;
- wall aperture;
- walkable threshold cells.

## 3. Primary circulation skeleton

Before furniture exists, the compiler reserves a simple deterministic circulation skeleton.

v0.2 uses the center cell of the first semantic Space as a temporary root and computes shortest walkable paths to the center of every other generated Space. The union is `primaryPathCells`.

This is intentionally conservative. It answers:

> Which floor cells should ordinary props avoid if we want every generated room to remain comfortably reachable before detailed furnishing?

Later versions may replace the temporary first-Space root with an explicit start/entry semantic and may distinguish primary, secondary and optional circulation.

## 4. Forbidden zones

v0.2 compiles two authoring reservation classes.

### `door-clearance`

Door clearance comes directly from `ConnectionSpec` / `GeometryCompilePlan` and is reserved on both sides of a real door.

Ordinary props and encounters that declare `forbidDoorClearance` must not occupy these cells.

### `primary-circulation`

Cells in the primary circulation skeleton are reserved against ordinary blocking furniture.

A later placement stage may allow non-blocking decals/effects or explicitly approved hero staging to use these cells, but this must be deliberate rather than accidental.

One cell may carry several reasons simultaneously.

## 5. Wall attachment slots

The compiler also turns the Shared Wall Graph into semantic **wall-adjacent placement slots**.

Each slot knows:

- which canonical wall segment owns it;
- which Space it belongs to;
- which side of that Space the wall is on;
- the interior floor cell adjacent to the wall;
- whether that cell is currently blocked by door clearance or primary circulation.

A doorway aperture produces **no wall slot** at the missing wall section.

This is the basis for future metadata rules such as:

```text
plant
  prefer wall/corner
  reject doorway clearance
  reject primary path

memory console
  require wall
  reject doorway aperture

coffee machine
  require wall/service edge
  require usable approach side

toilet
  require bathroom wall
  prefer wall opposite door
```

## 6. Debug preview

The production build exposes a development/authoring preview through:

```text
?levelgen=ts01
```

The preview is compiled from the canonical TS-01 LevelSpec at runtime and visualizes:

- generated Spaces;
- tile grid;
- canonical Shared Wall Graph;
- apertures/doors;
- optional door-clearance overlays;
- optional primary-circulation cells;
- optional wall attachment slots.

This view is a compiler QA tool, not the gameplay presentation and not final art.

## 7. Current limitations

v0.2 still does **not**:

- place hero assets;
- place ordinary props;
- calculate prop footprints against neighboring props;
- compile hero-specific clearance;
- place enemies;
- generate patrol geometry;
- execute triggers/events;
- emit a Tiled/FloorDefinition map;
- replace the current live TS-01 gameplay map.

The next placement stage should consume these reservations instead of inventing its own independent collision/path rules.

## 8. Next step

The next compiler block is metadata-driven **Prop Placement**:

1. choose wall/floor candidates from `NavigationCompilePlan`;
2. enforce attachment and forbidden-zone metadata;
3. reserve footprint and approach cells;
4. place hero anchors before support props;
5. place functional props before dressing;
6. emit diagnostics explaining chosen/rejected candidates.

Enemy placement should follow the same shared reservation model after prop placement is stable.
