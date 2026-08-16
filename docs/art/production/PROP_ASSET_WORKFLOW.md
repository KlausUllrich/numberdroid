# Numberdroid — Prop Asset Workflow

Status: **binding production contract for Props and Prop-like Hero setpieces**

This document specializes `ARTIST_AGENT_WORKFLOW.md` for isolated gameplay Props. It does not replace the general Artist workflow, validation rules, method-selection gate, category recipe or Level Compiler placement rules. When rules overlap, the stricter rule wins.

The purpose is to make Prop production reproducible without relying on chat memory and to keep visual approval, technical extraction, spatial authoring and runtime integration as distinct gates.

## 1. Core rule

A Prop moves through the pipeline one semantic asset at a time.

```text
PROP CONTRACT
→ FIRST PROPOSAL: VARIANTS A / B / C
→ ASSISTANT SOURCE QA
→ KLAUS SELECTS + APPROVES ONE SOURCE
→ PRODUCTION EXTRACTION / NORMALIZATION
→ PRODUCTION QA
→ SHADOW / GROUNDING
→ SHADOW QA
→ SPATIAL METADATA FINALIZATION
→ ART REGISTRY INTEGRATION
→ TEST / BUILD / DEPLOY
→ LIVE COMBINED QA
→ LIVE_ACCEPTED
```

No later step may silently compensate for a failed earlier step.

## 2. One Prop, three first-look variants

To speed up art direction, the **first proposal for a new Prop should normally present three alternatives**:

```text
A — conservative / closest to established Numberdroid language
B — stronger character / silhouette variation
C — bolder but still contract-compliant interpretation
```

These are **three variants of the same Prop**, not three different asset categories.

When ChatGPT image generation can return multiple separate outputs in one generation call, request exactly three isolated outputs for A/B/C. Do not combine them into an infographic, presentation board, room mockup or labeled source sheet.

All three variants must share the same:

- semantic Prop identity and function;
- perspective contract;
- target footprint class;
- material/palette family;
- background/alpha contract;
- forbidden-content rules.

They may vary in silhouette, proportions within the approved envelope, secondary construction detail and restrained personal/style character.

After generation, the next turn is QA. No extraction, shadow creation, integration or second generation occurs before inspection.

If the tool cannot return three separate source candidates cleanly, generate them sequentially rather than putting several objects into one production image.

## 3. Mandatory Prop Contract before generation

Before the first image call, record the following in the relevant recipe or task card.

```text
PROP ID
DISPLAY / DESIGN NAME
SEMANTIC FUNCTION
LEVEL / SPACE ROLE
PRODUCTION METHOD
PERSPECTIVE
SOURCE BACKGROUND / ALPHA
RUNTIME CANVAS / FOOTPRINT CLASS
ATTACHMENT MODE
WALL RELATION
ALLOWED ROTATIONS
USE / APPROACH SPACE
GENERAL CLEARANCE / SPACING
DOOR / PRIMARY-PATH POLICY
VISUAL BOUNDS PLAN
COLLISION PLAN
SHADOW PLAN
EXACT-FIT / WALL-BOUNDARY PLAN
RUNTIME ASSET PATH
RECIPE PATH
```

The Level Compiler mapping for these decisions is defined in `../../level-generation/PROP_AUTHORING_REQUIREMENTS.md`.

Do not generate an asset while its spatial role is still ambiguous. For example, a console that may be either wall-mounted or floor-standing needs that decision before art production because perspective, collision, rotations and editor behavior depend on it.

## 4. Source generation gate

The production source must contain the requested Prop only.

For ordinary Props and Hero objects:

- isolated object;
- transparent background when supported;
- no room, floor tile or wall section;
- no labels, captions, dimensions, UI, legend or technical board;
- no baked global scene lighting;
- no unrelated Props;
- no baked grounding shadow unless the recipe explicitly makes it inseparable.

For the current Transfer Ship civilian-prop language, use the approved Numberdroid perspective contract from the relevant category recipe. Detailed civilian Props normally use the established ND Shallow Top-Down baseline unless explicitly overridden.

## 5. Assistant source QA

Every A/B/C source candidate receives a concrete disposition.

Check:

- requested Prop only;
- correct perspective and camera logic;
- Numberdroid material/palette fit;
- recognizable function at gameplay scale;
- silhouette compatible with the intended footprint;
- no unwanted floor/wall/background pixels;
- no baked directional room shadow;
- no clipped object parts;
- no text or presentation furniture;
- plausible extraction into a clean transparent runtime canvas.

Report each variant as `PASS` or `FAIL` with reasons.

A visually attractive but invalid source is a FAIL.

## 6. Klaus source-approval gate

For Gold Slice production, **Klaus must select and approve one source candidate before technical production continues**.

The selected source becomes the visual authority for that Prop revision.

Do not infer approval from silence, CI, a merge, or an earlier mood-board discussion.

If none of A/B/C is approved, revise the brief and make a new three-variant proposal. Do not crop or integrate the least-bad source.

