# Asset Recipe — TS-01 Transfer Apparatus / Core Hero

Status: `DESIGN_REFINEMENT` — current highest-priority Gold Slice Prop/Hero; **no generated source is production-approved yet**.

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

---

## Current approved function-to-form direction

The current design logic is now substantially clearer and should be treated as the basis for the next proposal.

The apparatus must read as a **directed three-stage process**:

```text
HUMAN ENTRY / TRANSFER BED
        ↓
YELLOW CORE / CORE TRANSFER
        ↓
EMPTY PICO BODY DOCK
        ↓
CLEAR DRIVE-OUT DIRECTION
```

### 1. Human entry / Transfer bed

The first station must be an obvious destination for the still-biological player.

Preferred read:

- a clear entry point the player can deliberately move toward;
- a platform / bed / receiving surface that visibly belongs to a human body;
- a readable human contour/recess/registration shape on that surface;
- no actual human character baked into the Prop art;
- the large form should say **“the human goes here”** without requiring labels or tiny UI.

The human contour is a functional registration cue, not decoration.

### 2. Yellow Core

The persistent person/Core is represented by the established **yellow / warm-amber sphere**.

This symbol is important because the same visible ball can later move from robot body to robot body during ordinary Transfers.

The apparatus should therefore contain a clearly readable Core receiver/transfer node between the human station and the body dock.

Runtime authority:

- the **yellow Core sphere is a movable Transfer-state element**, not permanent static machinery;
- the static apparatus may contain the socket/frame/path that makes the sphere's role obvious;
- a visual design proposal may show the sphere to communicate the intended state;
- the final static Prop production asset should not permanently bake a movable Core into the machine if runtime Transfer animation needs the sphere to travel.

### 3. PICO body dock

The receiving side is an **empty Body/SLOT dock** shaped for a robot body.

Binding current decision:

- **PICO itself is not part of the Transfer Apparatus Prop asset**;
- PICO remains the existing separate Character/body asset;
- the apparatus provides only the receiving cradle/dock/alignment structure;
- runtime staging positions PICO in that dock before Transfer;
- after Core sync/activation, PICO can drive out as the newly controlled player body.

The dock must therefore make sense both empty and occupied.

### 4. Exit direction

The receiving dock must have a visually and physically clear direction from which the activated PICO can leave.

Do not surround the receiving body with decorative structure that would make the drive-out path implausible.

---

## Current size direction

The existing `3 × 3` coarse registry footprint is now considered a **provisional legacy baseline and likely too small for the approved functional read**.

The next design proposal may deliberately explore a larger Hero footprint so that all three stages are readable at gameplay scale.

Likely design territory is approximately `4 × 4`, `4 × 5` or another similarly larger directed footprint, but **do not freeze a new numeric footprint before the approved visual/function layout proves what is needed**.

After source approval:

1. determine the smallest believable coarse footprint that preserves the three-stage read;
2. update `propRegistry.ts` deliberately if the current 3×3 contract must change;
3. re-run placement/clearance/room-layout QA;
4. preserve separate visual, collision and Hero-clearance semantics.

Do not shrink the design merely to preserve the old 3×3 blockout.

---

## Current design learning / QA state

Several concept passes were explored. **None is yet production-source approved.**

Important learning:

1. circular glowing sci-fi platforms without distinct functional zones are too ambiguous;
2. the form itself must explain **HUMAN → CORE → BODY/SLOT**;
3. the source must work from the real Numberdroid near-top-down gameplay view rather than isometric/presentation perspective;
4. excessive screens, plants, arches, hazard detail or decorative machinery obscure the central operation;
5. one generated image must contain one proposal only — no A/B/C comparison sheet;
6. shadow/FloorFX is produced only after the visible Prop source passes approval/production QA;
7. a real robot body shown as permanent Prop pixels is wrong — the Body Dock is static, the robot is a Character;
8. the yellow Core sphere is the persistent transferable identity and must be visually legible as such;
9. the previous 3×3 blockout must not constrain the Hero if a larger footprint communicates the operation better.

The most recent single-proposal concept was judged **promising in overall direction but REVISION REQUIRED**. Its strongest element was the readable human receiving surface. Required corrections are now captured in the approved function-to-form direction above.

---

## Current spatial/runtime baseline

Existing semantic Prop ID:

```text
transfer-core
```

Current Spatial Prop Registry still says:

```text
attachment:           floor
allowedRotations:     [0]
coarse footprint:     3 × 3 tiles      # provisional / likely to grow
placement role:       Hero
placement preference: room center
Door Clearance:       forbidden
primary path:         protected
Hero clearance:       1 tile around coarse footprint
```

