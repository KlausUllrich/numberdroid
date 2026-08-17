# Asset Recipe — TS-01 Yellow Core

Status: **`SOURCE_ARCHIVED / RUNTIME_ACCEPTED / LIVE_QA_PASS`**

The Yellow Core is the accepted movable identity/Transfer component of the TS-01 Transfer System. It is deliberately separate from the static Transfer Apparatus so the same visual can later move between apparatus, robot bodies and Transfer choreography states.

Asset Family:

`art-source/approved/area-01-transfer-ship/transfer-system/`

Primary authority:

- `fx/README.md` — approved source + accepted runtime contract;
- `docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md` — production reasoning/lessons;
- `docs/art/production/PROP_ASSET_WORKFLOW.md` — reusable workflow rules.

---

## Semantic / gameplay purpose

The Core represents the persistent identity/person that can move between bodies.

The player should read it as:

- valuable and central;
- compact and physically transferable;
- technological but not a stationary generator;
- clearly related to the Transfer Apparatus while remaining its own component.

The Core must support future states such as:

```text
RESTING ON APPARATUS
→ TRANSFERRING
→ ENTERING BODY
→ INSTALLED IN BODY
→ LEAVING BODY
```

The accepted static implementation only covers the resting state. Motion/FX are later choreography work.

---

## Accepted design language

Final function-to-form authority:

- compact circular module;
- luminous amber/yellow identity sphere as primary read;
- close-fitting white/graphite technical frame;
- thin orbital metal bands;
- restrained cyan system/stabilization accents;
- small integrated docking/contact features;
- no long spikes or station-like protrusions.

Rejected learning:

The earlier attractive candidate with long radial arms was rejected because the silhouette contradicted routine robot-to-robot transferability.

---

## Approved source authority

Canonical source:

```text
art-source/approved/area-01-transfer-ship/transfer-system/fx/
└─ yellow-core__approved-original__2026-08-17.png
```

Verified provenance:

```text
component:          yellow-core
approval date:      2026-08-17
source type:        ChatGPT image generation
image_gen gen_id:   aa37c4e9-57ab-4df0-b08a-7279e12f3a9a
format:             PNG RGBA
original size:      1254 × 1254 px
raw bytes:          1,418,808
sha256:             83f647900f0d5fba0dcd0c4f15ce9c705dbee90f4d9a12637129feeb9d64110d
git blob sha1:      f5e0a9f0afe3f966afe3a7b0b08fe7438ac1b297
repository verify:  PASS — byte-identical approved upload
```

The archived original is immutable source authority.

---

## Deterministic runtime materialization

Build path:

```text
scripts/materialize-yellow-core.mjs
→ scripts/art/toolkit/prop-source.mjs
→ public/assets/deck/yellow-core.png
```

Accepted production contract:

```text
source alpha crop:       x=155, y=116, w=946, h=968
runtime canvas:          96 × 96 px
runtime margin:          4 px
runtime content bounds:  x=5, y=4, w=86, h=88
runtime SHA-256:         b300e7d535aee21de75b6276c81b2c4973391d22dcb2bdcf79b50833f9d421ae
```

The production asset is a reproducible build product, not source authority.

---

## Runtime representation / layer authority

The Yellow Core is **not a normal environmental Prop**.

Accepted representation:

```text
visual layer:            transfer-fx
resting size:            96 × 96 px
resting anchor:          centered on Transfer Apparatus platform
independent collision:   none
Prop Registry entry:     none
Prop Art Registry entry: none
```

Reason:

The Core must later move between environmental machinery and actor bodies. Registering it as an ordinary static Prop would bind its lifecycle to spatial Prop placement/collision semantics that do not match that gameplay function.

The current `transfer-fx` representation provides a clean static resting state while preserving future script-controlled movement.

---

## Relationship to Transfer Apparatus

The accepted Transfer Apparatus source contains a solid central resting platform but **does not bake the Yellow Core into its pixels**.

Static composition:

```text
Transfer Apparatus FloorProp
+ Yellow Core transfer-fx sprite
= accepted resting presentation
```

This separation is binding for future animation work.

---

## Collision / movement authority

The Yellow Core itself owns no normal gameplay collision.

- Apparatus physical collision remains authored in `propCollisionRegistry.ts`;
- normal Human/Robot movement cannot cross visible Apparatus mass;
- the Core is a movable visual/state component;
- future Transfer sequences place/move Core and bodies explicitly under script/choreography control.

Do not derive gameplay collision from the Core PNG alpha.

---

## Live QA acceptance

Klaus reviewed the 96×96 runtime Core on the accepted 4×6 Transfer Apparatus in deployed TS-01 and marked it good/accepted.

Accepted visual conclusions:

- readable at gameplay scale;
- sufficiently important without overpowering the Apparatus;
- correct relative scale to PICO;
- centered convincingly on the resting platform;
- compact transferable silhouette reads correctly.

Final state:

```text
SOURCE APPROVED
→ USER UPLOAD VERIFIED
→ APPROVED SOURCE ARCHIVED
→ RUNTIME MATERIALIZED
→ TRANSFER-FX LAYER VALIDATED
→ 177/177 TESTS PASS
→ PRODUCTION BUILD PASS
→ LIVE QA PASS
→ RUNTIME ACCEPTED
```

---

## Future work — deliberately not part of current acceptance

- idle energy animation if justified;
- Core lift/movement path;
- Human → Core → PICO Transfer sequence;
- robot → robot Transfer sequence;
- synchronization/beam/energy FX;
- body insertion/removal visual states;
- layered animation authoring sources under the same Asset Family.

Do not reopen the accepted static source or resting scale merely to start these animation tasks.
