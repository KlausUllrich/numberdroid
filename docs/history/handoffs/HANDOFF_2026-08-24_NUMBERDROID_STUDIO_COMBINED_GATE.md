# Numberdroid Studio — handoff after the accepted Checkpoint 2C + 3 + 4 gate

## Canonical state

- Repository: `KlausUllrich/numberdroid`
- Canonical starting branch: `main`
- Merged PR: `#135`
- Merge commit: `bcc284684ea4d2e30158d3a20ebda57da77df93d`
- Accepted repaired product head: `311581b42cf6bf6d4050132ec498dc61036e26e6`
- Acceptance CI: run `32673522709`
- Acceptance date: 2026-08-24
- Checkpoints 1, 2A, 2B, 2C, 3, and 4 are explicitly user-accepted.
- PR #135 was explicitly authorized and merged on 2026-08-24. Start new work from current `main` at or after the merge commit above; do not continue the former feature branch as the canonical line.

The acceptance documentation closed the user gate, and the later explicit user decision authorized only the merge of PR #135. It did not authorize release, provider work, Numberdroid/runtime export, materialization, publication, or a new persistence migration.

## What the user accepted

Checkpoint 2C:

- exact committed-slice `surface`, `prop`, and `item` assets;
- Calm Grid and Sterile Grid Family Hygiene families;
- human-facing ordinal slice labels with stable machine IDs secondary;
- typed metadata, deterministic findings, complete proposal decisions, and atomic accepted-subset apply;
- sanitized, project-scoped portable Studio bundle behavior.

Checkpoint 3:

- bounded room and hallway archetypes/variants;
- exact asset/version pins, connectors, placements, deterministic findings, and structured alternatives to the canvas;
- retained rejected set-dressing proposal item and reason;
- owner-only validation/finalization, immutable FINAL version 5, and explicit DRAFT version 6 fork.

Checkpoint 4:

- owner-created, bounded agent tasks with isolated branch state and fail-closed authority;
- pause/resume/cancel, timeline, semantic comparison, owner decisions, fresh conflict detection, atomic accepted-change merge, and compensating revert;
- completion revokes the assigned task grant, so the agent can no longer change the completed task;
- current task branches consume committed atlas/slice inputs. Branch-local bitmap jobs are not part of the accepted implementation.

The last live defect was real but UI-only: the shared pending-control refresh re-enabled a conflict-disabled completion button. The service still rejected the operation. The accepted repair preserves semantic disabled state and independently checks readiness before confirmation. The user rebuilt the repaired head on Linux and reported `pass`.

## Acceptance verification

Run `32673522709` passed:

- root build/test job;
- Studio job under Node 22.22.0 with 266/266 tests;
- Windows job under the user's Node 22.17.0 with 266/266 tests;
- real Chrome Checkpoint 4 conflict and completed-task captures at 1440×900 and 1060×900.

Checkpoint 4 artifact:

- ID: `9502075249`
- size: 910,417 bytes
- SHA-256: `c6749e0581ea42f74d6beda0f660159218129ceebb8fe17c63478df19b3118a5`

The accepted browser evidence requires the conflicting completion control to remain disabled and a programmatic click to open zero confirmation dialogs. Descriptive task-state labels must remain contained at the protected 1060px width and may wrap cleanly.

## Read before doing work

Read these files completely and in this order:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`
6. `tools/numberdroid-studio/README.md`
7. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
8. `tools/numberdroid-studio/docs/ROADMAP.md`
9. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
10. `tools/numberdroid-studio/docs/CHECKPOINT_2C_CONTRACT.md`
11. `tools/numberdroid-studio/docs/CHECKPOINT_2C_STATUS.md`
12. `tools/numberdroid-studio/docs/CHECKPOINT_3_CONTRACT.md`
13. `tools/numberdroid-studio/docs/CHECKPOINT_3_STATUS.md`
14. `tools/numberdroid-studio/docs/CHECKPOINT_4_CONTRACT.md`
15. `tools/numberdroid-studio/docs/CHECKPOINT_4_STATUS.md`
16. this handoff.

Then inspect the actual implementation relevant to the proposed Checkpoint 4.5 contract:

- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/packages/domain/src/asset-definition.js`
- `tools/numberdroid-studio/packages/domain/src/room-definition.js`
- `tools/numberdroid-studio/packages/domain/src/agent-task.js`
- `tools/numberdroid-studio/packages/application/src/agent-task-service.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`

