# Art Production Toolkit — Capability Index

This is the authoritative inventory of reusable art-processing capabilities.

| Capability | Status | Code / documentation | What it does | What it does not do |
|---|---|---|---|---|
| Binary geometry masks | **PROVEN** | `scripts/art/toolkit/masks.mjs` | Builds exact raster masks from deterministic geometry predicates | Does not invent geometry |
| Exposed vs connector edge classification | **PROVEN** | `masks.mjs`, `tools/compositor2d.md` | Prevents runtime connectors from being treated as object ends | Requires explicit connector semantics |
| Interior distance field | **PROVEN** | `masks.mjs` | Supplies deterministic distance-to-exposed-edge data for AO/outline/highlight passes | Not a physical lighting simulation |
| Masked material compositor | **PROVEN** | `compositor.mjs`, `tools/compositor2d.md` | Applies shared material to exact geometry with controlled edge shading | Does not generate the material source |
| Semantic connector canonicalization | **PROVEN** | `connectors.mjs` | Makes named modular connector strips interchangeable using median canonical strips + inward blend | Cannot infer semantic classes reliably from pixels alone |
| Connector seam metric | **PROVEN** | `connectors.mjs`, `tools/qa-validation.md` | Measures actual boundary difference; supports SAME-type seam QA | A score alone does not judge visual quality; negative control still required by production QA |
| RGBA PNG encoding | **PROVEN** | `raster.mjs` | Writes exact non-interlaced 8-bit RGBA PNGs without extra dependencies | No general PNG decode/edit API yet |
| Alpha/background removal (Freistellen) | **PLANNED** | `tools/freistellen.md` | Future extraction of foreground alpha and halo cleanup | No production implementation yet |
| Seamless/periodic texture construction | **PLANNED** | `tools/seamless-tiles.md` | Future synthesis/repair of truly periodic material textures | Ordinary image generation is not assumed seamless |
| Seamless/periodic texture validation | **PLANNED** | `tools/seamless-tiles.md` | Future opposite-edge metrics, wrap preview and repetition QA | Not implemented yet |
| Atlas packing / frame extraction | **PLANNED** | future tool doc | Deterministic packing/cropping from authored sources | Existing asset-specific scripts remain authoritative for now |
| Downscale / resample normalization | **PLANNED** | future tool doc | Controlled filter/downscale + post-resample QA | Existing per-asset code remains in place |
| Alpha halo / stray-pixel QA | **PLANNED** | `tools/qa-validation.md` | Detects contamination outside masks and matte halos | No generic production implementation yet |
| Palette / semantic-color QA | **PLANNED** | `tools/qa-validation.md` | Future checks for faction/system color contracts | Does not replace visual QA |

## Rule

Only capabilities marked **PROVEN** may be treated as existing production tools. PLANNED rows are roadmap slots, not promises of functionality.
