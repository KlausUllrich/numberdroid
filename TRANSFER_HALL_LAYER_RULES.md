# Transfer Hall Layer Rules

Binding technical rules for Slice 0.x and the following Gold Slice.

## Repository transport

Remote repository work in ChatGPT sessions must use the connected GitHub connector. A failed local/container network request must never be interpreted as missing GitHub access and must never trigger `git clone`, `curl`, or another container-network fallback for repository transport. If the GitHub connector itself fails, retry/diagnose the connector directly.

## Layer order

1. Ground: walkable surface only.
2. FloorFX: floor-projected shadows and non-light markings only.
3. Architecture: thin walls, corners, T-junctions, end caps and door framing.
4. WallProps: top-down wall equipment on transparent cells.
5. FloorProps: top-down free-standing objects on transparent cells.
6. Characters: player, NPC and enemy robots.
7. LightOverlay: scene illumination, above world objects/characters but below UI.
8. Overlay FX and UI: allegiance, scan, interaction and labels.

Props must never contain a floor/background plate. If removing a prop removes visible floor, the prop asset is wrong.

## Perspective

Ground, Architecture, WallProps and FloorProps are strict orthographic top-down. Only Characters may use front, side, back and diagonal character views for personality and directional readability.

## Wall and collision contract

Visible wall geometry and collision describe the same geometry. A visible opening has no collision. Continuous walls use explicit corner and T-junction markers. Open ends use caps. Door clearance is regression-tested.

Wall tiles are semantic geometry markers, not trusted baked wall pictures. The runtime draws continuous edge-to-edge wall bands with deliberate overlap between adjacent cells. The internal divider is 8 px wide in rendering and `0.125` tile wide in collision.

T-junction stems terminate at the inner face of the horizontal wall. They must never visually pierce through the wall into the area outside the room.

## Door pockets

Moving door leaves belong below Architecture in the scene stack. When a door opens, its leaves retract fully into the neighboring wall segments and are occluded by the wall. Static door guides/frame may sit at Architecture/WallProps depth; status labels are UI. A moving door leaf must never render on top of the wall it is supposed to enter.

## Lighting

Scene illumination is not a FloorFX tile and is never baked into prop art. Light is rendered by `LightOverlay` from semantic light-source data.

Light is room-occluded:

- each light belongs to an explicit interior light zone;
- light zones stop at the visible wall faces;
- walls are never painted from above by the scene-light overlay;
- light from one room never bleeds through a separating wall into another room;
- for Slice 0.x an open doorway does not forward light into the next room; portal-light propagation can be added later as an explicit feature;
- because LightOverlay is above Characters, robots standing inside a light field are illuminated too;
- UI remains above LightOverlay and is not part of scene lighting.

The first Transfer Hall stays calmly and evenly lit. The Transfer apparatus may cast a clearly visible but restrained warm light field. Do not add unrelated blinking/glowing props merely because their local atlas tile index matches an animated base tile.

## Tile-state identity

Animated/stateful tiles are selected by global GID, never by a tileset-local tile index. Local IDs may repeat between Ground, Architecture, FloorFX and Props; using them for global effects causes unrelated props to animate or glow.

## Directional characters

Characters are the exception to the top-down-only environment rule. PICO and other important gameplay bodies use eight explicit authored views in this order:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

The eight frames must be visually distinguishable at gameplay scale. A technically separate frame that reads like the same cardinal view does not satisfy the rule. Front shows face/personality; rear removes the face and exposes service/back detail; profiles are narrow true profiles; diagonals visibly combine front/rear and side information.
