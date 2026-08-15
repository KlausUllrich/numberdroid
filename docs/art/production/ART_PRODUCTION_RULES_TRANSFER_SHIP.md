# Numberdroid — Transfer Ship Art Production Rules v0.3

Status: implementation rules for the first playable art slice  
Applies to: Intro + Beats 1–5 / Transfer Ship  
Companion document: `ART_DIRECTION_TRANSFER_SHIP.md`

## 1. Camera and perspective are binding

Gameplay uses a fixed orthographic top-down world. The camera may translate and scale, but it does not introduce perspective.

Therefore gameplay tiles MUST NOT contain perspective-dependent geometry.

Allowed in tiles:

- floor seams,
- top faces,
- hatches,
- sockets,
- circular recesses,
- registration marks,
- route lines,
- brackets / SLOT markers,
- flat top-view machinery,
- contact shadows directly under an object,
- material/value variation that still reads from straight above.

Not allowed in gameplay tiles:

- visible vertical wall fronts,
- converging lines,
- foreshortened consoles,
- side views of furniture,
- fake isometric extrusion,
- directional perspective that only works when viewed from one side.

A cinematic/style frame may use perspective. The gameplay atlas may not.

### Height rule

If an element has meaningful height, prefer one of these solutions:

1. separate DOM/entity sprite,
2. separate prop sprite placed in world space,
3. flat top-view footprint in the tile plus an entity above it,
4. subtle contact shadow directly under the prop.

Do not fake the height by drawing a side wall into a floor tile.

## 2. Allegiance is separate from body identity

Robot body geometry and ownership are different concepts.

A SENTRY body must remain a SENTRY body before and after Transfer. Only its allegiance presentation changes.

Binding allegiance palette:

- **GREEN** = player / currently owned collective,
- **RED** = hostile or enemy-controlled body,
- **BLUE** = neutral NPC / civilian / helper / worker,
- **ORANGE** = Kayo,
- **BLACK / CHARCOAL** = PRIMUS / highest-order system presence.

Current implementation applies allegiance as a rendering treatment on top of the neutral body sprite. It is deliberately not baked into each robot PNG.

This enables the important Transfer rule:

```text
red SENTRY body
   ↓ win / Transfer
same SENTRY body
   ↓
green player body
```

No duplicate `sentry-red.png` / `sentry-green.png` asset pair is required.

### Future runtime rule

When story NPCs are introduced, use semantic allegiance classes/state rather than introducing body variants solely for color.

Suggested vocabulary:

```text
player
hostile
npc
kayo
primus
```

Body type answers **what physical machine is this?**  
Allegiance answers **who currently controls / represents it?**

## 3. Atlas generation strategy

The atlas should be deterministic and grid-based rather than AI-generated as a final production texture.

Concept art can be generated freely. Production tiles should be authored or procedurally assembled into exact cells so that:

- every tile is exactly 64 × 64 px,
- tile boundaries are exact,
- no element bleeds accidentally into the neighbor cell,
- the same material grammar can be repeated,
- tile IDs remain stable,
- maps do not silently change appearance when the atlas grows.

Current runtime layout:

```text
Tile size: 64 × 64
Atlas v0.2: 256 × 64
Columns: 4
Rows: 1
```

Current stable tile IDs:

| local ID | GID | Meaning | Rule |
|---:|---:|---|---|
| 0 | 1 | civilian ceramic floor | base walkable surface |
| 1 | 2 | SLOT / service floor | registration / docking grammar |
| 2 | 3 | solid machinery slab | blocked / boundary top surface |
| 3 | 4 | CORE/SLOT socket | service / energy marker |

The existing map data continues to reference GIDs 1–4, so the art can change without touching collision, movement or authored encounter data.

## 4. How to extend the atlas consistently

### Append-only rule

Never reorder existing production tiles once maps reference them.

When more tiles are needed, append new cells after the existing cells. Do not insert a new tile between old IDs.

Bad:

```text
old:  1 floor | 2 slot | 3 wall | 4 core
new:  1 floor | 2 NEW  | 3 slot | 4 wall | 5 core
```

All maps would now display the wrong tile.

Good:

```text
1 floor | 2 slot | 3 wall | 4 core | 5 new | 6 new ...
```

### Fixed column rule

Keep the atlas at four columns for the Transfer Ship unless there is a strong production reason to change it.

The local tile ID is then:

```text
localId = row * 4 + column
GID     = firstGid + localId
```

