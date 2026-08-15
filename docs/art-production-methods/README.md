# Numberdroid Art Production Methods

Status: **binding method-selection guide for gameplay art production**

This directory is the top-level catalog of ways Numberdroid can turn an art target into a production asset. It supplements `ARTIST_AGENT_WORKFLOW.md`, `ART_ASSET_VALIDATION_RULES.md`, the category-specific contracts, and `art-source/recipes/`.

The catalog exists because different asset problems require different tools. A character turnaround, a modular wall kit, a seamless floor material, and a hero machine do **not** have the same failure modes. Do not force every category through one image-generation workflow.

## Core separation

Treat these as separate responsibilities:

1. **geometry** — exact silhouette, cell size, connector position, collision-corresponding structure;
2. **topology / edge semantics** — which apparent edge is truly exposed, which continues into a neighbor, which is a real cap/termination;
3. **material** — color, texture, roughness impression, wear, surface variation;
4. **shading / construction language** — outline, bevel, AO/contact depth, inset/highlight treatment;
5. **semantic accents** — CORE amber, restrained system teal, allegiance overlays, warnings;
6. **runtime packing** — atlas order, frame order, alpha, downscale, compression;
7. **QA** — visual, structural, seam/repetition, map-context and live gameplay checks.

A generative model may be strong at material or character form while being weak at exact geometry or topology. The production method must assign authority accordingly.

## Current method families

| ID | Method | Geometry authority | Material authority | Edge/topology authority | Best suited to | Main limitation / status |
|---|---|---|---|---|---|---|
| M1 | [Direct Generative Source](01-direct-generative-source/README.md) | model / later extraction | model | model / later cleanup | characters, concepts, isolated props, hero-source exploration | cannot guarantee exact modular geometry/connectors |
| M2 | [Controlled Art Pass](02-controlled-art-pass/README.md) | deterministic SVG/mask | image-edit / realism pass | deterministic restore, but model still sees isolated silhouette | geometry-critical assets where semantic edge treatment is simple | model cannot infer hidden neighbor topology from a separated tile |
| M3 | [Layered Raster Editor / MCP](03-layered-raster-editor-mcp/README.md) | deterministic layers/masks | artist/model/tool | explicit layer/mask logic | retouch, paint-over, masks, complex hero assets, supervised production | requires a reliable programmable editor connection and command contract |
| M4 | [Procedural 2D Compositor](04-procedural-2d-compositor/README.md) | deterministic geometry | generated/authored material swatch | deterministic semantic topology | modular walls, doors, panels, frames, sockets, repeatable architecture | **live-proven for TS-01 Walls on 2026-08-15**; less suitable for free-form characters or highly painterly unique objects |

Methods can be combined. A common target pipeline is:

```text
M1 generates a material swatch or hero source
        ↓
M4 applies it to exact geometry and semantic edges
        ↓
M3 optionally performs supervised retouch
        ↓
production QA / live QA
```

## Method-selection questions

Before generating anything, answer:

1. Does the asset require **pixel-exact geometry**?
2. Does it contain **modular connectors**?
3. Can an apparent silhouette edge actually be a **hidden continuation into a neighboring tile**?
4. Does the same material need to remain **homogeneous across many pieces**?
5. Must the texture itself be **seamless / periodic**?
6. Is the asset primarily a **unique character/hero form** rather than repeatable architecture?
7. Is manual/agent retouch likely to be necessary?

### Default routing

- Unique character silhouette / expressive body: start with **M1**.
- Exact shape, but every visible outline is genuinely exposed: **M2** can work well.
- Exact modular architecture with connector/exposed-edge semantics: prefer **M4**.
- Complex paint-over, local corrections, masks and layer-specific retouch: consider **M3**.
- Seamless material: see [`capabilities/seamless-materials.md`](capabilities/seamless-materials.md); do not assume ordinary image generation makes a periodic texture.

## Key TS-01 learning

The Transfer Hall wall experiments established an important boundary:

> A separated generation layout can tell an image model that pieces are separate, but it cannot tell the model which boundary is a true exposed architectural edge and which boundary exists only because the runtime atlas split a continuous wall into cells.

Asking the model to create both the common wall material **and** the correct per-edge outline/bevel therefore over-assigns responsibility to the model.

For modular walls, the stronger architecture is:

```text
semantic geometry/topology
→ material source
→ procedural material fill
→ deterministic exposed-edge shading
→ no outline at connectors
→ connector canonicalization / exact edge QA
→ runtime atlas
```

This is M4, and it was live-accepted for the complete TS-01 Wall category on 2026-08-15. The accepted result used a 30 px visible fascia over the unchanged 10 px collision core and achieved the desired calm, homogeneous architectural hierarchy without visible T/connector defects.

See `docs/TRANSFER_HALL_WALL_COMPOSITOR_ACCEPTANCE_2026-08-15.md`.

## Recipe integration

Every `art-source/recipes/.../recipe.md` must record the chosen method or hybrid method **before production starts**.

Recommended fields:

```text
Production method: M4 Procedural 2D Compositor
Material source method: M1 Direct Generative Source
Optional finishing method: M3 Layered Raster Editor
```

Do not choose a method because it is the newest method. Choose it because its authority model matches the asset problem.

A method being proven on one category does not make it universal. M4 now has strong evidence for modular architecture; it still should not replace M1/M3 for expressive characters or unique hero forms.

## Directory policy

Each method folder may grow to contain:

```text
README.md                 # binding method description
research/                 # experiments, tool evaluations, negative results
scripts/                  # method-specific utilities or links to canonical scripts
demos/                    # minimal reproducible examples, not production assets
materials/                # small approved/demo material sources when appropriate
schemas/                  # recipe/topology/render schemas when needed
```

Do not duplicate production sources unnecessarily. Production asset-specific geometry, prompts and references belong in `art-source/recipes/`; reusable method mechanics belong here.

## Current related reusable documents

- `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `docs/ART_PIPELINE_LOCAL_EXPERIMENTS_2026-08-14.md`
- `docs/TRANSFER_HALL_WALL_COMPOSITOR_ACCEPTANCE_2026-08-15.md`
- `ARTIST_AGENT_WORKFLOW.md`
- `ART_ASSET_VALIDATION_RULES.md`
- `art-source/recipes/README.md`

This catalog is expected to grow as new requirements appear.
