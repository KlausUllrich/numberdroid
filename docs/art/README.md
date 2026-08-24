# Numberdroid Art — Current Authority / Status Index

Status: **current art-domain router — 2026-08-20 after Family Living, Main Hall and Transfer Room floor v1 acceptance**

This file separates durable art rules from current production status. Older art documents may preserve historical branch names, first-pass lists or obsolete sequencing; use the current authorities below for status.

## Current status authority

For accepted / current / next state, use in this order:

1. `../planning/DEVELOPMENT_PLAN_NEXT.md`
2. `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
3. `../level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`
4. `../../art-source/recipes/transfer-hall/INDEX.md`
5. relevant current asset/category `recipe.md`
6. relevant Asset Family manifest under `../../art-source/approved/`
7. actual current runtime/code

Do not infer current status from an old “next” paragraph inside a long art-direction or production-rules document.

## Durable visual / production authority

- Prop Artist onboarding: `../agents/PROP_ARTIST_BRIEF.md`
- Transfer Ship visual thesis: `direction/ART_DIRECTION_TRANSFER_SHIP.md`
- cross-method Artist workflow: `production/ARTIST_AGENT_WORKFLOW.md`
- **semantic floor/tile metadata:** `production/FLOOR_TILE_METADATA_CONTRACT.md` — tile inventory, connector/topology metadata, rotation/wall/runtime eligibility, Ground-vs-FloorFX ownership and topology-safe automatic placement
- **directional actor physical grounding:** `production/ACTOR_GROUNDING_WORKFLOW.md` — source integrity, connected foot/support geometry, runtime sanitation, profile generation, browser/live QA and explicit human calibration overrides
- Prop function-to-form / approval / archive / extraction / integration workflow: `production/PROP_ASSET_WORKFLOW.md`
- live-QA change classification: `production/LIVE_QA_ITERATION_CLASSIFICATION.md`
- approved source preservation: `production/APPROVED_SOURCE_ARCHIVE.md` + `../../art-source/approved/README.md`
- manual approved-source upload handoff: `production/APPROVED_SOURCE_UPLOAD_HANDOFF.md`
- hard image-generation authorization: `production/HARD_GENERATION_COMMAND_GATE.md`
- image-tool turn execution: `production/IMAGE_GENERATION_TURN_CONTRACT.md`
- asset validation: `production/ART_ASSET_VALIDATION_RULES.md`
- Transfer Ship perspective/material rules: `production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- TS-01 layer/category contract: `transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- **current TS-01 Floor Treatment brief:** `../../art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- TS-01 recipes/status: `../../art-source/recipes/transfer-hall/`
- Prop Level Compiler / Workbench metadata: `../level-generation/PROP_AUTHORING_REQUIREMENTS.md`

Method selection and reusable tooling:

- methods: `../art-production-methods/`
- toolkit: `../art-production-toolkit/`

---

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

Related components that should remain together for future editing/animation share one Asset Family. Transfer Apparatus + Yellow Core + Flow Regulator + future Transfer FX use:

```text
area-01-transfer-ship/transfer-system/
```

Room-floor atlas sources for TS-01 currently live under:

```text
art-source/approved/area-01-transfer-ship/floor-treatment/
```

The byte-identical approved original is preserved before destructive/downscaling production work. Runtime assets never replace source authority.

---

## Current TS-01 Gold Slice status

