# Numberdroid Art Production Toolkit

Status: **binding catalog for reusable art-processing tools**

This toolkit is the reusable mechanism layer underneath the art-production methods.

The distinction is intentional:

```text
METHOD = when/why to use a production approach and which stage owns which property
TOOL   = a deterministic operation that can be reused by one or more methods
RECIPE = asset-specific source, topology, prompts, settings and QA
```

Examples:

- M4 Procedural 2D Compositor uses mask, edge, connector and raster tools;
- M2 Controlled Art Pass can reuse mask restore, alpha cleanup and QA tools;
- future M1/M3 workflows may use background-removal, normalization or seamless-tile validation tools.

Canonical runnable code lives under `scripts/art/toolkit/`. This documentation explains capabilities, limitations, status and usage.

## Status vocabulary

- **PROVEN** — exercised successfully in Numberdroid production or a deterministic regression test and considered reusable;
- **EXPERIMENTAL** — implemented/researched but not yet trusted as a production default;
- **PLANNED** — capability slot exists; do not claim the tool is implemented;
- **RETIRED** — retained only as evidence/history and should not be selected without materially different evidence.

## Current toolkit

See [`CAPABILITY_INDEX.md`](CAPABILITY_INDEX.md) for the authoritative matrix.

The first extracted reusable code comes from the successful M4 work and the earlier generic compositor proof:

```text
scripts/art/toolkit/
├─ masks.mjs
├─ compositor.mjs
├─ connectors.mjs
├─ raster.mjs
├─ index.mjs
└─ selftest.mjs
```

The accepted Transfer Hall wall renderer is intentionally **not refactored in this first toolkit PR**. Walls are a frozen live-accepted baseline. The toolkit is proven independently first; future categories such as Doors can consume it. A later wall refactor is allowed only if output equivalence is demonstrated.

## Tool documentation contract

Every reusable tool/capability document must state:

1. purpose;
2. implementation status;
3. exact inputs and outputs;
4. what it is authoritative for;
5. what it explicitly does **not** solve;
6. usage example / entry point;
7. QA or regression test;
8. methods/categories that use it;
9. known failure modes;
10. related research/history.

A tool is not considered production-ready merely because code exists.

## Extension rule

When a new recurring need appears — e.g. freistellen, seamless textures, atlas packing, downscale normalization, halo cleanup, repetition QA — first decide whether it is:

- a reusable **tool**;
- a new **method** with a different authority model;
- or an asset-specific **recipe step**.

Prefer a toolkit module when the operation is deterministic and broadly reusable.
