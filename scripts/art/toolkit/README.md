# Numberdroid Art Production Toolkit — code

Reusable deterministic image-processing primitives live here. They are deliberately independent from a specific art-production method or asset recipe.

Public entry point: `index.mjs`.

Current modules:

- `masks.mjs` — exact binary masks, exposed-edge classification, distance fields;
- `compositor.mjs` — map an approved/material sampler through exact masks and topology-aware edges;
- `connectors.mjs` — semantic connector canonicalization and boundary-difference measurement;
- `raster.mjs` — minimal RGBA pixel helpers and dependency-free PNG encoding;
- `selftest.mjs` — deterministic synthetic regression test.

Run:

```text
npm run art:toolkit-test
```

Do not place model calls, prompts or asset-specific topology in this folder. Model/tool orchestration belongs to a method/skill; asset-specific data belongs in `art-source/recipes/`.

Documentation and capability status: `docs/art-production-toolkit/README.md`.
