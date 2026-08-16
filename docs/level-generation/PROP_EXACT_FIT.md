# Numberdroid — Exact Prop Fit / Wall Surfaces

Status: **v0.13.1 precision contract**

v0.13 connected solved Prop placements to real production art. Live generated TS-01 QA then exposed the next precision problem: a Prop solved against a semantic tile/wall boundary could visually overlap the accepted 30 px wall fascia because the visual sprite and runtime Prop collision were simply centered on the solved tile rectangle.

v0.13.1 adds one explicit precision layer **after** the tile solver and **before** runtime art/collision emission.

```text
semantic Prop request
      ↓
conservative tile footprint solve
      ↓
rotation-aware solved tile rectangle
      ↓
EXACT PROP FIT
  visual bounds
  collision bounds
  placement envelope
  wall visible/collision surface
      ↓
shared sub-tile translation
      ├─ production sprite
      ├─ grounding shadow
      └─ runtime Prop collision
```

The tile footprint remains the conservative compiler/reservation envelope.

## 1. Why several bounds are necessary

One rectangle cannot correctly represent every responsibility of a Prop.

### `footprintTiles`

Existing coarse solver geometry.

It is used for:

- candidate enumeration;
- deterministic placement;
- Prop-vs-Prop tile reservations;
- navigation safety;
- Door Clearance interaction;
- approach/use-space;
- Actor/path placement dependencies.

It deliberately remains conservative.

### `visualBoundsTiles`

The meaningful visible object envelope inside the authored 0° Prop canvas.

This is **not automatically the PNG canvas border**. Transparent padding, glow, particles and presentation-only overhang must not accidentally become spatial rules.

### `collisionBoundsTiles`

The actual physical collider emitted to the runtime.

It may be smaller than the visual object.

### `placementEnvelope`

The envelope used when the object is fitted against a wall surface.

Allowed policies:

```text
visual
collision
custom
```

This is the explicit answer to the art-direction question “does this Prop need its visible outline or only its physical body to respect the wall?”

Examples:

```text
large furniture / sofa-like object
→ placementEnvelope = visual

small hologram with glow around a pedestal
→ placementEnvelope = collision
```

### use-space

Existing approach/use-space remains separate from all of the above.

Use-space describes where a player/robot must be able to stand or move to use an object. It is not the object's own physical volume.

## 2. Authored coordinate system

Exact-fit bounds are authored in **0° local tile units** inside the Prop's existing `footprintTiles` canvas.

Example:

```ts
footprintTiles: { w: 3, h: 2 },
exactFit: {
  visualBoundsTiles: { x: 0.12, y: 0.12, w: 2.76, h: 1.76 },
  collisionBoundsTiles: { x: 0.25, y: 0.25, w: 2.5, h: 1.5 }
}
```

These values are semantic authoring metadata.

They are **not** read back from DOM layout, browser image dimensions, PNG alpha or rendered pixels.

Asset scaling therefore does not redefine the physical contract.

## 3. Rotation

Exact-fit local bounds rotate with the same cardinal Prop rotation as the solved footprint.

```text
0°   → authored bounds unchanged
90°  → width/height axes rotate
180° → reverse both axes
270° → inverse quarter turn
```

Rotation is around the center of the authored 0° Prop canvas, matching v0.10/v0.13 art placement semantics.

A non-square collision envelope therefore becomes a correspondingly rotated runtime AABB.

## 4. Two wall surfaces

The generated wall already has two physically meaningful thicknesses:

```text
visible fascia      default 30 px
collision core      default 10 px
```

Both are centered on the canonical Shared Wall Graph line.

For the room on one side of the wall this produces two possible room-facing surfaces:

```text
wall centerline
      │
      ├── ±5 px   collision surface
      └── ±15 px  visible fascia surface
```

`wallBoundary` selects which surface the Prop placement envelope touches:

```ts
wallBoundary: "visual" | "collision"
```

Typical policies:

