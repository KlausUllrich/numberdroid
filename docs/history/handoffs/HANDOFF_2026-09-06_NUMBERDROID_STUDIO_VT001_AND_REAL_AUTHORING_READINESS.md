# Numberdroid Studio — VT-001 completion and real-authoring readiness handoff

DATE: 2026-09-06

REPOSITORY: `KlausUllrich/numberdroid`

STATUS: **TASK-REVIEW CLARITY USER-PASSED, MERGED AND POST-MERGE GREEN; ROOM MACRO GUIDANCE USER-PASSED BUT PR #206 REQUIRES REFRESH; VT-001 REMAINS REVISE PENDING THE REMAINING LIVE TASK/PREVIEW TESTS; REAL ROOM/ASSET PILOT IS NEXT ONLY AFTER THAT DECISION**

BASELINE MAIN HEAD AT CREATION: `fe05d53eefc23d04633725f0c7170837e5724c5d` (pre-handoff-document baseline; the receiver must re-resolve current remote `main`)

BASELINE CI / PAGES STATE: PR #210 exact head `dd96fbb7295111547f082d447cd5953e39909fae`, Build #2375 / run `34033831804`, green; merge `fe05d53eefc23d04633725f0c7170837e5724c5d`; post-merge Build #2376 / run `34034254062`, green after one targeted retry of a transient Linux Chrome `Runtime.evaluate` timeout. The retry's Studio job `101490281342`, reused Windows success `101490282035`, and final gate `101491210764` passed. Root build and Pages were correctly skipped by the actual Studio/docs path classification.

TARGET AGENT: **OpenAI Astra**, as selected by Klaus. The current bb Codex catalog did not expose a model literally named `Astra` when this handoff was written, so the user may paste this document into that model directly rather than relying on an automatic bb model selection.

PRIMARY RECEIVING ROLE: **QA / Integrator / Release** for the bounded PR #206 integration and remaining VT-001 live gate.

SECONDARY / TRIGGER ROLES: **Coordinator / cross-domain** for sequencing; **Product / Designer and Klaus** for live acceptance; **Artist / Technical Artist** only when the real asset-production pilot begins; **Engineer / Runtime Developer** only for a concrete live defect or separately authorized implementation block; **Security/Authority and Persistence/Idempotency** reviewers for changes crossing those boundaries.

NEXT MILESTONE / TASK: refresh and integrate the already user-passed Room guidance PR #206, re-establish one clean current-main Studio instance, finish only the still-unproven VT-001 task and Preview steps on fresh fixtures, record Klaus's explicit accept-or-revise decision, then propose one persistent real room/asset pilot. Do not begin materialization, publication, A5/A6, 2.5D, remote/mobile or a broader art-agent implementation without its own scope decision.

## 1. Astra execution and delegation authorization

Klaus explicitly requests a high-capability receiving agent and authorizes Astra to use all tools, connectors, skills, browser capabilities and subagents available to it within the task's repository and authority boundaries.

Astra may proactively spawn and coordinate subagents for independent bounded work such as:

- current GitHub/CI and branch-state audits;
- worktree and fixture-safety inspection;
- focused interaction/UX, security/authority, persistence/idempotency, rendering and actual-diff reviews;
- test-scope classification and CI diagnosis; and
- real-authoring pilot gap analysis.

Use parallel work when it shortens the critical path, keep one clear owner per subtask, give every delegated task an explicit result and a default maximum of five minutes, and interrupt/take over when a deadline expires. Do not delegate the main agent's mandatory reading of `AGENTS.md`, a selected skill's `SKILL.md`, or task-binding documents. Tool and subagent availability does not grant new product, repository-publication, materialization, release, destructive-cleanup or image-generation authority.

## 2. Universal bootstrap and required reading

First verify remote `main`, its current commit, open PRs, relevant Room/Studio/A1 branches and current Actions exclusively through the GitHub connector. Remote GitHub reads and writes use the connector only.

Read `AGENTS.md` completely and execute its Universal Bootstrap. Then read completely:

