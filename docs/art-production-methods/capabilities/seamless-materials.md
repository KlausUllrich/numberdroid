# Capability — Seamless / Periodic Materials

Status: **future production requirement; method-selection constraint**

A material that looks plausible as one image is not automatically usable as a repeatable game texture.

## Definition

A texture is seamless/periodic when opposite boundaries match under the intended wrap mode:

```text
left  ↔ right
top   ↔ bottom
```

For strict periodic use, both color and alpha/semantic channels must respect the wrap contract.

## Why this is a separate capability

Seamless material generation is not the same problem as modular tile connectors.

- **material periodicity** concerns the texture field itself;
- **semantic connectors** concern how object geometry continues between runtime cells.

An asset may require one, both, or neither.

## Method suitability

### M1 Direct Generative Source

Possible as source exploration, but do not assume ordinary generation is periodic. Accept only after automated opposite-edge measurement plus repeated visual QA.

### M2 Controlled Art Pass

Can preserve a pre-existing periodic structure if the edit tool respects wrap relationships, but image edits may break periodicity. Re-measure after every edit.

### M3 Layered Raster Editor / MCP

Potentially strong if the editor supports offset/wrap workflows, clone/heal across wrapped boundaries, and exact export. Must be verified with a reproducible test.

### M4 Procedural 2D Compositor

Strong fit when the input material is already periodic or when the compositor can construct a wrapped sampling field. It can preserve periodic sampling deterministically during masking and packing.

## QA principle

As with connector seams, never report an isolated seam number without context.

Useful tests include:

- mean/maximum left-right difference;
- mean/maximum top-bottom difference;
- repeated 3×3 or larger patch;
- negative control or baseline against an intentionally nonmatching edge pair;
- frequency/repetition inspection at gameplay scale.

## Future work

Possible approaches to research:

- periodic texture synthesis;
- offset-and-heal workflows in a layered editor;
- dedicated seamless generation/control models;
- procedural noise/material construction;
- quilting/patch synthesis from a larger material source.

Do not choose an implementation until a concrete asset requires it. Record experiments under the method folder that owns the implementation.