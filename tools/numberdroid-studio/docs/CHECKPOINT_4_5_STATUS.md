# Numberdroid Studio — Checkpoint 4.5 Candidate Record

- **Date:** 2026-08-24
- **Status:** implemented and CI/browser-verified repair candidate; awaiting explicit user acceptance; not merged and not authorized for Checkpoint 5
- **Branch:** `agent/numberdroid-studio-checkpoint-4-5`
- **Product/evidence head:** `4dc112d5aa88aa3d6629c5d1949dfa38d7963642`
- **Accepted baseline:** Checkpoints 1–4 on merge `bcc284684ea4d2e30158d3a20ebda57da77df93d`
- **Frozen contract:** `CHECKPOINT_4_5_CONTRACT.md`

This record does not claim acceptance from tests, CI, reviewer agreement, or silence. It records the bounded implementation candidate that the user must still exercise and accept.

## Implemented outcome

1. Agent tasks are list-first. Creation is a separate focused step, and one selected-task view contains current state, who acts next, the consequence, relevant controls, review, and the real durable timeline. Internal branch/capability/revision identifiers remain in closed technical details.
2. Expiry truth is projected by the trusted task service rather than the browser clock. Conflict completion remains disabled before confirmation, reject is explicit, and undo appears only before a compensating revert exists. The accepted pending-control restoration behavior is unchanged.
3. A reusable useful-asset preview shows the exact project-scoped slice without cropping, its tile footprint/grid, authored anchor, permitted rotations, collision/navigation effect, and wall/ground suitability before proposal acceptance or room placement. Missing exact imagery remains inspectable/rejectable but cannot be accepted or placed.
4. Rooms use one image-editor-style surface: a persistent canvas, a left toolbox for floor/outside/blocked painting plus entrance/surface/prop placement, contextual options and explicit save state above it, and a right dock for tool options, purpose/settings, selection, and checks. Changing tools or dock panels no longer replaces the canvas.
5. Room versions add normalized sparse `voidCells` and `blockedCells`. `VOID` is outside the room; `BLOCKED` remains an in-room surface cell but excludes navigation and set dressing. The masks are disjoint, bounded, sorted, connected through the remaining room envelope, immutable per version, and visible with text plus non-colour-only patterns.
6. Shape replacement is an exact owner-only command and same-origin CSRF route. It is absent from agent MCP catalogs and does not widen task authority.
7. Migration `0012_room_shape_cells.sql` adds the STRICT normalized shape ledger. Rectangular projects remain portable schema v2; projects that actually use a shape mask use schema v3. Import, restart, integrity, tamper checks, transaction faults, and canonical round trips cover both paths.

## Verification ledger

- full local Studio suite: **279/279 passed** after the persistent-editor and race-safe focus repairs;
- complete syntax check passed through the package's explicit `node --check` list;
- focused CP4.5 domain/application/persistence/HTTP/UI tests cover mask invariants, owner-only authority, exact route bodies, migration rollback/resume, append rollback, restart/integrity, schema-v2 rectangle parity, schema-v3 import/export, task expiry projection, list/create/detail flow, useful previews, and protected-width layout;
- the deterministic CP4.5 fixture reached project revision 36 with two `VOID` cells, one `BLOCKED` cell, an unchanged rectangular hallway, and one exact-version 2×3 prop sourced from the repository's already approved Transfer Apparatus image without provider or generation work;
- a local schema-v3 bundle export/import/export round trip was canonical and byte-identical with integrity green and no transferred live authority;
- GitHub Actions run [`32745196682`](https://github.com/KlausUllrich/numberdroid/actions/runs/32745196682) passed at the exact product/evidence head: root build/tests, Linux Studio tests/build/browser capture, and Windows Studio tests/build/evidence verification are green; Pages was intentionally skipped;
- Chrome evidence at 1440×900 and 1060×900 exercises fresh irregular-room and rectangular-room views, a rotated real-prop preview, shape-draft refresh, concurrent-shape conflict, physical pointer painting through visible hit-transparent overlays, exact mutually exclusive floor/outside/blocked partitions, one persistent canvas across tools/docks/layers, positive keyboard-focus restoration, and a deliberate canvas-focus handoff that must not be stolen by a delayed render repair;
- valid artifact [`9526941679`](https://github.com/KlausUllrich/numberdroid/actions/runs/32745196682/artifacts/9526941679), `numberdroid-studio-checkpoint-4-5-evidence`, is 2,747,286 bytes, has digest `sha256:f1a7d1cc960a0702e4f0b56703b359dcb54d675ef65c5d82f3a716d565d88f32`, and expires 2026-09-07T15:34:44Z;
- three independent bounded reviews returned GO for the persistent editor's task/UI, room/asset/evidence, and contract/authority/persistence slices; the focused follow-up review first rejected a focus-stealing race, then returned GO only after the generation and active-element guards plus negative browser proof were added;
- the earlier six-step evidence is superseded by the user's live-gate rejection and is not acceptance evidence for the repaired editor;
- failed diagnostic run `32743852383` is not acceptance evidence; it exposed the repaired Prop-tool focus instability that the final green run proves closed.

## Preserved boundary

Checkpoint 4.5 adds no provider, generation, source-intake, atlas job, agent finalization, export, materialization, repository write, or publication capability. It does not reopen the accepted Checkpoint 1–4 behavior unless a regression test or live walkthrough demonstrates an actual regression. Checkpoint 5 remains blocked.

## Required user gate

1. Open **Agent tasks** and confirm list → focused creation → one selected task flow, including next actor, consequence, conflict-disabled completion, rejection, and one-time undo.
2. In **Rooms**, confirm the canvas is already visible and remains visible while switching between the seven toolbox tools and the Purpose/Check dock panels.
3. Paint one cell outside, blocked, then room floor with a real pointer; confirm the cell changes immediately, exactly one tool is selected, and the counts always sum to the envelope.
4. Confirm existing surface/prop/connector overlays are visibly ghosted and do not intercept shape painting; the empty orange conflict bar must be absent.
5. Confirm dirty/save/reload/conflict state is explicit above the canvas, resize and other mutations are blocked while shape is dirty, and Purpose/Check remain dock panels rather than page tabs.
6. Inspect a prop from the **Prop** tool; confirm the exact image, footprint, anchor, rotation, collision/navigation, and placement readiness are useful before acting.

Only explicit user acceptance closes this gate. Merge, Checkpoint 5, release, and publication require separate decisions.
