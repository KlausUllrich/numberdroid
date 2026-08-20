# Numberdroid — Artist Agent Workflow

Status: **binding cross-method role/process contract for visual asset production**

This document defines the workflow shared by all Numberdroid art-production methods. It does **not** prescribe one rendering technique. Select the production method first from `docs/art-production-methods/README.md` and `METHOD_SELECTION_GATE.md`.

Role/context routing is defined by `docs/agents/ROLE_ENTRYPOINTS.md`. Prop and Prop-like Hero work begins at `docs/agents/PROP_ARTIST_BRIEF.md`.

Companion QA/process documents:

- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- `docs/art/production/APPROVED_SOURCE_ARCHIVE.md` — preservation of approved high-resolution originals
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md` — semantic metadata / topology contract for modular floor and tile atlases
- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md` — hard Prop image-generation authorization predicate
- `docs/art/production/IMAGE_GENERATION_TURN_CONTRACT.md` — technical ChatGPT `image_gen` channel/turn execution
- `docs/art/production/PROP_ASSET_WORKFLOW.md` for Props and Prop-like Hero assets

When rules overlap, the stricter or more asset-specific rule wins.

## Role

The Artist agent turns approved art direction and runtime constraints into production-ready gameplay assets. It is not a mood-board or presentation-board role unless concept exploration is explicitly requested.

The Artist owns:

