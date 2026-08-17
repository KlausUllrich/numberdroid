# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — 2026-08-17 after Transfer Hero acceptance, Flow source integration and Floor-pass reprioritization**

`DEVELOPMENT_PLAN_NEXT.md` remains the project-level roadmap. `docs/game-design/LEVEL_DESIGN_RULES.md` owns durable spatial principles. `docs/level-generation/GOLD_SLICE_REGRESSION_GATES.md` owns the permanent v0.13.2 spatial/presentation regression contract.

Detailed current Floor treatment authority:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

The current task is **visual Gold-Slice completion**, not another architecture/compiler migration and not yet a Transfer-animation production block.

---

# 1. Gold Slice target

TS-01 succeeds when the **generated** Transfer Hall feels like a believable, attractive Numberdroid place and a representative quality bar rather than a diagram of gameplay functions.

The generated Floor must preserve:

- comfortable top-down movement;
- clear Family → Hall → Transfer / PRIMUS progression;
- Transfer as the strongest environmental Hero hierarchy;
- Family/PRIMUS spatial and cultural contrast;
- **room identity that remains readable even before Props are considered**;
- desktop and phone readability;
- accepted spatial/runtime behavior;
- accepted art assets unless a concrete defect requires deliberate revision.

The room is structurally functional but still visually sparse/flat. The current art-direction finding is that **room-specific floor identity, grounding and lived-in material variation are now one of the highest-leverage missing ingredients**. Making the Gold Slice look finished remains the current milestone.

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

# 3. Accepted art baseline and current candidates

## Frozen / accepted

- **PICO** — LIVE_ACCEPTED source/turnaround baseline;
- **Floor base material** — accepted baseline; the new Floor Treatment is an additive room-identity / AO / wear pass, not permission to discard the base family;
- **Walls / Architecture** — LIVE_ACCEPTED 30 px M4 wall kit;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED;
- **Transfer Apparatus + shadow + silhouette collision** — LIVE_ACCEPTED;
- **Yellow Core static resting state** — LIVE_ACCEPTED at 96×96 on a separate `transfer-fx` layer.

Accepted categories remain frozen unless live QA exposes a concrete defect or a deliberate revision is approved.

## Current live / runtime candidates

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow;
- **Flow Regulator** — source approved + byte-identically archived; 128×128 runtime candidate integrated, live scale QA still pending because GitHub Pages deployment is currently unavailable.

Candidate status does not imply rejection; it means final room-context acceptance is still outstanding.

## Current visually underdeveloped systems / blockouts

- **room-specific floor materials / treatment**;
- **wall ambient occlusion / architectural grounding**;
- **subtle use/wear/dirt variation tied to room function**;
- **Transfer Hero floor anchoring / service registration**;
- **Flow shadow/collision refinement and deterministic FloorFX bus**;
- **PRIMUS allocation/service-bank hero/system object**;
- **Child Bed**;
- **Toy / personal storage**;
- **Hygiene fixture/support**;
- any surviving blockout that remains functionally necessary after composition review.

---

# 4. Accepted Layout-v3 spatial thesis

```text
DOMESTIC CLUSTER
  family-living
  + family-child
  + family-hygiene
        │
        ↓
MAIN HALL
  ├────────→ PRIMUS ALLOCATION / WORK ROOM
  │             controlled door
  │
  └────────↓
         TRANSFER ROOM
         destination / ritual / hero chamber
```

Do not return to an equal horizontal `Family | Transfer | PRIMUS` panel layout.

Rationality gradient:

```text
Family dwelling  → adapted, layered, personal, slightly inefficient
Hall             → connective, legible, restrained
Transfer room    → deliberate destination, strongest local hierarchy/symmetry
PRIMUS room      → efficient, aligned, modular
```

**The Floor Treatment should reinforce this gradient**, not flatten it into one repeated ship texture.

---

# 5. Room composition + floor identity rules

The short Transfer-Ship floor thesis is:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

A well-kept home with children is a better reference for cleanliness than a hospital or showroom: regularly cleaned, clearly cared for, but small marks, scuffs, duller traffic zones and occasional stains remain.

Detailed treatment lives in:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

## Family Living

Composition:

- Family Table remains anchor;
- Memory Console/Coffee remain supported or wall-related;
- preserve breathing/use space around Table;
- domestic composition should not become perfectly optimized.

Floor:

