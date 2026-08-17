# Asset Family — Transfer System

Campaign Area: `area-01-transfer-ship`

This family groups the visual authoring sources that belong to the same Transfer gameplay/story system and may later need to be animated or revised together.

## Family members

Current / planned components:

- **Transfer Apparatus** — static environmental Hero machine with Human receiving area, Core platform and empty robot Body Dock;
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

Current production state: **PRODUCTION_BUILT / RUNTIME_CANDIDATE / LIVE_QA_PENDING**

The runtime candidate is generated deterministically from the archived authority by:

```text
scripts/materialize-transfer-apparatus.mjs
→ scripts/art/toolkit/prop-source.mjs
→ public/assets/deck/transfer-apparatus.png
```

The runtime PNG is a build product, not a replacement for the large approved source.

Verified CI materialization contract:

```text
source validation:       byte size + SHA-256 + 1086×1448 dimensions
alpha cutoff:            4
source alpha crop:       x=10, y=0, w=1065, h=1448
runtime canvas:          128 × 192 px
runtime tile canvas:     2 × 3 tiles @ 64 px/tile
runtime margin:          4 px
runtime content bounds:  x=4, y=14, w=120, h=163
runtime SHA-256:         06cec70609b4eeff6aa319398f20d48eb09d16dd5adbd8492bd3689733c42bbc
art registry state:      candidate
shadow:                  not yet authored; intentionally deferred until live QA
```

Spatial production contract:

- coarse footprint remains `2 × 3`;
- Transfer room remains `10 × 8` for isolated Hero-scale QA;
- visual Exact-Fit follows the broader runtime content bounds;
- collision is multipart rather than one 2×3 block;
- Human receiving center lane remains physically open;
- broad central Transfer/Core platform remains solid;
- PICO Body Dock center and south drive-out lane remain physically open.

CI validation on PR #97 passes the full 176-test suite and Production Build with these contracts. Final live Art-Director QA of the new Hero source remains a separate state.

## Future Yellow Core source

When the Yellow Core receives its own explicit source approval, preserve its large approved original in this **same Asset Family**, normally under `fx/` or `source/` depending on whether it is treated as a primary family component.

Recommended naming:

```text
fx/yellow-core__approved-original__YYYY-MM-DD.png
```

Any animation-tool project files that combine Apparatus + Core later belong under `animation/`, while preserving both approved originals unchanged.
