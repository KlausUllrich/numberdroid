# M2 — Controlled Art Pass

Status: **supported; proven for material enrichment, not universal topology solving**

This is the deterministic-geometry → generative-material workflow originally established by the Transfer Hall wall experiments.

## Authority model

- deterministic SVG/mask owns geometry;
- raster guide owns the edit layout presented to the image tool;
- image edit / realism pass owns material richness;
- deterministic mask restore owns final alpha/silhouette;
- connector logic owns exact modular boundaries;
- the generative result never becomes authoritative geometry.

## Current workflow

```text
semantic spec
→ geometry.svg
→ generation-layout.svg / raster guide
→ guide QA
→ image edit / realism pass
→ material QA
→ crop/extract generation cells
→ restore structural masks
→ connector canonicalization when applicable
→ runtime downscale / packing
→ production QA
→ live QA
```

## Two different layouts are required

### Production / compact layout

The actual runtime atlas arrangement. Cells may touch because they are packed with no gutters.

### Generation layout

A separate layout intended only for the image tool. Geometry is copied into isolated cells with transparent gutters so neighboring atlas cells do not merge into one apparent object.

The Generation Layout is **not** a runtime asset.

The Transfer Hall Walls v3 experiment used:

```text
runtime tile:       64×64
edit cell:         256×256
visible fascia:     24 px runtime / 96 px edit
transparent gutter: 64 px
```

## What the gutters solve

They make each generated piece visually separable. This prevents a compact atlas from looking like one giant connected gray mass to the model.

## What the gutters do NOT solve

A separated tile still does not contain information about its runtime neighbor.

The model sees the silhouette of an isolated tile. It cannot reliably know that:

- a left/right cell-boundary edge is actually a connector and must not receive an end-cap or outline;
- the same material continues into another tile;
- a cap edge is a genuine termination while a connector edge is not;
- a modular T/corner belongs to a larger continuous structure.

This is the central limit discovered in Walls v3.

> M2 can preserve geometry after generation, but mask restore cannot undo incorrect **material placement and edge semantics** painted inside the valid mask.

If the model paints a bright metallic frame around every isolated tile, later alpha restoration does not turn that framing into a continuous wall.

## Good fits

- exact shapes whose complete silhouette is genuinely exposed;
- props with deterministic footprint but visually free internal material;
- hero elements where a final retouch step is available;
- material enrichment where outline/topology is simple;
- experiments in Invoke/ControlNet-style “more realism” passes when structural locking is demonstrably respected.

## Poor fits

Use M4 instead when:

- the same material must be homogeneous across many modular pieces;
- exposed-edge treatment depends on neighboring tile topology;
- connectors must have no outline/bevel/cap;
- the generated object keeps turning each tile into an individually framed prop.

## Local-tool subvariant: external realism pass

A possible M2 implementation is:

```text
SVG generation layout
→ raster layer
→ Invoke / ControlNet / img2img realism pass
→ deterministic extraction and restore
```

This is worth revisiting only when the chosen model/control stack demonstrably respects structure. The current method catalog does not assume that any particular checkpoint/tool does so.

## Recorded negative experiments

See `docs/ART_PIPELINE_LOCAL_EXPERIMENTS_2026-08-14.md`.

Known failures included:

- IP-Adapter style transfer moved layout together with material;
- the tested Qwen-Image-Edit checkpoint ignored the edit target;
- using a flat geometry guide as both structural control and img2img visual source produced flat, under-materialized output.

These are implementation-specific findings, but they are important regression warnings.

## Scripts and mechanics

Reusable seam canonicalization already exists in:

- `scripts/validate-wall-seams.mjs`
- `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`

M2 remains valuable. The lesson is not “image editing failed”; the lesson is to stop asking it to infer information that exists only in runtime topology.