- warmer civilian floor identity;
- calm medium/large panel rhythm;
- modest material/value irregularity;
- plausible small everyday marks around real use zones;
- more lived-in than PRIMUS, never grimy.

## Child room

Composition:

- add only assets that materially prove actual habitation: Child Bed, toy/personal storage, optional one additional personal cue if needed.

Floor:

- related to Family Living but slightly softer/warmer or more human-scaled;
- somewhat more micro-scuffing/use evidence;
- avoid childish decal clichés.

## Hygiene room

Composition:

- minimum art needed for immediate hygiene read.

Floor:

- slightly cooler/denser/non-slip material character;
- cleaner than Family Living but not sterile white;
- very subtle cleaning/water variation may be used.

## Main Hall

Composition:

- keep comparatively uncluttered so Family → Transfer/PRIMUS branching remains obvious.

Floor:

- robust neutral circulation material;
- seam/panel direction may support movement flow;
- high-traffic wear follows the center circulation band;
- do not turn the hall into a glowing navigation UI.

## PRIMUS allocation/work room

Composition:

- controlled, aligned, modular work-space character;
- wall-backed system/service objects;
- open center for robots/patrol;
- competent/attractive, not generic evil-black machinery.

Floor:

- slightly cooler and more systematic;
- precise modular grid / registration logic;
- less random dirt;
- wear follows work slots and patrol paths;
- restrained teal/cyan functional marks are allowed.

## Transfer room

The accepted 4×6 Apparatus owns the room.

Composition:

- preserve intentional open space around it;
- Yellow Core remains centered on its resting platform in static state;
- Hologram/Flow/support read as one coherent Transfer cluster;
- additional effects support rather than bury the Hero;
- normal movement collision remains the accepted authored silhouette contract.

Floor:

- premium deliberate service/ritual floor identity;
- strongest large-scale alignment around the Hero;
- dedicated installed/service-panel anchoring zone beneath/around the Apparatus;
- strongest but still subtle static architectural grounding/AO in the slice;
- wear on Human approach and Robot exit paths;
- Flow Regulator + deterministic Flow bus integrated into the same system;
- cyan may communicate support/status; amber remains subordinate to Core/Transfer activity.

---

# 6. CURRENT production sequence — finish the Gold Slice first

## COMPLETED — Asset Block A: Transfer Apparatus + Yellow Core

```text
Transfer Apparatus: 4×6 Hero / source + runtime + shadow + collision LIVE_ACCEPTED
Yellow Core:        96×96 separate movable transfer-fx resting state LIVE_ACCEPTED
```

See:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

Do not continue polishing those static assets while surrounding room language remains unfinished.

## ACTIVE DEPENDENCY — Flow Regulator runtime scale QA

Current Flow state:

```text
source                  APPROVED + ARCHIVED
runtime candidate       128 × 128 px
visible content         111 × 112 px
art registry            candidate
live scale QA           pending
shadow                   pending live-scale decision
collision refinement     pending live-scale/use-space decision
static Flow bus           pending Floor Treatment integration
```

This QA should happen as soon as GitHub Pages deployment is available again, but it does **not** block design/production preparation of the general Floor Treatment.

## CURRENT — Asset Block B: Floor identity / AO / wear + Transfer floor integration

This block has been promoted ahead of additional Hero/Prop production because current live review found the repeated flat floor treatment one of the clearest remaining visual weaknesses.

Detailed brief:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

### B1 — Room-specific Ground identities

Create distinct but related floor treatment for:

- Family Living;
- Child;
- Hygiene;
- Main Hall;
- Transfer Room;
- PRIMUS Allocation.

Rooms should be distinguishable by floor character without labels, while remaining one coherent Transfer Ship material family.

### B2 — Static wall ambient occlusion / architectural grounding

Add a deterministic short-range FloorFX AO treatment derived from actual wall/architecture geometry.

Rules:

- subtle interior-side falloff;
- slightly stronger corners allowed;
- no fake AO across open door apertures;
- no collision semantics;
- no scene-light claim;
- do not double-darken Prop shadows excessively.

### B3 — Usage / wear / dirt treatment

Use **usage evidence rather than generic grunge**:

- traffic wear follows real circulation;
- Family gets slightly more everyday irregularity;
- PRIMUS gets more systematic work-slot/patrol wear;
- Transfer gets Human approach / Robot exit usage;
- rare small stains/scuffs only where plausible;
- no obvious repeated dirt tiles;
- no rust/oil/industrial grime as the normal baseline.