With `firstGid = 1`:

```text
row 0: GID  1  2  3  4
row 1: GID  5  6  7  8
row 2: GID  9 10 11 12
row 3: GID 13 14 15 16
```

### Proposed semantic rows

The following layout is a guide, not yet all implemented:

```text
ROW 0 — BASE
1 floor
2 service / SLOT
3 machinery / blocked slab
4 CORE socket

ROW 1 — EDGES
5 boundary N
6 boundary E
7 boundary S
8 boundary W

ROW 2 — CORNERS / TRANSITIONS
9 corner NW
10 corner NE
11 corner SE
12 corner SW

ROW 3 — FUNCTIONAL DECOR
13 hatch
14 body parking SLOT
15 PRIMUS data plate
16 controlled warning / lock marker
```

Later rows can add family-zone materials, transfer-specific plates, restricted-zone variants and damaged/alert states.

## 5. Material consistency

Each tile is built from a small material vocabulary.

### Civilian ceramic

- light warm gray / off-white,
- broad calm surfaces,
- subtle seams,
- low noise,
- high maintenance quality.

### Graphite machinery

- dark mineral / graphite,
- used for recesses, machinery and blocked structures,
- concentric top-view forms,
- not a generic black military wall.

### System teal

- normal PRIMUS status,
- guides, registration, alignment,
- used sparingly.

### Warm CORE amber

- personal Core / active socket / Transfer focus,
- not general warning color.

Warnings can use amber/red later, but CORE amber should remain recognizable as a different semantic signal.

## 6. Animation strategy

Animation is separated from the static atlas whenever possible.

### A. Static tile + CSS/state animation

Use for:

- CORE glow,
- status pulse,
- active SLOT,
- route guidance,
- warning state,
- lock/unlock state.

The current implementation exposes each rendered tile's local tile ID as `data-tile-id`. Tile 4 receives a subtle CSS pulse.

Advantages:

- atlas stays compact,
- no duplicate animation frames,
- speed/timing can change without regenerating art,
- `prefers-reduced-motion` can disable motion,
- animation remains independent of camera scale/translation.

### B. Sprite-sheet frames

Use only when the geometry itself changes over time, for example:

- robot wheel/leg cycle,
- mechanical arm motion,
- opening iris,
- rotating tool head.

Recommended format:

```text
one body animation = horizontal strip of equal cells
frame width = canonical sprite cell
frame order documented in manifest
```

The runtime should select frames from time/state; maps should not encode those frames as separate floor tiles.

### C. Transform animation

Use for motion that does not require redrawing the asset:

- robot facing,
- slight chassis bob,
- recoil,
- hover movement,
- indicator pulse,
- Transfer Core motion between source and target.

Use CSS transform or the existing RAF runtime rather than baking orientation into many images.

### D. Staged Transfer animation

Transfer is a state machine, not one long video.

Suggested stages remain:

```text
SCAN
CORE RELEASE
ROUTE / UPLOAD
TARGET SYNC
ACTIVATION
```

The intro biological Transfer can use the same protocol language while having different story staging.

## 7. Ownership-color animation during Transfer

The body should not crossfade from a red drawing to a separately authored green drawing.

Preferred sequence:

1. hostile body's red allegiance treatment powers down,
2. neutral/white body material becomes briefly visible,
3. CORE enters / sync completes,
4. green allegiance treatment powers up,
5. player control begins.

This visually says:

> the machine stayed the same; control changed.

## 8. What is implemented in the first pass

Branch: `agent/transfer-ship-art-direction`

Implemented:

- new orthographic Transfer Ship tile art replacing the generic prototype atlas while preserving GIDs 1–4,
- lighter civilian ceramic + graphite material language,
- CORE & SLOT tile motif,
- no perspective wall faces in gameplay tiles,
- player bodies rendered green,
- hostile bodies rendered red,
- neutral/civilian bodies rendered blue,
- reserved semantic classes for Kayo orange and PRIMUS charcoal,
- tile-ID hooks in `FloorVisual` for state/animation effects,
- subtle CORE/SLOT socket pulse with reduced-motion fallback.

Not implemented yet:

- final TS-01 Transfer Hall map,
- biological child/parent sprites,
- Kayo as a runtime story NPC,
- PRIMUS embodied avatar,
- 16-tile edge/corner expansion,
- final robot redesigns,
- full sprite-sheet locomotion animation.

Those should follow only after the first in-game material/color read is evaluated.

## Directional robot production rule — 8 views

