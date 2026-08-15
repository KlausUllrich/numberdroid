---
name: numberdroid-artist
description: Method-specific skill for Numberdroid M2 Controlled Art Pass: deterministic geometry plus generative/material realism pass, followed by mask restoration, extraction and QA. Do not use as a universal art-production skill.
---

# Numberdroid M2 Controlled Art Pass Skill

Use this skill only when the selected production method is **M2 Controlled Art Pass** or an explicitly M2-based hybrid.

Read first:

1. `REPOSITORY_STRUCTURE.md`
2. `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
3. `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
4. `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
5. `docs/art-production-methods/02-controlled-art-pass/README.md`
6. the asset/category recipe and contract
7. `docs/art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md` when modular seams apply

## Method boundary

**Generative art may own material appearance. It does not own production geometry.**

M2 is a good fit when exact geometry must be preserved but the material pass can be meaningfully separated from the silhouette/topology problem.

Do **not** force M2 onto modular assets where the model would need to infer which isolated silhouette edges are runtime connectors. Use M4 when explicit topology-dependent edge treatment is the central problem.

## M2 pipeline

```text
semantic spec
→ deterministic SVG/mask master
→ generation-layout / raster guide
→ guide QA
→ image edit / material-realism pass
→ material QA
→ extract/crop
→ restore original mask/geometry
→ connector canonicalization when required
→ runtime downscale/packing
→ production QA
→ live QA
```

## Mandatory state discipline

```text
PREPARED
→ GUIDE_READY
→ GUIDE_QA_PASSED
→ ART_PASS_GENERATED
→ ART_PASS_QA_PASSED
→ GEOMETRY_RESTORED
→ PRODUCTION_QA_PASSED
→ RUNTIME_INTEGRATED
→ LIVE_QA_PASSED
```

Add connector/seam states when the recipe requires them. Failure cannot silently advance.

## `QA` hard rule

If the user says `QA`, `prüfen`, `check`, or asks to inspect the current image:

- do **not** call image generation;
- inspect the existing source;
- report PASS/FAIL and concrete reasons;
- stop unless the next production step is explicitly requested.

## Image-generation turn boundary

Before generation, state that exactly one source/edit is being generated. After the image appears, do not silently regenerate or integrate. Inspection happens on the next user turn.

## Geometry master

For precision work, create SVG/mask geometry first. It owns:

- runtime proportions;
- cell/frame boundaries;
- silhouette;
- connector positions/widths when applicable;
- reserved/empty cells;
- collision-corresponding structure when relevant.

The geometry master is technical source, not final visible art.

## Generation layout

The image/edit tool may need a layout different from the runtime atlas.

When packed cells visually merge, create a **spaced generation layout** with transparent gutters. Preserve each cell's exact geometry and later repack deterministically.

Gutters solve object separation. They do **not** communicate hidden neighbor topology.

## Raster size

Rasterize the deterministic geometry directly at the intended edit/generation resolution. Do not rely on the image tool to enlarge a tiny guide while preserving exact ratios.

## Edit instruction

Ask only for material/surface enrichment appropriate to the recipe, for example:

- material richness;
- believable construction;
- restrained highlights;
- wear/micro-detail;
- local surface variation.

Forbid:

- new geometry/layout;
- labels/documentation;
- UI;
- bonus props;
- perspective change;
- arbitrary extra variants.

If the concrete edit target is ignored:

`FAIL — edit target not respected`

## Material proof versus production proof

Report separately when useful:

```text
MATERIAL / STYLE PROOF: PASS or FAIL
PRODUCTION GEOMETRY:     PASS or FAIL
```

A material proof may continue despite geometry drift only because deterministic restoration follows.

## Restore geometry

Map accepted material information back into the deterministic coordinate system and reapply the authoritative mask.

- outside mask = transparent;
- remove stray alpha;
- generated alpha never owns production geometry.

## Modular seams

If the recipe uses modular connectors, semantic connector definitions remain deterministic. Use canonicalization/negative-control QA from `docs/art/production/SEMANTIC_CONNECTOR_CANONICALIZATION.md`.

Do not infer production connector identity from occupancy alone.

If connector/exposed-edge semantics dominate the visual result, reconsider the method: M4 Procedural 2D Compositor is usually stronger.

## Production QA

After restoration/downscale, inspect the real runtime file at 100% and in assembly/map context.

Check exact dimensions, alpha, cell order, repeat behavior, seam behavior, semantic colours and gameplay-scale readability.

## DO

- one category per production pass;
- exact geometry before generation;
- separate compact runtime layout from spaced generation layout when needed;
- inspect every generated result before extraction/integration;
- restore masks deterministically;
- preserve stable atlas/frame IDs;
- use explicit semantic seam QA where applicable;
- keep a permanent source master independent of generated art.

## DON'T

- do not prompt from text for a precision atlas and trust the result;
- do not generate during QA-only turns;
- do not silently retry;
- do not trust generated alpha as geometry;
- do not assume gutters communicate runtime neighbor semantics;
- do not accept attractive connector/end treatments that violate the category contract;
- do not use this skill merely because the task is visual.

## Historical Transfer Hall proof

The original Transfer Hall wall experiments proved that M2 can turn flat deterministic geometry into materially rich source art, while also proving that geometry/alpha drift requires deterministic restoration. Later wall work moved to M4 because wall edge treatment depended on hidden runtime topology.

Historical source/templates and experiments are preserved under `art-source/flow-vorlagen/` and `docs/history/`; they are evidence, not current Wall authority.
