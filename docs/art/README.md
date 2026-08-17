# Numberdroid Art — Current Authority / Status Index

Status: **current art-domain router — 2026-08-17 after Transfer System static acceptance**

This file separates durable art rules from current production status. Older art documents may preserve historical branch names, first-pass lists or obsolete sequencing; use the current authorities below for status.

## Current status authority

For accepted / current / next state, use in this order:

1. `../planning/DEVELOPMENT_PLAN_NEXT.md`
2. `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
3. `../level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`
4. `../../art-source/recipes/transfer-hall/INDEX.md`
5. relevant current asset `recipe.md`
6. relevant Asset Family manifest under `../../art-source/approved/`
7. actual current runtime/code

Do not infer current status from an old “next” paragraph inside a long art-direction or production-rules document.

## Durable visual / production authority

- Prop Artist onboarding: `../agents/PROP_ARTIST_BRIEF.md`
- Transfer Ship visual thesis: `direction/ART_DIRECTION_TRANSFER_SHIP.md`
- cross-method Artist workflow: `production/ARTIST_AGENT_WORKFLOW.md`
- Prop function-to-form / approval / archive / extraction / integration workflow: `production/PROP_ASSET_WORKFLOW.md`
- **live-QA change classification (source vs runtime vs collision vs shadow vs movable FX): `production/LIVE_QA_ITERATION_CLASSIFICATION.md`**
- approved high-resolution source preservation: `production/APPROVED_SOURCE_ARCHIVE.md` + `../../art-source/approved/README.md`
- manual approved-source upload handoff: `production/APPROVED_SOURCE_UPLOAD_HANDOFF.md`
- hard image-generation authorization: `production/HARD_GENERATION_COMMAND_GATE.md`
- image-tool turn execution: `production/IMAGE_GENERATION_TURN_CONTRACT.md`
- asset validation: `production/ART_ASSET_VALIDATION_RULES.md`
- validation process addendum: `production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- Transfer Ship perspective/material/placement rules: `production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- TS-01 layer/category contract: `transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- TS-01 recipes/status: `../../art-source/recipes/transfer-hall/`
- Prop Level Compiler / Workbench metadata: `../level-generation/PROP_AUTHORING_REQUIREMENTS.md`

Method selection and reusable tooling:

- methods: `../art-production-methods/`
- toolkit: `../art-production-toolkit/`

## Approved-source archive taxonomy

Approved originals live under:

```text
art-source/approved/<campaign-area>/<asset-family>/
```

Canonical Campaign Areas:

```text
area-01-transfer-ship
area-02-deep-ocean
area-03-extreme-industry
area-04-moon-vacuum
area-05-bio-ark-primus
```

Related components that should remain together for future editing/animation share one Asset Family. Transfer Apparatus + Yellow Core + future Transfer FX use:

```text
area-01-transfer-ship/transfer-system/
```

The byte-identical approved original is preserved before destructive/downscaling production work. Runtime assets never replace source authority.

## Current TS-01 Gold Slice status

```text
PICO                         LIVE_ACCEPTED source baseline
Floor                        ACCEPTED BASELINE
Walls / Architecture         LIVE_ACCEPTED
Doors                        LIVE_ACCEPTED
Family Table                 LIVE_ACCEPTED
Family Memory Console        LIVE_ACCEPTED
Family Props Batch 2         LIVE_CANDIDATE
Layout-v3 structure          ACCEPTED generated semantic baseline
v0.13.2 stabilization        LIVE QA ACCEPTED
Transfer Apparatus           LIVE_ACCEPTED — 4×6 + shadow + collision
Yellow Core                  LIVE_ACCEPTED static — 96×96 transfer-fx

CURRENT → Flow support / functional Transfer FloorFX
NEXT    → PRIMUS hero/system art
NEXT    → useful domestic replacements
NEXT    → full-room cohesion + candidate disposition
GATE    → desktop + phone Gold-Slice acceptance
LATER   → Transfer choreography / broader content
```

