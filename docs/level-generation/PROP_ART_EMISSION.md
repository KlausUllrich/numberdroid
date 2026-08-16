# Numberdroid — Prop / Art Emission

Status: **v0.13 presentation contract + v0.13.2 accepted true-space integration; Generated TS-01 Art Parity CURRENT**

v0.13 connects solved semantic Prop placement to registered runtime art without making pixels authoritative for gameplay. v0.13.2 stabilizes the spatial precision layer consumed by that presentation path.

```text
LevelSpec Prop request
        ↓
Spatial Prop Registry
  attachment / allowed rotations / coarse footprint
  placement / use-space / Hero clearance
  true-space visual/collision/placement metadata
        ↓
rotation-aware Prop solver
  deterministic coarse anchor/reservations
        ↓
Exact / True-Space Fit (v0.13.2)
  minimum sub-tile correction
  room / Prop / reservation / Door validation
        ↓
Prop Art Registry
  asset / optional shadow / review status
        ↓
ordered composite Floor visual
        ↓
existing runtime
```

Central rule:

> **Art consumes authored/solved geometry. Raw image pixels never define collision, reachability or placement validity.**

## 1. Spatial Registry and Art Registry have different authority

### Spatial Prop Registry

`src/levelgen/propRegistry.ts` owns gameplay/authoring facts such as:

- semantic Prop ID/tags;
- floor/wall attachment;
- allowed rotations;
- authored 0° coarse `footprintTiles`;
- approach/use-space and Hero clearance;
- navigation / Door Clearance restrictions;
- placement preferences;
- source-local visual/collision/custom envelopes;
- placement-envelope and wall-surface policies.

`src/levelgen/propCollisionRegistry.ts` owns optional multipart physical collision for Props whose physical silhouette should not be one filled rectangle.

Changing spatial metadata can change emitted collision/composition and therefore requires spatial/gameplay regression and live QA.

### Prop Art Registry

`src/levelgen/propArtRegistry.ts` owns presentation only:

- runtime art asset;
- optional grounding shadow;
- art-review status: `accepted` or `candidate`.

Adding/replacing an art registration must **not** reroll placement or infer new collision from PNG dimensions/alpha.

If new art exposes wrong spatial metadata, update the spatial contract separately and deliberately.

## 2. v0.13.2 true-space integration

The old v0.13.1 assumption that final exact geometry must remain inside its own coarse tile anchor is superseded.

Binding current behavior:

- the coarse solved tile rectangle remains deterministic placement identity/reservation;
- source-local visual bounds/collision parts/placement envelopes remain explicit metadata;
- Exact Fit may apply the minimum sub-tile translation beyond the object's own coarse anchor when necessary;
- translated collision remains inside room collision surfaces;
- selected visual/placement envelopes remain inside their chosen room surfaces;
- same-space true-space placement envelopes may not overlap;
- translated envelopes may not steal foreign use-space/Hero reservations or Door Clearance;
- the **same translation** is applied to production sprite, shadow and collision parts.

See `PROP_EXACT_FIT.md`, `GOLD_SLICE_REGRESSION_GATES.md` and `V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`.

## 3. Current TS-01 mappings

### Accepted art

- `family-table` → Family Table + grounding shadow;
- `family-memory-console` → Family Memory Console + grounding shadow.

### Candidate art

Mapped for integrated evaluation but still explicitly `candidate`:

- `coffee-machine`;
- `planter-trough`;
- `plant-round`;
- `transfer-hologram` / Hologram Pedestal.

The v0.13.2 PASS confirms stable spatial/runtime integration around these assets. It does **not** promote their visual status.

### Current blockout fallback / missing production art

Props without an Art Registry entry continue to render as semantic blockouts. Current TS-01 examples include:

- Child Bed;
- Toy Storage;
- Toilet;
- Transfer Core / apparatus;
- Flow Station;
- PRIMUS Service Bank.

A partially art-mapped Level remains playable and inspectable. Progressive replacement of these blockouts is the current Gold Slice production workflow.

## 4. Composite runtime visual

`FloorVisualDefinition` supports:

```ts
{
  kind: "composite",
  layers: [...]
}
```

Existing `image` and `tilemap` Floors remain unchanged.

Generated TS-01 explicit render order:

```text
Ground
→ FloorFX / grounding shadows
→ Architecture
→ WallProp blockout fallback
→ WallProps production art
→ FloorProp blockout fallback
→ FloorProps production art
```

Characters, Doors and other live runtime entities remain outside the static Floor composite and keep their established runtime systems/layering.

This preserves the art-direction hierarchy:

```text
Ground → FloorFX → Architecture → WallProps → FloorProps → Characters → LightOverlay / UI
```

## 5. Why production PNGs remain separate sprites

