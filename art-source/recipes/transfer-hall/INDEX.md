# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains the runtime authority; this library preserves how accepted art is produced or revised.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | **LIVE_ACCEPTED** | `walls/` | 30 px visible fascia, 10 px collision core, M4 Procedural 2D Compositor. Live accepted 2026-08-15: mass fits, homogeneous/quiet hierarchy, no visible connector/T errors. Freeze unless a concrete defect or deliberate material upgrade appears. |
| 2 | Doors | PLANNED | `doors/` to be completed before production | Must be authored against accepted wall pockets/caps; moving leaves remain separate runtime objects. Strong candidate for M4 + optional generated material. |
| 3 | Family / ordinary props | PLANNED | per prop/set recipe before generation | Rebuild current placeholder atlas as isolated top-down objects. Likely M1 source + deterministic extraction; M4 only where geometry is genuinely fixed. |
| 4 | Transfer apparatus / cradle | PLANNED | dedicated hero recipe before generation | Hero multi-tile object; warm CORE emissive source, illumination remains in LightOverlay. Likely M1/M3, with deterministic masks/packing where useful. |
| 5 | PRIMUS wall object / console | PLANNED | dedicated recipe before generation | Precise, attractive system object; not villain-black or side-view furniture. Hybrid M1/M4 is plausible. |
| 6 | PICO | LIVE_ACCEPTED | character recipe to be backfilled only if revision is needed | Current 8-view PICO is accepted; do not destabilize it merely to fit environment recipe conventions. |
| 7 | Utility / hostile / special robots | PLANNED | one character recipe per body | Build after environment hierarchy is established; allegiance remains runtime semantics. |
| 8 | Floor / Floor Heroes / FloorFX | mixed accepted/planned | existing docs/assets remain authoritative until revisited | Do not fold these into prop/hero recipes accidentally. |

## Current Gold-Slice progression

```text
PICO            LIVE_ACCEPTED
Floor           ACCEPTED BASELINE
Walls           LIVE_ACCEPTED (M4 breakthrough)
Doors           NEXT ARCHITECTURAL CATEGORY
Props           PLANNED
Hero assets     PLANNED
Other robots    PLANNED
```

## Rule for the sequence

Before the first image-generation/edit call for a category, its recipe folder must exist and state:

- exact runtime dimensions/grid;
- deterministic geometry source when applicable;
- material reference(s);
- selected production method from `docs/art-production-methods/`;
- production prompt when generation is used;
- extraction/post-processing;
- QA and map-context tests.

The recipe is updated after every accepted visual change. It is not a historical dump of failed prompts.

A category marked `LIVE_ACCEPTED` should not be reopened casually. New work should move forward to the next category unless live QA exposes a concrete regression or the user explicitly approves a bounded revision.
