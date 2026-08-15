# Numberdroid — TS-01 Gold Slice Execution Plan

Status: **CURRENT detailed execution plan — 2026-08-15**

This is the single current planning document for the detailed TS-01 Gold Slice push. It is intentionally more concrete than `DEVELOPMENT_PLAN_NEXT.md`, which remains the project-level forward roadmap.

Durable reusable spatial principles now live in:

- `docs/game-design/LEVEL_DESIGN_RULES.md`

This document applies those rules specifically to TS-01 and should be updated as the Gold Slice progresses. Do not create a competing Gold Slice status document for every iteration.

---

# 1. Relationship to the master plan

`docs/planning/DEVELOPMENT_PLAN_NEXT.md` answers:

> What major production milestone is Numberdroid working toward, and what comes after it?

This document answers:

> What exactly must be changed in TS-01 before the visual Gold Slice can be judged as a coherent representative room?

The Gold Slice is one milestone in the broader production plan. It is not the end of Transfer Ship production and not the complete campaign.

---

# 2. Gold Slice definition

TS-01 succeeds when the deployed Transfer Hall is convincing enough to answer:

> **If the rest of Numberdroid were produced at this quality and with this visual grammar, would we want to continue in this direction?**

The target is a coherent room in which:

- architecture, floor, props, doors, hero machinery, shadows and lighting feel like one game;
- the larger gameplay space remains comfortable to move through;
- Family, Transfer and PRIMUS functions read spatially without relying only on labels;
- high-detail props no longer float inside an under-authored rectangle;
- top-down perspective remains consistent;
- functional relationships are visible through placement and architecture;
- the room remains readable on desktop and phone.

The reference room is a **density and composition reference, not a footprint template**. TS-01 may remain larger because gameplay benefits from the additional space.

---

# 3. Current accepted / candidate baseline

## Frozen / accepted

- PICO — LIVE_ACCEPTED;
- Floor — accepted baseline;
- Walls / Architecture material + semantic kit — LIVE_ACCEPTED;
- Doors — LIVE_ACCEPTED;
- Family Table + grounding shadow — LIVE_ACCEPTED;
- Family Memory Console + grounding shadow — LIVE_ACCEPTED.

## Current candidates / blockout

- Coffee machine + shadow;
- Planter trough + shadow;
- Round plant + shadow;
- Hologram pedestal + shadow;
- SVG Gold Slice blockout-prop atlas `189–200`;
- current composition preview layout.

Merged/deployed candidate status does not imply visual acceptance.

---

# 4. Current diagnosis after Composition Preview QA

The first composition preview is a clear improvement over the empty rectangular room. It proved that added density and zoning help, but it also exposed a more important requirement: **level design must follow functional spatial logic rather than visual anti-emptiness tricks**.

## What improved

- the room feels materially denser;
- the three functional regions are easier to read;
- the SVG blockout successfully demonstrates that provisional furnishing can answer composition questions before final art production;
- the larger room still appears preferable for gameplay;
- the new finished props are individually compatible with the intended top-down art direction.

## What still fails / remains weak

1. **The Family wall returns read as arbitrary wall stubs.** They were added to break the rectangle but do not have a convincing function.
2. **The three zones remain too equal/symmetrical as room subdivisions.** This underuses the contrast between Family, Transfer and PRIMUS.
3. **Several blockout assets with dashed outlines read as detached floor diagrams rather than furniture/infrastructure.** Their functions need wall/cluster anchoring.
4. **Plants still need more human-plausible placement.** Plants should sit near walls/corners/furniture rather than merely inside the Family rectangle.
5. **The hologram is too detached from the Transfer apparatus.** If it controls/services Transfer, proximity or a visible connection must communicate that relationship.
6. **PRIMUS still has too much empty wall/edge potential relative to the reference.** Density should increase through aligned wall/service modules while preserving patrol space.
7. Hero assets, Flow grounding/shadow, dirt/use-wear and category-fidelity convergence remain outstanding.

---

# 5. TS-01 relationship graph

