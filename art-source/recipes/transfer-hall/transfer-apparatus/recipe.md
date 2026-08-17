# Asset Recipe — TS-01 Transfer Apparatus / Core Hero

Status: `SOURCE_APPROVED / PRODUCTION_CANDIDATE` — visual source approved by Klaus; deterministic runtime fit and spatial contract are being validated before runtime art registration.

Current process authority:

- `docs/agents/PROP_ARTIST_BRIEF.md`
- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md`
- `docs/art/production/IMAGE_GENERATION_TURN_CONTRACT.md`
- `docs/art/production/PROP_ASSET_WORKFLOW.md`
- `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`
- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

## Visual / story purpose

The Transfer Apparatus is the primary environmental Hero object in TS-01.

It must make the first Transfer feel desirable, precise and empowering while visibly explaining the central Numberdroid fantasy:

```text
BIOLOGICAL PERSON
→ persistent CORE
→ ROBOT BODY / SLOT
```

The machine must not read primarily as a generic teleporter, reactor, medical scanner, altar or glowing platform. The same elegant Transfer technology later participates in the emotional reversal when the parents are reassigned, so the initial machine must not be coded as evil or frightening.

## Approved function-to-form direction

The static apparatus reads as a directed three-stage process:

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
- readable human contour / registration recess;
- no biological character baked into the Prop;
- large-scale form must communicate “the human goes here” without labels.

### Yellow Core

The persistent person/Core is the established yellow / warm-amber sphere.

Binding runtime split:

- the yellow Core sphere is a **separate movable Transfer-state element**;
- the static apparatus owns only the receiver/socket/path framing;
- the production Prop must not permanently bake the movable Core sphere into the machine.

### PICO body dock

Binding runtime split:

- PICO is **not part of the static Prop asset**;
- PICO remains the existing Character/body asset;
- the apparatus provides an empty receiving cradle/dock;
- runtime staging positions PICO in that dock;
- after sync/activation, PICO can drive out through the open south/forward lane.

## Approved visual source

Klaus explicitly accepted the latest source during QA on 2026-08-17.

Image-generation identity:

```text
gen_id: f86f346b-10b2-4783-a30f-6b08f7239fd0
source dimensions: 1122 × 1402 RGBA
source alpha: true transparent background
source contains: static apparatus only; no PICO; no yellow Core sphere
```

QA result:

```text
SOURCE QA: PASS
DESIGN DIRECTION: APPROVED
```

Important source observations:

- human receiving surface remains clearly readable;
- central Core receiver is empty and ready for separate Core FX/entity;
- lower Body Dock is empty and has a visually clear drive-out direction;
- perspective is sufficiently near-top-down for the current Prop class;
- the generated source carries a very low-alpha outer halo, so deterministic alpha cleanup is required before runtime use.

## Deterministic production preparation

Current production candidate was prepared from the approved RGBA source with the existing Prop-source logic reproduced deterministically for this validation pass.

Parameters:

```text
alpha cutoff for meaningful crop: 8 / 255
source meaningful bbox: x 284..839, y 6..1390
source crop safety pad: 8 px
runtime canvas: 192 × 384 px
runtime tile canvas: 3 × 6 at 64 px/tile
runtime margin target: 8 px
resize: aspect-preserving Lanczos
result fitted body: 150 × 368 px
result placement: x 21, y 8
result meaningful alpha bbox (>=8): x 23..169, y 10..374
```

Production-candidate visual bounds in authored 0° tile units:

```ts
visualBoundsTiles: {
  x: 0.359375,
  y: 0.15625,
  w: 2.28125,
  h: 5.6875,
}
```

Current local candidate filename:

```text
transfer-apparatus-production-candidate.png
```

The runtime binary still needs to be committed/registered before integrated live QA; this recipe does not pretend local preparation alone is runtime integration.

## Current size / placement decision

The old `3 × 3` blockout is superseded for this asset revision.

Current production candidate:

```text
coarse footprint: 3 × 6 tiles
allowed rotations: [0]
attachment: floor
placement role: Hero
clearanceAroundTiles: 1
Door Clearance: forbidden
primary path: protected
```

Reasoning:

- the approved source is vertically directed rather than square;
- 3×6 preserves the source proportions and the human → Core → Body sequence;
- with the existing 1-tile Hero clearance it requires a 5×8 reservation;
- the current Transfer Room contract can grow to 12×8, so this remains within the authored TS-01 room envelope.

This size is now being validated through the real compiler rather than treated as a purely visual guess.

## Multipart collision plan

PNG alpha is not collision authority.

The static machine uses authored multipart collision so the lower dock remains usable:

```text
upper cradle: left + right side rails
central Core receiver: solid machine mass
lower dock: left + right side rails
lower center lane: OPEN
south/forward drive-out: OPEN
```

Current authored local collision parts:

```ts
[
  { x: 0.35, y: 0.20, w: 0.55, h: 2.05 },
  { x: 2.10, y: 0.20, w: 0.55, h: 2.05 },
  { x: 0.65, y: 2.25, w: 1.70, h: 1.35 },
  { x: 0.35, y: 3.55, w: 0.60, h: 2.25 },
  { x: 2.05, y: 3.55, w: 0.60, h: 2.25 },
]
```

The lower center gap is deliberately wider than one tile so PICO can be staged in the dock and drive out without the Hero becoming one invisible rectangular blocker.

These collision values remain subject to runtime/live QA after the production image is registered.

## Perspective

Binding source perspective:

- fixed orthographic/top-down world;
- ND-compatible near-top-down Prop treatment;
- top surfaces / footprint carry the function;
- no converging perspective;
- no large frontal faces required for comprehension;
- slight height reveal remains subordinate to the footprint.

## Visual language

- maintained civilian machinery;
- ceramic/light neutral primary construction;
- graphite technical recesses;
- warm amber/yellow for CORE/Transfer identity;
- restrained teal/cyan for system/status support;
- strong CORE/SLOT grammar;
- elegant and competent, not industrial/hazard-heavy;
- no villain-black or military-hazard cliché.

## Production method / authority split

```text
Primary visible-source method: M1 Direct Generative Source
Visual silhouette authority:   approved generated source
Coarse placement authority:    propRegistry.ts / compiler
Collision authority:           propCollisionRegistry.ts
Alpha/canvas authority:        deterministic production preparation
Shadow authority:              separate FloorFX step after Prop production QA
PICO/body authority:           separate Character/entity
Core-sphere authority:         separate movable Transfer-state element
Scene illumination:            runtime LightOverlay, not baked into Prop
```

No deterministic `geometry.svg` is invented for this expressive Hero asset.

## Hard image-generation command gate

For this Prop, `image_gen` is authorized only when the complete trimmed current user message is exactly:

```text
generieren
```

Mentions inside prose do not authorize image generation. Authorization never carries over to a later turn and is consumed after one image call.

`QA` remains inspection-only.

## Next production gates

1. validate the 3×6 + multipart-collision contract through tests/build;
2. commit the runtime production PNG through the approved asset path;
3. run production-file QA on the committed binary;
4. produce a separate grounding shadow/FloorFX asset;
5. register Prop + shadow through `propArtRegistry.ts` as `candidate`;
6. stage PICO separately in the Body Dock when the story/runtime sequence is authored;
7. create the yellow Core sphere separately as its own Transfer-state asset;
8. inspect generated TS-01 on desktop + phone;
9. obtain explicit live Art-Director acceptance;
10. only then promote the Prop to `LIVE_ACCEPTED`.

No atlas packing is required for the current generated TS-01 integration path.

## Acceptance questions for integrated QA

- Is **human → Core → Body Dock** still obvious at runtime scale?
- Is the human entry/registration surface readable?
- Does the empty Core receiver clearly support the separate yellow Core sphere?
- Does the empty Body Dock clearly accept PICO as a separate Character?
- Can PICO physically drive out through the authored open collision lane?
- Does the larger Hero remain comfortably navigable inside the Transfer Room?
- Does the object remain empowering/civilian rather than sinister?
- Does Transfer remain the strongest environmental focal point without overwhelming the room?
