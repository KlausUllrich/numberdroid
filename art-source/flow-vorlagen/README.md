# Flow Vorlagen

Deterministic geometry templates used as stable inputs to the Numberdroid controlled art-pass pipeline.

These files define **geometry, grid, connectors and masks**, not final visual style.

Current Transfer Hall wall templates:

- `transfer-hall-wall-blueprint.svg` — authoritative 256×256 geometry master for the 4×4 wall atlas.
- `transfer-hall-wall-blueprint-4x.png` — exact 1024×1024 raster guide derived from the SVG for inspection / image-edit input.

Rules:

1. SVG/vector/mask master is authoritative.
2. Raster guides are derived artifacts; regenerate them deterministically after changing the master.
3. Image generation may improve material appearance but must not become the geometry source of truth.
4. After any generative material pass, restore the master structural mask and connector guard zones before runtime downscale.
5. Do not add labels, legends or presentation furniture to production raster guides.
