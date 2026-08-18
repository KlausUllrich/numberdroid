# TS-01 Family Floor — Mobile QA 2026-08-18

Status: **PLAYER GROUNDING LAYERS SEPARATED / LIVE QA PENDING / SOURCE REMAINS APPROVED**

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

The player grounding architecture is now explicitly split:

```text
PLAYER BODY
├── ::before  PHYSICAL GROUNDING
│   ├── dark per-direction contact cores
│   └── restrained neutral ambient shadow
└── ::after   AFFILIATION ONLY
    └── green ownership ring / glow
```

Rules introduced by this correction:

- the player `::before` pseudo-layer is neutral and owns only physical grounding;
- the player `::after` pseudo-layer owns only affiliation colour and no longer contains neutral shadow gradients;
- the standard ambient-shadow center moves roughly 7–8 px upward relative to the combined PR #111 implementation;
- contact cores are slightly larger/darker and intentionally overlap the visible foot plane rather than floating below it;
- PICO keeps numeric per-direction contact coordinates; no raster shadow variants are introduced;
- the player establishes its own isolated stacking context so both negative-z presentation layers remain behind the Character but above the world floor;
- hostiles are intentionally not refactored in this bounded player-QA pass because their parent `::before` already owns perception/alert rings; they retain the existing combined treatment until a hostile live-QA failure justifies a dedicated structural change;
- staged actors already have a dedicated shadow element and therefore do not share this coupling problem.

This is the durable rule going forward: **physical grounding and affiliation FX must not share the same positioning authority when they need independent tuning.**

## Acceptance gate

Family Floor / CharacterGrounding remains a runtime candidate until another mobile/desktop live pass confirms:

- no presentation-board gutters survive in the 64×64 floor tiles;
- residual intentional panel seams are readable but not dominant;
- the nine variants still feel coherent when pseudo-randomly distributed;
- PICO visibly touches the floor in all eight views rather than floating above detached dots;
- side-view secondary contact does not read as a separate object/decal;
- the ambient shadow supports volume without becoming a conspicuous black decal or sitting visibly below the body;
- affiliation colour remains readable as a separate layer above the neutral grounding treatment;
- other robot bodies are only given dedicated contact-coordinate profiles when their own live QA requires them.
