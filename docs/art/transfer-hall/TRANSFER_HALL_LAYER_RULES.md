# Transfer Hall Layer Rules

Status: **binding technical category contract — v0.13.2 generated spatial baseline accepted; production Art Parity CURRENT**

## Layer order

1. Ground: walkable base surface + room-specific material identity.
2. FloorFX: floor-projected shadows, static AO/grounding, wear overlays and non-light functional markings.
3. Architecture: wall bands, corners, T-junctions, end caps and architectural door interfaces.
4. WallProps: top-down wall equipment on transparent cells/sprites.
5. FloorProps: top-down free-standing objects on transparent cells/sprites.
6. Explicit movable world visuals such as accepted `transfer-fx` components when authored separately from normal Props.
7. Characters: player, NPC and enemy robots.
8. LightOverlay: scene illumination, above world objects/characters but below UI.
9. Overlay FX and UI: allegiance, scan, interaction and labels.

Props must never contain a floor/background plate. If removing a Prop removes visible floor, the Prop asset is wrong.

Generated TS-01 uses the same semantic ordering through its composite Floor visual. Production art consumes Level Compiler output; it does not become a second gameplay map.

---

## Ground / room-floor identity

The accepted Transfer Ship base Floor is the material-family baseline, not a requirement that every room use one identical flat texture.

Current Gold-Slice Floor treatment may add deterministic room-specific Ground variants for:

- Family Living;
- Child;
- Hygiene;
- Main Hall;
- Transfer Room;
- PRIMUS Allocation.

Binding rules:

- all variants remain recognizably part of one Transfer Ship material family;
- semantic room identity / tags should drive assignment where possible;
- differences should come from panel rhythm, tint/value, micro-texture, use/age and functional registration rather than unrelated art styles;
- threshold transitions remain controlled and legible;
- Ground is visual surface only and does not create collision semantics.

Detailed room treatment:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

---

## FloorFX — AO / wear / shadows / functional markings

FloorFX is a non-colliding visual layer below Architecture.

Allowed current uses:

- Prop grounding/contact shadows;
- static wall/architecture ambient occlusion;
- subtle room/use-specific wear or stain overlays;
- maintenance/service registration;
- deterministic Flow coupling bus;
- other functionally justified floor-projected markings.

Not allowed:

- scene illumination affecting Characters/Props;
- gameplay collision;
- generic full-room darkening/vignette;
- globally repeated grunge texture with no use logic;
- decorative navigation lines with no world function.

### Wall AO rule

A static AO/grounding pass may be derived deterministically from actual architecture/Shared Wall Graph geometry.

It must:

- fall softly into the room interior;
- remain subtle enough not to look like a black outline;
- preserve real Door/opening apertures with no fake occlusion across them;
- allow slightly stronger corner accumulation;
- avoid excessive double-darkening where Prop shadows already overlap;
- remain purely visual.

AO is **contact/occlusion grounding**, not scene lighting. Dynamic/local illumination remains `LightOverlay`.

### Wear / dirt rule

TS-01 wear should communicate use and age rather than generic dirt.

Prefer:

- traffic-path polishing/dulling/scuffs;
- local activity wear;
- rare small marks/stains;
- subtle panel replacement/maintenance variation.

Avoid normal-room rust, oil-spill language, heavy grime and obvious repeated dirt tiles.

Transfer Ship cleanliness thesis:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

---

## Perspective

Ground, Architecture, WallProps and FloorProps are strict orthographic/top-down environment categories. Detailed civilian Props may use accepted **ND Shallow Top-Down** near-nadir treatment when their recipe owns that asset class, but they must not depend on readable frontal/side furniture faces.

Only Characters deliberately use authored front/side/back/diagonal views.

---

## Wall and collision contract — LIVE_ACCEPTED

The accepted Gold-Slice wall kit uses **30 px visible fascia** while preserving the **10 px collision core**. Visual mass may extend beyond collision; gameplay wall geometry remains the 10 px structural contract.

A visible opening has no wall collision. Shared/generated walls are canonical semantic geometry, not overlapping room-owned decorations. Open ends/corners/Ts retain their accepted semantic treatment.

Walls are frozen unless live QA exposes a concrete defect or explicitly approved bounded revision.

---

## Doors — LIVE_ACCEPTED

Transfer Hall uses **5 px darker moving Door leaves** inside the substantial 30 px wall fascia.

Accepted Door behavior/presentation:

- exact doorway-aperture clipping hides retracting leaves geometrically;
- 520 ms opening;
- 650 ms monotonic soft close with no overshoot;
- compact pocket collars only at real wall terminations;
- no full-length guide rails through aperture;
- no visible `ZUTEILUNG` / `OPEN` status text;
- coloured-key variant uses a narrow semantic key-colour marker on a neutral graphite body;
- topology/collision/access logic remains separate from visual skin.

