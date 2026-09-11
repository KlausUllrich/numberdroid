# Shared Review ready for VT-024 — restart handoff

DATE: 2026-09-11
REPOSITORY: KlausUllrich/numberdroid
STATUS: implementation integrated; paused before Klaus's production test
BASELINE MAIN HEAD AT CREATION: 0889d7eb92c752ecaedb93c6d58d015c8005d5fa
BASELINE CI / PAGES STATE: PR248 pre-merge Build2457/run34615555760 and post-merge Build2458/run34616636287 green; no runtime/Pages deployment selected
PRIMARY RECEIVING ROLE: QA / Integrator / Release
SECONDARY / TRIGGER ROLES: Coordinator; Engineer only for a concrete defect; Product/Designer with Klaus for the next screen
NEXT MILESTONE / TASK: VT-024 production PASS or REVISE; BB Tasks ND-2, ND-6 and ND-7 remain in_review

This baseline predates the handoff's own documentation merge. Resolve current
remote main through the GitHub connector. The handoff records state; current
contracts and code remain authoritative.

## Read narrowly, then resume

1. Read the complete universal bootstrap in AGENTS.md, in its prescribed order.
2. Follow the QA / Integrator / Release and Coordinator routes in
   [ROLE_ENTRYPOINTS](../../agents/ROLE_ENTRYPOINTS.md).
3. Read the exact current task bundle:
   - [Studio router](../../../tools/numberdroid-studio/docs/START_HERE.md);
   - [Authoring product model](../../../tools/numberdroid-studio/docs/AUTHORING_PRODUCT_MODEL.md);
   - [approved Review V2](../../../tools/numberdroid-studio/docs/REVIEW_CHANGES_DESIGN.md);
   - [shared Review foundation](../../../tools/numberdroid-studio/docs/SHARED_REVIEW_IMPLEMENTATION_CONTRACT.md);
   - [production UI contract](../../../tools/numberdroid-studio/docs/SHARED_REVIEW_UI_IMPLEMENTATION_CONTRACT.md);
   - [Vacation Test Backlog](../../../tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md), especially VT-024 and the separate VT-001 boundary;
   - [current development plan](../../planning/DEVELOPMENT_PLAN_NEXT.md), current Review/Library status.
4. Register the documents actually read under
   [Codex context retention](../../agents/CODEX_CONTEXT_RETENTION.md), then read this named handoff.

Do not re-onboard through every historical checkpoint, art, story, gameplay or
level-generation document. No production art or runtime integration is planned.
A concrete defect triggers only its owning Engineer/source/test slice; a new
screen or model decision triggers Product discussion and its current contract.

## What is complete, and what is not

