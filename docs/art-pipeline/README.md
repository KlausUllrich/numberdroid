# Numberdroid Art Pipeline Methods Handbook

Status: **living decision guide for visual-production methods**

This handbook answers a different question from the binding category contracts:

> Given an asset problem, **which production method should we use, what may that method own, and what must remain deterministic?**

It exists because Numberdroid now has several viable visual-production approaches. No single method should be forced onto every asset class.

Read together with:

- `ARTIST_AGENT_WORKFLOW.md`
- `ART_ASSET_VALIDATION_RULES.md`
- `ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
- `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `art-source/recipes/README.md`

## Core principle

Separate these concerns whenever possible:

1. **semantic geometry** — what the object/tile is and where it connects;
2. **material appearance** — surface, texture, wear, color variation;
3. **edge treatment** — exposed outline, bevel, AO, contact shadow;
4. **assembly rules** — connectors, caps, repeatability, seam behavior;
5. **runtime packaging** — exact atlas/sprite dimensions and IDs.

A generative model is strongest at material appearance and visual invention. It is not automatically authoritative for geometry, connector semantics, exact alpha, or runtime packing.

## Current method families

### A. Controlled Art Pass

Deterministic geometry guide → image edit/material pass → mask restore → connector restore/canonicalization → runtime downscale.

Use when the generator can materially enrich a known shape and the object-level silhouette is simple enough that a post-edit mask restore does not destroy the desired surface treatment.

See `approaches/01-controlled-art-pass/`.

### B. Spaced Generation Layout / Object Edit

The production atlas is expanded into separated generation cells with transparent gutters so the generator can perceive each component as an individual object. After generation, cells are extracted and deterministically repacked.

Use when an atlas layout causes adjacent shapes to visually merge during image editing.

This is **not sufficient by itself** when the generator cannot know which edges are exposed versus connectors.

See `approaches/02-spaced-generation-layout/`.

### C. Material Source + Procedural 2D Compositor

Generate or author material swatches independently from object geometry. A deterministic compositor maps material into semantic masks and computes outlines, AO, bevel/highlight and connector treatment from explicit edge semantics.

This is the preferred next experiment for modular Transfer Hall walls.

See `approaches/03-procedural-2d-compositor/`.

### D. External Layered Editor / Local Raster Pipeline

Use an editor or local graphics pipeline with controllable layers/masks — e.g. Photoshop-class tooling, Invoke/ComfyUI workflows, or future MCP-connected art applications — for cases where interactive paint-over, material references, local inpainting, masks or human/agent retouching provide value beyond deterministic composition.

See `approaches/04-external-layered-editor/`.

## Decision matrix

| Requirement | Controlled Art Pass | Spaced Gen Layout | Procedural 2D Compositor | External Layered Editor |
|---|---|---|---|---|
| Exact silhouette | strong after mask restore | strong after repack/mask restore | **excellent** | depends on mask discipline |
| Exact connector semantics | needs deterministic post-pass | does not solve semantics alone | **excellent** | possible with explicit masks |
| Homogeneous shared material | medium | medium | **excellent** | excellent |
| Rich unique object detail | strong | strong | medium unless layered | **excellent** |
| Modular walls/junction kits | workable | helper only | **preferred** | workable |
| Isolated props | strong | useful for sheets | useful for base treatment | **preferred for complex polish** |
| Hero machinery | medium | medium | useful for technical base | **preferred hybrid** |
| Character turnarounds | not geometry-mask driven | useful sheet layout | poor fit | generative/editor workflow preferred |
| Seamless/repeatable floor texture | possible but needs dedicated seam logic | not enough | promising with texture synthesis/tiling | strong with dedicated seamless tools |
| Pixel-level reproducibility | medium | medium | **excellent** | medium unless fully scripted |
| Easy batch regeneration | medium | medium | **excellent** | tool-dependent |

## Requirement classes that still need dedicated methods

The handbook is intentionally incomplete. Add new method families or extensions when requirements differ materially.

Known future classes include:

- seamless/repeatable floor and surface textures;
- decals and FloorFX;
- transparent top-down props with controlled contact shadow;
- hero objects with visual footprint different from collision footprint;
- animated doors and machinery;
- 8-direction character turnaround consistency;
- character animation frames;
- damage/state variants;
- lighting/emissive source extraction versus scene illumination;
- material recoloring or faction/state variants;
- large multi-tile setpieces;
- texture atlases where local uniqueness must coexist with global continuity.

Do not claim an existing approach solves one of these merely because it can produce an attractive image. Validate the relevant runtime property.

## Selection rule

Before production, state:

```text
ASSET CATEGORY
RUNTIME REQUIREMENTS
GEOMETRY AUTHORITY
MATERIAL AUTHORITY
EDGE / CONNECTOR AUTHORITY
SELECTED METHOD
WHY THIS METHOD
KNOWN FAILURE MODE TO WATCH
```

If two approaches are combined, state which stage owns which property.

## Evidence policy

Every approach folder should accumulate:

- `README.md` — method definition and current recommendation;
- `research/` — experiments, external findings, failed approaches;
- `scripts/` — reusable deterministic tooling where appropriate;
- `demo/` — minimal demonstration assets/results;
- links to real Numberdroid recipes using the method.

Negative results are valuable. Record them when they eliminate a tempting but unreliable path.
