# Numberdroid — Prop / Art Emission

Status: **v0.13 runtime presentation contract**

v0.13 connects solved semantic Prop placement to registered runtime art without changing the spatial compiler or making pixels authoritative for gameplay.

```text
LevelSpec Prop request
        ↓
Prop Registry
  footprint / attachment / allowed rotations / placement rules
        ↓
rotation-aware Prop solver
  physical rect / rotation / wall side / reservations
        ↓
Prop Art Registry
  asset / optional shadow / review status
        ↓
ordered composite Floor visual
        ↓
existing runtime
```

The central rule is:

> **Art consumes solved geometry. Art never defines collision, reachability or placement validity.**

## 1. Two registries, two responsibilities

### Spatial Prop Registry

`src/levelgen/propRegistry.ts`

Owns gameplay/authoring facts such as:

- semantic Prop ID;
- tags;
- floor/wall attachment;
- allowed rotations;
- authored 0° footprint in tiles;
- approach/use-space;
- Hero clearance;
- navigation / Door Clearance restrictions;
- placement preferences.

Changing this registry can change the compiled level geometry and therefore requires spatial/gameplay QA.

### Prop Art Registry

`src/levelgen/propArtRegistry.ts`

Owns presentation only:

- runtime art asset;
- optional grounding shadow;
- art-review status: `accepted` or `candidate`.

Adding/replacing an art registration must **not** change the solved footprint, collision or navigation result.

This separation is intentional for Artist-agent workflows: an Artist can register a new approved sprite without silently modifying gameplay geometry.

## 2. Current TS-01 mappings

### Accepted art

- `family-table` → Family Table + grounding shadow;
- `family-memory-console` → Family Memory Console + grounding shadow.

### Candidate art

The following art is mapped so it can be evaluated in the generated room, but its registry status remains explicitly `candidate` until visual QA accepts it:

- `coffee-machine`;
- `planter-trough`;
- `plant-round`;
- `transfer-hologram` / current Hologram Pedestal candidate.

### Blockout fallback

Props with no Art Registry entry continue to render as semantic blockouts. This is deliberate progressive enhancement, not an error.

Current TS-01 examples include Child Bed, Toy Storage, Toilet, Transfer Core, Flow Station and PRIMUS Service Bank.

A partially art-mapped Level must therefore remain playable and inspectable.

## 3. Composite runtime visual

`FloorVisualDefinition` now supports:

```ts
{
  kind: "composite",
  layers: [...]
}
```

Existing `image` and `tilemap` Floors remain unchanged.

The composite layer array is the explicit render order. The generated preview uses:

```text
Ground
→ FloorFX / grounding shadows
→ Architecture
→ WallProp blockout fallback
→ WallProps production art
→ FloorProp blockout fallback
→ FloorProps production art
```

Characters, Doors and other live runtime entities remain outside this static Floor visual and keep their established runtime layering.

This preserves the existing Numberdroid art-direction order:

```text
Ground → FloorFX → Architecture → WallProps → FloorProps → Characters → LightOverlay / UI
```

The generated compiler preview does not gain a new LightOverlay merely because it became composite; v0.13 changes Prop art presentation only.

## 4. Why not embed PNGs inside the blockout SVG?

The v0.7.1 performance fix deliberately collapsed the generated geometric background into static SVG instead of hundreds of React tile nodes.

Production assets, however, already exist as normal public PNG files and should resolve through Vite/GitHub Pages paths normally.

Embedding external production PNG references inside a data-URL SVG would create brittle URL/CORS/base-path behavior and mix two presentation systems.

The composite visual keeps the efficient static ground/architecture SVGs while adding only a small number of ordinary positioned `<img>` sprites.

## 5. Rotation and authored dimensions

This is a binding technical rule.

`PropMetadata.footprintTiles` describes the **0° authored asset dimensions**.

Example:

```text
authored asset: 2×1
solver rotation: 90°
physical solved rect: 1×2
```

The runtime art must **not** be resized to `1×2` and then rotated again.

Instead:

1. keep the image at authored `2×1` pixel dimensions;
2. find the center of the solved `1×2` physical rectangle;
3. center the authored image on that point;
4. rotate the image by 90° around its center.

The resulting visual axis-aligned footprint matches the solver's rotated physical rectangle without distorting pixels.

This rule also applies to grounding shadows.

## 6. WallProps vs FloorProps

Visual layer classification comes from the authored attachment contract:

```ts
request.metadata.attachment
```

It must **not** be inferred merely from `placement.wallSide`.

Floor-attached Props may record a `wallSide` because their selected candidate touches or prefers a wall. That does not turn them into WallProps.

This distinction was regression-tested during v0.13 because Family Table can touch a wall while still belonging to the FloorProps layer.

## 7. Shadows / FloorFX

If an Art Registry entry contains `shadowAsset`, v0.13 emits a separate sprite with stable ID:

```text
shadow:<placement-id>
```

The shadow uses the same authored dimensions, center and rotation as the visible Prop and is rendered in the `floor-fx` layer **before Architecture**.

This avoids baking grounding shadows into collision or into the Prop's visual/collision silhouette.

Future art metadata may add explicit shadow offsets/overhangs if required; v0.13 intentionally uses the existing aligned shadow sheets.

## 8. Art status is not acceptance

`status: "candidate"` means only that an asset is available for integrated visual evaluation.

It does not mean:

- visual QA passed;
- the asset is final;
- the generated TS-01 reached parity with the hand-authored reference.

Only explicit user/art-direction acceptance may promote candidate art to accepted status.

## 9. Runtime safety

The composite visual is presentation-only.

It does not alter:

- `FloorDefinition.obstacles`;
- Walkable cells;
- Shared Wall collision;
- Door apertures;
- Encounter placement;
- Trigger/Event programs;
- script state;
- route geometry.

The existing emitted physical Floor remains the source of runtime collision and gameplay behavior.

No DOM measurement, image alpha, sprite bounds or MutationObserver participates in gameplay collision.

## 10. Performance boundary

v0.13 preserves the v0.7.1 strategy:

- one static SVG Ground image;
- one static SVG Architecture image;
- at most a small fallback blockout SVG per Prop category;
- one DOM image per registered Prop/shadow.

It does **not** reintroduce per-cell React rendering.

The required final Performance & Scale Pass will later measure large floors / high asset counts on desktop and real mobile hardware.

## 11. Tests

Regression coverage verifies:

- generated TS-01 uses the ordered composite visual;
- runtime obstacle count remains unchanged;
- registered assets appear in the intended layer;
- grounding shadows precede Architecture;
- unmapped Props retain blockout fallback;
- a synthetic `2×1 @ 90°` case keeps authored `2×1` image dimensions while centering over a `1×2` solved footprint;
- accepted 30 px wall fascia still emits every canonical wall once.

## 12. Next step

v0.13 provides the mapping mechanism, not full art parity.

The next development block is **Generated TS-01 feature/art parity**:

- inspect the generated Floor with real registered art;
- fix scale/layer/registration problems through reusable metadata where possible;
- add remaining necessary production assets/registrations;
- compare generated vs hand-authored reference;
- require explicit visual/gameplay QA before the generated Floor can replace the reference.
