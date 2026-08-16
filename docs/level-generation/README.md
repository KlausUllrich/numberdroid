# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.3 metadata-driven prop placement**

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
hero / prop placement
        ↓
enemy / actor placement
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

The navigation stage:

- decomposes generated Spaces into walkable cells;
- connects neighboring Spaces only through real apertures;
- validates generated reachability;
- creates explicit portal pairs;
- reserves a deterministic primary-circulation skeleton;
- marks door-clearance / primary-circulation forbidden cells;
- derives wall-adjacent placement slots from the canonical Wall Graph.

### v0.3 — metadata-driven prop placement — IMPLEMENTED

See `PROP_PLACEMENT.md`.

The placement stage now:

- places `hero → support → furniture → dressing`;
- uses real Wall Graph slots for wall props;
- enumerates valid floor footprints inside semantic Spaces;
- rejects occupied, reserved, doorway and circulation conflicts;
- reserves approach/use-space in front of wall furniture;
- reserves Hero clearance around important machinery;
- lets Heroes consume provisional circulation only when generated reachability survives;
- scores preferred walls, wall adjacency, corners, room-center Hero focus, explicit `near` relationships, semantic tag proximity and opposite-door placement;
- uses deterministic per-instance sub-seeds for stable tie-breaking;
- records reason/score/candidate/rejection data for explainability;
- fails compilation when a required Prop has no valid placement.

The live gameplay TS-01 map is still authored separately. Generated geometry/navigation/placement is currently a compiler proof and authoring QA source, not yet the deployed Floor source.

## Workbench interaction baseline

The live compiler/debug view is the first shell of the future Level Workbench:

- **pan:** one-finger drag or left-mouse drag;
- **zoom:** two-finger pinch or mouse wheel;
- zoom remains focused on gesture/cursor position;
- `FIT` restores the complete generated topology;
- `+` / `−` provide an accessible fallback;
- the map surface owns touch gestures while manipulated.

Viewport state is editor/debug state only. It never mutates `LevelSpec`, generated geometry or gameplay-camera state.

The view is available at:

```text
?levelgen=ts01
```

It can visualize topology, primary circulation, door clearance, wall slots, generated Props and Prop use-space.

## Why this exists

Manual TS-01 composition proved that individual local fixes do not scale to the roughly 25 authored Floors/levels expected for Numberdroid. Reusable design knowledge needs to become data and constraints:

- general Numberdroid spatial rules;
- world/archetype rules;
- one-level-specific rules;
- stable seeds/sub-seeds;
- prop metadata;
- room/corridor relationships;
- door/access semantics;
- enemy placement;
- triggers/events;
- local overrides/locks.

When a recurring layout defect is discovered, prefer adding a reusable rule or metadata constraint instead of fixing the same class of defect in many authored maps.

## Source-of-truth hierarchy

```text
docs/game-design/LEVEL_DESIGN_RULES.md
    durable spatial/design principles

this directory
    compiler architecture + LevelSpec contract

level-specific spec under src/levelgen/specs/
    declarative intent for one Floor

src/levelgen/
    deterministic compiler / validators / metadata registries

compiled Tiled/Floor data
    runtime output, not the high-level authoring truth
```

## Planned compile stages

1. **Spec / semantic graph** — implemented v0.
2. **Topology / preferred-size geometry** — implemented v0.1 for tree-like graphs.
3. **Shared wall graph + connection apertures** — implemented v0.1.
4. **Navigation / forbidden-zone validation** — implemented v0.2.
5. **Prop placement** — implemented v0.3.
6. **Encounter / actor placement** — next: enemies, neutral workers, guards, patrols, spawn/home positions and route geometry using the same reservations.
7. **Trigger/event compilation** — keys, locked doors, scripted pass-bys, one-shot beats and staging events.
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
