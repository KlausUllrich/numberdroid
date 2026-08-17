# Asset Recipe — TS-01 Transfer Apparatus

Status: **`SOURCE_ARCHIVED / 4×6 RUNTIME_ACCEPTED / SHADOW_ACCEPTED / COLLISION_ACCEPTED / LIVE_QA_PASS`**

The Transfer Apparatus is the accepted primary environmental Hero object of TS-01. Its static visual, runtime scale, grounding shadow, placement and normal-movement collision have all passed deployed live QA.

Current authority:

- `docs/art/production/PROP_ASSET_WORKFLOW.md`
- `docs/art/production/APPROVED_SOURCE_ARCHIVE.md`
- `docs/art/production/APPROVED_SOURCE_UPLOAD_HANDOFF.md`
- `docs/agents/BINARY_ASSET_TRANSPORT.md`
- `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`
- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
- `docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

Asset Family:

`art-source/approved/area-01-transfer-ship/transfer-system/`

---

## Visual / story purpose

The Apparatus establishes the central Numberdroid fantasy that a persistent identity/Core can move between bodies.

It must make Transfer initially feel:

- desirable;
- precise;
- technically competent;
- empowering rather than sinister;
- important enough that the Transfer Room is compositionally built around it.

Accepted functional sequence:

```text
HUMAN ENTRY / RECEIVING AREA
        ↓
CENTRAL CORE PLATFORM / TRANSFER FOCUS
        ↓
BODY DOCK / OUTPUT
        ↓
