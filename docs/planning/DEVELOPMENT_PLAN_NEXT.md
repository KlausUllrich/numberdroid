# Numberdroid — Current Development Plan

Status: **current forward plan — 2026-08-16**

This document is deliberately forward-looking and stays at the **project/milestone level**. Durable gameplay/story/art rules live in their domain documents; historical milestone reasoning lives in `docs/history/`.

The detailed current TS-01 Gold Slice execution plan lives in:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

The declarative level-authoring/compiler track lives in:

`docs/level-generation/`

Do not duplicate those detailed contracts here.

## Foundation status

The framework/runtime architecture phase is complete and must not be restarted as a prerequisite for content production.

Established systems include:

- React app/screen-state architecture;
- free top-down metagame movement and local RAF camera;
- Tiled/Floor data model with separate walkable/collision/object semantics;
- family profiles/saves and progression framework;
- Number Duel with current Addition/Subtraction gameplay;
- robot body size/drive identity;
- encounter behavior families (neutral/guard/patrol/aggressive);
- transfer/body ownership flow;
- HP/loss/restart behavior and current durable gameplay rules;
- GitHub Actions/Pages build path.

Do not reintroduce prototype bridges or another game-runtime architecture migration. See `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`.

## Level Compiler / scalable level production — CURRENT infrastructure track

TS-01 manual composition demonstrated that creating roughly 25 campaign Floors by direct coordinate editing would repeat too much level-design knowledge and produce fragile local fixes.

The approved direction is a deterministic **declarative Level Compiler**, not a classic random generator and not a replacement runtime architecture.

High-level pipeline:

```text
rough natural-language intent
→ LevelSpec / small declarative DSL
→ semantic room/corridor graph
→ constraints/topology
→ shared wall graph + doors
→ props / enemies / routes
→ triggers / events
→ existing Tiled/FloorDefinition runtime boundary
```

Key requirements:

- general rules + world/archetype rules + level-specific rules;
- stable seeds and semantic sub-seeds;
- explicit corridor/gang width;
- no double walls: shared boundaries compile to one wall graph;
- doors belong to wall apertures and reserve clearance on both sides;
- prop metadata drives wall/floor attachment, adjacency and exclusion rules;
- enemies/neutral actors and routes are authored semantically;
- locked doors/access cards, triggers and staged events are first-class data;
- later overrides/locks allow one room/prop to change without regenerating unrelated spaces;
- a later Workbench should manipulate the semantic spec rather than become an unconstrained second tile editor.

Current v0 implementation is deliberately isolated under `src/levelgen/` and stops at semantic compilation/validation. TS-01 remains the first reference/parity case; its live runtime map should not switch to generated geometry until later compiler stages pass tests and deployed QA.

This infrastructure track now runs **alongside** the TS-01 Gold Slice because each recurring TS-01 layout problem should increasingly become a reusable rule rather than another one-off coordinate fix.

## Story/world status

`docs/story/STORY_WORLD_FOUNDATION.md` and `CAMPAIGN_STORY_LEVEL_PROGRESSION.md` remain the current world/campaign foundation. They are required when a task changes narrative semantics or beat sequencing, but are not mandatory background reading for every specialist. See `docs/agents/ROLE_ENTRYPOINTS.md`.

The current production focus remains the Transfer Ship / TS-01 visual Gold Slice plus the authoring infrastructure needed to scale its lessons to later Floors, not final production of all campaign worlds at once.

## Art-production infrastructure — established

The repository now separates:

```text
METHOD  → docs/art-production-methods/      # when/why + authority model
TOOL    → docs/art-production-toolkit/      # reusable deterministic operation
RECIPE  → art-source/recipes/               # asset-specific reproducibility
RUNTIME → public/assets/                     # deployed outputs
```

Current method families:

- M1 Direct Generative Source;
- M2 Controlled Art Pass;
- M3 Layered Raster Editor / MCP;
- M4 Procedural 2D Compositor.

The reusable Art Production Toolkit exists under `scripts/art/toolkit/` with PROVEN mask/compositor/connector/PNG primitives. Background removal/Freistellen, seamless texture tooling, generic atlas packing and several QA utilities remain PLANNED until implemented/proven.

## TS-01 Gold Slice — current status

### Accepted / frozen baseline

- **PICO** — LIVE_ACCEPTED, eight authored directions, recipe-local source.
- **Floor** — accepted baseline; do not revisit casually.
- **Walls / Architecture material + wall kit** — LIVE_ACCEPTED; M4; 30 px visible fascia with unchanged 10 px collision core; semantic seam QA proven.
- **Doors** — LIVE_ACCEPTED; M4 + Art Production Toolkit; dark 5 px moving leaf, exact aperture clipping, 520 ms opening, 650 ms soft close, clean aperture/no status text, coloured-key visual variant.
- **Family Table / Waiting Module** — LIVE_ACCEPTED with dedicated grounding shadow.
- **Family Memory Console** — LIVE_ACCEPTED with final wall-adjacent placement and dedicated grounding shadow.

