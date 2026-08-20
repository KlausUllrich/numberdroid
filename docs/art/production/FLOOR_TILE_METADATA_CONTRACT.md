# Numberdroid — Floor / Tile Semantic Metadata Contract

Status: **BINDING production contract — 2026-08-20 after Main Hall live QA**

This document defines how Numberdroid treats generated or authored modular floor/tile atlases once tile placement has semantic consequences.

It exists because the Main Hall pass proved a durable production lesson:

> **A visually plausible tile atlas is not automatically a semantic tileset.**

Two tiles can look similar while having different connector geometry, wall suitability, route meaning or runtime roles. Automatic placement must therefore consume explicit metadata rather than infer meaning from pixel similarity or raw atlas position.

This contract applies to floor tiles and other modular 2D surface systems with directional/topological meaning. It complements:

- `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `docs/art-production-toolkit/CAPABILITY_INDEX.md`
- the relevant room/category recipe under `art-source/recipes/`

---

## 1. Trigger — when this document becomes mandatory

Read and apply this contract before generating, extracting, integrating or auto-placing a tile family when **any** of the following are true:

- the atlas contains straight route/seam/channel pieces;
- the atlas contains corners, T-junctions, crossings or endcaps;
- the atlas contains arrows or directional marks;
- the atlas contains thresholds / doorway transitions;
- the atlas contains wall-edge / border-specific variants;
- several cells must visually connect across tile boundaries;
- rotation changes the meaning of a tile;
- a tile is only safe beside certain geometry;
- a runtime system will choose tiles automatically from semantic room/corridor data;
- the atlas contains generated alternatives that may not share exact connector positions;
- the source is a presentation-style grid that requires deterministic extraction/cropping before runtime use.

A purely decorative single-surface texture with no directional or placement semantics may use a minimal catalog, but it must still declare its role and runtime eligibility.

---

## 2. Core separation of authority

Keep these authorities distinct:

```text
SOURCE IMAGE
  owns appearance/material proposal

SOURCE EXTRACTION / MATERIALIZER
  owns exact crop, full-bleed cleanup, alpha/background handling,
  deterministic resampling and runtime file production

TILE METADATA
  owns semantic meaning, connectors, rotation policy,
  wall/topology suitability and automatic-placement eligibility

PLACEMENT LOGIC
  owns which semantic request exists at a map cell

LEVEL / ROOM SEMANTICS
  owns whether something is a corridor, room access, wall edge,
  route branch, threshold, service zone, etc.
```

Pixels do **not** silently become topology authority.

---

## 3. Minimum metadata per atlas cell

Every source cell that may reach runtime must have an explicit catalog entry.

Minimum fields/concepts:

```text
index / source cell id
role
runtimeEligible
rotationPolicy
wallSafe / boundary suitability
selectionPriority when alternatives exist
```

Add the following whenever relevant:

```text
connectors / ports
continuityProfile
arrowDirection / directionalMeaning
thresholdSide / boundaryMeaning
topologyClass
placementTags
human-readable production note
```

The exact TypeScript schema may vary by category, but the semantic information must exist somewhere durable and versioned.

### Recommended role vocabulary

Use category-specific roles, but prefer explicit names such as:

```text
base
service
straight
corner
junction-t
junction-cross
terminal
threshold
arrow
registration
wear
special
```

Do not encode meaning only in comments like `tile 14 looks like a corner`.

---

## 4. Connector metadata

For any tile whose graphic crosses an edge, store the source-space connector directions explicitly.

Example:

```text
straight vertical  -> north + south
straight horizontal -> east + west
T missing north    -> east + south + west
corner SW          -> south + west
terminal north wall -> south only
```

If exact port offsets matter, extend connector metadata beyond direction to normalized/local edge coordinates.

Direction alone is sufficient only when all members of the same continuity family use the same edge-port position.

### Continuity family

Line-bearing variants may only alternate automatically if their metadata guarantees compatible edge geometry.

Use a continuity profile/family such as:

```text
hall-traffic-wide
flow-bus-narrow
primus-registration-line
```

Two tiles that merely look similar are not interchangeable.

---

## 5. Rotation policy

Generated atlases often produce redundant or imperfect directional alternatives. Rotation can be safer than trusting every generated direction independently.

A canonical tile may provide all four orientations when:

- rotation preserves material/perspective logic;
- connector positions rotate exactly;
- no non-rotational text/iconography is present;
- runtime tests cover every required orientation.

Example established by Main Hall:

```text
one calibrated T source
→ rotate 0 / 90 / 180 / 270
→ four runtime T directions
```

Keep uncalibrated generated alternates in the approved source archive, but set `runtimeEligible = false` until proven compatible.

---

## 6. Semantic placement rule — topology is not visual guesswork

The placement system must first determine **what the map cell means**, then resolve a compatible tile.

Preferred flow:

```text
actual Level/geometry semantics
→ semantic request / route signature
→ metadata query
→ compatible candidate set
→ deterministic selection / canonical rotation
→ runtime sprite
```

Never use:

```text
coordinate hash
→ random line-bearing tile
→ hope adjacent graphics connect
```

Hash/seed variation is acceptable only inside a metadata-compatible family whose members are guaranteed to join correctly.

---

## 7. Critical Main Hall lesson — access is not route topology

Main Hall live QA established a binding distinction:

> **A doorway into a room is not automatically a branch in the corridor floor language.**

For the TS-01 Hall:

- the Hall circulation graphic is one calm longitudinal spine;
- Family / Transfer / PRIMUS room accesses are material thresholds;
- they do **not** create T-junction floor graphics;
- T/cross/corner route tiles are reserved for actual corridor-to-corridor topology changes;
- a multi-tile door aperture must not generate one visual branch per aperture cell.

This principle generalizes:

```text
ROOM ACCESS       -> threshold / transition semantics
CORRIDOR BRANCH   -> route topology semantics
WALL TERMINATION  -> true terminal/endcap semantics
```

Do not derive route topology solely from the fact that a connection exists.

---

## 8. Thresholds and room transitions

Threshold tiles are special-purpose boundary tiles.

They should be selected from the actual connection/aperture geometry and must not accidentally replace unrelated route semantics.

Rules:

- use the real connection side;
- rotate a canonical threshold only when rotation is visually valid;
- preserve clean door/opening apertures;
- do not invent branches merely to connect the center line to every doorway;
- where a route continues visually toward a room, the preceding route cell should not become a false terminal just because the threshold owns the boundary cell.

---

## 9. Wall / boundary suitability

Tiles with edge rails, hatches, labels, wear streaks or route graphics can look broken when partially covered by wall fascia.

Metadata should therefore state whether a tile is safe beside a solid wall or other boundary.

Typical policy:

```text
calm base         wallSafe = true
threshold         wallSafe = true at matching aperture
route straight    wallSafe = context-dependent
service hatch     wallSafe = false unless authored there
wear overlay      preferably FloorFX / authored use zone
```

Do not use random decorative variants directly under walls just because they are technically walkable floor cells.

---

## 10. Generated atlas source vs runtime tile

Image-generated atlases frequently contain presentation artifacts:

- light or dark gutters;
- rounded standalone-card corners;
- sample borders;
- unequal row/column pitch;
- non-transparent board background;
- tiny framing differences between cells.

These are source-presentation properties, not runtime floor semantics.

The materializer must therefore:

1. preserve the approved source unchanged;
2. validate source bytes/hash/dimensions where the recipe requires it;
3. measure/crop actual cell faces rather than assume `width / columns` when gutters drift;
4. remove presentation-only card/frame background when required;
5. normalize deterministically to the runtime tile size;
6. keep the semantic metadata independent of the crop operation.

A successful crop does not prove a tile is semantically safe to auto-place.

---

## 11. Ground vs FloorFX

Do not overload Ground with every possible detail just because the atlas contains it.

Preferred split:

```text
GROUND
- room material identity
- calm base panels
- topology-critical structural seams where intentionally authored
- thresholds/material transitions

