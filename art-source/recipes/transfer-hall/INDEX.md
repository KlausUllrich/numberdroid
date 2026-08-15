# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains the runtime authority; this library preserves how accepted art is produced or revised.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | **LIVE_ACCEPTED** | `walls/` | 30 px visible fascia, 10 px collision core, M4 Procedural 2D Compositor. Live accepted 2026-08-15: mass fits, homogeneous/quiet hierarchy, no visible connector/T errors. Freeze material/category treatment unless a concrete defect or deliberate approved extension appears. |
| 2 | Doors | **LIVE_ACCEPTED** | `doors/` | 5 px darker moving leaves, exact aperture clipping, compact pocket collars, 520 ms opening + 650 ms soft close, no status text, coloured-key variant. M4 + Art Production Toolkit. Live accepted 2026-08-15; freeze unless a concrete defect or approved extension appears. |
| 3 | Family / ordinary props | **MIXED: LIVE_ACCEPTED + LIVE_CANDIDATE** | `family-props/` | Family Table + shadow and Family Memory Console + shadow are LIVE_ACCEPTED. Round plant, planter trough, coffee machine and hologram pedestal are deployed LIVE_CANDIDATE composition inputs with separate shadows. Whole-room placement/density QA is now the current constraint. |
| 4 | Transfer apparatus / cradle | PLANNED — Gold Slice | dedicated hero recipe before production generation | Hero multi-tile object; warm CORE emissive source, illumination remains in LightOverlay. Production follows the detailed Gold Slice execution plan. |
| 5 | PRIMUS wall object / console | PLANNED — Gold Slice | dedicated recipe before production generation | Precise, attractive system object; not villain-black or side-view furniture. Production follows the detailed Gold Slice execution plan. |
| 6 | PICO | **LIVE_ACCEPTED** | `robots/pico/` | Accepted eight-view 768×96 source is recipe-local and deterministically materialized; frozen unless a deliberate character revision is requested. |
| 7 | Utility / hostile / special robots | AFTER GOLD SLICE as required | one character recipe per body | Build only the bodies needed after environment/hero hierarchy is proven; allegiance remains runtime semantics. |
| 8 | Floor / Floor Heroes / FloorFX | mixed accepted/planned | existing docs/assets remain authoritative until revisited | Base Floor is accepted. Gold Slice cohesion may add separate restrained wear/grounding FloorFX without silently repainting the accepted base floor. |

## Current Gold-Slice progression

```text
PICO                    LIVE_ACCEPTED
Floor                   ACCEPTED BASELINE
Walls                   LIVE_ACCEPTED
Doors                   LIVE_ACCEPTED
Family Table            LIVE_ACCEPTED
Family Memory Console   LIVE_ACCEPTED
Family Props Batch 2    LIVE_CANDIDATE / composition input
Room composition        CURRENT
SVG density blockout    CURRENT NEXT BLOCK
Transfer/Flow hero      PLANNED inside Gold Slice
PRIMUS hero             PLANNED inside Gold Slice
Other robots            AFTER Gold Slice as required
```

Detailed room-level sequence and exit criteria:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

## Rule for the sequence

Before the first image-generation/edit call for a final production category, its recipe folder must exist and state exact runtime dimensions/grid, deterministic geometry when applicable, material reference, selected production method, extraction/composition and QA. A generation prompt is required only when generation is actually used.

SVG composition placeholders are explicitly provisional blockout assets, not production-category acceptance candidates. They are removed or replaced after live composition QA.

The recipe is updated after every accepted visual change. A category marked `LIVE_ACCEPTED` should not be reopened casually.