Gameplay robots use **8 authored turnaround directions** rather than rotating one sprite: N, NE, E, SE, S, SW, W, NW.

The floor and tile atlas remain strictly orthographic. Robot entities are allowed to present front/side/back character views because this materially improves silhouette, personality and role readability.

Affiliation is not baked into body identity. The renderer supplies ownership color: player green, opponent red, NPC blue, Kayo orange, PRIMUS black. A transferred body therefore changes affiliation presentation without changing body geometry.


## Mockup Alignment Pass 1 — binding production update

The first in-game review showed that technically correct SVG primitives still read as prototype art. From this pass onward the visible Transfer Hall production assets are raster runtime assets (`PNG`) with subtle material variation; SVG may remain a source/construction format but is not the target presentation format.

### Tile vs. setpiece rule

Use a 64×64 tile for repeatable surfaces, seams, edges, sockets and small functional markers. Use a multi-tile setpiece when the object is a focal architectural object or would physically occupy more than one cell.

Current minimum examples:

- Family table / parent niche: 3×2 cells
- Transfer Cradle: 3×3 cells
- PICO dock: 2×2 cells
- PRIMUS allocation console: 2×2 cells
- Kayo status platform: 2×2 cells
- PRIMUS pylon: 2×2 cells
- machine rack / body-slot bank: 2×2 cells

A setpiece is sliced into exact 64×64 atlas fragments for the renderer, but must read as one coherent object in world space. Collision uses the setpiece footprint rather than one-cell proxy obstacles.

### Directional character sheet naming

`directional-<body>.png` is one horizontal 8-frame strip in this exact order:

`N | NE | E | SE | S | SW | W | NW`

The eight views must be visibly authored, not a rotated source image and not four views duplicated by mirroring. Front views expose face/sensor personality; rear views expose service/rear panels; pure side views have a true profile silhouette; diagonal views carry asymmetric near/far features.

Ownership remains a renderer treatment. Do not bake player green, hostile red or NPC blue into the physical body sheet.


## Slice 0 Foundation — binding room grammar

Slice 0 deliberately fixes the room grammar before the Gold Slice replaces the art with target-quality assets.

### Thin-wall rule

Walls are architectural boundaries, not 64×64 solid slabs. Outer walls render as narrow bands on the outside edge of a floor cell. Interior separators use a narrow centered band and a matching narrow collision rectangle. The player may approach a wall closely, but cannot cross it.

A visible opening MUST be physically traversable. A closed wall MUST block. Door clearance is reserved on both sides of the opening.

### Placement classes

Every prop belongs to one of four placement classes:

1. **floor marking** — painted/inset and never blocks movement;
2. **intentional floor prop / hero setpiece** — may sit in open floor because its function requires it;
3. **wall-mounted prop** — anchored to an upper wall and allowed to overlap downward into the room;
4. **character/entity** — positioned independently from the tile atlas.

Do not scatter wall furniture as isolated floor icons.

### Orthographic overlap rule

Upper walls may carry equipment that overlaps downward into the room. Lower walls remain visually clean; equipment must not overlap upward from the lower wall because that fights player/world readability in this camera.

### Visual footprint vs collision footprint

Visual art, collision and interaction clearance are separate data. Multi-tile art MUST NOT automatically become a full rectangular blocker. Floor pads such as PICO/Kayo platforms are driveable. Hero machinery blocks only its visibly solid mass.

### Shadow and early-light rule

Important props receive controlled contact shadows in the art. Early Transfer Ship rooms use calm, even ambient illumination. Emissive accents are sparse. In Slice 0, the Transfer core is intentionally the strongest local glow; large dynamic lighting effects are reserved for later escalation.

### Preview-flow rule

`?floor=transfer-hall` is an explicit developer/art preview route and intentionally bypasses intro/title/hub. A normal launch without the query parameter must continue through the normal menu flow.

### Slice 0 definition of done

- no visible accidental gaps in the room perimeter;
- outer and interior walls read as thin architectural bands rather than square wall plates;
- visible openings match traversal;
- the two-cell allocation doorway is clear on approach, threshold and exit;
- wall-mounted assets are anchored to the upper wall rather than scattered across the floor;
- lower walls remain free of overlapping furniture;
- floor pads remain driveable unless visibly solid;
- the Transfer Cradle blocks only its solid core;
- room lighting stays quiet, with a restrained Transfer-core emissive;
- normal launch and direct preview routing are both regression-tested.
