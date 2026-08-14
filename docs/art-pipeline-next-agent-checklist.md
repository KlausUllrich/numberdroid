# Next Agent Checklist — Numberdroid Controlled Art Pass

Use this checklist before continuing visual asset production.

## Before generation

- [ ] Read `skills/numberdroid-artist/SKILL.md`.
- [ ] Read the category contract, e.g. `TRANSFER_HALL_WALL_KIT.md`.
- [ ] Identify exact runtime size/grid and stable IDs.
- [ ] Define all required pieces by name before image generation.
- [ ] Create or reuse deterministic SVG/mask geometry.
- [ ] Render the guide at the intended image-generation canvas size.
- [ ] Show/open the guide and perform QA before image generation.

## Image edit

- [ ] Use the visible guide as the intended edit target.
- [ ] Ask only for material/surface quality.
- [ ] Forbid geometry/layout changes, text, labels, documentation, UI and bonus content.
- [ ] Generate exactly one result.
- [ ] Stop for QA.

## QA

- [ ] If the user says `QA`, do not generate anything.
- [ ] Report Material/Style PASS/FAIL separately from Production Geometry PASS/FAIL.
- [ ] Reject a newly invented composition as `FAIL — edit target not respected`.
- [ ] Inspect alpha and stray pixels, not only appearance.

## Restoration

- [ ] Map generated material back to deterministic coordinates.
- [ ] Reapply SVG-derived Structural Mask.
- [ ] Reapply Connector Guard Zones.
- [ ] Remove all stray alpha.
- [ ] Only then downscale to runtime size.

## Final validation

- [ ] Inspect at 100% runtime size.
- [ ] Test repeated/connected neighbors.
- [ ] Test the actual map context.
- [ ] Integrate without changing collision/layer contracts to rescue art.
- [ ] Inspect live room.
- [ ] Run tests/build/Pages.
- [ ] A merge does not equal visual acceptance.

## Never repeat these failures

- prompt for a precision atlas directly from text;
- mix categories in one generated sheet;
- accept dimensions because generated labels claim them;
- call image generation during QA;
- silently regenerate after failure;
- trust generated alpha/silhouette as final geometry;
- allow rounded modular connector ends;
- use a small guide and let the generator freely resize it;
- create presentation/mood-board pixels when production art was requested.
