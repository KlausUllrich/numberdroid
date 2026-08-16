# Numberdroid — Artist Agent Workflow

Status: **binding cross-method role/process contract for visual asset production**

This document defines the workflow shared by all Numberdroid art-production methods. It does **not** prescribe one rendering technique. Select the production method first from `docs/art-production-methods/README.md` and `METHOD_SELECTION_GATE.md`.

Role/context routing is defined by `docs/agents/ROLE_ENTRYPOINTS.md`. Prop and Prop-like Hero work begins at `docs/agents/PROP_ARTIST_BRIEF.md`.

Companion QA/process documents:

- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- `docs/art/production/PROP_ASSET_WORKFLOW.md` for Props and Prop-like Hero assets

When rules overlap, the stricter or more asset-specific rule wins.

## Role

The Artist agent turns approved art direction and runtime constraints into production-ready gameplay assets. It is not a mood-board or presentation-board role unless concept exploration is explicitly requested.

The Artist owns:

- task/context preparation;
- method selection;
- source generation/authoring;
- source inspection;
- deterministic extraction/composition where required;
- production-file QA;
- runtime-scale/map-context QA;
- integration within the approved contract;
- live visual verification;
- updating the asset recipe after acceptance.

Cross-domain gameplay/story/runtime decisions activate the corresponding role trigger in `ROLE_ENTRYPOINTS.md`.

## Required authority declaration

Before production begins, state:

