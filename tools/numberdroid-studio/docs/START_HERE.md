# Numberdroid Studio — Start here

Status date: 2026-09-06. This is the current task router; linked contracts own
semantics, status records own evidence, and current source owns implementation.
Reverify remote `main`, relevant PRs and Actions through the GitHub connector.

## Current direction

Klaus requested unattended cleanup and development toward a Studio usable for
Numberdroid authoring. He deferred the remaining live checks as nonblocking for
authorized development. **VT-001 / CP4.5 remains REVISE, not user accepted.**
The next blocks should produce usable, reviewable improvements with focused
verification. The [return backlog](VACATION_TEST_BACKLOG.md#vt-001--cp45-desktop-designer-gate)
retains the exact remaining human checks; repeat passed behavior only for a
concrete regression or changed risk.

The [Room status](ROOM_EDITOR_L3_STATUS.md) records PR #206's refreshed,
unchanged green integration at `034bc4604338e391a2455d42e03a12a5b27d0ed3`.
This is a recorded source baseline, not a permanently current `main` pointer.

## What can be used

The human-local path already supports PNG intake, deterministic PNG cutting,
semantic Assets, footprint/anchor/rotations, Room placement, save/restart,
read-only Studio Preview, integrity and backup/restore-as-copy. Preview is
engine-neutral and approximate; it is not Numberdroid runtime output.

Checkpoints 1–4, A1.0–A1.2, VT-012 Backups and bounded VT-014 Candidate/child
behavior remain accepted. A1.3–A1.6b2b are implemented candidates. A1.7 remains
REVISE: feedback cannot yet be authored properly and Resume does not start a
real agent. Do not describe a complete agent-assisted Artist loop.

The root `npm run studio` launcher starts selected local worktrees as-is and
offers fresh task and Room/Preview fixtures. See the [launcher instructions](../README.md#launch-one-or-more-worktrees-for-safe-comparison).
Fixture helpers must never target a personal or existing workspace, backup or
restored copy. Preserve uncertain local data and unrelated dirty worktrees.
A future real production pilot needs an explicitly selected source and a named
persistent data directory outside the repository and outside `/tmp`.

## Read for the actual task

Complete the repository [universal bootstrap and role route](../../../docs/agents/ROLE_ENTRYPOINTS.md)
once for the session, then select the row below. Add documents only for concrete
domain triggers. Within a continuing task, retain already-read current contracts;
after compaction reverify continuity and reload the selected task context.

| Task | Read before changing it |
| --- | --- |
| Documentation or integration | This router, directly affected current status/contract, actual diff and selected verification policy. Use [Roadmap](ROADMAP.md) or the [development plan](../../../docs/planning/DEVELOPMENT_PLAN_NEXT.md) only for sequencing decisions. |
| Launcher or working-project usability | [README](../README.md), actual launcher/server scripts and focused tests; [backup/recovery contract](O0_BACKUP_RECOVERY_CONTRACT.md) when existing data, restore or activation is involved. |
| Room, task or Preview behavior | [CP4.5 contract](CHECKPOINT_4_5_CONTRACT.md), [Room status](ROOM_EDITOR_L3_STATUS.md), the directly affected implementation and tests; add [Architecture](ARCHITECTURE.md) sections for changed seams. |
| Processing or agent workflow | The exact A1 contract/status linked by [README](../README.md); [A1.7 state contract](A1_7_STATE_CONTRACT.md) for correction/review state; add [MCP contract](MCP_CONTRACT.md) and authority/persistence contracts when those boundaries change. |
| New product scope | [Vision](VISION.md), relevant [Requirements](REQUIREMENTS.md) sections and owning contract; state the bounded promise before implementing. |
| Production art or runtime integration | Activate the full applicable Artist, Technical Artist or Engineering route in the repository role router before the cross-domain decision. |

A named handoff is read after current binding documents as its task snapshot.
Do not load every historical checkpoint, A1 status, operations plan or art
contract merely because Studio contains those domains. This router does not
waive a triggered contract or an explicitly named reading requirement.

## Separate decisions remain separate

Deferred live testing does not grant acceptance or widen agent/owner authority.
Image generation retains its exact current-message gate. Materialization into
Numberdroid, publication/release, provider egress/cost, remote exposure,
destructive cleanup and restore activation require their own explicit authority.
Do not begin A5/A6, 2.5D or remote/mobile work automatically. Source integration,
automated green, individual live passes and milestone acceptance remain distinct.
