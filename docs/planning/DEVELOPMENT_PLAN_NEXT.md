# Numberdroid — Current Development Plan

Status: **current forward plan — 2026-08-20 after Family Living, Transfer Room and Main Hall floor v1 live acceptance**

This document stays at project/milestone level. Durable gameplay/story/art rules live in domain documents; historical production reasoning lives in `docs/history/`.

Detailed TS-01 Gold Slice execution:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Current Floor treatment brief:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

Semantic Floor/Tile metadata contract:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Directional Actor grounding workflow:

`docs/art/production/ACTOR_GROUNDING_WORKFLOW.md`

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
- M4 Procedural 2D Compositor for topology/material-critical 2D work;
- deterministic approved-source validation;
- Crop/Fit/downscale with premultiplied-alpha Lanczos;
- deterministic shadow derivation;
- directional-actor connected-component/source-integrity analysis;
- deterministic runtime sanitation of proven detached actor-source artefacts;
- profile-driven directional actor grounding with generated CSS and browser QA;
- explicit human live-QA calibration stored as reproducible profile data;
- explicit manual approved-source upload/verification path;
- deterministic cuttable floor-atlas extraction from measured cell faces rather than naive image division;
- explicit semantic per-tile metadata for automatic placement: role, connectors, continuity family, rotation, wall/runtime eligibility and direction meaning;
- categorical prohibition on inline repository Base64 transport.

Main Hall proved that **visual source pixels are not topology authority**. The binding reusable rule now lives in `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`.

M3 layered-editor infrastructure and broader generic Freistellen/atlas tooling remain deferred until a concrete need justifies them.

---

## TS-01 Gold Slice — accepted baseline

Frozen unless a concrete defect or deliberate revision appears:

- **PICO source/turnaround** — LIVE_ACCEPTED;
- **PICO physical grounding** — LIVE_ACCEPTED on 2026-08-19; PR #121 reference profile; reusable workflow in `docs/art/production/ACTOR_GROUNDING_WORKFLOW.md`;
- **Floor base material family** — accepted baseline;
- **Family Living floor v1** — LIVE_ACCEPTED; warm civilian/lived-in material treatment already integrated;
- **Main Hall floor v1** — LIVE_ACCEPTED on 2026-08-20; one calm circulation spine, room thresholds are not route branches, semantic tile metadata contract proven;
- **Transfer Room floor / Hero anchoring v1** — LIVE_ACCEPTED; approved 6×6 atlas integrated with installed Hero-zone relationship;
- **Walls / Architecture** — LIVE_ACCEPTED;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED;
- **Transfer Apparatus + shadow + silhouette collision** — LIVE_ACCEPTED;
- **Yellow Core static resting state** — LIVE_ACCEPTED at 96×96 on separate `transfer-fx` layer.

Still visual/runtime candidates pending final room-context disposition:

- Round Plant + shadow;
- Planter Trough + shadow;
- Coffee Machine + shadow;
- Hologram Pedestal + shadow;
- Flow Regulator — approved/archived source, 128×128 runtime candidate visible in live TS-01; final scale/shadow/collision/use-space/bus acceptance still pending.

Remaining room-floor identities:

- **Child** — not yet differentiated from current domestic/family treatment;
- **Hygiene** — not yet differentiated from current domestic/family treatment;
- **PRIMUS Allocation** — not yet produced; still blockout/base presentation.

---

## Directional Actor grounding — accepted production standard

PICO established the reusable grounding production pattern:

```text
approved directional source
→ connected-component/source-integrity analysis
→ deterministic runtime sanitation only for proven artefacts
→ connected foot/support geometry
→ profile-driven ambient + contact shadows
→ generated runtime CSS
→ automated 8-direction + real-scene QA
→ explicit human per-direction calibration deltas
→ live acceptance
→ freeze
```

Important boundary:

- automated geometry prevents impossible/detached grounding;
- final perceptual calibration remains Human Live QA authority;
- accepted per-direction deltas are stored in profile data rather than hidden CSS tweaks;
- approved source geometry and human presentation offsets remain separate;
- do not refactor accepted PICO offsets merely to impose a cleaner universal formula.

This block is complete. It is not the current Gold-Slice priority.

---