Before coordinates, the room should satisfy this functional graph:

```text
ENTRY / PUBLIC APPROACH
        ↓
FAMILY WAITING / PERSONAL AREA
  ├─ Family Table
  ├─ Memory Console
  ├─ Coffee / convenience
  ├─ plants
  └─ bench / storage / personal traces
        │
        │ SOFT TRANSITION — family remains present for Transfer
        ↓
TRANSFER RITUAL / HERO AREA
  ├─ Transfer apparatus / Core focus
  ├─ hologram / control
  ├─ diagnostic/service support
  └─ Flow / body-position system
        │
        │ HARD CONTROLLED THRESHOLD
        ↓
PRIMUS ALLOCATION / WORK SYSTEM
  ├─ aligned system consoles
  ├─ body/service banks
  ├─ robot work positions
  └─ controlled route onward
```

This graph is more important than keeping three equal visual columns.

---

# 6. Binding TS-01 spatial decisions from the new level-design rules

## 6.1 Keep the larger room

Do not shrink the room merely to imitate the reference screenshot.

Instead:

- increase purposeful edge density;
- preserve generous central movement;
- use different boundary types and furnishing logic to create zones.

## 6.2 Family → Transfer is a soft boundary

This is the most important new structural decision.

The family is present during the Transfer rite. There is no strong access/security/privacy reason for a hard wall between Family and Transfer.

Therefore the current Family-side north/south wall returns should be **removed in the next layout revision**.

Family → Transfer should be communicated using:

- furniture orientation;
- different density;
- plants / edge objects;
- local floor/light treatment later;
- visual opening toward the Transfer hero.

If later live QA proves that Family needs a real architectural niche, it should be a **functional built-in bay/recess** that houses furniture/infrastructure, not a free wall stub.

## 6.3 Transfer → PRIMUS remains a hard boundary

The existing divider and controlled door have an actual function:

- transition from public/ritual Transfer space to allocation/control;
- access/control change;
- story meaning;
- route gating.

Keep this structural distinction unless gameplay/story changes.

## 6.4 Use symmetry semantically

Do not make all three room regions equally symmetrical.

Desired pattern:

```text
FAMILY    asymmetric, lived-in, clustered
TRANSFER  strongest local symmetry and visual focus
PRIMUS    ordered, aligned, modular — not necessarily mirror-symmetric
```

Transfer may use a strong axis around the hero apparatus because ritual/machine precision justify it.

Family should deliberately resist that precision.

PRIMUS should feel systematized through repeated alignment and service modules rather than through a perfect mirrored room.

---

# 7. Concrete next layout revision — TS-01 Composition Preview v2

This is the next bounded level-design pass to implement before producing more final props.

## 7A — Remove unsupported architecture

### Remove

- `family-return-north` wall/collision;
- `family-return-south` wall/collision;
- corresponding Family-side divider markers at column 6.

### Preserve

- outer wall system;
- Transfer→PRIMUS divider at column 12;
- existing controlled doorway;
- accepted wall material and semantic atlas.

### Goal

The room should stop reading as three equal bays. Family and Transfer become one public/ritual volume with differentiated furnishing; PRIMUS remains the structurally controlled region.

---

## 7B — Family zone: make one believable lived-in cluster

### Anchor

**Family Table** remains the primary Family anchor.

It should continue to sit away from the wall enough to allow use around it, but surrounding secondary items should explain the zone.

### Upper/north-west edge cluster

Use the upper/left architecture as the supported edge for:

- Memory Console;
- Coffee Machine;
- one plant where it does not overlap the zone label;
- optional low storage/support blockout if needed.

The exact sequence does not need perfect alignment; mild asymmetry is desirable.

Coffee Machine remains wall-backed with access from below.

### Lower/west edge cluster

Group:

- planter trough;
- waiting bench / low seating blockout;
- low storage / personal bag / side table blockout.

The planter should no longer read as a standalone decorative token. It should soften or terminate the seating/storage cluster.

### Plant rule for TS-01

Both plants should visually belong to:

