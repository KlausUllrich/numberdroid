# Numberdroid — Procedural Level Compiler

Status: **CURRENT architecture / implementation track — v0 foundation**

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
hero / prop / enemy placement
        ↓
triggers + events + validation
        ↓
existing Tiled/FloorDefinition runtime contract
```

The current React/runtime architecture, `FloorDefinition`, Tiled importer and gameplay systems remain the consuming runtime. The compiler is an **authoring layer in front of them**, not a replacement game architecture.

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

## Current v0 scope

The first implementation block intentionally stops before geometry generation. It establishes:

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

The v0 compiler produces a **semantic compile plan**, not a replacement runtime map yet.

## Planned compile stages

1. **Spec / semantic graph** — current v0 foundation.
2. **Topology solver** — sizes, relative positions, corridor routing and rationality profiles.
3. **Shared wall graph** — derive walls from boundaries so adjacent rooms never create double walls.
4. **Door compiler** — doors cut apertures into real wall segments; leaves/pockets derive from the wall; clearance is reserved on both sides.
5. **Navigation validator** — all required spaces reachable, corridor widths respected, no blocked threshold/hero approach.
6. **Prop placement** — metadata-driven wall/floor attachment, adjacency, forbidden zones, hierarchy and dressing.
7. **Encounter placement** — authored enemy roles/routes/clearances placed from semantic spawn intent.
8. **Trigger/event compilation** — keys, locked doors, scripted pass-bys, one-shot beats, staging events and later world-specific interactions.
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
