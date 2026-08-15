# Numberdroid Art Production Methods

Status: **binding method-selection guide for gameplay art production**

This directory catalogs the ways Numberdroid can turn an art target into a production asset. It answers **how an asset should be produced and which stage owns which property**.

Reusable deterministic operations are documented separately in `../art-production-toolkit/` and implemented under `../../scripts/art/toolkit/`. A method may compose multiple toolkit operations; do not promote every reusable operation into a new method.

Read together with:

- `../art/production/ARTIST_AGENT_WORKFLOW.md`
- `../art/production/ART_ASSET_VALIDATION_RULES.md`
- `../art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `../art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `../../art-source/recipes/README.md`

Different asset problems require different tools. A character turnaround, modular wall kit, seamless floor material and hero machine do not share the same failure modes.

## Core separation

Treat geometry, topology, material, shading, semantic accents, runtime packing and QA as separate responsibilities whenever possible.

## Current method families

| ID | Method | Geometry authority | Material authority | Edge/topology authority | Best suited to | Main limitation |
|---|---|---|---|---|---|---|
| M1 | [Direct Generative Source](01-direct-generative-source/README.md) | model / later extraction | model | model / later cleanup | characters, concepts, isolated props, hero-source exploration | cannot guarantee exact modular geometry/connectors |
| M2 | [Controlled Art Pass](02-controlled-art-pass/README.md) | deterministic SVG/mask | image-edit / realism pass | deterministic restore; topology still explicit when needed | geometry-critical assets with simple exposed silhouettes | model cannot infer hidden neighbor topology from an isolated tile |
| M3 | [Layered Raster Editor / MCP](03-layered-raster-editor-mcp/README.md) | deterministic layers/masks | artist/model/tool | explicit layer/mask logic | retouch, paint-over, complex hero assets, supervised production | requires reliable programmable editor/tool contract |
| M4 | [Procedural 2D Compositor](04-procedural-2d-compositor/README.md) | deterministic geometry | generated/authored material swatch | deterministic semantic topology | modular walls, doors, panels, frames, sockets, repeatable architecture; **live-proven on TS-01 Walls** | less suitable for expressive free-form unique objects |

Methods can be combined. Example:

```text
M1 generates a borderless material swatch
        ↓
M4 applies it to exact geometry/topology using toolkit primitives
        ↓
M3 optionally performs supervised retouch
        ↓
production QA / live QA
```

## Method selection

Use `METHOD_SELECTION_GATE.md` before starting a new production category. Choose a method because its authority model matches the asset problem, not because it is newest.

## Method-specific skills

A skill is an operational specialization of a method, not a global art authority. Store it inside the corresponding method under `skill/`.

## Key TS-01 learning

A separated generation layout can make pieces visually distinct to a model, but cannot tell it which apparent boundary is a real architectural end versus a runtime continuation. For modular walls the stronger authority model is semantic geometry/topology + independent material + deterministic exposed-edge treatment + connector canonicalization. This M4 model was live accepted on TS-01 Walls on 2026-08-15.

## Tool relation

Examples of method-to-tool composition:

- M2: masks + future alpha cleanup + downscale/QA;
- M4: masks + distance fields + compositor + connector canonicalization + seam QA;
- future seamless material workflow: periodic construction/repair + periodic validation tools, potentially feeding M2 or M4;
- M1/M3 prop workflows: future background-removal/freistellen + alpha QA + packing.

See `../art-production-toolkit/CAPABILITY_INDEX.md` for implementation status. Only capabilities marked PROVEN may be assumed to exist.

## Recipe integration

Every `art-source/recipes/.../recipe.md` must record the chosen method or hybrid before production starts. Production asset-specific geometry, prompts and references belong in recipes; reusable mechanics belong in the toolkit.

## History

Superseded experiments and the older duplicate art-pipeline handbook are stored under `../history/`. History is evidence, not current method authority.
