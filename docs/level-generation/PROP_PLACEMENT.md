# Numberdroid — Prop Placement Compiler

Status: **v0.3 placement + v0.3.1 orientation contract**

This stage consumes generated navigation/forbidden-zone data and produces deterministic, explainable Hero / functional / furniture / dressing placement.

```text
LevelSpec
  ↓
Geometry / Shared Walls
  ↓
Navigation + widened Door Clearance
  ↓
Prop Placement + art orientation   ← this document
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

### Wall-attached Props

Wall candidates come only from `wallAttachmentSlots` derived from the canonical Shared Wall Graph. A wall Prop therefore cannot be placed where no wall exists or inside a doorway aperture.

### Floor Props

Floor candidates enumerate fitting rectangles inside the requested semantic Space. The footprint must resolve entirely to walkable cells belonging to that Space.

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

### Wall convention

For wall-backed Props:

```text
0°   north wall · front/access south
90°  east wall  · front/access west
180° south wall · front/access north
270° west wall  · front/access east
```

A wall placement requiring a rotation outside `allowedRotations` is invalid. For example, the current Family Memory Console and Coffee Machine are authored for the north-wall orientation and currently declare only `0°`.

### Floor Props

Square floor Props may choose any allowed cardinal rotation without changing their solved footprint.

Until the placement stage explicitly enumerates rotated non-square footprints, non-square floor Props conservatively use only compatible `0° / 180°` orientations. This is deliberate: visual rotation must not silently invalidate collision/footprint geometry.

The chosen rotation is persisted in the oriented placement decision and exposed in Workbench tooltips.

## 5. Use-space reservations

Prop footprints and use-space are separate concepts.

### Wall-prop approach

Wall furniture may declare `approachDepthTiles`. The approach stays walkable but becomes unavailable to later furnishing/dressing. This prevents plants or storage from blocking the Coffee Machine, Memory Console or service banks.

### Hero clearance

Hero machinery may declare `clearanceAroundTiles`, reserving composition/gameplay space around the Hero without converting it to solid collision.

## 6. Primary circulation and Heroes

Ordinary Props that forbid the provisional primary path treat it as a hard constraint.

Hero Props are exceptional: they may consume provisional primary cells only if generated reachability survives. Such candidates are penalized and explained rather than silently accepted.

## 7. Soft scoring

After hard rejection, valid candidates are scored using preferences such as:

- `preferredWall`;
- wall adjacency;
- corner placement;
- room-center Hero focus;
- explicit `near` semantic relationships;
- semantic tag proximity;
- `preferOppositeDoor` for bathroom-style fixtures.

A tiny deterministic sub-seed tie-breaker makes equivalent valid choices stable.

## 8. Explainability

Every placement records:

- stable instance ID;
- source request / Prop / Space;
- role;
- final rectangle;
- wall side when applicable;
- resolved cardinal rotation;
- footprint/use-space;
- score and scoring reasons;
- valid candidate count;
- rejection counts.

This supports Workbench questions such as “Why is this plant here?” or “Why can't this console go on the west wall?”.

## 9. TS-01 proof

The reference spec currently exercises:

- Memory Console → real north wall, `0°`, operating approach;
- Coffee Machine → north wall, `0°`, operating approach;
- PRIMUS service banks → wall attachment with multiple allowed cardinal rotations;
- plants → wall/corner preference while avoiding Door Clearance, paths and operating space;
- child furniture → wall-biased placement;
- toilet → hygiene-only + wall adjacency + wall opposite door;
- Transfer Core → centered Hero + reserved clearance;
- Hologram / Flow → semantic proximity to the Transfer Hero.

## 10. Debug preview

`?levelgen=ts01` visualizes generated Prop footprints/use-space and exposes the chosen rotation in each Prop tooltip. Pan/zoom/FIT remain Workbench-only viewport state.

## 11. Current limitations

- rotated non-square floor footprints are not yet enumerated at candidate-generation time;
- actual sprite pixel overhangs remain future metadata;
- per-Prop visual/collision shapes are still coarser than final runtime art geometry;
- direct Workbench move/lock/regenerate operations are not yet implemented;
- generated content does not yet replace the live TS-01 Floor.
