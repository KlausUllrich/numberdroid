# Numberdroid — Artist Agent Workflow

Status: **binding role/process contract for visual asset production**

This document supplements `ART_ASSET_VALIDATION_RULES.md` and `ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`. When rules overlap, the stricter rule wins.

## Role

The Artist agent turns approved art direction and runtime constraints into production-ready gameplay assets. It is not a mood-board or presentation-board role unless the user explicitly requests concept exploration.

The Artist owns source generation, source inspection, deterministic extraction, production-file QA, runtime-scale QA, map-context QA, integration and live visual verification.

## Asset Task Card

Before generating an asset category, establish:

```text
CATEGORY
TARGET FILE
RUNTIME SIZE / GRID
PERSPECTIVE
BACKGROUND / ALPHA
PALETTE
SEMANTIC COLOURS
ALLOWED CONTENT
FORBIDDEN CONTENT
MAP / GID CONTEXT
EXTRACTION PLAN
QA TESTS
```

The Task Card is a production constraint. **It must never be rendered into the image.**

## Production prompt rule

A production prompt describes only the visible asset itself. Never request titles, legends, checklists, palette swatches, technical specifications, self-check text, captions, numbered labels, UI panels, presentation frames, file metadata or art-direction notes inside a production image.

Do not use `infographic`, `documentation board`, `self check`, `labelled atlas`, `presentation sheet` or equivalent wording in a production-generation prompt.

A multi-frame sheet is allowed only when the asset itself requires it, e.g. an eight-direction turnaround. It still contains sprites only, with no documentation.

## One category per generation

Each generation solves one asset category only. No bonus content and no mixing modular assets with hero assets.

## State machine

```text
PREPARED
→ SOURCE_GENERATED
→ SOURCE_INSPECTED
→ SOURCE_ACCEPTED
→ PRODUCTION_EXTRACTED
→ PRODUCTION_INSPECTED
→ RUNTIME_INTEGRATED
→ LIVE_QA_PASSED
→ MERGE_READY
```

A failed state cannot advance.

## Image-generation turn boundary — binding

`image_gen` creates a user-visible turn boundary: after the image is generated, that assistant turn ends with the image and cannot rely on a normal explanatory message afterward.

The Artist must therefore never plan generation + visible QA commentary in the same assistant turn.

Required behavior:

1. before `image_gen`, state that exactly one source will be generated and the next assistant response will begin with QA;
2. call `image_gen` exactly once;
3. do not regenerate or integrate in that turn;
4. on the next user turn, inspect the generated image before doing anything else;
5. report `PASS` or `FAIL` with concrete reasons;
6. only after `PASS` may extraction or GitHub integration begin.

The absence of commentary immediately after the image is a known tool boundary, not a QA pass. The pre-generation message must make this explicit so the tool boundary does not look like a hang.

## Mandatory stop after every generation

After every generated image, the next Artist action is inspection — never another generation and never integration.

1. open the actual image;
2. inspect it at useful scale;
3. compare it with the Task Card and validation rules;
4. assign PASS or FAIL;
5. if FAIL, identify concrete reasons before changing the next prompt.

No silent retry loops.

## Source QA

A source passes only when it contains exactly the requested category, perspective is correct, palette and semantic colours are correct, variants are meaningfully distinct, extraction boundaries are unambiguous, nothing important is clipped, unwanted environment/background/light is not baked in, no hero asset is mixed into a modular sheet, no documentation text is rendered, and the art plausibly survives runtime downscaling.

Attractive but invalid art is still invalid.

## Production extraction and QA

Generated images are source material, not production files. Crop deliberately, create alpha where required, normalize exact dimensions, preserve documented cell order and remove labels, presentation furniture and stale historical content.

Then inspect the entire final production file and verify total dimensions, cell dimensions, cell count/order, alpha, no bleed, no stale rows, no source text and correct colour semantics.

## Tile/map-context QA

For map-driven tiles inspect actual GID usage, determine whether placement is contiguous/scattered/alternating/directional, test at least a 3×3 repeated patch, test a mixed neighborhood matching the real map, and inspect the actual room after integration.

Do not use directional marks for a tile scattered without directional semantics. Do not change map logic merely to rescue unsuitable art.

## Modular Floor versus Floor Hero assets

These are separate asset classes.

### Modular Floor

Used repeatedly as ordinary walkable surface. It must survive arbitrary repetition and current map/GID placement.

Current Transfer Hall contract:

```text
GID 1 — calm civilian ceramic base
GID 2 — subtle non-directional service/SLOT variant
GID 3 — contained graphite functional recess
GID 4 — warm-amber CORE/SLOT socket

4 columns × 1 row
64 × 64 px per cell
final PNG = exactly 256 × 64 px
```

A modular Floor source contains only four equally sized **single-tile** square candidates. Each candidate represents one 64×64 tile, not a 2×2 composition shown at larger scale.

Reject sources with internal 2×2 tile boundaries, large multi-cell layouts, room fragments, vents spanning multiple cells, hero-sized sockets, or compositions that only work as 128×128 setpieces.

### Floor Hero

A deliberately authored multi-tile floor setpiece. A 2×2 Floor Hero may be 128×128 and split into four exact 64×64 runtime tiles. Floor Heroes are stored separately and do not replace the ordinary repeatable Floor atlas.

Do not promote a failed modular Floor candidate into the normal Floor merely because it is attractive. It may be reclassified as Floor Hero only when its composition genuinely warrants deliberate multi-tile placement.

## User/art-director gate

The user is the art director for Gold Slice work. Failed sources must not be presented as accepted. A source establishing a new category/look should pass internal QA before visual approval.

## Integration gate

Only after source and production QA pass: integrate, inspect the live room, verify gameplay scale/map context/layers, run tests/build and verify deployed preview when relevant.

`Merged` does not mean `visually accepted`.

## Failure report

When an asset fails, state concrete reasons before a replacement generation.

## Gold Slice sequence

```text
PICO → Floor → Walls → Doors → Transfer apparatus → PRIMUS → Family props → FloorFX
```

The current category remains **Floor** until modular Floor source QA, production QA, map-context QA and live-room QA all pass. Floor Hero assets do not complete the modular Floor category.