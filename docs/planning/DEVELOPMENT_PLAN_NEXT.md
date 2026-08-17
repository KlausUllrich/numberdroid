# Numberdroid — Current Development Plan

Status: **current forward plan — 2026-08-17 after Transfer Apparatus + Yellow Core LIVE QA acceptance**

This document stays at project/milestone level. Durable gameplay/story/art rules live in domain documents; historical production reasoning lives in `docs/history/`.

Detailed TS-01 Gold Slice execution:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Transfer Hero production lessons:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

Declarative Level Compiler contracts:

`docs/level-generation/`

---

## Foundation status

The framework/runtime architecture phase is complete and must not be restarted as a prerequisite for content production.

Established systems include:

- React app/screen-state architecture;
- free top-down metagame movement and local RAF camera;
- Tiled/`FloorDefinition` runtime model;
- family profiles/saves and progression framework;
- Number Duel with Addition/Subtraction gameplay;
- robot body size/drive identity;
- neutral / guard / patrol / aggressive encounter behavior families;
- transfer/body ownership flow;
- HP/loss/restart behavior;
- GitHub Actions/Pages build path;
- persistent compiler-driven Trigger/Event runtime;
- Staged Actor/pass-by runtime;
- semantic Level Compiler Workbench with constraint-aware editing.

Do not reintroduce prototype bridges or another game-runtime architecture migration. See `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`.

---

## Level Compiler — established authoring infrastructure

The approved direction remains a deterministic declarative Level Compiler:

