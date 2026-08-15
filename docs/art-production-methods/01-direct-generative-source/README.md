# M1 — Direct Generative Source

Status: **supported, with category limits**

## Purpose

Use image generation to author the primary visual source directly. Production extraction, alpha cleanup, resizing and QA still follow afterward.

This is the strongest method when **visual form and personality matter more than exact modular topology**.

## Good fits

- character turnarounds when eight views are explicitly authored and then extracted;
- isolated props whose full silhouette is genuinely exposed;
- concept/source exploration for hero assets;
- material swatches that will later be consumed by M4;
- non-production style exploration when explicitly requested.

PICO is an example of a category where generative authorship can contribute strongly because character appeal, proportions and readable front/profile/back views matter more than a fixed SVG contour.

## Poor fits

Do not make M1 the production authority for:

- modular walls;
- exact connectors;
- T-junctions/corners that must interchange;
- collision-corresponding geometry;
- seamless/periodic textures unless the generator/tool explicitly guarantees and verifies periodicity;
- atlas cell layout where one-pixel placement has semantic meaning.

## Workflow

```text
asset task card
→ production-only prompt
→ exactly one generation
→ source QA
→ deterministic extraction
→ alpha/background cleanup
→ exact runtime sizing/packing
→ production QA
→ map/live QA
```

`QA` never triggers another generation.

## Strengths

- rich visual ideation;
- character and prop personality;
- material richness;
- fast exploration of shape language;
- useful source for later deterministic methods.

## Known failure modes

- near-duplicate variants;
- inconsistent frame scale;
- unwanted labels/boards/backgrounds;
- baked lighting/floor;
- false perspective;
- attractive geometry that cannot be extracted cleanly;
- model-invented seams, caps or outlines where runtime topology expects continuation.

## Production rule

The generated image is a **source**, not automatically the runtime file. The runtime asset must still pass all applicable validation rules.

## Hybrid use

For geometry-critical assets, M1 should often generate only a **material source** rather than the object itself:

```text
M1 material swatch
→ M4 procedural compositor
```

This division lets the model do what it is strong at without granting it topology authority.