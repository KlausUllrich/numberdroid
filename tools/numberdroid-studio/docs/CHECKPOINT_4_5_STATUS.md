# Numberdroid Studio — Checkpoint 4.5 Candidate Record

- **Date:** 2026-08-24
- **Status:** implemented and CI-verified candidate; not user-accepted, not merged, and not authorized for Checkpoint 5
- **Branch:** `agent/numberdroid-studio-checkpoint-4-5`
- **Accepted baseline:** Checkpoints 1–4 on merge `bcc284684ea4d2e30158d3a20ebda57da77df93d`
- **Frozen contract:** `CHECKPOINT_4_5_CONTRACT.md`

This record does not claim acceptance from tests, CI, reviewer agreement, or silence. It records the bounded implementation candidate that the user must still exercise and accept.

## Implemented outcome

1. Agent tasks are list-first. Creation is a separate focused step, and one selected-task view contains current state, who acts next, the consequence, relevant controls, review, and the real durable timeline. Internal branch/capability/revision identifiers remain in closed technical details.
2. Expiry truth is projected by the trusted task service rather than the browser clock. Conflict completion remains disabled before confirmation, reject is explicit, and undo appears only before a compensating revert exists. The accepted pending-control restoration behavior is unchanged.
3. A reusable useful-asset preview shows the exact project-scoped slice without cropping, its tile footprint/grid, authored anchor, permitted rotations, collision/navigation effect, and wall/ground suitability before proposal acceptance or room placement. Missing exact imagery remains inspectable/rejectable but cannot be accepted or placed.
4. Room construction is guided through **Purpose → Shape → Entrances → Surfaces → Props → Check**. Each step exposes the relevant authoring surface and states who acts next.
5. Room versions add normalized sparse `voidCells` and `blockedCells`. `VOID` is outside the room; `BLOCKED` remains an in-room surface cell but excludes navigation and set dressing. The masks are disjoint, bounded, sorted, connected through the remaining room envelope, immutable per version, and visible with text plus non-colour-only patterns.
6. Shape replacement is an exact owner-only command and same-origin CSRF route. It is absent from agent MCP catalogs and does not widen task authority.
7. Migration `0012_room_shape_cells.sql` adds the STRICT normalized shape ledger. Rectangular projects remain portable schema v2; projects that actually use a shape mask use schema v3. Import, restart, integrity, tamper checks, transaction faults, and canonical round trips cover both paths.

## Verification ledger

- full local Studio suite: **278/278 passed** after the implementation;
- complete syntax check passed through the package's explicit `node --check` list;
- focused CP4.5 domain/application/persistence/HTTP/UI tests cover mask invariants, owner-only authority, exact route bodies, migration rollback/resume, append rollback, restart/integrity, schema-v2 rectangle parity, schema-v3 import/export, task expiry projection, list/create/detail flow, useful previews, and protected-width layout;
- the deterministic CP4.5 fixture reached project revision 36 with two `VOID` cells, one `BLOCKED` cell, an unchanged rectangular hallway, and one exact-version 2×3 prop sourced from the repository's already approved Transfer Apparatus image without provider or generation work;
- a local schema-v3 bundle export/import/export round trip was canonical and byte-identical with integrity green and no transferred live authority;
- CI captures fresh irregular-room, rectangular-room, rotated real-prop preview, shape-draft refresh, keyboard-focus, concurrent-shape-conflict, and focused task-create/review evidence at 1440×900 and 1060×900;
- published GitHub Actions run `32723226568` passed the root, Linux Studio, and Windows Studio jobs. The Linux Studio job passed the complete 278-test suite, build, all protected browser assertions, and every evidence upload;
- Checkpoint 4.5 evidence artifact `9518665004` is 2,648,290 bytes with `sha256:a486b260a17e5233d3c9bb622a33cce0073bd058c7f5ea710a2b70986f8b4ae9` and expires on 2026-09-07. This automated evidence does not replace the required user walkthrough or acceptance.

## Preserved boundary

Checkpoint 4.5 adds no provider, generation, source-intake, atlas job, agent finalization, export, materialization, repository write, or publication capability. It does not reopen the accepted Checkpoint 1–4 behavior unless a regression test or live walkthrough demonstrates an actual regression. Checkpoint 5 remains blocked.

## Required user gate

1. Open **Agent tasks** and confirm list → focused creation → one selected task flow, including next actor, consequence, conflict-disabled completion, rejection, and one-time undo.
2. Inspect a prop in the asset proposal and room **Props** step; confirm the exact image, footprint, anchor, rotation, collision/navigation, and placement readiness are useful before acting.
3. Open the rectangular hallway's **Shape** step and confirm zero outside/blocked cells preserve the accepted rectangle.
4. Open the irregular room's **Shape** step and confirm `OUT`, `BLOCKED`, and ordinary room cells are distinguishable without colour alone; save/reload a complete shape if desired.
5. Confirm **Entrances**, **Surfaces**, **Props**, and **Check** explain the next action and respect the new cell semantics.

Only explicit user acceptance closes this gate. Merge, Checkpoint 5, release, and publication require separate decisions.
