# Numberdroid — Cyclic / Multi-Constraint Topology Solver

Status: **v0.11 topology contract**

This stage extends the original deterministic tree-like geometry placement without replacing the established geometry / Shared Wall Graph pipeline.

```text
SemanticCompilePlan
        ↓
compatibility placement path
        │
        ├─ complete topology valid → keep existing layout
        │
        └─ complete topology invalid
                  ↓
        deterministic multi-constraint search
                  ↓
        final Space rectangles
                  ↓
        existing connection/aperture compiler
                  ↓
        existing Shared Wall Graph
```

The important architectural rule is that **v0.11 changes how Space rectangles are solved, not what downstream geometry means**. Connections are still real shared-boundary apertures. Walls are still canonical shared edges. Navigation, Props, Actors, Triggers and Runtime emission consume the same `GeometryCompilePlan` contract as before.

## 1. Why a second topology path exists

The original v0.1 solver is intentionally simple and very stable:

1. place the first Space as root;
2. attach each new Space to one already placed connected neighbor;
3. use `preferredSide` / spatial relation for initial direction;
4. slide along the shared edge when necessary to avoid overlap.

That model is excellent for tree-shaped graphs, but a later connection can require a Space to touch **two or more already placed Spaces at once**.

Example:

```text
A ─ B
│   │
D ─ C
```

A greedy placement can satisfy `C ↔ D` while accidentally breaking `A ↔ D`. The old solver only discovered that at final connection compilation.

v0.11 treats this as a topology-constraint problem rather than requiring manual coordinates.

## 2. Compatibility-first rule

The new solver is deliberately **not** run for every Level.

The compiler first runs the established incremental placement algorithm. It then validates the **complete authored graph**, including:

- no Space overlaps;
- every authored Connection resolves to a real shared boundary;
- every aperture has enough shared boundary for its width;
- Door Clearance fits;
- every `required` spatial relation is satisfied.

If all of those are true, the original result is retained unchanged and the diagnostic

```text
TREE_COMPATIBLE_TOPOLOGY_PRESERVED
```

is emitted.

This is a binding stability rule. Adding a more powerful solver must not reroll TS-01 or another already-valid Level merely because more alternatives now exist.

Only when the complete graph fails does the compiler emit

```text
MULTI_CONSTRAINT_FALLBACK_USED
```

and invoke deterministic search.

## 3. Hard constraints

The fallback solver treats the following as hard constraints.

### Space overlap

Two semantic Space rectangles may touch at boundaries but may not overlap in floor area.

### Every authored Connection

As soon as both endpoints of a Connection have been placed, they must share a real boundary whose length is at least `widthTiles`.

A Connection is therefore not a vague proximity request. It remains a real architectural adjacency.

### `required` spatial relations

A relation with

```ts
strength: "required"
```

must hold in the final solution.

Directional relations use the centers of non-overlapping Space rectangles as their sector test:

```text
north_of       center is north
south_of       center is south
east_of        center is east
west_of        center is west
north_east_of  center is in the NE sector
north_west_of  center is in the NW sector
south_east_of  center is in the SE sector
south_west_of  center is in the SW sector
adjacent       a real shared boundary exists
```

This center-sector interpretation preserves the earlier LevelSpec meaning of diagonal relations as compositional direction/alignment, rather than requiring a fully separated diagonal gap.

Mutually impossible `required` relations fail compilation. The solver must not silently downgrade them.

## 4. Soft constraints / scoring

The following remain preferences rather than hard requirements:

- `Connection.preferredSide`;
- relations with `strength: "preferred"` or omitted strength;
- preferred `TileRange` dimensions;
- minimum slide away from the natural alignment.

Candidate ranking favors, in order of intent rather than an externally guaranteed numeric weight:

1. preferred connection side;
2. preferred dimensions;
3. satisfied preferred relations;
4. small alignment slides;
5. deterministic semantic sub-seed tie-break.

A preferred relation that cannot be satisfied without breaking hard constraints is allowed to lose and produces:

```text
PREFERRED_SPATIAL_RELATION_UNSATISFIED
```

The final plan also records an aggregate `SPATIAL_RELATIONS_EVALUATED` diagnostic.

