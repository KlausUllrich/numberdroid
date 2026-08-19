# Area 01 Transfer Ship — Floor Treatment Approved Sources

Status: **ACTIVE approved-source family**

This family stores immutable approved high-resolution floor-treatment source images. Runtime tiles are deterministic derivatives and do not replace source authority.

## Approved sources

### Family floor 3×3

- file: `source/family-floor-3x3__source-approved__2026-08-18.png`
- role: accepted Family floor source board
- deterministic runtime materializer: `scripts/materialize-family-floor.mjs`

### Transfer floor 6×6 atlas

- file: `source/transfer-floor-atlas-6x6__source-approved__2026-08-19.png`
- status: **SOURCE_APPROVED** by explicit live/user QA on 2026-08-19
- dimensions: **1254 × 1254 px**
- bytes: **2,293,490**
- SHA-256: `88a0cb598d4938ca767b1bde144e9737dfd520584eee61b02769a6d1845203bc`
- logical source grid: **6 × 6 / 36 equal tile cells**
- runtime tile size: **64 × 64 px**
- deterministic materializer: `scripts/materialize-transfer-floor.mjs`

The source is intentionally a cuttable tile atlas rather than a presentation board. The image model introduced minor 1–2 px gutter drift despite the strict grid request; the materializer therefore uses the approved panel-face coordinates and normalizes every cell to an exact 64×64 runtime tile while excluding dark gutters.

## Binding generated-atlas rule

For future generated floor/tile atlases that are intended for deterministic extraction:

1. define the tile inventory **before** generation;
2. generate one strict rectangular grid;
3. every cell must represent exactly one equal-size square source tile;
4. use uniform flat orthographic presentation and lighting;
5. use narrow separators only; no labels, headings, legends or presentation furniture inside the source;
6. never span one motif across multiple cells unless the production contract explicitly defines a multipart tile set;
7. preserve the approved original unchanged;
8. validate dimensions/hash/grid and crop actual panel faces, not naive `imageWidth / columns` divisions when gutters exist;
9. normalize the extracted cells deterministically to runtime size;
10. perform gameplay-scale QA after integration before promoting the room treatment to `LIVE_ACCEPTED`.

This rule exists because both the Family 3×3 source and Transfer 6×6 source demonstrated that generated presentation gutters cannot be assumed to fall on mathematically exact divisions.
