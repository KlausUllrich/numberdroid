# Asset Recipe — TS-01 Transfer Apparatus / Core Hero

Status: **`APPROVED_SOURCE_ARCHIVED / PRODUCTION_READY`** — visual source approved by Klaus and the byte-identical high-resolution original has been manually uploaded and verified in the Approved Source Archive.

Current process authority:

- `docs/agents/PROP_ARTIST_BRIEF.md`
- `docs/art/production/PROP_ASSET_WORKFLOW.md`
- `docs/art/production/APPROVED_SOURCE_ARCHIVE.md`
- `docs/art/production/APPROVED_SOURCE_UPLOAD_HANDOFF.md`
- `docs/agents/BINARY_ASSET_TRANSPORT.md`
- `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`
- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Approved-source family manifest:

- `art-source/approved/area-01-transfer-ship/transfer-system/README.md`

---

## Visual / story purpose

The Transfer Apparatus is the primary environmental Hero object in TS-01.

It must make the first Transfer feel:

- desirable;
- precise;
- empowering;
- understandable as a real process rather than generic sci-fi machinery.

The player is still biologically human before this Transfer and leaves the sequence inhabiting PICO. The apparatus therefore communicates the central Numberdroid fantasy that a persistent **CORE/person moves into a BODY/SLOT**.

The machine must not read primarily as a generic teleporter, reactor, medical scanner, altar or glowing platform.

The same elegant Transfer technology later participates in the emotional reversal when the parents are reassigned/transferred away, so the machine must not be visually coded as evil or frightening in its initial state.

---

## Approved function-to-form direction

The apparatus reads as a directed three-stage process:

```text
HUMAN ENTRY / TRANSFER BED
        ↓
CORE RECEIVER / TRANSFER NODE
        ↓
EMPTY PICO BODY DOCK
        ↓
CLEAR DRIVE-OUT DIRECTION
```

### Human entry / Transfer bed

- obvious destination for the still-biological player;
- platform/bed/receiving surface visibly shaped for a human body;
- readable human contour/recess/registration shape;
- no actual biological character baked into the Prop;
- function readable without labels or tiny UI.

### Yellow Core

The persistent person/Core is represented by the established **yellow / warm-amber sphere**.

Binding runtime/source separation:

- the yellow Core is a separate movable Transfer-state visual;
- the static Apparatus owns the receiver/socket/path framing;
- the approved static Apparatus source does **not** permanently bake the yellow Core ball into the machine;
- the Core will receive its own source/approval cycle and belongs to the same `transfer-system` Asset Family.

### PICO Body Dock

- receiving side is an empty robot Body/SLOT dock;
- PICO itself is not baked into the static Prop;
- PICO remains a separate Character/body asset;
- runtime staging can position PICO in the dock before Transfer;
- the dock must remain believable empty and occupied;
- the exit direction must remain physically/visually clear.

---

## Approved generated source

Klaus approved the latest isolated Apparatus source as the visual authority for this revision.

Approved source characteristics:

- human receiving bed/contour reads clearly;
- central Core receiver exists without a permanently baked yellow ball;
- lower Body Dock is empty;
- drive-out direction is clear;
- perspective is sufficiently near-top-down for the intended Numberdroid Prop treatment;
- transparent RGBA source is available.

Approved-source provenance:

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
```

Canonical archive source:

```text
art-source/approved/area-01-transfer-ship/transfer-system/
└─ source/
   └─ transfer-apparatus__approved-original__2026-08-17.png
