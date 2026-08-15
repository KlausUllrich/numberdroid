# Family Memory Console — Live Candidate

Status: `LIVE_CANDIDATE` pending final deployed Art-Director QA.

This candidate replaces the rejected frontal Family Wall Display with a wall-adjacent console whose interesting information is carried by horizontal top surfaces.

The first correctly visible deployment passed the **visual-form read** in live QA on 2026-08-15, but two integration defects remained: the console overlapped the top wall fascia and lacked grounding shadow. This revision addresses only those two points; the console art itself is unchanged.

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
- rationale: the accepted top-wall fascia occupies local y=0..29 and the first visible console pixel is local y=9; +21 px makes the first visible prop pixel land exactly at local y=30, adjacent to the inner wall edge instead of overlapping it
- collision: `family-display-protrusion`, shifted with the prop to x 3.25, y 1.408125, w 1.50, h 0.56 tiles

## Grounding shadow

- target layer: `FloorFX`
- shadow GIDs: `175–176`
- map placement: col 3,row 1, 2×1 block
- runtime shadow asset: `/assets/deck/family-memory-console-shadow.png`
- runtime/source size: 128×64 px
- exact reproducible source: `source/family-memory-console-shadow-runtime.b64.00`
- bytes: 915
- SHA-256: `78c73c3e5e582a190aaa048a812c620963102a676d926e44ed864da757c86a06`
- runtime placement offset: the same `+21 px Y` as the console
- visual intent: compact neutral-charcoal contact/ambient footprint only; no glow or baked room lighting
- Architecture renders above FloorFX, so the wall fascia naturally occludes any shadow energy that would otherwise extend into the wall band

Legacy prop atlas/GIDs 129–160 remain intact. The accepted Family Table and its FloorFX shadow remain unchanged.

`npm run materialize-art` validates PNG signature, exact byte count, SHA-256 and dimensions before writing both runtime files. The first PR #45 deployment used a directly tracked binary PNG which was found after live QA to contain a damaged PNG data stream; that deployment is rejected. The text-safe materialization path is authoritative.

## Visual decision

Use only the isolated upper-left console direction from the approved concept sheet. The generated room preview is explicitly **not** authoritative because it incorrectly shows a vertical wall side plane.

Binding camera/read rules for this candidate:

- `ND Shallow Top-Down`, near-nadir and orthographic;
- the game does not expose a frontal/side wall plane;
- the prop sits immediately adjacent to the inner edge of the top-down wall band, not on top of the wall;
- top surfaces carry the visual interest;
- vertical faces are only narrow depth cues;
- no readable frontal screen or wall-facing picture surface.

Visible content is generic and non-canonical: small planter, notebook/personal item, small container/cup and central recessed tray/panel. The accepted family palette remains off-white / graphite / slate-blue with restrained mustard-amber accents.

## Extraction

1. crop only the isolated upper-left console from the generated concept sheet;
2. remove the neutral concept-sheet background with a foreground segmentation mask;
3. crop to non-zero alpha bounds;
4. downscale with Lanczos into a 128×64 2×1 runtime envelope;
5. final visible object size: approximately 124×40 px at offset (2,9);
6. apply a light runtime-scale unsharp pass;
7. palette-optimize the validated runtime PNG without changing the gameplay-scale read;
8. preserve true alpha; no floor/background plate is baked into the asset.

The shadow is derived as a deliberately compact floor footprint from the console silhouette, vertically compressed and softened so it grounds the object without becoming a second graphic element.

## Final live QA gate

Before acceptance, inspect the deployed Transfer Hall on PC and mobile and answer only:

- is the console now directly adjacent to the wall without overlapping its 30 px fascia?
- does the new shadow ground the console without becoming too dark or broad?
- does the console still read as wall-adjacent rather than as another table?
- does the top-surface detail survive runtime scale?
- does it remain visually subordinate to the accepted Family Table?

Do not mark this candidate `LIVE_ACCEPTED` until that deployed QA is complete.