## 7. Production extraction / normalization

The approved source is not automatically the runtime asset.

For alpha-bearing Prop sources, the reusable deterministic path is:

```text
approved source PNG
→ validate/decode PNG
→ conservative low-alpha cleanup
→ crop to surviving alpha bounds
→ premultiplied-alpha Lanczos fit
→ exact transparent runtime canvas
→ production PNG
```

Current reusable command:

```text
node scripts/art/prepare-prop-asset.mjs \
  --input <approved-source.png> \
  --output <runtime-prop.png> \
  --width <px> --height <px> \
  --margin <px> \
  --alpha-cutoff <0..255>
```

This tool **does not perform semantic background removal**. If the approved source has an opaque or painted background, generic Freistellen remains a separate capability and must not be faked by thresholding arbitrary colors.

The recipe records the actual extraction values used for the accepted production asset.

## 8. Production QA

Inspect the actual normalized runtime PNG independently from the approved large source.

Verify:

- exact pixel dimensions;
- correct transparent canvas;
- no clipped silhouette;
- no matte/background halo;
- no stray low-alpha islands;
- intended runtime margins;
- correct apparent scale;
- important forms survive gameplay-size downscale;
- no accidental source text/background;
- source orientation is preserved.

Only the production asset proceeds to shadow/spatial integration.

## 9. Shadow / grounding step

Grounding shadow is a separate `FloorFX` asset unless a category-specific exception is explicitly approved.

Default contract:

- same runtime canvas and anchor as the Prop where practical;
- neutral charcoal / low-chroma grounding;
- contact weight plus restrained soft ambient footprint;
- no colored gameplay glow;
- no floor texture;
- no global directional-light claim;
- no collision semantics.

The shadow may be generated or derived deterministically from the approved production silhouette. It receives assistant QA before integration.

Klaus' final live review evaluates the combined Prop + shadow result in context. A shadow that materially changes the intended look may be escalated for separate approval before integration.

## 10. Spatial metadata finalization

Art pixels never become gameplay geometry automatically.

Before runtime integration, finalize the Prop's compiler/editor contract in `propRegistry.ts` and, when needed, `propCollisionRegistry.ts`:

- coarse footprint;
- attachment mode;
- allowed rotations;
- wall preference/requirement semantics;
- approach/use-space;
- general spacing/clearance;
- Door Clearance / primary-path policy;
- visible exact-fit bounds;
- collision bounds or multipart collision;
- placement envelope;
- wall-boundary behavior.

The accepted image informs these authored values, but alpha is not collision authority.

If the asset requires a spatial rule the current registry/compiler cannot express, **stop and extend the authoring model first**. Do not hide the missing rule in hand-authored coordinates or a special renderer.

## 11. Level Editor / Workbench gate

Before integration, confirm the asset is understandable to the current semantic Level Workbench.

The Workbench must be able to explain or enforce, as applicable:

- whether the Prop is FloorProps, WallProps or eligible for either placement mode;
- which rotations are authored/approved;
- whether a wall is required, merely preferred or irrelevant;
- which wall is preferred for this Level instance;
- coarse footprint after rotation;
- use/approach space;
- clearance/spacing reservation;
- Door Clearance and primary-circulation restrictions;
- visual vs collision footprint;
- valid/invalid direct placement edits.

Type-level asset rules belong in the Prop Registry. Level-instance intent belongs in `LevelSpec.props` / semantic Overrides. The Workbench must not silently turn global asset semantics into one-off level coordinates.

## 12. Runtime integration

For generated TS-01, the default production path is **individual registered assets**, not immediate global atlas packing.

Register:

```text
Prop PNG       → propArtRegistry.ts
Shadow PNG     → propArtRegistry.ts shadowAsset
Spatial rules  → propRegistry.ts
Multipart hit  → propCollisionRegistry.ts when required
```

The generated composite already places registered Prop art in the correct visual layers.

Atlas packing is an optimization/asset-management concern and remains deferred until there is a demonstrated need. Do not delay Gold Slice Prop production waiting for a generic atlas packer.

## 13. Integration QA and final acceptance

After registry integration:

1. run relevant Art Toolkit QA;
2. run tests/build;
3. inspect the deployed generated TS-01;
4. verify actual placement, rotation, scale, wall contact and shadow;
5. drive PICO around the Prop and verify collision/use-space plausibility;
6. inspect desktop and phone gameplay scale;
7. obtain Klaus' live combined acceptance;
8. update recipe/status to `LIVE_ACCEPTED` only then.

`SOURCE APPROVED`, `PRODUCTION QA PASSED`, `CI GREEN`, `MERGED`, `DEPLOYED` and `LIVE_ACCEPTED` are distinct states.

## 14. Batch discipline

Only one selected Prop proceeds through extraction/shadow/integration at a time.

The A/B/C acceleration rule applies to **initial visual choice**, not to downstream technical batching. This keeps rejection cheap and prevents several unapproved assets from accumulating technical work.
