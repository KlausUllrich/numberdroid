# TS-01 Floor Treatment Brief / Recipe

Status: **CURRENT DESIGN BRIEF / PRODUCTION NOT STARTED — 2026-08-17**

This brief defines the Gold-Slice floor-treatment pass for generated TS-01. The existing accepted Floor remains the **base material baseline**; this pass adds room identity, subtle age/use, contact grounding and functional floor integration without turning the Transfer Ship into a dirty industrial environment.

Current authorities:

- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
- `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- `docs/art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- `art-source/recipes/transfer-hall/flow-support/recipe.md`
- accepted generated TS-01 Layout-v3 / v0.13.2 spatial baseline

---

## 1. Visual thesis

The Transfer Ship is:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

A useful real-world analogy is a well-kept home with children: it is regularly cleaned and clearly cared for, but small marks, scuffs, duller high-traffic patches and occasional stains remain because people actually live there.

Avoid both extremes:

```text
BAD: hospital / showroom / newly rendered architectural visualization
BAD: gritty cargo ship / grimdark factory / abandoned industrial deck
GOOD: competent civilian technology with accumulated everyday use
```

The floor should help explain **what each room is for** before additional Props are added.

---

## 2. Core production decision — room identity first

The largest intended improvement is **different floor character by room**, while all rooms remain recognizably part of one Transfer Ship material family.

Do not solve this by applying one global dirt texture over the entire map.

Instead:

```text
COMMON TRANSFER-SHIP MATERIAL FAMILY
        +
ROOM-SPECIFIC BASE VARIATION
        +
ROOM-SPECIFIC USE / WEAR
        +
STATIC CONTACT / WALL AO
        +
FUNCTIONAL FLOORFX WHERE JUSTIFIED
```

The result should increase room readability even if all Props are temporarily hidden.

---

## 3. Layer / authority model

### Ground — base material identity

Ground owns:

- walkable base surface;
- room-specific material/tint/panel family;
- large-scale panel seams and material variation;
- threshold material transitions where required.

Ground does **not** own:

- Prop shadows;
- wall AO overlays when these are generated as a separate treatment;
- active glow;
- temporary effects;
- collision.

### FloorFX — non-light overlays

FloorFX may own:

- wall/contact ambient-occlusion treatment;
- Prop grounding/contact shadows;
- subtle wear/dirt/scuff overlays when kept separate from the reusable base material;
- maintenance plates / functional registration graphics;
- the static Flow coupling bus;
- restrained service/docking marks.

FloorFX remains non-colliding and is **not scene illumination**.

### LightOverlay — actual scene lighting

LightOverlay alone owns light that affects nearby floor, Props or Characters.

A cyan line painted in FloorFX may look emissive locally, but a cyan pool of light cast onto PICO/floor belongs to LightOverlay.

---

## 4. Room-by-room floor identities

All values below are art-direction intent, not final palette constants.

### A. Family Living — lived-in civilian floor

Read:

> cared-for family space inside a machine society

Treatment:

- slightly warmer civilian ceramic/composite than public/system areas;
- medium/large calm panel rhythm rather than dense technical grid;
- modest irregular panel-value variation;
- the most natural small everyday marks in TS-01;
- subtle scuffing around the Family Table and common walking paths;
- occasional tiny muted stain/spot near lived-in activity zones, never a repeated decal pattern;
- edges/corners remain maintained rather than visibly filthy.

Avoid:

- rustic wood-home cliché;
- carpet unless separately justified later;
- toy-pattern floor graphics;
- heavy brown dirt.

### B. Family Child — same world, slightly softer/personal

Read:

> a real child lives here, but it is still a Transfer Ship room

Treatment:

- related to Family Living, slightly softer/warmer or with a small material-inset variation;
- somewhat smaller or more human-scaled panel rhythm;
- slightly more micro-scuffs than adult living area;
- local wear near bed/storage/use zones once those Props exist;
- one restrained personal material/accent opportunity is allowed if later composition needs it.

