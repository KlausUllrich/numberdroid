# Numberdroid — Live QA Iteration Classification

Status: **binding production addendum for generated/production Props, Hero setpieces and Prop-like movable components**

Purpose: prevent the wrong kind of iteration after deployed visual QA. This rule supplements `PROP_ASSET_WORKFLOW.md`; the stricter rule wins.

## 1. Classify before changing anything

When live QA reports a problem, classify it before regenerating/editing source art.

```text
A. FUNCTION / SOURCE DESIGN
B. PERSPECTIVE / STYLE
C. RUNTIME CROP / SCALE / PADDING
D. PLACEMENT / ROOM COMPOSITION
E. COLLISION / USE-SPACE
F. SHADOW / GROUNDING
G. MOVABLE FX / CHOREOGRAPHY
```

Do not skip this classification merely because image generation is available.

## 2. When source generation is appropriate

A new source generation/edit is normally justified only for **A or B**:

- the functional form is wrong or misleading;
- proportions inside the object are wrong in a way runtime scaling cannot solve;
- the silhouette cannot deliver the intended hierarchy at a believable physical scale;
- perspective/camera logic is wrong;
- material/style language is wrong at source level.

Generation remains subject to the standalone `generieren` gate.

## 3. Runtime scale problems are not source problems

If the design is good but appears too large/small in world space:

```text
KEEP APPROVED SOURCE
→ change deterministic production Crop/Fit / runtime canvas / world envelope
→ rebuild
→ live QA again
```

Do **not** regenerate the full-resolution source merely to resize it.

If the physically plausible runtime scale then makes the object too visually weak, ask a separate question:

> Is the Hero underwhelming because it is physically too small, or because the source uses its believable footprint poorly?

If the latter, a source redesign may then be justified.

## 4. Physical scale and Hero prominence are separate

Hero importance should be achieved through:

- silhouette breadth/mass;
- strong internal hierarchy;
- focal contrast;
- meaningful support cluster;
- room composition / breathing space;
- restrained lighting/grounding hierarchy.

Do not inflate one functional sub-part (for example a Human bed) merely to make the overall object feel important.

## 5. Collision / use-space problems use authored geometry

A visual object may have transparent whitespace inside a rectangular runtime canvas.

If coarse collision blocks usable whitespace or allows movement across visible machine mass:

- refine authored collision metadata;
- multipart rectangles or deterministic occupancy/silhouette masks are valid;
- raster alpha may inform authoring but is **not runtime collision authority**;
- normal movement collision and scripted choreography are separate concerns.

Do not regenerate the image merely to make collision easier.

## 6. Shadow problems remain separate

Shadow/grounding does not justify source regeneration unless the source itself contains an inseparable invalid baked shadow.

Preferred sequence:

```text
SOURCE ACCEPTED
→ useful runtime scale accepted
→ derive/author separate shadow
→ combined live QA
```

Finalize shadow after runtime scale convergence to avoid unnecessary rework.

## 7. Movable components should not be forced into static Prop semantics

If a visual component must move between environmental machinery and actors, evaluate whether it should be a separate movable visual/FX/staged actor rather than a normal Prop.

Example proven by TS-01:

```text
Transfer Apparatus = normal accepted environmental Prop
Yellow Core         = separate transfer-fx movable visual
```

A stationary initial state does not imply a static lifecycle.

## 8. Required live-QA response discipline

For a live-QA change request, the implementation response should state internally/explicitly as appropriate:

```text
CLASSIFICATION: <A-G>
SOURCE CHANGE REQUIRED: YES / NO
RUNTIME/SPATIAL CHANGE: <what>
REGENERATION AUTHORIZED: only if hard generation gate is satisfied
```

This avoids repeating the Transfer-Apparatus mistake where a runtime-scale complaint was initially answered with unnecessary source regeneration.

## 9. Evidence record

The production case that established these rules is:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`
