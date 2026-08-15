# Approach 04 — External Layered Editor / Local Raster Pipeline

Status: **strategic option; not required for current wall proof**

## Purpose

Use a layer-aware graphics environment when the task benefits from explicit masks, paint-over, local retouching, inpainting, layer blending, manual/agent correction, or model-assisted realism that cannot be expressed cleanly as a single image-generation call.

Potential environments include:

- Photoshop-class editors exposed through MCP or another automation interface;
- Invoke or ComfyUI workflows with explicit raster/mask/control layers;
- other scriptable 2D painting/compositing tools.

The tool is not the method by itself. The production contract still defines which layer owns geometry, material, effects and runtime packing.

## Best-fit problems

- complex hero assets;
- props requiring local paint-over;
- repairing small generated defects without regenerating the whole asset;
- layered contact shadows or AO;
- selective material replacement;
- multi-pass state variants;
- art-directable inpainting;
- cases where a human or agent needs to edit one region while preserving the rest.

## Critical requirement for MCP/editor integration

A useful integration must expose **semantic editing operations**, not merely screenshots and mouse clicks.

Preferred capabilities:

- create/import raster and vector layers;
- read/write layer masks;
- transform layers numerically;
- select by mask/path;
- apply adjustment/filter operations;
- export exact pixel dimensions;
- preserve alpha;
- address named layers deterministically;
- save reproducible source documents or operation descriptions.

Without this, the workflow may become fragile UI automation rather than a production pipeline.

## Local diffusion / realism-pass lesson

A promising use is a controlled **realism/material pass on an already strong raster source**, but it must not be assumed to preserve precision geometry.

Previous local experiments recorded in `docs/ART_PIPELINE_LOCAL_EXPERIMENTS_2026-08-14.md` found:

- IP-Adapter transferred layout as well as material and therefore broke structural lock;
- one locally available Qwen-Image-Edit checkpoint ignored the edit target;
- using a flat guide simultaneously as structural control and img2img source produced under-materialized flat output.

These are negative results for those specific workflows, not proof that all local/editor-based approaches fail.

## Better future test

If testing Invoke/ComfyUI again, separate:

1. deterministic geometry/control source;
2. rich material or rendered base source;
3. local mask for the area allowed to change;
4. abstract realism prompt describing surface character only.

The expected result should then be evaluated as a **layered edit**, not as production authority.

## Photoshop/MCP research questions

Before adopting an editor connector, verify:

- Can an agent import SVG paths as editable masks/shapes?
- Can it create and name masks programmatically?
- Can it distinguish connector edges from exposed edges using supplied masks?
- Can filters or generative fills be constrained to exact selections?
- Can it export without resampling or color/profile surprises?
- Can operations be replayed/reproduced?
- Can binary source assets be stored or regenerated safely in the repository workflow?

## Relationship to procedural compositor

These approaches are complementary.

A procedural compositor should handle repeatable deterministic operations cheaply. A layered editor should be reserved for tasks where local artistic judgment or rich editing materially improves the result.

Do not move deterministic seam/connector logic into Photoshop merely because Photoshop can draw it.

## Future folder contents

```text
research/      # MCP/tool capability notes, experiments
scripts/       # export/import helpers if needed
demo/          # minimal proof files or screenshots
workflows/     # Invoke/ComfyUI workflow descriptions where appropriate
```
