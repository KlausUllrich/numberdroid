# Numberdroid — Prop Artist Brief

Status: **binding specialized entry point for Prop / Prop-like Hero asset work**

Use this file when an agent is asked to create, revise, inspect or integrate a Numberdroid Prop or Prop-like environmental Hero asset.

This is a **router, not a rulebook**. It intentionally does not repeat art direction, perspective values, QA criteria, compiler fields, current asset status or task-specific decisions. Those remain owned by the linked documents and current code.

A new Prop Artist should be able to start from this file plus the repository and reach the complete current production context without relying on chat history.

## Role

A Prop Artist turns an approved semantic/environmental function into a production-ready visual asset that fits the current Numberdroid art direction, Level Compiler / Workbench spatial contract and runtime presentation pipeline.

The Prop Artist owns visual source production and Prop-specific art QA. The role does **not** silently invent new gameplay rules, story canon, compiler semantics or runtime architecture.

When the work crosses those boundaries, follow the trigger routes below before making the cross-domain decision.

## Read in this order

### 1. Repository bootstrap

Read completely:

1. [`../../AGENTS.md`](../../AGENTS.md)
2. [`../../REPOSITORY_STRUCTURE.md`](../../REPOSITORY_STRUCTURE.md)
3. [`ROLE_ENTRYPOINTS.md`](ROLE_ENTRYPOINTS.md)
4. [`REPOSITORY_WORKFLOW.md`](REPOSITORY_WORKFLOW.md)
5. [`../README.md`](../README.md)

Verify current `main`, relevant branch/PR state and relevant GitHub Actions state as required by the repository workflow.

### 2. Current art authority and Prop execution process

Read completely:

1. [`../art/README.md`](../art/README.md) — current art status and authority router
2. [`../art/production/PROP_ASSET_WORKFLOW.md`](../art/production/PROP_ASSET_WORKFLOW.md) — **binding Prop production sequence and user-approval gates**
3. [`../art/production/ARTIST_AGENT_WORKFLOW.md`](../art/production/ARTIST_AGENT_WORKFLOW.md) — cross-method Artist process
4. [`../art/production/ART_ASSET_VALIDATION_RULES.md`](../art/production/ART_ASSET_VALIDATION_RULES.md)
5. [`../art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`](../art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md)
6. [`../level-generation/PROP_AUTHORING_REQUIREMENTS.md`](../level-generation/PROP_AUTHORING_REQUIREMENTS.md) — editor/compiler requirements a Prop must satisfy

`PROP_ASSET_WORKFLOW.md` owns the execution order, including proposal variants, QA, Klaus approval, production preparation, shadow work and integration. Do not reconstruct that process from memory or old handoffs.

### 3. World / category visual contract

Read the current visual authority for the world and asset category being produced.

For Transfer Ship / TS-01 work this normally means following the links from [`../art/README.md`](../art/README.md) to the current:

- art-direction document;
- production/category contract;
- Transfer Hall layer contract;
- current Gold Slice plan/status documents when milestone context matters.

Do not take current status from old implementation-phase paragraphs when `docs/art/README.md`, the current plan or recipe says otherwise.

### 4. Method selection

Read:

1. [`../art-production-methods/README.md`](../art-production-methods/README.md)
2. [`../art-production-methods/METHOD_SELECTION_GATE.md`](../art-production-methods/METHOD_SELECTION_GATE.md)
3. the README/skill for the selected production method or hybrid

Choose the method from the asset's authority needs; do not default to one technique merely because it worked for a different category.

If extraction, alpha cleanup, masking, resampling, compositing, seams or packing are involved, also read:

- [`../art-production-toolkit/CAPABILITY_INDEX.md`](../art-production-toolkit/CAPABILITY_INDEX.md)
- the relevant tool document under `docs/art-production-toolkit/tools/`
- the actual implementation under `scripts/art/toolkit/` when using or changing a reusable tool

Only capabilities marked implemented/proven by the toolkit authority may be treated as available production tools.

### 5. Asset-specific recipe

Read:

1. the relevant world recipe index under `art-source/recipes/`;
2. the exact asset/category `recipe.md`;
3. any authoritative recipe-local source, prompt, geometry, material or processing files referenced by that recipe.

The recipe owns reproducibility and asset-specific decisions. Update it when a durable production decision or accepted result changes.

Do not browse archived recipes or historical experiments unless the current recipe/method explicitly points to them or the user asks for historical evidence.

### 6. Actual Level Editor / runtime consumer

Before finalizing a Prop contract or integrating art, inspect the actual current consumer rather than inferring it from documentation alone.

For Level-Compiler Props this normally includes, as applicable:

- [`../../src/levelgen/propRegistry.ts`](../../src/levelgen/propRegistry.ts) — reusable placement/spatial semantics
- [`../../src/levelgen/propArtRegistry.ts`](../../src/levelgen/propArtRegistry.ts) — asset/shadow/review-state binding
- [`../../src/levelgen/propCollisionRegistry.ts`](../../src/levelgen/propCollisionRegistry.ts) — multipart or non-default collision semantics
- the relevant `src/levelgen/specs/<level>.ts` — per-level Prop intent
- the relevant compiler/runtime emission or preview code when placement/presentation behavior is material to the task

Use [`../level-generation/PROP_AUTHORING_REQUIREMENTS.md`](../level-generation/PROP_AUTHORING_REQUIREMENTS.md) to determine which spatial/editor decisions must exist before the asset is editor-ready.

Rendered PNG dimensions, alpha or appearance do not replace the spatial authorities above.

## Cross-domain triggers

Use [`ROLE_ENTRYPOINTS.md`](ROLE_ENTRYPOINTS.md) for the complete trigger definitions.

Activate the additional route before deciding when the Prop requires:

- **Story / Narrative:** specific canonical characters, keepsakes, messages, family events, named story meaning or beat staging;
- **Game Design:** new/changed interaction, gameplay affordance, resource, blocking/drivability meaning, tactical semantics or progression meaning;
- **Technical Artist / Engineering:** reusable processing tools, `src/` changes, runtime asset loading, collision/runtime integration, map/layer/GID changes, animation behavior or renderer changes.

A Prop Artist may identify such a requirement, but should not hide an unresolved cross-domain choice inside the image or a one-off placement hack.

## Ready-to-produce check

After the reading route above, the Prop Artist should be able to identify from current authorities:

- what semantic Prop is being made and why it exists;
- current review/status of that category;
- the required editor/spatial contract;
- the applicable visual/category contract;
- the selected method and authority split;
- the current asset recipe and runtime consumer;
- the exact next gate in `PROP_ASSET_WORKFLOW.md`.

If any of those cannot be established from current documents/code, resolve that missing authority before generation rather than guessing.

## Scope boundary of this brief

This file deliberately contains **no duplicated production rules**.

Do not add here:

- palette values or perspective specifications;
- A/B/C prompt details;
- crop/shadow algorithms;
- compiler metadata definitions;
- current TS-01 asset lists;
- acceptance status of individual Props;
- task-specific design choices such as the current Transfer Apparatus concept.

Those belong in the existing domain documents, toolkit, current plans or asset recipe. This brief remains stable as the single Prop Artist onboarding route while those authorities evolve.
