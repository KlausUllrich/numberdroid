# Asset Family — Transfer System

Campaign Area: `area-01-transfer-ship`

This family groups the visual authoring sources that belong to the same Transfer gameplay/story system and may later need to be animated or revised together.

## Family members

Current / planned components:

- **Transfer Apparatus** — static environmental Hero machine with human receiving bed, Core receiver and empty robot Body Dock;
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

Current state: **APPROVED_SOURCE_ARCHIVED**

The latest approved generated source is visually approved by Klaus and is the visual authority for the current Transfer Apparatus direction.

Archive path:

```text
source/transfer-apparatus__approved-original__2026-08-17.png
```

Verified source metadata:

```text
component:          transfer-apparatus
approval date:      2026-08-17
source type:        ChatGPT image generation
image_gen gen_id:   f86f346b-10b2-4783-a30f-6b08f7239fd0
format:             PNG RGBA, non-interlaced
original size:      1122 × 1402 px
raw bytes:          1,231,884
sha256:             f19ccfba6af722577b6bd8c49a0be15e45473867421e98d22c1fd018de6da794
git blob sha1:      1b5a0fcb39250b7d4fc365bb8bab877ef7e779f1
recipe:             art-source/recipes/transfer-hall/transfer-apparatus/recipe.md
```

### Manual upload verification — 2026-08-17

Klaus manually uploaded the prepared byte-identical approved original to the canonical archive path.

The Agent verified the repository object without downloading/re-serializing the binary through the model:

```text
expected filename:  transfer-apparatus__approved-original__2026-08-17.png
repository size:    1,231,884 bytes
expected size:      1,231,884 bytes
repository blob:    1b5a0fcb39250b7d4fc365bb8bab877ef7e779f1
expected blob:      1b5a0fcb39250b7d4fc365bb8bab877ef7e779f1
verification:       PASS
```

Therefore the archive gate is closed:

```text
USER_UPLOAD_VERIFIED
→ APPROVED_SOURCE_ARCHIVED
```

Production Crop/Fit/downscale work may now proceed from this archived original.

## Future yellow Core source

When the yellow Core receives its own explicit source approval, preserve its large approved original in this **same Asset Family**, normally under `fx/` or `source/` depending on whether it is treated as a primary family component.

Recommended naming:

```text
fx/yellow-core__approved-original__YYYY-MM-DD.png
```

Any animation-tool project files that combine Apparatus + Core later belong under `animation/`, while preserving both approved originals unchanged.
