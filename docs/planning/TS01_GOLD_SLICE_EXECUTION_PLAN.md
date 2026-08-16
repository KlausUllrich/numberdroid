# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — Layout v3 + v0.13.2 spatial stabilization accepted; production Art Parity is CURRENT — 2026-08-16**

`DEVELOPMENT_PLAN_NEXT.md` remains the project-level roadmap. `docs/game-design/LEVEL_DESIGN_RULES.md` owns durable spatial principles. `docs/level-generation/GOLD_SLICE_REGRESSION_GATES.md` owns the permanent v0.13.2 spatial/presentation regression contract.

Acceptance record:

`docs/level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`

---

# 1. Gold Slice target

TS-01 succeeds when the **generated** Transfer Hall feels like a believable Numberdroid place and a representative quality bar rather than a diagram of gameplay functions.

The room must preserve:

- comfortable top-down movement;
- clear Family → Hall → Transfer / PRIMUS progression;
- strong Transfer hero hierarchy;
- Family/PRIMUS spatial contrast;
- desktop and phone readability;
- accepted spatial/runtime behavior;
- accepted art assets unless a concrete defect requires revision.

The visual reference remains a **density/composition reference, not a footprint template**. More square meters are acceptable when they improve staging, navigation and plausibility.

The generated Floor must not replace the hand-authored reference merely because it compiles or because v0.13.2 passed. Replacement requires final feature/art parity plus explicit live visual/gameplay acceptance.

---

# 2. Accepted spatial / runtime baseline

The v0.13.2 stabilization pass was explicitly accepted by Klaus on **2026-08-16**.

Preserve:

- semantic Layout-v3 room sequence;
- Shared Wall Graph / real apertures;
- 30 px visible wall fascia / 10 px collision core;
- accepted Door contract: 5 px leaf, aperture clipping, 520 ms open, 650 ms soft close;
- widened Door Clearance and clean thresholds;
- true-space Exact Fit with minimum sub-tile correction;
- multipart Family Table collision;
- 0.70 × 0.70 Hologram pedestal collision;
- wall-safe fallback blockouts;
- safe-interior preference for sufficiently large single-room patrol routes;
- normal generated Trigger/Event/access behavior.

Do not reopen these systems to solve an ordinary art-production problem.

A smaller issue with the player's own in-game model/presentation is known and deliberately deferred for separate discussion. It is not part of this Art Asset block and must not trigger an unrequested PICO regeneration/revision.

---

# 3. Accepted / candidate art baseline

## Frozen / accepted

- **PICO** — LIVE_ACCEPTED source/turnaround baseline;
- **Floor** — accepted baseline;
- **Walls / Architecture** — LIVE_ACCEPTED 30 px M4 wall kit;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED.

Accepted categories remain frozen unless live QA exposes a concrete defect or Klaus explicitly approves a bounded revision.

## Current live candidates

- Coffee Machine + shadow;
- Planter Trough + shadow;
- Round Plant + shadow;
- Hologram Pedestal + shadow.

v0.13.2 acceptance confirms that their generated spatial/runtime integration is stable. It does **not** automatically promote their visual review status; they remain `LIVE_CANDIDATE` until explicit Art-Director acceptance.

## Current blockouts / missing production art

The generated Floor still uses provisional/fallback presentation for several semantically real Props, notably:

- Transfer Core / apparatus;
- Flow Station / support;
- PRIMUS Service Banks / hero system object;
- Child Bed;
- Toy / personal storage;
- Toilet / hygiene fixture;
- any additional composition placeholder that survives final usefulness review.

Blockout identity is semantic. Replacing a fallback with production art must not create a new unrelated gameplay object.

---

# 4. Accepted Layout-v3 spatial thesis

The generated level is intentionally a sequence of places:

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

Do not return to the old equal horizontal `Family | Transfer | PRIMUS` panel layout.

## Rationality gradient

