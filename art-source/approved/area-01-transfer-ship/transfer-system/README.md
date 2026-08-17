# Asset Family — Transfer System

Campaign Area: `area-01-transfer-ship`

This family groups the visual authoring sources that belong to the same Transfer gameplay/story system and may later need to be animated or revised together.

## Family members

Current / planned components:

- **Transfer Apparatus** — static environmental Hero machine with Human receiving area, Core platform and robot Body Dock;
- **Yellow Core** — separate movable identity/Transfer-state visual, not baked permanently into the Apparatus;
- **Transfer FX** — later source elements for Core movement / synchronization / energy flow;
- **Animation sources** — later layered/turnaround/source files needed by the animation toolchain.

PICO remains a separate Character asset and is not archived as part of this family merely because it can be staged in the Body Dock.

## Folder structure

```text
transfer-system/
├─ README.md
├─ source/       # immutable approved originals
├─ production/   # crop/fit/runtime-source derivatives
├─ fx/           # Core and related transfer effects
└─ animation/    # later animation authoring sources/exports
```

## Approved source record — Transfer Apparatus

Current source state: **APPROVED_SOURCE_ARCHIVED / CURRENT AUTHORITY**

Klaus approved the revised Hero design after live scale QA. The design keeps the believable PICO-relative scale while using a much broader white/graphite Hero silhouette, amber Transfer energy and restrained cyan system accents. The central Core area is a solid platform intended to receive the separate Yellow Core later.

Canonical archive path:

```text
source/transfer-apparatus__approved-original__2026-08-17.png
```

Verified current source metadata:

```text
component:          transfer-apparatus
approval date:      2026-08-17
source type:        ChatGPT image generation
image_gen gen_id:   533a11b1-0b1d-4a9a-9648-373c6617a847
format:             PNG RGBA, 8-bit, non-interlaced
original size:      1086 × 1448 px
raw bytes:          1,962,107
sha256:             4adecec81c5e241a0952e0ed353836d6776f60960e9c8d1cf6e53727e402812c
git blob sha1:      72a6e775cf5b9ae935e9af68032566a56cff22c1
recipe:             art-source/recipes/transfer-hall/transfer-apparatus/recipe.md
```

### Repository verification — 2026-08-17

Klaus committed and pushed the newly approved source to the canonical archive path. The Agent compared repository metadata against the approved local source:

```text
repository size:    1,962,107 bytes
expected size:      1,962,107 bytes
repository blob:    72a6e775cf5b9ae935e9af68032566a56cff22c1
expected blob:      72a6e775cf5b9ae935e9af68032566a56cff22c1
verification:       PASS
```

The previously approved source was replaced directly at the same path. It remains recoverable in Git history (parent state before commit `a6b53f151ffc2bd5a760dc9100a183b3a5f3033f`). Future approved revisions should normally coexist under distinct archive filenames rather than replace an approved source file.

Therefore the current archive gate is closed:

```text
USER_UPLOAD_VERIFIED
→ APPROVED_SOURCE_ARCHIVED
→ CURRENT_SOURCE_AUTHORITY
```

## Production derivative — Transfer Apparatus

Current production state: **PRODUCTION_BUILT / 4×6 RUNTIME_CANDIDATE / SHADOW+COLLISION LIVE_QA_PENDING**

The runtime candidate and its FloorFX shadow are generated deterministically from the archived authority by:

```text
scripts/materialize-transfer-apparatus.mjs
→ scripts/art/toolkit/prop-source.mjs
→ public/assets/deck/transfer-apparatus.png
→ public/assets/deck/transfer-apparatus-shadow.png
```

The runtime PNG and shadow are build products, not replacements for the large approved source.

### Live QA scale decision — 2026-08-17

The approved Hero redesign was first integrated at `2 × 3` tiles. Live QA found the source design itself successful but the world presentation too small for the Transfer Room's primary focal point. Klaus explicitly approved doubling only the runtime/world scale while keeping the source artwork unchanged.

Verified CI materialization contract after that QA decision:

```text
source validation:       byte size + SHA-256 + 1086×1448 dimensions
alpha cutoff:            4
source alpha crop:       x=10, y=0, w=1065, h=1448
runtime canvas:          256 × 384 px
runtime tile canvas:     4 × 6 tiles @ 64 px/tile
runtime margin:          8 px
runtime content bounds:  x=8, y=29, w=240, h=326
runtime SHA-256:         29128f45d6fc3ce9ae97ed69e0df89565d9e6dbc0fe0961fca971668a9eb3ccd
shadow canvas:           256 × 384 px FloorFX
shadow generation:       source silhouette threshold + soft deterministic blur + 2px/6px offset
shadow SHA-256:          2839b266b8181cded0ae4213741ba2124c0fd26bb2e07dd02f81eb22b658b511
art registry state:      candidate
```

### Live QA collision decision — 2026-08-17

The first 4×6 integration used five broad rectangular collision parts. Live QA found two problems:

1. normal Human/Robot movement could still cross the Human intake and lower dock portions of the visible machine;
2. the broad central AABB unnecessarily blocked transparent floor in the four outer corners (LO / RO / RU / LU).

The corrected contract is:

- normal Human and Robot movement **cannot cross the visible Apparatus body**;
- Transfer choreography later places/moves actors onto the machine explicitly by script rather than relying on holes in ordinary movement collision;
- collision is authored as a deterministic `16 × 24` quarter-tile silhouette mask in `propCollisionRegistry.ts`;
- the mask compacts into nine rectangular runtime collision parts;
- transparent outer corner whitespace remains navigable;
- the mask is authored gameplay geometry, not runtime PNG-alpha collision authority.

Spatial production contract:

- coarse placement footprint remains `4 × 6`;
- Transfer room remains `10 × 8`; the Hero plus one-tile placement clearance fits without changing room geometry;
- visual Exact-Fit follows the 4×6 runtime content bounds;
- runtime collision follows the scripted silhouette rather than the complete 4×6 canvas;
- the `transfer-intro-zone` remains anchored to the `hall-to-transfer` entrance, matching first-view story timing while the Hero occupies the room center.

PR #99 validates the shadow registration and collision semantics, including regression points for the blocked machine centerline and all four navigable outer whitespace corners. Final live Art-Director QA of shadow weight and movement feel remains a separate state.

## Future Yellow Core source

When the Yellow Core receives its own explicit source approval, preserve its large approved original in this **same Asset Family**, normally under `fx/` or `source/` depending on whether it is treated as a primary family component.

Recommended naming:

```text
fx/yellow-core__approved-original__YYYY-MM-DD.png
```

Any animation-tool project files that combine Apparatus + Core later belong under `animation/`, while preserving both approved originals unchanged.
