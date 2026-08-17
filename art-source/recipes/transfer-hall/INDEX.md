# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains runtime authority; this library preserves how accepted art is produced or deliberately revised.

Current spatial/presentation baseline: **v0.13.2 LIVE QA ACCEPTED on 2026-08-16**.

Current art milestone: **Transfer Apparatus + Yellow Core static presentation LIVE_ACCEPTED on 2026-08-17**.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | **LIVE_ACCEPTED** | `walls/` | 30 px visible fascia, 10 px collision core, M4 Procedural 2D Compositor. Frozen unless a concrete defect or approved extension appears. |
| 2 | Doors | **LIVE_ACCEPTED** | `doors/` | 5 px darker moving leaves, exact aperture clipping, compact pocket collars, 520 ms opening + 650 ms soft close, coloured-key variant. |
| 3 | Family / ordinary props | **MIXED: LIVE_ACCEPTED + LIVE_CANDIDATE** | `family-props/` | Family Table + shadow and Family Memory Console + shadow are accepted. Round Plant, Planter Trough, Coffee Machine and Hologram Pedestal remain candidates pending full-room disposition. |
| 4 | Transfer Apparatus | **LIVE_ACCEPTED** | `transfer-apparatus/` | 4×6 Hero; accepted high-resolution source, deterministic runtime Crop/Fit, separate FloorFX shadow, authored silhouette collision with navigable transparent corners. |
| 5 | Yellow Core | **LIVE_ACCEPTED static resting state** | `yellow-core/` | 96×96 separate movable `transfer-fx` visual centered on the Apparatus platform; no independent Prop collision. Transfer choreography remains future work. |
| 6 | Flow support / functional FloorFX | **CURRENT NEXT PRODUCTION BLOCK** | dedicated recipe/extension before production | Must visibly support the accepted Transfer System. FloorFX only where function/grounding requires it; scene illumination remains LightOverlay. |
| 7 | PRIMUS wall object / system hero | **NEXT after Flow** | `primus-console/` | Precise, attractive system object; assignment/order language without villain-black styling. Wall protrusion/collision remains explicit metadata. |
| 8 | Useful domestic replacements | **AFTER Transfer/PRIMUS hierarchy** | coherent micro-set as needed | Replace only blockouts that materially improve habitation/readability: Child Bed, Toy/Personal Storage, Hygiene fixture/support and surviving named functional placeholders. |
| 9 | Gold-Slice cohesion / finishing | **AFTER production replacements** | room-level pass | Resolve candidate Family props, remove obsolete blockouts, add restrained floor use/wear/grounding and lighting convergence, then desktop + phone QA. |
| 10 | PICO | **LIVE_ACCEPTED source baseline** | `robots/pico/` | Eight-view source is frozen unless a deliberate character revision is requested. Known player-presentation issue remains separate. |
| 11 | Utility / hostile / special robots | **AFTER GOLD SLICE as required** | one character recipe per body | Build only bodies required by subsequent playable content. |
| 12 | Transfer choreography / animation FX | **AFTER static Gold-Slice hierarchy unless explicitly reprioritized** | future `transfer-system/animation/` + FX recipes | Human → Core → PICO, body → body, synchronization/beam FX and scripted transfer staging build on accepted static Apparatus/Core authorities. |

## Current Gold-Slice progression

```text
PICO source baseline         LIVE_ACCEPTED
Floor                        ACCEPTED BASELINE
Walls                        LIVE_ACCEPTED
Doors                        LIVE_ACCEPTED
Family Table                 LIVE_ACCEPTED
Family Memory Console        LIVE_ACCEPTED
Family Props Batch 2         LIVE_CANDIDATE
Layout-v3 / v0.13.2          SPATIAL BASELINE ACCEPTED
Transfer Apparatus           LIVE_ACCEPTED
Yellow Core                  LIVE_ACCEPTED STATIC RESTING STATE

CURRENT → Flow support / functional FloorFX
NEXT    → PRIMUS hero/system art
NEXT    → useful domestic replacements
NEXT    → room cohesion + candidate disposition + lighting/grounding
GATE    → desktop + phone Gold-Slice QA + explicit room acceptance
LATER   → Transfer choreography / broader content production
```

Detailed room-level sequence and exit criteria:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Transfer Hero production learnings:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

## Spatial integration rule

The existing generated composite pipeline is the target integration path.

Normal environmental Props:

```text
semantic Prop identity
→ spatial registry / placement / Exact Fit
→ Prop Art Registry presentation binding
→ FloorFX / WallProps / FloorProps composite layers
```

Movable components are not forced into that lifecycle. The Yellow Core is the first proven example: it uses a separate `transfer-fx` visual layer because its ownership/position must later change under script control.

Adding/replacing art must not infer collision from PNG alpha, reroll placement or create an ad-hoc second world renderer.

## Rule for production sequence

Before the first image-generation/edit call for a final production category, its recipe must state:

- runtime dimensions/grid or world envelope;
- selected production method/hybrid;
- geometry authority;
- topology/edge authority where relevant;
- material authority;
- alpha/background authority;
- spatial/collision authority;
- extraction/composition/packing path;
- QA requirements.

One image-generation pass means one generation, then stop for source QA. `QA` / `prüfen` / `check` is a hard no-generation command.

Before generating another source in response to live QA, classify the failure first: source/function/perspective vs runtime scale/crop vs placement/collision/shadow. Runtime problems should not be answered with unnecessary source rerolls.

The recipe/index is updated after every accepted visual change. A category marked `LIVE_ACCEPTED` should not be reopened casually.
