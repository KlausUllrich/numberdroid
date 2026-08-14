# Numberdroid — Art Validation Process Addendum

Status: **binding supplement** to `ART_ASSET_VALIDATION_RULES.md`.

This addendum captures process failures observed during the Transfer Hall Gold Slice and closes the remaining loopholes in asset generation QA.

## 1. Production generation must not look like documentation

A production source is invalid if the generator renders headings, captions, legends, explanatory prose, palette swatches, checklists, numbered badges, technical specifications, UI/document panels, presentation/mood-board framing, file names, dates or metadata unless explicitly requested as the asset itself.

Production constraints belong in the prompt and Artist Task Card, **not in the pixels**.

## 2. Image-generation turn boundary

When `image_gen` is used, the generated image is the user-visible end of that assistant turn. Do not design a process that expects a normal explanatory message after the image in the same turn.

Before generation, the Artist must state that:

- exactly one source will be generated;
- the generation turn will end with the image;
- the next assistant response will begin with inspection and PASS/FAIL QA.

After generation, the next Artist action on the next user turn is inspection. No regeneration, extraction, upload, merge or category progression may happen before that inspection.

This is a process requirement specifically intended to prevent the image-generation tool boundary from appearing as an unexplained hang.

## 3. QA never means generate

If the user says `QA`, `prüfen`, `check`, or otherwise asks to inspect the existing image, the agent must **not call image generation**.

QA means:

1. inspect the existing asset/source;
2. compare it against the current contract;
3. report PASS/FAIL and concrete reasons;
4. stop unless the user explicitly asks for the next generation/integration step.

This rule exists because repeated accidental `image_gen` calls during QA obscured failures and made the tool appear to hang.

## 4. One generation, then inspection

After one image-generation call, generation stops until the actual resulting image has been opened and inspected.

Do not issue a second image-generation call merely because the first output is obviously imperfect. First record why it failed and change the next brief/prompt accordingly.

No silent regeneration loops.

## 5. Explicit PASS/FAIL gate

Every generated source receives a real disposition.

For deterministic-geometry pipelines, distinguish two gates:

```text
MATERIAL / STYLE PROOF — PASS or FAIL
PRODUCTION GEOMETRY     — PASS or FAIL
```

A material/style proof may pass while production geometry still fails, but only when a deterministic geometry-restoration step is part of the documented pipeline.

No ambiguous state such as “pretty good”, “usable as inspiration” or “we can probably crop it” is sufficient for production integration.

## 6. Source and production are different artifacts

A source can contain spacing around candidates for extraction, but the final runtime PNG must contain only the exact required production pixels/cells.

Both artifacts are inspected independently.

## 7. Controlled Art Pass proof — 2026-08-14

The Transfer Hall H_TOP experiment established a viable hybrid workflow:

1. exact wall geometry authored as SVG;
2. SVG rasterized to a visible PNG guide;
3. guide inspected and accepted before generation;
4. visible guide used as the intended image-edit target;
5. image generation produced materially convincing graphite/metal construction from the flat guide;
6. generated output did not preserve exact pixel dimensions/alpha and therefore remained source material only;
7. deterministic mask restoration is required before production use.

The proof is considered successful because **generative material quality and deterministic geometry can be separated**.

The generated H_TOP proof specifically showed:

- strong dark graphite material and believable construction detail;
- useful edge/relief treatment;
- broad preservation of the horizontal-wall concept;
- output canvas changed to 1254×1254 instead of the intended exact production size;
- the generated wall band changed relative thickness;
- stray alpha pixels existed outside the main wall region.

Therefore:

> The generator may author material appearance. It must not own final geometry, alpha, connector boundaries or runtime dimensions.

## 8. Generation-canvas normalization — mandatory

For controlled image edits, the deterministic raster guide must already be rendered at the **intended generation canvas size** and preserve runtime proportions exactly.

Do not feed a small guide and rely on the image generator to enlarge it proportionally.

Example:

```text
runtime tile: 64×64
runtime wall: 10 px
edit canvas:  1024×1024
scale factor: 16×
edit wall:    160 px
```

For the complete 4×4 Transfer Hall wall atlas:

```text
runtime atlas: 256×256
4× guide:      1024×1024
cell:           256×256
wall:            40 px
```

The guide canvas and requested output aspect ratio must match.

## 9. Guide visibility / edit-target rule

For geometry-critical image editing, make the exact raster guide visible/available immediately before the edit call.