Avoid generic “kids room” decals and high-saturation floor graphics.

### C. Family Hygiene — clean functional non-slip treatment

Read:

> cleaned frequently, functionally different, not a hospital

Treatment:

- slightly cooler/denser panel or micro-texture than Family rooms;
- visually plausible non-slip surface;
- low dirt level;
- very faint cleaning/water streak variation is allowed;
- smaller-scale seams can help the room read as sanitary/functional.

This should be cleaner than Family Living but not optically sterile white.

### D. Main Hall — robust circulation floor

Read:

> this is where bodies move through the ship

Treatment:

- neutral durable Transfer-Ship base;
- clearer directional panel/seam logic aligned with circulation;
- broad calm center path, not a glowing navigation road;
- high-traffic polish/dulling/scuff variation concentrated along the travelled center;
- less random staining than Family areas;
- edges near walls slightly cleaner/less worn than the traffic band.

The floor should support route readability without requiring UI arrows.

### E. Transfer Room — premium functional Hero floor

Read:

> important maintained ritual/technology chamber built around the Transfer system

Treatment:

- highest-quality, most deliberate floor composition in TS-01;
- calm light ceramic/technical base related to the ship but visibly distinct from Hall;
- stronger large-scale symmetry/alignment around the accepted Transfer Apparatus;
- a deliberate Hero anchoring zone beneath/around the Apparatus using inset panels, registration frames or service plates rather than a decorative carpet;
- strongest local static contact/AO grounding in the slice, while preserving readable white/ceramic values;
- subtle use/wear on the Human approach and Robot exit path;
- Flow Regulator integration and short deterministic Flow bus belong to this floor system;
- cyan service/status language may appear in restrained functional traces;
- amber remains subordinate to the Yellow Core/Transfer activity.

Avoid:

- giant glowing circles competing with the Apparatus;
- arbitrary sci-fi rings;
- strong hazard stripes;
- a decorative runway that looks like game UI.

### F. PRIMUS Allocation — ordered system floor

Read:

> optimized institutional work space, competent rather than sinister

Treatment:

- slightly cooler, cleaner and more systematic than Main Hall;
- regular modular panel grid / precise registration logic;
- less random dirt distribution;
- wear aligned with work slots, service banks and patrol paths rather than domestic randomness;
- restrained teal/cyan system marks may identify functional positions;
- center stays visually calm enough for robots/patrol readability.

Avoid villain-black flooring, aggressive red grids and excessive glowing circuitry.

---

## 5. Thresholds / room transitions

Different room floors must not look like unrelated games stitched together.

Use controlled threshold transitions:

- narrow material transition strips;
- seam alignment where practical;
- shared base ceramic/graphite family;
- room variation primarily through panel scale, tint/value, micro-texture, wear logic and functional markings;
- doors/openings should visually explain where one room identity ends and the next begins.

The Main Hall can act as the neutral connective baseline between stronger room identities.

---

## 6. Ambient occlusion / wall grounding

Wall AO is explicitly recommended for the Gold Slice.

Purpose:

- ground the 30 px wall fascia into the floor;
- make rooms feel less like flat colored polygons;
- strengthen corners and architectural depth without introducing perspective geometry;
- visually integrate walls and Props with the ground.

### Proposed implementation principle

Prefer a **deterministic M4/static FloorFX AO pass derived from semantic wall geometry**, not hand-painted AO baked differently into every floor tile.

Conceptual path:

```text
Shared Wall Graph / visible wall surface
→ interior-side occlusion mask
→ soft short falloff into walkable floor
→ slightly stronger corner accumulation
→ FloorFX AO layer
```

Initial visual target:

- subtle enough that the wall edge is not outlined in black;
- soft short-range falloff rather than a large vignette;
- corners may accumulate slightly more occlusion;
- open door apertures must not receive fake wall AO across the opening;
- AO must not alter collision or navigation;
- Prop shadows/contact AO should not double-darken the same area excessively.

Exact blur/falloff/opacity values are production-QA decisions and should be tuned at gameplay scale rather than frozen in this brief.