### B4 — Transfer Hero floor anchoring

Give the Apparatus an installed relationship to the room through service panels, inset/registration geometry and grounded AO rather than a decorative carpet or giant glowing ring.

### B5 — Complete Flow floor relationship

Once Flow live scale is accepted:

- finalize Flow collision/use-space;
- derive/author Flow grounding shadow;
- create deterministic short coupling/service bus between Flow and Apparatus;
- keep static bus in FloorFX;
- reserve later animated synchronization for `transfer-fx`.

## NEXT — Asset Block C: PRIMUS hero/system wall object

After the floor pass establishes room identity and the Transfer support cluster is coherent:

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

Once the major missing production assets exist:

1. review Coffee Machine, Round Plant, Planter Trough and Hologram in complete composition;
2. explicitly accept/revise/remove each candidate;
3. remove obsolete blockouts;
4. tune shadows/contact grounding;
5. tune Floor-treatment intensity rather than adding new random dirt;
6. converge lighting hierarchy with Transfer as primary restrained warm local focus;
7. verify Family feels lived-in and PRIMUS ordered without visual noise;
8. do not casually repaint accepted Walls/Base-Floor family.

## GATE — Asset Block F: Gold-Slice live acceptance

Run generated TS-01 as one finished room:

- desktop QA;
- phone landscape QA;
- movement/collision QA;
- hierarchy/readability QA;
- floor/room-identity QA;
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

# 7. Floor production authority / implementation direction

The Floor Treatment is expected to be predominantly deterministic/procedural rather than generated as one large painted image.

Recommended authority split:

```text
Base room material variants    Ground / deterministic material set
Room assignment                LevelSpec space identity / semantic room tags
Wall AO                        Shared Wall Graph / architecture-derived FloorFX
Wear masks                     semantic activity/traffic zones + seeded deterministic variation
Prop grounding                 separate Prop shadow / contact FloorFX
Transfer Hero floor anchor     authored deterministic Ground/FloorFX composition
Flow bus                       exact Prop relationship → deterministic FloorFX
Scene illumination             LightOverlay
```

Do not use image generation to guess wall AO, traffic masks, door openings or exact Flow endpoints.

---

# 8. Production / iteration rules reinforced by Transfer Hero work

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

Additional rules:

- physical size and Hero prominence are separate;
- PNG alpha is not collision authority;
- shaped collision can preserve transparent playable whitespace;
- finalize useful runtime scale before freezing a shadow;
- movable components need not use static Prop lifecycle;
- new diegetic symbols require explicit semantic authority;
- **dirt/wear should communicate use and age, not exist as undirected visual noise.**

---

# 9. Generated runtime integration rule

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

Ground/FloorFX never become implicit gameplay collision authority.

---

# 10. Gold-Slice visual QA gate

## Room identity

- Can Family / Hall / Transfer / PRIMUS be distinguished by floor character without floating labels?
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

## Runtime coherence

- Do sprites/shadows/AO/collision align?
- Do accepted Walls/Doors remain correct?
- Are door apertures free of false wall AO?
- Does no new FloorFX alter Door Clearance/use-space/navigation?

## Gameplay scale

- Do functions read on desktop?
- Do room identities and AO survive phone landscape without becoming muddy?
- Is density rich enough without noise?

## Numberdroid identity

- avoid generic dark military sci-fi;
- keep CORE/SLOT/Transfer grammar recognizable;
- Transfer should feel empowering;
- Family should feel lived-in;
- PRIMUS should feel competent/systematic;
- floor ageing should suggest maintained history rather than decay.

---

# 11. Exit criteria

Generated TS-01 is Gold-Slice accepted only when:

1. important semantic blockouts are replaced or deliberately removed;
2. room-specific floor identity / AO / wear are coherent and accepted;
3. Transfer/Flow/PRIMUS hierarchy is visually coherent;
4. Family spaces read as inhabited with a deliberately limited asset set;
5. candidate Family art has explicit disposition;
6. accepted spatial/runtime regression gates remain green;
7. desktop and phone live QA pass;
8. Klaus explicitly accepts the room as the representative quality bar.

Only then decide whether Generated TS-01 replaces the hand-authored reference as canonical campaign Floor.

`CI green`, `merged`, `deployed`, `spatially accepted`, `asset accepted`, `floor treatment accepted` and `Gold Slice accepted` remain distinct states.
