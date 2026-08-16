# Numberdroid — Exact Prop Fit / True-Space Prop Geometry

Status: **v0.13.2 accepted precision contract — LIVE QA ACCEPTED 2026-08-16**

Acceptance record: `V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`.

v0.13 connected solved semantic Props to real production art. v0.13.1 introduced explicit visual/collision/placement envelopes and wall-surface fitting. Live QA then exposed a deeper mistake in the first precision model: treating the coarse integer tile anchor as a mandatory containment box for final true object space.

v0.13.2 corrects that model.

```text
semantic Prop request
      ↓
coarse deterministic tile solve
  footprintTiles / reservations
      ↓
rotation-aware solved anchor rectangle
      ↓
EXACT / TRUE-SPACE FIT
  visual bounds
  collision parts
  placement envelope
  visible/collision wall surfaces
      ↓
minimum sub-tile translation
      ├─ production sprite
      ├─ grounding shadow
      └─ runtime collision parts
      ↓
validation against
  room surfaces
  other Prop true-space envelopes
  foreign use-space / Hero clearance
  Door Clearance
```

The coarse tile footprint remains essential, but it is a **solver anchor/reservation**, not necessarily the final world-space silhouette.

## 1. Why several spatial representations are necessary

One rectangle cannot correctly own deterministic placement, visible shape, physical collision and interaction space at the same time.

### `footprintTiles`

Coarse deterministic solver geometry.

It is used for:

- candidate enumeration;
- deterministic placement identity;
- coarse Prop-vs-Prop tile reservations;
- navigation safety;
- Door Clearance interaction during tile placement;
- approach/use-space generation;
- Actor/path placement dependencies.

It deliberately remains conservative and grid-aligned.

### `visualBoundsTiles`

The meaningful visible object envelope inside the authored 0° source canvas.

This is **not automatically the PNG canvas border**. Transparent padding, glow, particles and presentation-only overhang must not accidentally become gameplay geometry.

### collision geometry

Physical collision may be represented either by:

- one `collisionBoundsTiles` rectangle for ordinary Props; or
- multiple source-local collision parts from `propCollisionRegistry.ts` when a single AABB would create implausible invisible blockage.

The Family Table is the canonical multipart example: table body plus four seat modules, while gaps between seats remain open.

### `placementEnvelope`

The true-space envelope used for composition/fitting and downstream separation checks.

Allowed policies:

```text
visual
collision
custom
```

Examples:

```text
large visible furniture / wall console
→ placementEnvelope = visual

small hologram with decorative glow
→ placementEnvelope = collision
```

### use-space / Hero clearance

Approach/use-space and Hero clearance remain separate reservations.

They describe where another body/Prop should not be placed because the object needs operating/compositional breathing room. They are not the object's own physical volume.

## 2. Authored coordinate system

Visual bounds, collision bounds/parts and custom placement envelopes are authored in **0° source-local tile units** inside the Prop's authored source canvas represented by `footprintTiles`.

Example:

```ts
footprintTiles: { w: 3, h: 2 },
exactFit: {
  visualBoundsTiles: { x: 0.12, y: 0.12, w: 2.76, h: 1.76 },
  placementEnvelope: "visual",
  wallBoundary: "visual",
}
```

These values are semantic spatial metadata.

They are **not** read back from:

- DOM layout;
- browser image dimensions;
- PNG alpha;
- transparent canvas extents;
- rendered pixels.

The current metadata validator requires source-local bounds and collision parts to be valid positive rectangles inside the authored 0° source canvas. That source-local containment must not be confused with final world-space containment inside the coarse solved anchor.

## 3. Rotation

Exact-fit local bounds rotate with the same cardinal Prop rotation as the solved footprint.

```text
0°   → authored bounds unchanged
90°  → quarter-turn
180° → half-turn
270° → inverse quarter-turn
```

Rotation occurs around the center of the authored 0° Prop canvas, matching the v0.10/v0.13 sprite-placement contract.

All collision parts rotate independently before their world-space union is calculated.

The production sprite keeps its authored 0° dimensions and is rotated around its center. It is not stretched to an already-rotated AABB and then rotated again.

## 4. Two wall surfaces

Generated walls have two intentionally different physical/presentation thicknesses:

```text
visible fascia      30 px Gold Slice baseline
collision core      10 px Gold Slice baseline
```

Both are centered on the canonical Shared Wall Graph line.

For a room-facing surface:

```text
wall centerline
      │
      ├── ±5 px   collision surface
      └── ±15 px  visible fascia surface
```

`wallBoundary` selects which room interior the placement envelope must respect:

```ts
wallBoundary: "visual" | "collision"
```

Typical policies:

```text
large furniture / visible wall console
placementEnvelope = visual
wallBoundary       = visual

small hologram pedestal with glow
placementEnvelope = collision
wallBoundary       = collision
```

Physical collision is always constrained by the room's collision surface even when another envelope policy is used for visual/compositional fitting.

## 5. Coarse wall contact and wall hints

`placement.wallSide` may record an attachment, touched wall or placement preference. It must never by itself drag an already-safe object toward a wall.

The coarse solved anchor is used to determine which containing-room boundaries it actually touches. Corner Props may therefore touch two walls and must satisfy both room surfaces simultaneously.

