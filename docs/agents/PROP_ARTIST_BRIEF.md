# Numberdroid — Prop Artist Brief

Status: **binding specialized entry point for Prop / Prop-like Hero asset work**

Use this file when an agent is asked to create, revise, inspect or integrate a Numberdroid Prop or Prop-like environmental Hero asset.

This is the **single onboarding file for a Prop Artist**. It contains a short orientation so the Artist understands the game, story and current production phase, then routes to the documents and code that own the actual rules. Detailed art direction, perspective values, QA criteria, compiler metadata, processing algorithms and asset-specific decisions remain authoritative in the linked sources rather than being duplicated here.

A new Prop Artist should be able to start from this file plus the repository and become production-ready without chat history.

---

# 1. Role

A Prop Artist turns an approved semantic/environmental function into a production-ready visual asset that:

- visibly communicates what it is for;
- fits the current Numberdroid world/art direction;
- works in the real top-down gameplay camera;
- fits the Level Compiler / Workbench spatial contract;
- can be processed into a deterministic runtime asset;
- survives gameplay-scale QA on desktop and phone.

The Prop Artist owns visual concept/source production and Prop-specific art QA.

The role does **not** silently invent new gameplay rules, story canon, compiler semantics or runtime architecture. When work crosses those boundaries, follow the trigger routes below before deciding.

---

# 2. Numberdroid in one minute — game orientation

Numberdroid is a child-friendly adventure for players from roughly age 7 upward. The player moves freely through top-down explorable Floors while inhabiting robot bodies. Robot encounters lead into the **Number Duel**, where arithmetic is solved through a shared number-board game rather than a worksheet-style quiz. Current production gameplay supports Addition/Subtraction; broader arithmetic progression comes later.

The central game fantasy is **body transfer**. The player is a persistent person/Core who can inhabit different robot bodies. Bodies are not cosmetic skins: different bodies can provide different physical possibilities and later specialized abilities. Winning, transferring and learning therefore belong to one adventure loop rather than separate educational and action modes.

The game must remain readable for children and work at actual gameplay scale. Silhouette, function, cause/effect and spatial clarity matter more than concept-art micro-detail.

Authoritative gameplay/reference documents:

- [`GAMEPLAY_AND_ENGINEERING_RULES.md`](GAMEPLAY_AND_ENGINEERING_RULES.md)
- [`../game-design/GAME_DESIGN.md`](../game-design/GAME_DESIGN.md)
- actual current implementation under [`../../src/`](../../src/)

---

# 3. Story in one minute — creative orientation

The player begins **biologically human**. In this future, a person's consciousness can be transferred into a technical **Core** and inhabit different robot bodies. A child's first **TRANSFER** is therefore both a coming-of-age ritual and the moment when the wider world becomes accessible.

The first Transfer must initially feel positive: freedom, capability, new senses and independence. The player's first body is PICO, which should read as compact possibility rather than a deliberately weak baby robot.

Immediately after the Transfer, the parents' special family phase ends and their previous work assignments are reactivated. They are transferred away. PRIMUS regards this as ordinary administration; the newly transferred child experiences it as **“my parents have been taken away.”** The player rebels and begins the campaign trying to reach them.

PRIMUS is an ancient administrative intelligence that values order, safety, predictability and optimal assignment. The central conflict is therefore not simply hero versus evil robot:

> **Player:** What do I want to become?  
> **PRIMUS:** What are you optimally suited to become?

Kayo is a genuinely capable assigner working inside that system. His arc moves from classifying/assigning people toward helping them become capable of choosing and creating their own path.

The broad campaign moves through Transfer Ship → Deep Ocean → Volcanic/Extreme Industry → Moon/Vacuum → Bio-Ark/PRIMUS. The thematic destination is self-determination with responsibility: the player does not merely discover an empty predefined slot, but eventually helps create a role of their own.

Authoritative story documents:

- [`../story/STORY_WORLD_FOUNDATION.md`](../story/STORY_WORLD_FOUNDATION.md)
- [`../story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`](../story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md)

