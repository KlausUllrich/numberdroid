# Numberdroid — Prop Artist Brief

Status: **binding specialized entry point for Prop / Prop-like Hero asset work**

Use this file when an agent is asked to create, revise, inspect or integrate a Numberdroid Prop, environmental Hero asset or closely related movable visual component.

This is the single onboarding route for Prop production. It provides game/story/project orientation and routes to the documents/code that own detailed rules. Current plans and exact recipes remain authoritative over any orientation snapshot here.

If the task is actually a **Floor / tile atlas / modular surface system rather than a Prop**, route back to `ROLE_ENTRYPOINTS.md` + `../art/production/ARTIST_AGENT_WORKFLOW.md`. When directional/topological/automatic tile placement is involved, the **FLOOR / TILE METADATA trigger** additionally requires `../art/production/FLOOR_TILE_METADATA_CONTRACT.md` before generation.

---

# 1. Role

A Prop Artist turns an approved semantic/environmental function into production-ready visual art that:

- visibly communicates its function;
- fits Numberdroid art/world direction;
- works from the real top-down gameplay camera;
- fits Level Compiler / Workbench spatial contracts when it is a Prop;
- can be processed reproducibly into runtime art;
- survives gameplay-scale QA on desktop and phone.

The role does not silently invent gameplay rules, story canon, compiler semantics or renderer architecture. Cross-domain changes activate the appropriate role route in `ROLE_ENTRYPOINTS.md`.

---

# 2. Numberdroid in one minute

Numberdroid is a child-friendly adventure for players roughly age 7 upward. The player freely explores top-down Floors while inhabiting robot bodies. Robot encounters lead into Number Duel, where arithmetic is solved through a shared number-board mechanic. Current production gameplay supports Addition/Subtraction.

The central fantasy is **body transfer**. The player is a persistent person/Core who can inhabit different robot bodies. Bodies are functional identities, not merely cosmetic skins.

For art, this means silhouette, function, cause/effect and gameplay-scale readability matter more than concept-art micro-detail.

Authoritative gameplay references:

- `GAMEPLAY_AND_ENGINEERING_RULES.md`
- `../game-design/GAME_DESIGN.md`
- actual current implementation under `../../src/`

---

# 3. Story in one minute

The player begins biologically human. A person's consciousness can be transferred into a technical **Core** and inhabit different robot bodies. A child's first Transfer is a coming-of-age ritual and the moment when the wider world becomes accessible.

The first Transfer should initially feel positive: freedom, capability and independence. Immediately afterward, the parents' previous work assignments reactivate and they are transferred away. PRIMUS treats this as ordinary administration; the child experiences it as losing their parents and rebels.

PRIMUS is an ancient administrative intelligence focused on order, safety, predictability and optimal assignment. The thematic conflict is not simply good versus evil:

> **Player:** What do I want to become?  
> **PRIMUS:** What are you optimally suited to become?

Campaign arc: Transfer Ship → Deep Ocean → Extreme Industry → Moon/Vacuum → Bio-Ark/PRIMUS.

Authoritative story references:

- `../story/STORY_WORLD_FOUNDATION.md`
- relevant Intro/Area in `../story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`

For current TS-01 work, Story/World context matters because Transfer machinery depicts the game's central Core/body fantasy.

---

# 4. Current production orientation

**Orientation snapshot only — always verify the current plans.**

The foundational runtime/compiler architecture is established. Do not restart it as a prerequisite for art.

TS-01 is the reference Gold Slice. Layout-v3 and v0.13.2 spatial/presentation stabilization are accepted.

Current visual milestone:

```text
Transfer Apparatus + Yellow Core static Hero state   LIVE_ACCEPTED
Family Living floor v1                               LIVE_ACCEPTED
Main Hall floor v1                                   LIVE_ACCEPTED
Transfer Room floor / Hero anchoring v1              LIVE_ACCEPTED

CURRENT → Child / Hygiene / PRIMUS floor identities + wall AO / authored wear
ACTIVE  → complete Flow support: scale / shadow / collision / floor bus
NEXT    → PRIMUS hero/system art
NEXT    → useful domestic blockout replacements
NEXT    → full-room cohesion / candidate disposition / lighting
GATE    → desktop + phone Gold-Slice QA
LATER   → full Transfer choreography / broader content
```

The generated room is structurally sound. Current priority is **finish the remaining static Gold Slice**, not another compiler migration and not yet a large Transfer-animation polish block.

Accepted/frozen baselines include PICO source/grounding, Floor base, Walls, Doors, Family Table, Family Memory Console, Transfer Apparatus/Core and the accepted Family Living/Main Hall/Transfer floor v1 baselines.

