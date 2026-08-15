# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — 2026-08-15**

This is the single current planning document for the **detailed TS-01 Gold Slice push**. It is intentionally more concrete than `DEVELOPMENT_PLAN_NEXT.md`, which remains the project-level forward roadmap.

Update this document as Gold Slice passes are completed. Do not create a new competing Gold Slice status document for every iteration; dated experiments/handoffs belong under `docs/history/` when needed.

## Relationship to the master plan

`docs/planning/DEVELOPMENT_PLAN_NEXT.md` answers:

> What major production milestone is Numberdroid working toward, and what comes after it?

This document answers:

> What exactly must be changed in TS-01 before the visual Gold Slice can be judged as a coherent representative room?

The Gold Slice is one milestone in the broader production plan. It is **not** the end of Transfer Ship production and not the complete campaign.

## Gold Slice definition

The TS-01 Gold Slice succeeds when the deployed Transfer Hall is convincing enough to answer:

> **If the rest of Numberdroid were produced at this quality and with this visual grammar, would we want to continue in this direction?**

The target is not maximum prop count. The target is a coherent room in which:

- architecture, floor, props, doors, hero machinery, shadows and lighting feel like one game;
- the larger gameplay space remains comfortable to move through;
- Family, Transfer and PRIMUS functions read as distinct zones without becoming three disconnected rooms;
- high-detail props no longer float inside an under-authored empty rectangle;
- top-down perspective remains consistent;
- the room remains readable on desktop and phone.

## Current diagnosis — 2026-08-15

Live QA after Family Props Batch 2 established the following:

### Working

- accepted Family Table + shadow;
- accepted Family Memory Console + shadow;
- new round plant, planter, coffee machine and hologram concepts are individually promising;
- strict top-down prop direction is substantially better than earlier attempts;
- large room size is useful for gameplay and should be retained rather than compressed merely to imitate the reference composition.

### Current deficiencies

1. **Room-level composition is under-structured.** The first room still reads too much like a large rectangle containing isolated objects.
2. **Detail density is unevenly distributed.** Several props are high-detail while large floor/wall areas carry little visual information.
3. **The plants currently read as dropped into open floor space rather than belonging to a wall/edge cluster.**
4. **Hero assets are still incomplete/placeholder-level.** Transfer machinery and related focal systems therefore do not yet carry enough visual weight.
5. **Environment grounding is incomplete.** The Flow object still needs a convincing floor-projected grounding/shadow path; broader subtle AO/wear is also missing.
6. **Floor is too clean/uniform for the current prop fidelity.** A restrained dirt/use-wear pass is likely required.
7. **Fidelity is inconsistent across categories.** Rich props beside very simple structural/door elements can make the scene feel assembled from different production stages.

## Composition principles for this pass

### Keep the larger room

Do **not** shrink TS-01 to reference-room dimensions simply to make it feel fuller. The larger footprint supports movement, later body sizes and camera comfort.

Instead, the large room must gain **internal visual structure**:

- shallow wall returns / alcoves;
- corners and edge clusters;
- meaningful negative space;
- clear circulation lanes;
- stronger Family / Transfer / PRIMUS composition.

### Edge-first prop placement

Ordinary environmental props should usually belong to:

- a wall;
- a corner;
- an alcove;
- the edge of a functional zone;
- another larger prop cluster.

Freestanding center-floor objects should be comparatively rare and should have a reason to occupy the center.

### Composition before final asset production

Do not solve room emptiness by immediately commissioning many finished assets.

First prove **where additional mass/detail belongs** using cheap deterministic blockout assets. Only then spend generation/retouch effort replacing the useful placeholders.

### Fidelity must converge

The Gold Slice may temporarily contain placeholders, but its exit state must not have one category visually far below the others. In particular, props, hero machinery, doors/thresholds, architecture accents and floor treatment must eventually share a credible fidelity band.

---

# PASS 1 — Structural composition and zoning

## Goal

Make the larger room feel intentionally designed **before** increasing final-art quantity.

## Actions

1. **Introduce shallow structural articulation in the first room** using the accepted wall kit where possible rather than rebuilding the wall system.
   - Add short wall returns / partial dividers that create corners and an alcove read.
   - Preserve a broad central circulation path.
   - Do not turn Family and Transfer into fully closed rooms.