```text
Family dwelling  → adapted, layered, slightly inefficient
Hall             → connective, legible, restrained
Transfer room    → deliberate destination, strongest local symmetry
PRIMUS room      → efficient, aligned, modular
```

This contrast is both level design and worldbuilding.

---

# 5. Spatial composition rules that remain binding during Art Parity

## Family Living

- Family Table remains the anchor;
- Memory Console and Coffee Machine remain supported/wall-related rather than floating;
- no plant may obscure wall furniture;
- preserve usable breathing space around the Table;
- domestic composition should not become perfectly symmetrical or optimized.

## Child room

Purpose is to prove habitation, not merely waiting-room use.

Production art should only be added when it improves that read:

- child bed;
- toy/personal storage;
- optional personal/soft item only if composition needs it.

Do not fill the room with generic clutter.

## Hygiene room

- retain a simple recognizable hygiene function;
- use the least amount of art needed to make the room read correctly;
- do not turn sanitary detail into a new production subproject unless live composition shows it is necessary.

## Main Hall

- keep comparatively uncluttered;
- preserve immediate route readability;
- ordinary props must not consume threshold breathing space.

## PRIMUS allocation/work room

- controlled, aligned, modular work-space character;
- wall-backed system/service objects;
- open center for robots and patrol;
- PRIMUS should look competent and attractive, not generic evil-black machinery;
- no hero/service object beside the controlled doorway merely because a tile is free.

## Transfer room

- Transfer apparatus owns the strongest hierarchy;
- open space around hero machinery is intentional;
- Hologram belongs to the Transfer cluster, away from thresholds;
- Flow/support should visibly relate to the Transfer apparatus rather than read as independent decoration;
- restrained symmetry is appropriate here more than in Family space.

---

# 6. CURRENT production sequence — new Art Assets

The next work is **Art production**, not another topology or Exact-Fit redesign.

## Asset Block A — Transfer Apparatus / Core hero

This is the highest-priority missing asset.

Purpose:

- primary environmental hero object in TS-01;
- make Transfer look desirable, precise and empowering before the later narrative reversal;
- make CORE/SLOT visual grammar unmistakable;
- create the visual center that the rest of the room can support.

Before generation/editing:

1. update/complete `art-source/recipes/transfer-hall/transfer-apparatus/recipe.md`;
2. select method using `METHOD_SELECTION_GATE.md`;
3. define visual geometry, collision authority, effect/shadow ownership and runtime integration plan;
4. do not treat the current blockout silhouette as automatically final geometry;
5. generate/edit exactly one source before QA when image generation is used.

Production constraints:

- strict orthographic / ND-compatible top-down environment view;
- coherent multi-tile hero object, not a generic icon;
- warm amber CORE/emissive source;
- maintained civilian ceramic/graphite machinery;
- local emissive pixels are allowed, scene illumination belongs to `LightOverlay`;
- visual footprint, physical collision and Hero clearance remain separate contracts.

## Asset Block B — Flow support + FloorFX

After the Transfer hero establishes scale/material/hierarchy:

- design Flow as a clear support system of the hero;
- use floor-projected path/grounding only where it communicates function;
- FloorFX is not scene lighting;
- avoid decorative route lines without a functional reason;
- keep Hero clearance and circulation intact.

## Asset Block C — PRIMUS hero/system wall object

Produce the missing high-quality PRIMUS allocation/service object after the Transfer visual hierarchy is established.

Requirements:

- precise and attractive;
- communicates assignment/order/competence;
- light ceramic + graphite construction with restrained teal semantic status;
- no frontal side-view cabinet logic;
- no villain-black cliché;
- wall attachment/protrusion and runtime collision are explicit spatial metadata, not inferred from the raster.

Use or revise `art-source/recipes/transfer-hall/primus-console/recipe.md` before production.

## Asset Block D — useful domestic replacements

Only after the two major hero/system areas are working, replace blockouts that materially improve the Family read:

- Child Bed;
- Toy / personal storage;
- Hygiene fixture;
- other surviving blockout only when it has a named function.

