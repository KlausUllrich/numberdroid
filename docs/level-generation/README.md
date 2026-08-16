# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.4 actor placement**

This directory owns the design and technical contract for the Numberdroid procedural/declarative level-authoring system.

The goal is **not** a classic random level generator that invents a completely different Floor every time. The goal is a deterministic, inspectable **Level Compiler**:

```text
natural-language design intent
        ↓
LevelSpec / declarative DSL
        ↓
semantic space + relationship graph
        ↓
constraint solving / topology
        ↓
shared wall graph + doors + corridors
        ↓
navigation + forbidden zones
        ↓
hero / prop placement + allowed art rotations
        ↓
enemy / actor placement + authored routes
        ↓
triggers + events + validation
        ↓
existing Tiled/FloorDefinition runtime contract
```

The current React/runtime architecture, `FloorDefinition`, Tiled importer and gameplay systems remain the consuming runtime. The compiler is an **authoring layer in front of them**, not a replacement game architecture.

## Current implementation status

### v0 — semantic foundation — IMPLEMENTED

- typed `LevelSpec`;
- stable seed/sub-seed derivation;
- rooms and corridors as semantic spaces;
- explicit corridor-width constraints;
- room/space connections;
- door / locked-door / key-card intent;
- prop requirements backed by metadata;
- encounter/enemy spawn intent;
- trigger and event declarations;
- locks/overrides;
- semantic validation and reachability checks;
- TS-01 as the first reference spec.

### v0.1 — deterministic geometry + shared walls — IMPLEMENTED

See `GEOMETRY_AND_WALL_GRAPH.md`.

The geometry stage resolves preferred room/corridor dimensions, attaches connected Spaces, avoids overlap, requires real shared boundaries, cuts apertures and derives **one canonical Shared Wall Graph** rather than room-owned duplicate walls.

The current solver deliberately targets connected **tree-like** room graphs. Arbitrary cyclic topology / multi-constraint optimization remains future work rather than being silently approximated.

### v0.2 — navigation + forbidden zones — IMPLEMENTED

See `NAVIGATION_AND_FORBIDDEN_ZONES.md`.

The navigation stage decomposes generated Spaces into walkable cells, connects Spaces only through real apertures, validates reachability, creates portal pairs, reserves provisional primary circulation and derives wall-adjacent attachment slots.

### v0.3 — metadata-driven prop placement — IMPLEMENTED

See `PROP_PLACEMENT.md`.

The placement stage:

- places `hero → support → furniture → dressing`;
- uses real Wall Graph slots for wall props;
- rejects occupied, use-space, doorway and circulation conflicts;
- reserves wall-prop approach space and Hero clearance;
- scores semantic adjacency / wall / corner / center / opposite-door preferences;
- uses deterministic sub-seeds and explainable candidate diagnostics.

### v0.3.1 — clearance + orientation hardening — IMPLEMENTED

Two durable rules were added before actor placement:

1. **Door Clearance lateral width = 2× door aperture width.** The zone gains one half-door-width on each side along the wall while preserving authored before/after depth into each room.
2. **Props declare allowed cardinal art rotations** from `0° / 90° / 180° / 270°`.

Prop wall convention:

```text
0°   north wall, front/access toward south
90°  east wall,  front/access toward west
180° south wall, front/access toward north
270° west wall,  front/access toward east
```

A perspective-sensitive Prop cannot be placed on a wall that requires an unavailable authored rotation. Current non-square floor footprints conservatively use only rotations compatible with the already solved footprint until rotated-footprint enumeration is added.

### v0.4 — encounter / actor placement — IMPLEMENTED

See `ACTOR_PLACEMENT.md`.

The actor stage:

- consumes the already furnished / reserved generated level;
- rejects Prop footprints, Prop use-space, Hero clearance, widened Door Clearance and other actor homes;
- compiles named patrol/pass-by/scripted routes through actual remaining free navigation cells;
- places patrol actors on their route;
- reserves patrol-route cells against unrelated static actor homes;
- applies behavior-aware scoring for neutral / guard / patrol / aggressive roles;
- emits cardinal actor facing and explainable placement diagnostics.

