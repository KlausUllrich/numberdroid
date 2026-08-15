# Numberdroid — Current Development Plan

Status: **current forward plan — 2026-08-15**

This document is deliberately forward-looking and stays at the **project/milestone level**. Durable gameplay/story/art rules live in their domain documents; historical milestone reasoning lives in `docs/history/`.

The detailed current TS-01 Gold Slice execution plan lives in:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Do not duplicate that level of Gold Slice detail here.

## Foundation status

The framework/architecture phase is complete and must not be restarted as a prerequisite for content production.

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

Do not reintroduce prototype bridges or another architecture migration. See `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`.

## Story/world status

`docs/story/STORY_WORLD_FOUNDATION.md` and `CAMPAIGN_STORY_LEVEL_PROGRESSION.md` remain the current world/campaign foundation. They are required when a task changes narrative semantics or beat sequencing, but are not mandatory background reading for every specialist. See `docs/agents/ROLE_ENTRYPOINTS.md`.

The current production focus is still the Transfer Ship / TS-01 visual Gold Slice, not production of all campaign worlds.

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

The assets themselves are promising, but live QA showed that **room-level structure, placement and density are now the limiting problem**, not the lack of another isolated prop generation.

### CURRENT — TS-01 Gold Slice composition and cohesion

The active milestone is now the **whole-room Gold Slice push**, not another isolated prop batch.

Detailed execution authority:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

High-level goals:

1. keep the larger gameplay room but add internal structural articulation/corners;
2. recompose ordinary props around walls, corners and functional clusters;
3. use strict-top-down SVG placeholder props to block out the missing density before producing more final assets;
4. complete the missing Transfer/Flow/PRIMUS hero hierarchy;
5. add restrained grounding, Flow shadow/path and floor use/wear;
6. converge architecture/door/prop/hero fidelity where live comparison still exposes a mismatch;
7. evaluate the deployed TS-01 room as one coherent visual slice on desktop and phone.

The Gold Slice is complete only after live Art-Director acceptance. `CI green`, `merged` and `LIVE_ACCEPTED` remain different states.

## After the TS-01 Gold Slice

Once TS-01 passes as a coherent representative room:

1. decide which Gold Slice art-production patterns should become reusable Transfer Ship production standards;
2. finish only the additional robot bodies/utility categories needed for the next playable Transfer Ship content;
3. expand from the Gold Slice to the remaining Transfer Ship spaces/beats using the proven room/asset grammar;
4. continue campaign production in the order defined by current story/game-design plans rather than reopening foundation architecture.

Do not broaden into all campaign worlds before TS-01 has answered the visual-production questions it was created to answer.

## Deliberately open art/tool questions

Do not silently freeze these:

- which SVG blockout props survive composition QA and therefore deserve final production;
- exact final asset inventory required to reach Gold Slice density;
- whether a reusable Freistellen/alpha tool is needed for the next final prop/hero sources;
- exact generic atlas packing/downscale tool design;
- final material source/retouch strategy for hero apparatus and PRIMUS;
- whether the accepted door/wall categories need any **bounded fidelity extension** after hero/detail convergence, versus leaving the accepted category art untouched and solving the mismatch with adjacent trim/props;
- how many additional robot bodies are required immediately after Gold Slice versus later Transfer Ship production.

## Deliberately open broader gameplay concepts

Still open from campaign design and not the current task unless explicitly requested:

- Beat 12 enemy/body encounter ordering relationship;
- Beat 17 optional bonus Core strengthening/economy;
- Treasure Golem/Beutedroide concept;
- later Bio-Ark ecology mechanics;
- multiplication/division protocol production;
- larger adaptive-learning evidence engine;
- broad body ability catalog.

Do not let these deferred systems block the current visual slice.

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

For the room-level Gold Slice:

```text
structural composition preview
→ SVG density blockout
→ live composition QA
→ final hero/prop/grounding production
→ fidelity convergence
→ desktop + phone live QA
→ Gold Slice user acceptance
```

`Merged` is not `LIVE_ACCEPTED`.

## Handoff / role-routing rule

All new agents begin at `AGENTS.md` and `docs/agents/ROLE_ENTRYPOINTS.md`. Specialists read only the minimum complete role bundle until a cross-domain trigger applies.

A dated handoff can identify the exact next task, but it never overrides current code/contracts.
