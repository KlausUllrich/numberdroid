# Transfer Hall Layer Rules

Binding technical rules for the completed Slice 0 foundation and the following Gold Slice.

## Repository transport

Remote repository work in ChatGPT sessions must use the connected GitHub connector. A failed local/container network request must never be interpreted as missing GitHub access and must never trigger `git clone`, `curl`, or another container-network fallback for repository transport. If the GitHub connector itself fails, retry/diagnose the connector directly.

## Layer order

1. Ground: walkable surface only.
2. FloorFX: floor-projected shadows and non-light markings only.
3. Architecture: wall bands, corners, T-junctions, end caps and door pockets.
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

Wall tiles are semantic geometry markers, not trusted baked wall pictures. The runtime draws continuous edge-to-edge wall bands with deliberate overlap between adjacent cells. The Transfer Hall foundation uses a **10 px architectural wall band** and a matching `10 / 64` tile collision thickness for the internal divider.

T-junctions are layered joints: the divider stem is painted first and terminates into the horizontal wall; the uninterrupted horizontal band is painted over the join. A stem must never visually pierce through the wall or produce a cross-shaped protrusion outside the room.

## Door pockets

Moving door leaves belong below Architecture in the scene stack. Transfer Hall establishes a deliberate visual ratio: **10 px wall / 5 px moving door leaf**. The door must read as a thin moving element inside a more substantial wall, matching the original reference direction.

When a door opens, its leaves retract fully into neighboring wall pockets and are occluded by Architecture. Static pocket rails may remain visible at Architecture/WallProps depth. A moving door leaf must never render on top of the wall it is supposed to enter.

## Lighting

Scene illumination is not a FloorFX tile and is never baked into prop art. Light is rendered by `LightOverlay` from semantic light-source data.

Light is room-occluded:

- each light belongs to an explicit interior light zone;
- light zones stop at visible wall faces;
- walls are never painted from above by the scene-light overlay;
- light from one room never bleeds through a separating wall into another room;
- for the foundation an open doorway does not forward light into the next room; portal-light propagation can be added later as an explicit feature;
- because LightOverlay is above Characters, robots standing inside a light field are illuminated too;
- UI remains above LightOverlay and is not part of scene lighting.

The first Transfer Hall stays calmly and evenly lit. The Transfer apparatus may cast a clearly visible but restrained warm light field. Do not add unrelated blinking/glowing props.

## Tile-state identity

Animated/stateful tiles are selected by **global GID**, never by a tileset-local tile index. Local IDs repeat between Ground, Architecture, FloorFX and Props. Global styling with `data-tile-id` is forbidden because it can make unrelated prop fragments pulse or glow and exposes hard atlas-fragment boundaries. Runtime state styling uses `data-gid`.

## Preview annotations

Floating room labels such as `FAMILIENBEREICH`, `TRANSFER`, `PRIMUS-ZUTEILUNG` and explanatory subtitles are **art/debug preview annotations**, not diegetic final-game UI. They may remain visible in the direct `?floor=transfer-hall` preview while the Gold Slice is evaluated.

They must not be carried into normal campaign gameplay as floating explanatory labels. Final production information must either be communicated by world art/signage, normal interaction UI, or explicit narrative UI. Robot name plates are a separate system and are not covered by this rule.

## Directional characters

Characters are the exception to the top-down-only environment rule. PICO and other important gameplay bodies use eight explicit authored views in this order:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

The eight frames must be visually distinguishable at gameplay scale. A technically separate frame that reads like the same cardinal view does not satisfy the rule. Front shows face/personality; rear removes the face and exposes service/back detail; profiles are narrow true profiles; diagonals visibly combine front/rear and side information.

## Slice 0 acceptance — 2026-08-13

Slice 0 is **accepted and closed as the technical foundation**. Do not reopen it as another architecture or system-design phase before beginning the Gold Slice.

Validated foundation includes:

- landscape-only mobile gameplay guard;
- reliable visual/collision separation;
- complete outer perimeter and traversable visible openings;
- thin semantic wall geometry and matching collision;
- door leaves that retract below Architecture into wall pockets;
- clean Ground / FloorFX / Architecture / WallProps / FloorProps / Characters / LightOverlay / UI separation;
- props with transparent backgrounds and no baked floor tiles;
- room-occluded LightOverlay that illuminates PICO but not walls or the neighboring room;
- global-GID state effects, preventing accidental prop glow;
- visually readable eight-direction PICO turnaround;
- art/debug annotations separated conceptually from final game UI.

### Known cosmetic debt intentionally deferred to the Gold Slice

The final Slice 0 screenshot still shows two minor visual seams. They are **not reasons to restart Slice 0**:

1. At the upper/right wall-junction/corner there is still a thin cyan/teal highlight line that makes the junction look slightly layered rather than like one finished manufactured wall piece.
2. An open doorway can still show two thin guide/pocket lines after the moving leaves retract. The door works correctly, but the final Gold art should integrate or hide those guides so the open aperture reads cleanly.

Fix these while replacing/polishing the wall and door presentation for the Gold Slice. Preserve the underlying layer, collision, wall-pocket and lighting contracts.