Trigger-specific references:

- Before changing asset preview or approval behavior, reread the Checkpoint 2C contract/status and the asset definition/application/persistence tests.
- Before changing room shape, grid, connector, placement, or validation semantics, reread the Checkpoint 3 contract/status and all Checkpoint 3 domain/application/persistence/UI tests.
- Before changing task states, authority, review, merge, or revert, reread the Checkpoint 4 contract/status and all Checkpoint 4 domain/application/adversarial/HTTP/MCP tests.
- Before proposing Numberdroid export or repository materialization, stop: that is Checkpoint 5 and is not part of the next checkpoint.
- Before editing Git state or GitHub, follow `docs/agents/REPOSITORY_WORKFLOW.md`; use the GitHub connector for ordinary remote operations and preserve user worktrees.

## Next checkpoint: 4.5 — Designer workflow and preview usability

Do not begin by changing persistence or implementing a broad redesign. First produce a bounded Checkpoint 4.5 contract and a small visual/workflow proposal for user review.

Required outcomes:

1. The task list is the normal entry view and contains the primary **Create task** action.
2. Task creation is a separate focused step or dialog, not a permanently dominant form.
3. Selected-task detail, progress, review, completion, and undo read as one state-driven workflow.
4. Every primary label explains the current state, responsible actor, next decision, and practical consequence in professional plain language.
5. Internal branch, grant, provenance, immutable, atomic, semantic, CAS, command, revision, and rule terminology is optional technical detail, not required workflow vocabulary.
6. Healthy integrity/provenance facts are quiet confirmations. Warnings appear when something is missing, inconsistent, unsafe, or requires a decision.
7. Props have a human-usable preview build before placement or approval. The contract must define the minimum useful preview with the user before implementation.
8. Room construction becomes a guided flow.
9. Irregular-room authoring explicitly distinguishes `VOID` cells outside the room from `BLOCKED` cells that belong to the room but cannot be crossed.

User verification for 4.5 must let the user begin from the task list, create a task in a focused step, understand who acts next without opening technical details, inspect a useful prop preview, and build both a rectangular and irregular room.

## Important product feedback to preserve

The user said the UI felt technical and did not show how a human or agent actually builds a room. They interpreted multiple cards as unrelated tasks and found `branch` misleading as a primary product term. They expect the create action beside the task list and prefer fewer elements chosen for the current process step.

Use professional language, not childish simplification. For example:

- prefer **Waiting for your review** over `IN_REVIEW`;
- explain that completing the task prevents the assigned agent from changing it further instead of saying only that a grant is revoked;
- do not present “reproducible provenance” as a normal proof obligation. Explain the useful result, and warn only when origin/recreation information is incomplete.

## Boundaries for the next agent

Do not:

- reopen accepted Checkpoints 1–4 without a reproducible regression;
- start Checkpoint 5 export, repository materialization, or publication;
- add provider/network generation;
- widen agent finalization, lifecycle, review-decision, merge/revert, export, or publish authority;
- invent branch-local image jobs;
- change room persistence for irregular geometry before the `VOID`/`BLOCKED` contract is reviewed;
- hide technical diagnostics entirely—keep them under optional disclosure;
- treat green CI as user acceptance.

## Recommended first response from the next agent

1. Confirm current `main` contains merge commit `bcc284684ea4d2e30158d3a20ebda57da77df93d` and inspect the latest CI before creating a fresh Checkpoint 4.5 branch.
2. Summarize the accepted boundaries and the Checkpoint 4.5 feedback.
3. Present a small contract/wireflow proposal for task list → task creation → progress → review → completion, plus explicit questions for prop preview and `VOID`/`BLOCKED`.
4. Wait for user approval of that contract before implementing Checkpoint 4.5.