CLEAR SOUTH EXIT DIRECTION
```

Binding separations:

- no biological character baked into the Apparatus;
- Yellow Core is a separate accepted movable visual component;
- PICO/other bodies remain separate Character assets;
- static Apparatus owns the receiving structure, resting platform and output/dock machinery.

---

## Accepted high-resolution source

Canonical source:

```text
art-source/approved/area-01-transfer-ship/transfer-system/source/
└─ transfer-apparatus__approved-original__2026-08-17.png
```

Verified current provenance:

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

The earlier approved source remains recoverable through Git history. The source above is the current visual authority.

---

## Accepted design language

Final live-approved direction:

- broad white/ceramic Hero silhouette;
- graphite structural/recess details;
- amber/yellow concentrated around Transfer/Core semantics;
- restrained cyan system/status accents;
- solid central platform for the separate Yellow Core;
- readable Human intake and Body output/dock;
- strong room focal point without generic military/hazard styling;
- fixed orthographic / ND Shallow Top-Down compatibility.

Color semantics learned during iteration:

```text
WHITE / CERAMIC  = maintained civilian high-tech shell
GRAPHITE         = structure / technical depth
AMBER / YELLOW   = Transfer / Core identity / primary energy focus
CYAN / BLUE      = status / scan / stabilization / interface support
```

Too much amber read too strongly as a generic reactor; restrained cyan accents improved the controlled technical read.

---

## Source-design / scale lessons

The production cycle explicitly separated three questions:

1. Is the **functional source design** correct?
2. Is the **physical world scale** believable next to PICO?
3. Does the object have enough **Hero prominence** in the room?

A runtime-scale issue must not automatically trigger source regeneration. Conversely, a physically plausible scale can still reveal that the source silhouette uses its available footprint poorly.

The final design intentionally gains Hero weight through breadth, central focus and visual mass rather than making the Human receiving area implausibly huge.

See the dedicated lessons record for the full iteration history.

---

## Deterministic production materialization

Accepted build path:

```text
scripts/materialize-transfer-apparatus.mjs
→ scripts/art/toolkit/prop-source.mjs
→ public/assets/deck/transfer-apparatus.png
→ public/assets/deck/transfer-apparatus-shadow.png
```

Accepted production contract:

```text
source validation:       byte size + SHA-256 + 1086×1448 dimensions
alpha cutoff:            4
source alpha crop:       x=10, y=0, w=1065, h=1448
runtime canvas:          256 × 384 px
runtime tile canvas:     4 × 6 tiles @ 64 px/tile
runtime margin:          8 px
runtime content bounds:  x=8, y=29, w=240, h=326
runtime SHA-256:         29128f45d6fc3ce9ae97ed69e0df89565d9e6dbc0fe0961fca971668a9eb3ccd
```

The runtime PNG is a reproducible build product, not source authority.

---

## Shadow / grounding authority

The accepted shadow is a separate deterministic FloorFX derivative generated after the runtime scale was settled.

```text
shadow canvas:           256 × 384 px
source:                  accepted runtime silhouette
method:                  thresholded silhouette + restrained deterministic blur
runtime offset:          approximately +2 px X / +6 px Y
shadow SHA-256:          2839b266b8181cded0ae4213741ba2124c0fd26bb2e07dd02f81eb22b658b511
live QA:                 PASS
```

The shadow owns grounding only. It carries no collision and no scene-lighting authority.

---

## Spatial/runtime contract

Semantic Prop ID:

```text
transfer-core
```

Accepted contract:

```text
attachment:           floor
allowed rotations:    [0]
coarse footprint:     4 × 6 tiles
placement role:       Hero
room preference:      center
Door Clearance:       forbidden
primary path:         protected
Hero clearance:       preserved by compiler constraints
visual Exact-Fit:     x=0.125, y=0.453125, w=3.75, h=5.09375 tiles
art registry status:  accepted
```

The Transfer Room remains 10×8 in the generated composition and comfortably supports the accepted 4×6 Hero plus circulation.

---

## Authored silhouette collision

The accepted Apparatus must block normal Human and Robot movement across every physically visible machine region while leaving transparent outer whitespace usable.

A few broad rectangles proved inadequate. The accepted solution is:

```text
collision authoring grid: 16 × 24 quarter-tile occupancy mask
world canvas:             4 × 6 tiles
compiled collision:       9 runtime rectangles
normal Human movement:    blocked across visible machine body
normal Robot movement:    blocked across visible machine body
outer transparent corners: navigable
```

The mask is authored gameplay geometry in `propCollisionRegistry.ts`.

Important rule:

> Raster alpha is not runtime collision authority.

The visual silhouette informed the authored mask, but gameplay collision remains deterministic metadata/code. Future Transfer choreography explicitly places/moves actors onto the machine by script rather than leaving permanent movement holes in ordinary collision.

---

## Yellow Core relationship

The accepted Apparatus contains only the **resting platform**, not the Yellow Core itself.

The Yellow Core is independently accepted and rendered as a separate `transfer-fx` component:

`art-source/recipes/transfer-hall/yellow-core/recipe.md`

Static resting composition:

```text
Transfer Apparatus FloorProp
+ Yellow Core transfer-fx
= accepted TS-01 resting state
```

This separation is intentional preparation for later Transfer movement/animation.

---

## Authority split

```text
Visual source authority:     archived approved Apparatus source
Production transform:        deterministic materializer + Art Toolkit
Coarse placement authority:  propRegistry.ts / compiler
Collision authority:         propCollisionRegistry.ts scripted silhouette
Art registration:            propArtRegistry.ts (`accepted`)
Shadow authority:            separate deterministic FloorFX
Yellow Core authority:       separate accepted movable transfer-fx component
PICO/body authority:         separate Character/entity lifecycle
Scene illumination:          runtime LightOverlay
```

No atlas packing is required for the current generated TS-01 path.

---

## Final live acceptance

The deployed 4×6 Apparatus, shadow and silhouette collision were explicitly reviewed and fully approved by Klaus on 2026-08-17.

Final state:

```text
SOURCE APPROVED
→ USER UPLOAD VERIFIED
→ APPROVED SOURCE ARCHIVED
→ 4×6 RUNTIME MATERIALIZED
→ SHADOW BUILT
→ SCRIPTED SILHOUETTE COLLISION BUILT
→ TEST / BUILD PASS
→ LIVE SCALE QA PASS
→ LIVE SHADOW QA PASS
→ LIVE MOVEMENT/COLLISION QA PASS
→ ART REGISTRY ACCEPTED
```

The static Apparatus is therefore frozen unless a concrete defect or deliberate revision is approved.

---

## Deliberately separate future work

The following do not reopen this accepted static asset:

- Human → Core → PICO choreography;
- body → body Transfer animation;
- Yellow Core motion path;
- beam/synchronization/energy FX;
- temporary scripted actor positioning/collision overrides during Transfer;
- animation authoring sources under `transfer-system/animation/`.

Current project priority is Gold-Slice visual completion before treating those animation tasks as the next major block.
