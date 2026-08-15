# TS-01 Transfer Hall — Procedural Wall Compositor Acceptance

Date: **2026-08-15**

Status: **LIVE_ACCEPTED**

Public preview: `https://klausullrich.github.io/numberdroid/?floor=transfer-hall`

## Accepted baseline

The complete Transfer Hall modular wall kit is produced through **M4 — Procedural 2D Compositor**.

```text
64×64 runtime tile
30 px visible fascia
10 px collision core
13 active semantic wall cells + 3 reserved
shared calm graphite material family
explicit EXPOSED / CONNECTOR / TRUE_CAP semantics
semantic connector canonicalization
automated seam QA with negative control
```

## Live visual acceptance

After viewing the public build at PC gameplay scale, Klaus confirmed:

1. **Wall mass fits.**
2. Walls appear **homogeneous and less visually important**, matching the intended hierarchy.
3. **No visual wall errors were visible.**

This closes the active Wall iteration loop for the Gold Slice.

## Production learning

Earlier approaches asked image generation to solve material appearance, exact geometry and hidden runtime topology at once. An isolated generated wall piece cannot know whether a visible silhouette edge is a true architectural boundary, a runtime connector, or a doorway-facing termination.

The accepted authority split is:

```text
material source          -> surface appearance only
semantic geometry        -> exact visible shape
semantic topology        -> connector / exposed / cap meaning
procedural compositor    -> outline / AO / shading placement
connector canonicalizer  -> exact interchangeable seam strips
```

This is the key M4 production breakthrough for Numberdroid modular architecture.

## Freeze rule

The accepted 30 px wall compositor output is now the Gold-Slice baseline.

Do **not** continue Wall iteration by default. Reopen Walls only when:

- live QA reveals a concrete visual defect;
- Door integration exposes a real cap/pocket incompatibility;
- Klaus explicitly approves a bounded material-quality experiment;
- TS-01 is deliberately promoted into a broader Transfer Ship architecture kit.

A future material upgrade may replace the current procedural graphite swatch with a better borderless generated/painted texture without changing geometry or topology logic.

## Technical checks retained

Continue to run:

```text
npm run validate-art-seams
npm test
npm run build
```

Seam QA must report SAME-TYPE error together with the DIFF-TYPE negative control.

## Next production implication

The next architectural category is **Doors / door pockets / thresholds**, while moving door leaves and runtime behavior remain separate systems. After Doors, continue the Gold Slice with props, hero assets and remaining robots.
