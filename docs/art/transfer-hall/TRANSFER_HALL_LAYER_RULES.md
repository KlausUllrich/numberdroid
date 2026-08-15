# Transfer Hall Layer Rules

Status: **binding technical category contract**

## Layer order

1. Ground: walkable surface only.
2. FloorFX: floor-projected shadows and non-light markings only.
3. Architecture: wall bands, corners, T-junctions, end caps and architectural door interfaces.
4. WallProps: top-down wall equipment on transparent cells.
5. FloorProps: top-down free-standing objects on transparent cells.
6. Characters: player, NPC and enemy robots.
7. LightOverlay: scene illumination, above world objects/characters but below UI.
8. Overlay FX and UI: allegiance, scan, interaction and labels.

Props must never contain a floor/background plate. If removing a prop removes visible floor, the prop asset is wrong.

## Perspective

Ground, Architecture, WallProps and FloorProps are strict orthographic top-down. Only Characters may use front, side, back and diagonal character views for personality and directional readability.

## Wall and collision contract — LIVE_ACCEPTED

The accepted Gold-Slice wall kit uses **30 px visible fascia** while preserving the **10 px collision core**. Visual mass may extend beyond collision; gameplay geometry remains the 10 px structural contract.

A visible opening has no collision. Continuous walls use explicit corner and T-junction markers. Open ends use caps. Wall tiles are semantic geometry markers rendered through the accepted M4 compositor; topology is deterministic.

Walls are frozen unless live QA exposes a concrete defect or an explicitly approved bounded revision is requested.

## Doors — LIVE_ACCEPTED

Transfer Hall uses **5 px darker moving door leaves** inside the substantial 30 px wall fascia.

Accepted Door behavior/presentation:

- exact doorway-aperture clipping hides retracting leaves geometrically;
- 520 ms opening;
- 650 ms monotonic soft close with no overshoot;
- compact pocket collars only at real wall terminations;
- no full-length guide rails through the aperture;
- no visible `ZUTEILUNG` / `OPEN` status text;
- coloured-key variant uses a narrow semantic key-colour marker on a neutral graphite body;
- map topology/collision/access logic remains separate from visual skin.

Doors are frozen unless live QA exposes a concrete defect or an explicitly approved extension is requested.

## Props

WallProps and FloorProps are the **next Gold-Slice category**.

- wall-mounted assets are anchored to the wall and remain separate from Architecture unless they are truly structural;
- free-standing props must have transparent background and deliberate local contact shadow only;
- collision/interaction footprint is independent from raster footprint;
- do not bake floor or room lighting into prop art;
- do not scatter filler clutter merely to make the room look busy;
- family props should remain visually subordinate to the Transfer hero focus while carrying warm/personal traces.

## Lighting

Scene illumination is not a FloorFX tile and is never baked into prop art. Light is rendered by `LightOverlay` from semantic light-source data. Light is room-occluded and UI remains above it.

## Tile-state identity

Animated/stateful tiles are selected by **global GID**, never by a tileset-local tile index. Local IDs repeat between Ground, Architecture, FloorFX and Props.

## Preview annotations

Floating room labels are art/debug preview annotations, not diegetic final-game UI. Final production information must be communicated by world art/signage, normal interaction UI, or explicit narrative UI.

## Directional characters

Characters are the exception to top-down-only environment rules. Important bodies use eight explicit authored views in this order:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

## Slice / Gold status

Slice 0 is accepted and closed as the technical foundation.

Current Gold-Slice state:

```text
PICO    LIVE_ACCEPTED
Floor   ACCEPTED BASELINE
Walls   LIVE_ACCEPTED
Doors   LIVE_ACCEPTED
Props   NEXT
```

Do not reopen foundational layer/collision architecture to solve ordinary prop-production issues.
