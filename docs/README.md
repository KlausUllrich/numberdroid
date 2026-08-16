# Numberdroid Documentation Index

Read `../REPOSITORY_STRUCTURE.md` first. Agent work additionally follows `agents/ROLE_ENTRYPOINTS.md` so specialists load the minimum complete domain context rather than the entire repository.

## Agent rules / routing

- `agents/ROLE_ENTRYPOINTS.md` — **binding role/task reading routes and cross-domain triggers**.
- `agents/HANDOFF_PROTOCOL.md` — binding format for self-explanatory, cross-role handoffs.
- `agents/REPOSITORY_WORKFLOW.md` — GitHub/branch/PR working rules.
- `agents/GAMEPLAY_AND_ENGINEERING_RULES.md` — durable gameplay, UX and engineering invariants; mandatory for Engineering and when its triggers apply, not universal background reading for every specialist.

## Architecture

- `architecture/ARCHITECTURE.md`
- `architecture/TILED_MAPS.md`
- `architecture/ROBOT_BODY_SIZE.md`

## Game design

- `game-design/GAME_DESIGN.md`
- `game-design/LEVEL_DESIGN_RULES.md` — **binding reusable room/Floor spatial-design rules: function, zoning, circulation, adjacency, edge furnishing, rationality gradient, symmetry and blockout discipline.**
- `game-design/CAMPAIGN_PROGRESSION.md`
- `game-design/ENCOUNTER_ARCHETYPES.md`
- `game-design/LEARNING_PROFILES.md`
- `game-design/MENU_HUB_FLOW.md`

## Level generation / authoring

Start with:

- `level-generation/README.md` — purpose, ownership, compile stages and stability model;
- `level-generation/LEVEL_SPEC.md` — declarative LevelSpec, corridor widths, shared-wall/door direction, prop metadata, enemy placement, triggers/events and overrides.

Implementation lives under `../src/levelgen/`. The compiler is an authoring layer before the existing Tiled/`FloorDefinition` runtime contract.

## Story / world

- `story/STORY_WORLD_FOUNDATION.md`
- `story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`

Story is **triggered context** for roles such as Artist/Engineer unless the task directly changes narrative content or staging. See `agents/ROLE_ENTRYPOINTS.md`.

## Planning / decisions

- `planning/DEVELOPMENT_PLAN_NEXT.md` — current project-level forward milestone plan.
- `planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md` — current detailed execution/acceptance plan for the TS-01 visual Gold Slice.
- `decisions/DECISIONS.md`

## Art — current contracts

Start with:

- `art/README.md` — **current art authority/status router**; separates durable rules from old phase/status passages embedded in longer documents.

Then as relevant:

- direction: `art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- cross-category production/QA: `art/production/`
- Transfer Hall category contracts: `art/transfer-hall/`
- asset-specific reproducibility: `../art-source/recipes/`

## Art production methods

Start at:

- `art-production-methods/README.md`
- `art-production-methods/METHOD_SELECTION_GATE.md`

Methods define workflow/authority and may contain method-specific skills.

## Art production toolkit

Start at:

- `art-production-toolkit/README.md`
- `art-production-toolkit/CAPABILITY_INDEX.md`

The toolkit documents reusable deterministic operations such as masks, compositing, connector canonicalization, and planned capabilities such as background removal and seamless-material mechanics. Runnable code lives under `../scripts/art/toolkit/`.

## History

`history/` preserves previous handoffs, experiments, dated discoveries and superseded documentation. It is useful evidence but **not current authority**.

Read a historical handoff only when the current task/user explicitly points to it or a current contract cites it for evidence. Do not start a new task by scanning old handoffs for a presumed latest truth.