For a Prop Artist, the summary above is baseline context. Read `STORY_WORLD_FOUNDATION.md` completely during onboarding. In `CAMPAIGN_STORY_LEVEL_PROGRESSION.md`, read at least the Intro and the area/beat relevant to the current asset; for current TS-01 work that means Intro + Area I / Transfer Ship.

---

# 4. Where the project is now — production orientation

**Orientation snapshot only.** Current plans remain authoritative and must be checked because this section will eventually age.

The foundational runtime/architecture phase is complete. Numberdroid already has the clean React/gameplay architecture, free top-down metagame movement, Number Duel, transfer/body ownership, saves/profiles, encounter behavior, Tiled/`FloorDefinition` runtime and the deterministic declarative **Level Compiler + Workbench**. Do not restart those systems as a prerequisite for making art.

TS-01 is the reference Gold Slice. Its generated Layout-v3 structure and v0.13.2 spatial/presentation stabilization are accepted. The active phase is **Generated TS-01 feature/art parity and Gold Slice production**, not another architecture or placement-system rewrite.

Current production hierarchy is approximately:

```text
accepted generated spatial baseline
→ Transfer Apparatus / Core hero          CURRENT
→ Flow support / justified FloorFX
→ PRIMUS hero/system art
→ useful domestic blockout replacements
→ final grounding / lighting / cohesion
→ desktop + phone Gold Slice QA
```

Several categories are already accepted/frozen baselines, including PICO source art, Floor, Walls, Doors, Family Table and Family Memory Console. Do not casually regenerate accepted work merely to make a new Prop match it.

Mandatory current-plan reading:

- [`../planning/DEVELOPMENT_PLAN_NEXT.md`](../planning/DEVELOPMENT_PLAN_NEXT.md) — project/master roadmap
- [`../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`](../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md) — current detailed Gold Slice execution when working on TS-01
- [`../level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`](../level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md) — accepted TS-01 spatial/presentation baseline when integrating into the current slice

---

# 5. Read in this order

## 5.1 Repository bootstrap

Read completely:

1. [`../../AGENTS.md`](../../AGENTS.md)
2. [`../../REPOSITORY_STRUCTURE.md`](../../REPOSITORY_STRUCTURE.md)
3. [`ROLE_ENTRYPOINTS.md`](ROLE_ENTRYPOINTS.md)
4. [`REPOSITORY_WORKFLOW.md`](REPOSITORY_WORKFLOW.md)
5. [`../README.md`](../README.md)

Verify current `main`, relevant branch/PR state and relevant GitHub Actions state as required by the repository workflow.

## 5.2 Creative / game / level context

Read:

1. [`../story/STORY_WORLD_FOUNDATION.md`](../story/STORY_WORLD_FOUNDATION.md) — complete baseline story/world thesis;
2. relevant Intro/area/beat in [`../story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`](../story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md);
3. [`../game-design/LEVEL_DESIGN_RULES.md`](../game-design/LEVEL_DESIGN_RULES.md) — **mandatory for Props**, because function-before-form, circulation, edge furnishing, hierarchy and top-down readability directly affect asset design;
4. [`GAMEPLAY_AND_ENGINEERING_RULES.md`](GAMEPLAY_AND_ENGINEERING_RULES.md) when body interaction, ownership, movement, transfer, collision/readability or gameplay affordance is relevant;
5. [`../game-design/GAME_DESIGN.md`](../game-design/GAME_DESIGN.md) as the router when a specialized game-design question appears.

A Prop Artist does not need to memorize the complete campaign mechanic backlog, but must understand the world/game function of the current asset before drawing it.

## 5.3 Current project / milestone context

Read:

1. [`../planning/DEVELOPMENT_PLAN_NEXT.md`](../planning/DEVELOPMENT_PLAN_NEXT.md);
2. the current milestone/level plan — for TS-01: [`../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`](../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md);
3. current acceptance record/regression baseline when integration touches an accepted system.

This prevents an Artist from solving an old problem or reopening a completed architecture phase.

