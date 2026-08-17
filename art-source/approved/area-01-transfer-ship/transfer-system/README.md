# Asset Family — Transfer System

Campaign Area: `area-01-transfer-ship`

Status: **Transfer Apparatus + Yellow Core static presentation LIVE_ACCEPTED**

This family groups source-quality visual components that belong to the same Transfer gameplay/story system and may later need to be animated or revised together.

## Family members

- **Transfer Apparatus** — accepted static environmental Hero machine;
- **Yellow Core** — accepted separate movable identity/Transfer-state visual;
- **Transfer FX** — future movement/synchronization/energy components;
- **Animation sources** — future layered/authoring files for Transfer choreography.

PICO remains a separate Character asset even when staged in the Body Dock.

## Folder structure

```text
transfer-system/
├─ README.md
├─ source/       # immutable approved Apparatus originals
├─ production/   # useful Crop/Fit/runtime-source derivatives
├─ fx/           # Yellow Core + Transfer effect source authorities
└─ animation/    # future animation authoring sources/exports
```

---

## Transfer Apparatus — current source authority

Canonical approved source:

```text
source/transfer-apparatus__approved-original__2026-08-17.png
```

Verified metadata:

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
repository verify:  PASS — byte-identical approved upload
```

The source is immutable authoring authority. Earlier source revisions remain recoverable through Git history.

### Accepted Apparatus runtime

```text
runtime asset:            public/assets/deck/transfer-apparatus.png
runtime canvas:           256 × 384 px
runtime tile canvas:      4 × 6 @ 64 px/tile
runtime content bounds:   x=8, y=29, w=240, h=326
runtime SHA-256:          29128f45d6fc3ce9ae97ed69e0df89565d9e6dbc0fe0961fca971668a9eb3ccd
shadow asset:             public/assets/deck/transfer-apparatus-shadow.png
shadow SHA-256:           2839b266b8181cded0ae4213741ba2124c0fd26bb2e07dd02f81eb22b658b511
art registry:             accepted
live QA:                  PASS
```

### Accepted Apparatus collision

Normal Human and Robot movement must not cross visible machine mass. Transparent outer corner whitespace remains traversable.

```text
authoring representation: 16 × 24 quarter-tile silhouette mask
world canvas:             4 × 6 tiles
compiled collision:       9 rectangles
runtime authority:        propCollisionRegistry.ts
PNG alpha authority:      NO
```

Transfer choreography later moves actors onto/through the machine explicitly by script rather than leaving holes in normal movement collision.

Detailed recipe:

`art-source/recipes/transfer-hall/transfer-apparatus/recipe.md`

---

## Yellow Core — current source authority

Canonical approved source:

```text
fx/yellow-core__approved-original__2026-08-17.png
```

Verified metadata:

```text
component:          yellow-core
approval date:      2026-08-17
source type:        ChatGPT image generation
image_gen gen_id:   aa37c4e9-57ab-4df0-b08a-7279e12f3a9a
format:             PNG RGBA
original size:      1254 × 1254 px
raw bytes:          1,418,808
sha256:             83f647900f0d5fba0dcd0c4f15ce9c705dbee90f4d9a12637129feeb9d64110d
git blob sha1:      f5e0a9f0afe3f966afe3a7b0b08fe7438ac1b297
repository verify:  PASS — byte-identical approved upload
```

### Accepted Yellow Core runtime

```text
runtime asset:            public/assets/deck/yellow-core.png
runtime canvas:           96 × 96 px
runtime content bounds:   x=5, y=4, w=86, h=88
runtime SHA-256:          b300e7d535aee21de75b6276c81b2c4973391d22dcb2bdcf79b50833f9d421ae
representation:           separate transfer-fx sprite
resting position:         centered on Apparatus platform
independent collision:    none
live QA:                  PASS
```

The Core is intentionally not a normal environmental Prop because its ownership/position must later move between Apparatus and bodies.

Detailed recipe:

`art-source/recipes/transfer-hall/yellow-core/recipe.md`

---

## Accepted static composition

```text
Transfer Apparatus FloorProp
+ deterministic Apparatus FloorFX shadow
+ Yellow Core transfer-fx resting sprite
= LIVE_ACCEPTED TS-01 Transfer System static state
```

The Apparatus source does not bake in the Core, and the Yellow Core does not own the Apparatus collision.

---

## Production learnings / authority

The Transfer cycle established several reusable rules now promoted to general workflow documentation:

- source design and runtime scale are separate failure classes;
- physical scale and Hero prominence are separate art-direction questions;
- do not regenerate an approved source merely to resize it;
- shadow should be finalized after useful runtime scale converges;
- raster alpha is not collision authority;
- shaped authored silhouette collision can preserve transparent playable whitespace;
- movable visuals that transition between environment and actors should not be forced into static Prop semantics.

Historical record:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

---

## Future Transfer choreography / FX

The static family components are accepted. Future work may add:

```text
animation/
  human-to-core-to-pico authoring sources
  body-to-body transfer authoring sources

fx/
  synchronization / beam / energy components
  transfer-state overlays if source-quality originals are needed
```

Future animation/FX work must preserve both accepted originals unchanged unless a deliberate source revision is separately approved.

Current project plan places **Gold-Slice visual completion before full Transfer choreography** so complex animation is not polished inside a still-changing sparse room.