v0.7.1 intentionally collapsed generated geometry into static imagery instead of hundreds of React tile nodes.

Production Props remain ordinary public PNG assets because embedding them inside a data-URL blockout SVG would:

- mix generated geometry and production art authority;
- complicate asset/base-path handling;
- make progressive replacement/registry status less explicit.

The composite visual therefore keeps static generated Ground/Architecture and adds only a small number of positioned production sprites/shadows.

## 6. Rotation and authored dimensions

Binding rule:

```text
authored source canvas = 2×1
solver rotation        = 90°
coarse solved rect      = 1×2
runtime image           = authored 2×1 dimensions, centered and rotate(90°)
```

Do **not** resize a source to the already-rotated AABB and then rotate again.

The runtime:

1. retains authored 0° image dimensions;
2. centers them on the solved/true-space position;
3. applies the v0.13.2 Exact-Fit translation;
4. rotates around the image center.

The same rule applies to grounding shadows.

## 7. WallProps vs FloorProps

Visual layer classification comes from authored attachment semantics:

```ts
request.metadata.attachment
```

It must not be inferred merely from `placement.wallSide`.

A floor-attached Prop may touch/prefer a wall and still remain a FloorProp. `wallSide`/touched walls may affect spatial fitting without changing presentation category.

## 8. Shadows / FloorFX

If an Art Registry entry contains `shadowAsset`, emission creates a separate stable sprite:

```text
shadow:<placement-id>
```

The shadow uses the same authored dimensions, rotation and Exact-Fit translation as the visible Prop and renders in FloorFX before Architecture.

Grounding shadows remain separate from:

- physical collision;
- Prop visual silhouette;
- scene illumination.

Future explicit shadow overhang/offset metadata may be added only when a concrete production asset proves the need.

## 9. Fallback blockout safety

Unregistered semantic Props still receive fallback presentation, but v0.13.2 requires the fallback visual rectangle to be clipped/inset to the containing room's **visible interior**.

A provisional stub is not allowed to bleed through the accepted 30 px wall fascia just because its coarse tile anchor touches a room boundary.

Fallback presentation does not redefine the Prop's semantic/spatial identity.

## 10. Art status is not acceptance

`status: "candidate"` means only that an asset is available for integrated visual evaluation.

It does not mean:

- source/production visual QA is final;
- the image is promoted to the Gold Slice baseline;
- Generated TS-01 has reached complete art parity.

Only explicit user/Art-Director acceptance may promote a candidate.

Similarly:

```text
v0.13.2 spatial PASS
≠
Batch 2 visual acceptance
```

## 11. Runtime safety / performance boundary

The Prop Art Registry and composite presentation layer do not independently alter:

- Walkable cells;
- Shared Wall topology/collision;
- Door apertures;
- Encounter placement;
- Trigger/Event programs;
- script state;
- route geometry.

True-space collision refinements come only from reviewed spatial metadata.

No DOM measurement, image alpha, browser sprite bounds or MutationObserver participates in gameplay geometry.

Presentation preserves the v0.7.1 performance strategy:

- one static Ground image;
- one static Architecture image;
- small fallback blockout images only where needed;
- one DOM image per registered Prop/shadow;
- Exact Fit is compile-time arithmetic, not per-frame work.

## 12. Permanent tests / regression expectations

Coverage must protect at least:

- ordered composite visual;
- registered assets in intended layers;
- grounding shadows before Architecture;
- blockout fallback for unmapped Props;
- authored-size non-square sprite rotation;
- accepted 30 px fascia / 10 px collision wall relationship;
- v0.13.2 true-space wall/corner fitting;
- pairwise true-space Prop separation;
- foreign reservation / Door Clearance protection;
- multipart Family Table collision;
- Hologram 0.70 × 0.70 physical pedestal;
- wall-safe fallback rendering.

See `GOLD_SLICE_REGRESSION_GATES.md` for the permanent Gold Slice gate.

## 13. Current next step — Art Parity

v0.13.2 is LIVE QA ACCEPTED. Do **not** spend the next block trying to re-prove v0.13.1 containment or reopen the spatial system by default.

Current production sequence:

1. Transfer Apparatus / Core hero;
2. Flow support + justified FloorFX grounding/path;
3. PRIMUS hero/system wall object / Service Bank presentation;
4. useful domestic replacements (Child Bed / Toy Storage / Hygiene) where they materially improve the room;
5. final cohesion/use-wear/light support;
6. complete generated-room Art-Director QA on desktop and phone.

New production art should register against the existing semantic Props. Only if an asset genuinely exposes a wrong physical/composition contract should spatial metadata change in a separate reviewed step.

The generated Floor may replace the hand-authored reference only after explicit final feature/art/gameplay parity acceptance.