- a wall/corner;
- or a furniture cluster immediately adjacent to a wall.

No plant should sit in primary circulation or underneath floating UI/signage.

### Family negative space

Keep a clear route between Family Table and Transfer. Do not fill the entire lower-left floor just because placeholders are available.

---

## 7C — Transfer zone: build one functional machine cluster

### Anchor

Transfer apparatus remains the dominant room hero and should own the strongest local symmetry/negative space.

### Hologram

Move the Hologram Pedestal into **direct functional proximity** to the Transfer apparatus.

Preferred relationship:

- approximately one tile from the apparatus visual footprint;
- east/north-east or west/north-west support position depending runtime clearance;
- clearly oriented/aligned as part of the same cluster;
- not placed against a distant wall if it is meant to control the machine.

### Diagnostic/support placeholders

Reposition relevant dashed SVG blockouts so they become one of two things:

1. **machine-adjacent support device** close to the Transfer hero; or
2. **wall-backed support bank** with a visible FloorFX/data/power relationship to the hero.

Do not leave a diagnostic console floating at the north wall while the supposed machine it controls is several tiles away with no connection.

### Visual connection

In this composition pass, proximity/alignment should already communicate the relationship.

In PASS 3, strengthen it with one restrained visual connector such as:

- floor registration/data path;
- support pad;
- Flow routing treatment;
- controlled local lighting relation.

Do not add decorative cables everywhere.

### Hero breathing space

Support devices should frame the Transfer apparatus, not crowd it.

Keep the main approach and circular read unobstructed.

---

## 7D — PRIMUS zone: use aligned wall density, not center clutter

PRIMUS currently has useful open patrol space. Preserve that.

Increase visual information primarily on:

- north wall;
- east wall / right-side edge;
- selected work/docking positions.

Use SVG blockout modules to preview:

- wall/service console bank;
- body-slot/service cabinet;
- compact workstation/support module;
- optional docking/parking marker tied to robot work.

PRIMUS blockouts should be:

- aligned;
- repeated/modular;
- more grid-disciplined than Family;
- wall-backed wherever plausible.

Do not sprinkle generic machinery into the center of the patrol area.

---

## 7E — Reinterpret the dashed SVG assets

The dashed outline successfully communicates “placeholder”, but their spatial roles need to be clearer.

For Composition Preview v2 each placed placeholder must have a name/function and placement class:

```text
FAMILY_WALL_BENCH        wall-backed / lower-west
FAMILY_LOW_STORAGE       wall-backed / near bench/table
FAMILY_PERSONAL_BAG      adjacent to seating/table, deliberately slightly irregular
TRANSFER_DIAGNOSTIC      machine-adjacent
TRANSFER_SERVICE_BANK    wall-backed but visibly related to hero
PRIMUS_SERVICE_BANK      wall-backed / aligned
PRIMUS_BODY_SUPPORT      wall-backed or docking-edge aligned
```

Unused placeholder cells may remain in the atlas, but do not place them merely for density.

---

# 8. Composition Preview v2 acceptance criteria

The next layout passes only when:

## Architecture

- no wall exists whose only justification is “break the rectangle”;
- Family→Transfer reads open and natural;
- Transfer→PRIMUS still reads as a meaningful controlled threshold.

## Symmetry

- Transfer owns the strongest local symmetry;
- Family reads intentionally asymmetric/lived-in;
- PRIMUS reads orderly/modular;
- the whole room no longer looks like three equal decorated columns.

## Family

- plants are wall/cluster-adjacent;
- coffee remains accessible from below;
- table, memory, coffee, plants and seating/storage read as one family environment rather than unrelated props;
- no plant collides visually with signage.

## Transfer

- hologram clearly belongs to the Transfer apparatus through proximity/alignment;
- diagnostic/support blockouts visibly serve the hero cluster;
- hero object retains breathing room and approach clarity.

## PRIMUS

- wall edges carry more purposeful system density;
- patrol/movement center remains open;
- modular alignment contrasts with Family placement.

## General