Prefer a few convincing objects over generic density.

## Asset Block E — cohesion / finishing

After hero and support art exists:

- restrained grounding/contact shadows;
- Flow path/marking if functionally justified;
- subtle floor use/wear where it supports room function/history;
- lighting convergence with Transfer as the primary restrained warm local focus;
- remove obsolete blockouts;
- verify the candidate Family props in the complete composition and either accept, revise or leave candidate deliberately.

Do not repaint accepted Floor/Walls merely because other assets become richer.

---

# 7. Production method / authority rule

Every new category follows:

```text
ART TARGET
→ recipe updated first
→ method selected
→ geometry authority declared
→ material authority declared
→ alpha/background authority declared
→ collision/placement authority declared
→ source generation/edit
→ SOURCE QA
→ production extraction/build
→ PRODUCTION QA
→ Prop Art Registry / runtime integration
→ live QA
→ explicit acceptance
→ recipe/index update
```

Use the method because its authority model fits the asset:

- expressive unique source → commonly M1;
- deterministic shape + controlled material pass → M2;
- supervised local layered finishing → M3 only after a reliable editor capability exists;
- topology/geometry-critical modular construction → M4.

Do not force M4 onto an expressive unique hero merely because Walls/Doors succeeded with it, and do not give M1 topology/collision authority merely because a generated image looks good.

`QA`, `prüfen`, `check` means inspect only; never silently regenerate.

---

# 8. Generated runtime integration rule

The existing generated composite path is the production integration target:

```text
Ground
→ FloorFX / Shadows
→ Architecture
→ WallProp fallback / production WallProps
→ FloorProp fallback / production FloorProps
→ runtime Characters
→ Doors / interaction / UI according to established runtime layers
```

`src/levelgen/propArtRegistry.ts` is presentation-only.

Spatial truth remains in:

- `propRegistry.ts`;
- `propCollisionRegistry.ts`;
- Exact-Fit metadata/validation;
- semantic LevelSpec/placement.

Adding a production image must not reroll placement or redefine collision from pixels.

---

# 9. Art-Parity live QA gate

Evaluate the generated TS-01 as one room, not as isolated asset thumbnails.

## Hierarchy

- Is Transfer clearly the strongest environmental focal point?
- Does Family remain warmer/personal but subordinate?
- Does PRIMUS read ordered/competent without stealing the Transfer hero role?

## Spatial plausibility

- Do Family objects sit where people would plausibly use them?
- Are wall objects readable and accessible?
- Are thresholds visibly clean?
- Do support objects form meaningful clusters?

## Runtime coherence

- Do sprites/shadows/collision feel aligned?
- Do walls/doors retain the accepted behavior and visual mass?
- Does the Sentry patrol remain visually clear of the wall?
- Are no new assets blocking Door Clearance/use-space unexpectedly?

## Gameplay scale

- Do silhouettes and functions read on desktop?
- Do they still read on phone landscape?
- Is visual density rich without becoming noisy?

## Numberdroid identity

- Does the room avoid generic dark military sci-fi?
- Is CORE/SLOT visible as a recurring visual language?
- Does Transfer look empowering rather than sinister?
- Does Family feel lived-in rather than a lobby?

---

# 10. Exit criteria for the TS-01 Gold Slice

Generated TS-01 can be considered Gold-Slice accepted only when:

1. required production assets replace the important semantic blockouts;
2. Transfer/Flow/PRIMUS hierarchy is visually coherent;
3. candidate Family art has an explicit disposition;
4. accepted spatial/runtime regression gates remain green;
5. desktop and phone live QA pass;
6. Klaus explicitly accepts the room as the representative quality bar.

Only then evaluate whether Generated TS-01 should replace the hand-authored reference as the canonical campaign Floor.

`CI green`, `merged`, `deployed`, `spatially accepted`, `art accepted` and `Gold Slice accepted` remain distinct states.
