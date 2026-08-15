# Capability: Seamless / periodic tiles and materials

Status: **PLANNED**

Ordinary image generation is **not** assumed to create a mathematically periodic texture.

## Intended toolkit split

Two separate capabilities are expected:

### A. Construction / repair

Possible future operations:

- wrap/offset a candidate texture so seams move into the interior;
- repair the interior crossing while preserving overall material identity;
- enforce or blend opposite edge strips deterministically;
- create deterministic variants from one periodic master without breaking periodicity.

### B. Validation

A future validator should report at least:

- left/right edge difference;
- top/bottom edge difference;
- negative-control/reference difference where meaningful;
- wrapped preview;
- repeated 3x3 or larger neighborhood;
- runtime-scale repetition artifacts;
- frequency/repetition warnings where useful.

## Important distinction

A texture can have matching opposite edge pixels and still look obviously tiled because of large-scale repeated features. Therefore exact seam QA and repetition-pattern QA are separate gates.

## Method relation

Periodic material tools may feed M4, M2 or other future methods. The tool owns periodic mechanics, not the art direction or the decision that an asset should be seamless.
