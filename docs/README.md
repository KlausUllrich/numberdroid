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

- `level-generation/README.md` — purpose, implementation stages, current v0.13.2 accepted baseline and next authoring/Art-Parity work;
- `level-generation/LEVEL_SPEC.md` — declarative LevelSpec, corridor widths, shared-wall/door direction, prop metadata, enemy placement, triggers/events and overrides;
- `level-generation/PROP_EXACT_FIT.md` — **current v0.13.2 true-space Prop geometry contract**;
- `level-generation/GOLD_SLICE_REGRESSION_GATES.md` — permanent Gold Slice spatial/presentation regression gate;
- `level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md` — explicit live-QA acceptance record and next-step boundary.

Implementation lives under `../src/levelgen/`. The compiler is an authoring layer before the existing Tiled/`FloorDefinition` runtime contract.

Important current status:

> **v0.13.2 spatial/presentation stabilization is LIVE QA ACCEPTED. Generated TS-01 feature/art parity is the active next block.**

Do not revive the superseded v0.13.1 rule that final true-space geometry must remain inside its own coarse tile anchor.

## Story / world

- `story/STORY_WORLD_FOUNDATION.md`
- `story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md`

Story is **triggered context** for roles such as Artist/Engineer unless the task directly changes narrative content or staging. See `agents/ROLE_ENTRYPOINTS.md`.

## Planning / decisions

- `planning/DEVELOPMENT_PLAN_NEXT.md` — current project-level forward milestone plan.
- `planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md` — **current detailed execution plan; current block is Floor identity/AO/wear + Transfer floor integration.**
- `decisions/DECISIONS.md`

## Art — current contracts

Start with:

- `art/README.md` — **current art authority/status router**; separates durable rules from old phase/status passages embedded in longer documents.

Then as relevant:

- direction: `art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- cross-category production/QA: `art/production/`
- **directional actor physical grounding:** `art/production/ACTOR_GROUNDING_WORKFLOW.md`
- Transfer Hall category contracts: `art/transfer-hall/`
- asset-specific reproducibility/status: `../art-source/recipes/transfer-hall/`

Current TS-01 art direction after PICO grounding acceptance:

```text
accepted/frozen baseline
→ Walls / Doors / Floor base / PICO source + physical grounding / Family Table / Memory Console / Transfer Apparatus / Yellow Core

current production
→ room-specific Floor identity + AO + wear + Transfer floor anchoring
→ complete Flow support integration
→ PRIMUS hero/system art
→ useful domestic replacements
→ final room cohesion / QA
```

Family Props Batch 2 remains `LIVE_CANDIDATE`; the spatial PASS does not automatically promote visual candidates.

## Art production methods

Start at:

- `art-production-methods/README.md`
- `art-production-methods/METHOD_SELECTION_GATE.md`

Methods define workflow/authority and may contain method-specific skills.

## Art production toolkit

Start at:

- `art-production-toolkit/README.md`
- `art-production-toolkit/CAPABILITY_INDEX.md`

The toolkit documents reusable deterministic operations such as masks, compositing, connector canonicalization, directional actor source integrity/runtime sanitation and QA. Only capabilities marked **PROVEN** may be assumed to exist. Generic Freistellen/background removal, seamless-material construction/validation and several packing/downscale utilities remain PLANNED until explicitly implemented/proven.

## Known deferred issue

A smaller issue with the player's own in-game model/presentation is known as of 2026-08-16 and deliberately deferred for separate discussion.

PICO physical grounding is now independently **LIVE_ACCEPTED**. That acceptance does not imply the separate player-model issue is resolved. Do not regenerate the accepted PICO source or alter accepted grounding unless the concrete issue is identified and routed to the appropriate Character/Engineering contract.

## Authoring tools

- `../tools/numberdroid-studio/README.md` — **Numberdroid Studio:** standalone-ready local visual authoring product for source atlases, semantic assets, rooms/hallways, agent-observable workflows and deterministic export candidates. Studio requirements and architecture remain encapsulated with the tool.

## History

`history/` preserves previous handoffs, experiments, dated discoveries and superseded documentation. It is useful evidence but **not current authority**.

Read a historical handoff only when the current task/user explicitly points to it or a current contract cites it for evidence. Do not start a new task by scanning old handoffs for a presumed latest truth.
