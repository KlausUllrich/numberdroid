# TS-01 Transfer Hall — Procedural Wall Compositor Acceptance

Date: **2026-08-15**

Status: **LIVE_ACCEPTED**

Canonical branch: `main`

Public preview:

`https://klausullrich.github.io/numberdroid/?floor=transfer-hall`

## What was accepted

The complete Transfer Hall modular wall kit is now produced through the **M4 Procedural 2D Compositor** rather than by asking image generation to paint complete wall pieces.

Current accepted architecture:

```text
64×64 runtime tile
30 px visible fascia
10 px collision core
13 active semantic wall cells + 3 reserved cells
shared calm graphite material family
explicit EXPOSED / CONNECTOR / TRUE_CAP edge semantics
semantic connector canonicalization
automated seam QA with negative control
```

## Live visual acceptance

After viewing the public build at PC gameplay scale, Klaus confirmed:

1. **Wall mass fits.**
2. Walls appear **homogeneous and less visually important**, which is the intended hierarchy against PICO, props and hero objects.
3. **No visual wall errors were visible.**

This closes the active Wall iteration loop for the Gold Slice.

## Why this is a production breakthrough

Earlier methods over-assigned responsibility to image generation. A generated isolated wall piece can see its own silhouette, but it cannot know whether a particular silhouette edge is:

- a real architectural boundary,
- a runtime connector into another tile,
- or a true doorway-facing termination.

That caused attractive but structurally wrong per-piece frames, caps and outlines.

The accepted method separates responsibilities:

```text
material source
  owns surface appearance only

semantic geometry
  owns exact visible shape

semantic topology
  owns connector versus exposed versus cap meaning

procedural compositor
  owns outline / AO / shading placement

connector canonicalization
  owns exact interchangeable seam strips
```

The result is both visually calmer and technically more reliable.

## Baseline freeze rule

The accepted 30 px wall compositor output is now the Gold-Slice baseline.

Do **not** continue Wall iteration by default.

Reopen Walls only when:

- live QA reveals a concrete visual defect;
- Door integration exposes a real cap/pocket incompatibility;
- Klaus explicitly approves a bounded material-quality experiment;
- the TS-01 kit is deliberately promoted/revised into a broader Transfer Ship architecture system.

A future material upgrade may replace the current procedural graphite swatch with a better borderless generated/painted texture without changing semantic geometry or edge logic.

## Technical checks retained

Continue to run:

```text
npm run validate-art-seams
npm test
npm run build
```

Seam QA must continue to report SAME-TYPE error together with the DIFF-TYPE negative control.

## Next production implication

The useful next step is **not another wall pass**.

The next architectural category should test whether the same authority model generalizes to **Doors / door pockets / thresholds**, while preserving moving door leaves and runtime behavior as a separate system.

After architectural framing is stable, continue the Gold Slice with props, hero assets and remaining robots.
