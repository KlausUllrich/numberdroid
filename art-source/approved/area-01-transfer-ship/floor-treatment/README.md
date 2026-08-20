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

### Main Hall floor 6×6 atlas

- file: `source/main-hall-floor-atlas-6x6__source-approved__2026-08-20.png`
- status: **SOURCE_APPROVED / RUNTIME QA ACTIVE** by explicit user push/request on 2026-08-20
- dimensions: **1254 × 1254 px**
- bytes: **2,847,955**
- SHA-256: `bdf1fc2c4b6512b37c2bbd0702aa668a3bfb6e427212a8546953749f334d1914`
- logical source grid: **6 × 6 / 36 source cells**
- runtime tile size: **64 × 64 px**
- deterministic materializer: `scripts/materialize-main-hall-floor.mjs`
- runtime presentation: `src/levelgen/mainHallFloorPresentation.ts`
- semantic tile catalog: `src/levelgen/mainHallFloorTileMetadata.ts`

The Main Hall source follows the strict equal-cell atlas rule. Generated gutter pitch still drifts slightly by row/column, so the materializer uses measured immutable panel-face bounds and normalizes each cell independently to 64×64.

First live QA exposed two further source-vs-runtime problems that are now part of the production contract:

1. generated atlas cells were presented as rounded standalone samples with a light board background, so their corner wedges became visible at gameplay scale;
2. the same presentation frame put a line around every technical tile, producing broken/partially wall-occluded linework and making adjacent route graphics look random when line-bearing variants were selected by hash alone.

Runtime materialization therefore removes the outer presentation frame uniformly before normalization. Floor tiles are **full-bleed runtime surfaces**, not rounded UI/sample cards.

In addition, every Main Hall source cell now carries explicit metadata: role, connector directions, continuity profile, automatic-placement eligibility, wall suitability, selection priority and directional meaning where relevant. Generated alternates with uncalibrated connector geometry remain archived but are quarantined from automatic placement. A canonical T-junction and corner are rotated deterministically to provide all required orientations, while one calibrated straight pair owns the live circulation line. This prevents random line jumps while preserving the whole approved source atlas for future calibration.

Main Hall arrows are materialized from the source but remain unused until explicit route/signage semantics request them. They must not be scattered as decorative navigation UI.

## Binding generated-atlas rule

For future generated floor/tile atlases that are intended for deterministic extraction:

1. define the tile inventory **before** generation;
2. generate one strict rectangular grid;
3. every cell must represent exactly one equal-size square source tile unless a multipart contract explicitly reserves exact integer grid spans;
4. use uniform flat orthographic presentation and lighting;
5. use narrow separators only; no labels, headings, legends or presentation furniture inside the source;
6. never span one motif across multiple cells unless the production contract explicitly defines an exact integer multipart tile set;
7. preserve the approved original unchanged;
8. validate dimensions/hash/grid and crop actual panel faces, not naive `imageWidth / columns` divisions when gutters exist;
9. strip presentation-only rounded frames/background from runtime floor faces; floor tiles must be full-bleed unless transparency has an explicit gameplay purpose;
10. normalize the extracted cells deterministically to runtime size;
11. store semantic metadata for every atlas cell before automatic placement: role, connectors/ports, continuity family, rotation policy, wall eligibility, runtime eligibility and any direction/signage meaning;
12. never pseudo-randomly alternate line-bearing tiles unless their metadata guarantees compatible connector positions and continuity family;
13. validate directional inventory semantically: rotations may canonicalize T/corner/arrow orientations, but all required runtime directions must be regression-tested;
14. perform gameplay-scale QA after integration before promoting the room treatment to `LIVE_ACCEPTED`.

This rule exists because Family, Transfer and Main Hall sources all demonstrated that generated presentation gutters cannot be assumed to fall on mathematically exact divisions, and Main Hall additionally demonstrated that visual similarity is not enough to infer semantic tile compatibility.
