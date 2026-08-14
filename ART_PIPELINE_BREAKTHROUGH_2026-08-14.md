# Numberdroid — Controlled Art Pass Breakthrough — 2026-08-14

Status: **validated production-method milestone**

## Result

A deterministic geometry guide can be transformed by image generation into materially convincing gameplay art while keeping exact production geometry as a separate deterministic authority.

The successful proof used the Transfer Hall `H_TOP` wall:

1. exact wall geometry defined as SVG;
2. SVG rasterized and visibly QA-approved;
3. flat gray guide presented as the concrete image-edit target;
4. image generation produced materially convincing dark graphite/metal construction;
5. generated output changed exact canvas/thickness/alpha, proving that generated pixels cannot be the geometry authority;
6. therefore the production method is hybrid: generated material + deterministic mask restoration.

## Binding conclusion

> **Generative art owns visual richness. Deterministic source data owns geometry.**

This is the preferred method for Numberdroid assets where exact tile boundaries, connectors, repeatability, collision correspondence or stable atlas geometry matter.

## Next implementation proof

Repeat the H_TOP material pass with a raster guide already rendered at the requested generation canvas size, then:

1. restore SVG structural mask;
2. restore connector guard zones;
3. downscale to exact 64×64 runtime tile;
4. inspect repetition and seam behavior;
5. only then propagate the material treatment to the remaining 12 wall pieces.

## Future extension

A second non-structural `Effect Envelope` mask may later permit a controlled contact/AO shadow outside the exact structural mask. This is intentionally deferred until the structural pipeline is stable.

## Detailed instructions

See:

- `ARTIST_AGENT_WORKFLOW.md`
- `ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- `skills/numberdroid-artist/SKILL.md`
- `TRANSFER_HALL_WALL_KIT.md`
- `art-source/flow-vorlagen/README.md`