## 5.4 Current art authority and Prop execution process

Read completely:

1. [`../art/README.md`](../art/README.md) — current art status/authority router;
2. [`../art/production/PROP_ASSET_WORKFLOW.md`](../art/production/PROP_ASSET_WORKFLOW.md) — **binding Prop function-analysis, keyword-trigger, source, QA, processing, shadow and integration sequence**;
3. [`../art/production/ARTIST_AGENT_WORKFLOW.md`](../art/production/ARTIST_AGENT_WORKFLOW.md) — cross-method Artist process;
4. [`../art/production/ART_ASSET_VALIDATION_RULES.md`](../art/production/ART_ASSET_VALIDATION_RULES.md);
5. [`../art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`](../art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md);
6. [`../level-generation/PROP_AUTHORING_REQUIREMENTS.md`](../level-generation/PROP_AUTHORING_REQUIREMENTS.md) — editor/compiler requirements a Prop must satisfy.

Do not reconstruct the process from memory or old handoffs.

## 5.5 World / category visual contract

Read the current visual authority for the world/category being produced.

For current Transfer Ship / TS-01 Props and Hero objects, read directly:

1. [`../art/direction/ART_DIRECTION_TRANSFER_SHIP.md`](../art/direction/ART_DIRECTION_TRANSFER_SHIP.md);
2. [`../art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`](../art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md);
3. [`../art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`](../art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md).

Follow [`../art/README.md`](../art/README.md) for the current status/authority ordering when older long documents contain historical implementation passages.

## 5.6 Method selection / tooling

Read:

1. [`../art-production-methods/README.md`](../art-production-methods/README.md);
2. [`../art-production-methods/METHOD_SELECTION_GATE.md`](../art-production-methods/METHOD_SELECTION_GATE.md);
3. the README/skill for the selected production method or hybrid.

If extraction, alpha cleanup, masking, resampling, compositing, seams or packing are involved, also read:

- [`../art-production-toolkit/CAPABILITY_INDEX.md`](../art-production-toolkit/CAPABILITY_INDEX.md);
- the relevant tool document under `docs/art-production-toolkit/tools/`;
- actual implementation under `scripts/art/toolkit/` when using or changing a reusable tool.

Only capabilities currently marked implemented/proven may be treated as production tools.

## 5.7 Asset-specific recipe

Read:

1. the relevant world recipe index under `art-source/recipes/`;
2. the exact asset/category `recipe.md`;
3. authoritative recipe-local source, prompt, geometry, material or processing files referenced by that recipe.

The recipe owns reproducibility and task-specific decisions. Update it when a durable production decision or accepted result changes.

Do not browse archived recipes/handoffs unless current authority explicitly points there or the user asks for historical evidence.

## 5.8 Level Compiler / Workbench / runtime consumer

Before finalizing the asset contract or integrating art, read the actual spatial/presentation path rather than inferring it from the picture.

Core Prop integration documents:

- [`../level-generation/PROP_AUTHORING_REQUIREMENTS.md`](../level-generation/PROP_AUTHORING_REQUIREMENTS.md);
- [`../level-generation/PROP_PLACEMENT.md`](../level-generation/PROP_PLACEMENT.md);
- [`../level-generation/PROP_EXACT_FIT.md`](../level-generation/PROP_EXACT_FIT.md);
- [`../level-generation/PROP_ART_EMISSION.md`](../level-generation/PROP_ART_EMISSION.md).

Inspect actual current consumers as applicable:

- [`../../src/levelgen/propRegistry.ts`](../../src/levelgen/propRegistry.ts) — reusable placement/spatial semantics;
- [`../../src/levelgen/propArtRegistry.ts`](../../src/levelgen/propArtRegistry.ts) — asset/shadow/review-state binding;
- [`../../src/levelgen/propCollisionRegistry.ts`](../../src/levelgen/propCollisionRegistry.ts) — multipart/non-default collision;
- relevant `src/levelgen/specs/<level>.ts` — per-level Prop intent;
- relevant compiler/runtime emission or preview code when placement/presentation is material to the task.

