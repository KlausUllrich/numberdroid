# Numberdroid Art Production Methods

Status: **binding method-selection guide for gameplay art production**

This directory catalogs the ways Numberdroid can turn an art target into a production asset. It answers **how an asset should be produced and which stage owns which property**.

Read together with:

- `../art/production/ARTIST_AGENT_WORKFLOW.md`
- `../art/production/ART_ASSET_VALIDATION_RULES.md`
- `../art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `../art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `../../art-source/recipes/README.md`

Different asset problems require different tools. A character turnaround, modular wall kit, seamless floor material and hero machine do not share the same failure modes.

## Core separation

Treat these as separate responsibilities whenever possible:

1. **geometry** — exact silhouette, cell size, connector position, collision-corresponding structure;
2. **topology / edge semantics** — which apparent edge is truly exposed, continues into a neighbor, or is a real termination;
3. **material** — color, texture, roughness impression, wear and surface variation;
4. **shading / construction language** — outline, bevel, AO/contact depth, inset/highlight treatment;
5. **semantic accents** — CORE amber, system teal, allegiance overlays, warnings;
6. **runtime packing** — atlas/frame order, alpha, scale and compression;
7. **QA** — visual, structural, seam/repetition, map-context and live gameplay checks.

A generative model may be strong at material or form invention while being weak at exact geometry/topology. The selected production method must assign authority accordingly.

## Current method families

| ID | Method | Geometry authority | Material authority | Edge/topology authority | Best suited to | Main limitation |
|---|---|---|---|---|---|---|
| M1 | [Direct Generative Source](01-direct-generative-source/README.md) | model / later extraction | model | model / later cleanup | characters, concepts, isolated props, hero-source exploration | cannot guarantee exact modular geometry/connectors |
| M2 | [Controlled Art Pass](02-controlled-art-pass/README.md) | deterministic SVG/mask | image-edit / realism pass | deterministic restore; topology still explicit when needed | geometry-critical assets with simple exposed silhouettes | model cannot infer hidden neighbor topology from an isolated tile |
| M3 | [Layered Raster Editor / MCP](03-layered-raster-editor-mcp/README.md) | deterministic layers/masks | artist/model/tool | explicit layer/mask logic | retouch, paint-over, complex hero assets, supervised production | requires reliable programmable editor/tool contract |
| M4 | [Procedural 2D Compositor](04-procedural-2d-compositor/README.md) | deterministic geometry | generated/authored material swatch | deterministic semantic topology | modular walls, doors, panels, frames, sockets, repeatable architecture | less suitable for expressive free-form unique objects |

Methods can be combined. Example:

```text
M1 generates a borderless material swatch
        ↓
M4 applies it to exact geometry/topology
        ↓
M3 optionally performs supervised retouch
        ↓
production QA / live QA
```

## Method-selection questions

Before generating anything, answer:

1. Does the asset require pixel-exact geometry?
2. Does it contain modular connectors?
3. Can an apparent silhouette edge actually be a hidden continuation into a neighboring tile?
4. Does one material need to remain homogeneous across many pieces?
5. Must the texture itself be seamless / periodic?
6. Is the asset primarily a unique character/hero form?
7. Is manual/agent retouch likely to be necessary?

Use `METHOD_SELECTION_GATE.md` before starting a new production category.

## Default routing

- unique character silhouette / expressive body → start with **M1**;
- exact shape where visible outline is genuinely exposed → **M2** can work well;
- exact modular architecture with connector/exposed-edge semantics → prefer **M4**;
- complex paint-over, local corrections and layer-specific retouch → consider **M3**;
- seamless material → use the dedicated capability guidance; do not assume ordinary image generation creates a periodic texture.

## Method-specific skills

A skill is an operational specialization of a method, not a global art authority.

When a method benefits from an agent skill, store it inside that method:

```text
<method>/skill/<skill-name>/SKILL.md
```

The current `numberdroid-artist` skill belongs to **M2 Controlled Art Pass**:

`02-controlled-art-pass/skill/numberdroid-artist/SKILL.md`

Future M1/M3/M4 skills should live beside their own method instead of being placed in a global top-level `skills/` directory.

## Key TS-01 learning

Transfer Hall wall experiments established this boundary:

> A separated generation layout can tell an image model that pieces are separate, but cannot tell it which boundary is a true exposed architectural edge and which exists only because runtime packaging split a continuous wall into cells.

For modular walls the stronger authority model is:

```text
semantic geometry/topology
→ material source
→ procedural material fill
→ deterministic exposed-edge shading
→ no outline at connectors
→ connector canonicalization / exact edge QA
→ runtime atlas
```

This is M4.

## Recipe integration

Every `art-source/recipes/.../recipe.md` must record the chosen method or hybrid **before production starts**.

Recommended fields:

```text
Production method: M4 Procedural 2D Compositor
Material source method: M1 Direct Generative Source
Optional finishing method: M3 Layered Raster Editor
```

Choose a method because its authority model matches the asset problem, not because it is newest.

## Directory policy

Each method may contain:

```text
README.md
research/
scripts/
demos/
materials/
schemas/
skill/
```

Production asset-specific geometry, prompts and references belong in `art-source/recipes/`; reusable method mechanics belong here.

## History

Superseded experiments and the older duplicate art-pipeline handbook are stored under `../history/`. History is evidence, not current method authority.