A text description alone is not sufficient. Several failed attempts recreated a new atlas, documentation board or GitHub-like composition instead of editing the intended guide.

If the output becomes a new composition instead of a material treatment of the target, disposition is:

```text
FAIL — edit target not respected
```

Do not attempt to rescue that image by cropping.

## 10. Deterministic mask restoration — mandatory

After a successful material pass:

1. map/resample the generated material back to the deterministic guide coordinate system;
2. reapply the original SVG-derived structural mask;
3. remove every pixel outside the allowed mask;
4. restore exact connector boundaries/guard zones;
5. only then downscale to runtime resolution.

Generative alpha is never authoritative for modular production geometry.

Tiny stray alpha pixels outside the body are a QA failure until removed by this restoration step.

## 11. Connector Guard Zones

Any modular edge that joins another asset has a deterministic guard zone. The guard zone wins over the generated material if needed.

At connector boundaries enforce:

- exact thickness;
- square edge;
- no rounded termination;
- no taper/bevel before the edge;
- no alpha gap;
- compatible value/material transition;
- no accent line crossing the seam unless authored as a continuous system.

## 12. Optional Effect Envelope — deferred extension

A future two-mask approach may preserve controlled contact shadow or ambient occlusion outside the structural body:

- **Structural Mask**: exact deterministic visible/collision body.
- **Effect Envelope**: small explicitly allowed region for non-structural shadow/AO.

This is not required for the first wall proof. Do not add it until structural geometry + material restoration works reliably.

An Effect Envelope must never modify collision meaning or cross modular connection boundaries.

## 13. Flow templates are source-of-truth helpers

Accepted deterministic source templates are stored under:

```text
art-source/flow-vorlagen/
```

For the Transfer Hall wall proof:

- `transfer-hall-wall-blueprint.svg` — exact 256×256 runtime-geometry master;
- `transfer-hall-wall-blueprint-4x.png` — exact 1024×1024 raster guide derived from that SVG.

Do not regenerate these from memory when continuing the wall pass. Reuse or deliberately revise the saved master.

## 14. Modular Floor and Floor Hero are different classes

A **Modular Floor** candidate represents one repeatable 64×64 tile. It must not contain an internal 2×2 composition or depend on neighboring cells to read correctly.

A **Floor Hero** is an intentional multi-tile setpiece. A 128×128 Floor Hero may be split into four exact 64×64 cells and deliberately placed as 2×2.

An attractive 2×2-looking generation must not silently replace the ordinary Floor atlas. Reclassifying it as Floor Hero does not complete the Modular Floor task.

## 15. Floor candidate source contract

For the current Transfer Hall modular Floor task, the source generation itself must be structurally simple:

- exactly four floor candidates;
- all four visually equal square candidates;
- each candidate represents one single tile, not a 2×2 composition;
- one row or another trivially extractable regular arrangement;
- no non-floor content;
- no labels/documentation;
- no directional arrows;
- no corridor/junction pieces;
- no wall/door geometry;
- no props;
- no hero setpiece;
- no decorative variants without a named map purpose.

If these conditions fail, reject the source before cropping.

## 16. Floor function and colour contract

The four current functions are fixed:

```text
GID 1 — calm ceramic base
GID 2 — subtle non-directional service/SLOT marker
GID 3 — contained graphite functional recess
GID 4 — CORE/SLOT socket with warm amber identity
```

Teal is a sparse system signal, never the dominant floor material. Amber is reserved for CORE/Transfer meaning. The service cell must work when placed as a scattered generic variant in the current map; it therefore cannot rely on a continuous directional stripe.

## 17. Repetition must be judged before merge

For repeatable floor candidates, inspect:

- 3×3 repetition of the base;
- 3×3 repetition of each repeatable variant;
- actual mixed GID pattern from the Transfer Hall;
- final in-game room crop.

Strong square borders, repeated corner devices, continuous unintended seams, checkerboards or arbitrary directional dashes are rejection reasons.

## 18. No category progression on paperwork alone

The next Gold Slice category does not begin because a PR merged or CI passed.

The current category advances only when:

```text
source QA passed
AND production-file QA passed
AND map-context QA passed
AND live visual QA passed
```

A material-proof PASS alone does not complete the category.

## 19. Artist role is the execution authority

`ARTIST_AGENT_WORKFLOW.md` defines the required execution sequence for generation, inspection, extraction and integration. This addendum and the main validation rules define acceptance criteria. The Artist must use both.