1. `REPOSITORY_STRUCTURE.md`
2. `docs/agents/ROLE_ENTRYPOINTS.md`
3. `docs/agents/REPOSITORY_WORKFLOW.md`
4. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
5. `docs/README.md`

Use QA / Integrator / Release as the initial route and Coordinator / cross-domain for sequencing. Then read, in this order:

1. `docs/agents/HANDOFF_PROTOCOL.md`
2. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `tools/numberdroid-studio/README.md`
5. `tools/numberdroid-studio/docs/VISION.md`
6. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
7. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
8. `tools/numberdroid-studio/docs/ROADMAP.md`
9. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
10. `tools/numberdroid-studio/docs/LIVE_VERIFICATION_2026_09_01.md`
11. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_CONTRACT.md`
12. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_STATUS.md`
13. `tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md`
14. `tools/numberdroid-studio/docs/A1_7_STATE_CONTRACT.md`
15. `tools/numberdroid-studio/docs/A1_7_UI_CANDIDATE_STATUS.md`
16. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
17. `docs/art/README.md`
18. this handoff, last.

Follow `docs/agents/CODEX_CONTEXT_RETENTION.md` after classification when the receiving client supports it.

The full Artist production bundle, story/gameplay corpus, Operations/Remote/Mobile package, A5/A6 packages and 2.5D design are not mandatory for the initial PR #206 and VT-001 work. Before producing or changing an actual visual asset, activate the Artist route and read its complete mandatory bundle. Before changing reusable processing or runtime integration, add the Technical Artist/Engineering route. Image generation remains governed by the repository's exact hard-generation command gate.

## 3. Verified repository and integration state

Remote truth at handoff creation:

- `main`: `fe05d53eefc23d04633725f0c7170837e5724c5d` (`…24c5d`).
- Open PR #206, `[ci-full] Clarify Room surface macro guidance`: head `2eb8c719c516f898efcc37c6a9cafd24bb4e957b`, old base `05b61e51e8a25626a47f04dcd5f6b13e868774f8`, two changed files, user live result **PASS**. GitHub currently reports it non-mergeable because it is stale. Build #2365 / run `33862534827` failed in the old snapshot after a browser/temporary cleanup problem; do not infer a product failure and do not merge the stale head.
- Open PR #204, `[ci-full] Configure task-aware Codex context retention`: head `38fbd3cbc31c03e61f2bf70f2875d5b432b31261`, old base `f0755c80e82af96efe66428803f4b7a3d2c415d0`. It is non-mergeable and Build #2358 / run `33774800909` failed. It is infrastructure-only and does not block Studio product testing. Diagnose it separately; do not absorb it into PR #206 or VT-001.
- PR #210, `Clarify blocked task review decisions`: final head `dd96fbb7295111547f082d447cd5953e39909fae`; merge `fe05d53eefc23d04633725f0c7170837e5724c5d`; PR and post-merge CI green. Klaus explicitly live-passed the redesigned conflict page.
- PR #209 launcher typed-stop merge: `0717a6f6852c9c3030b1f7cbcb9fc6795180adc2`, post-merge Build #2372 green.
- PRs #205, #207 and #208 established the root `npm run studio` worktree launcher and its dynamic, beginner-readable menu. Their merge heads were `6bbf009fb94b46354231abb2dc8eb70ceffb1691`, `24f24589...` and `920e5936...` respectively.
- PR #203 integrated the canvas-exit placement-ghost and stable-scrollbar-gutter fixes as merge `05b61e51e8a25626a47f04dcd5f6b13e868774f8`; Klaus live-passed both behaviors.

The handoff's remote facts must be re-resolved. Numerous historical Room/Studio branches remain remotely; they do not need bulk deletion for this milestone.

## 4. Local worktree and process state after cleanup

The completed Task Review live server was stopped. Its bb terminal `term_mtgb8iibnz`, clean temporary worktree `/tmp/numberdroid-task-review-clarity.VgJojG`, and temporary data root `/tmp/numberdroid-studio-launch-hxJBTM` are gone. Five dead Git worktree records were pruned. No live Studio URL is intentionally retained by this handoff.

