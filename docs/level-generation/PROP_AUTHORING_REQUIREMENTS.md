# Numberdroid — Prop Authoring Requirements

Status: **binding authoring contract connecting Prop production to Level Compiler / Workbench metadata**

This document defines what must be known about a Prop before it is considered editor-ready. It bridges Art production, `propRegistry.ts`, `LevelSpec.props`, the semantic Workbench and runtime emission.

It does **not** make rendered pixels authoritative for gameplay geometry.

## 1. Authority split

A Prop has four different kinds of truth:

```text
Prop type / reusable spatial semantics
→ src/levelgen/propRegistry.ts

Multipart / non-rectangular collision semantics
→ src/levelgen/propCollisionRegistry.ts

Per-level instance intent
→ LevelSpec.props + semantic Overrides

Presentation asset / shadow / review state
→ src/levelgen/propArtRegistry.ts
```

Do not collapse these into one atlas, PNG, DOM measurement or hand-authored coordinate.

## 2. Required decisions for every new Prop type

Before integrating a new Prop, explicitly decide the following.

### Identity and semantic use

- stable `propId`;
- semantic tags;
- intended room/space tags when restricted;
- placement role when requested in a Level: Hero / Support / Furniture / Dressing;
- whether several instances are expected.

### Visual/runtime attachment

Choose:

```ts
attachment: "floor" | "wall" | "either"
```

Meaning:

- `floor` → normal free-standing `FloorProps` presentation;
- `wall` → mounted to a real Shared-Wall attachment slot and presented as `WallProps`;
- `either` → solver may consider both authored placement modes when the art genuinely supports them.

Do not mark floor-standing furniture as `wall` merely because it should sit near a wall; attachment also carries visual/layer semantics.

### Wall relationship

Current authoring model supports three common cases:

1. **must be mounted on a real wall** → `attachment: "wall"`;
2. **floor-standing but should usually sit near a wall** → `placement.preferWallAdjacent: true`;
3. **wall irrelevant** → no wall preference.

Per-level wall preference is authored via:

```ts
preferredWall: "north" | "east" | "south" | "west"
```

and may be changed by the Workbench as a soft semantic Override.

#### Known current gap: hard floor-standing back-to-wall requirement

The current registry does not yet have a first-class hard rule meaning:

> this remains a FloorProp, but its authored back side must touch a real wall and may not sit in front of a doorway aperture.

This requirement is expected for assets such as some benches, sideboards or beds.

**Binding rule:** when the first Gold-Slice asset actually requires this behavior, extend the compiler/registry with an explicit hard back-to-wall relation before integrating that asset. Do not fake it by changing the visual attachment to `wall` or by relying on a one-off placement lock.

### Rotation authority

Every Prop declares only rotations for which its art is approved:

```ts
allowedRotations: Array<0 | 90 | 180 | 270>
```

Direction convention:

```text
0°   back north · access/front south
90°  back east  · access/front west
180° back south · access/front north
270° back west  · access/front east
```

For wall-mounted Props, wall side determines the required rotation.

For floor Props, the solver enumerates the approved rotations and rotates physical footprint/use-space with the object.

Do not add a rotation merely because CSS/SVG can technically rotate the image. Slight perspective, controls, highlights and service faces may make an unauthored rotation visually invalid.

### Coarse physical footprint

Every Prop declares its deterministic 0° reservation:

```ts
footprintTiles: { w, h }
```

This is the coarse solver anchor/reservation, not necessarily the final visible/collision outline.

90°/270° swap width and height physically.

### Use / approach space

If a user, robot or maintenance process needs unobstructed access in front of the Prop, author:

```ts
approachDepthTiles
```

The approach direction rotates with the Prop's authored front/back convention.

Use-space remains walkable but is unavailable to later furnishing.

Typical examples:

- Coffee Machine;
- Memory Console;
- PRIMUS service bank;
- control/diagnostic station.

### General spacing / clearance

If a Prop needs breathing room around its physical footprint, author:

```ts
clearanceAroundTiles
```

Despite its early Hero use, this field is conceptually a non-furnishable spacing ring and may be used for any Prop when justified.

Examples:

- Transfer Hero machinery;
- a large mechanism with moving/opening parts;
- a furniture piece that needs circulation around all sides.

Do not inflate collision merely to create visual spacing.

### Door / circulation policy

Explicitly decide:

```ts
forbidDoorClearance
forbidPrimaryPath
forbidInFrontOfWallProp
```

A decorative leaf or visual overhang may enter a tile without automatically occupying the usable center of a circulation route; true-space collision/placement rules remain authoritative.