## 5. TileRange becomes a real solve range

The original tree path intentionally uses only the authored `preferred` size.

The fallback solver may enumerate integer dimensions inside:

```text
min → preferred → max
```

with the preferred value tried first and increasing deviation tried later.

This matters for cycles. A room may need one extra tile of width so two different apertures can both obtain enough shared boundary.

If the fallback selects a non-preferred size it emits:

```text
SPACE_SIZE_ADJUSTED_FOR_CONSTRAINTS
```

with the preferred and solved dimensions.

The same principle applies to corridor width/length ranges.

This does **not** mean the solver randomly resizes rooms. Preferred dimensions remain dominant; range variation exists only to make authored constraints satisfiable.

## 6. Deterministic search

The fallback is a bounded deterministic backtracking search.

At every step it selects an unplaced Space that already has at least one placed Connection neighbor. More constrained Spaces are considered first:

- more already-resolved required relations;
- more already-placed Connection neighbors;
- higher Connection degree;
- stable semantic authoring order as final tie-break.

For that Space it generates candidates from every already-placed connected neighbor, not just the first one.

For each anchor Connection it enumerates:

- preferred dimensions before alternative TileRange dimensions;
- preferred side first, then the other cardinal sides;
- zero slide first, then deterministic `-1, +1, -2, +2 ...` offsets.

Every candidate is immediately rejected if it violates any hard constraint involving already placed Spaces.

If a later Space cannot be placed, search backtracks to an earlier candidate.

## 7. Search bound

The solver is deliberately bounded. It does not promise to explore an unbounded combinatorial layout universe.

The current maximum deterministic search budget is:

```text
max(50,000, numberOfSpaces × 5,000) search nodes
```

Exceeding the budget fails loudly rather than freezing the editor/runtime build.

The diagnostic

```text
MULTI_CONSTRAINT_TOPOLOGY_SOLVED
```

records:

- graph cycle rank;
- search-node count;
- backtrack count.

These values are useful later in the Performance & Scale Pass and Workbench diagnostics.

## 8. Seed stability

The solver never consumes one mutable global PRNG stream.

Deterministic tie-breaking is derived from the stable semantic Space seed plus candidate identity:

```text
space semantic seed
+ candidate rectangle
→ deterministic tie-break
```

This means unrelated random calls elsewhere cannot reroll topology.

The higher-level stability rule remains stronger: if the old tree-compatible result already satisfies the complete topology, v0.11 does not search at all.

## 9. Interaction with Overrides

Existing geometric offsets are still applied after base topology placement, then the complete geometry is validated again.

An Override that destroys a required Connection or required relation therefore still fails.

The later Workbench/Overrides block should evolve this into a constraint-aware editing model where locked geometry participates directly in the search rather than relying on destructive post-solve offsets.

v0.11 does not pretend that future editing system already exists.

## 10. Tests / reference proofs

v0.11 regression coverage proves:

### Existing TS-01 stability

The exact established TS-01 rectangles remain unchanged and the fallback is not invoked.

### Cyclic aperture closure + size adaptation

A three-Space cycle requires one room to touch two already placed rooms with different aperture-width requirements. Its preferred `6×4` footprint cannot satisfy both; `7×4` can. The solver selects the smallest valid deviation and all three Connections compile.

### Required relation beats preferred side

A Connection may prefer the east side while a `required west_of` relation requires the opposite composition. The hard relation wins; `preferredSide` remains a preference.

### Contradictory requirements fail

A Space cannot simultaneously be `required east_of` and `required west_of` the same target. Compilation fails instead of choosing one arbitrarily.

## 11. Current limitations

v0.11 is deliberately not a general-purpose CAD optimizer.

Current boundaries include:

- rectangular Space footprints only;
- integer tile geometry;
- the first semantic Space remains the topology root;
- visual/rationality-specific objective weights are still simple global scoring rules;
- post-solve offset Overrides are not yet first-class locked constraints;
- no Workbench interactive constraint editing yet;
- large highly connected graphs still need the final Performance & Scale Pass.

These are explicit extension points, not reasons to reintroduce hand-authored raw coordinates.
