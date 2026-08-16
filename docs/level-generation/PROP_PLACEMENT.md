# Numberdroid — Prop Placement Compiler

Status: **v0.3 placement + v0.3.1 orientation + v0.10 rotated footprints + v0.12 Overrides + v0.13 art handoff**

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
Trigger/Event compilation
  ↓
Runtime emission
  ↓
Prop Art Registry / presentation mapping
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

The wall side determines the required art rotation before geometric validation. If that rotation is not present in `allowedRotations`, that wall side does not produce candidates.

### Floor Props

Floor candidates enumerate every authored allowed rotation. Each orientation receives its real rotated physical rectangle before occupancy, Door Clearance, path, Hero-clearance and use-space validation.

The footprint must resolve entirely to walkable cells belonging to the requested semantic Space.

Floor Props may still record a `wallSide` if their selected candidate touches or prefers a wall. This is a placement/scoring fact; it does **not** change their authored `attachment` type or their v0.13 visual layer.

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

## 4. Prop rotation metadata

Every Prop declares:

```ts
allowedRotations: Array<0 | 90 | 180 | 270>
```

Numberdroid assets are top-down but may contain slight authored perspective, highlights, controls or side-face cues. The compiler must not rotate an asset into a view that has never been authored/approved.

`footprintTiles` describes the approved **0° authored physical footprint**.

The solver derives:

```text
0°   → width × height
90°  → height × width
180° → width × height
270° → height × width
```

Thus a `2×1` object at `90°` is physically solved as `1×2`; collision, occupancy, use-space and all downstream systems receive that solved rectangle.

### Direction convention

```text
0°   back north · front/access south
90°  back east  · front/access west
180° back south · front/access north
270° back west  · front/access east
```

For wall-backed Props this is also the wall convention. A north-wall Prop requires `0°`, an east-wall Prop `90°`, and so on.

For floor Props, directional use-space rotates with the Prop rather than remaining in world north/south.

## 5. Use-space reservations

Prop footprints and use-space are separate concepts.

### Directional approach / operating space

Props may declare `approachDepthTiles`. The approach is generated from the solved front/access direction, remains walkable, but becomes unavailable to later furnishing/dressing.

For wall furniture this prevents plants or storage from blocking Coffee Machines, Memory Consoles or service banks.

### Hero clearance

Hero machinery may declare `clearanceAroundTiles`, reserving composition/gameplay space around the **rotated physical footprint** without converting that reservation itself to solid collision.

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

Adding rotation support must not randomly reshuffle an already valid unchanged spatial candidate. Candidate identity remains based on stable semantic identity and solved physical placement rather than on one global PRNG stream.

New allowed orientations may create genuinely new candidates, but unchanged candidates retain deterministic ranking.

## 8. Workbench Overrides

Since v0.12, singleton Props may be edited through semantic Overrides.

A hard placement lock stores the reviewed placement **relative to the containing Space**:

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

A lock never bypasses the normal placement validator. If the locked position violates room bounds, wall attachment, Door Clearance, reservations or circulation, the Workbench rejects the edit.

When the actual intent is weaker, use a soft Override such as `preferredWall` rather than a hard placement lock.

Local `seedSalt` may request another deterministic candidate without rerolling unrelated semantic scopes.

Per-instance hard locks for one request with `quantity > 1` remain deliberately deferred until generated instance IDs become explicit Override targets.

## 9. Explainability

Every placement records:

- stable instance ID;
- source request / Prop / Space;
- role;
- resolved cardinal rotation;
- final rotated rectangle;
- wall side when applicable;
- footprint/use-space;
- score and scoring reasons;
- valid candidate count;
- rejection counts.

This supports Workbench questions such as “Why is this plant here?”, “Why can't this console move left?” or “Why did this bed become 1×2?”.

The Workbench's `WHY BLOCKED?` view preflights direct edits through the complete compiler and exposes the resulting constraint reason on touch devices as well as desktop.

## 10. Spatial metadata vs visual art

Since v0.13, Prop presentation is intentionally a separate concern. See `PROP_ART_EMISSION.md`.

```text
propRegistry.ts
    physical/placement truth

propArtRegistry.ts
    runtime asset + shadow + review status
```

The spatial registry does **not** contain the production image path. The Art Registry does **not** redefine footprint/collision.

A registered sprite consumes the already solved placement. For a non-square rotated Prop, runtime art keeps its authored 0° dimensions, is centered on the solved physical rectangle, and is then rotated around its center. Pixels therefore are not stretched to an already-rotated AABB.

Unregistered art remains a blockout while physical gameplay remains complete.

## 11. TS-01 proof

The reference spec exercises:

- Memory Console → real north wall, `0°`, operating approach;
- Coffee Machine → north wall, `0°`, operating approach;
- PRIMUS service banks → real wall attachment with multiple cardinal orientations;
- plants → wall/corner preference while avoiding Door Clearance, paths and operating space;
- Child Bed → non-square floor Prop with four allowed cardinal orientations;
- Toilet → hygiene-only + wall adjacency + opposite-door preference;
- Transfer Core → centered Hero + reserved clearance;
- Hologram / Flow → semantic proximity to Transfer Hero.

Dedicated rotated-footprint tests prove:

- `2×1 @ 90° → 1×2` physical footprint;
- unavailable wall-side art removes that wall from candidate generation;
- directional use-space rotates with the Prop;
- full TS-01 placement remains deterministic and downstream Actor routes stay valid.

v0.13 adds presentation tests proving authored source dimensions survive rotation and registered/unregistered art does not change runtime obstacle geometry.

## 12. Current limitations

- sprite pixel overhang / visual anchor offsets are not yet first-class metadata;
- shadow offset/scale is currently aligned to the same authored footprint as its Prop;
- per-instance Overrides for `quantity > 1` requests remain deferred;
- generated TS-01 has only partial production-art coverage and still requires the dedicated feature/art parity pass;
- visual art acceptance remains separate from compiler/CI success.