The live gameplay TS-01 map is still authored separately. Generated geometry/navigation/placement is currently a compiler proof and authoring QA source, not yet the deployed Floor source.

## Workbench interaction baseline

The live compiler/debug view is the first shell of the future Level Workbench:

- **pan:** one-finger drag or left-mouse drag;
- **zoom:** two-finger pinch or mouse wheel;
- zoom remains focused on gesture/cursor position;
- `FIT` restores the complete generated topology;
- `+` / `−` provide an accessible fallback;
- viewport state never mutates `LevelSpec`, generated geometry or gameplay-camera state.

The view is available at:

```text
?levelgen=ts01
```

It can now visualize topology, primary circulation, widened Door Clearance, wall slots, generated Props/use-space, Prop rotation in tooltips, generated actors and actor routes.

## Why this exists

Manual TS-01 composition proved that local coordinate fixes do not scale to the roughly 25 authored Floors expected for Numberdroid. Reusable design knowledge therefore becomes data and constraints:

- general Numberdroid spatial rules;
- world/archetype rules;
- one-level-specific rules;
- stable seeds/sub-seeds;
- prop metadata and art orientation;
- room/corridor relationships;
- door/access semantics;
- actor roles/routes;
- triggers/events;
- local overrides/locks.

When a recurring layout defect is discovered, prefer adding a reusable rule or metadata constraint instead of fixing the same class of defect in many authored maps.

## Source-of-truth hierarchy

```text
docs/game-design/LEVEL_DESIGN_RULES.md
    durable spatial/design principles

this directory
    compiler architecture + LevelSpec contracts

level-specific spec under src/levelgen/specs/
    declarative intent for one Floor

src/levelgen/
    deterministic compiler / validators / registries

compiled Tiled/Floor data
    runtime output, not high-level authoring truth
```

## Planned compile stages

1. **Spec / semantic graph** — implemented v0.
2. **Topology / preferred-size geometry** — implemented v0.1 for tree-like graphs.
3. **Shared wall graph + connection apertures** — implemented v0.1.
4. **Navigation / forbidden-zone validation** — implemented v0.2.
5. **Prop placement** — implemented v0.3 + v0.3.1 orientation/clearance hardening.
6. **Encounter / actor placement** — implemented v0.4.
7. **Trigger/event compilation** — next: keys, locked doors, scripted pass-bys, one-shot beats and staged actions.
8. **Runtime/Tiled emission** — generated debug/live data compatible with the existing runtime boundary.
9. **Overrides / Workbench** — select/lock/regenerate/move one semantic element without destabilizing unrelated areas.
10. **Natural-language front-end** — an LLM translates rough design prompts into LevelSpec; LevelSpec remains canonical.

## Stability rule

A single global PRNG stream is forbidden for authored regeneration. Every semantic object receives a deterministic sub-seed from:

```text
level seed + stable semantic path
```

Changing/regenerating one child-space should therefore not randomly rearrange Transfer or PRIMUS.

## Editing model

Generated output should remain editable through semantic overrides rather than destructive tile painting alone.

```yaml
overrides:
  family.bathroom:
    lockGeometry: true
  family.child:
    offset: [-1, 0]
  transfer.hologram:
    preferredWall: west
```

A later Workbench may expose these through direct manipulation, while the persisted representation remains declarative/reproducible.

## Event model direction

Triggers/events are first-class authored data even before complete runtime execution exists. The schema already targets cases such as:

- access card collected → unlock door;
- enter zone → one-shot story/staging beat;
- visible Bio-Ark route → large animal briefly passes by;
- interact with console → toggle another object;
- state flag → spawn/despawn/move actor.

## Relationship to Tiled

Tiled remains a useful interchange/debug format and the existing runtime importer remains valid. The Level Compiler should emit data compatible with current Tiled/Floor contracts rather than forcing another renderer or gameplay-state migration.
