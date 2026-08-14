---
name: numberdroid-artist
description: Deterministic-to-generative production workflow for Numberdroid gameplay art. Use for tiles, walls, props, hero assets, directional characters, atlas extraction, image-generation QA, and live visual integration.
---

# Numberdroid Artist Skill

Use this skill whenever producing or integrating visual gameplay assets for Numberdroid.

Read first:

1. `ARTIST_AGENT_WORKFLOW.md`
2. `ART_ASSET_VALIDATION_RULES.md`
3. `ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
4. category-specific contract, e.g. `TRANSFER_HALL_WALL_KIT.md`

## Core principle

**Generative art may own material appearance. It does not own production geometry.**

For geometry-critical assets:

```text
semantic spec
→ deterministic SVG/mask master
→ raster guide at generation canvas size
→ guide QA
→ image edit for material only
→ material/style QA
→ restore original structural mask
→ restore connector guard zones
→ downscale to runtime size
→ production QA
→ live QA
```

## Mandatory state discipline

Never skip states:

```text
PREPARED
→ GUIDE_READY
→ GUIDE_QA_PASSED
→ ART_PASS_GENERATED
→ ART_PASS_QA_PASSED
→ GEOMETRY_RESTORED
→ PRODUCTION_QA_PASSED
→ RUNTIME_INTEGRATED
→ LIVE_QA_PASSED
```

A failure cannot silently advance.

## QA command rule

If the user says `QA`, `prüfen`, `check`, or asks to inspect an existing image:

- do NOT call image generation;
- inspect the current asset;
- report PASS/FAIL and concrete reasons;
- stop unless the user explicitly asks for the next production step.

## Image-generation turn boundary

Before an image-generation call, tell the user that exactly one source/edit will be generated and the next assistant response will begin with QA.

After the image appears, do not silently regenerate or integrate it.

## Controlled image-edit workflow

### 1. Define geometry first

Create the exact runtime silhouette/grid/connectors as SVG or equivalent deterministic mask.

The deterministic master owns:

- cell size;
- silhouette;
- connector width/position;
- reserved cells;
- collision-corresponding visible geometry;
- cap/termination shape.

### 2. Rasterize to the actual generation canvas

Do not feed a small guide and expect image generation to preserve proportions during enlargement.

Example:

```text
runtime tile: 64×64
runtime wall band: 10 px
edit canvas: 1024×1024
scale: 16×
edit-guide wall band: 160 px
```

For a 256×256 runtime atlas, a 4× guide is 1024×1024.

### 3. Show and QA the guide

Before image editing, visibly inspect:

- exact dimensions;
- alpha;
- geometry;
- connector edges;
- reserved cells;
- correct category.

### 4. Edit, do not regenerate the layout

The edit prompt asks only for material/surface treatment:

- graphite/ceramic/paint/material quality;
- believable construction;
- restrained highlights;
- wear/micro-detail;
- local surface variation.

Forbid:

- new geometry;
- new layout;
- labels;
- documentation boards;
- UI;
- bonus props;
- alternate variants;
- perspective change.

If the output is a new composition instead of a material treatment:

`FAIL — edit target not respected`

### 5. Separate material proof from geometry proof

Report independently:

```text
MATERIAL / STYLE PROOF: PASS or FAIL
PRODUCTION GEOMETRY:     PASS or FAIL
```

A material proof may pass while geometry fails only because deterministic restoration follows.

### 6. Restore geometry

Map the generated material back into the deterministic coordinate system and reapply the original SVG-derived structural mask.

Outside structural mask = transparent.

Remove all stray alpha pixels.

### 7. Connector guard zones

At every modular seam, deterministic connector data wins over generated detail.

Require:

- exact width;
- square cut;
- no taper;
- no rounding;
- no alpha gap;
- compatible seam value/material;
- no accidental glow/accent crossing the seam.

### 8. Optional Effect Envelope

Future extension only after structural pipeline is reliable.

A separate Effect Envelope may permit controlled shadow/AO outside the Structural Mask. It must never cross connector boundaries or change collision meaning.

### 9. Downscale after restoration

Only after mask/connector restoration, downscale to exact runtime dimensions and inspect at 100%.

## DO

- one asset category per generation;
- define exact required pieces before generation;
- use deterministic geometry for precision assets;
- reuse saved flow templates from `art-source/flow-vorlagen/`;
- render guides at generation canvas size;
- inspect every generated image before extraction/integration;
- preserve stable atlas IDs;
- validate repeated neighborhoods and real map context;
- keep LightOverlay separate from painted lighting;
- keep props transparent and environment perspective orthographic;
- keep semantic colours intentional;
- maintain a permanent geometry master independent of generated art.

## DON'T

- do not prompt directly for a precision production atlas from text;
- do not trust dimensions written inside a generated image;
- do not generate during a QA-only turn;
- do not silently retry after failure;
- do not use labels/specs/legends in production-source pixels;
- do not trust generated alpha as production geometry;
- do not accept rounded modular connectors because they look attractive;
- do not mix Floor / Walls / Doors / Props / Heroes in one generation;
- do not keep stale atlas rows because runtime ignores them;
- do not move to the next category because CI is green; live visual QA must pass.

## Transfer Hall current flow templates

Use these exact sources unless deliberately revising the wall geometry:

```text
art-source/flow-vorlagen/transfer-hall-wall-blueprint.svg
art-source/flow-vorlagen/transfer-hall-wall-blueprint-4x.png
```

The SVG is the authoritative geometry master. The PNG is a derived raster guide, not an independent source of truth.

## Proven result

On 2026-08-14, the H_TOP proof showed that a flat gray guide can be transformed into materially convincing dark graphite/metal wall art. The generation changed exact canvas/alpha/thickness, confirming the hybrid rule:

> use image generation for visual richness; restore deterministic geometry afterward.
