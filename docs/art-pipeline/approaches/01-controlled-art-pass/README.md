# Approach 01 — Controlled Art Pass

Status: **validated, useful, but not universal**

## Purpose

Use deterministic geometry as the production authority while asking image generation to improve surface/material quality.

Canonical flow:

```text
semantic spec
→ deterministic SVG/mask
→ raster guide at generation size
→ guide QA
→ image edit for material
→ material QA
→ structural mask restore
→ connector treatment
→ runtime downscale
→ production/live QA
```

## What this method is good at

- enriching a simple deterministic shape with believable material;
- preserving exact runtime silhouette after mask restoration;
- eliminating stray alpha and generative shape drift;
- keeping collision/runtime geometry independent from generative art;
- isolated geometry-critical props or simple modular pieces where edge treatment is not semantically ambiguous.

## What it does NOT solve automatically

The generator does not know semantic assembly rules simply from an isolated shape.

In particular it may not know:

- whether an apparent outer edge is actually a connector to another tile;
- whether a cap is a true termination;
- whether a highlight/bevel should continue through a neighbor;
- whether several atlas cells form one continuous manufactured structure.

Mask restore fixes **where pixels may exist**. It does not retroactively make material/detail placement semantically correct.

## Proven Numberdroid result

The Transfer Hall `H_TOP` experiment proved that a flat gray deterministic guide could be transformed into materially rich graphite/metal wall art. The generator changed dimensions/alpha, but structural mask restoration recovered exact geometry.

This established the principle:

> generative art may own material appearance; it does not own production geometry.

## Learned failure mode

When the generator sees each wall component as a complete standalone object, it tends to create perimeter frames, bevels and endpoint closures. Those can be attractive in isolation but wrong for a modular continuous wall.

Do not keep escalating prompt detail when the missing information is semantic rather than visual.

## Use / avoid

Use when:

- shape is known;
- material enrichment is the main uncertainty;
- edge semantics are simple or can be deterministically restored.

Avoid as the sole method when:

- exposed edges and connector edges need different treatment that the generator cannot infer;
- all pieces must share one uniform material field;
- pixel-identical seams are a primary property;
- repeated assembly matters more than individual object beauty.

## Related tooling

- structural masks / SVG masters in `art-source/recipes/` and `art-source/flow-vorlagen/`;
- semantic connector canonicalization: `docs/SEMANTIC_CONNECTOR_CANONICALIZATION.md`;
- main role workflow: `ARTIST_AGENT_WORKFLOW.md`.

## Research / demo convention

Place future experiments under:

```text
research/
demo/
scripts/
```

Do not copy runtime binaries here unless they are intentionally small demonstration fixtures.