- task/context preparation;
- method selection;
- source generation/authoring;
- source inspection;
- preserving explicitly approved high-quality originals;
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
APPROVED ARCHIVE CAMPAIGN AREA
APPROVED ARCHIVE ASSET FAMILY
EXTRACTION OR COMPOSITION PLAN
QA TESTS
```

The Task Card is a production constraint. It must never be rendered into production pixels.

## FLOOR / TILE METADATA trigger — binding

If the task creates, edits, extracts or integrates a floor/tile atlas with any directional, edge, topology or automatic-placement semantics, read and apply:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

This trigger is active when the source contains or may contain:

- straight seams/routes/channels;
- corners, T-junctions, crossings or terminals;
- thresholds or wall-edge variants;
- arrows/directional marks;
- multipart/integer-grid pieces;
- cells that only work in certain rotations or beside certain geometry;
- generated alternatives that are visually similar but may not connect exactly;
- any tile family selected automatically from Level/room/corridor semantics.

Before generation, the Task Card must then additionally define:

```text
TILE INVENTORY / CELL COUNT
SEMANTIC ROLE PER CELL OR CELL RANGE
CONNECTOR / PORT CONTRACT
CONTINUITY FAMILIES
ROTATION POLICY
WALL / BOUNDARY ELIGIBILITY
RUNTIME ELIGIBILITY / RESERVED CELLS
GROUND VS FLOORFX OWNERSHIP
DETERMINISTIC EXTRACTION / CROP PLAN
TOPOLOGY + DIRECTION REGRESSION TESTS
```

Do **not** generate a visually attractive atlas first and decide later what the cells mean. A source atlas becomes a production semantic tileset only after explicit metadata exists.

## Function / intent gate for Props and Hero objects

Props and environmental Hero objects have an additional pre-generation requirement defined in `PROP_ASSET_WORKFLOW.md`:

```text
understand the world/game/story function
→ derive function-to-form philosophy
→ explain that philosophy textually to the user
→ allow correction
→ wait for the standalone `generieren` command
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
→ GENERATION_AUTHORIZED when applicable
→ SOURCE_READY
→ SOURCE_QA_PASSED
→ SOURCE_APPROVED when explicit Art-Director approval is required
→ APPROVED_SOURCE_ARCHIVED
→ PRODUCTION_BUILT
→ PRODUCTION_QA_PASSED
→ RUNTIME_INTEGRATED
→ LIVE_QA_PASSED
→ RECIPE_UPDATED
→ MERGE_READY
```

Method-specific workflows may add intermediate states. A failed state cannot silently advance.

For generated/painted/revisitable visual assets, `APPROVED_SOURCE_ARCHIVE.md` defines the archive gate. For Gold Slice Props, `PROP_ASSET_WORKFLOW.md` adds explicit textual user-alignment and Klaus source-approval gates.

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

For Prop / Prop-like Hero production, `HARD_GENERATION_COMMAND_GATE.md` is the authorization authority.

Current predicate:

```text
trim(currentUserMessage).toLowerCase() === "generieren"
```

Only that standalone command authorizes one Prop image-generation call.

### `QA`

If the message contains `QA`:

- inspection only;
- never call `image_gen`;
- report the current source disposition and concrete reasons;
- do not replace/regenerate in the same turn.

A QA/commentary message cannot pass the standalone generation predicate.

## Image-generation turn boundary — binding

Technical execution is owned by `IMAGE_GENERATION_TURN_CONTRACT.md`.

When ChatGPT `image_gen` is used:

1. complete all explanation, design alignment and user authorization **before** the generation turn;
2. invoke `image_gen` exactly once in the channel declared by the current tool schema — currently **commentary**, never `final`;
3. do not emit a visible preamble/status message in that generation turn;
4. do not silently regenerate, inspect, extract or integrate after the call;
5. after `image_gen` returns, emit **no additional assistant `final` response**;
6. the image tool return is the terminal output of that assistant turn;
7. normal dialogue resumes only after the user's next message.

Do not promise to generate several sequential alternatives automatically in one response.

If an image call succeeded but the UI appears stuck or the image does not render, do not reroll automatically. Treat it as a turn/tool execution problem first and verify this contract.

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

## User / art-director approval and source archive gate

When the user explicitly approves a generated/painted/revisitable visual source, do **not** immediately treat a crop/downscale/runtime derivative as the only saved master.

Before destructive/downscaling production work:

1. identify the canonical **Campaign Area**;
2. identify the **Asset Family**;
3. preserve the actual approved high-resolution original under `art-source/approved/<area>/<family>/`;
4. record provenance/dimensions/hash/recipe relationship in the family manifest;
5. only then proceed to production processing.

Binding details: `APPROVED_SOURCE_ARCHIVE.md`.

The archive original stays unchanged. Related components that will likely be authored/animated together may share one Asset Family even when runtime files are separate.

If the approved original cannot be safely published because no real binary transport exists, use `SOURCE_APPROVED / ARCHIVE_PENDING` + `BINARY_TRANSPORT_BLOCKED` and do not claim archive completion. Follow `docs/agents/BINARY_ASSET_TRANSPORT.md`.

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

For modular floor/tile families with semantic placement, `FLOOR_TILE_METADATA_CONTRACT.md` is additionally binding: source extraction and semantic placement are separate authorities, and raw atlas indices must not be chosen as topology by visual guesswork.

The selected method defines which operations are authoritative.

If a recurring deterministic operation is missing, classify it against the Art Production Toolkit before writing asset-specific duplicate code.

For approved alpha-bearing Props, `scripts/art/prepare-prop-asset.mjs` is the current proven crop/fit path. It is not generic semantic background removal.

Useful processed authoring masters may be retained under the same Asset Family `production/` folder while `public/` remains runtime/deploy output.

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

For semantic modular floors/tiles also validate the metadata catalog, directional/topology completeness, continuity profiles, wall/boundary eligibility and actual room-vs-corridor placement semantics defined in `FLOOR_TILE_METADATA_CONTRACT.md`.

## Map-context / runtime-context QA

For map-driven tiles inspect actual GID usage and placement semantics. Test repeated and mixed neighborhoods matching the real map.

For characters inspect actual runtime frame selection/order and gameplay scale.

For props/setpieces inspect visual footprint, alpha, collision footprint, layer ownership, contact shadow and contact with surrounding environment.

Do not change map/game logic merely to rescue unsuitable art unless the design itself is being intentionally revised and the cross-domain trigger has been followed.

## User / art-director gate

The user is the art director for Gold Slice work. A new target look/category should pass internal QA before being presented as a candidate for approval.

For new Gold Slice Props, the user must first be able to correct the function-to-form philosophy before generation, explicit source approval is required, and the approved original must pass the archive gate before extraction/shadow/integration as defined by `PROP_ASSET_WORKFLOW.md` + `APPROVED_SOURCE_ARCHIVE.md`.

`CI green`, `merged`, `source approved`, `approved source archived`, and `visually accepted live` are distinct states.

## Integration gate

Only after source/archive and production QA pass:

1. integrate the bounded asset;
2. inspect the live room/game;
3. verify layer/context behavior;
4. run relevant art validators;
5. run tests/build;
6. verify deployed preview when relevant;
7. update the recipe/status after acceptance.

For Props, spatial/editor metadata must also pass `docs/level-generation/PROP_AUTHORING_REQUIREMENTS.md`; pixels must not silently define placement or collision.

For semantic tile families, tile metadata must be durable and versioned before an automatic placement system is considered accepted.

## Failure report

When an asset fails, state concrete reasons before changing tools/prompts. Record important negative results in the relevant method `research/` folder or `docs/history/experiments/` when they are broadly reusable.

For Props, distinguish whether the failure is:

- wrong function/design logic;
- wrong perspective;
- style/material mismatch;
- prompt/tool execution;
- source-archive/binary-transport problem;
- extraction/alpha problem;
- spatial/runtime integration problem.

For modular floor/tile families, additionally distinguish:

- source presentation/crop failure;
- missing/incorrect tile metadata;
- connector/continuity incompatibility;
- false topology semantics (for example room access treated as corridor branch);
- visually excessive but semantically valid variation.

Fix the correct layer instead of rerolling blindly.

## Method-specific skills

Skills belong inside their production method:

`docs/art-production-methods/<method>/skill/`

The current `numberdroid-artist` skill is an **M2 Controlled Art Pass** specialization. It is not the universal Artist workflow.

## Current Gold Slice sequencing principle

Work from structural context toward focal detail, but treat accepted categories as frozen baselines unless a concrete defect appears.

Current state:

```text
PICO                         LIVE_ACCEPTED source + physical grounding
Floor base                   ACCEPTED BASELINE
Family Living floor          LIVE_ACCEPTED v1
Main Hall floor              LIVE_ACCEPTED v1
Transfer Room floor/anchor   LIVE_ACCEPTED v1
Child floor identity         NEXT / not yet differentiated
Hygiene floor identity       NEXT / not yet differentiated
PRIMUS floor identity        NEXT / not yet differentiated
Wall AO / usage wear         NEXT floor-treatment systems
Walls                        LIVE_ACCEPTED
Doors                        LIVE_ACCEPTED
Family Table                 LIVE_ACCEPTED
Family Memory Console        LIVE_ACCEPTED
Family Props Batch 2         LIVE_CANDIDATE
v0.13.2 stabilization        LIVE QA ACCEPTED
Transfer Apparatus / Core    LIVE_ACCEPTED static state
Flow support / FloorFX       ACTIVE / incomplete
PRIMUS hero/system art       NEXT
Useful domestic assets       AFTER hero hierarchy
Remaining robots             AFTER Gold Slice as required
```

The relevant recipe/category contract and `docs/planning/DEVELOPMENT_PLAN_NEXT.md` are more authoritative than old sequence statements in history.
