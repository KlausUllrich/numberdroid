# Numberdroid Studio — Start here

Status date: 2026-09-11. This is the current task router; linked contracts own
semantics, status records own evidence, and current source owns implementation.
Reverify remote `main`, relevant PRs and Actions through the GitHub connector.

Session restart snapshot (2026-09-11):
[Library implementation handoff](../../../docs/history/handoffs/HANDOFF_2026-09-11_LIBRARY_IMPLEMENTATION_READY.md).
Read it after the current binding route when resuming this task. It records the
approved next block, stopped servers and preserved workspaces; reverify its baseline.

Use BB Tasks project **Numberdroid Studio (ND)** as the working board, with linked
GitHub issues as repository copies. Klaus removed the Taskboard plugin on 2026-09-11.
**ND-1 / [#236](https://github.com/KlausUllrich/numberdroid/issues/236) is user accepted**:
Klaus reported “all pass.” for [VT-023](VACATION_TEST_BACKLOG.md#vt-023--library-navigation-and-contextual-details)
on clean main `1c5c587`. Its [bounded contract](LIBRARY_NAVIGATION_IMPLEMENTATION_CONTRACT.md)
records the accepted Library navigation/detail block.
The next functional task is **ND-2 / [#237](https://github.com/KlausUllrich/numberdroid/issues/237)**,
shared Review. Klaus reported **“All pass”** for its
[V2 mockup](REVIEW_CHANGES_DESIGN.md#v2-approval--2026-09-11) on 2026-09-11: feedback
edits, reconsidered acceptance, truthful next actor and stale-proposal handling.
Navigation placement (ND-6 / [#243](https://github.com/KlausUllrich/numberdroid/issues/243))
and Activity readability (ND-7 / [#244](https://github.com/KlausUllrich/numberdroid/issues/244))
remain separate implementation follow-ups. Their demonstrated Back-left and
Activity-row patterns are approved by the Review V2 PASS; this does not accept
an application-wide rollout.
The [shared Review foundation contract](SHARED_REVIEW_IMPLEMENTATION_CONTRACT.md)
owns the active production block: compatible commands, schema18, exact dependencies,
feedback/history, atomic partial acceptance and an explicit agent profile. The
approved UI follows its verified integration. Preserve version/history, owner
authority, retries and recovery; existing typed review paths stay compatible.
Read the task and keep meaningful milestone status aligned in both copies; creating
these records does not start work or change the existing acceptance gates.

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
and sidebar removal are accepted foundations. Assembly is the active implemented
candidate ([VT-021](VACATION_TEST_BACKLOG.md#vt-021--assembly-editor)); shared Review
implementation follows separately.

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

The Assembly Review and Blocking clarity correction is merged through PR #230,
post-merge green, and explicitly **user passed on 2026-09-10**. The
[implementation contract](ASSEMBLY_EDITOR_IMPLEMENTATION_CONTRACT.md#clarity-correction--2026-09-10)
records the exact bounded acceptance. Preserve this corrected UI and saved work.
The broader VT-021 decision remains separate.

The [Animation Clip Editor design](ANIMATION_EDITOR_DESIGN.md) is now approved:
Klaus passed the base mockup and then said **“all pass”** for V2 with contextual
cut editing and ping-pong. It records nested frames, timing, shared alignment,
retained drafts and exact saved clip/cut use in Assembly presentations.

The production Animation implementation is now **user accepted**: Klaus reported
**“pass”** for the presented batch on clean main `f5f8bc2` (PR #233; post-merge
Build #2439 green). The [implementation contract](ANIMATION_EDITOR_IMPLEMENTATION_CONTRACT.md)
covers exact clip/cut history, transactional review, retained cut drafts and
versioned Assembly playback. [VT-022](VACATION_TEST_BACKLOG.md#vt-022--animation-editor-and-contextual-cut-revisions)
records the exact production acceptance, separately from the earlier mockup pass.
The [Library navigation design](LIBRARY_NAVIGATION_DESIGN.md) is now approved:
Klaus reported **“pass”** for the Assets/Pending changes, detail return, grouped
review and Activity-history mockup batch on 2026-09-10. The bounded production
Library block is now accepted as VT-023 after the 2026-09-11 “all pass.” result;
shared Review command/state integration follows separately. The mockup's mixed dependencies and
partial acceptance do not imply those production capabilities already exist.
Further screen changes follow discussion and mockup agreement before implementation.
Full shared Review semantics, runtime materialization, image generation and
publication retain separate gates.

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
| Animation clips | [Animation Clip Editor Design](ANIMATION_EDITOR_DESIGN.md), [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md), current exact cut/Asset/Assembly consumers; read their storage, authority, recovery and MCP contracts before evolving clip/frame or state-binding semantics. |
| Library navigation and detail return | [Library Navigation Design](LIBRARY_NAVIGATION_DESIGN.md), [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md), existing Asset/Animation/Assembly readers, editors and review routes; add the owning contracts before changing their semantics. |
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
