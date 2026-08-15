# Asset Recipe — PICO-3 Directional Character

Status: `LIVE_ACCEPTED`

## Identity

- Slice/world: TS-01 Transfer Hall / Transfer Ship
- Character: PICO-3
- Runtime output: `public/assets/robots/directional-pico.png`
- Runtime strip: **768 × 96 px**
- Frames: **8 × 96 × 96 px**
- Frame order: `N | NE | E | SE | S | SW | W | NW`
- Perspective rule: character turnaround is the deliberate perspective exception to strict top-down environment art

## Production authority

PICO is an accepted authored/generated character turnaround. It is not reconstructed from deterministic SVG geometry.

Current source authority is the accepted PNG payload preserved text-safely under:

`source/directional-pico-gold.b64.00` … `.03`

The source decodes to:

- exact bytes: **14,617**
- SHA-256: `cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9`
- dimensions: **768 × 96**

`scripts/materialize-art-assets.mjs` validates those invariants and writes the runtime PNG during `predev` / `prebuild`.

## Freeze rule

PICO is visually accepted. Do not regenerate, redraw, recolor or repack the strip merely to normalize the repository.

A future deliberate PICO revision must create a bounded character-art task and preserve/replace this recipe with the newly accepted source, prompt/process and QA.

## QA

- exact PNG signature;
- exact byte count and SHA-256 before materialization;
- exact 768 × 96 dimensions;
- eight stable directional frames in documented order;
- gameplay-scale live QA if the source is ever intentionally replaced.