```text
large furniture / wall console
placementEnvelope = visual
wallBoundary       = visual

small hologram pedestal with glow
placementEnvelope = collision
wallBoundary       = collision
```

The runtime collision is always prevented from crossing the wall collision core even when visual fitting uses another envelope.

## 5. Real wall contact is required

`placement.wallSide` is not sufficient by itself to trigger a wall snap.

Exact fitting occurs only when the solved tile footprint **actually touches that side of its containing Space**.

This prevents:

- stale wall metadata;
- preference-only wall hints;
- synthetic/debug placements;
- future solver changes

from pulling a Prop across a room after the tile placement stage has already completed.

## 6. Conservative containment rule

Exact fit is a precision layer, not a hidden sub-tile topology solver.

Binding rule:

> the final placement envelope and runtime collision must remain inside the already-solved tile footprint.

If authored metadata would require expansion into a neighboring tile, compilation fails and the correct fix is one of:

- increase/change the conservative `footprintTiles`;
- correct the visual/collision envelope metadata;
- change the Prop placement rule;
- explicitly redesign the asset/physical contract.

Do **not** silently let exact fit occupy unreserved neighboring cells.

This preserves downstream guarantees for navigation, Actors, routes and deterministic placement.

## 7. Shared translation

The exact-fit result returns one sub-tile translation.

The same translation is applied to:

- visible Prop sprite;
- grounding shadow;
- runtime Prop collision.

This is critical. Art must never visually move away from its physical object because two different systems independently “corrected” wall thickness.

Compiler debug/Tiled metadata records the offset and emitted collision rectangle for diagnosis.

## 8. Spatial Registry vs Art Registry

The v0.13 registry split remains valid.

### Spatial Prop Registry

Owns:

- footprint;
- allowed rotations;
- placement rules;
- exact-fit visual/collision/custom physical envelopes;
- envelope policy;
- wall-surface policy.

Changing exact-fit metadata may change runtime collision and therefore requires spatial/gameplay QA.

### Prop Art Registry

Owns:

- asset path;
- shadow asset;
- art review status.

Replacing a PNG does not automatically redefine physical geometry.

An Artist may propose updated physical envelope metadata when an asset requires it, but that is a reviewed spatial-contract change, not an automatic consequence of image dimensions.

## 9. Current TS-01 policy

The first v0.13.1 pass intentionally configures only Props already using real integrated art.

Current policy:

- Family Table: visual envelope against visible wall fascia; smaller collision;
- Family Memory Console: visual envelope against visible wall fascia; smaller collision;
- Coffee Machine: visual envelope against visible wall fascia; smaller collision;
- Round Plant: visual envelope against visible wall fascia; smaller collision;
- Planter Trough: visual envelope against visible wall fascia; smaller collision;
- Transfer Hologram: collision/pedestal envelope against wall collision surface; visual/glow envelope remains presentation-tolerant.

Unmapped blockout Props retain their existing conservative full-tile collision until their actual art/physical contract is reviewed.

This avoids pretending we know the true silhouette of art that does not yet exist in the production registry.

## 10. Runtime and performance boundary

Exact fit is compiled once.

It adds no:

- per-frame geometry work;
- DOM measurement;
- image-alpha analysis;
- React collision logic;
- MutationObserver behavior.

Runtime receives ordinary precomputed obstacle rectangles and ordinary positioned sprites.

## 11. QA requirements

v0.13.1 is not visually accepted merely because CI is green.

Generated TS-01 must be checked for:

- no visible furniture/console intrusion into wall fascia unless deliberately authored;
- visual object and collision still feel aligned;
- Family Table / Memory / Coffee / plants remain compositionally plausible;
- Hologram glow is not given an unnecessarily huge physical blocker;
- PICO cannot enter the actual physical collider;
- door clearances and circulation remain functional;
- rotations do not distort or detach sprite/collision placement.

Only explicit live QA should promote this precision pass to accepted status.
