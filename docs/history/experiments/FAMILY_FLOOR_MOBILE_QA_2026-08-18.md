# TS-01 Family Floor — Mobile QA 2026-08-18

Status: **CHARACTER GROUNDING ESCALATION / SOURCE-PIXEL PIPELINE IN VALIDATION / SOURCE REMAINS APPROVED**

## QA result

The first live mobile pass confirmed that the differentiated Family floor materially improves room identity, but exposed two runtime-presentation defects:

1. the nine Family panels were not cropped cleanly from the approved 3×3 presentation board;
2. robot grounding became too weak once the floor gained real material texture.

Neither issue requires source-image regeneration.

## Failure classification

### Family floor crop

**Class C — runtime crop / scale / padding.**

The approved 1254×1254 source is a presentation board containing nine panel faces separated by dark gutters. The first materializer incorrectly assumed that `1254 / 3 = 418` represented the actual panel bounds. It therefore downsampled gutter pixels into every 64×64 runtime tile, producing visually heavy black seams in game.

Correct panel-face bounds derived from the approved source:

```text
x = [20, 430, 840]
y = [21, 430, 839]
panel = 395 × 394 px
runtime = 64 × 64 px
```

The source remains immutable. Runtime preparation now crops only these panel faces and then downsamples them deterministically.

## Robot grounding — first correction

The existing player/robot affiliation ellipse primarily communicated ownership colour (green player, red hostile, blue neutral). On the richer Family material it did not provide enough neutral value grounding.

The first correction used:

```text
BODY / AFFILIATION COLOUR
        +
SOFT DARK CONTACT BLOB
        +
EXISTING COLOURED RING / GLOW
```

The added blob was presentation only:

- larger than the previous apparent contact patch;
- darker and softer;
- neutral in value so it works across warm/cool room floors;
- applied consistently to player, hostile/neutral robots and staged actors;
- no change to collision radius, body scale, movement or navigation.

## Robot grounding — second live-QA correction

The next live pass showed that the single neutral blob over-corrected the problem. At gameplay scale it was too broad and too dark, while its uniform shape still left PICO reading slightly above the floor rather than physically touching it.

**Classification: presentation/runtime grounding, not Character source art.**

The durable correction is a shared procedural two-stage `CharacterGrounding` treatment:

```text
BODY SPRITE
    +
SMALL DARK CONTACT POINTS
    +
RESTRAINED SOFT AMBIENT SHADOW
    +
SEPARATE AFFILIATION BORDER / GLOW
```

Implementation rules:

- two compact, high-value-contrast contact points provide the actual visual floor contact;
- the former broad black blob becomes a narrower, much lower-opacity ambient shadow;
- green/red/blue affiliation remains a separate visual language and is not used as physical shadow colour;
- the treatment is procedural CSS and shared by player, hostile/neutral robots and staged actors;
- standard and large bodies scale the same construction rather than using bespoke raster shadows;
- **no eight-direction shadow PNG set is required for any Character**;
- if a future body genuinely needs unusual contact geometry, adjust the shared/body presentation profile rather than authoring eight new shadow images;
- no collision, movement, navigation, body scale or Character source art changes are involved.

## Robot grounding — third live-QA correction: PICO contact calibration

The following PICO live screenshot confirmed that the two-stage idea is correct, but also disproved one assumption from the second pass:

> contact points cannot be fully direction-independent when the accepted turnaround contains different visible foot/wheel projections and transparent padding per view.

Observed result:

- the restrained ambient shadow is now close to the desired intensity but sits slightly too low;
- the two dark contact points sit visibly below PICO instead of touching the visible lower body;
- the error is strongest in the side view, where the two physical contacts overlap substantially in screen space.

**Classification: direction-specific runtime contact placement. Source art remains accepted.**

Correction:

- move the shared ambient-shadow center only a few pixels upward;
- keep the generic procedural shadow construction;
- calibrate PICO contact coordinates for all eight accepted turnaround directions `N | NE | E | SE | S | SW | W | NW`;
- front/back views retain two readable contacts;
- diagonal views use slightly shifted contacts;
- pure side views use a tighter pair and deliberately reduce the opacity of the visually rear/overlapping contact;
- PICO contact ellipses are slightly smaller than the generic robot defaults;
- all calibration is numeric/CSS presentation data — still **zero additional shadow image assets**.

Current implementation scopes the first body-specific calibration to the accepted `directional-pico` asset. SENTRY, MAGNETAR and KRONOS deliberately retain the generic contact profile until live-scale inspection demonstrates that they require their own directional values. Do not pre-author eight shadow variants for bodies that have not failed QA.

## Robot grounding — fourth live-QA correction: separate physical and affiliation layers

The next front-view live screenshot exposed a structural problem rather than another mere percentage-tuning problem:

- the PICO contact cores were no longer visibly readable;
- the ambient shadow still sat at least ~6 px below the desired foot plane;
- physical shadow and affiliation ring were still painted inside the same `::after` box, so moving one concern necessarily disturbed the other.

**Classification: runtime layer-authority error. Source art remains accepted.**

The player grounding architecture was split into independent physical and affiliation concerns. This was necessary, but the following live pass still appeared effectively unchanged. That third consecutive failed positioning iteration triggered escalation rather than another blind numerical adjustment.

## Robot grounding — escalation after three failed live iterations

