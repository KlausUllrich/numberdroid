# Numberdroid — LevelSpec / Level Compiler Contract

Status: **CURRENT v0 declarative contract**

This document defines the semantic authoring model consumed by `src/levelgen/`.

The TypeScript definitions are the executable authority. Examples here explain intended use and future compile stages.

## 1. Authoring philosophy

A LevelSpec describes **intent and relationships**, not tile coordinates.

Prefer:

```text
small bathroom adjacent to living room
child room south of living room
3-tile-wide hall east of domestic cluster
Transfer room south of hall
PRIMUS room north-east of hall behind controlled door
hologram in Transfer and close to Transfer Core
```

instead of:

```text
put wall at x=448
put door at x=832
put hologram at tile 11,4
```

Coordinates remain valid as generated output or explicit overrides, not as the default authoring language.

## 2. Rule layers

The intended rule stack is:

```text
GLOBAL NUMBERDROID RULES
  navigation / doors / walls / attachment / readability

WORLD / ARCHETYPE RULES
  Transfer Ship / Bio-Ark / domestic / PRIMUS / etc.

LEVEL-SPECIFIC RULES
  TS-01 story/function/layout constraints

PROP / ACTOR METADATA
  what an individual object requires/prefers/forbids

OVERRIDES / LOCKS
  deliberate local art-director / level-designer edits
```

Hard constraints must never be violated. Soft constraints are scored preferences.

## 3. Spaces

Spaces are semantic nodes and currently have two kinds:

### Room

Examples:

- living room;
- child room;
- bathroom;
- Transfer room;
- PRIMUS allocation room.

A room defines:

- stable id;
- archetype/tags;
- approximate size class and optional tile ranges;
- rationality profile;
- desired relative placement;
- required props / hero content.

### Corridor

Corridors are first-class spaces, not leftover empty strips between rooms.

A corridor defines:

- stable id;
- width constraint in tiles;
- optional length range;
- preferred orientation;
- the spaces it is intended to connect.

Example:

```yaml
id: main-hall
kind: corridor
width:
  min: 2
  preferred: 3
  max: 4
orientation: vertical
```

Corridor width is a gameplay and composition constraint. It must be validated after geometry generation against robot/body clearance.

## 4. Relative placement

Semantic placement relations include:

```text
adjacent
north_of
south_of
east_of
west_of
north_east_of
north_west_of
south_east_of
south_west_of
```

A relation may be hard or soft.

Example:

```yaml
- source: family-child
  relation: south_of
  target: family-living
  strength: preferred
```

## 5. Connections and doors

Connections express traversability between semantic spaces.

Connection kinds:

```text
opening
standard-door
controlled-door
```

A door is not a freely floating prop. In the geometry stage it must be compiled into a real wall segment/shared boundary.

Door rules include:

- width in tiles;
- preferred wall/side;
- minimum clear approach on both sides;
- lock mode;
- key/access identity;
- wall-pocket/retraction requirement.

Example:

```yaml
id: hall-to-primus
from: main-hall
to: primus-allocation
kind: controlled-door
widthTiles: 2
clearanceTiles:
  before: 1.5
  after: 1.5
lock:
  mode: access-key
  keyId: primus-blue
```

Geometry compiler invariant:

> one connection aperture + one shared wall segment; never two overlapping room walls with a door drawn independently on top.

## 6. Shared wall graph

Rooms do not own four independent walls in final geometry.

Planned wall compile stage:

```text
space polygons / occupied cells
        ↓
boundary extraction
        ↓
shared boundary graph
        ↓
single wall segments
        ↓
door apertures / junctions / corners
```

Binding intended invariants:

- adjacent rooms create exactly one shared wall;
- no double walls;
- T-junctions/corners derive from topology;
- doors live inside wall apertures;
- door leaves/pockets align directly with the wall;
- visual fascia and collision core remain separate concerns.

## 7. Prop metadata and placement

Props are registered semantically rather than referenced only by image path/GID.

Metadata can describe:

```text
tags
attachment mode: wall / floor / either
footprint
collision footprint
required room tags
required relationships
preferred relationships
forbidden relationships / exclusion zones
clearance
visual priority / hero-support-dressing role
```

Examples:

### Plant

Hard:

- floor supported;
- not inside wall;
- not inside door clearance;
- not in primary navigation lane;
- not in front of wall furniture.

Soft:

- wall adjacent;
- corner preferred;
- near seating/personal cluster.

### Toilet

Hard:

- inside bathroom/hygiene room;
- wall adjacent;
- not in door clearance.

Soft:

- opposite or far from entrance;
- back against far wall.

### Wall console

Hard:

- attached to valid wall segment;
- wall not occupied by door aperture;
- approach zone clear.

## 8. Hero assets

Hero assets receive stronger placement semantics than ordinary dressing.

Example Transfer Core:

- required in Transfer room;
- owns minimum circular/rectangular gameplay clearance;
- may request local symmetry;
- must remain visible from intended approach;
- support props should cluster around it without stealing entrance clearance.

