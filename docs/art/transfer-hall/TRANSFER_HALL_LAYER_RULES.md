# Transfer Hall Layer Rules

Binding technical rules for the completed Slice 0 foundation and the following Gold Slice.

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

The accepted Gold-Slice wall kit uses **30 px visible fascia** while preserving the original **10 px collision core**. Visual mass may extend beyond collision; gameplay geometry remains the 10 px structural contract.

A visible opening has no collision. Continuous walls use explicit corner and T-junction markers. Open ends use caps. Door clearance is regression-tested.

Wall tiles are semantic geometry markers rendered through the accepted M4 compositor. T-junctions/corners/connectors are topology-driven; generated silhouettes do not own these semantics.

## Door pockets

Moving door leaves belong below Architecture in the scene stack. Transfer Hall uses a deliberate ratio of **30 px visible wall fascia / 5 px moving door leaf**: the leaf is a thin moving mechanism inside a substantial structural wall.

When a door opens, its leaves retract fully into neighboring wall pockets and are occluded by Architecture. Static pocket collars may remain visible at the real wall terminations. A moving leaf must never render on top of the wall it is supposed to enter.

The Gold-Slice Door candidate removes the old full-length guide/pocket rails from the aperture; only compact termination collars remain. Live visual acceptance is still required before the Door category is frozen.

## Lighting

Scene illumination is not a FloorFX tile and is never baked into prop art. Light is rendered by `LightOverlay` from semantic light-source data. Light is room-occluded and UI remains above it.

## Tile-state identity

Animated/stateful tiles are selected by **global GID**, never by a tileset-local tile index. Local IDs repeat between Ground, Architecture, FloorFX and Props.

## Preview annotations

Floating room labels are art/debug preview annotations, not diegetic final-game UI. Final production information must be communicated by world art/signage, normal interaction UI, or explicit narrative UI.

## Directional characters

Characters are the exception to top-down-only environment rules. Important bodies use eight explicit authored views in this order:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

## Slice 0 → Gold Slice status

Slice 0 is accepted and closed as the technical foundation. Gold Slice subsequently promoted the wall presentation from the original thin 10 px visual proof to the live-accepted 30 px M4 fascia while retaining 10 px collision.

Current Gold-Slice sequence after accepted Floor/PICO/Walls:

`Doors → ordinary props → hero apparatus / PRIMUS objects → remaining robots`.

The remaining Door-specific gate is live visual QA of the Gold candidate; do not reopen foundational layer/collision architecture to solve cosmetic Door issues.
