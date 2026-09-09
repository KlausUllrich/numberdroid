# Numberdroid Studio — Start here

Status date: 2026-09-09. This is the current task router; linked contracts own
semantics, status records own evidence, and current source owns implementation.
Reverify remote `main`, relevant PRs and Actions through the GitHub connector.

## Current direction

Klaus has returned to attended product/design work. His 2026-09-07 direction
supersedes unattended UI implementation: discuss each screen's goals and behavior,
agree on a mockup, update the repository documentation, then implement and verify.
Read the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md) for the approved
source/asset/assembly model, flexible agent-change review, contextual editors and
optional project-specific authoring modules. Klaus passed the complete cutter v3
mockup; [Cutter Editor Design](CUTTER_EDITOR_DESIGN.md) owns its approved behavior.
Klaus also passed the Placement & blocking walkthrough and the requested Oval /
Shift refinements; [Placement & Blocking Editor Design](PLACEMENT_BLOCKING_EDITOR_DESIGN.md)
owns that approved screen. Mockup approval alone does not establish
implemented-workflow or milestone acceptance. Klaus also passed the five Assembly walkthrough checks;
[Assembly Editor Design](ASSEMBLY_EDITOR_DESIGN.md) records component references,
variant/state preview and inherited/custom blocking. Klaus has now passed the
shared Review batch; [Review Changes Design](REVIEW_CHANGES_DESIGN.md) records
comparison, dependencies, full/partial acceptance, feedback, discard and stale
proposal handling. All four editor mockups are approved. The exact-version prerequisite is now
source-integrated: [Pinned Asset reads](ROOM_PINNED_ASSET_READ_CONTRACT.md) preserves
saved Room images and geometry after Library updates. The completed
block is the Asset placement/blocking editor and removal of the
Activity sidebar. [Its implementation contract](ASSET_EDITOR_IMPLEMENTATION_CONTRACT.md)
owns direct human Save, compatible spatial geometry and exact version history.
Klaus passed the implemented Cutter batch on 2026-09-08; saved cut names now carry
into new Asset drafts. Native editor checks and the real-agent correction/review
proof passed on 2026-09-09. PR #227 is merged and post-merge green; Klaus then
reported **“all pass”** on clean main `93652c2`, accepting VT-020. The Asset editor
and sidebar removal are accepted foundations. Assembly is the next approved
design block; shared Review implementation follows separately.

The primary proof is a real agent using Studio's semantic interface, correcting
technical findings and reading saved review feedback/decisions before Klaus is
asked to verify the workflow. Mockup clicks and scripted fixtures alone do not
prove that loop. Existing unmerged UI candidates must be reconciled with the
agreed design before integration.

**VT-001 / CP4.5 remains REVISE, not user accepted.** Earlier deferral of remaining
live checks allowed bounded development; it did not grant acceptance. The
[return backlog](VACATION_TEST_BACKLOG.md#vt-001--cp45-desktop-designer-gate)
retains the exact human gates. Repeat passed behavior only for a concrete
regression or changed risk; apply the binding risk policy to the actual diff.

The [Room status](ROOM_EDITOR_L3_STATUS.md) records PR #206's refreshed,
unchanged green integration at `034bc4604338e391a2455d42e03a12a5b27d0ed3`.
This is a recorded source baseline, not a permanently current `main` pointer.

## Current implementation sequence — 2026-09-09

The [CI startup/upload repair](CI_BROWSER_EXECUTION.md) is merged through PR #226.
The [Asset editor](ASSET_EDITOR_IMPLEMENTATION_CONTRACT.md) is merged through
PR #227, post-merge green, and user accepted as VT-020. Activity is available from
main navigation; the duplicate sidebar is removed. Preserve accepted Cutter and
Asset-editor behavior.

Active block: the [approved Assembly editor](ASSEMBLY_EDITOR_DESIGN.md), authorized
by Klaus on 2026-09-09. Its [implementation contract](ASSEMBLY_EDITOR_IMPLEMENTATION_CONTRACT.md)
records exact component references, transforms, inherited/custom blocking,
state/variant preview, save and review before source work. Reuse
exact saved Asset versions and the accepted geometry editor. Keep the same real-agent
proof before Klaus's next batch. Agent proposals retain owner review; runtime
materialization, image generation and publication keep their separate gates.

## What can be used

The human-local foundations support PNG intake, deterministic PNG cutting,
semantic Assets, footprint/anchor/rotations, Room placement, save/restart,
read-only Studio Preview, integrity and backup/restore-as-copy. The missing
human path from a saved slice to a directly saved DRAFT Asset is now
[user accepted](HUMAN_ASSET_AUTHORING.md), with real-agent, Room-pin and restart
proof. Preview is engine-neutral
and approximate; it is not Numberdroid runtime output.

Checkpoints 1–4, A1.0–A1.2, VT-012 Backups and bounded VT-014 Candidate/child
behavior remain accepted. A1.3–A1.6b2b are implemented candidates. A1.7 remains
REVISE. The [generic task review feedback candidate](TASK_REVIEW_FEEDBACK.md)
now supports a summary and item comments against an exact review version and
labels continuation truthfully. Local regression and browser proof passed;
CI/source integration are recorded in its PR and the live gate remains deferred.
Resume starts no real agent. Do not describe a complete agent-assisted
Artist loop.

The root `npm run studio` launcher starts selected local worktrees as-is. Its
persistent-project candidate creates a named empty working project or reopens
its verified saved directory; separate test mode offers fresh task and
Room/Preview fixtures and the separate `review-feedback` fixture. See the [launcher instructions](../README.md#launch-one-or-more-worktrees-for-safe-comparison)
and VT-015 in the [return backlog](VACATION_TEST_BACKLOG.md).
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
| Cutter editor | [Cutter Editor Design](CUTTER_EDITOR_DESIGN.md), [accepted cutter requirements](REQUIREMENTS.md#53-atlas-cutter), actual cutter commands/UI/tests; add the asset/persistence/MCP contracts only when those seams change. |
| Placement / blocking editor | [Placement & Blocking Editor Design](PLACEMENT_BLOCKING_EDITOR_DESIGN.md), [asset contract](CHECKPOINT_2C_CONTRACT.md), actual geometry and consumers; add persistence, MCP and adapter contracts when those boundaries change. |
| Assembly editor | [Assembly Editor Design](ASSEMBLY_EDITOR_DESIGN.md), [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md), directly affected component/geometry consumers; add storage, capability and MCP contracts before changing those seams. |
| Shared Review changes | [Review Changes Design](REVIEW_CHANGES_DESIGN.md), [2C contract](CHECKPOINT_2C_CONTRACT.md), [task feedback](TASK_REVIEW_FEEDBACK.md), affected task/application commands and tests; add authority, persistence and MCP contracts before evolving those seams. |
| Room, task or Preview behavior | [CP4.5 contract](CHECKPOINT_4_5_CONTRACT.md), [Room status](ROOM_EDITOR_L3_STATUS.md), the directly affected implementation and tests; add [Architecture](ARCHITECTURE.md) sections for changed seams. |
| Processing or agent workflow | The exact A1 contract/status linked by [README](../README.md); [A1.7 state contract](A1_7_STATE_CONTRACT.md) for correction/review state; add [MCP contract](MCP_CONTRACT.md) and authority/persistence contracts when those boundaries change. |
| Product/design or redesigned authoring | [Vision](VISION.md), [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md), relevant [Requirements](REQUIREMENTS.md) sections and owning contract; agree on the screen and state the bounded promise before implementing. |
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
