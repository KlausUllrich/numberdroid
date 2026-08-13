# Transfer Hall Layer Rules

Slice 0.1 binding technical rules.

## Layer order

1. Ground: walkable surface only.
2. FloorFX: floor-projected shadows and light only.
3. Architecture: thin walls, corners, T-junctions, end caps and door framing on transparent cells.
4. WallProps: top-down wall equipment on transparent cells.
5. FloorProps: top-down free-standing objects on transparent cells.
6. Characters: player, NPC and enemy robots.
7. Overlay FX and UI: allegiance, scan, interaction and labels.

Props must never contain a floor/background plate. If removing a prop removes visible floor, the prop asset is wrong.

## Perspective

Ground, Architecture, WallProps and FloorProps are strict orthographic top-down. Only Characters may use front, side, back and diagonal character views for personality and directional readability.

## Wall and collision contract

Visible wall geometry and collision describe the same geometry. A visible opening has no collision. Continuous walls use explicit corner and T-junction art. Open ends use caps. Door clearance is regression-tested.

## Early light

The first Transfer Hall stays calmly and evenly lit. The Transfer apparatus may cast a clearly visible but restrained warm light pool onto the floor. That light belongs to FloorFX, not to the prop image.
