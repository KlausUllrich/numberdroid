# Transfer Hall Layer Rules

Binding technical rules for Slice 0.x and the following Gold Slice.

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

Visible wall geometry and collision describe the same geometry. A visible opening has no collision. Continuous walls use explicit corner and T-junction markers. Open ends use caps. Door clearance is regression-tested.

### Slice 0.2 rendering rule

Wall tiles are **semantic geometry markers**, not trusted baked wall pictures. The runtime draws continuous edge-to-edge wall bands from those markers with deliberate 1 px overlap between adjacent cells. This prevents antialiasing or atlas slicing from creating visible gaps while keeping the layout tile-authored.

The internal divider is 8 px wide in rendering and `0.125` tile wide in collision, so visual mass and collision thickness match.

The complete outer perimeter must have an Architecture marker on every cell of the top, bottom, left and right room boundary. Missing perimeter markers are a regression failure.

## Early light

The first Transfer Hall stays calmly and evenly lit. The Transfer apparatus may cast a clearly visible but restrained warm light pool onto the floor.

Light belongs to FloorFX, not to the prop image. A local light pool must be rendered as **one continuous radial field from one semantic marker**, never as a 2x2/3x3 set of baked glow fragments. Sliced glow imagery is forbidden because tile seams read as yellow graphic edges rather than light.

## Directional characters

Characters are the exception to the top-down-only environment rule. PICO and other important gameplay bodies use eight explicit authored views in this order:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

The eight frames must be visually distinguishable at gameplay scale. A technically separate frame that reads like the same cardinal view does not satisfy the rule. Front shows face/personality; rear removes the face and exposes service/back detail; profiles are narrow true profiles; diagonals visibly combine front/rear and side information.