Three local worktrees remain:

1. `/mnt/development/game-projects/numberdroid`
   - branch `agent/room-placement-ghost-exit`, local HEAD `46bc2e7d2d276da81150d659ce3725509c511fe8` (`…511fe8`);
   - 5 modified and 17 untracked status entries;
   - includes Codex-context work plus untracked Numberdroid art PNGs and must be preserved exactly;
   - remote branch is newer at `596b1f8e1becec12a23ec64de915f9ba0a516061`;
   - do not clean, reset, switch, publish wholesale or use as the acceptance baseline.
2. `/mnt/development/game-projects/numberdroid-main`
   - clean local `main` at `0717a6f6852c9c3030b1f7cbcb9fc6795180adc2` (`…0adc2`);
   - behind live GitHub `main` `…24c5d` at handoff creation;
   - this is the intended clean testing anchor after a safe update to the then-current remote `main`.
3. `/mnt/development/game-projects/numberdroid-studio-1b-qa`
   - detached historical Checkpoint 1B snapshot `41fad464cd2f904666f7dfecc8437f2286c3254c`;
   - has one untracked `tools/numberdroid-studio/.numberdroid-studio-visual/` directory;
   - no active server was found through bb;
   - it is a cleanup candidate only after Klaus decides the historical local visual output is disposable.

The worktree launcher is intentionally a stay-as-is diagnostic/start tool. It must remain dynamic, show actual branch names, local file counts and at least the last five SHA digits, report unpulled GitHub commits, and never silently switch, reset or mutate a selected branch. Klaus is not comfortable performing complex Git operations; give one safe command or perform a bounded authorized operation rather than presenting raw Git internals.

## 5. Accepted / frozen and live-passed slices

- Checkpoints 1–4 remain user accepted and frozen as recorded in current Studio contracts.
- VT-000 remains the protected automated-green baseline.
- VT-012 Backups UI remains user accepted as recorded on 2026-09-01.
- VT-014 remains user accepted as recorded on 2026-09-02 for only the bounded private immutable A4c Candidate and strict derived-child attenuation. It grants no A5/A6, materialization, publication or release authority.
- Klaus live-passed the bounded Room placement-preview disappearance on canvas exit, stable scrollbar-gutter/no-wiggle behavior, repeated launcher start/stop usability, plain-language Room macro guidance, and PR #210's conflict-first Task Review page.
- The PR #210 conflict page now makes the conflict primary, explains why applying would overwrite newer work, shows action consequences, removes the impossible merge action, gates the Processed Asset panel by the exact adoption capability, and compresses one-line technical data into small inline metadata.

These individual passes do not equal final VT-001 acceptance.

## 6. Implemented but not accepted

### VT-001 / Checkpoint 4.5

VT-001 remains **REVISE**. The Room Editor implementation is source-integrated and automated/browser/Windows green, and the newly reported nuisance fixes have passed live, but these behaviors still require one bounded completion pass:

- focused task creation and the normal non-conflicting selected-task flow;
- truthful next actor and consequence throughout that flow;
- explicit rejection;
- adding accepted non-conflicting changes to the project;
- the one-time compensating Undo action;
- Room overview error attention and successive finding navigation; and
- exact saved Studio Preview plus return-state preservation for an unsaved draft, selected Prop tool/focus, page scroll and canvas scroll.

Only Klaus can record the final VT-001 `ACCEPT` or `REVISE` result. Do not infer it from the individual passes, source, screenshots, CI or this handoff.

### Artist path

- Human source intake, deterministic PNG cutting, semantic Asset creation/cataloguing and Room placement exist in the accepted Checkpoint 2/3 foundation and may be piloted locally.
- A1.0–A1.2's bounded exact-PNG crop/result/selection contracts are accepted.
- A1.3–A1.6b2b remain implemented but not user accepted.
- A1.7 remains **REVISE**: its read-only Processed Asset presentation exists, but the prior live test found that feedback cannot be authored and Resume does not start a real agent. The UI can otherwise mix old review state with resumed work. Do not claim an end-to-end agent-assisted Artist loop.
- Studio has no general image-generation provider and no broad image-processing suite. The existing repository Artist/toolkit workflow remains authoritative for production beyond the accepted crop operation.

