# Numberdroid — Artist Agent Workflow

Status: **binding cross-method role/process contract for visual asset production**

This document defines the workflow shared by all Numberdroid art-production methods. It does **not** prescribe one rendering technique. Select the production method first from `docs/art-production-methods/README.md` and `METHOD_SELECTION_GATE.md`.

Companion QA documents:

- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`

When rules overlap, the stricter rule wins.

## Role

The Artist agent turns approved art direction and runtime constraints into production-ready gameplay assets. It is not a mood-board or presentation-board role unless concept exploration is explicitly requested.

The Artist owns:

- task preparation;
- method selection;
- source generation/authoring;
- source inspection;
- deterministic extraction/composition where required;
- production-file QA;
- runtime-scale/map-context QA;
- integration;
- live visual verification;
- updating the asset recipe after acceptance.

## Required authority declaration

Before production begins, state:

```text
ASSET CATEGORY
RUNTIME REQUIREMENTS
GEOMETRY AUTHORITY
MATERIAL AUTHORITY
EDGE / TOPOLOGY AUTHORITY
SELECTED METHOD / HYBRID
KNOWN FAILURE MODE TO WATCH
```

Do not begin by invoking an image tool merely because the asset is visual.

## Asset Task Card

Before generating or authoring an asset category, establish:

```text
CATEGORY
TARGET FILE
RUNTIME SIZE / GRID
PERSPECTIVE
BACKGROUND / ALPHA
PALETTE / SEMANTIC COLOURS
ALLOWED CONTENT
FORBIDDEN CONTENT
MAP / GID CONTEXT
SOURCE / RECIPE PATH
EXTRACTION OR COMPOSITION PLAN
QA TESTS
```

The Task Card is a production constraint. It must never be rendered into production pixels.

## Method selection gate

Choose from the current method catalog:

- **M1 Direct Generative Source** — characters, concepts, isolated props, hero-source exploration;
- **M2 Controlled Art Pass** — deterministic silhouette + material/realism edit where hidden topology is not the dominant problem;
- **M3 Layered Raster Editor / MCP** — supervised retouch, local masks, complex hero finishing;
- **M4 Procedural 2D Compositor** — exact modular geometry/topology with shared materials and deterministic edge treatment.

Methods may be combined. The recipe must state which stage owns each property.

Method-specific details belong in the method folder and optional method skill, not in this cross-method workflow.

## Recipe gate

Before the first production-generation/edit pass for a category, create or update:

`art-source/recipes/<world>/<asset>/recipe.md`

A recipe should preserve enough information to reproduce or deliberately revise the accepted asset without relying on chat history.

Do not invent fake SVG geometry merely to satisfy a template. `PLANNED` is better than false authority.

## Shared state machine

```text
PREPARED
→ METHOD_SELECTED
→ SOURCE_READY
→ SOURCE_QA_PASSED
→ PRODUCTION_BUILT
→ PRODUCTION_QA_PASSED
→ RUNTIME_INTEGRATED
→ LIVE_QA_PASSED
→ RECIPE_UPDATED
→ MERGE_READY
```

Method-specific workflows may add intermediate states. A failed state cannot silently advance.

## Production prompt rule

When generation is used, the production prompt describes the visible source/material/asset only. Do not request titles, legends, checklists, self-check text, technical specifications, palette boards, UI furniture or documentation inside production pixels.

A multi-frame sheet is allowed only when the asset itself requires it, e.g. an eight-direction turnaround.

## One category per production pass

Do not mix unrelated categories in one generation merely to save calls. In particular, do not combine ordinary Floor, Walls, Doors, Props, Hero setpieces and Characters in one source sheet unless the recipe explicitly defines them as one authored asset.

## Image-generation turn boundary — binding

When ChatGPT image generation is used, generation creates a user-visible turn boundary.

Required behavior:

1. state what single source/edit is being generated;
2. call image generation once;
3. do not silently regenerate or integrate in the same turn;
4. on the next user turn, inspect the generated result before advancing.

### `QA` is a hard no-generation command

If the user says `QA`, `prüfen`, `check`, or otherwise asks to inspect an existing image:

- **do not call image generation**;
- inspect the existing source/asset;
- report PASS/FAIL with concrete reasons;
- stop unless the user explicitly requests the next production step.

## Source QA

A source passes only when it is suitable input for the selected method and recipe.

Check, as relevant:

- requested category only;
- correct perspective;
- correct semantic colour language;
- useful alpha/background;
- meaningful variant separation;
- no unintended clipping;
- no unwanted baked environment/lighting;
- no documentation text in production pixels;
- plausible survival at runtime scale;
- edit/control target actually respected when the method requires one.

Attractive but invalid art is still invalid.

## Production build / extraction

Generated or painted source material is not automatically the runtime asset.

Build the production asset according to the selected method:

- exact crop/extraction;
- deterministic mask/geometry restoration;
- procedural composition;
- semantic connector/cap treatment;
- alpha cleanup;
- exact atlas/frame order;
- controlled downscale;
- runtime packaging.

The selected method defines which operations are authoritative.

## Production QA

Inspect the actual final production file, not only the source image.

Verify as relevant:

- exact dimensions and grid;
- exact cell/frame count/order;
- alpha/background contract;
- geometry/mask equality;
- no bleed/stale rows/source text;
- semantic colours;
- connector/seam requirements;
- repeated-neighborhood behavior;
- gameplay-scale readability.

Automated measurements supplement visual QA; they do not decide whether the art is good.

For modular seams, always pair a match metric with a negative control as defined in `SEMANTIC_CONNECTOR_CANONICALIZATION.md`.

## Map-context / runtime-context QA

For map-driven tiles inspect actual GID usage and placement semantics. Test repeated and mixed neighborhoods matching the real map.

For characters inspect actual runtime frame selection/order and gameplay scale.

For props/setpieces inspect visual footprint, collision footprint, layer ownership and contact with the surrounding environment.

Do not change map/game logic merely to rescue unsuitable art unless the design itself is being intentionally revised.

## User / art-director gate

The user is the art director for Gold Slice work. A new target look/category should pass internal QA before being presented as a candidate for approval.

`CI green` and `merged` do not mean `visually accepted`.

## Integration gate

Only after source and production QA pass:

1. integrate the bounded asset;
2. inspect the live room/game;
3. verify layer/context behavior;
4. run relevant art validators;
5. run tests/build;
6. verify deployed preview when relevant;
7. update the recipe/status after acceptance.

## Failure report

When an asset fails, state concrete reasons before changing tools/prompts. Record important negative results in the relevant method `research/` folder or `docs/history/experiments/` when they are broadly reusable.

## Method-specific skills

Skills belong inside their production method:

`docs/art-production-methods/<method>/skill/`

The current `numberdroid-artist` skill is an **M2 Controlled Art Pass** specialization. It is not the universal Artist workflow.

## Current Gold Slice sequencing principle

Work from structural context toward focal detail, but treat accepted categories as frozen baselines unless a concrete defect appears.

Current intended progression after accepted Floor/PICO/Walls is broadly:

```text
Doors → ordinary props → hero apparatus / PRIMUS objects → remaining robots
```

The relevant recipe/category contract is more authoritative than an old sequence recorded in history.