PR [248](https://github.com/KlausUllrich/numberdroid/pull/248) merged unchanged:
head `126e464a068e86406824bbfe1cf7b747d5f9b95a`, merge `0889d7e`, exact tree
`6b0204e1d5c202c9ad345b5ec3ee28c0c1f5abd4`. Linux CI passed 1,152 tests with five
existing skips, build and browser evidence; Windows and final gates passed.
Five independent risk reviews are clear. One missing toast element in an older
test harness was corrected before the final green head; no unresolved failure.

Implemented, awaiting user acceptance:

- One shared Review for related Image, Animation and Assembly changes, selected
  acceptance with dependencies, editable saved feedback, reconsidered acceptance,
  explicit newer-content adoption, retained older drafts and exact history.
- Existing proposals use read-only projections until an explicit first owner
  decision adopts them atomically. Old rows/history remain intact; no new agent
  authority is inferred from old grants.
- Library names the next actor, affected Back controls are on the left with their
  destination, and Activity is a readable single column with recorded feedback.
- Initial read/retry, externally revised/adopted proposals, unknown outcomes,
  historical artwork and Details/Back context have focused/native evidence.

The real semantic agent proof used production MCP and actual owner browser
controls: invalid binding rejected without mutation; related proposal submitted;
Animation accepted first; feedback requested and amended; agent revised only the
remaining Assembly; owner accepted it. Service readback and restart integrity
passed at project34, Review6/content2. Earlier accepted pins/history stayed exact.
This is evidence, not Klaus's production acceptance.

Accepted/frozen: checkpoints1–4, prior individual accepted nuisance fixes,
VT-020 Asset editor, VT-022 Animation and VT-023 Library. Review V2's “All pass”
approved its mockup. VT-024 has **no user result yet**. Preserve the separate
broader Assembly/VT-021 boundary and VT-001/CP4.5 REVISE. A1.7 still does not
provide a complete real-agent Resume loop. No new media, image generation,
Sources redesign, materialization, export/release or real production pilot started.

Klaus owns PASS/REVISE and next design scope. After a PASS, record the bounded
acceptance and align Tasks/GitHub/current status before discussing Sources.
Do not automatically start further implementation during this paused live gate.

## Exact retained user workspace and shutdown

Studio was stopped with q+Enter at 2026-09-11 16:44 UTC; terminal
`term_5ki82tu8wt` exited0. Port4325 was unexposed. Old mockup4319, old Library4325,
internal candidate4326 and the agent bridge were already stopped. No Studio test
server is intentionally running. Do not restart or stop bb itself on Klaus's behalf.

Retained data, never a fixture-preparation target again:

`/home/klaus/.bb/thread-storage/numberdroid-vt024-shared-review-aa2879f0-1dd2-42b1-96bf-5c4fb217ebed`

Shutdown read/integrity check: schema18, project `project.animation-editor`, name
**Animation editor — synthetic test**, revision18, `review.coffee-package` v1,
**Coffee station and its components**, all three items PENDING. Integrity passed.
The user postponed the test; no decision has been inferred.

Local restart files (persist across bb restart on this host):

- `/home/klaus/.bb/thread-storage/numberdroid-shared-review-test-supervisor.mjs`
- `/home/klaus/.bb/thread-storage/numberdroid-shared-review-live-config.json`
- `/home/klaus/.bb/thread-storage/numberdroid-shared-review-live-session.json`
- `/home/klaus/.bb/thread-storage/numberdroid-vt024-shutdown-check.json`
- `/home/klaus/.bb/thread-storage/numberdroid-shared-review-ui-continuity.json`

The supervisor opens existing data only, reads Git state, requires clean main at
`config.expectedHead`, prints branch/SHA/local changes/unpulled state, and retains
saved data on q+Enter. It never switches branches or prepares fixtures.

The clean testing anchor is `/mnt/development/game-projects/numberdroid-main`.
At feature completion it was clean main0889d7e with zero unpulled commits. If the
handoff's documentation merge advanced main, safely fast-forward the stopped
clean checkout after connector verification, then set `expectedHead` in the
session config to that verified head. Keep the same dataDirectory. Do not remove
the guard or blindly edit the expected SHA when product source changed.

The original `/mnt/development/game-projects/numberdroid` remains dirty on
`agent/room-placement-ghost-exit`, HEAD46bc2e7. Preserve its five modified and
17 untracked entries, including art/context data. Do not clean, switch, reset or
publish it. Other historical/scratch worktrees are not acceptance baselines and
were not cleaned. The isolated `/home/klaus/.bb/thread-storage/numberdroid-cutter-worktree`
is used for focused source/docs branches; inspect its current branch before use.

Useful retained evidence: `/home/klaus/.bb/thread-storage/nd2-ui-real-agent/`
(agent requests/responses, owner browser checks and restart-integrity.json) and
`/home/klaus/.bb/thread-storage/nd2-vt024-main-readcheck/`. Native transient evidence
was under `/tmp/nd2-shared-review-final-presentation-20260911`; CI artifacts are the
durable fallback if /tmp disappears. Do not mistake test pixels for production art.

## Restart and the next bounded block

1. Verify remote main, open PRs, relevant branch and Actions through the connector;
   read the bootstrap/task route above and inspect current source. Report conflicts.
2. Confirm the retained directory and stopped state, inspect actual saved revision,
   and keep the clean anchor synchronized safely. No broad suite is needed merely
   to reopen the unchanged green version. Reading must not change revision18.
3. Inspect the existing supervisor/config. From this bb thread, create a resumable
   terminal running the following command with a six-hour outer timeout:

   ```sh
   timeout --signal=TERM --kill-after=20s 21600s node /home/klaus/.bb/thread-storage/numberdroid-shared-review-test-supervisor.mjs
   ```

   Record its new terminal ID and deadline. After startup, run bounded
   `bb connect expose 4325` and use its returned URL. The former link was
   `https://klaus-bb--4325.getbb.app/#assets`; do not claim it is live before exposure.
   If helpers or data are missing, inspect first; never reseed an existing path.
4. Give Klaus this batch, already recorded as VT-024:
   - Library → Needs review → Coffee station and its components; inspect three
     related items and play the Animation.
   - Request changes, enter feedback, Details → Back, confirm draft/context,
     then save feedback.
   - Library should say Awaiting agent. Reopen, amend saved feedback, cancel
     another edit, and confirm acceptance remains available.
   - Accept Image+Animation first with Assembly unchecked; inspect the remaining
     pending Assembly, then accept it.
   - Activity: readable rows, earlier feedback/content remains read-only; check
     Back-left controls and correct return destination.
5. Await explicit PASS/REVISE. On a concrete defect, stop the sequence and fix only
   that slice with selected gates. On PASS, update the owning acceptance record
   and align current status/Tasks/GitHub. Do not infer VT-001 or broader acceptance.

Current board: BB Tasks ND-2/#237, ND-6/#243 and ND-7/#244 are in_review. Taskboard
was removed and must not be reinstalled. Continue in this thread; no new provider,
machine, task dispatch or agent handoff machinery is required for a bb restart.

## Execution lessons

Use the actual diff to select gates. This handoff is D0 documentation-only; do not
run product suites for it. One coherent block, one source PR; checkpoint task-owned
paths promptly. For behavior fixes, independent review follows source freeze and
only affected checks repeat after a finding. Browser screenshots belong to Linux;
Windows verifies tests/build/compatibility. CI green, merged, mockup approved and
user accepted remain distinct.

Every command needs a timeout; keep resumable handles. Poll CI30–60seconds, inspect
steps/logs after two unchanged polls, and update Klaus at least every60seconds.
The recent green Windows test step took roughly6–7minutes; its 10-minute job limit
must remain visible. Never trade away authority, history, recovery or explicit
human acceptance just to make the workflow shorter.
