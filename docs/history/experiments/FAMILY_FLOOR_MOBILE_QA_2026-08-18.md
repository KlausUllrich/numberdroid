# TS-01 Family Floor — Mobile QA 2026-08-18

Status: **SECOND GROUNDING PASS IMPLEMENTED / LIVE QA PENDING / SOURCE REMAINS APPROVED**

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
- contact points remain screen-relative because each directional body frame is authored upright in its own sprite cell, so visible foot/wheel contact stays near the lower edge of the frame;
- if a future body genuinely needs unusual contact geometry, adjust the shared/body presentation profile rather than authoring eight new shadow images;
- no collision, movement, navigation, body scale or Character source art changes are involved.

## Acceptance gate

Family Floor remains a runtime candidate until another mobile/desktop live pass confirms:

- no presentation-board gutters survive in the 64×64 floor tiles;
- residual intentional panel seams are readable but not dominant;
- the nine variants still feel coherent when pseudo-randomly distributed;
- player and other robots visibly touch the floor at compact dark contact points;
- the ambient shadow supports volume without becoming a conspicuous black decal;
- affiliation colour remains readable as a separate layer above the neutral grounding treatment.
