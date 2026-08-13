# Numberdroid — Artist Agent Workflow

Status: **binding role/process contract for visual asset production**

This document supplements `ART_ASSET_VALIDATION_RULES.md`. When rules overlap, the stricter rule wins.

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

A production prompt describes only the visible asset itself.

Never request titles, legends, checklists, palette swatches, technical specifications, self-check text, captions, numbered labels, UI panels, presentation frames, file metadata or art-direction notes inside a production image.

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

## Mandatory stop after every generation

After every generated image:

1. open the actual image;
2. inspect it at useful scale;
3. compare it with the Task Card and validation rules;
4. assign PASS or FAIL;
5. do not generate another image until inspection is complete.

No silent retry loops. If a source fails, identify the concrete reasons before another generation.

## Source QA

A source passes only when:

- it contains exactly the requested category;
- perspective is correct;
- palette and semantic colours are correct;
- variants are required and meaningfully distinct;
- extraction boundaries are unambiguous;
- nothing important is clipped;
- no unwanted floor, wall, lighting or background is baked in;
- no hero asset is mixed into a modular sheet;
- no documentation/presentation text is rendered;
- the art plausibly survives runtime downscaling.

Attractive but invalid art is still invalid.

## Production extraction and QA

Generated images are source material, not production files. Crop deliberately, create alpha where required, normalize exact dimensions, preserve documented cell order and remove all labels, presentation furniture and stale historical content.

Then open the entire final production file and verify total dimensions, cell dimensions, cell count/order, alpha, no bleed, no stale rows, no source text and correct colour semantics.

A renderer ignoring bad rows is not a QA pass.

## Tile/map-context QA

For map-driven tiles:

- inspect actual GID usage;
- determine whether placement is contiguous, scattered, alternating or directional;
- test at least a 3×3 repeated patch;
- test a mixed neighborhood matching the real map;
- inspect the actual room after integration.

Do not use directional marks for a tile scattered without directional semantics. Do not change map logic merely to rescue unsuitable art.

## Transfer Hall Floor contract

Current Floor production starts with exactly four cells:

1. calm civilian ceramic base;
2. subtle **non-directional** service/SLOT variant;
3. contained graphite functional recess;
4. warm-amber CORE/SLOT socket.

Runtime contract:

```text
4 columns × 1 row
64 × 64 px per cell
final PNG = exactly 256 × 64 px
```

A Floor source contains only four equally sized square floor candidates. No arrows, corridor pieces, wall sections, junctions, props, hero machinery, labels or documentation. The assembled floor must read as a broad calm surface rather than a checkerboard of framed plates.

## User/art-director gate

The user is the art director for Gold Slice work. Failed sources must not be presented as accepted. A source that establishes a new category/look should pass internal QA before being shown for visual approval.

## Integration gate

Only after source and production QA pass: integrate, inspect the live room, verify gameplay scale/map context/layers, run tests and build, and verify deployed preview when relevant.

`Merged` does not mean `visually accepted`.

## Failure report

When an asset fails, state concrete reasons before a replacement generation, e.g.:

```text
FAIL — FLOOR SOURCE
- candidates are not equal square cells
- teal dominates rather than signals
- repeated border creates checkerboard
- GID 2 mark is directional but map usage is scattered
```

## Gold Slice sequence

```text
PICO → Floor → Walls → Doors → Transfer apparatus → PRIMUS → Family props → FloorFX
```

The current category remains **Floor** until source QA, production QA, map-context QA and live-room QA all pass.
