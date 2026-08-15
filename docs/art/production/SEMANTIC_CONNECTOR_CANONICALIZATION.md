# Semantic Connector Canonicalization

Status: **binding reusable post-processing rule for modular Numberdroid art**

This document closes a gap in the Controlled Art Pass: `Connector Guard Zones` previously described what modular edges must look like, but not a deterministic mechanism for making generated/material edges interchangeable.

## Core rule

For modular assets, generated material never owns the final connector pixels.

After structural-mask restoration, every connectable edge is assigned to a **named semantic connector class**. Members of one class must be interchangeable in the authored map.

Do not infer production connector identity from appearance alone.

## Canonicalization algorithm

For each named connector class:

1. collect the relevant edge strips from every member;
2. compute one canonical strip using the **per-pixel median** across members;
3. replace the actual boundary with the canonical strip;
4. blend from the canonical edge back toward the tile's own material over an approximately 8–12 px ramp at 64 px runtime scale, or the proportionally equivalent width at a larger working resolution;
5. restore the structural/visible mask after blending;
6. after any downscale, run a final runtime seam check on the actual production pixels.

Median is preferred over mean so one failed/noisy tile does not pull the shared connector toward its defect.

## Semantic classes, not occupancy heuristics

A diagnostic can group edges by properties such as orientation and alpha occupancy, but this is not a production semantic contract.

Two edges can have the same width/occupancy yet serve different joins. Production code therefore uses an explicit table derived from the category contract, e.g. `TRANSFER_HALL_WALL_KIT.md`.

Genuine terminations are not members of a continuation class.

## Automated QA and negative control

Visual inspection remains mandatory, but seam compatibility also requires a pixel metric.

For every modular kit, report:

```text
SAME-TYPE mean diff
DIFF-TYPE mean diff     <- negative control
RATIO = DIFF / SAME
WORST same-type pair
```

**Never report a match number without a negative control.**

A number such as `mean diff = 5` has no interpretable scale by itself. The same metric against edges that deliberately must not match shows whether the test separates correct from incorrect relationships.

For strongly canonicalized runtime seams, SAME-TYPE should approach zero. As a default warning threshold, a finite ratio below approximately **20×** means the kit should be inspected/rejected unless its category contract explicitly defines another tolerance.

## Pipeline placement

Preferred generic pipeline:

```text
semantic spec
→ deterministic geometry/mask
→ material generation/edit
→ material QA
→ structural mask restore
→ semantic connector canonicalization
→ downscale to runtime
→ final runtime seam metric + negative control
→ assembly QA
→ live QA
```

If material already exists at runtime resolution, canonicalization may operate directly at runtime size, as the Transfer Hall Walls v2 derivation does.

## DO

- name connector relationships explicitly;
- canonicalize only edges that truly interchange;
- use median canonical strips;
- blend inward instead of flattening the entire tile;
- reapply alpha/structural masks after blending;
- test the final runtime pixels;
- include a negative control in every reported seam metric;
- keep visual assembly QA after automated QA.

## DON'T

- do not trust the generator to make edge material identical;
- do not group production connectors only because their occupied pixel count matches;
- do not canonicalize genuine caps/terminations into continuation edges;
- do not accept a good isolated tile as proof of repeatability;
- do not quote a raw similarity/difference number without a negative control;
- do not let canonicalization expand collision or change semantic topology.

## Transfer Hall implementation

Current implementation:

- deterministic derivation: `scripts/materialize-art-assets.mjs`
- runtime seam validator: `scripts/validate-wall-seams.mjs`
- semantic table and wall-specific geometry: `TRANSFER_HALL_WALL_KIT.md`

The wall material source is preserved separately from the current visible fascia, which allows visual weight to change without re-generating the underlying material or changing the 10 px collision core.