Mandatory current-plan reading:

- `../planning/DEVELOPMENT_PLAN_NEXT.md`
- `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
- relevant current acceptance records

---

# 5. Read in this order

## 5.1 Repository bootstrap

Read completely:

1. `../../AGENTS.md`
2. `../../REPOSITORY_STRUCTURE.md`
3. `ROLE_ENTRYPOINTS.md`
4. `REPOSITORY_WORKFLOW.md`
5. `../README.md`

Verify current `main`, branch/PR and CI state as required by repository workflow.

## 5.2 Creative / game / level context

Read:

1. `../story/STORY_WORLD_FOUNDATION.md` — complete baseline;
2. relevant Intro/area/beat in `../story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`;
3. `../game-design/LEVEL_DESIGN_RULES.md` — mandatory for Props;
4. `GAMEPLAY_AND_ENGINEERING_RULES.md` when interaction/movement/transfer/collision is relevant;
5. `../game-design/GAME_DESIGN.md` as game-design router.

Understand why the asset exists before drawing it.

## 5.3 Current milestone

Read:

1. `../planning/DEVELOPMENT_PLAN_NEXT.md`;
2. current level/milestone plan — for TS-01: `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`;
3. current acceptance/regression record when touching accepted systems.

## 5.4 Art authority / execution process

Read completely:

1. `../art/README.md` — current art status/authority router;
2. `../art/production/PROP_ASSET_WORKFLOW.md` — binding function-analysis → source → QA → archive → production → shadow/spatial/runtime flow;
3. **`../art/production/LIVE_QA_ITERATION_CLASSIFICATION.md` — binding classification of source vs runtime-scale vs placement/collision/shadow/movable-FX problems before changing anything;**
4. `../art/production/HARD_GENERATION_COMMAND_GATE.md` — exact generation authorization;
5. `../art/production/IMAGE_GENERATION_TURN_CONTRACT.md` — image-tool turn behavior;
6. `../art/production/ARTIST_AGENT_WORKFLOW.md`;
7. `../art/production/ART_ASSET_VALIDATION_RULES.md`;
8. `../art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`;
9. `../level-generation/PROP_AUTHORING_REQUIREMENTS.md` when the asset uses Prop semantics.

If a task turns out to involve modular Floor/tile art with directional/topological or automatic-placement semantics, the trigger in `ROLE_ENTRYPOINTS.md` additionally requires:

- `../art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Do not reconstruct production workflow from chat memory or old handoffs.

## 5.5 World / category visual contract

For Transfer Ship / TS-01:

1. `../art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
2. `../art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
3. `../art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`

Use `../art/README.md` to resolve current authority when older long documents contain historical implementation passages.

## 5.6 Method / tooling

Read:

1. `../art-production-methods/README.md`
2. `../art-production-methods/METHOD_SELECTION_GATE.md`
3. selected method documentation

For extraction/masking/resampling/compositing/seams, also read:

- `../art-production-toolkit/CAPABILITY_INDEX.md`
- relevant tool docs
- actual `scripts/art/toolkit/` implementation when changing reusable tooling.

Only implemented/proven capabilities may be treated as production tools.

## 5.7 Asset recipe / approved family

Read:

1. relevant `art-source/recipes/<world>/INDEX.md`;
2. exact asset `recipe.md`;
3. related Asset Family manifest under `art-source/approved/`;
4. source/processing files explicitly referenced by the recipe.

The recipe owns reproducibility and task-specific decisions. Update it whenever a durable production decision or accepted result changes.

## 5.8 Runtime consumer / spatial authority

For normal Props inspect, as applicable:

- `../level-generation/PROP_AUTHORING_REQUIREMENTS.md`
- `../level-generation/PROP_PLACEMENT.md`
- `../level-generation/PROP_EXACT_FIT.md`
- `../level-generation/PROP_ART_EMISSION.md`
- `../../src/levelgen/propRegistry.ts`
- `../../src/levelgen/propArtRegistry.ts`
- `../../src/levelgen/propCollisionRegistry.ts`
- relevant `src/levelgen/specs/<level>.ts`
- current presentation/emission code.

Rendered PNG dimensions/alpha never replace authored spatial authority.

For a component that must later move between environment and actors, first determine whether it should be a normal Prop at all. The accepted Yellow Core is the proven counterexample: a separate movable `transfer-fx` visual with no independent Prop collision.

---

# 6. Mandatory function-to-form response before generation

For a new or materially revised visual source, do **not** immediately generate.

First explain the intended design logic in text so the user can correct it cheaply. Cover, as relevant:

