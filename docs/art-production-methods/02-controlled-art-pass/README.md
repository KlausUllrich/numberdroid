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

## What gutters solve — and what they do not

Gutters make each generated piece visually separable. They prevent a compact atlas from looking like one giant connected shape to the model.

A separated tile still does not contain information about its runtime neighbor. The model cannot reliably know that a cell-boundary edge may be a connector rather than a true exposed edge.

> M2 can preserve geometry after generation, but mask restore cannot undo incorrect **material placement and edge semantics** painted inside the valid mask.

If the model paints a bright frame around every isolated tile, restoring alpha does not turn those frames into one continuous wall.

## Good fits

- exact shapes whose complete silhouette is genuinely exposed;
- props with deterministic footprint but visually free internal material;
- hero elements where a final retouch step is available;
- material enrichment where outline/topology is simple;
- controlled Invoke/ControlNet/img2img realism passes when structural locking is demonstrably respected.

## Poor fits

Prefer M4 when:

- one material must remain homogeneous across many modular pieces;
- exposed-edge treatment depends on neighboring topology;
- connectors must have no outline/bevel/cap;
- the generated result keeps turning each tile into an individually framed prop.

## Method-specific skill

The original Numberdroid Artist skill belongs to this method and is stored at:

`skill/numberdroid-artist/SKILL.md`

It should be used for M2-style controlled art passes, not treated as a universal art-production skill. Future methods may receive their own skills under their own `skill/` folders.

## Recorded negative experiments

See:

`../../history/experiments/ART_PIPELINE_LOCAL_EXPERIMENTS_2026-08-14.md`

Recorded failures include:

- IP-Adapter style transfer moved layout together with material;
- the tested Qwen-Image-Edit checkpoint ignored the edit target;
- using a flat geometry guide as both structural control and img2img visual source produced flat, under-materialized output.

These are implementation-specific findings, but useful regression warnings.

## Scripts and mechanics

Reusable seam canonicalization is documented in:

- `../../art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md`
- `../../../scripts/validate-wall-seams.mjs`

M2 remains valuable. The lesson is not “image editing failed”; the lesson is to stop asking it to infer information that exists only in runtime topology.