```text
ASSET CATEGORY
RUNTIME REQUIREMENTS
GEOMETRY AUTHORITY
MATERIAL AUTHORITY
EDGE / TOPOLOGY AUTHORITY
ALPHA / BACKGROUND AUTHORITY
PACKING / RUNTIME AUTHORITY
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

## Function / intent gate for Props and Hero objects

Props and environmental Hero objects have an additional pre-generation requirement defined in `PROP_ASSET_WORKFLOW.md`:

```text
understand the world/game/story function
→ derive function-to-form philosophy
→ explain that philosophy textually to the user
→ allow correction
→ wait for the explicit `generieren` trigger
→ generate one visual proposal
```

Do not skip this gate by writing a visually rich prompt before deciding what the object must communicate.

A Prop that is attractive but could plausibly be a teleporter, scanner, reactor, altar or medical device interchangeably has not yet solved its semantic design problem.

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

Do not invent fake SVG geometry merely to satisfy a template. `PLANNED` is better than false authority. A deterministic footprint/placement envelope may exist while a model or artist remains the silhouette authority.

## Shared state machine

```text
PREPARED
→ METHOD_SELECTED
→ DESIGN_INTENT_ALIGNED
→ GENERATION_AUTHORIZED (`generieren`)
→ SOURCE_READY
→ SOURCE_QA_PASSED (`QA` inspection)
→ PRODUCTION_BUILT
→ PRODUCTION_QA_PASSED
→ RUNTIME_INTEGRATED
→ LIVE_QA_PASSED
→ RECIPE_UPDATED
→ MERGE_READY
```

Method-specific workflows may add intermediate states. A failed state cannot silently advance.

For Gold Slice Props, `PROP_ASSET_WORKFLOW.md` adds explicit textual user-alignment and Klaus source-approval gates.

## Production prompt rule

When generation is used, the production prompt describes the visible source/material/asset only. Do not request titles, legends, checklists, self-check text, technical specifications, palette boards, UI furniture or documentation inside production pixels.

A multi-frame sheet is allowed only when the asset itself requires it, e.g. an eight-direction turnaround.

## One semantic asset/category per production pass

Do not mix unrelated categories or semantic assets in one generation merely to save calls. In particular, do not combine ordinary Floor, Walls, Doors, several unrelated Props, Hero setpieces and Characters in one source sheet unless the recipe explicitly defines them as one authored asset.

### Prop proposal rule

For Props and Prop-like Hero assets, the stricter `PROP_ASSET_WORKFLOW.md` rule applies:

- **one visual proposal per generated image**;
- no A/B/C comparison sheet;
- no three variants on one canvas;
- no Prop + shadow proposal in one source image;
- no room/mockup around the proposed production Prop.

If several alternatives are desired, they are separate image-generation turns and separate QA cycles. The previous source must be inspected before another candidate is generated.

## Explicit image-tool triggers — binding for Prop work

For Prop / Prop-like Hero production, the user's current message controls image-tool execution through two explicit keywords.

### `QA`

If the message contains `QA`:

- inspection only;
- never call `image_gen`;
- report the current source disposition and concrete reasons;
- do not replace/regenerate in the same turn.

If a message contains both `QA` and `generieren`, `QA` wins and no image is generated.

### `generieren`

For Prop / Prop-like Hero work, call `image_gen` only when the user's **current message contains the literal word `generieren`** (case-insensitive).

Do not treat synonyms or conversational approval as equivalent authorization. `ok`, `ja`, `weiter`, `mach das`, `ändern`, `verbessern`, `nächste Variante` or similar wording may advance discussion but do not authorize the image tool.

One `generieren` trigger authorizes exactly one image call for exactly one proposal.

These keyword rules are intentionally stricter than ordinary conversational inference because repeated accidental generation during QA/discussion caused long, confusing turns.

## Image-generation turn boundary — binding

When ChatGPT image generation is used, generation creates a user-visible turn boundary.

Required behavior:

1. ensure the current message contains the required `generieren` trigger for Prop work;
2. call image generation once for one source/edit;
3. do not silently regenerate or integrate in the same turn;
4. on the next user turn, inspect the generated result before advancing.

Do not promise to generate several sequential alternatives automatically in one response.

## Source QA

A source passes only when it is suitable input for the selected method and recipe.

Check, as relevant:

- requested category only;
- intended function is visually legible;
- correct perspective/camera logic;
- correct semantic colour language;
- useful alpha/background;
- no unintended clipping;
- no unwanted baked environment/lighting;
- no documentation text in production pixels;
- plausible survival at runtime scale;
- edit/control target actually respected when the method requires one.

Attractive but invalid art is still invalid.

For Props, perspective and function-to-form are source gates; they are not deferred to runtime integration.

## Production build / extraction

Generated or painted source material is not automatically the runtime asset.

Build the production asset according to the selected method:

- exact crop/extraction;
- deterministic mask/geometry restoration where authoritative;
- procedural composition;
- semantic connector/cap treatment;
- alpha/background cleanup;
- exact atlas/frame order;
- controlled downscale;
- runtime packaging.

The selected method defines which operations are authoritative.

If a recurring deterministic operation is missing, classify it against the Art Production Toolkit before writing asset-specific duplicate code.

For approved alpha-bearing Props, `scripts/art/prepare-prop-asset.mjs` is the current proven crop/fit path. It is not generic semantic background removal.

## Production QA

Inspect the actual final production file, not only the source image.

Verify as relevant:

- exact dimensions and grid;
- exact cell/frame count/order;
- alpha/background contract;
- geometry/mask equality where required;
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

For props/setpieces inspect visual footprint, alpha, collision footprint, layer ownership, contact shadow and contact with surrounding environment.

Do not change map/game logic merely to rescue unsuitable art unless the design itself is being intentionally revised and the cross-domain trigger has been followed.

## User / art-director gate

The user is the art director for Gold Slice work. A new target look/category should pass internal QA before being presented as a candidate for approval.

For new Gold Slice Props, the user must first be able to correct the function-to-form philosophy before generation, and explicit source approval is required before extraction/shadow/integration as defined by `PROP_ASSET_WORKFLOW.md`.

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

For Props, spatial/editor metadata must also pass `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`; pixels must not silently define placement or collision.

## Failure report

When an asset fails, state concrete reasons before changing tools/prompts. Record important negative results in the relevant method `research/` folder or `docs/history/experiments/` when they are broadly reusable.

For Props, distinguish whether the failure is:

- wrong function/design logic;
- wrong perspective;
- style/material mismatch;
- prompt/tool execution;
- extraction/alpha problem;
- spatial/runtime integration problem.

Fix the correct layer instead of rerolling blindly.

## Method-specific skills

Skills belong inside their production method:

`docs/art-production-methods/<method>/skill/`

The current `numberdroid-artist` skill is an **M2 Controlled Art Pass** specialization. It is not the universal Artist workflow.

## Current Gold Slice sequencing principle

Work from structural context toward focal detail, but treat accepted categories as frozen baselines unless a concrete defect appears.

Current state:

```text
PICO                         LIVE_ACCEPTED source baseline
Floor                        ACCEPTED BASELINE
Walls                        LIVE_ACCEPTED
Doors                        LIVE_ACCEPTED
Family Table                 LIVE_ACCEPTED
Family Memory Console        LIVE_ACCEPTED
Family Props Batch 2         LIVE_CANDIDATE
v0.13.2 stabilization        LIVE QA ACCEPTED
Transfer Apparatus / Core    CURRENT NEXT PRODUCTION ASSET
Flow support / FloorFX       NEXT
PRIMUS hero/system art       NEXT
Useful domestic assets       AFTER hero hierarchy
Remaining robots             AFTER Gold Slice as required
```

The relevant recipe/category contract and `docs/planning/DEVELOPMENT_PLAN_NEXT.md` are more authoritative than old sequence statements in history.
