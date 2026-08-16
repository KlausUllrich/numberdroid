# Numberdroid — Prop Placement Compiler

Status: **v0.3 placement + v0.3.1 orientation + v0.10 rotated-footprint contract**

This stage consumes generated navigation/forbidden-zone data and produces deterministic, explainable Hero / functional / furniture / dressing placement.

```text
LevelSpec
  ↓
Geometry / Shared Walls
  ↓
Navigation + widened Door Clearance
  ↓
Prop Placement + rotation-aware physical geometry   ← this document
  ↓
Actor Placement
  ↓
Runtime/Tiled emission
```

The purpose is to turn durable Level-Design rules and Prop metadata into reproducible authoring decisions rather than hand-authored coordinates.

## 1. Placement hierarchy

The compiler places semantic requests in this order:

```text
Hero
→ Support
→ Furniture
→ Dressing
```

Hero machinery owns composition first; support objects relate to it; furniture works around those functional anchors; plants and other dressing adapt last.

## 2. Candidate generation

Rotation is part of candidate geometry. It is **not** a presentation transform applied after a location has already been chosen.

### Wall-attached Props

Wall candidates come only from `wallAttachmentSlots` derived from the canonical Shared Wall Graph. A wall Prop therefore cannot be placed where no wall exists or inside a doorway aperture.

The wall side determines the required art rotation before geometric validation. If that rotation is not present in `allowedRotations`, that wall side does not produce candidates at all.

### Floor Props

Floor candidates enumerate every authored allowed rotation. Each orientation receives its real rotated physical rectangle before occupancy, Door Clearance, path, Hero-clearance and use-space validation.

The footprint must resolve entirely to walkable cells belonging to the requested semantic Space.

## 3. Hard rejection rules

Candidates may be rejected for:

- another Prop footprint;
- reserved Prop use-space;
- widened Door-Clearance conflict;
- primary-circulation conflict when forbidden by metadata;
- missing real wall attachment;
- approach/use-space leaving the room or being blocked;
- Hero clearance conflicts;
- Hero footprint disconnecting generated reachability;
- unavailable required art rotation.

Required Props fail compilation if no valid candidate remains.

## 4. Prop art rotation — required metadata

Every Prop declares:

```ts
allowedRotations: Array<0 | 90 | 180 | 270>
```

This exists because Numberdroid assets are top-down but may contain slight authored perspective, highlights, controls or side-face cues. The compiler must not freely rotate an asset into a view that has never been authored/approved.

`footprintTiles` always describes the approved **0° authored physical footprint**.

The solver derives:

```text
0°   → width × height
90°  → height × width
180° → width × height
270° → height × width
```

Thus a `2×1` bed using `90°` is physically solved as `1×2`; collision, occupancy, use-space and all downstream systems receive that solved rectangle.

### Direction convention

```text
0°   back north · front/access south
90°  back east  · front/access west
180° back south · front/access north
270° back west  · front/access east
```

For wall-backed Props this is also the wall convention. A north-wall prop therefore requires `0°`, an east-wall prop `90°`, and so on.

For floor Props, all authored allowed rotations are valid candidate orientations. Directional use-space such as an operating side rotates with the Prop rather than remaining in world north/south.

The chosen rotation is persisted directly in the solved placement decision and exposed to Workbench/runtime emission.

## 5. Use-space reservations

Prop footprints and use-space are separate concepts.

### Directional approach / operating space

Props may declare `approachDepthTiles`. The approach is generated from the Prop's solved front/access direction, remains walkable, but becomes unavailable to later furnishing/dressing.

For example, a `2×1` floor service object rotated to `90°` becomes `1×2` and reserves its operating strip to the west.

For wall furniture this prevents plants or storage from blocking the Coffee Machine, Memory Console or service banks.

### Hero clearance

Hero machinery may declare `clearanceAroundTiles`, reserving composition/gameplay space around the **rotated physical footprint** without converting the reservation itself to solid collision.

## 6. Primary circulation and Heroes

Ordinary Props that forbid the provisional primary path treat it as a hard constraint.

Hero Props are exceptional: they may consume provisional primary cells only if generated reachability survives. Such candidates are penalized and explained rather than silently accepted.

## 7. Soft scoring and stability

After hard rejection, valid candidates are scored using preferences such as:

- `preferredWall`;
- wall adjacency;
- corner placement;
- room-center Hero focus;
- explicit `near` semantic relationships;
- semantic tag proximity;
- `preferOppositeDoor` for bathroom-style fixtures.

A tiny deterministic sub-seed tie-breaker makes equivalent valid choices stable.

### Binding regeneration-stability rule

Adding rotation support must not randomly reshuffle an already valid unchanged spatial candidate. The candidate seed identity therefore remains based on:

```text
instance seed
+ solved physical rect
+ wall side / floor
```

not on a newly appended rotation token.

New allowed orientations may create genuinely new physical candidates, but unchanged candidates retain their previous deterministic ranking. This is required for local regeneration and future Workbench editing.

## 8. Explainability

Every placement records:

- stable instance ID;
- source request / Prop / Space;
- role;
- resolved cardinal rotation;
- final **rotated** rectangle;
- wall side when applicable;
- footprint/use-space;
- score and scoring reasons;
- valid candidate count;
- rejection counts.

Diagnostics explicitly include the chosen rotation and resulting footprint dimensions. This supports Workbench questions such as “Why is this plant here?”, “Why can't this console go on the west wall?” or “Why did this bed become 1×2?”.

## 9. TS-01 proof

The reference spec currently exercises:

- Memory Console → real north wall, `0°`, operating approach;
- Coffee Machine → north wall, `0°`, operating approach;
- PRIMUS service banks → real wall attachment with multiple cardinal art orientations;
- plants → wall/corner preference while avoiding Door Clearance, paths and operating space;
- child bed → non-square floor Prop with four allowed cardinal orientations;
- toilet → hygiene-only + wall adjacency + wall opposite door;
- Transfer Core → centered Hero + reserved clearance;
- Hologram / Flow → semantic proximity to the Transfer Hero.

Dedicated v0.10 tests additionally prove:

- `2×1 @ 90° → 1×2` physical footprint;
- unavailable wall-side art removes that wall from candidate generation;
- directional floor-prop use-space rotates with the Prop;
- full TS-01 placement remains deterministic and its existing downstream Actor routes remain valid.

## 10. Debug preview

`?levelgen=ts01` visualizes generated Prop footprints/use-space and exposes the chosen rotation in each Prop tooltip. Pan/zoom/FIT remain Workbench-only viewport state.

## 11. Current limitations

- actual sprite pixel overhangs remain future metadata;
- per-Prop visual/collision shapes are still coarser than final runtime art geometry;
- direct Workbench move/lock/regenerate operations are not yet implemented;
- generated content does not yet replace the accepted hand-authored TS-01 Floor.