## Transfer System static Hero milestone — established

Accepted/proven:

- broad 4×6 Apparatus Hero;
- deterministic 256×384 runtime materialization;
- separate grounding shadow;
- authored silhouette collision preserving transparent playable corners;
- Yellow Core as a separate 96×96 movable `transfer-fx` visual;
- source/runtime scale split;
- movable components not forced into static Prop lifecycle;
- installed Transfer-room floor anchoring around the Hero.

Flow support now extends this system without reopening the accepted Apparatus/Core/floor-anchor baseline.

---

## CURRENT milestone — finish the remaining static Gold Slice floor/environment pass

The generated TS-01 is structurally sound and now has three accepted floor identities. **Current priority remains static Gold-Slice coherence before campaign expansion or full Transfer choreography.**

Completed floor-identity proof:

```text
Family Living   LIVE_ACCEPTED
Main Hall       LIVE_ACCEPTED
Transfer Room   LIVE_ACCEPTED
```

Still open in the current floor/environment milestone:

```text
Child identity          OPEN
Hygiene identity        OPEN
PRIMUS identity         OPEN
Wall AO                 OPEN
Usage/wear FloorFX      OPEN
Flow floor relationship PARTIAL / OPEN
```

### Planned sequence

1. **Complete TS-01 room-specific floor identities**
   - ~~Family Living~~ **DONE / LIVE_ACCEPTED**;
   - Child — next domestic material identity;
   - Hygiene — next functional/non-slip material identity;
   - ~~Main Hall~~ **DONE / LIVE_ACCEPTED**;
   - ~~Transfer Room + Hero floor anchoring~~ **DONE / LIVE_ACCEPTED**;
   - PRIMUS systematic floor logic — still open.

   The Main Hall pass established a reusable rule for semantic tiles: define a tile contract before generation, archive the approved source, extract deterministically, store per-cell metadata, and place from Level semantics. See `FLOOR_TILE_METADATA_CONTRACT.md`.

2. **Add static wall ambient occlusion / architectural grounding**
   - derive from actual architecture/Shared Wall Graph;
   - preserve apertures;
   - FloorFX only;
   - tune at gameplay scale.

3. **Add usage/wear treatment**
   - authored/semantic use evidence, not random Ground variation;
   - Family Living activity zones;
   - Main Hall center traffic band;
   - Transfer Human approach / Robot exit;
   - PRIMUS work-slot/patrol logic once its floor exists.

4. **Complete Flow support integration**
   - finalize 128×128 candidate scale decision;
   - finalize Flow collision/use-space and grounding shadow;
   - add deterministic static Flow coupling bus as FloorFX;
   - keep later active synchronization on separate `transfer-fx`.

5. **PRIMUS hero/system wall object**
   - establish allocation/work-room identity;
   - competent, ordered, attractive rather than villain-black;
   - preserve open patrol/work center.

6. **Useful domestic replacements**
   - Child Bed;
   - Toy / personal storage;
   - minimal Hygiene fixture/support;
   - only named functional objects that materially improve habitation.

7. **Full-room cohesion and candidate disposition**
   - accept/revise/remove Coffee/Plants/Hologram in context;
   - remove obsolete blockouts;
   - tune environmental grounding/AO without reopening accepted PICO grounding absent a concrete defect;
   - tune floor-treatment intensity rather than adding random texture;
   - converge lighting with Transfer as primary warm local focus.

8. **Desktop + phone Gold-Slice QA**
   - room identity;
   - hierarchy;
   - readability;
   - movement/collision;
   - visual density;
   - Numberdroid identity;
   - explicit final acceptance.

9. **Only after the static Gold Slice reaches the representative quality bar:**
   - Human → Core → PICO choreography;
   - body → body Transfer choreography;
   - Core motion;
   - synchronization/beam/energy FX;
   - broader Transfer Ship content production.

---

## Floor-treatment thesis now binding for TS-01

The Transfer Ship should feel:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

A well-kept family home is a better cleanliness reference than a hospital/showroom.

The Floor pass should not be one global dirt texture. It should combine:

```text
shared Transfer-Ship material family
+ room-specific Ground variation
+ wall/contact AO
+ room/use-specific wear
+ functional FloorFX
```

