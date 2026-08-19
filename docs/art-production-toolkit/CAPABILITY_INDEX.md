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
| RGBA PNG encoding | **PROVEN** | `raster.mjs` | Writes exact non-interlaced 8-bit RGBA PNGs without extra dependencies | No broad general-purpose image editor |
| Prop alpha crop / runtime fit | **PROVEN** | `scripts/art/toolkit/prop-source.mjs`, `scripts/art/prepare-prop-asset.mjs`, `tools/prop-source-preparation.md` | Decodes standard 8-bit PNG source, removes a configured low-alpha halo, crops surviving alpha, performs premultiplied-alpha Lanczos resize and writes an exact transparent runtime canvas | Does not identify/remove an opaque or painted background; does not infer collision or visual bounds semantics |
| Directional actor connected-component/source integrity | **PROVEN** | `scripts/art/toolkit/directional-actor-source.mjs`, `scripts/assert-directional-actor-source-integrity.mjs`, `../art/production/ACTOR_GROUNDING_WORKFLOW.md` | Finds connected actor structure, detects detached below-body fragments, derives connected foot/support evidence and validates contact proximity | Does not decide final perceptual shadow placement; human live QA still owns calibration |
| Directional actor runtime sanitation | **PROVEN** | `scripts/sanitize-materialized-actor-assets.mjs`, `directional-actor-source.mjs` | Removes proven detached source artefacts from runtime derivatives while preserving approved source authority | Must not be used as generic repainting or to erase intended anatomy |
| Directional actor grounding profile / generated CSS / browser QA | **PROVEN** | `src/meta/characterGroundingProfiles.json`, `scripts/generate-character-grounding-css.mjs`, `scripts/render-pico-grounding-runtime-preview.mjs`, `../art/production/ACTOR_GROUNDING_WORKFLOW.md` | Keeps foot geometry, ambient/contact shadow data and explicit human QA deltas reproducible; generates runtime CSS and supports 8-direction + real-scene QA | Automated geometry/CI cannot decide final visual acceptance |
| Alpha/background removal (Freistellen) | **PLANNED** | `tools/freistellen.md` | Future extraction of foreground alpha and halo cleanup from non-transparent sources | No production implementation yet |
| Seamless/periodic texture construction | **PLANNED** | `tools/seamless-tiles.md` | Future synthesis/repair of truly periodic material textures | Ordinary image generation is not assumed seamless |
| Seamless/periodic texture validation | **PLANNED** | `tools/seamless-tiles.md` | Future opposite-edge metrics, wrap preview and repetition QA | Not implemented yet |
| Atlas packing / frame extraction | **PLANNED** | future tool doc | Deterministic packing/cropping from authored sources | Existing asset-specific scripts remain authoritative for now; generated TS-01 Props default to individual registered PNGs |
| Generic downscale / resample normalization | **PLANNED** | future tool doc | Broad controlled filter/downscale + post-resample QA across asset categories | Prop crop/fit now has a bounded Lanczos implementation; other asset classes still use existing per-asset code |
| Alpha halo / stray-pixel QA | **PLANNED** | `tools/qa-validation.md` | Detects contamination outside masks and matte halos generically | Prop preparation has configured low-alpha cleanup but no generic semantic halo detector |
| Palette / semantic-color QA | **PLANNED** | `tools/qa-validation.md` | Future checks for faction/system color contracts | Does not replace visual QA |

## Rule

Only capabilities marked **PROVEN** may be treated as existing production tools. PLANNED rows are roadmap slots, not promises of functionality.
