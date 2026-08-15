# Family Memory Console — Live Candidate

Status: `LIVE_CANDIDATE` pending deployed Art-Director QA.

This candidate replaces the rejected frontal Family Wall Display at the existing Family wall-prop placement with a wall-adjacent console whose interesting information is carried by horizontal top surfaces.

## Runtime contract

- target layer: `WallProps`
- candidate GIDs: `173–174`
- map placement: col 3,row 1, 2×1 block
- runtime asset: `/assets/deck/family-memory-console.png`
- runtime/source size: 128×64 px
- exact source: `source/family-memory-console-runtime.png`
- bytes: 12371
- SHA-256: `b948e7ecb66befafc92eddb2fbfc9fb82adde2a317c834b3ddd185d73a09dd54`
- existing collision: `family-display-protrusion`, unchanged at x 3.25, y 1.08, w 1.50, h 0.56 tiles
- legacy prop atlas/GIDs 129–160 remain intact
- accepted Family Table and its FloorFX shadow remain unchanged

## Visual decision

Use only the isolated upper-left console direction from the approved concept sheet. The generated room preview is explicitly **not** authoritative because it incorrectly shows a vertical wall side plane.

Binding camera/read rules for this candidate:

- `ND Shallow Top-Down`, near-nadir and orthographic;
- the game does not expose a frontal/side wall plane;
- the prop sits against/over the top-down wall band;
- top surfaces carry the visual interest;
- vertical faces are only narrow depth cues;
- no readable frontal screen or wall-facing picture surface;
- no additional FloorFX shadow in this first live test.

Visible content is generic and non-canonical: small planter, notebook/personal item, small container/cup and central recessed tray/panel. The accepted family palette remains off-white / graphite / slate-blue with restrained mustard-amber accents.

## Extraction

1. crop only the isolated upper-left console from the generated concept sheet;
2. remove the neutral concept-sheet background with a foreground segmentation mask;
3. crop to non-zero alpha bounds;
4. downscale with Lanczos into a 128×64 2×1 runtime envelope;
5. final visible object size: approximately 124×40 px at offset (2,9);
6. apply a light runtime-scale unsharp pass;
7. preserve true alpha; no floor/background plate is baked into the asset.

## Live QA gate

Before acceptance, inspect the deployed Transfer Hall on PC and mobile and answer only:

- does the console read as wall-adjacent rather than as another table?
- does the top-surface detail survive runtime scale?
- does its depth remain compatible with the top-down wall band?
- does it remain visually subordinate to the accepted Family Table?
- is an additional contact/ambient shadow actually necessary?

Do not mark this candidate `LIVE_ACCEPTED` until that deployed QA is complete.
