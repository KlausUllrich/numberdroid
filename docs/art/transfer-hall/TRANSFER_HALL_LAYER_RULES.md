# Transfer Hall Layer Rules

Status: **binding technical category contract — v0.13.2 generated spatial baseline accepted; production Art Parity CURRENT**

## Layer order

1. Ground: walkable surface only.
2. FloorFX: floor-projected shadows and non-light markings only.
3. Architecture: wall bands, corners, T-junctions, end caps and architectural door interfaces.
4. WallProps: top-down wall equipment on transparent cells/sprites.
5. FloorProps: top-down free-standing objects on transparent cells/sprites.
6. Characters: player, NPC and enemy robots.
7. LightOverlay: scene illumination, above world objects/characters but below UI.
8. Overlay FX and UI: allegiance, scan, interaction and labels.

Props must never contain a floor/background plate. If removing a prop removes visible floor, the prop asset is wrong.

Generated TS-01 uses the same semantic ordering through its composite Floor visual. Production Prop images and fallback blockouts are presentation consumers of the same spatial Level Compiler output; they do not become a second gameplay map.

## Perspective

Ground, Architecture, WallProps and FloorProps are strict orthographic/top-down environment categories. Detailed civilian props may use the accepted **ND Shallow Top-Down** near-nadir treatment when their recipe explicitly owns that asset class, but they must not depend on a readable frontal/side furniture face.

Only Characters deliberately use authored front, side, back and diagonal character views for personality and directional readability.

## Wall and collision contract — LIVE_ACCEPTED

The accepted Gold-Slice wall kit uses **30 px visible fascia** while preserving the **10 px collision core**. Visual mass may extend beyond collision; gameplay wall geometry remains the 10 px structural contract.

A visible opening has no wall collision. Shared/generated walls are canonical semantic geometry, not overlapping room-owned decorations. Open ends/corners/Ts retain their accepted semantic treatment.

Walls are frozen unless live QA exposes a concrete defect or an explicitly approved bounded revision is requested.

## Doors — LIVE_ACCEPTED

Transfer Hall uses **5 px darker moving Door leaves** inside the substantial 30 px wall fascia.

Accepted Door behavior/presentation:

- exact doorway-aperture clipping hides retracting leaves geometrically;
- 520 ms opening;
- 650 ms monotonic soft close with no overshoot;
- compact pocket collars only at real wall terminations;
- no full-length guide rails through the aperture;
- no visible `ZUTEILUNG` / `OPEN` status text;
- coloured-key variant uses a narrow semantic key-colour marker on a neutral graphite body;
- map topology/collision/access logic remains separate from visual skin.

The hand-authored `transfer-hall` and generated `ts01-transfer-hall` must share this reusable Gold Slice Door presentation contract. Do not scope the accepted behavior only to one concrete Floor ID.

Doors are frozen unless live QA exposes a concrete defect or an explicitly approved extension is requested.

## Props / true-space presentation — v0.13.2 ACCEPTED SPATIAL BASELINE

Visual art, coarse solver footprint, true-space placement envelope, collision and use-space are separate concerns.

Binding rules:

- `footprintTiles` / solved tile rectangle is the deterministic coarse placement anchor/reservation;
- explicit source-local visual/collision/custom bounds remain authored metadata;
- final true-space geometry may receive the minimum sub-tile correction beyond its own coarse anchor when necessary;
- translated geometry must remain valid against room wall surfaces, other Prop true-space envelopes, foreign use-space/Hero reservations and Door Clearance;
- sprite, grounding shadow and physical collision receive the same Exact-Fit translation;
- collision may be multipart when one rectangular blocker would create implausible invisible mass;
- image alpha/canvas size never becomes automatic collision authority.

Canonical stabilized examples:

- Family Table uses multipart table + seat collision;
- Hologram pedestal uses a 0.70 × 0.70 tile physical collider;
- fallback Prop stubs are clipped/inset to the visible room interior.

See `docs/level-generation/PROP_EXACT_FIT.md` and `GOLD_SLICE_REGRESSION_GATES.md`.

## Current production state

```text
PICO                    LIVE_ACCEPTED source baseline
Floor                   ACCEPTED BASELINE
Walls                   LIVE_ACCEPTED
Doors                   LIVE_ACCEPTED
Family Table            LIVE_ACCEPTED
Family Memory Console   LIVE_ACCEPTED
Family Props Batch 2    LIVE_CANDIDATE
v0.13.2 spatial pass    LIVE QA ACCEPTED
Transfer Apparatus      CURRENT NEXT PRODUCTION ASSET
Flow support / FloorFX  NEXT
PRIMUS hero/system art  NEXT
Domestic replacements  AFTER HERO HIERARCHY
```

The v0.13.2 PASS does not automatically promote `LIVE_CANDIDATE` images.

## New Hero / Prop asset rule

The next art categories must consume the established generated composite/Exact-Fit architecture.

Before production:

- update the relevant recipe;
- select M1/M2/M3/M4 according to the asset's authority needs;
- declare geometry/material/alpha/collision/packing ownership;
- preserve accepted spatial semantics rather than changing map/game logic to rescue unsuitable art.

Transfer Apparatus is the current highest-priority missing Hero asset. Flow and PRIMUS system art follow after the Transfer hero establishes the room's visual hierarchy.

## Shadows / FloorFX

Grounding/contact shadows and floor-projected functional markings belong to FloorFX.

- shadows remain separate from collision and visible Prop sprites;
- FloorFX is not scene illumination;
- Flow/path markings require a functional reason;
- no floor background should be baked into transparent FX assets.

## Lighting

Scene illumination is never baked into ordinary Floor/Prop art. `LightOverlay` owns light that affects the scene/characters.

TS-01 remains calm. The Transfer apparatus should become the strongest restrained warm local emissive focus while the actual illumination of nearby floor/PICO remains runtime lighting.

## Tile-state identity

Animated/stateful tile effects are selected by **global GID**, never by a tileset-local tile index. Local IDs repeat between Ground, Architecture, FloorFX and Props.

Generated composite sprites use explicit semantic sprite/layer identities instead of relying on tile-local indices.

## Preview annotations

Floating room labels are art/debug preview annotations, not diegetic final-game UI. Final production information must be communicated by world art/signage, normal interaction UI, or explicit narrative UI.

## Directional characters

Important bodies use eight explicit authored views in this order:

`N (back) | NE (rear 3/4) | E (profile) | SE (front 3/4) | S (front) | SW (front 3/4) | W (profile) | NW (rear 3/4)`

A smaller issue with the player's own in-game model/presentation is known and deliberately deferred. Do not reopen/regenerate accepted PICO source art until the concrete problem is identified and routed to the appropriate Character/Engineering contract.

## Freeze / change discipline

Do not reopen foundational layer, wall, Door or v0.13.2 spatial architecture to solve ordinary production-art issues.

If new art exposes a genuine spatial-contract defect, treat that as a separate reviewed Engineering/Technical-Art change with regression/live QA. Otherwise, new art should replace semantic blockouts through the existing presentation registry and layer contract.
