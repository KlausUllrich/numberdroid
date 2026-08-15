# Numberdroid — Game Design Authority Router

Status: **current game-design index / authority router**

This file intentionally does not duplicate all confirmed rules. Use the smallest current document that owns the decision being made.

## Durable gameplay / UX invariants

Use:

- `../agents/GAMEPLAY_AND_ENGINEERING_RULES.md`

for confirmed runtime/gameplay rules such as movement, health, saves, body ownership colours, Number Duel invariants and current ability/resource contracts.

## Level / room design

Use:

- `LEVEL_DESIGN_RULES.md`

for reusable spatial design: function-before-form, zoning, circulation, adjacency, edge-first furnishing, symmetry/asymmetry, blockout discipline and room-level QA.

Milestone-specific application remains in the relevant planning document, for example:

- `../planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

## Specialized current design documents

- `CAMPAIGN_PROGRESSION.md` — broader progression structure;
- `ENCOUNTER_ARCHETYPES.md` — encounter behavior families;
- `LEARNING_PROFILES.md` — personal math roles/difficulty envelopes;
- `MENU_HUB_FLOW.md` — title/profile/settings/hub/resume/archive flow.

Story/world decisions live under `../story/` and should be read when a gameplay/level decision changes narrative meaning or beat sequencing.

## Runtime authority

Current clean implementation in `../../src/` is the authority for what is actually playable now, subject to explicitly confirmed design contracts above.

The frozen `zahlenkern-prototyp-meta-v7.html` remains a behavioral/reference artifact only. Do not promote old prototype placeholders into production rules merely because they appear there.

Historical handoffs under `../history/` are task snapshots/evidence, not current game-design authority by default.