Until deliberately changed, this remains the executable compiler baseline. It is not a requirement that the next visual proposal stay inside 3×3.

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

Previous concept rounds repeatedly showed too much vertical/isometric structure. Perspective is therefore a mandatory preflight before every new visual proposal.

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
PICO/body authority:           separate Character/entity; never baked into static Prop
Core-sphere authority:         separate movable Transfer-state element when animation requires movement
Scene illumination:            runtime LightOverlay, not baked into the Prop
```

M1 remains the likely first visual-source method because this is a unique expressive Hero object with no modular connector topology. Do not invent deterministic `geometry.svg` as fake authority merely to imitate the Wall/Door workflow.

If a later approved silhouette requires exact deterministic correction, add an M2-style mask/controlled step deliberately and document why.

---

## Image-generation trigger contract

This recipe inherits the binding keyword behavior from `PROP_ASSET_WORKFLOW.md`.

### `QA`

If the user's message contains the explicit trigger word **`QA`**:

- inspect only;
- do not call `image_gen`;
- report PASS / FAIL / REVISION REQUIRED and concrete reasons;
- do not generate a replacement in the same turn.

`QA` has priority over generation. If a message contains both `QA` and `generieren`, do not generate; require a later turn containing `generieren` without `QA`.

### `generieren`

For this Prop workflow, **`image_gen` may be called only when the user's current message explicitly contains the word `generieren`** (case-insensitive).

No synonym or implicit continuation authorizes image generation. In particular, these do not authorize it by themselves:

- `ok` / `ja`;
- `weiter`;
- `mach das`;
- `ändern` / `überarbeiten`;
- `nächste Variante`;
- discussion of what the next image should contain.

Those messages may refine the design or prompt, but generation waits for the literal `generieren` trigger.

One `generieren` trigger authorizes **exactly one image-generation call for exactly one proposal**. The generated image ends that production turn and must be QA'd before another generation.

---

## Source-generation contract

Before any next image call:

1. read the Prop Artist Brief/current Story/Game/Art/Gold-Slice context;
2. ensure the current function-to-form philosophy above still matches the user's latest direction;
3. update this recipe if the functional contract changes;
4. perform the perspective preflight;
5. wait for the explicit user trigger **`generieren`**;
6. generate **exactly one** isolated visual proposal.

The next proposal should communicate:

- obvious human entry/Transfer surface with human contour;
- visual transition toward the yellow Core sphere/socket;
- visual transition onward to an empty robot Body Dock;
- clear drive-out direction from that dock;
- larger Hero scale if needed for readability;
- no actual PICO body baked into the Prop;
- no actual biological character baked into the Prop.

The generated source must contain:

- one Transfer Apparatus proposal only;
- transparent background when supported;
- no room/floor/wall presentation plate;
- no separate shadow/FloorFX candidate;
- no comparison alternatives;
- no explanatory labels or concept-board UI.

After generation, stop. The next production action is source QA.

---

## Production / integration plan after source approval

Only after explicit source approval:

1. normalize/crop/fit the approved alpha-bearing source through the current Prop preparation path where applicable;
2. inspect the actual runtime-size production PNG;
3. settle any required coarse-footprint change and revalidate TS-01 placement;
4. author/review visual bounds, collision geometry and placement envelope deliberately;
5. produce the separate grounding shadow/FloorFX asset;
6. stage PICO as a separate runtime Character in the receiving dock;
7. stage the yellow Core sphere as a separate Transfer-state element when animated movement is required;
8. register Prop + shadow through `propArtRegistry.ts`;
9. preserve spatial authority in `propRegistry.ts` / `propCollisionRegistry.ts`;
10. run tests/build/art validation;
11. inspect generated TS-01 on desktop + phone;
12. obtain explicit live Art-Director acceptance;
13. update this recipe/status.

No atlas packing is required for the current generated TS-01 integration path unless a later demonstrated production need changes that decision.

## Acceptance questions

The Transfer Apparatus does not pass merely because it looks impressive.

It must answer yes to questions such as:

- Can the player read the sequence **human → yellow Core → robot Body Dock**?
- Is the human entry point obvious from the gameplay camera?
- Is the yellow Core visually the same persistent identity that can later transfer between robot bodies?
- Does the empty Body Dock clearly look like a place where PICO can wait and then drive out?
- Does the dock still make sense when PICO is rendered as a separate Character?
- Is the source/target relationship readable at runtime scale?
- Does the object look empowering/civilian rather than sinister?
- Does it fit the CORE/SLOT visual thesis?
- Does its footprint/collision allow believable approach and exit?
- Is the Transfer Hero clearly stronger than its later Flow/support assets without becoming generic visual noise?
