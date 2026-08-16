# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0.2 navigation + forbidden zones**

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
hero / prop / enemy placement
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

The geometry stage now:

- resolves preferred room/corridor dimensions onto an integer tile grid;
- honors explicit corridor width;
- attaches connected spaces from semantic side/relationship intent;
- slides a child space along a shared edge when necessary to avoid overlap;
- normalizes the result into positive coordinates;
- requires every connection to resolve to a real shared boundary;
- cuts connection apertures out of that boundary;
- reserves explicit door-clearance rectangles on both sides;
- derives **one canonical shared wall graph** from all space boundaries;
- collapses canonical unit edges into wall segments;
- rejects double-wall-by-construction behavior.

The current v0.1 solver deliberately targets connected **tree-like** room graphs. Arbitrary cyclic topology / multi-constraint optimization is not silently approximated; that capability remains future work.

### v0.2 — navigation + forbidden zones — IMPLEMENTED

See `NAVIGATION_AND_FORBIDDEN_ZONES.md`.

The navigation stage now:

- decomposes generated Space geometry into walkable unit cells;
- only connects neighboring Spaces through real compiled apertures;
- validates global generated reachability;
- creates explicit portal cell pairs per doorway/opening;
- reserves a deterministic primary-circulation skeleton before furnishing;
- marks door-clearance and primary-circulation cells as authoring forbidden zones;
- derives wall-adjacent placement slots from the canonical Wall Graph;
- records whether each wall slot is blocked by circulation/clearance;
- exposes a live compiler/debug view via `?levelgen=ts01`.

The live gameplay TS-01 map is still authored separately. Generated geometry/navigation is currently a compiler proof and authoring QA source, not yet the deployed Floor source.

## Why this exists

Manual TS-01 composition proved that individual local fixes do not scale to the roughly 25 authored Floors/levels expected for Numberdroid. Reusable design knowledge needs to become data and constraints:

- general Numberdroid spatial rules;
- world/archetype rules;
- one-level-specific rules;
- stable seeds and sub-seeds;
- prop metadata;
- room/corridor relationships;
- door and access semantics;
- enemy placement;
- triggers and events;
- local overrides and locks.

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
5. **Prop placement** — next: metadata-driven wall/floor attachment, adjacency, forbidden zones, hierarchy and dressing.
6. **Encounter placement** — authored enemy roles/routes/clearances placed from semantic spawn intent.
7. **Trigger/event compilation** — keys, locked doors, scripted pass-bys, one-shot beats, staging events and later world-specific interactions.
8. **Runtime/Tiled emission** — generated debug/live data compatible with the existing runtime boundary.
9. **Overrides / Workbench** — lock/regenerate/move one semantic element without destabilizing unrelated areas.
10. **Natural language front-end** — an LLM translates rough design prompts into LevelSpec; LevelSpec remains canonical.

## Stability rule

A single global PRNG stream is forbidden for authored regeneration.

Every semantic object receives a deterministic sub-seed derived from:

```text
level seed + stable semantic path
```

Example:

```text
TS01
TS01/family
TS01/family/child
TS01/family/child/props
TS01/transfer
TS01/primus
```

Changing/regenerating one child-space should therefore not randomly rearrange Transfer or PRIMUS.

## Editing model

Generated output should remain editable through semantic overrides, not destructive tile painting alone.

Examples:

```yaml
overrides:
  family.bathroom:
    lockGeometry: true

  family.child:
    offset: [-1, 0]

  transfer.hologram:
    preferredWall: west
```

A later visual Workbench may expose these operations through direct manipulation, but the persisted representation should remain declarative and reproducible.

## Event model direction

Triggers and events are first-class authored data even before their complete runtime execution exists.

Examples that the schema must be able to represent:

- access card collected → unlock door;
- enter zone → play one-shot story/staging beat;
- reach viewport/zone → large Bio-Ark animal briefly crosses a visible route;
- interact with console → toggle/open/close another object;
- state flag becomes true → spawn/despawn/move actor;
- optional short stopping/staging beat before control returns.

The compiler must preserve stable IDs and relationships so runtime support can be added incrementally without redesigning the LevelSpec.

## Relationship to Tiled

Tiled remains a useful interchange/debug format and the existing runtime importer remains valid. The Level Compiler should initially emit data compatible with the current Tiled/Floor contracts rather than forcing another renderer or gameplay-state migration.

A future editor may visualize or edit the semantic LevelSpec directly; that does not require abandoning the existing runtime data boundary.
