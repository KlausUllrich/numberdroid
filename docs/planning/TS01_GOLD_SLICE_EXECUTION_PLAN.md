# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — 2026-08-20 after Family Living, Transfer Room and Main Hall floor v1 live acceptance**

`DEVELOPMENT_PLAN_NEXT.md` remains the project-level roadmap. `docs/game-design/LEVEL_DESIGN_RULES.md` owns durable spatial principles. `docs/level-generation/GOLD_SLICE_REGRESSION_GATES.md` owns the permanent v0.13.2 spatial/presentation regression contract.

Current Floor-treatment authorities:

- `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

The current task is **static visual Gold-Slice completion**, not another architecture/compiler migration and not yet a Transfer-animation production block.

---

# 1. Gold Slice target

TS-01 succeeds when the **generated** Transfer Hall feels like a believable, attractive Numberdroid place and a representative quality bar rather than a diagram of gameplay functions.

The generated Floor must preserve:

- comfortable top-down movement;
- clear Family → Hall → Transfer / PRIMUS progression;
- Transfer as the strongest environmental Hero hierarchy;
- Family/PRIMUS spatial and cultural contrast;
- room identity that remains readable even before Props are considered;
- desktop and phone readability;
- accepted spatial/runtime behavior;
- accepted art assets unless a concrete defect requires deliberate revision.

The structural/runtime baseline is accepted. Current work is about **room identity, architectural grounding, lived-in/use evidence, missing room art and final cohesion**.

---

# 2. Accepted spatial / runtime baseline

v0.13.2 was explicitly accepted on 2026-08-16.

Preserve:

- semantic Layout-v3 room sequence;
- Shared Wall Graph / real apertures;
- 30 px visible wall fascia / 10 px collision core;
- accepted Door contract: 5 px leaf, aperture clipping, 520 ms open, 650 ms soft close;
- widened Door Clearance and clean thresholds;
- true-space Exact Fit with minimum sub-tile correction;
- multipart / silhouette Prop collision where authored;
- wall-safe fallback blockouts;
- safe-interior patrol preference;
- persistent Trigger/Event/access behavior.

A smaller player-model/presentation issue is known and deliberately deferred. It must not trigger unrequested PICO regeneration.

---

# 3. Accepted art baseline

Frozen unless live QA exposes a concrete defect or a deliberate revision is approved:

- **PICO source/turnaround** — LIVE_ACCEPTED;
- **PICO physical grounding** — LIVE_ACCEPTED; reusable process in `docs/art/production/ACTOR_GROUNDING_WORKFLOW.md`;
- **Floor base material family** — ACCEPTED BASELINE;
- **Family Living floor v1** — LIVE_ACCEPTED;
- **Main Hall floor v1** — LIVE_ACCEPTED;
- **Transfer Room floor / Hero anchoring v1** — LIVE_ACCEPTED;
- **Walls / Architecture** — LIVE_ACCEPTED 30 px M4 wall kit;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED;
- **Transfer Apparatus + shadow + silhouette collision** — LIVE_ACCEPTED;
- **Yellow Core static resting state** — LIVE_ACCEPTED at 96×96 on separate `transfer-fx` layer.

Current room-context candidates:

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow;
- **Flow Regulator** — source approved + archived; 128×128 runtime candidate visible in live TS-01, but final scale/shadow/collision/use-space/bus acceptance remains open.

---

# 4. Floor-treatment progress snapshot

## B1 — Room-specific Ground identities

| Room | Status | Current note |
|---|---|---|
| Family Living | **LIVE_ACCEPTED v1** | warm civilian/lived-in family material; already integrated before the current Main Hall/Transfer passes |
| Family Child | **OPEN** | currently inherits domestic/family treatment; still needs its own softer/personal identity |
| Family Hygiene | **OPEN** | currently inherits domestic/family treatment; still needs cooler functional/non-slip identity |
| Main Hall | **LIVE_ACCEPTED v1** | calm robust circulation floor; one longitudinal spine; room accesses are thresholds, not route branches |
| Transfer Room | **LIVE_ACCEPTED v1** | approved 6×6 atlas; calm premium floor and installed Hero anchor around Apparatus |
| PRIMUS Allocation | **OPEN** | still requires ordered/cool/systematic floor identity |

Therefore B1 is **3/6 room identities accepted**.

## B2 — Static wall ambient occlusion / architectural grounding

Status: **OPEN**.

Add deterministic short-range FloorFX AO derived from actual architecture / Shared Wall Graph.

Rules:

- subtle interior-side falloff;
- slightly stronger corners allowed;
- no fake AO across open apertures;
- no collision semantics;
- no scene-light claim;
- do not double-darken Prop shadows excessively.

## B3 — Usage / wear / dirt treatment

Status: **OPEN**.

Use usage evidence rather than generic grunge:

- Family activity zones;
- Main Hall center circulation band;
- Transfer Human approach / Robot exit;
- PRIMUS work-slot/patrol wear after PRIMUS floor exists;
- rare plausible small stains/scuffs only;
- no obvious repeated dirt tiles;
- no rust/oil/industrial grime as normal baseline.

Main Hall live QA specifically proved that random service/wear Ground variation can make a narrow space read as patchwork. Contextual wear should therefore prefer authored/semantic FloorFX rather than arbitrary tile selection.

## B4 — Transfer Hero floor anchoring

Status: **COMPLETED / LIVE_ACCEPTED v1**.

The Apparatus now has an installed relationship to the room through a dedicated floor family / anchoring zone rather than sitting on generic repeated floor.

Future AO/wear/Flow effects may refine the room, but do not reopen the accepted base/anchor without a concrete defect.

## B5 — Complete Flow floor relationship

Status: **PARTIAL / OPEN**.

Still required:

- final Flow scale decision;
- Flow collision/use-space finalization;
- Flow grounding shadow;
- deterministic short coupling/service bus between Flow and Apparatus;
- static bus in FloorFX;
- later active synchronization remains `transfer-fx` work after Gold Slice gate.

---

# 5. Main Hall v1 — accepted semantic tile proof

Main Hall established a reusable production rule for modular semantic floors.

Binding contract:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Accepted Main Hall behavior:

- one calm longitudinal circulation spine;
- room doors/openings are material thresholds;
- a room access is **not** a corridor-route T-junction;
- T/cross/corner graphics are reserved for true corridor-to-corridor topology changes;
- multi-tile apertures do not create one branch per aperture tile;
- the Transfer threshold does not create a false route terminal before the room;
- non-route Main Hall cells use a calm base rather than random service/wear tiles;
- generated source-card frames/background are removed during deterministic full-bleed materialization;
- all 36 atlas cells have explicit semantic metadata;
- uncalibrated alternatives remain archived but are quarantined from automatic placement;
- canonical T/corner rotations provide complete directional coverage when needed.

Reference implementation:

- `src/levelgen/mainHallFloorTileMetadata.ts`
- `src/levelgen/mainHallFloorVisualPolicy.ts`
- `src/levelgen/mainHallFloorPresentation.ts`
- `src/levelgen/mainHallFloorPresentation.test.ts`
- `scripts/materialize-main-hall-floor.mjs`

Do not collapse this back into raw-index random selection.

---

# 6. Room composition + floor identity rules

The short Transfer-Ship floor thesis remains:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

## Family Living — accepted floor baseline

Composition:

- Family Table remains anchor;
- Memory Console/Coffee remain supported or wall-related;
- preserve breathing/use space around Table;
- domestic composition should not become perfectly optimized.

Floor v1 is accepted. Future work should add contextual use/wear through B3 rather than regenerate the base family absent a concrete defect.

## Child room — next domestic floor identity

Composition:

- add only assets that materially prove habitation: Child Bed, toy/personal storage, optional one additional personal cue if needed.

Floor target:

- related to Family Living but slightly softer/warmer or more human-scaled;
- somewhat more micro-scuffing/use evidence;
- avoid childish decal clichés.

## Hygiene room — next functional floor identity

Composition:

- minimum art needed for immediate hygiene read.

Floor target:

- slightly cooler/denser/non-slip material character;
- cleaner than Family Living but not sterile white;
- very subtle cleaning/water variation may be used.

## Main Hall — accepted floor baseline

Composition:

- comparatively uncluttered so Family → Transfer/PRIMUS branching remains obvious.

Floor v1 is accepted:

- neutral robust circulation material;
- one calm directional center spine;
- thresholds communicate room access;
- no glowing navigation UI;
- usage wear is a later contextual FloorFX pass, not random Ground noise.

## PRIMUS allocation/work room — still open

Composition:

- controlled, aligned, modular work-space character;
- wall-backed system/service objects;
- open center for robots/patrol;
- competent/attractive, not generic evil-black machinery.

Floor target:

- slightly cooler and more systematic;
- precise modular grid / registration logic;
- less random dirt;
- wear follows work slots and patrol paths;
- restrained teal/cyan functional marks are allowed.

## Transfer room — accepted base/anchor baseline

The accepted 4×6 Apparatus owns the room.

Preserve:

- intentional open space around it;
- Yellow Core centered on resting platform in static state;
- Hologram/Flow/support as one coherent Transfer cluster;
- normal movement collision as accepted authored silhouette contract;
- accepted premium floor family and Hero anchoring zone.

Still add later:

- B2 wall/architectural AO;
- B3 Human approach / Robot exit wear;
- B5 Flow shadow/collision/bus.

---

# 7. CURRENT production sequence — finish the Gold Slice first

## COMPLETED — Asset Block A: Transfer Apparatus + Yellow Core

```text
Transfer Apparatus: 4×6 Hero / source + runtime + shadow + collision LIVE_ACCEPTED
Yellow Core:        96×96 separate movable transfer-fx resting state LIVE_ACCEPTED
```

## ACTIVE — Asset Block B: finish Floor / environment treatment

### B1 room identities

```text
Family Living   DONE
Main Hall       DONE
Transfer Room   DONE
Child           NEXT
Hygiene         NEXT
PRIMUS          NEXT
```

Use the semantic tile metadata trigger before any further directional/topological atlas production.

### B2 wall AO

OPEN after/alongside remaining room identities.

### B3 usage/wear

OPEN after enough room/material context exists to place use evidence intentionally.

### B4 Transfer Hero floor anchoring

DONE / LIVE_ACCEPTED v1.

### B5 Flow floor relationship

PARTIAL / OPEN.

## NEXT — Asset Block C: PRIMUS hero/system wall object

After/with PRIMUS floor identity:

- precise, attractive, competent;
- communicates assignment/order/system control;
- ceramic/light-neutral + graphite with restrained teal/cyan status language;
- no frontal cabinet/side-view logic;
- no villain-black cliché;
- preserve open patrol/work center;
- wall protrusion/collision remains authored metadata.

Use/revise:

`art-source/recipes/transfer-hall/primus-console/recipe.md`

## NEXT — Asset Block D: useful domestic replacements

Only named functional objects that materially improve habitation:

- Child Bed;
- Toy / personal storage;
- Hygiene fixture/support;
- any surviving necessary placeholder.

Prefer a few convincing objects over generic density.

## NEXT — Asset Block E: full-room cohesion / candidate disposition

Once major missing production assets exist:

1. review Coffee Machine, Round Plant, Planter Trough and Hologram in complete composition;
2. explicitly accept/revise/remove each candidate;
3. remove obsolete blockouts;
4. tune shadows/contact grounding;
5. tune AO/wear intensity rather than adding random dirt;
6. converge lighting hierarchy with Transfer as primary restrained warm local focus;
7. verify Family feels lived-in and PRIMUS ordered without visual noise;
8. do not casually repaint accepted Family Living/Main Hall/Transfer floor v1 baselines.

## GATE — Asset Block F: Gold-Slice live acceptance

Run generated TS-01 as one finished slice:

- desktop QA;
- phone landscape QA;
- movement/collision QA;
- hierarchy/readability QA;
- floor/room-identity QA;
- AO/wear QA;
- blockout audit;
- final Art-Director/gameplay acceptance.

Only after this gate should Generated TS-01 be considered the representative Gold Slice.

## AFTER THIS GATE — Transfer choreography / animation polish

Then proceed to:

- Human → Core → PICO choreography;
- body → body Transfer choreography;
- Core movement;
- synchronization/beam/energy FX;
- scripted actor placement/collision overrides during Transfer.

---

# 8. Floor production authority / implementation direction

Recommended authority split:

```text
Base room material variants    Ground / deterministic material set
Room assignment                LevelSpec space identity / semantic room tags
Tile meaning/connectors        explicit semantic tile metadata
Route topology request         actual corridor/Level semantics
Wall AO                        Shared Wall Graph / architecture-derived FloorFX
Wear masks                     semantic activity/traffic zones + deterministic authored variation
Prop grounding                 separate Prop shadow / contact FloorFX
Transfer Hero floor anchor     accepted authored Ground composition + later FloorFX refinement
Flow bus                       exact Prop relationship → deterministic FloorFX
Scene illumination             LightOverlay
```

Do not use image generation to guess wall AO, traffic masks, door openings, Flow endpoints or route topology.

For modular atlases:

```text
define tile inventory + semantics
→ generate cuttable source
→ archive approved source unchanged
→ deterministic crop/full-bleed materialization
→ explicit per-cell metadata
→ semantic placement
→ tests
→ deployed live QA
```

Pixels never silently become topology authority.

---

# 9. Production / iteration rules

Every visual issue must first be classified:

```text
FUNCTION / SOURCE DESIGN
PERSPECTIVE / STYLE
RUNTIME CROP / SCALE / PADDING
PLACEMENT / ROOM COMPOSITION
COLLISION / USE-SPACE
SHADOW / GROUNDING
MOVABLE FX / CHOREOGRAPHY
```

Only source/function/perspective failures normally justify another source generation. Runtime scale/collision/shadow/floor-layout problems should use deterministic production/runtime tools first.

Additional binding rules:

- physical size and Hero prominence are separate;
- PNG alpha is not collision authority;
- shaped collision can preserve transparent playable whitespace;
- finalize useful runtime scale before freezing a shadow;
- movable components need not use static Prop lifecycle;
- new diegetic symbols require explicit semantic authority;
- dirt/wear should communicate use and age, not exist as undirected visual noise;
- generated atlas gutters/rounded presentation cards are not runtime floor art;
- line-bearing tiles may not pseudo-randomly alternate unless connector/continuity metadata guarantees compatibility;
- room access and corridor-route topology are distinct concepts.

---

# 10. Generated runtime integration rule

```text
Ground — room material identity
→ FloorFX — AO / wear overlays / shadows / functional floor marks
→ Architecture
→ WallProp fallback / production WallProps
→ FloorProp fallback / production FloorProps
→ transfer-fx / explicit movable visuals
→ runtime Characters / interaction layers
→ LightOverlay
```

Normal Prop presentation uses `src/levelgen/propArtRegistry.ts`.

Spatial truth remains in:

- `propRegistry.ts`;
- `propCollisionRegistry.ts`;
- Exact-Fit metadata/validation;
- semantic LevelSpec/placement.

Ground/FloorFX/tile metadata never become implicit gameplay collision authority.

---

# 11. Gold-Slice visual QA gate

## Room identity

- Can Family / Hall / Transfer / PRIMUS be distinguished by floor character without floating labels?
- Do Child and Hygiene read as distinct functions while remaining domestic relatives?
- Do all rooms still belong to one Transfer Ship?
- Does the ship feel maintained and used rather than sterile or dirty?

## Hierarchy

- Is Transfer unmistakably strongest environmental focal point?
- Do Flow/support/floor anchoring reinforce rather than compete with it?
- Does Family remain personal/warmer?
- Does PRIMUS read ordered/competent without stealing Hero role?

## Spatial plausibility

- Are objects placed where humans/robots plausibly use them?
- Are thresholds clean?
- Are support objects coherent clusters?
- Does transparent space around silhouettes remain navigable?
- Does wear appear where actual traffic/activity occurs?
- Do route graphics reflect actual corridor topology rather than every room access?

## Runtime coherence

- Do sprites/shadows/AO/collision align?
- Do accepted Walls/Doors remain correct?
- Are door apertures free of false wall AO?
- Does no new FloorFX alter Door Clearance/use-space/navigation?
- Do semantic tile connectors/rotations remain deterministic and regression-tested?

## Gameplay scale

- Do functions read on desktop?
- Do room identities and AO survive phone landscape without becoming muddy?
- Is density rich enough without noise?
- Are repeated tile patterns acceptable at normal play scale?

## Numberdroid identity

- avoid generic dark military sci-fi;
- keep CORE/SLOT/Transfer grammar recognizable;
- Transfer should feel empowering;
- Family should feel lived-in;
- PRIMUS should feel ordered/competent rather than evil by default.

---

# 12. Acceptance discipline

For a room floor/tile family:

```text
tile contract / room intent
→ source or deterministic material proposal
→ source approval/archive when generative
→ deterministic materialization
→ semantic metadata when topology/direction matters
→ runtime integration
→ tests/build
→ deployed live QA
→ explicit acceptance
→ recipe/plan/index update
→ freeze absent concrete defect
```

Current accepted floor v1 baselines are **Family Living, Main Hall and Transfer Room**. They must not remain listed as unfinished work in future handoffs/plans.