### Numberdroid consumption

The current Checkpoint 5/adapter foundation is candidate-only and validate-only. Studio cannot yet materialize authored Asset/Room candidates into the Numberdroid repository, create a publishing commit or release them. A5/A6 and repository publication remain unimplemented or unauthorized.

## 7. Exact first bounded block: integrate PR #206

PR #206 changes only:

- `tools/numberdroid-studio/packages/domain/src/room-definition.js`
- `tools/numberdroid-studio/tests/checkpoint-3-domain.node-test.js`

The intended product behavior is copy-only: explain that a Surface macro is one Surface placed as a whole grid block that may cover one or several cells; explain how it is selected/placed and how the usable room area, `VOID` cells and structural edge bands constrain it. Do not change validation semantics, rule ID, severity, target or finding order.

First rebase/refresh that exact two-file diff onto the newly verified current `main` through the GitHub connector. If safely updating the existing branch is not supported, create a clean replacement branch/PR from current `main`, prove exact semantic equivalence, and close #206 only with an explicit supersession link. Never merge head `2eb8c719...` unchanged against its obsolete base.

Use the smallest decisive local checks first. From `tools/numberdroid-studio/`, every command has an explicit timeout:

```bash
timeout 120s node --test tests/checkpoint-3-domain.node-test.js
timeout 120s npm run build
```

Then let the actual refreshed `[ci-full]` diff select its required GitHub lanes. Merge only an unchanged exact head after required checks/reviews are green, then observe post-merge CI. Treat a browser-runner timeout as neither pass nor product failure: inspect the failed assertion/log and retry only the affected idempotent lane when evidence shows infrastructure flakiness.

## 8. Remaining targeted VT-001 live test

After PR #206 is integrated and the clean main worktree is current, start from the repository root with:

```bash
npm run studio
```

The launcher profiles are:

- **Fresh empty workspace** — new temporary blank data, suitable for exploratory smoke testing but not long-term production work;
- **VT-001 Room / Preview fixture** — the exact Room/Preview chain;
- **VT-001 Agent tasks fixture** — the exact task/review chain.

Use fresh task and Room fixtures exactly as specified in `VACATION_TEST_BACKLOG.md`. Never point a fixture at `.numberdroid-studio`, an active workspace, a backup or a restored workspace. Keep each exact temp directory until its result is recorded.

Do not make Klaus repeat every already-passed nuisance test. Complete the missing proof:

1. In the fresh Agent tasks fixture, reconfirm the conflict-first page briefly, then exercise focused creation and the normal non-conflicting review path, rejection, adding accepted changes, task completion and the one-time Undo. Confirm every action states its consequence before use.
2. In the fresh Room fixture, open the saved Room error directly from overview, move through successive findings, and verify readable remediation plus retained dock context.
3. Create an unsaved shape draft, select the Prop tool, establish nonzero page/canvas scroll, open Studio Preview and verify it names the exact saved project revision and Room version, excludes the unsaved draft, is read-only and explicitly not Numberdroid runtime output.
4. Return and verify the exact draft/tool/focus/scroll state. Reopen and return once more without mutation; confirm no project revision, Room version, task, review or acceptance state changes.
5. Record Klaus's explicit final decision and update the current Roadmap, development plan, CP4.5 status, Room status, Vacation Test Backlog and an appropriate compact status/handoff record so all current authorities agree.

If Klaus reports a defect, stop the acceptance sequence, name the exact behavior and hand only that bounded source slice to Engineer / Runtime Developer. Use focused tests first; broader suites only when selected by the actual risk/path triggers.

## 9. Real room and Asset production pilot after VT-001

If and only if VT-001 is accepted, propose one persistent human-authoring pilot before expanding the agent or materialization scope:

