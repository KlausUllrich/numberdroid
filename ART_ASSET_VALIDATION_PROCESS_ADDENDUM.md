# Numberdroid — Art Validation Process Addendum

Status: **binding supplement** to `ART_ASSET_VALIDATION_RULES.md`.

This addendum captures process failures observed during the Transfer Hall Gold Slice and closes the remaining loopholes in asset generation QA.

## 1. Production generation must not look like documentation

A production source is invalid if the generator renders any of the following unless explicitly requested as the asset itself:

- headings or captions;
- legends or explanatory prose;
- palette swatches;
- checklists or self-check boxes;
- numbered badges;
- technical specifications;
- UI/document panels;
- presentation or mood-board framing;
- file names, dates or metadata.

Production constraints belong in the prompt and Artist Task Card, **not in the pixels**.

## 2. One generation, then inspection

After one image-generation call, generation stops until the actual resulting image has been opened and inspected.

Do not issue a second image-generation call merely because the first output is obviously imperfect. First record why it failed and change the next brief/prompt accordingly.

This rule exists to prevent unexamined regeneration loops.

## 3. Explicit PASS/FAIL gate

Every generated source receives a real internal disposition:

```text
PASS — eligible for extraction
FAIL — do not extract or integrate
```

No ambiguous state such as “pretty good”, “usable as inspiration” or “we can probably crop it” is sufficient for production integration.

## 4. Source and production are different artifacts

A source can contain spacing around candidates for extraction, but the final runtime PNG must contain only the exact required production pixels/cells.

Both artifacts are inspected independently.

## 5. Floor candidate source contract

For the current Transfer Hall four-cell Floor task, the source generation itself should already be structurally simple:

- exactly four floor candidates;
- all four visually equal square candidates;
- one row or other trivially extractable regular arrangement;
- no non-floor content;
- no labels/documentation;
- no directional arrows;
- no corridor/junction pieces;
- no wall/door geometry;
- no props;
- no hero setpiece;
- no decorative variants without a named map purpose.

If these conditions fail, reject the source before cropping.

## 6. Floor function and colour contract

The four current functions are fixed:

```text
GID 1 — calm ceramic base
GID 2 — subtle non-directional service/SLOT marker
GID 3 — contained graphite functional recess
GID 4 — CORE/SLOT socket with warm amber identity
```

Teal is a sparse system signal, never the dominant floor material. Amber is reserved for CORE/Transfer meaning. The service cell must work when placed as a scattered generic variant in the current map; it therefore cannot rely on a continuous directional stripe.

## 7. Repetition must be judged before merge

For repeatable floor candidates, inspect:

- 3×3 repetition of the base;
- 3×3 repetition of each repeatable variant;
- actual mixed GID pattern from the Transfer Hall;
- final in-game room crop.

Strong square borders, repeated corner devices, continuous unintended seams, checkerboards or arbitrary directional dashes are rejection reasons.

## 8. No category progression on paperwork alone

The next Gold Slice category does not begin because a PR merged or CI passed.

The current category advances only when:

```text
source QA passed
AND production-file QA passed
AND map-context QA passed
AND live visual QA passed
```

Until then, Floor remains the current category.

## 9. Artist role is the execution authority

`ARTIST_AGENT_WORKFLOW.md` defines the required execution sequence for generation, inspection, extraction and integration. This addendum and the main validation rules define acceptance criteria. The Artist must use both.
