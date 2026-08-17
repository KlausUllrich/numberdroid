# Numberdroid — Prop Asset Workflow

Status: **binding production contract for Props and Prop-like Hero setpieces**

This document specializes `ARTIST_AGENT_WORKFLOW.md` for isolated gameplay Props. It does not replace the general Artist workflow, validation rules, method-selection gate, category recipe or Level Compiler placement rules. When rules overlap, the stricter rule wins.

The purpose is to make Prop production reproducible without relying on chat memory and to keep **functional reasoning, user alignment, visual approval, source preservation, technical extraction, spatial authoring and runtime integration** as distinct gates.

---

# 1. Core rule

A Prop moves through the pipeline one semantic asset at a time.

```text
CURRENT CONTEXT / PHASE
→ ASSET FUNCTION ANALYSIS
→ FUNCTION-TO-FORM PHILOSOPHY (TEXT)
→ USER ALIGNMENT / CORRECTION
→ PROP CONTRACT + PERSPECTIVE PREFLIGHT
→ WAIT FOR `generieren`
→ ONE SOURCE IMAGE
→ WAIT FOR / ENTER `QA`
→ ASSISTANT SOURCE QA
→ KLAUS SOURCE APPROVAL
→ APPROVED SOURCE ARCHIVE
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

A good-looking Prop that does not communicate its function is a failed design, not a successful source awaiting technical cleanup.

An approved source that has not yet been durably archived is **not ready for destructive/downscaling production work**.

---

# 2. Two explicit trigger words — binding interaction contract

For Prop / Prop-like Hero image work, use two explicit user keywords as hard mode switches.

The higher-authority standalone command predicate in `HARD_GENERATION_COMMAND_GATE.md` controls whether image generation is actually authorized. Any older/broader wording here must be interpreted through that hard gate.

## `QA` — inspection mode

If the user's current message contains the explicit word **`QA`** (case-insensitive):

- do **not** call `image_gen`;
- inspect the currently relevant image/source only;
- compare it against the current recipe, perspective, function and production contract;
- report `PASS`, `FAIL` or `REVISION REQUIRED` with concrete reasons;
- record newly learned durable design constraints in the recipe/documentation when requested;
- do not silently generate a replacement in the same turn.

`QA` has priority over generation.

## `generieren` — image-generation authorization

For Prop work, image generation is authorized only by the standalone current-user command defined in `HARD_GENERATION_COMMAND_GATE.md`.

Equivalent current predicate:

```text
trim(currentUserMessage).toLowerCase() === "generieren"
```

One authorized generation turn means:

- exactly **one** image-generation call;
- exactly **one** visual proposal;
- no automatic second candidate;
- no integration/extraction after the generated image in the same turn.

The generated image is the end of that production turn. It must be inspected before another generation.

---

# 3. Function before form — mandatory design-analysis gate

Before writing the image prompt, the Artist must first determine **what the asset actually has to accomplish**.

Use current Story, Game Design, Level Design, Art Direction, Level Compiler metadata and the asset recipe to answer, as applicable:

```text
WHAT IS THIS OBJECT FOR?
WHY DOES IT EXIST IN THIS PLACE?
WHO / WHAT USES IT?
WHAT MUST THE PLAYER UNDERSTAND BY LOOKING AT IT?
WHAT IS THE APPROACH / USE / ENTRY / EXIT SEQUENCE?
WHAT PARTS ARE PHYSICALLY SOLID?
WHAT SPACE MUST REMAIN OPEN AROUND IT?
WHAT OTHER OBJECT / SYSTEM DOES IT RELATE TO?
WHAT STORY OR WORLD IDEA SHOULD ITS FUNCTION EXPRESS?
WHAT SHOULD IT NOT BE MISTAKEN FOR?
```

Then derive form from that function.

The Artist should ask:

- Which large shapes communicate the operation from the actual gameplay camera?
- Is there a visible source/target, input/output, dock, cradle, opening, control side, service side or directional relationship?
- Does the silhouette explain how a body/person/robot relates to the object?
- Can the function be read without relying on tiny screen graphics or explanatory text?
- Is the object merely using generic sci-fi rings, panels, screens or glow where a more functional form is needed?

For Hero Props, this step is especially important. A Hero object should normally tell a small piece of gameplay/world story through its physical organization.

---

# 4. Textual design-philosophy gate — user must be able to intervene

Before the first image generation for a new or materially revised Prop, present the intended design logic **in text**.

The explanation should be short enough to review but concrete enough to challenge. It should normally state:

```text
1. FUNCTION / PLAYER READ
2. FUNCTION-TO-FORM IDEA
3. APPROACH / USE / MOVEMENT AROUND THE OBJECT
4. MAJOR SILHOUETTE / PART RELATIONSHIPS
5. SPATIAL / EDITOR IMPLICATIONS
6. PERSPECTIVE STRATEGY
7. MAIN FAILURE MODE TO AVOID
```

This is a real correction/alignment gate.

Do not call image generation merely because the Artist has finished presenting the philosophy. Even after alignment, wait for the standalone `generieren` command required by the hard generation gate.

The purpose is to make conceptual mistakes cheap. It is much faster to correct “this looks like a teleporter, but it needs to communicate Core → Body transfer” in text than after several image generations.

If later QA reveals that the underlying functional interpretation was wrong, return to this gate before the next materially different generation.

---

# 5. One proposal per generated image — binding

For Prop production, **one generated image contains one proposed asset**.

Do not ask the image generator for:

- three alternatives in one picture;
- an A/B/C concept sheet;
- a comparison board;
- several versions around one canvas;
- the Prop plus its shadow candidate;
- a room mockup containing the proposed Prop;
- labels, captions, arrows or explanatory presentation furniture.

These compositions repeatedly produce attractive concept art that is poor production source material and make QA/extraction ambiguous.

## Multiple alternatives

If the user wants several visual alternatives, they are separate proposal cycles:

```text
Candidate A
→ user says standalone `generieren`
→ one image-generation turn
→ QA / user reaction