```text
PICO source                  LIVE_ACCEPTED
PICO physical grounding      LIVE_ACCEPTED — PR #121 reference profile / source-integrity pipeline
Floor base family            ACCEPTED BASELINE
Family Living floor v1       LIVE_ACCEPTED
Main Hall floor v1           LIVE_ACCEPTED
Transfer Room floor v1       LIVE_ACCEPTED incl. Hero anchoring
Family Child floor           OPEN / not yet differentiated
Family Hygiene floor source  SOURCE_APPROVED / runtime integration OPEN
PRIMUS floor                 OPEN
Wall AO                      OPEN
Usage/wear FloorFX           OPEN
Walls / Architecture         LIVE_ACCEPTED
Doors                        LIVE_ACCEPTED
Family Table                 LIVE_ACCEPTED
Family Memory Console        LIVE_ACCEPTED
Family Props Batch 2         LIVE_CANDIDATE
Layout-v3 structure          ACCEPTED generated semantic baseline
v0.13.2 stabilization        LIVE QA ACCEPTED
Transfer Apparatus           LIVE_ACCEPTED — 4×6 + shadow + collision
Yellow Core                  LIVE_ACCEPTED static — 96×96 transfer-fx
Flow Regulator source        APPROVED + ARCHIVED
Flow Regulator runtime       128×128 CANDIDATE / final scale-shadow-collision-bus acceptance OPEN

CURRENT → finish Child / PRIMUS identities, integrate Hygiene approved source + wall AO + authored wear
ACTIVE  → finish Flow shadow/collision/use-space/bus
NEXT    → PRIMUS hero/system art
NEXT    → useful domestic replacements
NEXT    → full-room cohesion + candidate disposition
GATE    → desktop + phone Gold-Slice acceptance
LATER   → Transfer choreography / broader content
```

The active problem is **not** spatial safety, PICO grounding, Main Hall topology or Transfer Hero anchoring. Those baselines are accepted. Remaining leverage is the unfinished room identities plus AO/wear/Flow and missing room art.

---

## PICO grounding acceptance boundary

PICO actor grounding is frozen after explicit 8-direction live approval on 2026-08-19.

Binding workflow and regression reference:

`production/ACTOR_GROUNDING_WORKFLOW.md`

Future Artist/Technical Artist agents must not normalize the accepted per-direction offsets merely because a cleaner universal formula seems possible. Source-integrity automation establishes valid geometry; final perceptual calibration is explicit human-QA data. Reopen PICO grounding only for a demonstrated defect or deliberate revision.

---

## Floor Treatment — current state and thesis

Transfer Ship cleanliness:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

The Floor pass should not be one global dirt texture. It should combine:

```text
shared Transfer-Ship material family
+ room-specific Ground variation
+ wall/contact AO
+ room/use-specific wear
+ functional FloorFX
```

Current room status:

- **Family Living** — LIVE_ACCEPTED v1; warmer/lived-in civilian baseline;
- **Child** — OPEN; related but softer/personal identity still required;
- **Hygiene** — SOURCE_APPROVED on 2026-08-21; runtime materialization, integration and gameplay-scale acceptance remain OPEN;
- **Main Hall** — LIVE_ACCEPTED v1; robust calm circulation floor with one semantic longitudinal spine;
- **Transfer** — LIVE_ACCEPTED v1; premium Hero-oriented floor anchoring accepted;
- **PRIMUS** — OPEN; cooler precise systematic work-floor logic still required.

Static wall AO belongs to FloorFX and should derive from actual architecture/Shared Wall Graph geometry where possible. It must preserve apertures and remain subtle. Wear/dirt should follow use rather than generic noise. Actual scene illumination remains `LightOverlay`.

Detailed authorities:

- `../../art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- `production/FLOOR_TILE_METADATA_CONTRACT.md`

### Main Hall semantic-tile proof

Main Hall established the reusable atlas/metadata pattern:

```text
define inventory + semantics
→ generate cuttable source
→ archive original
→ deterministic measured extraction / full-bleed cleanup
→ explicit metadata for every source cell
→ place from actual Level semantics
→ regression tests
→ deployed live QA
```

Binding lessons:

- a generated atlas is not automatically a semantic tileset;
- line-bearing tiles need explicit connector/continuity metadata;
- room access is a threshold, not automatically route topology;
- T/cross/corner floor language is reserved for true corridor topology;
- uncalibrated generated alternatives may remain archived with `runtimeEligible = false`;
- presentation gutters/rounded sample-card backgrounds are not runtime floor art;
- random service/wear Ground variation can create visual patchwork and should move to authored/semantic FloorFX when appropriate.

---

## Accepted Transfer System static state

### Transfer Apparatus

- current approved source under `art-source/approved/.../transfer-system/source/`;
- accepted runtime **256×384 / 4×6 tiles**;
- accepted deterministic FloorFX shadow;
- accepted authored silhouette collision;
- normal Human/Robot movement cannot cross visible machine mass;
- transparent outer corner whitespace remains navigable;
- Transfer Room floor Hero anchoring is now LIVE_ACCEPTED v1.

### Yellow Core

- approved source under `transfer-system/fx/`;
- accepted runtime **96×96**;
- separate `transfer-fx` sprite centered on Apparatus;
- no independent Prop collision;
- separate lifecycle supports later script-controlled Transfer movement.

### Flow Regulator

- source approved and byte-identically archived under `transfer-system/source/`;
- 128×128 runtime candidate integrated and visible in live TS-01;
- final scale acceptance remains open;
- shadow/collision/use-space refinement remains open;
- static Flow coupling bus remains open and belongs to deterministic FloorFX.

Recipes:

- `../../art-source/recipes/transfer-hall/transfer-apparatus/recipe.md`
- `../../art-source/recipes/transfer-hall/yellow-core/recipe.md`
- `../../art-source/recipes/transfer-hall/flow-support/recipe.md`

---

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

Implications:

- do not regenerate approved source merely to resize it;
- source design and runtime scale are separate;
- physical size and Hero prominence are separate;
- for directional actors, source-integrity/connected-body analysis must precede shadow tuning;
- automated grounding geometry does not replace explicit Human Live QA calibration;
- accepted per-direction calibration belongs in profile data, never ad-hoc CSS;
- freeze shadows after useful runtime scale and explicit live acceptance converge;
- PNG alpha is not collision authority;
- authored silhouette/occupancy collision can preserve playable whitespace;
- movable environment/actor components need not use static Prop lifecycle;
- generated iconography is not semantic authority unless intentionally defined;
- **generated floor pixels are not topology/placement authority**;
- semantic tile families require explicit metadata before automatic placement;
- room access and corridor branch topology are distinct;
- dirt/wear should communicate use/age, not undirected visual noise;
- AO/grounding is separate from scene illumination.

---

## Current asset-production sequence

Detailed authority: `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

Short version:

1. **finish remaining room floor work** — author Child/PRIMUS identities and integrate the approved Hygiene source; Family Living/Main Hall/Transfer are done;
2. **add wall AO + authored usage/wear FloorFX**;
3. **complete Flow integration** — scale decision, shadow, collision/use-space, deterministic floor bus;
4. **PRIMUS hero/system wall object**;
5. **useful domestic replacements** — Child Bed, Toy/Personal Storage, minimal Hygiene support;
6. **full-room cohesion** — candidate disposition, obsolete blockout removal, floor/grounding/light tuning;
7. **desktop + phone Gold-Slice QA and explicit room acceptance**;
8. **then** full Transfer choreography/animation and broader content production.

---

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
FLOOR_TREATMENT_ACCEPTED
GOLD_SLICE_ACCEPTED
```

A single accepted asset or room-floor baseline does not imply the full Floor Treatment or Gold Slice is accepted.

---

## Current candidate assets

Pending final composition-level disposition:

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow;
- Flow Regulator runtime scale/integration.

---

## Known deferred player-model issue

A smaller issue with the player's own in-game model/presentation remains deliberately separate. The accepted PICO grounding pass does not automatically resolve or redefine that issue. Do not reopen accepted PICO source/grounding until the separate defect is classified.

---

## Role-aware context

Artists follow `../agents/ROLE_ENTRYPOINTS.md` and `production/ARTIST_AGENT_WORKFLOW.md`.

Triggers:

- Prop-focused work → `../agents/PROP_ARTIST_BRIEF.md`;
- Character/grounding work → `production/ACTOR_GROUNDING_WORKFLOW.md`;
- modular/directional/automatic floor/tile atlas work → `production/FLOOR_TILE_METADATA_CONTRACT.md` **before generation**;
- runtime materializer/placement changes additionally activate Technical Artist / Engineering routing.