Accepted categories/assets remain frozen unless live QA exposes a concrete defect or the user explicitly approves a bounded revision. A composition/layout revision may reuse accepted assets without reopening their art.

### Current Family / ordinary-prop state

The second Family prop batch is deployed as a **LIVE_CANDIDATE composition input**:

- round plant;
- planter trough;
- coffee machine;
- hologram pedestal;
- separate grounding shadows.

The assets themselves are promising, but live QA showed that room-level structure, placement and density are now the limiting problem, not the lack of another isolated prop generation.

### CURRENT — TS-01 Gold Slice composition and cohesion

The active visual milestone remains the **whole-room Gold Slice push**, now informed by the new level-design rules and Layout v3 topology.

Detailed execution authority:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

High-level goals:

1. retain the more believable domestic/hall/Transfer/PRIMUS spatial sequence rather than returning to equal rectangular bays;
2. use semantic level rules to capture recurring placement/topology lessons;
3. complete the missing Transfer/Flow/PRIMUS hero hierarchy;
4. add restrained grounding, Flow shadow/path and floor use/wear;
5. converge architecture/door/prop/hero fidelity where live comparison still exposes a mismatch;
6. evaluate the deployed TS-01 room as one coherent visual slice on desktop and phone.

The Gold Slice is complete only after live Art-Director acceptance. `CI green`, `merged` and `LIVE_ACCEPTED` remain different states.

## After the TS-01 Gold Slice

Once TS-01 passes as a coherent representative room and the Level Compiler has proven enough parity to reduce manual topology work:

1. decide which Gold Slice art-production patterns become reusable Transfer Ship production standards;
2. promote proven level-design constraints/prop metadata into reusable compiler rule sets;
3. finish only the additional robot bodies/utility categories needed for the next playable Transfer Ship content;
4. expand from the Gold Slice to remaining Transfer Ship spaces/beats using the compiler + proven room/asset grammar;
5. continue campaign production in current story/game-design order rather than reopening foundation runtime architecture.

Do not broaden into final art for all campaign worlds before TS-01 and the authoring pipeline have answered their representative production questions.

## Deliberately open art/tool questions

Do not silently freeze these:

- exact final asset inventory required to reach Gold Slice density;
- whether a reusable Freistellen/alpha tool is needed for the next final prop/hero sources;
- exact generic atlas packing/downscale tool design;
- final material source/retouch strategy for hero apparatus and PRIMUS;
- whether accepted door/wall categories need a bounded fidelity extension after hero/detail convergence;
- how many additional robot bodies are required immediately after Gold Slice versus later Transfer Ship production.

## Deliberately open Level Compiler questions

Do not silently freeze these until implementation evidence exists:

- topology-solver algorithm and scoring strategy;
- exact YAML/custom-DSL syntax beyond the typed TypeScript LevelSpec contract;
- geometry representation used before Tiled/Floor output;
- how much of prop placement is deterministic scoring versus constrained search;
- final Workbench UI/interaction model;
- exact trigger/event runtime executor set;
- progression solver for key/lock ordering;
- world-specific rule layering for Bio-Ark and later campaign worlds.

## Deliberately open broader gameplay concepts

Still open from campaign design and not the current task unless explicitly requested:

- Beat 12 enemy/body encounter ordering relationship;
- Beat 17 optional bonus Core strengthening/economy;
- Treasure Golem/Beutedroide concept;
- later Bio-Ark ecology mechanics;
- multiplication/division protocol production;
- larger adaptive-learning evidence engine;
- broad body ability catalog.

Do not let these deferred systems block the current Gold Slice/compiler foundation.

## Current acceptance discipline

For art categories:

```text
recipe/method selected
→ source produced
→ source QA
→ production asset built
→ production QA
→ runtime integration
→ tests/build/art validators
→ live/deployed visual QA
→ user acceptance
→ recipe/index LIVE_ACCEPTED + freeze
```

For the Level Compiler:

```text
contract/spec
→ deterministic implementation
→ unit/semantic validation
→ TS-01 parity fixture
→ topology/wall/door validation
→ compiled runtime candidate
→ desktop + phone live QA
→ only then replace manual level authoring for that Floor
```

`Merged` is not `LIVE_ACCEPTED`, and generated output is not authoritative merely because compilation succeeds.

## Handoff / role-routing rule

All new agents begin at `AGENTS.md` and `docs/agents/ROLE_ENTRYPOINTS.md`. Specialists read only the minimum complete role bundle until a cross-domain trigger applies.

A dated handoff can identify the exact next task, but it never overrides current code/contracts.