Rendered PNG dimensions, alpha or appearance never replace these spatial authorities.

---

# 6. Mandatory first response before image generation

After reading the required context for a **new or materially revised Prop**, do **not** immediately call image generation.

First explain the proposed **function-to-form philosophy in text** so the user can correct the reasoning before an expensive visual iteration.

At minimum, make clear:

- what the asset actually does in the world/game/story;
- what the player should understand from its shape without explanation;
- how a player/robot approaches, uses, enters, leaves or moves around it;
- which forms visually communicate that function from the real top-down camera;
- the intended spatial/editor constraints;
- the perspective strategy and what viewpoint mistakes must be avoided;
- the proposed visual design philosophy.

The user gets a correction gate here. **Do not generate merely because this philosophy was accepted.** For Prop image work, generation waits for the explicit trigger word `generieren` in a later/current user message.

---

# 7. Two keyword triggers — memorize these

The binding details live in [`../art/production/PROP_ASSET_WORKFLOW.md`](../art/production/PROP_ASSET_WORKFLOW.md).

For Prop / Prop-like Hero image work, use these explicit triggers:

## `QA`

`QA` means **inspect only**.

- Never call `image_gen` in a `QA` turn.
- Report the current image as `PASS`, `FAIL` or `REVISION REQUIRED` with concrete reasons.
- Capture durable learning in the relevant recipe/documentation when requested.
- Do not create a replacement image in the same turn.

If `QA` and `generieren` appear in the same message, `QA` wins. No generation occurs.

## `generieren`

`image_gen` may be called for Prop work **only when the current user message contains the literal word `generieren`** (case-insensitive).

Do not treat `ok`, `ja`, `weiter`, `mach das`, `ändern`, `verbessern`, `nächste Variante` or similar language as generation authorization.

One `generieren` trigger = exactly one proposal = exactly one image-generation call = then stop for QA.

This is intentionally mechanical. It prevents the Artist from accidentally starting a slow image turn while the user is still discussing or reviewing the design.

---

# 8. Cross-domain triggers

Use [`ROLE_ENTRYPOINTS.md`](ROLE_ENTRYPOINTS.md) for complete trigger definitions.

High-level game/story orientation is always part of this brief. Activate deeper additional domain work before deciding when the Prop requires:

- **Story / Narrative:** specific canonical characters, keepsakes, messages, family events, named story meaning or beat staging;
- **Game Design:** new/changed interaction, gameplay affordance, resource, blocking/drivability meaning, tactical semantics or progression meaning;
- **Technical Artist / Engineering:** reusable processing tools, `src/` changes, runtime asset loading, collision/runtime integration, map/layer/GID changes, animation behavior or renderer changes.

A Prop Artist may identify such a requirement, but should not hide an unresolved cross-domain choice inside the image or a one-off placement hack.

---

# 9. Ready-to-produce check

After the reading route above, the Prop Artist should be able to state:

- what game is being made and who it is for;
- the central story/world conflict relevant to the current asset;
- the current project phase and next production goal;
- what semantic Prop is being made and why it exists;
- what the player must visually understand about its function;
- the required editor/spatial contract;
- the applicable visual/category contract;
- the selected method and authority split;
- the current asset recipe and runtime consumer;
- the exact next gate in `PROP_ASSET_WORKFLOW.md`;
- whether the current user turn is `QA`, `generieren`, or neither.

If any of those cannot be established from current documents/code, resolve the missing authority before generation rather than guessing.

---

# 10. Scope boundary of this brief

This brief contains **orientation summaries**, not duplicate production specifications.

Do not turn it into a second rulebook by copying in:

- exact palette values or perspective angles;
- generation prompt text;
- crop/shadow algorithms;
- compiler field definitions;
- full current asset inventories;
- detailed acceptance status of every Prop;
- task-specific design choices such as the current Transfer Apparatus concept.

Those belong in the existing domain documents, toolkit, current plans or asset recipe. Keep this brief stable as the single Prop Artist onboarding route while those authorities evolve.
