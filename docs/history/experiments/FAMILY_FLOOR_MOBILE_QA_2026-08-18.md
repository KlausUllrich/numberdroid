# TS-01 Family Floor — Mobile QA 2026-08-18

Status: **IMPLEMENTATION CORRECTION IN PROGRESS / SOURCE REMAINS APPROVED**

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

## Robot grounding

The existing player/robot affiliation ellipse primarily communicated ownership colour (green player, red hostile, blue neutral). On the richer Family material it did not provide enough neutral value grounding.

Correction principle:

```text
BODY / AFFILIATION COLOUR
        +
SOFT DARK CONTACT BLOB
        +
EXISTING COLOURED RING / GLOW
```

The added blob is presentation only:

- larger than the previous apparent contact patch;
- darker and softer;
- neutral in value so it works across warm/cool room floors;
- applied consistently to player, hostile/neutral robots and staged actors;
- no change to collision radius, body scale, movement or navigation.

## Acceptance gate

Family Floor remains a runtime candidate until another mobile/desktop live pass confirms:

- no presentation-board gutters survive in the 64×64 floor tiles;
- residual intentional panel seams are readable but not dominant;
- the nine variants still feel coherent when pseudo-randomly distributed;
- player and other robots remain clearly grounded without looking as if they float over a black decal;
- affiliation colour remains readable above the neutral blob shadow.
