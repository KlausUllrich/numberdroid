# Numberdroid — Semantic Overrides / Level Workbench

Status: **v0.12.2 editing contract**

v0.12 turns the Level Compiler debug view into the first real semantic editing Workbench. v0.12.1 hardened mobile gesture/inspector behavior; v0.12.2 makes direct edit controls constraint-aware.

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

The position is **not runtime pixels** and is not absolute screen/world placement. It is stored relative to the first/root semantic Space:

```text
locked Space origin - root Space origin
```

This survives global geometry normalization. A Workbench Lock operation materializes the currently accepted generated rectangle into this root-relative form.

## 4. Geometry Lock behavior

The established v0.11 compatibility rule remains in force.

If the incremental/tree-compatible layout plus the materialized lock still satisfies all Connections, required spatial relations, overlap rules and Door/aperture constraints, that layout stays on the compatibility path.

If the lock makes the old placement invalid, the deterministic multi-constraint solver receives the locked rectangle as a **hard candidate constraint** and attempts to solve the remaining Spaces around it.

If no valid arrangement exists, compilation fails. The Workbench rejects the edit rather than displaying an invalid partial level.

Diagnostics include:

```text
GEOMETRY_LOCK_ACTIVE
GEOMETRY_LOCK_APPLIED
```

## 5. Space Move / Resize

Move/resize uses this transaction:

```text
current accepted Space
→ materialize geometry lock
→ change root-relative position or size by one tile
→ compile complete Level
→ valid: commit Override
→ invalid: do not mutate Workbench state
```

Resize changes locked `sizeTiles` directly. This is stronger than a soft preferred size.

The first/root Space is special: it defines the root-relative coordinate frame. A pure translation of the root has no meaningful authored effect because global translation is normalized away. Therefore v0.12.2 disables root MOVE controls while still allowing valid size edits.

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

The offset is relative to the Prop's containing semantic Space, so a reviewed furnishing arrangement can survive movement of the whole room.

The Prop solver still validates a locked candidate against room bounds, real wall slots, allowed art rotation, footprints, reservations, Door Clearance, circulation and use-space/Hero clearance. A Lock never bypasses gameplay/spatial validation.

Diagnostic:

```text
PROP_PLACEMENT_LOCK_APPLIED
```

## 7. Prop Move

Moving a singleton Prop follows the same pattern:

```text
current accepted placement
→ materialize space-relative placement lock
→ nudge lock offset by one tile
→ full compile
→ commit only if valid
```

A visible Prop can therefore never be left in a compiler-invalid state.

## 8. `preferredWall`

A Prop Override may change a soft wall preference without locking the final result:

```ts
{
  targetId: "child-bed",
  preferredWall: "east"
}
```

The normal solver still chooses the highest-scoring valid candidate.

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

Both geometry paths consume this preference. It remains soft; required relations and hard topology constraints may override it.

The compiler contract supports this even though Connection selection is not yet exposed in the first Workbench inspector UI.

## 10. Local deterministic regeneration

An Override may contain:

```ts
seedSalt: 1
```

The salt derives a new seed only for that semantic target:

```text
original semantic sub-seed
+ local override variation
→ local varied seed
```

It never mutates the Level's global seed and must not reroll unrelated semantic scopes.

Regeneration is not a promise that something visibly moves; deterministic scopes with no alternative valid candidate may remain unchanged.

## 11. Safe edit transaction

All Workbench edits use the complete compiler as validation authority:

```text
last valid Override[]
      ↓
proposed semantic edit
      ↓
semantic
→ geometry
→ navigation
→ Props
→ Actors/Routes
→ Triggers/Events
      ↓
valid?
  yes → commit proposed Override[]
  no  → retain previous valid state
```

A seemingly local edit can affect Doors, furnishing, routes or Trigger source geometry, so validating only the edited stage would be unsafe.

## 12. Constraint-aware direct edit controls — v0.12.2

The initial v0.12 UI exposed all move/resize arrows as if they were equally legal. That was misleading: many semantic elements are intentionally constrained by Connections, wall attachment, use-space, clearance, routes or neighboring Props.

A manual TS-01 editability audit showed examples such as:

```text
family-living
  MOVE: 0/4 valid
  SIZE: W+ and H+ valid

main-hall
  MOVE: only ↑ valid

transfer-room
  MOVE: ←, →, ↑ valid
  SIZE: most directions valid

living-memory
  MOVE: only → valid

child-bed
  MOVE: only ↑ valid

some tightly bound dressing/fixture Props
  MOVE: 0/4 valid
```

This is **not** a reason to weaken hard compiler constraints. Instead v0.12.2 previews each direct action against the complete compiler when an element is selected.

Binding UI rule:

```text
enabled control
= proposed one-tile edit already compiles successfully

disabled control
= current hard constraints block that exact direct edit
```

The inspector displays how many direct move/size actions are currently valid. Disabled controls are not submitted and therefore do not produce avoidable red `EDIT REJECTED` states.

Unexpected/racing/other edits can still fail during the real transaction; those failures remain visible and do not mutate the previous valid state.

This preflight runs only when selection or Override state changes, not during pan/pinch RAF-style interaction.

## 13. Workbench UI

Live Workbench:

```text
?levelgen=ts01
```

Space inspector supports:

- select Space;
- lock / unlock geometry;
- constraint-aware one-tile nudge;
- constraint-aware width/height resize;
- local regeneration salt;
- reset selected Override.

Prop inspector supports:

- select Prop;
- lock / unlock singleton placement;
- constraint-aware singleton nudge;
- `preferredWall` or AUTO;
- local regeneration salt;
- reset selected Override.

The inspector shows the complete current `Override[]` as JSON and provides `COPY JSON`.

Edits remain browser-memory only. The Workbench does not silently write into GitHub or mutate canonical LevelSpecs.

## 14. Foreground label rule

The user-established rule remains binding:

> element labels must always stay in the foreground.

Selection, Props, Actors, Routes, Trigger Zones and other overlays render before one final SVG Labels group. The label layer remains `pointer-events: none`.

## 15. Mobile pan / zoom / selection — v0.12.1

Mobile interaction has an explicit arbitration contract:

```text
one-finger tap       → select Space/Prop
one-finger movement  → pan, never select
two-finger gesture   → pinch/pan, never select
```

All pointers begin at the shared SVG gesture controller. Selection is committed only on pointer-up after proving that the gesture remained a tap.

Debug overlays are pointer-transparent for editing, so they cannot steal Space/Prop hit-testing.

On narrow screens the semantic inspector is presented as a visible bottom sheet with a close control and enlarged touch targets.

Desktop keeps wheel zoom, drag pan and the side inspector.

## 16. Deliberate limitation: multi-instance Prop locks

A request such as:

```ts
{ id: "primus-service", quantity: 2 }
```

produces stable instances such as `primus-service#1` and `primus-service#2`, but the current Override identity model targets the semantic request ID.

Therefore placement Lock/Move remains disabled for `quantity > 1` requests rather than pretending one request-level placement can represent multiple instances.

Request-level `preferredWall` and `seedSalt` remain valid. Per-instance Override identity should be added explicitly if production authoring proves it necessary.

## 17. Regression contract

Permanent Workbench tests now cover more than one happy-path sample:

- every current TS-01 Space can materialize its current geometry as a lock and recompile identically;
- every singleton TS-01 Prop can materialize its current placement as a lock and recompile identically;
- representative valid edits actually compile, including Transfer movement/resize, Prop preference changes and local regeneration;
- deliberately impossible movement still fails and leaves the previous valid state untouched;
- mobile tap/pan/pinch arbitration remains deterministic.

This prevents a future UI/compiler change from regressing into a Workbench where every apparent edit fails.

## 18. Override validation

Workbench override validation rejects at least:

- unknown semantic target IDs;
- duplicate Overrides for one target;
- invalid `seedSalt`;
- invalid Space offsets/sizes;
- `preferredSide` on non-Connections;
- `preferredWall` on non-Prop requests;
- Geometry Lock without materialized lock data;
- invalid root-relative geometry coordinates/dimensions;
- Placement Lock without materialized placement data;
- invalid space-relative placement offsets.

Compiler-stage validation then adds normal geometry/navigation/placement constraints.

## 19. Rule vs Override decision

An Override is for a **deliberate local exception or reviewed composition**.

Do not use Overrides to hide a repeated systemic failure.

```text
One Transfer console should be 1 tile left for composition
→ Override is appropriate.

Plants repeatedly block wall consoles in many Levels
→ fix Prop metadata / global placement rule.

Every PRIMUS room requires manual room movement
→ fix topology/archetype rules, not twenty Overrides.
```

This distinction must be prominent in the final Agent Authoring Guide.

## 20. Next extension points

Later Workbench usability / campaign work should consider:

- Connection selection and direct `preferredSide` editing;
- per-instance Overrides for quantity-generated Props;
- explicit import/apply of Override JSON;
- reviewed write-back into LevelSpec/repository;
- local before/after diff visualization;
- deeper diagnostic explanation (`why blocked?` rather than only disabled);
- drag manipulation translated into semantic grid Overrides;
- Actors, Routes and Trigger Zones as selectable semantic elements where meaningful;
- scoped regeneration with visible variation state.

These must extend the semantic transaction model rather than bypassing it.
