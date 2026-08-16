# Numberdroid Level Compiler — Geometry + Shared Wall Graph

Status: **CURRENT geometry contract — v0.1 foundation + v0.11 multi-constraint topology**

This document owns the canonical geometry contract after semantic `LevelSpec` compilation.

```text
LevelSpec
  ↓
SemanticCompilePlan
  ↓
Topology solve
  ├─ compatibility tree path
  └─ v0.11 cyclic / multi-constraint fallback
  ↓
GeometryCompilePlan
  ├─ placed room/corridor rectangles
  ├─ compiled connection apertures
  ├─ door-clearance reservations
  └─ one canonical Shared Wall Graph
  ↓
Navigation → Props → Actors → Triggers/Events → Runtime/Tiled emission
```

For the detailed cyclic/backtracking algorithm, see `MULTI_CONSTRAINT_TOPOLOGY.md`.

## 1. Space geometry

Every semantic room/corridor resolves to one integer tile rectangle:

```ts
{
  id,
  kind,
  rect: { x, y, w, h },
  seed,
}
```

The established compatibility path chooses the authored `preferred` dimensions from each `TileRange`.

The v0.11 fallback may vary integer dimensions inside `min/preferred/max` only when the complete authored topology cannot otherwise be satisfied. Preferred dimensions are always attempted first.

Corridor width remains a first-class authored constraint, not an incidental gap between rooms.

## 2. Topology placement

### Compatibility path

Tree-compatible Levels retain the original deterministic placement behavior:

1. first semantic Space becomes root;
2. each new Space attaches to an already placed connected neighbor;
3. `preferredSide` and relative relations choose initial side/alignment;
4. collisions may be resolved by sliding along the shared boundary;
5. enough shared boundary must remain for the authored aperture width.

After every Space is placed, the **complete** graph is validated. If every Connection and every `required` spatial relation is satisfied, that geometry is retained exactly.

Diagnostic:

```text
TREE_COMPATIBLE_TOPOLOGY_PRESERVED
```

This compatibility-first rule prevents a new solver capability from needlessly rerolling existing accepted/generated layouts.

### Cyclic / multi-constraint fallback

If the incremental result cannot satisfy all final Connections or required relations, the compiler invokes bounded deterministic backtracking.

It can solve graphs such as:

```text
A ─ B
│   │
D ─ C
```

and placements where one new Space must simultaneously satisfy several already-known architectural adjacencies.

It also evaluates `required` vs `preferred` spatial relations and may select a non-preferred dimension within the authored TileRange when necessary.

See `MULTI_CONSTRAINT_TOPOLOGY.md` for the full contract and search-bound rules.

## 3. Spatial relations

Relations are semantic topology constraints rather than raw coordinates.

```text
north_of / south_of / east_of / west_of
north_east_of / north_west_of
south_east_of / south_west_of
adjacent
```

`strength: "required"` is a hard constraint.

`strength: "preferred"` — and omitted strength — is a soft scoring preference.

Directional relations use Space centers as sector tests after overlap has already been forbidden. `adjacent` specifically requires a real shared boundary.

A required relation is never silently downgraded to make compilation pass.

## 4. No room owns its walls

This remains binding.

A Space defines **floor geometry**, not four independently authored wall objects.

After topology has been solved, every Space boundary is decomposed into canonical unit edges. If two Spaces own the same edge, the edge exists once with two owners.

```text
family-child | family-hygiene
             ↑
       one shared edge
```

Contiguous unit edges with the same ownership are collapsed into `WallSegment`s:

```ts
{
  id,
  orientation: "horizontal" | "vertical",
  x,
  y,
  length,
  ownerSpaceIds: string[],
  shared: boolean,
}
```

`ownerSpaceIds.length === 1` means an exterior boundary.

`ownerSpaceIds.length === 2` means one shared wall between adjacent Spaces.

This is the systemic rule that prevents the old double-wall defect.

## 5. Connections are apertures in real shared walls

Every authored Connection must resolve to a real shared boundary between its two Spaces.

The compiler derives:

```ts
{
  wallOrientation,
  boundary,
  apertureStart,
  apertureLength,
  fromSide,
  toSide,
}
```

`widthTiles` is a hard minimum on the available shared boundary.

The aperture units are then removed from the canonical wall graph. A Door is therefore attached to an already-existing opening; there is no valid generated state where a wall continues behind that Door.

This geometry contract is consumed directly by the existing runtime/Tiled emitter.

## 6. Door clearance

For `standard-door` and `controlled-door`, geometry produces explicit clearance rectangles on both sides of the aperture.

```text
space A
  [clearance-before]
========== DOOR ==========
  [clearance-after]
space B
```

The base geometry clearance must fit completely inside both connected Spaces.

The later v0.3.1 navigation hardening stage widens real-door clearance laterally to **2× aperture width**, while preserving the authored before/after depth.

Prop/Actor placement then consumes those forbidden zones.

## 7. Overrides

Existing `offsetTiles` Overrides are applied after topology placement and before final complete validation.

Offsets must use integer tile coordinates.

If an Offset causes overlap, breaks a real Connection, or violates a required spatial relation, compilation fails.

The later Workbench/Overrides block is responsible for evolving this into first-class locked constraints and local regeneration. Raw coordinate patches must not become a hidden second authoring model.

## 8. TS-01 compatibility proof

The established TS-01 solution remains:

```text
family-living      x1  y3   7×6
family-child       x2  y9   4×4
family-hygiene     x6  y9   2×3
main-hall          x8  y1   3×9
transfer-room      x8  y10 10×6
primus-allocation  x11 y1   9×8
```

The Transfer room still uses the original collision-avoiding slide behavior.

v0.11 explicitly regression-tests that this exact geometry remains on the compatibility path rather than being rerolled through the new search algorithm.

## 9. Validation

The geometry stage rejects at least:

- invalid/non-integer resolved dimensions;
- overlapping final Spaces;
- disconnected authored semantic graphs when reachability is required upstream;
- Connections without a real shared boundary;
- apertures wider than the available shared boundary;
- Door Clearance outside either connected Space;
- post-solve Overrides that break required geometry;
- unsatisfied `required` spatial relations;
- mutually impossible multi-constraint topology;
- deterministic fallback searches that exceed their bounded search budget.

Preferred relations may remain unsatisfied but produce explicit diagnostics.

## 10. Explainability diagnostics

Important geometry/topology diagnostics include:

```text
SPACE_SLID_FOR_COLLISION
TREE_COMPATIBLE_TOPOLOGY_PRESERVED
MULTI_CONSTRAINT_FALLBACK_USED
MULTI_CONSTRAINT_TOPOLOGY_SOLVED
SPACE_SIZE_ADJUSTED_FOR_CONSTRAINTS
PREFERRED_SPATIAL_RELATION_UNSATISFIED
SPATIAL_RELATIONS_EVALUATED
GEOMETRY_COMPILED
```

The Workbench should surface these rather than hiding solver decisions.

## 11. Stability rule

The Level Compiler does not own one mutable global random stream.

Stable semantic IDs produce semantic sub-seeds. The topology fallback uses Space-local seeds plus candidate identity only for deterministic tie-breaking.

More importantly, an already-valid compatibility layout is not sent through fallback search at all.

This is the geometry-level expression of the broader editing rule:

> Adding a capability must not randomly rearrange unrelated accepted content.