Hero placement runs before ordinary prop dressing.

## 9. Enemies / actors

Enemy/actor placement is first-class LevelSpec data.

An encounter intent may specify:

- stable encounter id;
- room/space;
- enemy/body archetype;
- behavior family (`neutral`, `guard`, `patrol`, `aggressive`);
- preferred post/edge/route relation;
- required patrol path or generated route intent;
- distance from door/hero/path constraints;
- difficulty/math metadata inherited by the current runtime encounter contract.

Example:

```yaml
id: primus-guard-01
space: primus-allocation
enemyId: sentry
behavior: guard
placement:
  prefer: wall_post
  forbid: door_clearance
```

The compiler must never treat detection radius as encounter radius; the existing physical-collision/scan rules remain runtime authority.

## 10. Pickups / access cards

Access keys/cards are semantic objects with stable IDs.

A locked door references a `keyId`; a key pickup or event grants the same identity.

Validation must fail when:

- a locked door has no key id;
- no reachable grant/source for a required key can exist before the lock, once progression analysis is implemented;
- duplicate key identities conflict unexpectedly.

The v0 semantic validator checks identity/reference validity; progression-order solving comes later.

## 11. Triggers

Triggers define **when** something should happen.

Initial schema supports categories such as:

```text
enter-space
enter-zone
interact
collect
state-change
proximity
timer
```

Each trigger has:

- stable id;
- condition/source;
- `once` semantics;
- one or more referenced event IDs.

Examples:

```yaml
id: unlock-blue-door
kind: collect
sourceId: blue-card
events: [unlock-primus-door]
once: true
```

```yaml
id: bioark-herd-glimpse
kind: enter-zone
sourceId: ridge-view-zone
events: [animal-passby-01]
once: true
```

## 12. Events

Events define **what** happens after a trigger fires.

The v0 schema carries event intent but does not yet implement every runtime executor.

Initial event families:

```text
set-flag
unlock-door
lock-door
spawn-actor
despawn-actor
move-actor
actor-passby
story-beat
```

`actor-passby` is intended for cases such as a large Bio-Ark animal briefly crossing a visible route.

`story-beat` may later carry a short staged pause / camera or control handoff, but the runtime UX rules for blocking player control must be designed explicitly before broad use.

## 13. Deterministic seeds

The compiler derives stable 32-bit sub-seeds from:

```text
level seed + semantic path
```

Do not consume one global random stream in sequence.

Expected behavior:

- same spec + same seed → same semantic compile plan;
- changing one unrelated room should not scramble another room;
- regenerating one dressing scope should use that scope's sub-seed.

## 14. Locks and overrides

Generated elements need stable semantic IDs so they can be locally changed.

Initial override concepts:

```text
lockGeometry
lockPlacement
offsetTiles
preferredSide
preferredWall
sizeOverride
```

Overrides are applied after defaults/rules but before final geometry/placement validation.

A future Workbench should write these semantic overrides rather than permanently severing the generated object from the source LevelSpec.

## 15. Compile diagnostics / explainability

The compiler should eventually explain placement decisions.

Example:

```text
plant_round_01
space: family-living
selected: southwest wall corner

accepted because:
+ wall adjacency
+ near seating cluster

rejected alternatives:
- north wall: memory-console occupancy
- east wall: doorway clearance
```

This is important for rule authoring: when a result is poor, the designer should be able to identify a missing/wrong rule rather than hand-fix twenty-five maps.

## 16. Validation layers

Planned validators:

### Semantic validation — v0

- unique IDs;
- all referenced spaces exist;
- graph reachability;
- corridor widths valid;
- locked doors have access identities;
- referenced prop metadata exists;
- encounter spaces exist;
- triggers reference existing events/source IDs where applicable.

### Geometry validation — next

- no double walls;
- no overlapping invalid room interiors;
- doors embedded in wall segments;
- door clearance both sides;
- corridor width preserved;
- all required paths reachable.

### Placement validation — later

- prop attachment rules;
- no wall-furniture obstruction by plants;
- hero clearance;
- enemy/path/door separation;
- no accidental collision traps.

### Progression/event validation — later

- required key reachable before locked door;
- trigger cycles / impossible conditions;
- one-shot event consistency;
- story/event actors/routes valid.

## 17. First TS-01 target

The first reference spec should encode the current intended topology semantically:

```text
family-living
├── family-child (small, south)
├── family-hygiene (tiny, south/east)
└── main-hall (east)
      ├── primus-allocation (north-east, controlled door)
      └── transfer-room (south)
```

It should also encode:

- Family Table / Memory Console / Coffee Machine;
- child bed / toy storage placeholder needs;
- toilet/hygiene fixture need;
- plants with wall-adjacent rules;
- Transfer Core / Flow / hologram relationship;
- PRIMUS encounters;
- controlled door semantics;
- corridor width.

The current runtime TS-01 remains manually authored until geometry compilation reaches parity and passes live QA.