The hand-authored `transfer-hall` and generated `ts01-transfer-hall` share this reusable Gold-Slice Door contract.

---

## Props / true-space presentation — v0.13.2 ACCEPTED SPATIAL BASELINE

Visual art, coarse solver footprint, true-space placement envelope, collision and use-space are separate concerns.

Binding rules:

- `footprintTiles` / solved tile rectangle is deterministic coarse anchor/reservation;
- explicit visual/collision/custom bounds remain authored metadata;
- final true-space geometry may receive minimum sub-tile correction beyond its coarse anchor when necessary;
- translated geometry must remain valid against room surfaces, other Prop envelopes, foreign use-space/Hero reservations and Door Clearance;
- sprite, grounding shadow and physical collision receive same Exact-Fit translation;
- collision may be multipart/shaped when one rectangle creates implausible invisible mass;
- image alpha/canvas size never becomes automatic collision authority.

Canonical examples:

- Family Table uses multipart table + seat collision;
- Hologram pedestal uses 0.70 × 0.70 tile collider;
- Transfer Apparatus uses authored silhouette collision preserving transparent navigable corners;
- fallback Prop stubs are clipped/inset to visible room interior.

See `docs/level-generation/PROP_EXACT_FIT.md`, `GOLD_SLICE_REGRESSION_GATES.md` and `docs/art/production/LIVE_QA_ITERATION_CLASSIFICATION.md`.

---

## Current production state

```text
PICO                    LIVE_ACCEPTED source baseline
Floor base family       ACCEPTED BASELINE
Walls                   LIVE_ACCEPTED
Doors                   LIVE_ACCEPTED
Family Table            LIVE_ACCEPTED
Family Memory Console   LIVE_ACCEPTED
Family Props Batch 2    LIVE_CANDIDATE
v0.13.2 spatial pass    LIVE QA ACCEPTED
Transfer Apparatus      LIVE_ACCEPTED 4×6 + shadow + silhouette collision
Yellow Core             LIVE_ACCEPTED 96×96 static resting state / transfer-fx
Flow Regulator          APPROVED SOURCE / 128×128 RUNTIME CANDIDATE
Floor treatment         CURRENT MAJOR PRODUCTION BLOCK
PRIMUS hero/system art  NEXT AFTER FLOOR/FLOW
Domestic replacements  AFTER FLOOR/TRANSFER/PRIMUS HIERARCHY
```

The v0.13.2 PASS does not automatically promote `LIVE_CANDIDATE` images or future Floor treatment.

---

## Flow support / functional FloorFX

`flow-station` is a normal physical support Prop near `transfer-core`.

Dedicated recipe:

`art-source/recipes/transfer-hall/flow-support/recipe.md`

Current separation:

- compact physical Flow Regulator as FloorProp;
- flush deterministic coupling/service bus as FloorFX;
- later active energy/synchronization motion as temporary `transfer-fx`.

Do not bake the floor connection into Flow Prop source and do not use FloorFX as collision or scene illumination.

The static Flow bus should be completed as part of the current Transfer-Room Floor integration after Flow runtime-scale QA.

---

## Lighting

Scene illumination is never baked into ordinary Ground/Prop/FloorFX art. `LightOverlay` owns light that affects the scene/characters.

TS-01 remains calm. Accepted Transfer Apparatus/Yellow Core own the strongest restrained warm local emissive hierarchy. Flow support normally uses cooler/cyan status language.

---

## Tile-state identity

Animated/stateful tile effects are selected by **global GID**, never tileset-local index. Local IDs repeat between Ground, Architecture, FloorFX and Props.

Generated composite sprites use explicit semantic sprite/layer identities instead of relying on tile-local indices.

---

## Preview annotations

Floating room labels are debug/preview annotations, not diegetic final-game UI. Final information belongs to world art/signage, interaction UI or narrative UI.

---

## Directional characters

Important bodies use eight explicit authored views:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

A smaller player-model/presentation issue remains deferred. Do not reopen accepted PICO source until classified.

---

## Freeze / change discipline

Do not reopen foundational layer, wall, Door or v0.13.2 spatial architecture to solve ordinary production-art issues.

The current Floor treatment is an **additive visual-system extension on top of the accepted base Floor family**, not permission to replace collision/topology or repaint accepted architecture indiscriminately.

If new art exposes a genuine spatial-contract defect, treat it as a separate reviewed Engineering/Technical-Art change with regression/live QA.
