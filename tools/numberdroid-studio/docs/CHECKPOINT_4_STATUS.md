# Numberdroid Studio — Checkpoint 4 Candidate Record

- **Date:** 2026-08-23
- **Status:** implemented and locally/remotely verified as a candidate; explicit user acceptance remains combined with the deferred Checkpoint 2C and 3 decisions
- **Branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — remains open, draft, unmerged, and unreleased
- **Accepted prerequisites:** Checkpoints 1, 2A, and 2B; Checkpoints 2C and 3 remain verified but unaccepted candidates
- **Remote product candidate:** `7b5a82c6ed2a267076882d9f80417efe53eca993`
- **Remote candidate/CI:** run `32629426116` passed — root job `97169764514`, Studio job `97169764462`; no merge, release, runtime export, materialization, or publish is authorized

This record describes the Checkpoint 4 implementation candidate. It is automated evidence, not user acceptance. The candidate adds isolated delegated work and review control without widening finalization, export, publication, or Numberdroid runtime authority.

## Implemented outcome

1. A human-only task composer creates an `AgentTask` with one immutable main base revision, dedicated branch, agent identity, exact capability/object scopes, command/job/artifact/cost ceilings, expiry, and optional explicit low-risk auto-accept allowlist.
2. Schema v11 persists the task, immutable compare-and-swap branch revisions, monotonic timeline, versioned review records, merge lineage, and compensating reverts in STRICT tables.
3. Task pause, resume, cancel, reject, expiry, actor/branch/grant mismatch, and terminal state all fail closed before a branch write. Cancel/reject and merge revoke the task grant.
4. Review compares semantic `(entityType, entityId)` changes, surfaces main/branch overlap, and records per-change `USER_ACCEPTED`, `USER_REJECTED`, `CHANGES_REQUESTED`, or immutable `AUTO_ACCEPTED_BY_POLICY` dispositions.
5. Request-changes supersedes the current review and moves the task into an explicit resumable state. New branch work requires an owner resume and a new review.
6. Merge replays only accepted immutable branch commands in order against a disposable current-main simulation, then commits the accepted revisions, grant revocation, review disposition, task disposition, and merge record atomically.
7. Revert appends a new compensating semantic revision and immutable revert record. It preserves the original main, branch, review, and merge history.
8. The human UI exposes composition, authority/budget facts, branch states, controls, timeline, semantic conflicts, per-change review, merge, and revert. `Propose in draft` becomes available only for an actual matching task branch.
9. A task-bound official MCP host advertises 30 tools and five resource templates: the unchanged 19-tool/four-template Checkpoint 3 surface plus nine branch-safe direct room commands and `studio_task_read` / `studio_task_submit_for_review`. Owner decision, warning disposition, finalization, authority, merge, revert, export, and publish remain absent.
10. Portable bundle export rejects active/paused/review/changes-requested task branches and strips terminal task, grant, review, timeline, merge, revert, and HostBinding authority/history. Workspace integrity now checks the complete v11 task ledger.

## Deliberate bounded interpretation

The isolated branch may consume already committed source/atlas/slice results and can author V2 asset proposals and DRAFT rooms. Commands with shared external effects (`source.intake.commit`, `atlas.preview.slices`, and `atlas.commit.slices`) are rejected inside the task branch because the accepted v8 job table is main-revision-bound. Checkpoint 2B atlas jobs retain their existing visible progress and cooperative cancel/retry/discard controls on the authoritative workflow; this candidate does not falsely relabel those jobs as branch-local.

Consequently, the combined walkthrough uses a committed atlas result as its branch input. Provider generation, branch-local bitmap jobs, automatic finalization, bundle export while a branch is live, and production publishing remain out of scope. The user should decide at the combined gate whether a later branch-local job ledger is required before calling the broader roadmap wording “complete source-to-room” accepted.

## Deterministic task fixture

`scripts/prepare-checkpoint-4-visual-evidence.js` creates an exact revision-5 fixture with:

- two concurrent isolated source branches;
- one branch command followed by owner pause/resume, review, `USER_ACCEPTED`, atomic merge, and grant revocation;
- one later review containing exactly one `SEMANTIC_MERGE_CONFLICT` on `source:source.checkpoint-4.shared`;
- one `MERGED` task and one `IN_REVIEW` task, with their immutable timelines and review records intact.

The browser capture harness has a `checkpoint-4` mode that verifies both the conflict-focused and merged/revert-focused task views at 1440×900 and the protected 1060×900 width. The local cloud workspace had no Chrome binary and its Cloud Browser blocked loopback URLs, so the first fresh screenshot bytes came from the exact-head GitHub runner. Independent download inspection then found and drove two responsive fixes: compact task-state pills and a constrained one-column task-card layout below 1200px. The final capture asserts heading scroll containment and each pill's height, no-wrap state, and parent-card bounds.