The active problem is **not** spatial safety and is no longer the Transfer Hero itself. The active problem is that generated TS-01 is still visually sparse and must become a representative finished Gold Slice.

## Accepted Transfer System static state

### Transfer Apparatus

- current approved source: 1086×1448 PNG under `art-source/approved/.../transfer-system/source/`;
- accepted runtime: **256×384 / 4×6 tiles**;
- accepted visible bounds: 240×326 px;
- accepted deterministic FloorFX shadow;
- accepted authored 16×24 quarter-tile silhouette collision compacted to nine runtime rectangles;
- normal Human/Robot movement cannot cross visible machine mass;
- transparent outer corner whitespace remains navigable;
- `propArtRegistry` state: `accepted`.

### Yellow Core

- approved 1254×1254 source under `transfer-system/fx/`;
- accepted runtime: **96×96** with 86×88 visible content;
- separate `transfer-fx` sprite, centered on Apparatus resting platform;
- no independent Prop collision;
- deliberately separate from static Prop lifecycle so later script-controlled Transfer movement is possible.

Recipes:

- `../../art-source/recipes/transfer-hall/transfer-apparatus/recipe.md`
- `../../art-source/recipes/transfer-hall/yellow-core/recipe.md`

Production lessons:

- `../history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

## Key production lessons now binding

Before responding to live QA, distinguish:

```text
FUNCTION / SOURCE DESIGN
PERSPECTIVE / STYLE
RUNTIME CROP / SCALE / PADDING
PLACEMENT / ROOM COMPOSITION
COLLISION / USE-SPACE
SHADOW / GROUNDING
MOVABLE FX / CHOREOGRAPHY
```

Important implications:

- do not regenerate an approved source merely to resize it;
- source design and runtime scale are separate authorities;
- physical size and Hero prominence are separate art-direction questions;
- shadow should be frozen after useful runtime scale converges;
- PNG alpha is not collision authority;
- authored silhouette/occupancy collision can preserve transparent playable whitespace;
- a component that must move between environment and actors should not be forced into a normal static Prop lifecycle.

See `production/LIVE_QA_ITERATION_CLASSIFICATION.md`.

## Current asset-production sequence

Detailed authority: `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

Short version:

1. **Flow support + functional Transfer FloorFX**;
2. **PRIMUS hero/system wall object**;
3. **useful domestic replacements** — Child Bed, Toy/Personal Storage, minimal Hygiene support;
4. **full-room cohesion** — candidate disposition, obsolete blockout removal, restrained grounding/wear/lighting;
5. **desktop + phone Gold-Slice QA and explicit room acceptance**;
6. **then** full Transfer choreography/animation and broader content production.

This is intentional: polish the static room's visual language first instead of investing in a complex Transfer animation inside a still-sparse environment.

## Review-state distinction

These remain distinct:

```text
SOURCE_APPROVED
USER_UPLOAD_VERIFIED
APPROVED_SOURCE_ARCHIVED
PRODUCTION_BUILT
PRODUCTION_QA_PASSED
RUNTIME_INTEGRATED
CI_GREEN
DEPLOYED
LIVE_ACCEPTED
GOLD_SLICE_ACCEPTED
```

A single accepted asset does not imply the room is Gold-Slice accepted.

## Current candidate assets

Still pending final composition-level disposition:

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow.

They may remain integrated during art direction; final cohesion must explicitly accept, revise or remove them.

## Known deferred player-model issue

A smaller issue with the player's own in-game model/presentation remains deliberately separate.

Do not reopen/regenerate accepted PICO art until the issue is classified as Character source, runtime scale/position, allegiance treatment, animation/frame selection or another integration concern.

## Role-aware context

Artists follow `../agents/ROLE_ENTRYPOINTS.md`. Prop-focused agents use `../agents/PROP_ARTIST_BRIEF.md` as the specialized entry point and then follow the current planning/recipe authorities above.
