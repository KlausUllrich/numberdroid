# Asset Recipe — TS-01 Transfer Apparatus / Cradle

Status: `PLANNED` — hero asset, complete before generation.

## Visual purpose

The Transfer apparatus is the primary environmental hero object in TS-01. It must make the first Transfer feel desirable, precise and empowering before the story reversal.

## Binding constraints

- strict orthographic top-down gameplay geometry;
- coherent multi-tile hero composition, not a generic single-tile icon;
- visible CORE/SLOT grammar;
- warm amber CORE/emissive source;
- maintained civilian machinery, elegant rather than threatening;
- local emissive pixels allowed, but illumination of floor/PICO remains in `LightOverlay`;
- visual footprint and collision footprint remain separate;
- source geometry must preserve the existing solid transfer-cradle core unless deliberately re-approved.

## To author before generation

- exact multi-tile `geometry.svg` including open transparent regions;
- optional `collision-core.svg` matching the existing collision footprint;
- material reference combining Transfer Ship ceramic/graphite with warm CORE machinery;
- dedicated image-edit prompt;
- effect-envelope definition for local AO/contact shadow/emissive edge only;
- slicing map to exact 64 px runtime cells;
- live lighting QA.

Do not begin image generation from the current placeholder cradle as if it were final geometry.
