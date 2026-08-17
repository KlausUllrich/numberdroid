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

Current state: **SOURCE_APPROVED / ARCHIVE_PENDING / USER_UPLOAD_REQUIRED**

The latest approved generated source is visually approved by Klaus and is the visual authority for the current Transfer Apparatus direction.

Expected archive target:

```text
source/transfer-apparatus__approved-original__2026-08-17.png
```

Verified source metadata from the approved original:

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

### Archive transport status

The approved original has been prepared byte-identically under the canonical archive filename, but is **not yet committed to this repository path**.

The active GitHub connector exposes no real binary file/path upload action and `docs/agents/BINARY_ASSET_TRANSPORT.md` prohibits inline Base64 through the agent.

Therefore the next required workflow step is the manual handoff defined by:

`docs/art/production/APPROVED_SOURCE_UPLOAD_HANDOFF.md`

State:

```text
LOCAL_BINARY_READY
SOURCE_APPROVED
BINARY_TRANSPORT_BLOCKED
ARCHIVE_PENDING
USER_UPLOAD_REQUIRED
```

After Klaus uploads the exact prepared file and replies `hochgeladen`, the Agent verifies:

- exact target filename;
- raw size `1,231,884` bytes;
- GitHub blob SHA `1b5a0fcb39250b7d4fc365bb8bab877ef7e779f1`.

Only after that verification may this state become:

```text
USER_UPLOAD_VERIFIED
APPROVED_SOURCE_ARCHIVED
```

Do not continue destructive/downscaling production before the archive gate closes unless Klaus explicitly changes the preservation policy.

## Future yellow Core source

When the yellow Core receives its own explicit source approval, preserve its large approved original in this **same Asset Family**, normally under `fx/` or `source/` depending on whether it is treated as a primary family component.

Recommended naming:

```text
fx/yellow-core__approved-original__YYYY-MM-DD.png
```

Any animation-tool project files that combine Apparatus + Core later belong under `animation/`, while preserving both approved originals unchanged.