Candidate B, if still wanted
→ revise direction as needed
→ user says standalone `generieren`
→ one image-generation turn
→ QA / user reaction
```

Do **not** promise to autonomously generate A, B and C sequentially inside one response.

If Candidate A is approved, there is no requirement to generate B/C merely to satisfy a quota.

**One proposal per image is more important than presenting several choices quickly.**

---

# 6. Perspective preflight — mandatory before every new visual direction

Perspective/camera mismatch is a source-level failure and cannot be fixed by cropping.

Before generation, identify from the binding category/world contract:

- projection/camera model;
- which surfaces should dominate the read;
- how much, if any, vertical/side face is allowed;
- whether rotation is a runtime transform or requires separately authored views;
- which accepted existing asset is the best perspective reference;
- which perspective cues are explicitly forbidden.

For Numberdroid environment Props, the gameplay camera remains authoritative. Do not use isometric or presentation-art perspective simply because it makes machinery look more dramatic.

When using the current ND Shallow Top-Down civilian/Prop treatment, preserve the near-top-down logic defined by the current Art contracts: top surfaces and footprint must carry the function; readable frontal furniture faces, strong side walls, convergence or camera-dependent extrusion are not acceptable.

Before the image call, the Artist should be able to say in one sentence what the camera is doing and which surfaces the viewer should primarily see.

If source QA reports wrong perspective, change the next visual brief/prompt before generating again; do not merely repeat the same request.

---

# 7. Mandatory Prop Contract before generation

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
APPROVED ARCHIVE CAMPAIGN AREA
APPROVED ARCHIVE ASSET FAMILY
```

The Level Compiler mapping for spatial decisions is defined in `../../level-generation/PROP_AUTHORING_REQUIREMENTS.md`.

Do not generate an asset while its spatial role is still ambiguous. For example, a console that may be either wall-mounted or floor-standing needs that decision before art production because perspective, collision, rotations and editor behavior depend on it.

The contract does not require every final numeric bound to be known before concept art, but it must make intended spatial behavior explicit enough that the proposed silhouette can be judged against it.

---

# 8. Source generation gate

The production source must contain the requested Prop only.

For ordinary Props and Hero objects:

- one isolated object/proposal;
- transparent background when supported;
- no room, floor tile or wall section;
- no labels, captions, dimensions, UI, legend or technical board;
- no baked global scene lighting;
- no unrelated Props;
- no separate shadow/FloorFX proposal in the same image;
- no baked grounding shadow unless the recipe explicitly makes it inseparable;
- no decorative structures whose only role is to make the image look more like concept art.

The prompt should emphasize the approved functional form, not merely palette/style adjectives.

For current Transfer Ship civilian-prop language, use the approved Numberdroid perspective contract from the relevant category recipe/art rules.

---

# 9. Assistant source QA

Every generated source receives one concrete disposition.

Check:

- requested Prop only;
- **function is visually understandable**;
- correct perspective and camera logic;
- Numberdroid material/palette fit;
- recognizable function at gameplay scale;
- silhouette compatible with intended footprint;
- visual relationship between meaningful functional parts;
- no unwanted floor/wall/background pixels;
- no baked directional room shadow;
- no clipped object parts;
- no text/presentation furniture;
- plausible extraction into a clean transparent runtime canvas.

Report `PASS`, `FAIL` or `REVISION REQUIRED` with reasons.

A visually attractive but invalid source is a FAIL.

The explicit `QA` keyword always means inspection mode and cannot authorize generation.

---

# 10. Klaus source-approval gate

For Gold Slice production, **Klaus must explicitly approve the source before technical production continues**.

