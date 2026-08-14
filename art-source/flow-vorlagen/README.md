# Flow Vorlagen

Deterministic geometry templates used as stable inputs to the Numberdroid controlled art-pass pipeline.

These files define **geometry, grid, connectors and masks**, not final visual style.

## Current organization

New/revised production assets should be organized under `art-source/recipes/`, where geometry is stored together with material references, the approved image-generation/edit prompt, runtime/extraction rules and QA.

This directory remains valid for existing shared/legacy flow templates. Do not duplicate an accepted template merely to move it; a recipe may reference it. When a category is substantially revised, prefer a clearly named recipe-local geometry master.

Current Transfer Hall wall templates:

- `transfer-hall-wall-blueprint.svg` — historical authoritative 256×256 geometry master for the original 10 px 4×4 wall atlas proof.
- `transfer-hall-wall-blueprint-4x.png` — exact 1024×1024 raster guide derived from that SVG for inspection / image-edit input.

The current separated visible/collision wall contract is documented in:

```text
art-source/recipes/transfer-hall/walls/geometry.svg
art-source/recipes/transfer-hall/walls/collision-core.svg
art-source/recipes/transfer-hall/walls/recipe.md
```

Rules:

1. SVG/vector/mask master is authoritative for geometry.
2. Raster guides are derived artifacts; regenerate them deterministically after changing the master.
3. Image generation may improve material appearance but must not become the geometry source of truth.
4. After any generative material pass, restore the master structural mask and connector guard zones before runtime downscale.
5. Do not add labels, legends or presentation furniture to production raster guides.
6. Preserve the material reference and accepted production prompt in the corresponding asset recipe so a later Agent can reproduce the pass without relying on chat history.
