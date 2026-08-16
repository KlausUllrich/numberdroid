# AGENTS.md

## Purpose

This file is the universal entry point for every Numberdroid agent. It is a **router**, not an encyclopedia: every agent reads the small common bootstrap, then follows a role/task-specific reading route from `docs/agents/ROLE_ENTRYPOINTS.md`.

The goal is to avoid two opposite failure modes:

- an Artist wasting context by reading the entire campaign/story/gameplay corpus before touching one prop;
- a specialist changing a cross-domain contract without reading the domain that owns it.

## Universal bootstrap — mandatory for every agent

Before changing anything in the repository, read completely in this order:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`

Then classify the task by **primary role and triggers** and read the required bundle in `ROLE_ENTRYPOINTS.md`.

If the user/current task explicitly names a handoff, read that handoff **after** the current binding documents for the relevant role. Handoffs are task snapshots, not higher authority than current contracts. Handoff format and cross-role rules are defined in `docs/agents/HANDOFF_PROTOCOL.md`.

## Role routing is task-based, not identity-based

A session may change roles while work progresses. An agent that starts as Artist becomes a Technical Artist/Engineer for the part of the task that changes runtime integration or reusable tooling. A Game Designer becomes Narrative-aware when a mechanic changes a story beat. Follow the trigger rules; do not rely on a permanent self-label.

If a task crosses domains, read the additional domain bundle **before** making the cross-domain decision.

## Source-of-truth model

Use these authorities:

- repository organization and file ownership: `REPOSITORY_STRUCTURE.md`
- role/task reading routes: `docs/agents/ROLE_ENTRYPOINTS.md`
- repository/GitHub workflow: `docs/agents/REPOSITORY_WORKFLOW.md`
- durable gameplay/engineering invariants: `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
- current production code: `src/`
- runtime/deploy assets: `public/` — outputs, not automatically authoring sources
- art direction and category contracts: `docs/art/`
- art-production method selection: `docs/art-production-methods/`
- reusable art-processing capabilities: `docs/art-production-toolkit/` + `scripts/art/toolkit/`
- reproducible asset-specific art source: `art-source/recipes/`
- architecture/map contracts: `docs/architecture/`
- game design: `docs/game-design/`
- declarative level-authoring/compiler contract: `docs/level-generation/` + `src/levelgen/`
- story/world: `docs/story/`
- current forward plan: `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
- historical handoffs/experiments: `docs/history/` — evidence/context only, never current authority by default

If two current authorities conflict, report the conflict rather than silently inventing a resolution.

For Level Compiler / procedural level-authoring tasks, read `docs/game-design/LEVEL_DESIGN_RULES.md`, `docs/level-generation/README.md`, `docs/level-generation/LEVEL_SPEC.md`, relevant architecture/map contracts, and the actual `src/levelgen/` implementation before changing the compiler/spec semantics.

## Repository workflow — hard rules

- `main` is canonical and should remain stable.
- Verify current `main` HEAD and relevant GitHub Actions state before significant work.
- Use focused branches/PRs for changes.
- For remote repository operations use the connected GitHub connector. Do not fall back to `git clone`, `git fetch`, `curl`, `wget`, or container-network workarounds.
- If GitHub actions are not currently surfaced, **rediscover the GitHub connector/actions first** as defined in `docs/agents/REPOSITORY_WORKFLOW.md`; absence from the active tool schema is not evidence that repository access is unavailable.
- Do not mix broad repository reorganization with gameplay changes.
- Preserve `zahlenkern-prototyp-meta-v7.html` as the frozen behavioral reference; do not refactor it into production code.
- Before merging runtime changes, run the available tests and production build. Art changes must also run their relevant art QA scripts.
- `CI green`, `merged`, and `visually accepted` are different states.
- Update the relevant current contract/recipe when a durable decision or accepted asset changes.

## Art-specific hard rules

Before producing/editing gameplay art, follow the Artist route in `ROLE_ENTRYPOINTS.md` and the binding `docs/art/production/ARTIST_AGENT_WORKFLOW.md`.

For Prop or Prop-like environmental Hero work, `docs/agents/PROP_ARTIST_BRIEF.md` is the specialized direct onboarding route. It points to the current Prop workflow, editor requirements, method/toolkit authorities, recipe and runtime consumers without duplicating them.

In particular:

- select a production method before generation;
- update/create the asset recipe before the first production generation/edit pass;
- one requested image-generation pass means one generation, then stop for QA;
- `QA`, `prüfen`, `check`, or equivalent inspection requests are **hard no-generation commands**;
- generated source is not automatically a production runtime asset;
- accepted/frozen categories are not reopened without a concrete defect or explicit approved revision.

## Handoff discipline

A handoff must be self-explanatory enough for a new session and role-aware enough not to require reading the whole repository. Use `docs/agents/HANDOFF_PROTOCOL.md`.

A handoff must never tell the receiver to trust the handoff instead of current code/contracts. The receiver verifies `main`, reads the common bootstrap, follows the role route, then uses the handoff as the current task snapshot.

When handing from one role to another, explicitly state:

- receiving role;
- why that role is needed;
- which additional domain triggers apply;
- what is already accepted/frozen;
- what decision remains open and who owns it.

## Documentation discipline

New documentation must be placed according to `REPOSITORY_STRUCTURE.md`; do not add new project documents to the repository root unless explicitly allowed there.

When a document becomes historical, move it to `docs/history/` instead of leaving multiple competing status documents beside current contracts.

Method-specific skills belong inside the corresponding method folder under `docs/art-production-methods/<method>/skill/`. Do not create a global skill that implies one art workflow is universal.
