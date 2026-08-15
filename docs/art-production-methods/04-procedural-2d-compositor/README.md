# M4 — Procedural 2D Compositor

Status: **PROVEN / LIVE_ACCEPTED for TS-01 modular walls**

## Purpose

Build final geometry-critical 2D assets deterministically from exact geometry, explicit topology/edge semantics, authored/generated material sources and deterministic shading rules.

Core insight:

> The material source does not need to know where the wall ends. The compositor knows.

## Authority model

- geometry owns shape;
- topology owns continuation/exposed/cap meaning;
- material texture owns surface appearance only;
- compositor rules own outline/AO/highlight/shadow treatment;
- runtime packing and QA remain deterministic.

## Proven TS-01 wall pipeline

```text
semantic geometry/topology
→ independent material field
→ toolkit masks + exposed-edge classification
→ deterministic material mapping / shading
→ no endpoint treatment at connectors
→ toolkit semantic connector canonicalization
→ exact seam QA
→ runtime atlas
→ live gameplay QA
```

The complete TS-01 wall kit was live accepted on 2026-08-15: 30 px wall mass fits the target, architecture reads homogeneous/quiet, and no visual wall errors were observed.

Acceptance record: `../../art/transfer-hall/TRANSFER_HALL_WALL_COMPOSITOR_ACCEPTANCE_2026-08-15.md`.

## Reusable tools

M4 should use the method-agnostic Art Production Toolkit rather than reimplementing generic mechanics per asset:

- `../../art-production-toolkit/tools/compositor2d.md`
- `../../../scripts/art/toolkit/`

The current accepted wall renderer predates this extracted library and remains frozen. Doors are the preferred first new production consumer; do not refactor accepted Walls merely for code neatness unless output equivalence is proven.

## Inputs

A mature recipe can use:

```text
geometry.svg
collision-core.svg       # optional
render-recipe.json
topology.json            # optional when not embedded in recipe
material-base.png        # optional authored/generated material
material-reference.md
```

Asset-specific semantic data belongs in the recipe. Toolkit code must not infer production connector classes from occupancy alone.

## Material mapping modes

Potential mapping modes include world-continuous, tile-local, periodic/seamless and deterministic seeded variation. Periodic/seamless mechanics are not yet a proven toolkit capability; see `../../art-production-toolkit/tools/seamless-tiles.md`.

## Good fits

- modular walls;
- doors and door pockets;
- architectural frames;
- sockets/floor interfaces;
- repeated consoles/panels with fixed geometry;
- other assets where shared material and exact topology can be separated.

## Poor fits

- expressive characters;
- unique organic forms;
- free-form hero objects whose appeal depends primarily on shape invention or painterly judgment.

## Adaptation sequence

When applying M4 to a new category, prove one simple element and one small assembly before building the full kit. For TS-01 the sequence H_TOP → repeated run → corner → T → full kit → live room succeeded.

**Doors / door pockets / thresholds** are the next useful M4 validation target while moving door leaves/runtime behavior remain separate systems.
