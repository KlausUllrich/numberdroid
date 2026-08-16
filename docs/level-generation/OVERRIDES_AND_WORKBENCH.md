# Numberdroid — Semantic Overrides / Level Workbench

Status: **v0.12 editing contract**

v0.12 turns the existing Level Compiler debug view into the first real semantic editing Workbench.

The Workbench is **not** a second map editor and does not make rendered tiles the source of truth.

```text
canonical LevelSpec
      +
semantic Override[]
      ↓
full deterministic compiler
      ↓
Workbench preview / diagnostics
      ↓
copy/export Override data
```

Every accepted edit remains describable as explicit compiler input.

## 1. Binding authoring rule

Normal LevelSpec authoring should express intent through Spaces, Connections, relationships, Props, metadata, Routes, Triggers and Events.

Explicit coordinates are allowed **only as deliberate local Overrides/Locks**.

This distinction is important:

```text
BAD DEFAULT AUTHORING
"put family-child at tile 8,12"

GOOD DEFAULT AUTHORING
"family-child south of family-living"

VALID ART-DIRECTOR OVERRIDE
"lock family-child at this reviewed compiler-grid position"
```

A Lock is therefore not destructive tile painting. It is a stable semantic exception attached to a stable semantic ID.

## 2. Override target identity

`PlacementOverride.targetId` identifies the semantic object being changed.

v0.12 actively consumes Overrides for:

- Space geometry;
- Connection side preference;
- singleton Prop placement;
- Prop wall preference;
- local deterministic variation.

The current Workbench UI exposes Space and Prop editing first. Connection-side override support exists in the compiler contract and can be surfaced in the later usability pass.

## 3. Space geometry lock

A geometry lock contains:

```ts
{
  targetId: "transfer-room",
  lockGeometry: true,
  lockedGeometry: {
    offsetFromRootTiles: { x: 7, y: 7 },
    sizeTiles: { w: 10, h: 6 }
  }
}
```

The position is **not runtime pixels** and is not absolute screen/world placement.

It is stored relative to the first/root semantic Space:

```text
locked Space origin - root Space origin
```

This survives global geometry normalization. If another Space extends farther north/west and causes the generated world origin to shift, the lock remains stable relative to the semantic topology.

A Workbench Lock operation materializes the currently accepted generated rectangle into this root-relative form.

## 4. Geometry Lock behavior

The established v0.11 compatibility rule remains in force.

If the old incremental/tree-compatible layout plus the materialized lock still satisfies:

- all Connections;
- all required spatial relations;
- no overlaps;
- Door/aperture constraints;

then that result can remain on the compatibility path.

If the lock makes the old placement invalid, the v0.11 deterministic multi-constraint solver receives the locked rectangle as a **hard candidate constraint** and attempts to solve the other Spaces around it.

If no valid arrangement exists, compilation fails.

The Workbench catches that failure and rejects the edit rather than displaying an invalid partial level.

Diagnostics include:

```text
GEOMETRY_LOCK_ACTIVE
GEOMETRY_LOCK_APPLIED
```

when relevant.

## 5. Space Move / Resize

The v0.12 UI exposes one-tile nudge and resize controls.

A manual move/resize automatically materializes a geometry lock first. This makes the designer's explicit action persistent and reproducible.

The operation is then compiled through the complete pipeline.

Example:

```text
select Transfer room
→ MOVE →
→ materialize current geometry lock
→ change root-relative x by +1
→ compile complete Level
→ valid: commit Override in Workbench state
→ invalid: reject edit and keep previous valid state
```

Resize modifies the locked `sizeTiles` directly.

This is deliberately stronger than changing only a soft preferred size.

## 6. Prop placement lock

A singleton Prop placement lock contains:

```ts
{
  targetId: "living-memory",
  lockPlacement: true,
  lockedPlacement: {
    offsetTiles: { x: 2, y: 0 },
    rotation: 0,
    wallSide: "north"
  }
}
```

The offset is relative to the Prop's containing semantic Space.

This is important because the whole room may later move while the reviewed local furnishing arrangement should remain intact.

The Prop solver still validates the locked candidate against:

- room bounds;
- real wall slots;
- allowed art rotation;
- Prop footprints;
- existing reservations;
- Door Clearance;
- circulation rules;
- use-space / Hero clearance.

A Lock never bypasses gameplay/spatial validation.

Diagnostic:

```text
PROP_PLACEMENT_LOCK_APPLIED
```

## 7. Prop Move

Moving a singleton Prop follows the same pattern as Space movement:

```text
current accepted placement
→ materialize space-relative placement lock
→ nudge lock offset
→ full compile
→ commit only if valid
```

The user cannot drag a visible sprite into a collision-invalid state and leave the compiler unaware of it.

## 8. `preferredWall`

A Prop Override may change a soft wall preference without locking the final result:

```ts
{
  targetId: "child-bed",
  preferredWall: "east"
}
```

The normal Prop solver still chooses the highest-scoring valid candidate.

This should be preferred over a hard placement Lock when the actual design intent is merely “use the east wall if possible.”

General rule:

> express intent as preference when possible; lock only a reviewed concrete solution when necessary.

## 9. `preferredSide`

A Connection Override may change its preferred topology side:

```ts
{
  targetId: "hall-to-primus",
  preferredSide: "north"
}
```

Both the compatibility geometry path and the v0.11 multi-constraint solver consume this preference.

It remains soft. A required relation or hard topology constraint may override it.