```

### Archive verification — complete

Klaus manually uploaded the prepared byte-identical source and the Agent verified repository metadata against the prepared original:

```text
filename match:      PASS
repository bytes:    1,231,884
expected bytes:      1,231,884
github blob sha1:    1b5a0fcb39250b7d4fc365bb8bab877ef7e779f1
expected blob sha1:  1b5a0fcb39250b7d4fc365bb8bab877ef7e779f1
verification:        PASS
```

Current state:

```text
SOURCE_APPROVED
USER_UPLOAD_VERIFIED
APPROVED_SOURCE_ARCHIVED
PRODUCTION_READY
```

All subsequent destructive/downscaling work must derive from this archived original; the archive file itself remains immutable.

---

## Asset Family relationship

Campaign Area:

```text
area-01-transfer-ship
```

Asset Family:

```text
transfer-system
```

Family members:

- Transfer Apparatus — primary static Hero Prop;
- yellow Core — separate source-quality movable visual/FX component;
- later Transfer FX;
- later animation-authoring files combining Apparatus/Core when needed.

PICO does **not** belong to this family archive as a source asset merely because it is staged in the dock; PICO has its own Character lifecycle.

---

## Current spatial/runtime baseline

Existing semantic Prop ID:

```text
transfer-core
```

Current executable Spatial Prop Registry on `main` still says:

```text
attachment:           floor
allowedRotations:     [0]
coarse footprint:     3 × 3 tiles      # legacy/provisional
placement role:       Hero
placement preference: room center
Door Clearance:       forbidden
primary path:         protected
Hero clearance:       1 tile around coarse footprint
```

The approved visual source is substantially more elongated than the old 3×3 blockout. Final coarse footprint, visual Exact-Fit bounds and multipart collision must be settled deliberately during production processing.

Do not shrink the source merely to preserve the historical 3×3 blockout.

---

## Perspective

Use the current Transfer Ship / Transfer Hall gameplay contracts:

- fixed orthographic/top-down world;
- environment Prop compatible with the accepted near-top-down/ND Shallow Top-Down treatment;
- top surfaces/footprint carry the functional read;
- no strong isometric extrusion;
- no converging perspective;
- no large frontal screens or side walls that only read from one camera direction;
- slight height reveal remains subordinate to the top-down footprint/function.

The approved source is accepted as sufficiently aligned for this Hero direction; final runtime-size QA still has to confirm that the read survives downscale.

---

## Visual language

Use the approved Transfer Ship language rather than generic sci-fi:

- maintained civilian machinery;
- ceramic/light neutral primary construction;
- graphite technical recesses;
- warm amber/yellow for CORE/Transfer identity;
- restrained teal/cyan only as system/status support;
- strong CORE/SLOT grammar;
- elegant and competent, not industrial/hazard-heavy;
- no generic military clamps, hazard stripes or dark-machine villain styling.

---

## Production method / authority split

```text
Primary visible-source method: M1 Direct Generative Source
Visual silhouette authority:   archived approved generated source above
Approved-source authority:     art-source/approved/.../transfer-system/source/
Coarse placement authority:    propRegistry.ts / compiler
Collision authority:           reviewed spatial metadata / propCollisionRegistry when needed
Alpha/canvas authority:        deterministic production preparation from archived source
Shadow authority:              separate FloorFX step after Prop production QA
PICO/body authority:           separate Character/entity; never baked into static Prop
Core-sphere authority:         separate movable source/FX component in same Asset Family
Scene illumination:            runtime LightOverlay, not baked into the Prop
```

If the approved silhouette later requires exact deterministic correction, add an M2-style mask/controlled step deliberately and document why.

---

## Image-generation trigger contract

This recipe inherits the hard authorization rule from:

- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md`
- `docs/art/production/IMAGE_GENERATION_TURN_CONTRACT.md`

For Prop image generation, the current user message must be exactly the standalone command:

```text
generieren
```

`QA` remains inspection-only.

The Apparatus itself does **not** currently need another image generation because its source is approved and archived. The next separate generated visual expected for this Asset Family is the yellow Core when Klaus explicitly starts that source cycle.

---

## Production / integration plan

The archive gate is closed. Next:

1. derive production Crop/Fit from the archived original;
2. preserve useful processed masters under `art-source/approved/area-01-transfer-ship/transfer-system/production/`;
3. inspect the actual runtime-size production PNG;
4. settle coarse footprint and revalidate TS-01 placement;
5. author/review visual bounds, multipart collision and placement envelope deliberately;
6. produce separate grounding shadow/FloorFX;
7. stage PICO as a separate runtime Character in the receiving dock;
8. create/approve/archive the yellow Core as a separate movable Transfer-state element;
9. register Prop + shadow through `propArtRegistry.ts`;
10. preserve spatial authority in `propRegistry.ts` / `propCollisionRegistry.ts`;
11. run tests/build/art validation;
12. inspect generated TS-01 on desktop + phone;
13. obtain explicit live Art-Director acceptance;
14. update this recipe/status.

No atlas packing is required for the current generated TS-01 integration path unless a later demonstrated production need changes that decision.

---

## Acceptance questions for downstream production

The visual source and archive are approved, but runtime production still must confirm:

- does **human → Core receiver → robot Body Dock** remain readable at gameplay scale?
- is the human entry point obvious from the gameplay camera?
- can the separate yellow Core later move through the system without being visually redundant with baked art?
- does the empty Body Dock clearly fit/stage PICO and allow drive-out?
- does collision keep the intended dock/exit usable?
- does the object remain empowering/civilian rather than sinister?
- does it fit the CORE/SLOT visual thesis?
- does its final footprint fit the Transfer room without sacrificing Hero readability?
