# Asset Recipe — TS-01 Flow Support / Transfer FloorFX

Status: **FLOW REGULATOR SOURCE APPROVED + ARCHIVED / 128×128 RUNTIME CANDIDATE / LIVE QA PENDING — 2026-08-17**

This recipe owns the current Flow support design for the TS-01 Gold Slice. The physical Flow Regulator source is approved and byte-identically archived. A first runtime-scale candidate is being integrated before shadow, collision refinement and the deterministic floor coupling bus are finalized.

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

## 1. Semantic function

Working design name:

**Transfer Flow Regulator**

The existing TS-01 semantic contract already defines:

```text
LevelSpec placement id:   transfer-flow
Prop id:                  flow-station
Space:                    transfer-room
Role:                     support
Relation:                 near transfer-core
Coarse footprint:         2 × 2 tiles
Attachment:               floor
Allowed rotation:         0
```

The visual production pass defines Flow as:

> A compact service machine that conditions, stabilizes and synchronizes the Transfer field / operating energy used by the Apparatus while a Core moves between biological/robot bodies.

Negative definition:

- Flow does **not** contain the person;
- Flow does **not** duplicate/store the Yellow Core;
- Flow must not make Transfer read as an ordinary upload/backup operation;
- Flow is infrastructure supporting the process while the Yellow Core remains the persistent identity.

System relationship:

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

---

## 2. Approved function-to-form direction

The Flow Regulator is deliberately subordinate to the accepted 4×6 Transfer Apparatus.

Accepted visual principles:

- compact, low-profile, near-circular machine;
- top surfaces and footprint carry the read;
- off-white/ceramic shell with graphite technical structure;
- cyan/blue is the dominant emissive/status language for stabilization/synchronization;
- only tiny amber service accents are allowed;
- no Yellow-Core-like sphere;
- no second large reactor/portal focal point;
- no frontal monitor / side-view cabinet logic;
- no exposed military pipe/hazard language.

The first generated candidate introduced an undefined three-wave icon in the center. Live source QA rejected that symbol because it had no established Numberdroid semantic meaning. The accepted revision removes the invented icon and communicates Flow through concentric regulator/coupler structure instead.

Binding lesson for this asset:

> Do not invent new diegetic symbols merely because an image generator uses a familiar generic visual shorthand. A new symbol needs explicit semantic authority before it becomes production language.

---

## 3. Approved high-resolution source authority

Canonical archive source:

```text
art-source/approved/area-01-transfer-ship/transfer-system/source/
└─ flow-regulator__approved-original__2026-08-17.png
```

Verified provenance:

```text
component:          flow-regulator / semantic prop flow-station
approval date:      2026-08-17
source type:        ChatGPT image generation
image_gen gen_id:   713991af-cc1b-4561-b431-682e9fcf8f15
format:             PNG RGBA
original size:      1254 × 1254 px
raw bytes:          2,143,729
sha256:             e4ed4130e7a1c615986f2011237c78ddd5a4bb51c7e041586327e8c5be992f1e
git blob sha1:      721339138768c1244be6991a9da0fe57ee7d10cc
repository verify:  PASS — byte-identical approved upload
```

The archived original is immutable visual authority. Runtime derivatives never replace it.

---

## 4. Runtime scale candidate

The first in-game candidate is materialized deterministically by:

```text
scripts/materialize-flow-regulator.mjs
→ scripts/art/toolkit/prop-source.mjs
→ public/assets/deck/flow-regulator.png
```

Pinned source/extraction contract:

```text
source dimensions:       1254 × 1254 px
alpha cutoff:            4
source alpha crop:       x=49, y=45, w=1156, h=1164
runtime canvas:          128 × 128 px
runtime tile canvas:     2 × 2 tiles @ 64 px/tile
runtime margin:          8 px
runtime content bounds:  x=8, y=8, w=111, h=112
runtime SHA-256:         pending first CI materialization
art registry status:     candidate
shadow:                  intentionally pending runtime scale QA
static Flow bus:         intentionally pending runtime scale/placement QA
```

The 2×2 canvas matches the existing semantic solver reservation, but the visible source uses only about 111×112 px inside that canvas. The reservation therefore remains composition/use-space rather than a requirement that visible machine mass fill all four tiles.

