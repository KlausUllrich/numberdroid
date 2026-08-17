# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains runtime authority; this library preserves how accepted art is produced or deliberately revised.

Current spatial/presentation baseline: **v0.13.2 LIVE QA ACCEPTED on 2026-08-16**.

Current art milestone: **Transfer Apparatus + Yellow Core static presentation LIVE_ACCEPTED; Flow source integrated; Floor Treatment promoted to current major production block on 2026-08-17**.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | **LIVE_ACCEPTED** | `walls/` | 30 px visible fascia, 10 px collision core, M4 Procedural 2D Compositor. Frozen unless a concrete defect or approved extension appears. |
| 2 | Doors | **LIVE_ACCEPTED** | `doors/` | 5 px darker moving leaves, exact aperture clipping, compact pocket collars, 520 ms opening + 650 ms soft close, coloured-key variant. |
| 3 | Family / ordinary props | **MIXED: LIVE_ACCEPTED + LIVE_CANDIDATE** | `family-props/` | Family Table + shadow and Family Memory Console + shadow are accepted. Round Plant, Planter Trough, Coffee Machine and Hologram Pedestal remain candidates pending full-room disposition. |
| 4 | Transfer Apparatus | **LIVE_ACCEPTED** | `transfer-apparatus/` | 4×6 Hero; accepted source, deterministic runtime Crop/Fit, separate FloorFX shadow, authored silhouette collision with navigable transparent corners. |
| 5 | Yellow Core | **LIVE_ACCEPTED static resting state** | `yellow-core/` | 96×96 separate movable `transfer-fx` visual centered on Apparatus; no independent Prop collision. |
| 6 | **TS-01 Floor Treatment / room identity / AO / wear** | **CURRENT MAJOR PRODUCTION BLOCK** | `floor-treatment/` | Different but related room floors; subtle wall AO; usage-based wear/dirt; Transfer Hero floor anchoring; deterministic/M4-first. Accepted base Floor family remains the material foundation. |
| 7 | Flow support / functional FloorFX | **SOURCE_APPROVED + ARCHIVED / 128×128 RUNTIME_CANDIDATE — ACTIVE DEPENDENCY** | `flow-support/` | Live scale QA pending; then shadow/collision refinement and deterministic Flow coupling bus, coordinated with the Floor Treatment. |
| 8 | PRIMUS wall object / system hero | **NEXT after Floor/Flow integration** | `primus-console/` | Precise, attractive system object; assignment/order language without villain-black styling. |
| 9 | Useful domestic replacements | **AFTER Floor/Transfer/PRIMUS hierarchy** | coherent micro-set as needed | Child Bed, Toy/Personal Storage, Hygiene fixture/support and only surviving named functional placeholders. |
| 10 | Gold-Slice cohesion / finishing | **AFTER production replacements** | room-level pass | Resolve candidate Family props, remove obsolete blockouts, tune floor/AO/grounding and lighting, then desktop + phone QA. |
| 11 | PICO | **LIVE_ACCEPTED source baseline** | `robots/pico/` | Eight-view source frozen unless deliberate Character revision is requested. |
| 12 | Utility / hostile / special robots | **AFTER GOLD SLICE as required** | one character recipe per body | Build only bodies required by subsequent playable content. |
| 13 | Transfer choreography / animation FX | **AFTER static Gold-Slice acceptance unless explicitly reprioritized** | future `transfer-system/animation/` + FX recipes | Human → Core → PICO, body → body, synchronization/beam FX and scripted transfer staging. |

## Current Gold-Slice progression

```text
PICO source baseline         LIVE_ACCEPTED
Floor base family            ACCEPTED BASELINE
Walls                        LIVE_ACCEPTED
Doors                        LIVE_ACCEPTED
Family Table                 LIVE_ACCEPTED
Family Memory Console        LIVE_ACCEPTED
Family Props Batch 2         LIVE_CANDIDATE
Layout-v3 / v0.13.2          SPATIAL BASELINE ACCEPTED
Transfer Apparatus           LIVE_ACCEPTED
Yellow Core                  LIVE_ACCEPTED STATIC RESTING STATE
Flow Regulator source        APPROVED + ARCHIVED
Flow Regulator runtime       128×128 CANDIDATE / LIVE QA PENDING

CURRENT → Room-specific Floor identity + wall AO + use/wear + Transfer floor anchoring
ACTIVE  → Flow live-scale QA when Pages is available; finish Flow shadow/collision/bus inside Floor/Transfer pass
NEXT    → PRIMUS hero/system art
NEXT    → useful domestic replacements
NEXT    → room cohesion + candidate disposition + lighting/grounding tune
GATE    → desktop + phone Gold-Slice QA + explicit room acceptance
LATER   → Transfer choreography / broader content production
```

Detailed room-level sequence and exit criteria:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Floor Treatment brief:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

Transfer Hero production learnings:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

## Spatial / floor integration rule

The existing generated composite pipeline is the target integration path.

```text
Ground room material identity
→ FloorFX AO / wear / shadows / functional floor markings
→ Architecture
→ WallProps
→ FloorProps
→ explicit movable visuals such as transfer-fx
→ Characters
→ LightOverlay
```

Normal environmental Props still follow:

```text
semantic Prop identity
→ spatial registry / placement / Exact Fit
→ Prop Art Registry presentation binding
```

Movable components are not forced into the Prop lifecycle. The Yellow Core remains the proven example.

Floor/FX rules:

- room material assignment should derive from semantic room identity/tags rather than hard-coded painted coordinates where possible;
- wall AO should derive from semantic/architectural geometry;
- wear should follow plausible circulation/use and seeded deterministic variation;
- Ground/FloorFX never become collision authority;
- FloorFX is not scene illumination;
- no global tiled grunge texture should flatten all room identities.

## Production sequence rule

Before producing a final category, its recipe must state:

- production method / authority split;
- runtime dimensions/grid/world envelope as applicable;
- geometry/topology authority;
- material authority;
- alpha/background authority where applicable;
- spatial/collision authority;
- processing path;
- QA requirements.

Image generation remains subject to the hard standalone `generieren` gate. The Floor Treatment is expected to be primarily deterministic and therefore does **not** require image generation by default.

Before generating another source in response to live QA, classify the failure first: source/function/perspective vs runtime scale/crop vs placement/collision/shadow/floor treatment.

The recipe/index is updated after every accepted visual change. A category marked `LIVE_ACCEPTED` should not be reopened casually.
