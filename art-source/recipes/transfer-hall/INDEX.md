# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains the runtime authority; this library preserves how accepted art is produced or revised.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | **LIVE_ACCEPTED** | `walls/` | 30 px visible fascia, 10 px collision core, M4 Procedural 2D Compositor. Live accepted 2026-08-15: mass fits, homogeneous/quiet hierarchy, no visible connector/T errors. Freeze unless a concrete defect or deliberate material upgrade appears. |
| 2 | Doors | **INTEGRATED / LIVE_QA_PENDING** | `doors/` | 5 px moving leaf + compact pocket collars; M4 materialization through Art Production Toolkit, existing runtime motion retained. Gold pass removes the old full-aperture guide rails. |
| 3 | Family / ordinary props | PLANNED | per prop/set recipe before generation | Rebuild current placeholder atlas as isolated top-down objects. Likely M1 source + deterministic extraction; M4 only where geometry is genuinely fixed. |
| 4 | Transfer apparatus / cradle | PLANNED | dedicated hero recipe before generation | Hero multi-tile object; warm CORE emissive source, illumination remains in LightOverlay. Likely M1/M3, with deterministic masks/packing where useful. |
| 5 | PRIMUS wall object / console | PLANNED | dedicated recipe before generation | Precise, attractive system object; not villain-black or side-view furniture. Hybrid M1/M4 is plausible. |
| 6 | PICO | LIVE_ACCEPTED | `robots/pico/` | Accepted eight-view 768×96 source is recipe-local and deterministically materialized; frozen unless a deliberate character revision is requested. |
| 7 | Utility / hostile / special robots | PLANNED | one character recipe per body | Build after environment hierarchy is established; allegiance remains runtime semantics. |
| 8 | Floor / Floor Heroes / FloorFX | mixed accepted/planned | existing docs/assets remain authoritative until revisited | Do not fold these into prop/hero recipes accidentally. |

## Current Gold-Slice progression

```text
PICO            LIVE_ACCEPTED
Floor           ACCEPTED BASELINE
Walls           LIVE_ACCEPTED (M4 breakthrough)
Doors           INTEGRATED / LIVE_QA_PENDING
Props           PLANNED
Hero assets     PLANNED
Other robots    PLANNED
```

## Rule for the sequence

Before the first image-generation/edit call for a category, its recipe folder must exist and state exact runtime dimensions/grid, deterministic geometry when applicable, material reference, selected production method, extraction/composition and QA. A generation prompt is required only when generation is actually used.

The recipe is updated after every accepted visual change. A category marked `LIVE_ACCEPTED` should not be reopened casually.