---

## 7. Wear / dirt system

Use **usage evidence**, not generic dirt noise.

Preferred categories:

### Traffic wear

- slightly duller/polished high-traffic bands;
- small scuffs from bodies/wheels/feet;
- direction follows actual circulation.

### Local activity wear

- Family Table / Coffee area;
- Child bed/storage zone;
- Transfer Human approach / Robot exit;
- PRIMUS work slots/service banks.

### Rare small stains / marks

- few, low-contrast, irregular;
- more plausible in Family spaces than PRIMUS;
- never repeated at obvious tile intervals.

### Age / maintenance variation

- a few panels may be subtly newer/older in value;
- replacement panel variation is allowed;
- the ship should feel maintained over time rather than newly manufactured yesterday.

Avoid:

- globally tiled grunge texture;
- high-frequency noise everywhere;
- oil spills / rust / corrosion as normal-room baseline;
- dark dirt lines around every tile seam;
- random scratches with no use logic.

---

## 8. Additional floor effects worth testing

These are recommended options, not all mandatory.

### Panel/value variation

Small warm/cool or light/dark shifts between selected large panels can create material richness without clutter.

### Replacement / service panels

Occasional subtle mismatch or maintenance hatch can communicate age + upkeep.

### Functional registration marks

Use around:

- Transfer Apparatus;
- Flow Regulator coupling;
- PRIMUS work positions;
- body docking/service areas.

They must indicate actual function, not generic sci-fi decoration.

### Micro edge/seam wear

Use selectively in traffic zones, not on every seam.

### Cleaning variation

Very faint streaking/uneven sheen can help Hygiene/Family spaces feel maintained by real life rather than procedurally perfect.

### Floor anchors beneath major fixed systems

Large machinery may sit within deliberately authored service-panel/registration zones so it feels installed into the ship rather than dropped on top of a generic tile field.

---

## 9. Production method recommendation

The Floor pass should be predominantly deterministic/procedural.

```text
Primary method:            M4 Procedural 2D Compositor / deterministic material variants
Base material authority:   accepted Transfer Ship Floor family + room-specific extensions
Room assignment authority: LevelSpec space identity / semantic room tags
AO geometry authority:     Shared Wall Graph / architecture geometry
Wear-mask authority:       authored semantic zones + deterministic seeded variation
Functional FloorFX:        exact Prop/room relationships, not generative guessing
Scene lighting:            LightOverlay only
```

Image generation is **not required by default** for this block. If a unique material source is later needed, it must be justified separately; final room layout/AO/wear geometry should remain deterministic.

---

## 10. Implementation order

Recommended production sequence:

```text
1. Define room floor material variants
2. Apply room identity in generated TS-01 Ground
3. Add wall AO FloorFX
4. Add seeded low-contrast use/wear overlays
5. Add Transfer Hero floor anchor / service registration
6. Complete Flow Regulator live-scale QA
7. Add Flow shadow/collision refinement
8. Add deterministic Flow coupling bus FloorFX
9. Full-room desktop QA
10. Phone-landscape QA
11. Tune intensity before acceptance
```

This order deliberately establishes room identity before adding more isolated Props.

---

## 11. Acceptance criteria

The Floor Treatment passes when:

- rooms can be distinguished by floor character without labels;
- every room still belongs to the same Transfer Ship;
- the ship feels maintained and inhabited rather than sterile or dirty;
- Family spaces show slightly more everyday irregularity than PRIMUS;
- Main Hall reads as circulation space;
- Transfer Room floor strengthens the Apparatus Hero rather than competing with it;
- wall AO adds depth without obvious dark outlines;
- wear follows plausible use rather than random noise;
- no FloorFX changes collision or pathfinding;
- no fake illumination is baked into Ground/FloorFX;
- no obvious repeated dirt tile pattern appears;
- desktop and phone gameplay views remain readable.

Final Gold-Slice acceptance still requires full-room Art-Director/gameplay QA after PRIMUS/domestic/candidate disposition work.