### Placement preferences

Use soft metadata where appropriate:

```text
preferWallAdjacent
preferCorner
preferNearTags
preferRoomCenter
preferOppositeDoor
```

Use explicit `near` links in the LevelSpec when the relationship is to a specific authored Prop instance/request rather than a general type/tag.

### Exact visible and collision geometry

When the coarse tile footprint is materially larger/different than the real object, define:

```ts
exactFit.visualBoundsTiles
exactFit.collisionBoundsTiles
exactFit.placementEnvelope
exactFit.customEnvelopeTiles   // only when required
exactFit.wallBoundary
```

The accepted v0.13.2 contract remains:

```text
Visual Footprint
≠ Coarse Solver Reservation
≠ Collision Footprint
≠ Use Space
```

True-space geometry may receive the minimum valid sub-tile correction beyond its own coarse anchor, provided room surfaces, other true-space Props, reservations and Door Clearance remain valid.

### Collision model

Choose deliberately:

```text
none / decorative
single rectangular collision
multipart collision
```

Use `propCollisionRegistry.ts` for multipart shapes such as the accepted Family Table body + seats.

Rendered alpha is never collision authority.

### Shadow contract

A production Prop normally declares a matching grounding shadow in the Art Registry.

Preferred default:

- same canvas size;
- same anchor;
- `FloorFX` layer;
- no collision;
- no gameplay state.

## 3. Per-level Prop Request decisions

`LevelSpec.props` answers questions that vary by level instance rather than by reusable asset type:

```text
Which Space?
Which role?
How many?
Required or optional?
Near which named Props?
Which wall is preferred in this composition?
```

Do not encode level-specific composition in the reusable Prop Registry.

## 4. What the current Workbench can author

For singleton Props, the current semantic Workbench supports:

- select the generated Prop;
- lock/unlock its current placement;
- valid one-tile nudges;
- `preferredWall` soft Override;
- local deterministic regeneration (`seedSalt`);
- reset Override;
- `WHY BLOCKED?` explanations derived from full-compiler preflight.

The hard lock stores:

```text
Space-relative offset
rotation
wallSide
```

and is validated through the complete compiler. A placement lock is never permission to violate the Prop contract.

## 5. Workbench requirements for Prop production

Before a Prop is considered Level-Editor-ready, a designer inspecting it should be able to determine from metadata/diagnostics:

- Prop type / semantic function;
- attachment mode;
- current resolved wall side;
- all approved rotations;
- current rotation;
- coarse 0° footprint and resolved rotated footprint;
- use/approach depth;
- all-around clearance/spacing;
- Door Clearance policy;
- primary-circulation policy;
- relevant wall/corner/near preferences;
- exact-fit visual/collision envelope status;
- whether collision is single or multipart;
- why a proposed move/placement is invalid.

### Near-term Workbench UI improvement

The current inspector already knows most of this through compiled `PropMetadata`, but it exposes only a subset visually.

The next bounded Workbench UX extension should therefore **surface the Prop Contract read-only** in the inspector and offer explicit rotation editing for eligible floor-standing singleton Props, preflighted through the same full compiler used for movement.

For wall-mounted Props, rotation should remain derived from wall side; the designer changes wall intent rather than independently rotating a mounted object into an impossible orientation.

This UI enhancement must not create a parallel rules engine. The Prop Registry/compiler remains authority.

## 6. Three-variant Art proposal does not alter editor semantics

The Artist may present A/B/C visual variants for a new Prop under `docs/art/production/PROP_ASSET_WORKFLOW.md`.

All three candidates are alternatives for **one semantic Prop Contract**.

Do not assign different collision, footprint or placement semantics merely to make each visual candidate easier to integrate. If a candidate cannot satisfy the agreed authoring contract, reject that candidate or deliberately revise the contract before approval.

## 7. Editor integration checklist

Before registering production art, verify:

```text
[ ] propId exists in propRegistry.ts
[ ] attachment is correct
[ ] allowedRotations match authored art
[ ] footprintTiles matches solver reservation intent
[ ] wall relation is expressible
[ ] approachDepthTiles decided
[ ] clearanceAroundTiles decided
[ ] Door/path policies decided
[ ] exact visual bounds decided when needed
[ ] collision bounds/parts decided
[ ] shadow anchor/canvas decided
[ ] LevelSpec request expresses instance intent
[ ] Workbench current placement round-trips when locked
[ ] invalid edits fail through compiler rather than visual hacks
[ ] propArtRegistry maps only QA-approved production files
```

If any required semantic rule is missing from the authoring model, extend the model before final integration.