FLOORFX
- wall AO
- use/wear overlays
- service/registration marks when contextual
- arrows/signage when authored by semantics
- Flow/service buses
- contact/grounding treatment
```

The Main Hall pass demonstrated that random service/wear variants in Ground can make a narrow corridor read as patchwork. Reserve contextual detail for authored/semantic FloorFX when that produces a calmer result.

---

## 12. Generation contract for cuttable atlases

Before image generation, define the tile inventory and semantic contract first.

When the output is intended for deterministic cutting:

- use a strict visible rectangular grid;
- all base cells must be equal size;
- exact multipart assets may span only an integer number of cells explicitly reserved by the contract;
- no labels/headings/legends inside production pixels;
- flat orthographic presentation;
- consistent lighting/material scale;
- no perspective board mockup;
- no motif may accidentally cross a cell boundary;
- include all required topology categories or plan canonical rotation explicitly.

The Artist must know **before generation** which cells are base, route, threshold, special, reserve, etc.

---

## 13. Required QA / tests

For a semantic tile family, validate at least:

### Catalog integrity

- every source cell has metadata;
- every index is unique;
- every auto-placed tile is `runtimeEligible`;
- quarantined alternatives cannot leak into automatic placement.

### Directional completeness

- all required straight/corner/T/cross/terminal signatures resolve;
- all required rotations are regression-tested;
- arrows/signage directions map correctly if enabled.

### Continuity

- adjacent line-bearing tiles belong to compatible continuity profiles;
- route connectors match the requested topology;
- no random seam/line jumps.

### Context

- wall-adjacent placement obeys `wallSafe`/boundary rules;
- thresholds correspond to actual connections;
- room accesses do not become fake route branches;
- terminal tiles appear only at genuine visual/topological endings.

### Live QA

Automated semantic correctness is necessary but not sufficient. Inspect the actual deployed level at gameplay scale for:

- visual calm/noise;
- repeated pattern visibility;
- wall overlap;
- false affordances;
- misleading arrows/terminals;
- material transition quality.

---

## 14. Current reference implementation

Main Hall is the first proven implementation of this contract:

- source: `art-source/approved/area-01-transfer-ship/floor-treatment/source/main-hall-floor-atlas-6x6__source-approved__2026-08-20.png`
- materializer: `scripts/materialize-main-hall-floor.mjs`
- metadata: `src/levelgen/mainHallFloorTileMetadata.ts`
- visual policy: `src/levelgen/mainHallFloorVisualPolicy.ts`
- placement: `src/levelgen/mainHallFloorPresentation.ts`
- regression tests: `src/levelgen/mainHallFloorPresentation.test.ts`

The implementation is a reference, not a requirement that every future room use exactly the same schema.

The durable requirement is the **semantic metadata layer between source pixels and automatic placement**.

---

## 15. Artist handoff checklist

Before declaring a new modular floor/tile family ready for integration, answer:

```text
What semantic role does every cell have?
Which cells have edge connectors?
Which connector positions/families are compatible?
Which rotations are legal?
Which cells may auto-place?
Which cells are reserved/quarantined?
Which cells are safe at walls/boundaries?
What is a room access vs a true route branch?
Which details belong in Ground vs FloorFX?
How will the source grid be cropped/materialized deterministically?
Which directional/topology signatures are regression-tested?
What requires live visual QA?
```

If these answers are missing, the atlas is still a **visual source board**, not a production-ready semantic tileset.