The v0.13.2 correction uses the **minimum displacement necessary** to make the true-space geometry valid. Preferred offset is zero: if the authored coarse placement is already safe, no correction occurs.

## 6. v0.13.2 true-space rule — supersedes old coarse-anchor containment

The old v0.13.1 rule said that the final placement envelope/collision must remain inside the already-solved tile rectangle. Live QA proved this was too strong.

Binding v0.13.2 rule:

> `footprintTiles` / `placement.rect` is the deterministic coarse anchor and reservation. Final true-space geometry may cross its own coarse anchor boundary after a small Exact-Fit translation, provided it remains valid against the complete downstream spatial contract.

Allowed final translation must satisfy:

- all physical collision parts remain inside the containing room's **collision interior**;
- placement envelope remains inside the selected visual/collision room surface;
- when `wallBoundary: "visual"`, declared visual bounds remain inside the visible room interior;
- true-space placement envelopes of Props in the same Space do not overlap;
- the translated envelope does not consume another Prop's approach/use-space or Hero-clearance reservation;
- the translated envelope does not enter Door Clearance.

The object may therefore cross **its own coarse anchor**, but it may not steal space that the compiler already reserved for another semantic responsibility.

This preserves deterministic tile solving while allowing the final visual/physical object to align correctly with thick presentation surfaces.

## 7. Shared translation

Exact Fit returns one sub-tile translation:

```text
offsetPx = { x, y }
```

The same translation is applied to:

- visible Prop sprite;
- grounding shadow;
- every runtime collision part;
- the placement envelope used for final validation.

Art and collision must never receive independent ad-hoc wall corrections.

Compiler/Tiled/runtime debug data should retain enough information to diagnose the final translation and emitted collision.

## 8. Pairwise and reservation validation

`computePropExactFit()` resolves one Prop against its containing-room surfaces.

`compileAndValidatePropExactFits()` then validates the complete furnished Space because only the complete plan can know all translated true-space envelopes at once.

Permanent validation includes:

- pairwise placement-envelope overlap within one Space;
- foreign Prop use-space/Hero-clearance conflicts;
- Door Clearance conflicts.

Touching boundaries are allowed; positive-area intersection is not.

This validation is compile-time authoring work, not a runtime per-frame collision system.

## 9. Non-rectangular collision

A production object's collision should represent physically meaningful mass rather than automatically filling its complete visual rectangle.

Detailed collision parts live in `src/levelgen/propCollisionRegistry.ts` and rotate/translate with the Prop.

Canonical current proofs:

### Family Table

- central table body;
- north seat module;
- south seat module;
- west seat module;
- east seat module;
- gaps between seating remain physically open.

### Transfer Hologram

The visible/glow envelope may be larger than the actual pedestal, but the pedestal collider is **0.70 × 0.70 tiles** so PICO cannot drive over the visible base.

PNG alpha remains non-authoritative in both cases.

## 10. Spatial Registry vs Art Registry

The v0.13 registry split remains binding.

### Spatial Prop Registry

Owns:

- coarse footprint;
- allowed rotations;
- placement rules;
- visual/collision/custom source-local envelopes;
- placement-envelope policy;
- wall-surface policy.

`propCollisionRegistry.ts` extends this spatial contract for multipart physical silhouettes.

Changing these facts may change runtime collision/composition and therefore requires spatial/gameplay QA.

### Prop Art Registry

Owns:

- runtime image asset;
- optional grounding shadow;
- visual review status (`accepted` / `candidate`).

Replacing or registering a PNG does not automatically redefine physical geometry.

If new art demonstrates that the current spatial metadata is wrong, update the spatial contract deliberately and re-run its QA; never infer new collision from pixels automatically.

## 11. Current TS-01 policy

Current production-mapped Props use explicit spatial policy:

- Family Table: visible envelope respects visible wall surface; multipart collision;
- Family Memory Console: visible envelope respects visible wall surface; smaller physical collision;
- Coffee Machine: visible envelope respects visible wall surface; smaller physical collision;
- Round Plant: visible envelope respects visible wall surface; smaller physical body;
- Planter Trough: physical planter envelope drives placement while foliage may visually overhang; visible wall boundary still protected;
- Transfer Hologram: collision/pedestal envelope drives placement against collision surface; 0.70 × 0.70 physical pedestal.

Unregistered/blockout Props remain conservative until their production art and spatial contract are reviewed.

Their fallback **visual** rectangles are separately clipped/inset to the visible room interior so provisional presentation cannot bleed through the accepted wall fascia.

## 12. Runtime and performance boundary

Exact Fit is compiled once.

It adds no:

- per-frame geometry solving;
- DOM measurement;
- image-alpha analysis;
- React collision reconstruction;
- MutationObserver behavior.

Runtime receives ordinary precomputed obstacle rectangles plus positioned/rotated sprites.

## 13. Acceptance and future QA

The v0.13.2 Exact-Fit/true-space stabilization was explicitly accepted in deployed/generated TS-01 on **2026-08-16**.

Permanent regression/live-QA requirements remain in `GOLD_SLICE_REGRESSION_GATES.md`.

Acceptance of this spatial system is distinct from art acceptance. Current candidate Coffee/Planter/Round Plant/Hologram art remains candidate until separately promoted by explicit Art-Director QA.

Do not reopen the accepted true-space model merely to solve the next art-production task. New production assets should supply reviewed spatial metadata and consume this existing contract.