Production is expected to be predominantly deterministic/M4 after visual source approval:

- semantic room identity chooses the Ground family;
- semantic tile metadata controls connector/topology-safe placement;
- Shared Wall Graph/architecture can drive static wall AO;
- activity/traffic zones drive wear masks;
- Flow endpoints drive exact FloorFX bus geometry;
- `LightOverlay` remains actual scene illumination.

Detailed contracts:

- `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

---

## Durable production lessons

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

- source design and runtime scale are separate;
- physical scale and Hero prominence are separate;
- do not regenerate an approved source merely to resize it;
- for directional actors, validate connected source/body geometry before tuning shadows;
- use automation to prevent impossible states, then store Human Live QA calibration explicitly as data;
- shadow should be frozen after useful runtime scale and live acceptance converge;
- PNG alpha is not gameplay collision authority;
- shaped collision may preserve transparent whitespace;
- movable components need not use static Prop lifecycle;
- accidental generated iconography is not semantic authority;
- **generated tile pixels are not semantic/topology authority**;
- line-bearing tiles require explicit connectors/continuity metadata before automatic placement;
- room access is not automatically corridor route topology;
- cuttable generated atlases require deterministic full-bleed extraction; presentation gutters/rounded sample frames are not runtime floor art;
- dirt/wear must communicate use/age rather than undirected noise;
- AO/grounding is not scene illumination.

---

## After TS-01 Gold Slice acceptance

Once Generated TS-01 passes as the representative quality bar:

1. implement/polish Transfer choreography using accepted Apparatus/Core authorities;
2. decide which art-production patterns become reusable Transfer Ship standards;
3. promote proven room-floor/AO/wear rules into reusable world/archetype rules if they survive QA;
4. promote proven level-design/Prop/tile metadata into reusable world/archetype rule sets;
5. build only additional robot bodies/utility categories needed by next playable content;
6. apply the accepted Actor Grounding Workflow to new directional bodies rather than re-deriving the process ad hoc;
7. stress the compiler with dense PRIMUS, larger ship and larger Bio-Ark/natural floors;
8. expand remaining Transfer Ship beats using compiler + proven art grammar;
9. run explicit Performance & Scale Pass before campaign-scale readiness;
10. write final Agent Authoring Guide last, after workflows stop changing materially.

---

## Deliberately open art/tool questions

Do not silently freeze:

- exact **remaining** Child/Hygiene/PRIMUS floor variants until live QA;
- exact AO falloff/opacity values;
- exact wear-mask algorithm/intensity;
- whether room-floor treatment becomes a reusable Level Compiler material-profile system after TS-01 proof;
- whether the semantic tile metadata schema should be generalized beyond current category-specific implementations after another floor family proves it;
- final PRIMUS system-object form;
- exact domestic micro-set needed for finished Family read;
- whether full-room cohesion reveals a concrete need for M3 layered retouching;
- whether later Transfer FX justify a dedicated animation compositor/tool.

Family Living, Main Hall and Transfer Room floor v1 are no longer open visual targets absent a concrete defect. Directional actor grounding is also no longer open; PICO established the production contract and explicit manual-calibration escape hatch.

---

## Current acceptance discipline

For art:

```text
recipe/method selected
→ source/algorithm produced
→ production QA
→ runtime integration
→ tests/build
→ deployed live QA
→ explicit acceptance
→ recipe/index/status update
```

For directional actor grounding add:

```text
source-integrity analysis
→ connected geometry
→ automated grounding candidate
→ explicit human calibration data
```

before final live acceptance.

For semantic modular floor/tile work add:

```text
tile inventory / semantic contract
→ approved cuttable source
→ deterministic extraction
→ per-cell metadata
→ topology-safe placement
→ regression tests
→ deployed live QA
```

For generated/procedural floor treatment, source approval may be replaced by explicit algorithm/material-variant review when no generative source is used.

For shared compiler/spatial contracts:

```text
contract/spec
→ deterministic implementation
→ automated regression coverage
→ generated TS-01 proof
→ deployed QA
→ explicit live acceptance
```

`Merged` is not `LIVE_ACCEPTED`; `asset accepted` is not `Floor Treatment accepted`; neither is `Gold Slice accepted`.
