# Asset Recipe — TS-01 Transfer Apparatus / Core Hero

Status: `DESIGN_REFINEMENT` — current highest-priority Gold Slice Prop/Hero; **no generated source is approved yet**.

Current process authority:

- `docs/agents/PROP_ARTIST_BRIEF.md`
- `docs/art/production/PROP_ASSET_WORKFLOW.md`
- `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`
- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

## Visual / story purpose

The Transfer Apparatus is the primary environmental Hero object in TS-01.

It must make the first Transfer feel:

- desirable;
- precise;
- empowering;
- understandable as a real process rather than generic sci-fi machinery.

The player is still biologically human before this Transfer and leaves the sequence inhabiting PICO. The apparatus therefore has to communicate the central Numberdroid fantasy that a persistent **CORE/person moves into a BODY/SLOT**.

The machine must not read primarily as a generic teleporter, reactor, medical scanner, altar or glowing platform.

The same elegant Transfer technology later participates in the emotional reversal when the parents are reassigned/transferred away, so the machine must not be visually coded as evil or frightening in its initial state.

## Current design learning / QA state

Several concept passes were explored but **none is production-source approved**.

Important learning:

1. circular glowing sci-fi platforms without distinct functional zones are too ambiguous;
2. the form itself must explain **CORE → TRANSFER → BODY/SLOT**;
3. the source must work from the real Numberdroid near-top-down gameplay view rather than isometric/presentation perspective;
4. excessive screens, plants, arches, hazard detail or decorative machinery can obscure the central operation;
5. one generated image must contain one proposal only — no A/B/C comparison sheet;
6. shadow/FloorFX is produced only after the visible Prop source passes approval/production QA.

Klaus preferred the **functional direction of the middle concept** from the latest exploration: a clearer relationship between a Core mechanism and a body-receiving area. That image itself is **not approved production source**.

### Open design hypothesis — resolve before next generation

Klaus proposed going further and making the receiving body relationship explicit by showing **PICO already positioned at/in the receiving part of the apparatus**, so the readable transformation is approximately:

```text
biological player enters
→ Core/Transfer process
→ PICO becomes the occupied player body
→ PICO drives out
```

This is an open design hypothesis, not yet a frozen implementation contract.

Before the next image generation, use the mandatory textual function-to-form gate in `PROP_ASSET_WORKFLOW.md` to resolve:

- whether PICO is visibly docked in the apparatus before activation;
- whether PICO belongs inside the Prop source art or remains a separate Character/entity layered into a clearly shaped empty body slot;
- how a biological human enters/stands in the machine;
- how the Core transfer path is visually readable;
- how PICO exits without the apparatus becoming an implausible full-solid obstacle;
- which parts of the apparatus are permanent Prop art versus runtime Character/Transfer effects.

Do not encode an unresolved answer into the next image prompt.

## Current spatial/runtime baseline

Existing semantic Prop ID:

```text
transfer-core
```

Current Spatial Prop Registry baseline:

```text
attachment:           floor
allowedRotations:     [0]
coarse footprint:     3 × 3 tiles
placement role:       Hero
placement preference: room center
Door Clearance:       forbidden
primary path:         protected
Hero clearance:       1 tile around coarse footprint
```

These values are the current deterministic authoring baseline. They do **not** mean the final visible silhouette or collision must fill the 3×3 anchor.

Final visual bounds, collision parts and placement envelope are authored after the visual source/function is approved and must follow the accepted v0.13.2 Exact-Fit contract.

## Perspective

Use the current Transfer Ship / Transfer Hall gameplay contracts:

- fixed orthographic/top-down world;
- environment Prop must remain compatible with the accepted near-top-down/ND Shallow Top-Down treatment;
- top surfaces/footprint carry the functional read;
- no strong isometric extrusion;
- no converging perspective;
- no large frontal screens or side walls that only read from one camera direction;
- any slight height reveal must remain subordinate to the top-down footprint/function.

The previous concept rounds failed this gate by showing too much vertical/isometric structure.

## Visual language

Use the approved Transfer Ship language rather than generic sci-fi:

- maintained civilian machinery;
- ceramic/light neutral primary construction;
- graphite technical recesses;
- warm amber for CORE/Transfer identity;
- restrained teal/cyan only as system/status support;
- strong CORE/SLOT grammar;
- elegant and competent, not industrial/hazard-heavy;
- no generic military clamps, hazard stripes or dark-machine villain styling.

## Production method / authority split

Current likely starting method:

```text
Primary visible-source method: M1 Direct Generative Source
Optional later cleanup:        deterministic source preparation / controlled local finishing as actually needed
Visual silhouette authority:   approved generated/Artist source
Coarse placement authority:    propRegistry.ts / compiler
Collision authority:           reviewed spatial metadata / propCollisionRegistry when needed
Alpha/canvas authority:        deterministic production preparation after source approval
Shadow authority:              separate FloorFX step after Prop production QA
Scene illumination:            runtime LightOverlay, not baked into the Prop
```

M1 is selected as the likely first visual-source method because this is a unique expressive Hero object with no modular connector topology. Do not invent deterministic `geometry.svg` as fake authority merely to imitate the Wall/Door workflow.

If a later approved silhouette requires exact deterministic correction, add an M2-style mask/controlled step deliberately and document why.

## Source-generation contract

Before any next image call:

1. read the Prop Artist Brief/current Story/Game/Art/Gold-Slice context;
2. present the current **function-to-form philosophy in text**;
3. let Klaus correct/approve the logic;
4. update this recipe if that changes the functional contract;
5. perform the perspective preflight;
6. generate **exactly one** isolated visual proposal.

The generated source must contain:

- the Transfer Apparatus proposal only;
- transparent background when supported;
- no room/floor/wall presentation plate;
- no separate shadow/FloorFX candidate;
- no comparison alternatives;
- no explanatory labels or concept-board UI.

After generation, stop for source QA.

## Production / integration plan after source approval

Only after explicit source approval:

1. normalize/crop/fit the approved alpha-bearing source through the current Prop preparation path where applicable;
2. inspect the actual runtime-size production PNG;
3. author/review visual bounds, collision geometry and placement envelope deliberately;
4. produce the separate grounding shadow/FloorFX asset;
5. register Prop + shadow through `propArtRegistry.ts`;
6. preserve spatial authority in `propRegistry.ts` / `propCollisionRegistry.ts`;
7. run tests/build/art validation;
8. inspect generated TS-01 on desktop + phone;
9. obtain explicit live Art-Director acceptance;
10. update this recipe/status.

No atlas packing is required for the current generated TS-01 integration path unless a later demonstrated production need changes that decision.

## Acceptance questions

The Transfer Apparatus does not pass merely because it looks impressive.

It must answer yes to questions such as:

- Can the player tell this machine **transfers a person/Core into a robot body**?
- Is the source/target/body relationship readable from gameplay view?
- Is it obvious where the player/body relates to the machine?
- Does the operation remain understandable at runtime scale?
- Does the object look empowering/civilian rather than sinister?
- Does it fit the CORE/SLOT visual thesis?
- Does its footprint/collision allow believable approach and exit?
- Is the Transfer Hero clearly stronger than its later Flow/support assets without becoming generic visual noise?
