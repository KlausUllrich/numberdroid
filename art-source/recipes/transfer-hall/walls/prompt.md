# TS-01 Walls — Current Material Source Prompt

Status: **prepared for M1 material-source generation feeding M4 Procedural 2D Compositor**

This prompt intentionally generates **material only**, not wall pieces, not an atlas and not architectural outlines.

## Material prompt

Create a square, edge-agnostic material swatch for Numberdroid Transfer Ship civilian architecture.

The image is only a reusable surface material source. It must not depict a wall object, panel frame, tile, corridor, door, room or atlas.

Visual target:

- calm dark neutral graphite / charcoal mineral-composite surface;
- maintained premium public-infrastructure quality;
- broad homogeneous low-frequency value variation;
- restrained believable material grain and subtle manufacturing variation;
- slight depth/roughness cues that survive downscaling without becoming noisy;
- civilian, clean and durable rather than military, industrial or villainous;
- sufficiently quiet that later deterministic edge shading can define architectural depth.

Avoid:

- borders, outlines, frames or bevels around the image;
- visible object edges or end caps;
- vents, pipes, bolts arranged as object features, labels, symbols or UI;
- cyan/teal light strips;
- orange hazard markings;
- perspective, wall faces or corridor composition;
- dramatic directional scene lighting;
- large scratches or unique focal features that would obviously repeat;
- high-frequency panelization.

The material should be usable as a texture field that can be masked into many different wall geometries. Architectural outlines, AO, connector exclusions, cap treatment and final shading will be produced deterministically by the compositor, not by this image.

## Production note

If seamless/periodic sampling is later required, this source is not accepted as seamless merely because it looks texture-like. Run the dedicated seamless-material QA described in `docs/art-production-methods/capabilities/seamless-materials.md`.