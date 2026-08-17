# Asset Recipe — TS-01 Transfer Apparatus / Core Hero

Status: **`PRODUCTION_BUILT / RUNTIME_CANDIDATE / LIVE_QA_PENDING`**

The visual source is approved and byte-identically archived. A deterministic runtime candidate is now built and spatially integrated on PR #95. It remains `candidate`: live visual QA and the separate grounding-shadow pass are still pending.

Current process authority:

- `docs/agents/PROP_ARTIST_BRIEF.md`
- `docs/art/production/PROP_ASSET_WORKFLOW.md`
- `docs/art/production/APPROVED_SOURCE_ARCHIVE.md`
- `docs/art/production/APPROVED_SOURCE_UPLOAD_HANDOFF.md`
- `docs/agents/BINARY_ASSET_TRANSPORT.md`
- `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`
- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Asset Family manifest:

- `art-source/approved/area-01-transfer-ship/transfer-system/README.md`

---

## Visual / story purpose

The Transfer Apparatus is the primary environmental Hero object in TS-01.

It must make the first Transfer feel desirable, precise and empowering while clearly communicating the central Numberdroid fantasy that a persistent **CORE/person moves into a BODY/SLOT**.

The form must not read primarily as a generic teleporter, reactor, medical scanner, altar or glowing platform. The same elegant civilian technology later participates in the emotional reversal when the parents are transferred away, so the initial machine must not be visually coded as evil.

Approved function-to-form sequence:

```text
HUMAN ENTRY / TRANSFER BED
        ↓
CORE RECEIVER / TRANSFER NODE
        ↓
EMPTY PICO BODY DOCK
        ↓
CLEAR SOUTH DRIVE-OUT DIRECTION
```

Binding separations:

- no biological character baked into the Prop;
- yellow Core is a separate future movable source/FX component;
- PICO is a separate Character/body asset;
- static Apparatus owns the Human receiving surface, Core receiver/path and empty Body Dock.

---

## Approved high-resolution source

Canonical archive source:

```text
art-source/approved/area-01-transfer-ship/transfer-system/
└─ source/
   └─ transfer-apparatus__approved-original__2026-08-17.png
```

Verified provenance:

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
archive verification: PASS
```

The archived original is immutable authoring authority. Runtime assets never replace it.

---

## Deterministic production materialization

Runtime candidate is generated from the archived original by:

```text
scripts/materialize-transfer-apparatus.mjs
→ scripts/art/toolkit/prop-source.mjs
→ public/assets/deck/transfer-apparatus.png
```

The materializer validates source byte size, SHA-256 and dimensions before processing, then runs the proven alpha Crop/Fit path.

Binding production settings / CI result:

```text
source dimensions:       1122 × 1402 px
alpha cutoff:            4
source alpha crop:       x=282, y=0, w=559, h=1391
runtime canvas:          192 × 384 px
runtime tile canvas:     3 × 6 tiles @ 64 px/tile
runtime margin:          8 px
runtime content bounds:  x=22, y=8, w=148, h=368
runtime SHA-256:         d51ca49526553386128cdbe13b321a5927c7a244f0019919586b35f669b97a85
art registry status:     candidate
shadow:                  not yet authored
```

The source alpha crop and runtime content bounds are regression-checked by the materializer so source drift fails the build instead of silently changing the asset.

---

## Spatial/runtime contract

Semantic Prop ID:

```text
transfer-core
```

Current production contract on PR #95:

```text
attachment:           floor
allowed rotations:    [0]
coarse footprint:     3 × 6 tiles
placement role:       Hero
room preference:      center
Door Clearance:       forbidden
primary path:         protected
Hero clearance:       1 tile
visual Exact-Fit:     x=0.34375, y=0.125, w=2.3125, h=5.75 tiles
```

The previously accepted TS-01 Transfer room was too short for the larger approved Hero. Placement QA proved the necessary change; only the vertical dimension was enlarged:

```text
transfer-room preferred geometry: 10 × 8 tiles
height range: min 8 / preferred 8 / max 9
```

This is not cosmetic room growth: the 3×6 Hero plus authored Hero clearance could not legally place in the previous 6-tile-high room.

### Multipart collision

The Apparatus is not one solid 3×6 rectangle. Collision is authored as five physical machine regions:

```text
upper left Human-bed rail
upper right Human-bed rail
solid central Core receiver
lower left Body-Dock rail
lower right Body-Dock rail
```

Binding gameplay openings:

- Human receiving center lane is open;
- central Core receiver is solid;
- PICO Body-Dock center is open;
- south drive-out lane remains open.

Regression tests explicitly protect those conditions.

---

## Perspective / visual language

Use the accepted Transfer Ship language:

- fixed orthographic/top-down world;
- ND Shallow Top-Down treatment, top surfaces/footprint dominant;
- no strong isometric extrusion or converging perspective;
- maintained civilian machinery;
- ceramic/light neutral construction;
- graphite technical recesses;
- warm amber/yellow reserved for CORE/Transfer identity;
- restrained teal/cyan as system/status support;
- no military hazard styling.

The approved source is accepted at source level; live runtime QA still decides whether the 192×384 candidate retains adequate read in the real room.

---

## Authority split

```text
Visual silhouette authority:   archived approved source
Production transform:          deterministic materializer + Prop toolkit
Coarse placement authority:    propRegistry.ts / compiler
Collision authority:           propCollisionRegistry.ts
Art registration:              propArtRegistry.ts (`candidate`)
Shadow authority:              separate FloorFX after Production/Live QA
PICO/body authority:           separate Character/entity
Core-sphere authority:         separate movable component in transfer-system
Scene illumination:            runtime LightOverlay
```

No atlas packing is required for this generated TS-01 path.

---

## Image-generation trigger contract

The Apparatus itself does not need another image-generation pass.

For any future Prop image generation, the hard authorization contract remains:

```text
trim(currentUserMessage).toLowerCase() === "generieren"
```

`QA` is inspection-only. One authorized call produces one visual proposal and ends that turn.

The next new generated source expected in this Asset Family is the **yellow Core**, after its own function-to-form discussion and explicit `generieren` command.

---

## Current validation state

PR #95 current production validation:

```text
approved-source archive:                    PASS
binary transport guard:                     PASS
approved-source upload handoff self-test:   PASS
Art Toolkit self-test:                      PASS
Transfer Apparatus production tests:        PASS
full test suite:                            176 / 176 PASS
Production Build:                           PASS
runtime materialization contract:           PASS
live deployed Art-Director QA:              PENDING
shadow / grounding QA:                      PENDING
LIVE_ACCEPTED:                              NO
```

Do not promote `propArtRegistry` status from `candidate` merely because CI is green.

---

## Next steps

1. merge/deploy the current runtime candidate;
2. inspect the generated TS-01 Transfer room at gameplay scale;
3. verify Human entry, Core receiver and empty PICO dock/drive-out remain visually understandable;
4. verify scale/placement/collision in live play;
5. if Production/Live QA passes, create the separate neutral grounding shadow/FloorFX;
6. QA the combined Apparatus + shadow;
7. begin the separate yellow-Core source cycle in the same `transfer-system` Asset Family;
8. only after explicit final live acceptance promote the appropriate art state.

Acceptance questions remain:

- does **human → Core receiver → robot Body Dock** remain readable at gameplay scale?
- is the Human entry point obvious?
- can PICO plausibly be staged in and drive out of the open dock?
- is the Core receiver clearly distinct from the later movable yellow Core?
- does the object remain empowering/civilian rather than sinister?
- does the larger 10×8 Transfer room still preserve the intended Hero focus?