Live QA must decide whether the 128×128 candidate feels correctly subordinate to the 4×6 Hero before final shadow/collision/FloorFX work.

---

## 5. Composition: physical Prop + deterministic FloorFX

### A. Flow Regulator — normal Floor Prop

`flow-station` remains a normal physical floor Prop.

Current candidate rules:

- 2×2 coarse reservation remains unchanged;
- visible runtime source is fitted within that reservation;
- no floor plate baked into the PNG;
- no shadow baked into the PNG;
- current default collision remains provisional until live scale/spacing QA;
- final exact-fit/collision metadata must describe physical machine mass, not transparent canvas whitespace.

### B. Flow Bus / Coupling — separate FloorFX

After Regulator runtime scale/placement is accepted, add a deterministic static floor coupling that visibly connects Flow to the Apparatus.

Intended static language:

- short service/coupling bus, not a navigation road;
- low-contrast graphite/inset registration structure;
- one or two restrained cyan status traces;
- exact endpoint at Regulator and Apparatus coupling zones;
- no collision;
- no floor background plate;
- no scene-light claim.

Future active Transfer choreography may animate/pulse along the same conceptual path on a separate transfer-fx layer.

```text
Flow Regulator Prop         = persistent physical machine
static Flow FloorFX         = flush infrastructure / relationship cue
later animated transfer-fx  = temporary active synchronization state
```

---

## 6. Color / hierarchy contract

```text
WHITE / CERAMIC  = maintained civilian shell
GRAPHITE         = technical structure / recess
CYAN / BLUE      = stabilization / synchronization / normal system state
AMBER / YELLOW   = Core / Transfer identity and active transfer emphasis
```

The accepted Flow source uses cyan as its dominant luminous language. Small amber service accents are permitted but must not compete with the Yellow Core or Apparatus amber center.

Room hierarchy remains:

```text
1. Transfer Apparatus + Yellow Core  — Hero
2. Flow Regulator + coupling bus     — technical support
3. Hologram / local control          — information/support
4. open floor / circulation          — deliberate breathing space
```

---

## 7. Perspective / production method

Gameplay camera:

**fixed orthographic top-down / accepted ND Shallow Top-Down near-nadir Prop treatment.**

### Flow Regulator

```text
Primary method:            M1 Direct Generative Source
Production transform:      deterministic Crop/Fit
Geometry authority:        approved source for visual form; authored registry metadata for gameplay geometry
Material authority:        approved source under Transfer Ship palette contract
Shadow:                    separate derived/authored FloorFX after scale QA
```

### Static Flow FloorFX

```text
Primary method:            M4 / deterministic procedural 2D composition
Geometry authority:        actual semantic placement relationship between flow-station and transfer-core
Topology/endpoints:        deterministic runtime/world coordinates
Material authority:        Transfer Hall FloorFX contract
```

Do not use image generation to guess the exact floor connection geometry.

---

## 8. Authority split

```text
Flow function/design:          this recipe
Prop visual source:            archived approved PNG
Coarse placement:             propRegistry.ts + TS01 LevelSpec
Exact visual/collision bounds: authored after runtime QA
Collision:                    propCollisionRegistry / Exact-Fit metadata as needed
Grounding shadow:             separate FloorFX after scale QA
Static coupling FloorFX:      deterministic procedural asset
Active transfer pulse later:  separate movable/animated transfer-fx
Scene illumination:           LightOverlay
Yellow Core identity:         existing accepted movable transfer-fx asset
```

Raster alpha is not collision authority.

---

## 9. Current QA sequence

```text
SOURCE APPROVED
→ USER UPLOAD VERIFIED
→ APPROVED SOURCE ARCHIVED
→ 128×128 deterministic runtime candidate
→ tests/build/deploy
→ LIVE SCALE QA beside Apparatus + PICO
→ final visual/collision bounds
→ grounding shadow
→ deterministic static Flow bus
→ combined room QA
→ explicit LIVE_ACCEPTED
```

Evaluation questions:

- is the Regulator visibly subordinate to the Apparatus?
- does it still read clearly as a meaningful machine at gameplay scale?
- does it read as stabilization/support rather than another Core/reactor?
- do cyan/amber semantics preserve the hierarchy?
- can PICO move naturally around the cluster?
- after scale acceptance, can a short floor coupling clarify function without becoming decorative route noise?