```text
rough design intent
→ LevelSpec
→ semantic room/corridor graph
→ deterministic topology
→ Shared Wall Graph + apertures
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

TS-01 is the reference/parity case.

Playable generated floor:

```text
?floor=ts01-generated
```

Workbench:

```text
?levelgen=ts01
```

v0.13.2 spatial/presentation stabilization remains **LIVE QA ACCEPTED** and should not be reopened to solve ordinary art problems.

---

## Art-production infrastructure — established

Repository authority remains separated:

```text
METHOD  → docs/art-production-methods/
TOOL    → docs/art-production-toolkit/
RECIPE  → art-source/recipes/
SOURCE  → art-source/approved/
RUNTIME → public/assets/
```

Current proven method/tooling includes:

- M1 Direct Generative Source;
- M2 Controlled Art Pass;
- M4 Procedural 2D Compositor for Walls/Doors;
- deterministic approved-source validation;
- Crop/Fit/downscale with premultiplied-alpha Lanczos;
- deterministic shadow derivation;
- explicit manual approved-source upload/verification path;
- categorical prohibition on inline repository Base64 transport.

M3 layered-editor infrastructure and broader generic Freistellen/atlas tooling remain deferred until a concrete need justifies them.

---

## TS-01 Gold Slice — accepted baseline

Frozen unless a concrete defect or deliberate revision appears:

- **PICO** — LIVE_ACCEPTED source baseline;
- **Floor** — accepted baseline;
- **Walls / Architecture** — LIVE_ACCEPTED;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED;
- **Transfer Apparatus + shadow + silhouette collision** — LIVE_ACCEPTED;
- **Yellow Core static resting state** — LIVE_ACCEPTED at 96×96 on separate `transfer-fx` layer.

Still visual candidates pending final room-context disposition:

- Round Plant + shadow;
- Planter Trough + shadow;
- Coffee Machine + shadow;
- Hologram Pedestal + shadow.

---

## Transfer System production milestone — completed static Hero block

The Transfer hero cycle is now a proven complete production case.

Key accepted results:

- broad 4×6 Apparatus Hero establishes the Transfer Room focal point;
- source and runtime scale are treated as separate authorities;
- deterministic 256×384 Apparatus runtime materialization;
- separate deterministic grounding shadow;
- authored 16×24 quarter-tile silhouette collision compacted to runtime rectangles;
- normal Human/Robot movement cannot cross visible machine mass;
- transparent outer corner whitespace remains navigable;
- Yellow Core remains a separate movable visual rather than baked Apparatus pixels;
- Yellow Core accepted at 96×96 and centered on the Apparatus resting platform;
- movable Core uses `transfer-fx`, not normal static Prop semantics.

These learnings are now recorded both in recipes and the dedicated historical lessons document.

---

## CURRENT milestone — make the Gold Slice visually representative

The generated TS-01 is structurally sound but still visually sparse. **Current priority is to make the Gold Slice beautiful/coherent before expanding campaign production or investing in full Transfer choreography.**

Planned sequence:

1. **Flow support + functional Transfer FloorFX**
   - make the accepted Apparatus feel part of a coherent engineered system;
   - add only functionally justified paths/grounding/support visuals;
   - do not create a competing focal point.

2. **PRIMUS hero/system wall object**
   - establish the allocation/work-room identity;
   - competent, ordered, attractive rather than villain-black;
   - preserve open patrol/work center.

3. **Useful domestic replacements**
   - Child Bed;
   - Toy / personal storage;
   - minimal Hygiene fixture/support;
   - only named functional objects that materially improve habitation.

4. **Full-room cohesion and candidate disposition**
   - accept/revise/remove Coffee/Plants/Hologram in context;
   - remove obsolete blockouts;
   - add missing grounding/contact shadows;
   - restrained floor wear/use cues;
   - lighting convergence with Transfer as primary warm local focus.

5. **Desktop + phone Gold-Slice QA**
   - hierarchy;
   - readability;
   - movement/collision;
   - visual density;
   - Numberdroid identity;
   - explicit final acceptance.

6. **Only after the static Gold Slice reaches the representative quality bar:**
   - Human → Core → PICO choreography;
   - body → body Transfer choreography;
   - Core motion;
   - synchronization/beam/energy FX;
   - broader Transfer Ship content production.

This ordering avoids polishing complex animation inside a room whose supporting visual language is still changing.

---

## Durable production lessons promoted from the Transfer cycle

Before acting on live visual QA, classify the problem:

```text
FUNCTION / SOURCE DESIGN
PERSPECTIVE / STYLE
RUNTIME CROP / SCALE / PADDING
PLACEMENT / ROOM COMPOSITION
COLLISION / USE-SPACE
SHADOW / GROUNDING
MOVABLE FX / CHOREOGRAPHY
```

Only the first two normally justify another source generation.

Additional durable rules:

- source design and runtime scale are separate problems;
- physical scale and Hero prominence are separate problems;
- do not regenerate an approved source merely to resize it;
- redesign a source only when its form cannot use the believable world footprint effectively;
- shadow should be frozen after useful runtime scale converges;
- PNG alpha is not gameplay collision authority;
- shaped collision may be authored as deterministic silhouette/occupancy metadata while preserving transparent whitespace;
- components that must move between environment and actors should not be forced into a static Prop lifecycle.

Generalized workflow details live in `docs/art/production/PROP_ASSET_WORKFLOW.md`.

---

## After TS-01 Gold Slice acceptance

Once Generated TS-01 passes as the representative quality bar:

1. implement/polish Transfer choreography using accepted Apparatus/Core authorities;
2. decide which art-production patterns become reusable Transfer Ship standards;
3. promote proven level-design/Prop metadata into reusable world/archetype rule sets;
4. build only additional robot bodies/utility categories needed by next playable content;
5. stress the compiler with dense PRIMUS, larger ship and larger Bio-Ark/natural floors;
6. expand remaining Transfer Ship beats using the compiler + proven art grammar;
7. run explicit Performance & Scale Pass before campaign-scale production readiness;
8. write final Agent Authoring Guide last, after workflows stop changing materially.

---

## Deliberately open art/tool questions

Do not silently freeze:

- exact Flow-support asset inventory;
- final PRIMUS system-object form;
- exact domestic micro-set needed for finished Family read;
- whether full-room cohesion reveals a concrete need for M3 layered retouching;
- whether later Transfer FX justify a dedicated animation compositor/tool;
- generic atlas/downscale tooling only if another category proves the need.

---

## Current acceptance discipline

For art:

```text
recipe/method selected
→ source produced
→ source QA
→ approved source archived
→ production asset built
→ production QA
→ shadow/spatial integration as applicable
→ tests/build
→ deployed live QA
→ explicit acceptance
→ recipe/index status update
```

For shared compiler/spatial contracts:

```text
contract/spec
→ deterministic implementation
→ automated regression coverage
→ generated TS-01 proof
→ deployed QA
→ explicit live acceptance
```

`Merged` is not `LIVE_ACCEPTED`; `asset accepted` is not `Gold Slice accepted`.
