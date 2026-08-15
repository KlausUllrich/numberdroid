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

### `QA` is a hard no-generation command

If the user says `QA`, `prüfen`, `check`, or otherwise asks to inspect the existing image, **do not call image generation**. QA means: inspect the currently existing source, report PASS/FAIL, and stop unless the user explicitly requests the next generation step.

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

## Controlled Art Pass — deterministic geometry + generative material

For assets where exact geometry, grid alignment, repeatability, connector positions or collision correspondence matter, **do not ask image generation to invent the production geometry**.

Use this pipeline instead:

```text
SEMANTIC SPEC
→ DETERMINISTIC SVG MASTER
→ RASTER GUIDE AT GENERATION CANVAS SIZE
→ GUIDE QA
→ IMAGE EDIT / MATERIAL PASS
→ ART-PASS QA
→ ORIGINAL MASK RESTORE
→ CONNECTOR-GUARD RESTORE
→ DOWNSCALE TO RUNTIME SIZE
→ PRODUCTION QA
→ LIVE QA
```

This pipeline was proven viable on the Transfer Hall `H_TOP` wall test on 2026-08-14: a flat deterministic horizontal wall guide could be transformed into materially rich graphite/metal wall art. The generated art did not preserve exact dimensions or every alpha pixel, so **the generative output is material source, not authoritative geometry**.

### 1. Semantic spec first

Define every required piece and its exact function before drawing or generating anything. For modular kits, list the required cells by stable name and runtime ID.

### 2. Deterministic SVG is the geometry master

Build the silhouette programmatically as SVG or another exact vector/mask representation.

The master owns:

- exact runtime proportions;
- exact wall/tile/sprite silhouette;
- exact connector positions and widths;
- exact cell boundaries;
- exact reserved/empty cells;
- cap/termination geometry where applicable.

The SVG is **not final art**. It is a technical geometry contract.

### 3. Raster guide must already match the generation canvas

Do not give image generation a small guide and assume it will preserve proportions while freely resizing it.

Render the deterministic master directly to the intended image-generation canvas while preserving exact ratios.

Example for a single 64×64 wall tile with a 10 px wall band:

```text
runtime:      64×64, wall = 10 px
edit canvas: 1024×1024
scale:        16×
guide wall:   160 px
```

For the complete 4×4 Transfer Hall wall atlas:

```text
runtime atlas: 256×256
4× guide:      1024×1024
cell:           256×256
wall:            40 px
```

The generation canvas must preserve the master aspect ratio.

### 4. Show and QA the raster guide before image editing

The raster guide must be visibly inspected before the material pass. Check dimensions, alpha, silhouette, connector edges and reserved cells.

If the guide is wrong, fix the deterministic master. Do not try to repair incorrect geometry with image generation.

### 5. Edit the visible guide; do not text-regenerate the asset

For geometry-critical work, the guide should be made visible/available as the concrete edit target immediately before the image-edit call.

The edit instruction should ask only for surface/material treatment, e.g.:

- graphite/charcoal material;
- believable panel construction;
- restrained edge highlights;
- controlled wear;
- micro-detail that survives downscale.

It must explicitly forbid new objects, labels, presentation boards, alternate layouts and geometry redesign.

If the tool ignores the edit target and creates a new composition, mark the attempt **FAIL — edit target not respected**.

### 6. Art-pass QA is different from production QA

An art pass may PASS as **material proof** even when its exact pixel geometry does not yet pass production rules.

Evaluate separately:

```text
MATERIAL / STYLE PROOF: PASS or FAIL
PRODUCTION GEOMETRY:     PASS or FAIL
```

A material-proof PASS is allowed to continue only because deterministic mask restoration follows.

### 7. Restore the original structural mask

After a successful material pass, resample/crop the generated material into the deterministic guide coordinate system and reapply the original SVG-derived structural mask.

Outside the structural mask: transparent.

Inside the structural mask: generated material is retained.

This removes stray alpha pixels, accidental shape growth and rounded/generated endpoints.

### 8. Connector Guard Zones

For modular assets, define guard zones at every connector edge. Guard zones are deterministic and override the generated output where necessary.

A guard zone ensures adjacent pieces share:

- identical thickness;
- identical square cut at the boundary;
- compatible material/value at the seam;
- no rounded endpoint;
- no bevel narrowing before the edge;
- no accidental alpha gap.

Connector compatibility is more important than preserving a locally attractive generated flourish.

### 9. Optional Effect Envelope — future extension

Do not solve this until the structural pipeline is stable.

A future asset may use two masks:

1. **Structural Mask** — exact collision/visual body that must remain deterministic.
2. **Effect Envelope** — a small controlled area outside the body where contact shadow, AO or another non-structural effect may exist.

This allows the useful subtle inner-edge/contact shadow seen in successful wall concepts without weakening connector precision. The effect envelope must never cross a modular connection boundary or change collision meaning.

### 10. Downscale only after geometry restoration

After mask and connector restoration, downscale to exact runtime dimensions with a deliberate filter and inspect the final pixels at 100%.

Do not treat the large generative image as the runtime asset.

## Controlled Art Pass — DO / DON'T

### DO

- define the semantic kit before generation;
- create exact SVG/mask geometry first;
- render the guide at the actual generation canvas size;
- visibly QA the guide before editing;
- use image generation for material, texture, construction detail and visual richness;
- preserve a permanent geometry master independent of the generated result;
- reapply the structural mask after generation;
- normalize connector guard zones deterministically;
- remove stray alpha pixels outside allowed masks;
- downscale only after geometry is restored;
- QA source, material proof, restored production asset and live integration separately;
- keep accepted geometry templates under `art-source/flow-vorlagen/`.

### DON'T

- do not ask image generation to invent a precision atlas from text;
- do not render specs, labels, legends or self-check instructions into production art;
- do not trust a generated `64×64`, `10 px`, `4×4` claim merely because text in the image says so;
- do not assume an edit target was respected — inspect the actual output;
- do not use a low-resolution guide if the generator will resize it unpredictably;
- do not accept rounded or capped connector edges because they look attractive in isolation;
- do not let generative alpha define production geometry;
- do not crop/mask a failed category or failed composition into something it was never intended to be;
- do not add shadows outside structural geometry until an explicit Effect Envelope has been defined;
- do not call `image_gen` during a QA-only turn;
- do not silently regenerate after failure.

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

The current category advances only after its source QA, production QA, context QA and live-room QA pass. A successful material proof alone does not complete a category.