The approved source becomes the visual authority for that Prop revision.

Do not infer approval from silence, CI, a merge or an earlier mood-board discussion.

If the source is rejected:

1. state why it failed;
2. decide whether the failure is prompt execution, perspective, style or underlying function-to-form reasoning;
3. if the design logic changes materially, present the revised philosophy in text first;
4. update the recipe when durable learning changed;
5. wait for a later standalone `generieren` command before making exactly one revised candidate.

Do not crop or integrate a least-bad source.

If the source is approved, proceed first to the archive gate below — **not directly to Crop/Fit**.

---

# 11. Approved source archive gate — mandatory

After explicit source approval and before production extraction, preserve the highest-quality approved original according to:

- `APPROVED_SOURCE_ARCHIVE.md`;
- `../../../art-source/approved/README.md`;
- `../../agents/BINARY_ASSET_TRANSPORT.md` for binary publication.

Required decisions:

```text
CAMPAIGN AREA
ASSET FAMILY
COMPONENT NAME
APPROVED ORIGINAL TARGET PATH
SOURCE PROVENANCE / GEN-ID WHEN AVAILABLE
DIMENSIONS / BYTE SIZE / SHA-256 WHEN AVAILABLE
```

Canonical Campaign Areas:

```text
area-01-transfer-ship
area-02-deep-ocean
area-03-extreme-industry
area-04-moon-vacuum
area-05-bio-ark-primus
```

Related assets that belong to one future authoring/animation workflow should share one **Asset Family**. Example: Transfer Apparatus + yellow Core + Transfer FX belong to `transfer-system/`.

A source counts as archived only when the actual approved source file is durably reachable under `art-source/approved/...` and the family manifest identifies it.

Do not mutate the approved original while archiving it.

If binary transport is unavailable:

```text
SOURCE_APPROVED / ARCHIVE_PENDING
BINARY_TRANSPORT_BLOCKED
```

Do not claim archive completion and do not proceed to destructive/downscaling production work by default. The purpose of this gate is precisely to prevent losing the large approved source needed for future animation/retouching.

---

# 12. Production extraction / normalization

The archived approved source is not automatically the runtime asset.

For alpha-bearing Prop sources, the reusable deterministic path is:

```text
archived approved source PNG
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

Production derivatives should be preserved under the same Asset Family when they remain useful authoring masters, e.g. `art-source/approved/<area>/<family>/production/`, while runtime deployment output remains under `public/`.

The recipe records the actual extraction values used for the accepted production asset and its archived-source relationship.

---

# 13. Production QA

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
- functional read survives gameplay scale;
- no accidental source text/background;
- source orientation is preserved.

Only the production asset proceeds to shadow/spatial integration.

---

# 14. Shadow / grounding step

Grounding shadow is a separate `FloorFX` asset unless a category-specific exception is explicitly approved.

The shadow is created **after** the visible Prop source/production asset is approved. It is not part of the initial visual-proposal image.

If the shadow itself requires image generation, the same hard generation authorization rule applies: exactly one authorized proposal, then stop for QA.

Default contract:

- same runtime canvas and anchor as the Prop where practical;
- neutral charcoal / low-chroma grounding;
- contact weight plus restrained soft ambient footprint;
- no colored gameplay glow;
- no floor texture;
- no global directional-light claim;
- no collision semantics.

The shadow may also be derived deterministically from the approved production silhouette. It receives assistant QA before integration.

Klaus' final live review evaluates the combined Prop + shadow result in context.

---

# 15. Spatial metadata finalization

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

---

# 16. Level Editor / Workbench gate

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

---

# 17. Runtime integration

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

---

# 18. Integration QA and final acceptance

After registry integration:

1. run relevant Art Toolkit QA;
2. run tests/build;
3. inspect the deployed generated level;
4. verify actual placement, rotation, scale, wall contact and shadow;
5. drive PICO/relevant bodies around the Prop and verify collision/use-space plausibility;
6. inspect desktop and phone gameplay scale;
7. obtain Klaus' live combined acceptance;
8. update recipe/status to `LIVE_ACCEPTED` only then.

`DESIGN PHILOSOPHY ALIGNED`, `SOURCE APPROVED`, `APPROVED SOURCE ARCHIVED`, `PRODUCTION QA PASSED`, `CI GREEN`, `MERGED`, `DEPLOYED` and `LIVE_ACCEPTED` are distinct states.

---

# 19. Iteration discipline

Only one visual candidate is active at a time.

When a source fails or the user asks for another direction:

```text
inspect / QA
→ identify the real failure
→ revise function-to-form philosophy/prompt as needed
→ tell the user what will change
→ wait for standalone `generieren`
→ generate one new image
→ stop for QA again
```

Do not hide learning by silently rerolling images.

Do not batch several unapproved Props or several unapproved variants into downstream extraction/shadow/integration work.
