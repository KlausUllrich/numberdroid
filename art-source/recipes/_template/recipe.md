# Asset Recipe — <name>

Status: `PLANNED | PREPARED | MATERIAL_ACCEPTED | PRODUCTION_ACCEPTED | LIVE_ACCEPTED`

## Identity

- Slice/world:
- Category:
- Runtime target:
- Runtime asset path:
- Map/GID/object usage:
- Perspective:
- Alpha/background:

## Production method

Choose from `docs/art-production-methods/README.md` before production begins.

- Primary production method: `M1 | M2 | M3 | M4 | hybrid`
- Material/source method: `M1 | M2 | M3 | M4 | authored | procedural | not applicable`
- Optional finishing method:
- Why this authority split fits the asset:

Do not leave method selection implicit in chat history.

## Source authority

- Visible geometry: `geometry.svg` / not applicable
- Collision core: `collision-core.svg` / not applicable
- Topology / connector semantics: file/contract / not applicable
- Material reference: `material-reference.md`
- Generation/edit/material prompt: `prompt.md` / not applicable
- Render/compositor recipe: `render-recipe.json` / not applicable

## Visual target

Describe what should read at gameplay scale, including material, value hierarchy, semantic colours, construction language and what must remain visually quiet.

## Deterministic processing

Document mask restore, connector classes/canonicalization, extraction, downscale, frame/cell order, procedural compositing, effect envelopes and any other non-generative processing.

## Forbidden

List category-specific failures that must cause rejection.

## QA

- source/guide QA:
- material/style QA:
- geometry/alpha QA:
- seam/repetition QA:
- runtime-scale QA:
- map-context QA:
- live QA:

## Accepted result

Record accepted source/material revision, runtime hash or PR when the asset reaches production/live acceptance.