**Escalation trigger: ACTIVE. No further blind position tuning is permitted.**

The failure pattern showed that changing CSS percentages was not testing the real assumption. The process had no authoritative contact coordinate system and no visual diagnostic before merge. The user was effectively acting as the render debugger after every deployment.

The escalation therefore changed the method from visual guesswork to source-pixel evidence.

### Source diagnostic

A deterministic CI diagnostic now reconstructs the canonical accepted PICO source and inspects all eight **96 × 96** turnaround frames directly.

Canonical source invariants:

```text
strip       768 × 96 px
frame       96 × 96 px
order       N | NE | E | SE | S | SW | W | NW
bytes       14,617
SHA-256     cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9
PNG type    indexed / palette (colour type 3, 8-bit)
```

The first diagnostic attempt itself exposed a tooling assumption: the existing deterministic PNG helper accepted RGB/RGBA but not indexed PNGs. The diagnostic path was therefore extended explicitly for indexed PNG decoding rather than silently switching to an external image tool.

### Diagnostic findings

The accepted PICO source contains **no broad baked shadow below the structural body**. The repeated low blob was therefore a runtime grounding-placement problem, not hidden source art.

Measured structural foot planes:

```text
N   86
NE  86
E   87
SE  87
S   89
SW  92
W   92
NW  95
```

This is the key finding: the visible contact plane varies by **9 source pixels** across the eight authored views. At a 52 px runtime body this is almost 5 px of real visual variation. A single parent-relative contact Y cannot be correct for all directions.

The source analysis also confirms the expected contact topology:

- N / S: two clearly separated contacts;
- E / W: one overlapping screen-space contact region is sufficient;
- diagonals: one primary low contact plus a raised/partially occluded secondary contact;
- transparent padding below the body varies strongly by direction.

### New coordinate authority

`src/meta/characterGroundingProfiles.json` is now the canonical presentation metadata for calibrated actor grounding.

PICO stores source-space values, not ad-hoc runtime percentages:

- authoritative frame size: 96 px;
- measured `footY` for each of eight directions;
- one or two contact centers per direction;
- optional per-contact radius/opacity;
- restrained ambient-shadow dimensions and offset relative to the contacts.

`scripts/generate-character-grounding-css.mjs` converts those source-pixel values into deterministic runtime CSS variables. The generated CSS is committed and CI verifies that it exactly matches the canonical profile.

### Runtime coordinate plane

The player grounding layer now uses the exact rendered directional-frame plane:

```text
standard body: 52 × 52 px player plane = 52 × 52 px sprite plane
large body:    96 × 96 px player plane = 96 × 96 px sprite plane
```

The former independent **58 × 24** shadow box and its additional Y translation are removed from physical grounding. Source coordinates now scale directly onto the same plane as the visible character.

Layer authority remains separate:

```text
PLAYER PLANE
├── physical grounding
│   ├── contact shadow(s)
│   └── restrained ambient shadow
├── directional Character sprite
└── affiliation ring as separate parent presentation FX
```

### Pre-merge diagnostics

CI produces an `actor-grounding-diagnostic` artifact containing:

- numerical source analysis JSON;
- enlarged source-frame diagnostic contact sheet;
- 52 px runtime grounding preview for all eight directions, including a debug version.

These artifacts must be inspected **before** another grounding implementation is accepted for live deployment.

The runtime also supports:

```text
?groundingDebug=1
```

Debug mode exposes the exact runtime frame, measured foot plane, contact centers and build SHA so a live screenshot proves both geometry and deployed revision.

### Durable escalation rule

For Actor/Prop visual positioning:

> **After two failed live visual-position iterations on the same underlying problem, a third parameter-only tweak is prohibited.**

Before continuing, create a deterministic diagnostic that establishes the relevant coordinate authority, source bounds and runtime transform. The diagnostic must be inspectable independently of the final scene.

## Step 11 — process promotion after success

This incident is intentionally **not yet** being turned into the final reusable Actor Grounding process document.

Once PICO passes the next real live QA, the proven workflow must be promoted into a durable production document that can be applied to **all subsequent Numberdroid actors**, including at minimum:

1. canonical turnaround/source validation;
2. source-pixel body/contact analysis;
3. baked-shadow check;
4. one/two-contact topology decision per view;
5. canonical actor grounding profile;
6. deterministic generated runtime data;
7. CI source + runtime diagnostic artifact;
8. exact sprite-plane grounding renderer;
9. debug URL/build identity;
10. desktop/mobile live acceptance;
11. escalation rule for failed iterations.

Only proven steps from the successful PICO result should become binding process authority.

## Acceptance gate

Family Floor / CharacterGrounding remains a runtime candidate until another mobile/desktop live pass confirms:

- no presentation-board gutters survive in the 64×64 floor tiles;
- residual intentional panel seams are readable but not dominant;
- the nine variants still feel coherent when pseudo-randomly distributed;
- PICO visibly touches the floor in all eight views rather than floating above detached dots;
- side views use the correct single/overlapping physical contact read;
- diagonal secondary contacts do not read as separate objects/decals;
- the ambient shadow supports volume without becoming a conspicuous black decal or sitting visibly below the body;
- affiliation colour remains readable as a separate layer;
- `?groundingDebug=1` confirms the live build SHA and contact geometry when needed;
- other robot bodies receive dedicated source-pixel profiles only when their own production pass begins.