- main circulation is obvious;
- ordinary props do not occupy central circulation without a reason;
- negative space looks intentional rather than unfinished;
- room remains comfortable on desktop and phone.

---

# 9. PASS 3 — Cohesion, grounding and final fidelity

After Composition Preview v2 passes, proceed to production/cohesion rather than continuing endless blockout rearrangement.

## 9A — Hero assets

Complete production-quality treatment for:

- Transfer apparatus / cradle;
- Flow/support system;
- relevant PRIMUS focal system.

## 9B — Environment grounding

- add missing Flow floor-projected shadow/grounding path;
- review contact shadows as a system;
- add restrained room-edge/contact grounding where useful.

## 9C — Floor use/wear

Add a separate reproducible restrained use/wear FloorFX treatment:

- subtle scuffs;
- faint edge grime;
- slightly stronger wear near high-use machines/paths;
- no post-apocalyptic dirt;
- no noisy decal spam.

## 9D — Fidelity convergence

Re-evaluate:

- door/threshold treatment;
- architecture transitions;
- signage frames;
- hero interfaces;
- remaining old placeholder props.

Do not reopen LIVE_ACCEPTED Walls/Doors automatically. First solve fidelity through adjacent trims, hero framing and context. Reopen accepted categories only if a concrete mismatch remains and a bounded revision is approved.

## 9E — Replace successful SVG placeholders

Only placeholders that proved their value become final assets.

For each:

1. name its function;
2. select production method;
3. create/update recipe;
4. produce source;
5. source QA;
6. production build/QA;
7. runtime integration;
8. live QA;
9. remove blockout.

Delete failed/unnecessary placeholders instead of producing them out of inertia.

---

# 10. Gold Slice exit gate

Do not declare TS-01 complete until:

```text
STRUCTURE
[ ] room size supports gameplay
[ ] every significant architectural form has a function
[ ] Family→Transfer uses an appropriate soft boundary
[ ] Transfer→PRIMUS controlled threshold reads clearly
[ ] circulation lanes are clear

COMPOSITION
[ ] Family reads lived-in and clustered
[ ] Transfer reads focal and machine-coherent
[ ] PRIMUS reads aligned/optimized
[ ] useful negative space is deliberate
[ ] related objects are adjacent or visibly connected

HERO / FOCUS
[ ] Transfer apparatus production-quality
[ ] Flow/support production-quality
[ ] relevant PRIMUS focal object production-quality

GROUNDING
[ ] major props have appropriate contact shadows
[ ] Flow has its floor-projected grounding/path
[ ] floor has restrained wear/use history

FIDELITY
[ ] floor / architecture / doors / props / hero objects feel like one game
[ ] no glaring blockout/legacy-quality object remains

NUMBERDROID IDENTITY
[ ] CORE / SLOT hierarchy readable
[ ] Family personal without becoming rustic
[ ] Transfer desirable/empowering
[ ] PRIMUS competent/controlled without generic villain styling

RUNTIME
[ ] tests/build/art validators green
[ ] desktop live QA passed
[ ] phone live QA passed
[ ] user/art-director Gold Slice acceptance recorded
```

---

# 11. Next implementation block

**Next:** Composition Preview v2 derived from `LEVEL_DESIGN_RULES.md`.

Implement only after this plan is accepted:

1. remove the unsupported Family north/south wall returns and collision;
2. keep the PRIMUS divider/door;
3. regroup Family props against north/west/south edges around the Family Table;
4. ensure both plants are wall/furniture-cluster adjacent and clear of signage;
5. move the hologram to direct Transfer-apparatus proximity;
6. move/rename SVG blockout placements so each represents a named wall-backed or machine-adjacent function;
7. add aligned PRIMUS wall/service blockouts while preserving patrol center;
8. update regression tests for the new structural/placement contract;
9. deploy as `COMPOSITION_PREVIEW`, not visual acceptance;
10. perform desktop/mobile Art-Director QA before producing final replacements.

PASS 3 Flow shadow, dirt/use-wear and final hero production remain deferred until Composition Preview v2 proves the spatial layout.
