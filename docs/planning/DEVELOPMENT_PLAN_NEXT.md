# Numberdroid — Current Development Plan

Status: **current forward plan — 2026-08-16 after v0.13.2 LIVE QA acceptance**

This document is deliberately forward-looking and stays at the **project/milestone level**. Durable gameplay/story/art rules live in their domain documents; historical milestone reasoning lives in `docs/history/`.

Detailed current TS-01 Gold Slice execution:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Declarative Level Compiler contracts:

`docs/level-generation/`

v0.13.2 stabilization acceptance record:

`docs/level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`

Do not duplicate detailed contracts here.

## Foundation status

The framework/runtime architecture phase is complete and must not be restarted as a prerequisite for content production.

Established systems include:

- React app/screen-state architecture;
- free top-down metagame movement and local RAF camera;
- Tiled/`FloorDefinition` runtime data model;
- family profiles/saves and progression framework;
- Number Duel with current Addition/Subtraction gameplay;
- robot body size/drive identity;
- neutral / guard / patrol / aggressive encounter behavior families;
- transfer/body ownership flow;
- HP/loss/restart behavior;
- GitHub Actions/Pages build path;
- persistent compiler-driven Trigger/Event runtime;
- Staged Actor/pass-by runtime;
- semantic Level Compiler Workbench with constraint-aware editing.

Do not reintroduce prototype bridges or another game-runtime architecture migration. See `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`.

## Level Compiler / scalable level production — ESTABLISHED AUTHORING INFRASTRUCTURE

The approved direction is a deterministic **declarative Level Compiler**, not a classic random generator and not a replacement runtime architecture.

Current pipeline is implemented through the existing runtime boundary:

```text
rough design intent
→ LevelSpec / typed declarative contract
→ semantic room/corridor graph
→ deterministic topology / multi-constraint fallback
→ Shared Wall Graph + real apertures
→ navigation + Door Clearance
→ Props / use-space / Hero clearance
→ true-space Exact Fit / multipart collision
→ Actors / patrol routes
→ Triggers / Events / Pickups / Staged Actors
→ Tiled-compatible emission
→ FloorDefinition + typed script runtime
→ composite presentation mapping
→ existing MetaGame runtime
```

TS-01 is the reference/parity case. The generated Floor is playable through:

```text
?floor=ts01-generated
```

The semantic Workbench remains:

```text
?levelgen=ts01
```

### v0.13.2 stabilization — ACCEPTED

PR #79 stabilized the Gold Slice spatial/presentation contract after v0.13.1 live QA exposed wall/Prop/patrol/Door regressions.

Klaus explicitly confirmed the deployed/generated v0.13.2 pass as **PASS on 2026-08-16**.

Binding accepted implications:

- coarse `footprintTiles` is a deterministic anchor/reservation, not mandatory final true-space containment;
- true-space Prop geometry can receive the minimum sub-tile correction beyond its own coarse anchor;
- final envelopes remain constrained by room surfaces, other true-space Props, foreign use-space/Hero reservations and Door Clearance;
- Family Table uses multipart collision;
- Hologram uses the reviewed 0.70 × 0.70 pedestal collider;
- generated large single-room patrols prefer safe interior cells when possible;
- fallback blockouts are wall-safe;
- generated and hand-authored Gold Slice Floors share the accepted Door contract.

See `docs/level-generation/GOLD_SLICE_REGRESSION_GATES.md`.

A smaller issue with the player's own in-game model/presentation is known and deliberately deferred for separate discussion. It does **not** block current Art Asset production. Do not alter/regenerate accepted PICO art until that concrete issue is discussed and classified.

## Art-production infrastructure — established

The repository separates:

```text
METHOD  → docs/art-production-methods/      # when/why + authority model
TOOL    → docs/art-production-toolkit/      # reusable deterministic operation
RECIPE  → art-source/recipes/               # asset-specific reproducibility
RUNTIME → public/assets/                     # deployed outputs
```

Current method families:

- M1 Direct Generative Source;
- M2 Controlled Art Pass;
- M3 Layered Raster Editor / MCP — planned/research;
- M4 Procedural 2D Compositor — proven/live accepted for Walls and Doors.

The reusable Art Production Toolkit has PROVEN mask/compositor/connector/PNG primitives. Generic Freistellen/background removal, seamless-material construction, generic atlas packing/downscale and several QA utilities remain PLANNED until explicitly implemented/proven.

## TS-01 Gold Slice — accepted baseline

Frozen unless a concrete defect or deliberately approved revision appears:

- **PICO** — `LIVE_ACCEPTED`, eight authored directions, recipe-local source;
- **Floor** — accepted baseline;
- **Walls / Architecture** — `LIVE_ACCEPTED`, M4, 30 px visible fascia / 10 px collision core;
- **Doors** — `LIVE_ACCEPTED`, 5 px leaf, aperture clipping, 520 ms opening, 650 ms soft close, coloured-key variant;
- **Family Table / Waiting Module** — `LIVE_ACCEPTED` with dedicated grounding shadow;
- **Family Memory Console** — `LIVE_ACCEPTED` with dedicated grounding shadow.

