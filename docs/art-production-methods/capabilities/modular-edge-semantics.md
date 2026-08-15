# Capability — Modular Edge Semantics

Status: **binding for modular architecture**

A modular tile has two different kinds of apparent boundaries:

1. a **true exposed edge** of the object/architecture;
2. a **runtime split / connector edge** where the object continues into another cell.

These must not receive the same visual treatment.

## Example

For `H_TOP` in the Transfer Hall:

- the horizontal architectural faces are exposed and may receive controlled depth/shading;
- the left and right cell boundaries are connectors into neighboring wall pieces;
- those connector boundaries must not receive an end-cap, rounded closure, heavy outline or isolated-prop frame.

The isolated alpha silhouette alone cannot express this distinction.

## Required semantic classes

A category may define more classes, but modular architecture should at minimum distinguish:

```text
EXPOSED
CONNECTOR
TRUE_CAP
RESERVED / NONE
```

Optional future classes:

```text
DOOR_POCKET
EFFECT_ALLOWED
OCCLUDED
FLOOR_CONTACT
WALL_CONTACT
```

## Authority

The semantic category contract or recipe owns this information. Do not infer production topology solely from generated pixels.

For the current Transfer Hall wall kit, `TRANSFER_HALL_WALL_KIT.md` and `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md` remain authoritative for connector relationships.

## Method implications

- M1 cannot reliably infer these relationships from an isolated source image.
- M2 can restore geometry but cannot necessarily remove incorrect material/outline choices painted inside the valid mask.
- M3 can implement the distinction through explicit layers/masks when the editor API supports it.
- M4 is designed to treat this distinction as deterministic render input.

## QA

Required checks include:

- connector boundary equality;
- absence of cap/outline treatment on connector boundaries;
- presence and consistency of exposed-edge treatment where required;
- explicit true-cap treatment only on named terminations;
- assembled straight/corner/T-junction previews;
- live map-context QA.

Automated seam compatibility should always include a negative control, as documented in `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`.