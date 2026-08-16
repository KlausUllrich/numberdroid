# Family Props Batch 2 — LIVE_CANDIDATE

Status: **`LIVE_CANDIDATE` — source art remains provisional; generated v0.13.2 spatial/runtime integration accepted on 2026-08-16; final visual Art-Director promotion still pending**.

This batch contains four isolated ND Shallow Top-Down concepts: two plant types, a Coffee Machine and a Hologram Pedestal. Source art remains unchanged during level-design/art-parity work.

The assets follow `docs/game-design/LEVEL_DESIGN_RULES.md`, `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md` and the accepted v0.13.2 true-space contract.

## Binding visual rule

All four props use the established **ND Shallow Top-Down** language. Interesting information remains on horizontal/top surfaces; no asset depends on a readable frontal wall face. Every prop remains a transparent isolated runtime asset with a separate `FloorFX` grounding shadow.

No gameplay interaction, pickup, resource or story semantics are introduced by this batch.

## Review-state clarification after v0.13.2

The v0.13.2 PASS means the generated room can place/render/collide with these assets under the accepted wall/true-space/door contracts without reopening the spatial system.

It does **not** mean these four images are visually final.

They remain `LIVE_CANDIDATE` until Klaus explicitly accepts their appearance in the completed Gold Slice composition.

## Semantic generated placement intent

The canonical generated TS-01 authoring no longer depends on the hand-authored raw coordinates below. `src/levelgen/specs/ts01.ts` expresses the current intent semantically:

- Coffee Machine → Family Living support Prop, preferred north wall;
- Planter Trough → Child Room dressing, preferred west wall;
- Round Plant → Family Living dressing, preferred south/edge placement under global plant rules;
- Hologram → Transfer support Prop near the Transfer Core.

The solver, true-space Exact Fit and permanent regression gates own the actual generated world placement.

## Hand-authored Layout-v3 reference coordinates

The following coordinates remain useful as the earlier hand-authored composition reference. They are **not** the canonical generated LevelSpec authoring language.

### Coffee Machine

Upper living-room wall; access from below; no plant may obscure it.

```text
Prop GIDs:        177–178 on WallProps
Reference:        col 5,row 1; 1×2
Shadow GIDs:      179–180 on FloorFX
Runtime asset:    /assets/deck/family-coffee-machine.png
```

### Planter Trough

West edge of the child-room/domestic pocket, genuinely wall-adjacent rather than floating in open floor.

```text
Prop GIDs:        181–182 on FloorProps
Reference:        col 1,row 9; 1×2
Shadow GIDs:      183–184 on FloorFX
Runtime asset:    /assets/deck/family-planter-trough.png
```

### Round Plant

Living-room edge support object. The old hand-authored Layout-v3 reference moved it away from the hygiene doorway approach.

```text
Prop GID:         185 on FloorProps
Reference:        col 6,row 6
Shadow GID:       186 on FloorFX
Runtime asset:    /assets/deck/family-round-plant.png
```

### Hologram Pedestal

Transfer support object close to the hero cluster but away from Hall/PRIMUS thresholds.

```text
Prop GID:         187 on FloorProps
Reference:        col 10,row 16
Shadow GID:       188 on FloorFX
Runtime asset:    /assets/deck/family-hologram-pedestal.png
```

## Current generated physical contract

Spatial authority now lives in `src/levelgen/propRegistry.ts`, `propCollisionRegistry.ts` and v0.13.2 Exact Fit rather than these old map-coordinate rectangles.

Important current rules:

- Coffee / plants use explicit source-local visual/collision envelopes and wall policies;
- Hologram pedestal collider is **0.70 × 0.70 tiles**;
- final true-space geometry may receive the minimum sub-tile correction beyond its own coarse anchor while remaining valid against room surfaces, other Props, foreign reservations and Door Clearance;
- sprite, shadow and collision share the same Exact-Fit translation.

PNG alpha does not define physical geometry.

## Source/material integrity

Accepted source chunks, byte counts, hashes and runtime PNG dimensions are unchanged. `npm run materialize-art` remains the integrity gate.

## Final visual QA gate

Judge these candidates only in the increasingly complete generated Gold Slice:

- Coffee Machine remains wall-backed and accessible from below;
- Planter reads as intentional domestic edge furnishing;
- neither plant obscures wall furniture, doorway approach or circulation;
- Round Plant supports the living-room edge rather than becoming isolated clutter;
- Hologram clearly belongs to the Transfer hero/support cluster;
- all four shadows remain visually aligned;
- scale/material/perspective remain coherent with accepted Family Table/Memory Console and the new Transfer/PRIMUS hero assets;
- desktop and phone readability remain good.

Do not mark Batch 2 `LIVE_ACCEPTED` merely because v0.13.2 spatial stabilization passed. Final promotion remains an explicit Art-Director decision.
