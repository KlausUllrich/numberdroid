# Family Memory Console — LIVE_ACCEPTED

Status: **`LIVE_ACCEPTED` — 2026-08-15** after deployed gameplay-scale QA.

The Family Memory Console is the accepted wall-adjacent family prop for the Transfer Hall. Its visual form, final wall-adjacent placement and dedicated grounding shadow were approved in the deployed game on PC/mobile.

## Runtime contract

- target prop layer: `WallProps`
- prop GIDs: `173–174`
- map placement: col 3,row 1, 2×1 block
- runtime prop asset: `/assets/deck/family-memory-console.png`
- runtime/source size: 128×64 px
- exact reproducible prop source: `source/family-memory-console-runtime.b64.00`
- prop bytes: 3892
- prop SHA-256: `7b3546264f6007884f395383b6db4cd25cdf1c67db45c325cf9026d298eefd5c`
- runtime placement offset: `+21 px Y`
- placement rule: first visible console pixels begin at the inner edge of the accepted 30 px top-wall fascia; the prop is adjacent to the wall and does not overlap it
- collision: `family-display-protrusion`, aligned with the final visual placement at x 3.25, y 1.408125, w 1.50, h 0.56 tiles

## Grounding shadow — LIVE_ACCEPTED

- target layer: `FloorFX`
- shadow GIDs: `175–176`
- map placement: col 3,row 1, 2×1 block
- runtime shadow asset: `/assets/deck/family-memory-console-shadow.png`
- runtime/source size: 128×64 px
- exact reproducible source: `source/family-memory-console-shadow-runtime.b64.00`
- bytes: 915
- SHA-256: `78c73c3e5e582a190aaa048a812c620963102a676d926e44ed864da757c86a06`
- runtime placement offset: same `+21 px Y` as the console
- visual intent: compact neutral-charcoal contact/ambient footprint only; no glow or baked room lighting
- Architecture remains above FloorFX, so wall fascia occludes shadow where appropriate

## Accepted visual contract

- `ND Shallow Top-Down`, near-nadir and orthographic;
- no frontal/side wall plane is exposed by the game camera;
- interesting information lives on horizontal top surfaces;
- vertical faces are narrow depth cues only;
- no readable frontal screen or wall-facing picture surface;
- off-white / graphite / slate-blue palette with restrained mustard-amber accents;
- generic personal traces only: small planter, notebook/personal item, small container/cup and central recessed tray/panel;
- remains visually subordinate to the accepted Family Table.

The earlier frontal Family Wall Display concepts remain rejected. The first PR #45 deployment is also rejected technically because its directly tracked PNG contained a damaged data stream. The text-safe materialization path is authoritative.

`npm run materialize-art` validates PNG signature, exact byte count, SHA-256 and dimensions before writing both runtime assets.

No further tuning is required unless a concrete live defect appears.