# Tool: Procedural 2D Compositor primitives

Status: **PROVEN mechanics**

Code: `scripts/art/toolkit/`

## Purpose

Provide reusable deterministic primitives for geometry-critical 2D art where material appearance and topology-dependent edge treatment must be separate responsibilities.

The toolkit extracts the generic mechanics originally explored in PR #29 and later proven by the live-accepted TS-01 M4 wall pipeline.

## Inputs

- raster width/height;
- exact binary geometry mask;
- explicit connector segments (`side`, `start`, `end`);
- material sampler `(worldX, worldY) -> [r,g,b]`;
- optional world offsets;
- deterministic shading parameters.

## Outputs

- RGBA materialized asset;
- exposed-boundary mask;
- distance field;
- optional canonical connector strips;
- numeric connector-difference metric;
- exact RGBA PNG bytes when requested.

## Authority

The tool may own:

- mask rasterization from an already-defined shape;
- exposed-edge versus connector-edge mechanics;
- deterministic edge darkening/highlight placement;
- connector strip canonicalization;
- pixel-level seam measurement;
- PNG serialization.

It does **not** own:

- semantic geometry design;
- connector class meaning;
- material generation;
- art direction;
- asset-specific atlas IDs;
- visual acceptance.

## Usage

Import from the public entry point:

```js
import {
  createMask,
  renderMaskedMaterial,
  canonicalizeConnectorGroup,
  meanConnectorDifference,
  encodeRgbaPng,
} from "./scripts/art/toolkit/index.mjs";
```

Run the deterministic synthetic regression test:

```text
npm run art:toolkit-test
```

## Production relation

M4 is live-proven on TS-01 Walls, but the accepted wall renderer remains frozen and is not silently refactored to use this library. Doors are the preferred first new production consumer.

## Known limitation

A connector list must be supplied semantically. Pixel occupancy/orientation alone is not sufficient production identity for modular connectors.
