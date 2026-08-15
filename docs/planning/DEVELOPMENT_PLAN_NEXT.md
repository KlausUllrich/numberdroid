# Numberdroid — Current Development Plan

Status: **current forward plan — 2026-08-15**

This document is deliberately forward-looking. Durable gameplay/story/art rules live in their domain documents; historical milestone reasoning lives in `docs/history/`.

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
- **Walls / Architecture** — LIVE_ACCEPTED; M4; 30 px visible fascia with unchanged 10 px collision core; semantic seam QA proven.
- **Doors** — LIVE_ACCEPTED; M4 + Art Production Toolkit; dark 5 px moving leaf, exact aperture clipping, 520 ms opening, 650 ms soft close, clean aperture/no status text, coloured-key visual variant.

Walls and Doors are now two independent production proofs that M4/Toolkit responsibility separation works. Do not refactor frozen assets merely for code uniformity.

### NEXT — Family / ordinary props

Current next category is:

`art-source/recipes/transfer-hall/family-props/`

Purpose: replace placeholder family/ordinary prop art with isolated top-down production assets that support the family-vs-PRIMUS visual contrast.

Likely production shape:

```text
M1 isolated prop source
→ source QA
→ alpha/background cleanup (potential first real Freistellen-tool proof)
→ deterministic crop/scale/packing
→ runtime atlas/integration
→ map-context QA
→ live user/art-director acceptance
```

This is a hypothesis, not a method decision already frozen. The receiving Artist must run the method-selection gate and update the recipe before generation. M4 should be used only where exact deterministic geometry genuinely owns the prop.

Start with one deliberate **family micro-set**, not an entire mood board or all remaining props at once.

## After family props

Intended order, subject to live learning:

1. Family / ordinary props;
2. Transfer apparatus / cradle hero object;
3. PRIMUS wall object / console;
4. remaining utility/hostile/special robots;
5. evaluate TS-01 Gold Slice as a whole before broad Transfer-Ship production expansion.

Hero/PRIMUS work may use hybrid M1/M3/M4 depending on geometry and finishing requirements. Do method selection per category.

## Deliberately open art/tool questions

Do not silently freeze these:

- exact family prop inventory and whether specific objects are separate sprites vs one micro-set;
- whether the first prop pass requires a reusable Freistellen/alpha tool or can use already-clean alpha source;
- exact generic atlas packing/downscale tool design;
- final material source/retouch strategy for hero apparatus and PRIMUS;
- how many additional robot bodies are needed for the Gold Slice versus later Transfer Ship production.

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

`Merged` is not `LIVE_ACCEPTED`.

## Handoff / role-routing rule

All new agents begin at `AGENTS.md` and `docs/agents/ROLE_ENTRYPOINTS.md`. Specialists read only the minimum complete role bundle until a cross-domain trigger applies.

A dated handoff can identify the exact next task, but it never overrides current code/contracts.
