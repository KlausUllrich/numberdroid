# Asset Recipe — TS-01 Flow Support / Transfer FloorFX

Status: **DESIGN PROPOSAL / USER ALIGNMENT PENDING — 2026-08-17**

This recipe defines the next TS-01 Gold-Slice production block after live acceptance of the Transfer Apparatus and Yellow Core. It records the current function-to-form proposal before any new source image is generated.

Current authorities:

- `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`
- `docs/art/production/PROP_ASSET_WORKFLOW.md`
- `docs/art/production/LIVE_QA_ITERATION_CLASSIFICATION.md`
- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md`
- `docs/art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- `src/levelgen/specs/ts01.ts`
- `src/levelgen/propRegistry.ts`

Related accepted Asset Family:

`art-source/approved/area-01-transfer-ship/transfer-system/`

---

## 1. What is already binding

Current TS-01 semantic/runtime state already contains:

```text
LevelSpec placement id:   transfer-flow
Prop id:                  flow-station
Space:                    transfer-room
Role:                     support
Relation:                 near transfer-core
Current coarse footprint: 2 × 2 tiles
Attachment:               floor
Allowed rotation:         0
```

The existing documents and code establish **that Flow is a Transfer-support machine near the Hero**, but they do not yet define precisely what physical process it performs. That missing meaning is the design task of this recipe; it must not be silently treated as pre-existing story canon.

The accepted Transfer Apparatus remains the primary room Hero. The accepted Yellow Core remains the persistent person/identity module and must not be visually confused with whatever Flow does.

---

## 2. Proposed semantic function — working definition

Working design name:

**Transfer Flow Regulator**

Proposed function:

> A compact service machine that conditions, stabilizes and synchronizes the **Transfer field / operating energy** used by the Apparatus while a Core moves between biological/robot bodies.

Important negative definition:

- Flow does **not** contain the person;
- Flow does **not** duplicate/store the Yellow Core;
- Flow should not make Transfer read as an ordinary data upload or backup operation;
- Flow is infrastructure supporting the transfer process, while the visible Yellow Core remains the persistent identity.

Conceptual system relationship:

```text
SHIP SERVICE / POWER FEED
          ↓
   FLOW REGULATOR
          ↓
flush FLOOR COUPLING / FIELD BUS
          ↓
   TRANSFER APPARATUS
          ↓
Human intake → Core platform → Body dock
```

This gives the large accepted Apparatus a believable support relationship without introducing another equally important machine.

---

## 3. Function-to-form philosophy

### Player read

At gameplay scale the player should understand:

1. this small machine belongs to the Transfer system;
2. it supplies/stabilizes something for the large Apparatus;
3. the relationship is physically visible rather than implied by arbitrary proximity;
4. the large Apparatus remains the destination/focal point;
5. the Yellow Core remains the unique amber identity object.

### Major silhouette

The Flow Regulator should be:

- compact and low-profile;
- visually subordinate to the 4×6 Hero;
- approximately circular / rounded-rectangular rather than a large upright cabinet;
- constructed from off-white ceramic shell + graphite technical center;
- built around **paired or nested regulator/coupler forms**, not another Core sphere;
- readable from near-nadir top-down without a frontal screen.

Preferred visual logic:

```text
quiet ceramic outer housing
    ↓
visible graphite service/coupling center
    ↓
small cyan stabilization/status elements
    ↓
clearly authored coupling edge/pads toward FloorFX bus
```

Avoid:

- a second glowing portal;
- a second large amber orb;
- reactor/turbine spectacle competing with the Apparatus;
- medical cross / generic “+” symbol from the current blockout;
- exposed pipe clutter;
- military/hazard styling;
- tall side-view console logic.

---

## 4. Color / semantic hierarchy

Use the accepted Transfer System split:

```text
WHITE / CERAMIC  = maintained civilian shell
GRAPHITE         = technical structure / recess
CYAN / BLUE      = normal system state / stabilization / synchronization
AMBER / YELLOW   = Transfer/Core identity and active transfer emphasis
```

For the static Flow Regulator, **cyan is the dominant emissive/status accent**. Amber should be absent or limited to a very small coupling/status detail.

Reason: the accepted Apparatus + Yellow Core already own the warm amber focal hierarchy. A strongly amber Flow machine would flatten the room hierarchy and make the support object read as a second reactor.

---

## 5. Proposed composition: Prop + FloorFX, not one monolithic image

### A. Flow Regulator — normal Floor Prop

Current semantic Prop remains `flow-station`.

Initial production intention:

- keep the existing 2×2 coarse solver anchor during source design;
- design the **visible machine smaller than the full 2×2 reservation**, leaving useful floor/breathing space;
- final visual exact-fit and collision bounds are authored only after source QA/runtime scale QA;
- physical collider should block only the machine body, not the whole 2×2 anchor;
- no floor plate baked into the Prop source;
- separate grounding shadow after useful runtime scale is established.

The existing 2×2 reservation is therefore treated as composition/use-space, not a requirement that the visible machine fill four tiles.

### B. Flow Bus / Coupling — separate FloorFX

A separate flush floor treatment should visibly connect Flow Regulator to Transfer Apparatus.

Proposed static FloorFX language:

- short service/coupling bus, not a navigational road;
- low-contrast graphite/inset base or registration brackets;
- one or two restrained cyan traces/status segments;
- ends visibly terminate at the regulator and Apparatus coupling area;
- no collision;
- no floor background plate;
- no global light claim.

The static bus should remain quiet. During later Transfer choreography, an animated `transfer-fx` overlay may pulse amber/cyan along the same conceptual path without changing the accepted static FloorFX.

This separation preserves future animation flexibility:

```text
Flow Regulator Prop         = persistent physical machine
static Flow FloorFX         = flush infrastructure / relationship cue
later animated transfer-fx  = temporary active energy/synchronization state
```

---

## 6. Room-composition intent

The current generated TS-01 places the Flow support near the accepted Transfer Apparatus. The room should read as a **system cluster**, not three unrelated props.

Desired hierarchy:

```text
1. Transfer Apparatus + Yellow Core  — unmistakable Hero
2. Flow Regulator + coupling bus     — technical support
3. Hologram / local control          — information/support
4. open floor / circulation          — deliberate breathing space
```

Flow should add visual richness mostly through **relationship and floor integration**, not through raw object size.

Do not fill the transfer room merely because it currently looks sparse. The Gold-Slice goal is meaningful density.

---

## 7. Perspective preflight

Gameplay camera:

**fixed orthographic top-down / accepted ND Shallow Top-Down near-nadir Prop treatment.**

Primary read must come from top surfaces and footprint.

Allowed:

- shallow rim depth;
- top-view couplers/recesses;
- subtle contact depth;
- top-facing status lenses/traces.

Forbidden:

- readable frontal monitor face;
- strong side panels;
- converging perspective;
- isometric extrusion;
- orientation dependent on a presentation camera.

---

## 8. Production method selection

### Flow Regulator Prop

```text
Primary production method: M1 Direct Generative Source
Material/source method:    M1 isolated transparent unique Prop
Optional finishing method: deterministic Crop/Fit + derived shadow; M3 only if a proven local-retouch need appears
Geometry authority:        approved generated source for visual silhouette; authored registry metadata for gameplay geometry
Topology/edge authority:   not modular; source owns visible isolated form
Material authority:        approved source under Transfer Ship palette contract
Why:                       unique expressive support Prop whose exact visual silhouette is not topology-critical
```

### Flow FloorFX

```text
Primary production method: M4 / deterministic procedural 2D composition
Geometry authority:        semantic placement relationship between flow-station and transfer-core
Topology/edge authority:   deterministic endpoints / path
Material authority:        Transfer Ship FloorFX rules
Why:                       the visual connection must align exactly with runtime placement and should be reproducible, not guessed by image generation
```

Do not generate the FloorFX as part of the Prop source image.

---

## 9. Authority split

```text
Flow function/design:          this recipe after user alignment
Prop visual silhouette:       approved high-resolution source
Coarse placement:             propRegistry.ts + TS01 LevelSpec
Exact visual/collision bounds: authored after production QA
Collision:                    propCollisionRegistry / Exact-Fit metadata as needed
Grounding shadow:             separate FloorFX derived/authored after scale QA
Static coupling FloorFX:      deterministic procedural runtime/art asset
Active transfer pulse later:  separate movable/animated transfer-fx
Scene illumination:           LightOverlay
Yellow Core identity:         existing accepted separate movable transfer-fx asset
```

Raster alpha never becomes runtime collision authority.

---

## 10. Initial source contract — pending user alignment

The first Flow Regulator source candidate should contain exactly one isolated machine:

- transparent background;
- no room/floor/wall;
- no Flow bus/FloorFX baked in;
- no shadow proposal baked in;
- no Yellow Core;
- no labels/UI text;
- no alternate variants on the same canvas;
- compact low-profile white/graphite Transfer support device;
- restrained cyan stabilization/status accents;
- no dominant amber energy center;
- top-down / ND Shallow Top-Down compatible.

No source image may be generated until the user sends the standalone command:

```text
generieren
```

---

## 11. Archive plan

If the source is explicitly approved, archive it in the existing Transfer System Asset Family rather than creating a new unrelated family.

Proposed canonical location:

```text
art-source/approved/area-01-transfer-ship/transfer-system/source/
  flow-regulator__approved-original__YYYY-MM-DD.png
```

Related deterministic/authoring FX belong under:

```text
art-source/approved/area-01-transfer-ship/transfer-system/fx/
```

Production masters may be preserved under `production/`; runtime files remain under `public/assets/`.

---

## 12. Production / QA sequence

```text
USER ALIGNMENT ON FUNCTION-TO-FORM
→ standalone `generieren`
→ one Flow Regulator source proposal
→ SOURCE QA
→ explicit source approval
→ archive + byte verification
→ deterministic runtime Crop/Fit
→ runtime scale QA beside Apparatus + PICO
→ authored visual/collision bounds
→ separate grounding shadow
→ deterministic static Flow FloorFX connection
→ registry/runtime integration
→ tests/build/deploy
→ live combined room QA
→ explicit acceptance
```

Evaluation questions:

- does Flow visibly belong to the Transfer Apparatus?
- does it remain clearly subordinate to the Hero?
- does it read as system support rather than another Core/reactor?
- do cyan/amber semantics preserve the accepted hierarchy?
- does the floor connection clarify function without becoming decorative route noise?
- can PICO move naturally around the support cluster?
- does the room gain meaningful visual density while preserving intentional open space?
