# Numberdroid — Prop Placement Compiler

Status: **v0.3 compiler contract**

This stage consumes `NavigationCompilePlan` and produces deterministic, explainable Hero / functional / furniture / dressing placement.

```text
LevelSpec
  ↓
SemanticCompilePlan
  ↓
GeometryCompilePlan
  ↓
NavigationCompilePlan
  ↓
PropPlacementPlan        ← this document
  ↓
Encounter Placement
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

Within the same class, LevelSpec order remains stable. Quantity expands one semantic request into stable instance IDs such as `primus-service#1` and `primus-service#2`.

This ordering is deliberate:

- Hero machinery owns the composition first;
- support objects can relate to the Hero;
- furniture works around functional anchors;
- plants and other dressing adapt last.

## 2. Candidate generation

### Wall-attached props

Wall candidates come only from `wallAttachmentSlots` derived from the canonical Shared Wall Graph.

Therefore a wall prop cannot be placed:

- where no wall exists;
- inside a doorway aperture;
- across a missing wall segment.

For north/south walls the authored footprint is used directly. For east/west walls the footprint rotates so wall span/depth remain meaningful.

### Floor props

Floor candidates enumerate fitting rectangles inside the requested semantic Space. A candidate must resolve entirely to walkable cells belonging to that Space.

## 3. Hard rejection rules

Candidates may be rejected for:

- overlap with an already placed prop;
- overlap with reserved use-space;
- door-clearance conflict;
- primary-circulation conflict when forbidden by Prop metadata;
- missing real wall attachment;
- approach/use-space leaving the room;
- approach/use-space being blocked;
- Hero clearance leaving the room or conflicting with a door;
- Hero footprint disconnecting generated Space reachability.

Required props fail compilation if no valid candidate remains. Optional props may be omitted with a warning diagnostic.

The compiler never silently places a required object in an invalid location merely to complete the Floor.

## 4. Use-space reservations

Prop footprints and use-space are separate concepts.

### Wall-prop approach

Wall furniture may declare `approachDepthTiles`.

Example:

```text
north wall
████████ wall
[COFFEE]
[COFFEE]
[APPROACH]
```

The approach cells stay walkable but become unavailable to later furniture/dressing. This encodes rules such as:

- Coffee Machine must remain usable from the room side;
- plants must not be placed directly in front of wall furniture;
- service banks need operating space.

### Hero clearance

Hero machinery may declare `clearanceAroundTiles`.

This reserves composition/gameplay space around the Hero without turning the reserved cells into solid collision. Later support props cannot consume this area accidentally.

## 5. Primary circulation and Heroes

Ordinary props that declare `forbidPrimaryPath` treat the v0.2 circulation skeleton as a hard forbidden zone.

Hero props are exceptional: a Hero may consume part of the provisional primary skeleton **only if the resulting footprint still preserves generated reachability between all semantic Spaces**.

Such candidates receive a score penalty and an explicit explanation (`hero reroutes N primary cells`).

A future navigation refinement may recompute a post-Hero circulation skeleton; v0.3 already prevents a Hero from disconnecting the Floor.

## 6. Soft scoring rules

After hard rejection, valid candidates receive a deterministic score.

Current positive preferences include:

- authored `preferredWall`;
- general wall adjacency;
- corner placement;
- room-center Hero focus;
- explicit `near: [semantic-id]` relationships;
- proximity to already placed Props with semantic tags;
- bathroom-style `preferOppositeDoor`.

The score is only used among valid candidates. It cannot override a hard rule.

A tiny deterministic sub-seed tie-breaker prevents unstable ordering while allowing equivalent layouts to remain reproducible.

## 7. Explainability

Every `PropPlacementDecision` records:

- stable instance ID;
- source request / Prop ID / Space;
- role;
- final rectangle;
- wall side when applicable;
- footprint cells;
- approach cells;
- Hero-clearance cells;
- final score;
- reasons contributing to the score;
- number of valid candidates;
- rejection counts by reason.

This is the basis for future Workbench inspection such as:

> Why is this plant here?

or:

> Why was the north wall rejected for the Coffee Machine?

The current debug view exposes the chosen reason/score as SVG tooltip data.

## 8. TS-01 metadata proving the model

The first reference Level currently exercises:

- Memory Console → real north wall + operating approach;
- Coffee Machine → north wall + operating approach;
- PRIMUS service banks → repeated wall attachment + approach;
- plants → wall/corner preference, but not doorway/path/use-space;
- child bed/storage → wall-biased furniture;
- toilet → hygiene-only + wall adjacency + wall opposite door;
- Transfer Core → centered Hero + reserved clearance + reachability preservation;
- Hologram / Flow → semantic proximity to the Transfer Hero.

## 9. Debug preview

`?levelgen=ts01` now adds:

- `PROPS` toggle;
- `PROP USE-SPACE` toggle;
- role-colored semantic Prop footprints;
- approach / Hero-clearance overlays;
- tooltip with placement score, reasons and valid-candidate count.

The existing drag / wheel / pinch viewport controls remain available.

## 10. Current limitations / next block

v0.3 does not yet:

- place enemies/neutral actors;
- compile patrol-route geometry around Props;
- recompute a final aesthetic circulation hierarchy after Hero placement;
- use actual sprite pixel envelopes/visual overhangs;
- rotate arbitrary floor props;
- execute semantic overrides for locking/moving one Prop in the Workbench;
- emit the generated layout as the live TS-01 Floor.

The next compiler block should be **Encounter / Actor Placement** using the same occupied/reserved/door/navigation model, including patrols and guard clearances. Runtime/Tiled emission should follow once both Props and actors can be represented coherently.
