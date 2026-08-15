# Asset Recipe — TS-01 Gold Slice Composition Blockout Props

Status: **COMPOSITION_PREVIEW ONLY — never `LIVE_ACCEPTED` production art**

## Purpose

This recipe owns the temporary strict-top-down SVG props used during PASS 2 of `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

These assets answer a room-composition question:

> Where does TS-01 need additional visual mass/detail before we invest in final production assets?

They do **not** answer the final prop-art question.

## Asset Task Card

```text
CATEGORY             Gold Slice composition/blockout props
TARGET FILE          public/assets/deck/ts01-gold-slice-blockout-props.svg
RUNTIME GRID         4 × 3 cells, 64 × 64 px each, 256 × 192 px atlas
PERSPECTIVE          strict orthographic top-down
BACKGROUND           transparent
PALETTE              deliberately simplified warm ceramic/graphite with restrained Family amber / Transfer teal cues
ALLOWED CONTENT      benches, low storage, personal clutter, support/service consoles
FORBIDDEN CONTENT    side-view furniture, readable frontal screens, baked floor, scene lighting, final hero art
MAP CONTEXT           TS-01 first room; WallProps/FloorProps only
GID RANGE             189–200
SOURCE                this recipe + deterministic SVG runtime source
QA                    exact grid; no cell bleed; top-down read; no interaction semantics; live composition QA
```

## Method selection

```text
Primary production method:   M4 Procedural 2D Compositor / direct deterministic SVG
Material/source method:      flat vector fills only
Optional finishing method:   none
Geometry authority:          SVG geometry
Topology/edge authority:     SVG geometry + map placement
Material authority:          SVG fills/strokes
Alpha/background authority:  SVG transparency
Packing/runtime authority:   exact 64 px atlas grid
Why this split fits:          placeholders need fast exact silhouettes and zero generative ambiguity; expressive final prop form is explicitly deferred
```

## Runtime cell contract

```text
local 0–1   family lower-wall bench, 2×1
local 2–3   Transfer upper-wall support console, 2×1
local 4–5   family lower-wall storage/sideboard, 2×1
local 6     personal bag / soft clutter, 1×1
local 7     small personal side table, 1×1
local 8–9   Transfer lower-wall service bank, 2×1
local 10    compact wall-edge utility module, 1×1
local 11    single soft waiting seat / cushion mass, 1×1
```

The atlas deliberately places upper-wall objects toward the lower part of their cell and lower-wall objects toward the upper part of their cell so the visible mass can sit close to accepted wall fascia without painting over it.

## Placeholder visual rule

- simple large shapes;
- limited detail;
- no high-frequency texture;
- no baked grounding shadow;
- no labels/text;
- no decorative perspective;
- clearly provisional when compared with accepted production props.

## Gameplay rule

Blockout props introduce **no interaction, pickup, resource or story logic**.

They have **no collision by default** during density exploration. Collision may be added only if a future composition question explicitly requires navigation-clearance proof.

## Replacement rule

After live composition QA:

- placeholders that did not improve the room are deleted;
- placeholders that did improve the room become named final asset tasks with their own method/recipe;
- do not silently promote this SVG atlas into final production art.