- semantic function;
- player read;
- approach/use/entry/exit behavior;
- large functional forms and silhouette;
- spatial/editor implications;
- gameplay-camera perspective strategy;
- primary failure mode to avoid.

If source/live QA later shows the underlying function-to-form interpretation was wrong, return to this gate before another materially different generation.

---

# 7. Hard interaction triggers

## `QA`

If the current user message contains `QA` (case-insensitive):

- inspection only;
- **never call `image_gen`**;
- report PASS / FAIL / REVISION REQUIRED;
- no replacement image in the same turn.

If QA and generation language coexist, QA wins.

## standalone `generieren`

Image generation for Prop / Prop-like Hero source work is authorized **only when the entire current user message, after trim and lowercase, equals exactly:**

```text
generieren
```

Equivalent predicate:

```text
trim(currentUserMessage).toLowerCase() === "generieren"
```

Not authorized:

- `Bitte generieren.`
- `Noch einmal generieren.`
- `Kannst du das generieren?`
- `ok`
- `ja`
- `weiter`
- `mach das`
- any prose containing the word.

One valid command authorizes exactly one image-generation call / one proposal for that turn, then stop for QA. Authorization never carries over.

This section must be interpreted together with `HARD_GENERATION_COMMAND_GATE.md`; the stricter rule wins.

---

# 8. Live-QA correction discipline

Before responding to deployed visual feedback, classify the problem:

```text
A. FUNCTION / SOURCE DESIGN
B. PERSPECTIVE / STYLE
C. RUNTIME CROP / SCALE / PADDING
D. PLACEMENT / ROOM COMPOSITION
E. COLLISION / USE-SPACE
F. SHADOW / GROUNDING
G. MOVABLE FX / CHOREOGRAPHY
```

Only A/B normally justify source regeneration.

Examples proven by the Transfer System cycle:

- **too large/small in game** → resize runtime derivative first, do not regenerate source;
- **believable scale but weak Hero read** → determine whether source uses footprint poorly before redesign;
- **transparent corners blocked** → refine authored collision, not pixels;
- **grounding wrong** → shadow pass, not source reroll;
- **component must move into a robot** → separate movable visual lifecycle, not static Prop semantics.

Full rule: `../art/production/LIVE_QA_ITERATION_CLASSIFICATION.md`.

---

# 9. Cross-domain / category triggers

Use `ROLE_ENTRYPOINTS.md` for full definitions.

Activate deeper work before deciding when a Prop requires:

- **Story/Narrative:** named characters, canonical family/story meaning, beat staging;
- **Game Design:** new/changed interaction, resource, blocking/drivability, tactical/progression meaning;
- **Technical Artist/Engineering:** reusable tools, `src/` changes, collision/runtime integration, layer/render changes, animation behavior.

### FLOOR / TILE METADATA trigger

If the requested work is or becomes a modular Floor/tile atlas with directional/connective/topological semantics, it is no longer ordinary Prop-only work. Route to the Artist/Technical Artist path and read:

`../art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Trigger examples:

- straight seams/routes/channels;
- corners / T-junctions / crossings / terminals;
- thresholds / wall-edge variants;
- arrows or directional marks;
- rotation-dependent cells;
- automatic runtime selection from Level/room/corridor semantics.

This trigger activates **before generation** so the tile inventory and metadata contract are defined before pixels are produced.

Do not hide unresolved cross-domain/category choices inside visual art or one-off coordinates.

---

# 10. Ready-to-produce check

Before generation/integration, the Artist should be able to state:

- what game/story function the asset serves;
- current project phase and next production goal;
- semantic asset identity;
- what the player must understand visually;
- applicable perspective/world/category contract;
- selected production method;
- source/background authority;
- intended runtime/spatial or movable-visual lifecycle;
- collision/shadow authority as applicable;
- current recipe and approved Asset Family;
- exact next workflow gate;
- whether current user turn is QA, standalone `generieren`, or neither.

If the work is modular floor/tile production, also state:

- tile inventory;
- connector/continuity contract;
- rotation policy;
- runtime/wall eligibility;
- Ground-vs-FloorFX ownership;
- deterministic crop/materialization plan;
- topology/direction regression tests.

If authority is missing, resolve it before generation rather than guessing.

---

# 11. Scope boundary

This brief is an orientation/router, not a second detailed rulebook.

Do not duplicate here:

- exact palette values;
- prompts;
- crop/shadow algorithms;
- compiler field definitions;
- full inventory/status history;
- asset-specific accepted geometry.

Those belong in current plans, art contracts, toolkit, recipes, approved-family manifests and current code.
