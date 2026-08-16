# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains the runtime authority; this library preserves how accepted art is produced or deliberately revised.

Current spatial/presentation baseline: **v0.13.2 LIVE QA ACCEPTED on 2026-08-16**. See `docs/level-generation/V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | **LIVE_ACCEPTED** | `walls/` | 30 px visible fascia, 10 px collision core, M4 Procedural 2D Compositor. Live accepted 2026-08-15; frozen unless a concrete defect or approved extension appears. |
| 2 | Doors | **LIVE_ACCEPTED** | `doors/` | 5 px darker moving leaves, exact aperture clipping, compact pocket collars, 520 ms opening + 650 ms soft close, no status text, coloured-key variant. M4 + Art Production Toolkit. Live accepted 2026-08-15; v0.13.2 regression contract confirms generated + hand-authored Gold Slice Floors share this baseline. |
| 3 | Family / ordinary props | **MIXED: LIVE_ACCEPTED + LIVE_CANDIDATE** | `family-props/` | Family Table + shadow and Family Memory Console + shadow are LIVE_ACCEPTED. Round Plant, Planter Trough, Coffee Machine and Hologram Pedestal remain LIVE_CANDIDATE. v0.13.2 confirms stable generated spatial integration, not visual promotion. |
| 4 | Transfer apparatus / Core hero | **CURRENT NEXT PRODUCTION ASSET** | `transfer-apparatus/` | Primary environmental hero. Complete/revise recipe and method authority before first generation/edit. Must establish CORE/SLOT hierarchy, warm amber emissive source and reviewed visual/collision/effect envelopes. |
| 5 | Flow support / FloorFX | **NEXT after Transfer hero** | dedicated recipe/extension before production | Flow must visibly belong to the Transfer system. Grounding/path belongs in FloorFX only when functionally justified; scene illumination remains LightOverlay. |
| 6 | PRIMUS wall object / system hero | **NEXT after Transfer/Flow** | `primus-console/` | Precise, attractive system object; assignment/order language without villain-black styling or frontal cabinet perspective. Wall protrusion/collision remains explicit spatial metadata. |
| 7 | Useful domestic replacements | **AFTER hero hierarchy** | one coherent recipe/micro-set as needed | Replace only blockouts that materially improve habitation/readability: Child Bed, Toy/Personal Storage, Hygiene fixture/support and any surviving named functional placeholder. Avoid generic filler clutter. |
| 8 | PICO | **LIVE_ACCEPTED source baseline** | `robots/pico/` | Eight-view 768×96 source is recipe-local and deterministically materialized; frozen unless a deliberate character revision is requested. A smaller in-game player-model/presentation issue is known but deferred and must be classified before touching this source. |
| 9 | Utility / hostile / special robots | AFTER GOLD SLICE as required | one character recipe per body | Build only the bodies needed after environment/hero hierarchy is proven; allegiance remains runtime semantics. |
| 10 | Floor / Floor Heroes / final FloorFX | mixed accepted/planned | existing docs/assets remain authoritative until revisited | Base Floor is accepted. Final cohesion may add restrained use/wear/grounding without silently repainting the accepted base Floor. |

## Current Gold-Slice progression

```text
PICO source baseline      LIVE_ACCEPTED
Floor                     ACCEPTED BASELINE
Walls                     LIVE_ACCEPTED
Doors                     LIVE_ACCEPTED
Family Table              LIVE_ACCEPTED
Family Memory Console     LIVE_ACCEPTED
Family Props Batch 2      LIVE_CANDIDATE
Layout-v3 / v0.13.2       SPATIAL BASELINE ACCEPTED
Transfer Apparatus        CURRENT NEXT PRODUCTION ASSET
Flow support / FloorFX    NEXT
PRIMUS hero/system art    NEXT
Domestic replacements     AFTER HERO HIERARCHY
Final room cohesion       AFTER PRODUCTION REPLACEMENT
Other robots              AFTER GOLD SLICE AS REQUIRED
```

Detailed room-level sequence and exit criteria:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

## Spatial integration rule

The existing generated composite pipeline is the target integration path.

```text
semantic Prop identity
→ spatial registry / placement / Exact Fit
→ Prop Art Registry presentation binding
→ FloorFX / WallProps / FloorProps composite layers
```

Adding/replacing art must not infer collision from PNG alpha, reroll placement or create a second renderer. Spatial metadata changes are separate reviewed changes.

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

A generation prompt is required only when generation is actually used.

One image-generation pass means one generation, then stop for source QA. `QA` / `prüfen` / `check` is a hard no-generation command.

SVG composition placeholders remain provisional blockout assets, never production-category acceptance candidates. Remove or replace them when a named production asset proves useful.

The recipe/index is updated after every accepted visual change. A category marked `LIVE_ACCEPTED` should not be reopened casually.