2. **Recompose accepted/candidate props around edges.**
   - Coffee machine remains at the **upper wall**, with service/access from below.
   - Move the two plant assets into clearly wall-adjacent Family positions.
   - Move the hologram to a functionally motivated Transfer-support position rather than leaving it as isolated decorative clutter.
3. **Preserve accepted Family Table and Memory Console visual assets.** Placement may be revised only where composition requires it; art itself stays frozen unless a concrete defect appears.
4. **Preserve Transfer movement space.** Structural additions must not create narrow accidental traps for standard play.
5. Keep the current room size unless live QA proves a gameplay/composition problem that cannot be solved internally.

## Acceptance criteria

PASS 1 passes when:

- the room no longer reads as a single unarticulated rectangle;
- at least one convincing shallow alcove/corner composition exists in the Family side;
- Family → Transfer circulation remains visually obvious and comfortably traversable;
- the two plants read as edge/wall dressing rather than floating floor tokens;
- coffee access from below remains clear;
- hologram placement suggests a Transfer/support function;
- no accepted wall material/door behavior has been casually reopened.

---

# PASS 2 — Density blockout with SVG placeholder props

## Goal

Preview **how much environmental detail the room actually needs and where it should live** before producing more expensive final assets.

## Required implementation

Add a dedicated **strict-top-down SVG placeholder-prop atlas** for Gold Slice composition testing.

The placeholder set is intentionally provisional and should be visually recognizable as blockout-quality while still respecting Numberdroid's top-down language.

Candidate placeholder functions:

- wall bench / soft waiting seat;
- low civilian storage / sideboard;
- second wall-edge seating/storage mass for lower Family edge;
- small personal clutter/bag module;
- small side table / personal-object surface;
- Transfer support/diagnostic console;
- compact service cabinet / utility module;
- one additional low edge prop if needed to balance the room.

### Placeholder rules

- strict top-down / orthographic;
- no readable front-face dependency;
- no baked floor;
- no scene lighting;
- simple silhouettes and large value masses;
- clearly lower-fidelity than final art so placeholders cannot accidentally become accepted production art;
- placed on `WallProps` or `FloorProps` according to their visual role;
- **no gameplay interaction**;
- no collision by default during density exploration unless a placeholder is specifically being used to validate navigation clearance;
- placeholder placements are allowed to be removed/replaced freely after composition QA.

### Density strategy

Use placeholders to form **clusters**, not confetti:

- Family edge cluster around table / wall memory area;
- lower or left wall support cluster;
- Transfer support cluster near, but not competing with, the hero Transfer machinery;
- leave intentional clean circulation space between clusters.

The reference room is a **density reference, not a footprint template**. TS-01 may remain larger, but its useful edges should carry comparable purposeful visual information.

## Acceptance criteria

PASS 2 passes when:

- the first room no longer feels conspicuously empty at gameplay scale;
- density is concentrated around walls/corners/functional clusters rather than evenly sprinkled;
- large negative-space areas read as deliberate circulation, not unfinished floor;
- Family and Transfer zones are distinct without signage doing all the work;
- the Transfer hero footprint still has visual breathing room;
- standard navigation remains comfortable;
- the placeholder inventory gives a concrete answer to **which additional final props are worth producing**;
- no placeholder is mistaken for a final Gold Slice asset.

---

# PASS 3 — Cohesion, grounding and final fidelity

## Goal

Replace the blockout feel with a coherent Gold Slice in which every major visual system belongs to the same quality band.

## Actions

### 3A — Hero assets

Complete the missing focal production work, especially:

- Transfer apparatus / cradle hero treatment;
- associated Flow/support system treatment;
- PRIMUS hero/wall object where visible in the evaluated slice.

Hero assets remain separate production categories and follow method selection + recipe + source QA + runtime QA.

### 3B — Environment grounding

- Add the missing **Flow floor-projected shadow/grounding path**.
- Review prop shadows as a system, not as isolated patches.
- Add restrained room-edge/contact grounding where useful without faking scene illumination in FloorFX.

### 3C — Floor use/wear pass

Introduce a restrained dirt/use-wear layer:

- subtle scuffs;
- faint accumulated edge grime;
- slightly stronger use marks near high-traffic/functional areas;
- no post-apocalyptic dirt;
- no noisy decal spam;
- preserve the bright desirable civilian-machine read.

Prefer a separate reproducible FloorFX/decal treatment rather than destructively repainting the accepted floor unless a deliberate floor revision is approved.

### 3D — Fidelity convergence

Review the room for categories that now look obviously simpler than their neighbours.