The v0.12 compiler contract supports this even though Connection selection is not yet exposed in the first Workbench inspector UI.

## 10. Local deterministic regeneration

An Override may contain:

```ts
seedSalt: 1
```

The salt derives a new seed only for that semantic target.

```text
original semantic sub-seed
+ local override variation
→ local varied seed
```

This is the Workbench mechanism behind local regeneration.

It must never mutate the Level's global seed and must not reroll unrelated semantic scopes.

For Props this can select another equally valid candidate.

For topology, variation affects candidate tie-breaking only when the multi-constraint solver is actually choosing among equivalent possibilities. A deterministic tree-compatible Space with no ambiguous choice may correctly remain unchanged after a regeneration request.

Regeneration is not a promise that something must visually move; it is a request for another deterministic local variation where alternatives exist.

## 11. Safe edit transaction

Workbench edits use this contract:

```text
last valid Override[]
      ↓
proposed semantic edit
      ↓
compile semantic
→ geometry
→ navigation
→ Props
→ Actors/Routes
→ Triggers/Events
      ↓
valid?
  yes → commit proposed Override[]
  no  → reject + show compiler error
```

There is no intermediate invalid Workbench state.

This is important because a seemingly local change can invalidate downstream systems:

- Space movement can break a Door boundary;
- resize can remove enough wall length for an aperture;
- Prop movement can block an approach zone;
- furnishing changes can invalidate Actor Routes;
- Actor/Prop changes can affect Trigger source geometry.

The Workbench therefore validates the complete compiler result, not merely the edited stage.

## 12. Workbench UI v0.12

The live TS-01 Workbench remains:

```text
?levelgen=ts01
```

Edit Mode supports:

### Space

- select Space;
- lock / unlock geometry;
- nudge one tile in four directions;
- resize width/height by one tile;
- local regeneration salt;
- reset selected Override.

### Prop

- select Prop;
- lock / unlock singleton placement;
- nudge singleton placement;
- set `preferredWall` or AUTO;
- local regeneration salt;
- reset selected Override.

### Export

The inspector shows the current complete `Override[]` as JSON and provides `COPY JSON`.

Edits are intentionally browser-memory only in v0.12. The Workbench does not silently write back into GitHub or mutate the canonical LevelSpec.

A later usability/agent workflow can provide explicit save/apply actions with normal repository review semantics.

## 13. Foreground label rule

The user-established Workbench rule remains binding:

> element labels must always stay in the foreground.

Even in Edit Mode, selection outlines, Props, Actors, Routes, Trigger Zones and other debug layers render before one final SVG Labels group.

The final label layer remains `pointer-events: none`, so it does not interfere with selecting the object beneath it.

## 14. Pan / zoom / selection interaction

Edit Mode gives selectable Space and Prop geometry pointer priority.

Background remains available for pan.

Existing Workbench navigation remains:

- background mouse/touch drag → pan;
- wheel → zoom around cursor;
- pinch → zoom around gesture midpoint;
- `+ / −` → zoom fallback;
- `FIT` → complete topology.

This avoids converting normal gameplay camera behavior into an editor dependency.

## 15. Deliberate v0.12 limitation: multi-instance Prop locks

A request such as:

```ts
{ id: "primus-service", quantity: 2 }
```

produces stable instances such as:

```text
primus-service#1
primus-service#2
```

The current LevelSpec Override identity model still targets the semantic request ID rather than generated instance IDs.

Therefore v0.12 deliberately disables placement Lock/Move controls for `quantity > 1` requests.

It would be incorrect to pretend one request-level `lockedPlacement` can represent both generated instances, because that would force them toward the same local coordinate.

Request-level `preferredWall` and `seedSalt` remain valid.

Per-instance Override identity should be added explicitly if production authoring proves it necessary.

## 16. Override validation

Workbench override validation rejects at least:

- unknown semantic target IDs;
- duplicate Overrides for one target;
- negative/non-integer `seedSalt`;
- non-integer Space offsets;
- size override on unsupported targets;
- `preferredSide` on non-Connections;
- `preferredWall` on non-Prop requests;
- Geometry Lock without materialized lock data;
- invalid root-relative geometry coordinates/dimensions;
- Placement Lock without materialized placement data;
- invalid space-relative placement offsets.

Compiler-stage validation then adds the normal geometry/navigation/placement constraints.

## 17. Rule vs Override decision

An Override is for a **deliberate local exception or reviewed composition**.

Do not use Overrides to hide a repeated systemic failure.

Examples:

```text
One Transfer console should be 1 tile left for composition
→ Override is appropriate.

Plants repeatedly block wall consoles in many Levels
→ fix Prop metadata / global placement rule.

Every PRIMUS room requires manual room movement
→ fix topology/archetype rules, not twenty Overrides.
```

This distinction must be prominent in the final Agent Authoring Guide.

## 18. Next extension points

The later Workbench usability / campaign workflow should consider:

- Connection selection and direct `preferredSide` editing;
- per-instance Overrides for quantity-generated Props;
- explicit import/apply of Override JSON;
- reviewed write-back into LevelSpec/repository;
- local diff visualization before/after an edit;
- diagnostic explanation panel (“why was this candidate rejected?”);
- drag manipulation translated into semantic one-tile/grid Overrides;
- selection of Actors, Routes, Trigger Zones and other semantic elements where meaningful;
- scoped regeneration controls with visible seed/variation state.

These should extend the v0.12 semantic transaction model rather than bypassing it.
