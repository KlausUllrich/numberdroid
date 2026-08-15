# M3 — Layered Raster Editor / MCP

Status: **planned / research required**

## Purpose

Use a Photoshop-class layered raster editor through a reliable agent interface (for example MCP or another automation API) when production needs controlled local editing rather than one-shot image transformation.

This method is attractive because it exposes the concepts our hybrid pipeline already reasons about:

- layers;
- masks;
- selections;
- blend modes;
- adjustment layers;
- local paint/clone/heal operations;
- non-destructive effects;
- exact export regions.

## Why this differs from M2

M2 gives an image model a raster target and asks it for a transformed image. M3 keeps **explicit editable structure** throughout the process.

An Artist agent could, in principle:

1. load `geometry.svg` as a mask/selection;
2. place an approved material texture on its own layer;
3. create exposed-edge masks separately from connector masks;
4. apply AO/highlights only where intended;
5. paint over a local defect without regenerating the whole atlas;
6. keep labels/reference overlays non-exporting;
7. export exact runtime cells.

This makes M3 a strong candidate for complex finishing work.

## Good fits

- unique hero machines needing controlled paint-over;
- props requiring local repairs;
- doors with multiple authored states;
- hand-tuned material masks;
- effect envelopes/contact shadows;
- final polish after M4;
- cases where an agent must make a small local change without re-generating unrelated pixels.

## Potential use for modular architecture

M3 can solve modular edge semantics if the tool interface allows deterministic masks and layer operations. The critical requirement is that topology remains explicit; do not rely on a generative fill to infer neighbor relationships.

## Required automation capabilities

Before adopting an editor integration as production infrastructure, verify that the interface can reliably:

- open/save a document without flattening unexpectedly;
- create, name, reorder, hide and delete layers;
- import SVG/raster assets at exact pixel coordinates;
- create and modify alpha/layer masks;
- create selections from masks/paths;
- fill a selection from a texture/pattern;
- transform a texture independently of the geometry mask;
- apply deterministic blur/levels/curves or equivalent adjustments;
- perform local raster edits;
- export a defined region with exact dimensions and alpha;
- expose enough document state for the agent to verify what actually happened.

If any of these operations are opaque or unreliable, the editor should be treated as an optional finishing tool rather than a production authority.

## Photoshop / comparable tools

No specific editor/MCP integration is currently declared authoritative in the repository. Candidate tools must be researched and tested against the capability list above rather than selected by brand familiarity.

## Research plan

The first editor experiment should be deliberately small:

```text
input:
  64×64 or 256×256 H_TOP geometry mask
  graphite material swatch
  exposed-edge mask
  connector mask

operations:
  material fill
  AO/edge treatment
  connector exclusion
  export

acceptance:
  exact pixels/dimensions
  reproducible re-run
  no hidden manual step
```

Only after that should a full atlas or hero asset be attempted.

## Relationship to M4

M4 should remain the default for operations that can be expressed deterministically in code. M3 becomes valuable where artistic local editing exceeds what a small compositor should encode.

A likely mature pipeline is:

```text
M4 deterministic base render
→ M3 controlled paint-over / polish
→ deterministic export QA
```

## Research storage

Tool evaluations, MCP schemas, screenshots, limitations and reproducible test instructions belong under this method folder rather than being mixed into asset recipes.