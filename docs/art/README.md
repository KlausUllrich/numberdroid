# Numberdroid Art — Current Authority / Status Index

Status: **current art-domain router — 2026-08-17**

This file separates **durable art rules** from **current production status**.

Some large Transfer Ship documents were created during earlier exploration phases and intentionally preserve sections such as old branch names, “first pass implemented/not implemented” lists, initial evaluation deliverables or then-current sequencing. Those passages are useful provenance, but they are **not the current milestone tracker**.

## Current status authority

For what is accepted / next, use in this order:

1. `../planning/DEVELOPMENT_PLAN_NEXT.md`
2. `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md` for detailed current Gold Slice sequencing/acceptance
3. `../level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md` for the accepted generated spatial/presentation baseline
4. `../../art-source/recipes/transfer-hall/INDEX.md`
5. the relevant current asset `recipe.md`
6. the relevant current Transfer Hall/category contract
7. actual current runtime/code

Do not infer current status from an old “next” paragraph inside a long art-direction or production-rules document.

## Durable visual / production authority

- **Prop Artist direct onboarding route:** `../agents/PROP_ARTIST_BRIEF.md`
- Transfer Ship visual thesis: `direction/ART_DIRECTION_TRANSFER_SHIP.md`
- cross-method Artist workflow: `production/ARTIST_AGENT_WORKFLOW.md`
- **approved high-resolution source preservation:** `production/APPROVED_SOURCE_ARCHIVE.md` + `../../art-source/approved/README.md`
- **binding Prop function-analysis → user-alignment → single-source → QA → approval → archive → extraction → shadow → editor/runtime workflow:** `production/PROP_ASSET_WORKFLOW.md`
- hard Prop generation authorization: `production/HARD_GENERATION_COMMAND_GATE.md`
- ChatGPT image-tool turn execution: `production/IMAGE_GENERATION_TURN_CONTRACT.md`
- asset validation: `production/ART_ASSET_VALIDATION_RULES.md`
- validation process addendum: `production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- Transfer Ship perspective/material/placement rules: `production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- TS-01 layer/category contract: `transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- TS-01 recipes/status: `../../art-source/recipes/transfer-hall/`
- Prop Level Compiler / Workbench metadata requirements: `../level-generation/PROP_AUTHORING_REQUIREMENTS.md`

Method selection and reusable tooling are separate domains:

- methods: `../art-production-methods/`
- toolkit: `../art-production-toolkit/`

## Approved-source archive taxonomy

Approved source files are preserved under:

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

Related components that should remain together for future authoring/animation use one **Asset Family**. Example: Transfer Apparatus + yellow Core + Transfer FX live under `area-01-transfer-ship/transfer-system/`.

The byte-identical approved original is preserved before destructive/downscaling production work. Runtime files under `public/` never replace that high-quality source as authoring authority.

## Current TS-01 Gold Slice status

```text
PICO                    LIVE_ACCEPTED source baseline
Floor                   ACCEPTED BASELINE
Walls / Architecture    LIVE_ACCEPTED
Doors                   LIVE_ACCEPTED
Family Table            LIVE_ACCEPTED
Family Memory Console   LIVE_ACCEPTED
Family Props Batch 2    LIVE_CANDIDATE
Layout-v3 structure     ACCEPTED generated semantic baseline
v0.13.2 stabilization   LIVE QA ACCEPTED
Transfer Apparatus      SOURCE_APPROVED / ARCHIVE_PENDING
Flow support / FloorFX  NEXT after Transfer hero
PRIMUS hero/system art  NEXT after Transfer/Flow
Useful domestic assets  AFTER hero hierarchy
Final room cohesion     AFTER production asset replacement
Other robots            AFTER Gold Slice as required
```

The active problem is no longer “make the generated Floor spatially safe.” v0.13.2 is the accepted spatial/presentation stabilization baseline. The active problem is **Generated TS-01 feature/art parity and Gold Slice visual completion**.

For the current Transfer Apparatus, the visual source itself is approved, but the full-resolution original still needs safe binary publication into `art-source/approved/area-01-transfer-ship/transfer-system/source/` before the archive gate is complete.

### Important review-state distinction

`SOURCE_APPROVED`, `APPROVED_SOURCE_ARCHIVED`, `PRODUCTION_QA_PASSED`, `RUNTIME_INTEGRATED`, `CI_GREEN`, `DEPLOYED` and `LIVE_ACCEPTED` are distinct states.

Current candidate assets remain:

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow.

They may remain integrated while the complete room is art-directed. Promote them only after explicit visual acceptance in the final composition.

### Known deferred player-model issue

A smaller issue with the player's own in-game model/presentation is known and deliberately deferred for separate discussion.

Do not treat this note as permission to reopen/regenerate the accepted PICO turnaround. First identify whether the problem belongs to Character art, runtime scale/position, allegiance treatment, animation/frame selection or another integration contract.

It does not block the next environmental Art Asset work.

## Current asset-production sequence

The current detailed sequence lives in `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

In short:

1. finish Transfer Apparatus approved-source archive, then production/integration;
2. create/approve/archive the yellow Core within the same `transfer-system` Asset Family;
3. Flow support + justified FloorFX grounding/path;
4. PRIMUS hero/system wall object / service presentation;
5. useful domestic replacements for remaining blockouts;
6. final grounding/use-wear/light/cohesion pass;
7. desktop + phone Art-Director QA.

For each new Prop/Hero asset, the Prop workflow requires:

```text
understand what the asset must do
→ explain the function-to-form philosophy in text
→ let Klaus correct the direction
→ wait for the standalone command `generieren`
→ generate exactly one visual proposal
→ use `QA` for inspection-only review
→ Klaus explicitly approves a source
→ archive the full approved original under Campaign Area + Asset Family
→ only then create production derivatives
```

Accepted Walls, Doors and accepted Family assets remain frozen unless a concrete live defect appears. New assets must consume the existing generated composite/Exact-Fit pipeline rather than forcing a new renderer or reopening accepted geometry.

## Role-aware context

Artists follow `../agents/ROLE_ENTRYPOINTS.md`. Prop-focused agents should use `../agents/PROP_ARTIST_BRIEF.md` as the specialized direct entry point. It provides the minimum game/story/project orientation and routes to current Story, Game/Level Design, Art, planning, method/toolkit, recipe and Level Compiler authorities.

The brief's high-level game/story orientation does not replace deeper triggers. Narrative-specific Prop content still activates the Story route; gameplay/mechanical changes still activate Game Design; runtime/tool changes still activate Technical Artist/Engineering.

For TS-01 hero assets, Story/World context is inherently relevant because the Transfer Hero depicts the central CORE/body-transfer fantasy and stages the opening coming-of-age beat.
