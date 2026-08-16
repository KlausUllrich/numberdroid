# Tool — Prop Source Preparation

Status: **PROVEN for alpha-bearing isolated Prop PNG sources**

Implementation:

- `scripts/art/toolkit/prop-source.mjs`
- `scripts/art/prepare-prop-asset.mjs`
- covered by `scripts/art/toolkit/selftest.mjs`

## Purpose

Normalize an already approved, already transparent Prop source into an exact runtime PNG without making generated pixels authoritative for collision or editor semantics.

Pipeline:

```text
8-bit PNG source with alpha
→ PNG validation/decode
→ configured low-alpha cleanup
→ crop to surviving alpha bounds
→ premultiplied-alpha Lanczos resize
→ centered exact transparent runtime canvas
→ deterministic RGBA PNG encoding
```

The premultiplied-alpha resize is important: RGB is filtered together with coverage so transparent-edge colors do not create the dark/light matte halos common to naive straight-alpha resizing.

## CLI

```bash
node scripts/art/prepare-prop-asset.mjs \
  --input tmp/approved-source.png \
  --output public/assets/deck/example-prop.png \
  --width 192 \
  --height 128 \
  --margin 3 \
  --alpha-cutoff 4
```

Required:

- `--input`
- `--output`
- `--width`
- `--height`

Optional:

- `--margin` — symmetric transparent runtime breathing room; default `3` px;
- `--alpha-cutoff` — alpha values at or below this threshold are cleared before the crop; default `4`.

The command prints source dimensions, alpha crop bounds, final content bounds and target canvas dimensions. Record accepted production values in the asset recipe.

## Input contract

Current deterministic decoder accepts:

- PNG signature;
- 8-bit channels;
- non-interlaced PNG;
- RGBA or RGB color type.

Production Prop use normally requires RGBA with actual transparency. The CLI intentionally rejects a fully opaque source.

Why: a fully opaque source needs actual background removal, not a pretend crop of the full image.

## What this tool proves

It provides a reusable equivalent of the recurring technical part of the accepted Family Table workflow:

- low-alpha normalization;
- tight content crop;
- high-quality fit/downscale;
- exact transparent target canvas.

It is suitable for ordinary Props and Hero assets whose approved source already has usable alpha.

## What this tool does NOT do

It does not:

- identify foreground objects in an opaque image;
- remove white/colored/painted backgrounds;
- decide whether an image passed Art QA;
- infer `footprintTiles`;
- infer visual or collision bounds;
- infer approach/use-space;
- create collision from alpha;
- create the grounding shadow;
- pack the Prop into a global atlas;
- choose runtime placement.

Generic Freistellen remains `PLANNED` and separate.

## QA

After the command runs, inspect the resulting runtime PNG visually.

Verify:

- silhouette complete;
- exact canvas size;
- transparent edges clean;
- no broad matte halo;
- expected transparent margin;
- correct apparent runtime scale;
- no tiny details collapsed into noise.

The tool passing does not make the asset `LIVE_ACCEPTED`.

## Relationship to atlas packing

This tool outputs one normalized Prop PNG.

For generated TS-01 that is currently the preferred runtime form because `propArtRegistry.ts` can register individual Prop and shadow assets directly.

Generic atlas packing remains a separate future capability and should be introduced only when asset-management/performance requirements justify it.
