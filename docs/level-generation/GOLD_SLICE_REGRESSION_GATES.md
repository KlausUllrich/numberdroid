# Numberdroid — Gold Slice Regression Gates

Status: **v0.13.2 LIVE QA ACCEPTED on 2026-08-16; permanent regression / merge gate onward**

Acceptance record: `V0132_STABILIZATION_ACCEPTANCE_2026-08-16.md`.

This document exists because the v0.13.1 live QA exposed regressions that passed normal compile/build CI:

- production Props visually entered the accepted 30 px wall fascia;
- the Family Table used an implausible single rectangular collider;
- the Hologram collider was too small;
- fallback Prop stubs bled into walls;
- a generated PRIMUS patrol used perimeter cells and visually drove into the wall;
- compiler-generated TS-01 silently fell back to generic Door presentation/timing.

The repository **was** being committed, pushed, tested and merged regularly. The incident was not lost source control. It exposed two missing contracts:

1. an accepted Gold Slice behavior was scoped to one concrete Floor ID instead of a reusable presentation contract;
2. the first Exact-Fit model incorrectly assumed that true object space must remain contained by its coarse integer tile anchor.

Both are now explicit regression classes. The v0.13.2 implementation was merged in PR #79 and the deployed/generated pass was explicitly accepted by Klaus on 2026-08-16.

## 1. Source-control / acceptance distinction

These states must never be conflated:

```text
committed / pushed
        ≠
CI green
        ≠
merged
        ≠
deployed
        ≠
live visual/gameplay QA accepted
```

v0.13.2 has crossed the final live-QA gate for the current stabilization baseline. Future changes touching these contracts must pass the same regression discipline again.

## 2. Door invariant

Hand-authored `transfer-hall` and compiler-generated `ts01-transfer-hall` use the same Gold Slice Door presentation contract.

Binding values:

- visible wall fascia: 30 px;
- wall collision core: 10 px;
- moving Door leaf: 5 px;
- open duration: 520 ms;
- soft close duration: 650 ms;
- moving leaves are clipped to the aperture and retract into the wall/pocket;
- Gold Slice Door rendering is below the appropriate foreground wall treatment rather than the generic z-index-16 presentation.

Do not reintroduce a parent selector such as:

```text
[data-floor-id="transfer-hall"]
```

as the only authority for accepted Door behavior. Generated and hand-authored Gold Slice Floors must share a reusable presentation selector/contract.

## 3. Coarse Prop anchor vs true object space

`footprintTiles` is the deterministic **coarse solver anchor/reservation**, not necessarily the final world-space silhouette or mandatory containment box.

The precise spatial model is:

```text
coarse tile anchor
        ↓
source-local explicit metadata
  visual bounds
  collision parts
  placement envelope
        ↓
cardinal rotation
        ↓
minimum sub-tile correction
        ↓
true world-space object geometry
```

Source-local bounds remain authored inside the 0° source canvas. After rotation, a precise world-space envelope may cross its own coarse anchor boundary when needed to clear wall fascia. That is allowed only if the translated result remains valid against:

- containing-room surfaces;
- other Prop true-space envelopes;
- foreign approach/use-space or Hero-clearance reservations;
- Door Clearance.

PNG alpha, transparent canvas size and DOM measurements remain non-authoritative.

## 4. Prop wall-safety invariant

For every production-mapped Prop:

- physical collision must remain outside the 10 px wall collision core;
- a Prop configured with `wallBoundary: "visual"` must keep its declared visual envelope outside the 30 px visible wall fascia;
- corner Props must satisfy both touched wall surfaces simultaneously;
- an already safe authored placement must not be snapped toward a wall merely because a `wallSide` preference exists.

The correct correction is the **smallest displacement necessary** to restore the declared surfaces.

## 5. Non-rectangular collision invariant

A visually non-rectangular object does not automatically receive one large rectangular collider.

The Family Table is the canonical proof:

- central table body is physical;
- four seat modules are physical;
- gaps between seats are not silently filled by one invisible 3×2 rectangle.

Detailed collision is authored spatial metadata in `propCollisionRegistry.ts`, not inferred from image alpha.

## 6. Hologram invariant

The Hologram may use a visual envelope larger than its physical pedestal, but its physical collider must be large enough that PICO cannot drive over the visible base.

Current accepted stabilization baseline: a **0.70 × 0.70 tile** pedestal collider inside the 1×1 source canvas.

## 7. Fallback blockout invariant

Unmapped production Props may remain semantic stubs, but their rendered fallback rectangles must be clipped/inset to the containing room's **visible interior**. A placeholder is not allowed to bleed through the 30 px wall fascia merely because its coarse tile anchor touches a boundary.

Blockouts remain provisional presentation and are replaced by registered production art without changing the semantic Prop identity.

## 8. Actor / Patrol wall-safety invariant

Do not globally enlarge standard Robot collision merely to solve a generated route problem; PICO and Door traversal depend on shared Robot metrics.

For sufficiently large **single-room patrol routes**:

- prefer free navigation cells at least one full tile from the room perimeter;
- generated PRIMUS Sentry patrols must therefore not use room-edge cells when a connected interior exists;
- tiny rooms and multi-space/portal routes retain the normal fallback where edge cells may be structurally necessary.

This keeps the accepted 52 px standard Robot sprite visually clear of the 30 px fascia without changing global collision semantics.

## 9. Required automated coverage

Before merge, CI must protect at least:

- both Gold Slice Floor IDs use the accepted Door contract;
- Door timing constants remain 520 / 650 ms;
- generated TS-01 PRIMUS patrol remains in the safe interior;
- Family Table emits multiple runtime collision objects through Tiled/FloorDefinition;
- Hologram emits the intended physical pedestal size;
- Exact Fit corner behavior handles two room surfaces;
- generated TS-01 exact envelopes do not overlap other Props / foreign reservations / Door Clearance;
- fallback blockout SVGs identify/use wall-safe visible-interior rendering.

These tests remain permanent after v0.13.2 acceptance.

## 10. Required live QA after future shared-contract changes

For changes touching any shared spatial/presentation contract, inspect generated TS-01 live before accepting the revision:

1. Family Table / seating and wall clearance;
2. Memory Console / Coffee / Plants against wall fascia;
3. Hologram player collision;
4. unmapped stubs at wall edges;
5. PRIMUS Sentry patrol around the room;
6. Door leaf layering/retraction;
7. Door open/close feel, especially the 650 ms soft close.

Do not reopen the accepted stabilization baseline without a concrete defect or a deliberate contract change.

## 11. Current acceptance and next step

The v0.13.2 stabilization block is **LIVE QA ACCEPTED**.

This acceptance does not automatically promote `LIVE_CANDIDATE` art to `LIVE_ACCEPTED`; art review state remains owned by the Art Registry/recipes and explicit Art-Director acceptance.

The active next block is **Generated TS-01 feature/art parity and Gold Slice production assets**. Accepted Walls, Doors and already accepted Family assets remain frozen while missing Transfer/Flow/PRIMUS and useful domestic production art is added through the existing compiler/composite pipeline.
