# TS-01 Transfer Hall — Art Recipe Index

This index tracks reproducible Gold-Slice source recipes. `main` remains the runtime authority; this library preserves how accepted art is produced or revised.

| Order | Asset/category | Status | Recipe | Notes |
|---:|---|---|---|---|
| 1 | Walls / Architecture | PREPARED FOR V3 | `walls/` | Current visible 24 px fascia works technically; next visual pass targets thicker, calmer, more homogeneous reference-like architecture. |
| 2 | Doors | PLANNED | `doors/` to be created before generation | Must be authored against accepted wall pockets/caps; moving leaves remain separate runtime objects. |
| 3 | Family / ordinary props | PLANNED | per prop/set recipe before generation | Rebuild current placeholder atlas as isolated top-down objects. |
| 4 | Transfer apparatus / cradle | PLANNED | dedicated hero recipe before generation | Hero multi-tile object; warm CORE emissive source, illumination remains in LightOverlay. |
| 5 | PRIMUS wall object / console | PLANNED | dedicated recipe before generation | Precise, attractive system object; not villain-black or side-view furniture. |
| 6 | PICO | LIVE_ACCEPTED | character recipe to be backfilled only if revision is needed | Current 8-view PICO is accepted; do not destabilize it merely to fit environment recipe conventions. |
| 7 | Utility / hostile / special robots | PLANNED | one character recipe per body | Build after environment hierarchy is established; allegiance remains runtime semantics. |
| 8 | Floor / Floor Heroes / FloorFX | mixed accepted/planned | existing docs/assets remain authoritative until revisited | Do not fold these into prop/hero recipes accidentally. |

## Rule for the sequence

Before the first image-generation/edit call for a category, its recipe folder must exist and state:

- exact runtime dimensions/grid;
- deterministic geometry source when applicable;
- material reference(s);
- production prompt;
- extraction/post-processing;
- QA and map-context tests.

The recipe is updated after every accepted visual change. It is not a historical dump of failed prompts.
