# Art Pipeline Anti-Patterns

These are not separate production methods. They are tempting shortcuts that have already failed or produced unreliable results.

## Prompt directly for a precision production atlas

Do not ask an image generator to invent exact cell geometry, connector placement, atlas order and production-ready alpha from text alone.

Typical failure modes:

- mood/presentation boards instead of assets;
- inconsistent cell sizes;
- 2×2 compositions masquerading as 1×1 tiles;
- duplicate variants;
- wrong semantic colors;
- rounded connectors;
- labels/specifications rendered into pixels.

## Treat PNG as an art style

Rasterizing simple SVG/CSS shapes does not create target-quality art. The visual source itself must have believable material, value hierarchy and construction.

## Assume mask restore fixes semantic material errors

Mask restore fixes silhouette/alpha. It does not fix a bevel, outline, panel line or highlight that was painted on the wrong semantic edge.

## Assume separated generation cells solve connector semantics

Gutters solve accidental object fusion. They do not tell the generator which apparent edges continue into neighboring tiles.

## Silent regeneration loops

After each generation, inspect and report PASS/FAIL. Do not repeatedly regenerate without explaining the concrete failure and the changed hypothesis.

## QA that calls image generation

`QA`, `check`, `prüfen` or equivalent means inspect the existing result only. Calling image generation during QA destroys the state discipline and makes the workflow look hung.

## Seam scores without negative controls

A raw edge-difference number has little meaning. Always compare required-match edges against a negative control of edges that should not match.

## Use model/layout transfer as if it were pure material transfer

Recorded local tests showed IP-Adapter-style transfer could bring layout along with material and break structural lock. Treat style/material transfer claims as unproven until geometry retention is measured.

## Use the same flat guide as both structure and rich image source

A local test produced consistently flat, under-materialized output. Keep geometry control separate from the source of material richness where the tool supports it.