Special attention:

- doors / thresholds;
- structural transition/corner accents;
- signage framing;
- hero-machine interfaces;
- remaining legacy placeholder props.

Do not automatically replace LIVE_ACCEPTED Walls/Doors. First determine whether the mismatch can be solved through adjacent structural detail, trim, hero framing or a bounded explicitly approved category revision.

### 3E — Replace successful SVG placeholders

For each placeholder that materially improves composition:

1. state its function;
2. select production method;
3. create/update recipe;
4. produce one deliberate asset/micro-set;
5. source QA;
6. production extraction/QA;
7. runtime integration;
8. live QA;
9. remove the corresponding placeholder.

Delete placeholders that did not improve the composition instead of producing them out of inertia.

## Acceptance criteria

PASS 3 passes when:

- hero assets carry the intended focal hierarchy;
- Flow and other major objects feel grounded to the floor;
- floor has subtle use history without becoming dirty/noisy;
- no obvious high-detail-prop vs crude-environment fidelity clash remains;
- remaining placeholders are gone from the evaluated Gold Slice;
- Family / Transfer / PRIMUS read at gameplay scale without relying only on labels;
- the room remains bright, desirable and civilian rather than military/dystopian;
- desktop and phone live QA both pass.

---

# Gold Slice exit gate

Do **not** declare TS-01 Gold Slice complete until all of the following are true:

```text
STRUCTURE
[ ] larger room retained or deliberately revised for a proven reason
[ ] room silhouette/internal structure feels intentional
[ ] circulation lanes are clear

COMPOSITION
[ ] Family props belong to edge/corner clusters
[ ] Transfer support dressing is motivated
[ ] useful negative space is deliberate
[ ] density no longer reads unfinished

HERO / FOCUS
[ ] Transfer apparatus is production-quality
[ ] Flow/support treatment is production-quality
[ ] relevant PRIMUS focal object is production-quality

GROUNDING
[ ] major props have appropriate contact/grounding shadows
[ ] Flow has its floor-projected shadow/path
[ ] room has restrained wear/dirt variation

FIDELITY
[ ] floor / architecture / doors / props / hero objects feel from one visual system
[ ] no glaring legacy-placeholder-quality object remains in the evaluated room

NUMBERDROID IDENTITY
[ ] CORE / SLOT hierarchy is readable
[ ] Family traces feel personal, not rustic
[ ] Transfer feels desirable/empowering before the later story reversal
[ ] environment avoids generic dark-metal + cyan military sci-fi

RUNTIME
[ ] tests/build/art validators green
[ ] desktop live QA passed
[ ] phone live QA passed
[ ] user/art-director Gold Slice acceptance recorded
```

---

# Do first / do later / avoid

## Do first

- structural room articulation;
- wall-adjacent plant placement;
- motivated hologram placement;
- SVG placeholder density blockout;
- preserve broad movement lanes;
- use live gameplay scale as the composition judge.

## Do later, after blockout proves the need

- final production versions of placeholder furniture/storage/support props;
- final floor wear/dirt decals;
- bounded architecture/door fidelity revisions if still necessary after hero/trim work;
- additional ordinary prop variants.

## Avoid

- shrinking the room merely to imitate the reference screenshot;
- filling every empty tile with a prop;
- generating a whole furnished room and trying to crop production assets from it;
- side-view or frontal-wall-dependent props;
- random generic sci-fi greebles;
- reopening accepted wall/door systems without a concrete composition/fidelity reason;
- treating CI green or a merged placeholder pass as visual acceptance;
- producing final art for every SVG placeholder before live composition QA proves it belongs.

---

# Immediate implementation block — approved 2026-08-15

Proceed with a bounded **Composition Preview** implementing PASS 1 + the first PASS 2 blockout:

1. add shallow Family-side structural wall returns using the existing accepted wall kit;
2. relocate both plants to clear wall-adjacent Family positions;
3. move the hologram into a motivated Transfer-support position;
4. keep the coffee machine on the upper wall with access from below;
5. add a strict-top-down SVG placeholder-prop atlas and place a small number of purposeful edge clusters;
6. add regression tests for structural markers and placeholder placement;
7. deploy as a **composition preview**, not `LIVE_ACCEPTED`;
8. perform live desktop/mobile Art-Director QA before producing replacement final props.

The Flow shadow path and dirt/fidelity pass remain PASS 3 work unless the composition preview exposes a reason to pull one of them forward.