### Family / ordinary Prop candidates

Still explicitly `LIVE_CANDIDATE` until separate visual Art-Director promotion:

- Round Plant + shadow;
- Planter Trough + shadow;
- Coffee Machine + shadow;
- Hologram Pedestal + shadow.

v0.13.2 acceptance confirms the **spatial/runtime stabilization around these assets**, not their automatic visual promotion.

## CURRENT — Generated TS-01 feature/art parity + Gold Slice production

The active work is no longer another compiler-stabilization pass. It is to turn the accepted generated structure into the representative final-quality Gold Slice.

Current priorities:

1. preserve the accepted Layout-v3 semantic sequence: Family Living + Child + Hygiene → Main Hall → Transfer / PRIMUS;
2. preserve accepted v0.13.2 spatial/door contracts while adding art;
3. produce the missing **Transfer Apparatus / Core hero** at target quality;
4. produce **Flow support + appropriate FloorFX grounding/path**;
5. produce the missing **PRIMUS hero/system wall object / service-bank presentation**;
6. replace only those remaining domestic/blockout Props that materially improve habitation/readability (child bed, personal/toy storage, hygiene fixture/support as justified);
7. add restrained floor use/wear/grounding and lighting support only after hero hierarchy exists;
8. compare Generated TS-01 against the intended Gold Slice quality bar on desktop and phone;
9. require explicit final Art-Director/gameplay acceptance before Generated TS-01 may replace the hand-authored reference.

The existing composite renderer/Prop Art Registry already supports progressive replacement of semantic blockouts with production sprites and shadows. New art should consume that system rather than introduce a competing renderer or manual tile-patch architecture.

## Art production rules for the next assets

Before any production generation/edit:

```text
role/context read
→ asset recipe updated
→ production method selected
→ geometry/material/alpha/packing authority declared
→ exactly one source generation/edit when image generation is used
→ source QA
→ production extraction/build
→ production-file QA
→ registry/runtime integration
→ tests/build/art validators
→ live QA
→ explicit acceptance
→ recipe/index status update
```

`QA`/`prüfen` never means regenerate.

Do not make image pixels authoritative for collision, room topology, wall geometry or Door behavior.

## After the TS-01 Gold Slice

Once Generated TS-01 passes as a coherent representative room:

1. decide which art-production patterns become reusable Transfer Ship standards;
2. promote proven level-design/Prop metadata into reusable world/archetype rule sets;
3. build only the additional robot bodies/utility categories needed by the next playable Transfer Ship content;
4. stress the compiler with a dense PRIMUS Floor, larger ship Floor and larger Bio-Ark/natural Floor;
5. expand remaining Transfer Ship beats using the compiler + proven art grammar;
6. run the explicit final Performance & Scale Pass before campaign-scale production readiness;
7. write the final Agent Authoring Guide **last**, after workflows stop changing materially.

## Deliberately open art/tool questions

Do not silently freeze these:

- exact final asset inventory after the Transfer/PRIMUS hero pass;
- whether the next hero/Prop sources justify implementing generic Freistellen;
- exact reusable atlas/downscale tooling once another category proves the need;
- final material source/retouch strategy for unique hero apparatus;
- whether M3 layered-editor infrastructure is worth implementing after a concrete local-retouch need appears;
- number and order of additional robot body production after the Gold Slice.

## Deliberately open Level Compiler / Workbench questions

The following are later extensions, not blockers for current art production:

- natural-language LevelSpec front-end;
- Connection selection/editing in Workbench;
- per-instance Overrides for quantity-generated Props where production proves necessary;
- reviewed import/apply/write-back workflow from Workbench to repository truth;
- richer generated diffs/diagnostics;
- campaign rule layering/stress-floor evidence;
- final performance/scale limits.

Do **not** describe already implemented topology, geometry, Prop placement, Trigger/Event runtime, Workbench or generated runtime emission as future work.

## Deliberately open broader gameplay concepts

Still open from campaign design and not the current task unless explicitly requested:

- Beat 12 enemy/body encounter ordering relationship;
- Beat 17 optional bonus Core strengthening/economy;
- Treasure Golem/Beutedroide concept;
- later Bio-Ark ecology mechanics;
- multiplication/division protocol production;
- larger adaptive-learning evidence engine;
- broad body ability catalog.

Do not let these deferred systems block the current Gold Slice.

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

For shared compiler/spatial contracts:

```text
contract/spec
→ deterministic implementation
→ automated regression coverage
→ generated TS-01 proof
→ deployed desktop/phone QA where relevant
→ explicit live acceptance
```

`Merged` is not `LIVE_ACCEPTED`, generated output is not authoritative merely because compilation succeeds, and a spatial PASS does not automatically promote candidate art.

## Handoff / role-routing rule

All new agents begin at `AGENTS.md` and `docs/agents/ROLE_ENTRYPOINTS.md`. Specialists read the minimum complete role bundle plus current source/code.

A dated handoff can identify the exact next task, but it never overrides current code/contracts.