Published artifact `9490652252` contains the exact revision-5 fixture, server log, four DOM/observation records, and four screenshots. The 930,348-byte archive independently matched `sha256:84e39e154f89c974f44d133ed63eb9b16fb5375b74322e77b1e7ab13d40d4e33`. All four observations report zero visual errors, zero horizontal overflow, zero header collisions, two task states, and contained 19px task-state pills; the conflict views expose exactly one semantic conflict and the merged views expose the accepted lineage/revert control.

## Verification ledger

- complete Studio Node suite after the v11 changes: **264/264 passed locally**; the protected Checkpoint 1A projection explicitly removes the additive empty task section just as it removes later job/asset/room sections;
- Checkpoint 4 domain/application/persistence/adversarial/HTTP/MCP/UI coverage: task bounds, authority mismatch, CAS races, pause/resume/cancel, request-changes, policy truthfulness, semantic conflicts, atomic merge fault rollback/retry, compensating revert, strict immutable ledgers, export quiescence, and v11 integrity;
- non-task Checkpoint 3 MCP discovery remains exactly 19 tools/four templates; task-bound discovery is exactly 30 tools/five templates;
- migration 0011 checksum is pinned; migrations 0001–0010 remain unchanged;
- syntax/check script includes every new C4 domain/application/persistence/evidence entrypoint;
- exact product-candidate CI `32629426116` passed both jobs; the dedicated C4 artifact and its digest were independently downloaded and inspected;
- earlier functionally green visual candidates were superseded after artifact review found wrapped pills and then a task-list heading/card overflow at 1060px. The geometric capture assertion intentionally failed until the protected-width card layout was contained; these diagnostic runs are not acceptance evidence.

## Combined 2C + 3 + 4 walkthrough

1. Confirm the Checkpoint 2C exact-slice V2 assets and rejected proposal item.
2. Confirm the Checkpoint 3 room/hallway canvas, exact pins, findings, applied set-dressing proposal, FINAL v5, and DRAFT fork v6.
3. In **Agent tasks**, inspect task scope, capabilities, budget, expiry, branch base/head, and monotonic timeline.
4. Pause and resume an active task; verify branch commands fail closed while paused and main remains unchanged.
5. Submit a branch, inspect its semantic diff, record per-change decisions, and confirm policy results are labelled `AUTO_ACCEPTED_BY_POLICY`, never human approval.
6. Inspect the concurrent same-object conflict and verify merge stays disabled/fails closed.
7. Merge accepted changes, confirm the task grant is revoked and the main revision batch is atomic, then invoke the compensating revert and inspect both original and revert history.
8. Confirm a live task prevents portable bundle export and a terminal task does not cross the sanitized bundle boundary.

## Live acceptance finding and repair — 2026-08-24

The Windows walkthrough exposed one real fail-closed UI defect and a broader language problem:

- the conflict task correctly contained one `SEMANTIC_MERGE_CONFLICT`, but the shared pending-control refresh reset the review button's semantic `disabled` state, so clicking **Merge accepted changes** still opened its confirmation;
- the application service would still have rejected the request, but the human UI must prevent an impossible action before confirmation;
- `IN_REVIEW`, task branches, grants, semantic comparison, atomic replay, and similar primary labels did not explain who should act next or what would happen.

The repair preserves a control's existing semantic disabled state when no task request is pending, marks only controls temporarily disabled by an in-flight task request, and independently checks merge readiness in the click handler before any confirmation. Real-browser Checkpoint 4 evidence now requires the conflicting task's completion control to remain disabled and verifies that a programmatic click opens zero confirmation dialogs.

The same repair begins the designer-facing language correction: the task state is shown as **Waiting for your review**, the project owner is named as the reviewer, the task list no longer presents its internal work branches as separate user objects, and completion explains that accepted changes enter the project, the task ends, and its assigned agent can no longer change it. Branch IDs, capability IDs, comparison revisions, and conflict codes remain available as secondary technical details.

This repair is a new candidate, not retroactive acceptance. The combined user gate remains open until the repaired conflict behavior is rebuilt and manually checked.

## Gate disposition

Checkpoint 4 is an implemented candidate, not an accepted checkpoint. The next decision is the deferred combined Checkpoint 2C + 3 + 4 user walkthrough, including the explicit branch-local-job boundary above. PR #135 stays draft, open, unmerged, and unreleased.