```text
one noncritical real PNG source
→ deterministic processing/cutting
→ semantic Asset metadata
→ footprint, anchor and permitted rotations
→ place in one real pilot Room
→ save and restart
→ Studio Preview
→ integrity check and backup/restore-as-copy
```

A pending domestic candidate such as the Coffee Machine may be appropriate, but the Artist/Product owner must choose the exact source and disposition. Do not assume that the untracked PNGs in the dirty worktree are accepted sources.

Use a named persistent `NUMBERDROID_STUDIO_DATA` directory outside `/tmp` and outside the repository. The current launcher creates new retained test roots and refuses reusing an existing `--data-root`; it is not yet a friendly manager for reopening named production workspaces. A small later launcher improvement may add explicit **Test fixture** versus **Open working project** choices, but it must preserve the stay-as-is/no-hidden-Git-mutation rule.

The pilot proves Studio-local authoring only. If Klaus then wants the result playable in Numberdroid, return to Coordinator/Product for a separate human-controlled CP5/A5 materialization scope. Do not silently convert Preview into runtime authority.

## 10. Verification discipline and reusable lessons

- Klaus values decisive, narrowly scoped checks and has explicitly objected to long broad suites for tiny changes. Start with the smallest falsifying test and run only risk/path-triggered broader gates.
- Linux Chrome captures the browser screenshots. The Windows Studio lane verifies tests/build/evidence compatibility; it is not a second screenshot walkthrough. A separate human Windows UI pass is optional unless a concrete platform risk requires it.
- `CI green`, `merged`, `live-passed slice` and `user-accepted milestone` are four different facts.
- A technical implementation detail that resolves to one line should be shown inline in small text; reserve disclosures for genuinely multi-line diagnostic material.
- The launcher must remain understandable to a Git beginner: actual branch names, last-five SHA confirmation, local changes and unpulled GitHub state, with no silent branch mutation.
- Every command/test needs an explicit timeout. Send a heartbeat within 120 seconds. Poll CI every 30–60 seconds for at most 20 minutes; after two unchanged polls inspect steps/logs before another status poll.
- Retain exact fresh fixtures until the human result is recorded, then remove only their uniquely allocated temporary directories.
- Preserve logical Room footprint as occupancy/collision/navigation authority. Visual bounds, overhang, offsets and imagery are presentation only. Ordinary Studio Preview is engine-neutral and read-only.

## 11. Definition of done for the receiving milestone

The receiving milestone is complete only when:

- current remote `main`, open PRs/branches and Actions were reverified through the GitHub connector;
- PR #206's exact copy repair was refreshed from current `main`, passed its actual-diff gates, merged unchanged and passed post-merge CI;
- a clean current-main local Studio instance was used;
- only fresh safe VT-001 task and Room fixtures were used;
- the remaining task lifecycle, Room finding navigation and Preview/return-state behaviors received Klaus's live observation;
- Klaus's exact VT-001 acceptance or revision was recorded separately from engineering evidence;
- current Roadmap/plan/status/backlog documentation agrees with that decision;
- all temporary test processes/data are stopped or explicitly retained with their exact paths; and
- no A5/A6, materialization, publication, release, provider, remote/mobile or unrelated asset-production scope was entered without a separate explicit decision.

## 12. Final receiver instruction

1. Verify remote `main`, Actions, open PRs and relevant branches exclusively through the GitHub connector.
2. Read the universal bootstrap and complete task bundle above; register the task context when supported.
3. Inspect actual current Room/Task source, tests, launcher and fixture scripts.
4. Summarize the verified acceptance/authority/worktree state and report any conflict before mutation.
5. Use bounded parallel subagents and all appropriate capabilities for independent checks/reviews, while the primary agent retains decisions and mandatory reading.
6. Refresh and integrate only PR #206 as the first source block.
7. Run only the remaining VT-001 live steps with Klaus, record his explicit result and update current authorities.
8. If VT-001 is accepted, propose the real persistent Room/Asset pilot. Do not begin agent-loop repair or Numberdroid materialization until Klaus chooses that next scope.
