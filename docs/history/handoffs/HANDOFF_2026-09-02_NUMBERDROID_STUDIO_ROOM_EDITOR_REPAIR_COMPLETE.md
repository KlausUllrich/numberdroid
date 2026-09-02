# Numberdroid Studio — VT-014 acceptance and Room Editor repair completion handoff

DATE: 2026-09-02
REPOSITORY: `KlausUllrich/numberdroid`
STATUS: **VT-014 user accepted; bounded VT-001 Room Editor repairs integrated and green; VT-001 remains REVISE pending Klaus's live retest**
BASELINE MAIN HEAD AT CREATION: `dbe37634ea13d076cd00647fffb0dde1b2bd0f69`, tree `baa89c2548916826b822f59a1c162d6ace38321a` (pre-handoff-document baseline; receiver must re-resolve current `main`)
BASELINE CI / PAGES STATE: PR #201 exact head `e26f3d707a790a4b4779c9267514a3b8de9f18d0`, Build #2353 / run `33629339599`, green; merge `dbe37634ea13d076cd00647fffb0dde1b2bd0f69`; post-merge Build #2354 / run `33630127953`, green; root build and Pages correctly skipped by the actual changed-path classification
PRIMARY RECEIVING ROLE: QA / Integrator / Release for the targeted VT-001 live retest and acceptance truth
SECONDARY / TRIGGER ROLES: Coordinator / cross-domain for any sequence or new-scope decision; Product / Designer and Klaus for VT-001; Engineer / Runtime Developer only for a concrete newly reported defect; Security/Authority and Persistence/Idempotency for any repair that touches those boundaries
NEXT MILESTONE / TASK: run the bounded VT-001 Room Editor retest from a fresh fixture, record Klaus's explicit decision, and stop unless a concrete defect or separate new scope is authorized

## 1. Universal bootstrap and required reading

First verify remote `main`, its tree, open PRs, relevant Room Editor/A4c branches
and current Actions exclusively through the GitHub connector. Remote GitHub
reads and writes use the connector only.

Read `AGENTS.md` completely and execute its Universal Bootstrap. Then read the
universal sequence completely:

1. `REPOSITORY_STRUCTURE.md`
2. `docs/agents/ROLE_ENTRYPOINTS.md`
3. `docs/agents/REPOSITORY_WORKFLOW.md`
4. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
5. `docs/README.md`

Use QA / Integrator / Release as the primary route. Use Coordinator /
cross-domain before sequencing new work. Engineer / Runtime Developer becomes
primary only after Klaus reports a concrete defect or authorizes a new bounded
source slice.

Then read completely, in this order:

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
14. `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md`
15. `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md`
16. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
17. this handoff, last.

The full Operations/Remote/Mobile package, art production package, later A5/A6
packages and 2.5D design are not mandatory for the initial VT-001 retest. They
become mandatory only if a separately authorized task actually enters that
domain. Any code repair requires the exact Room source/tests in section 5 and
all trigger-relevant authority/persistence documents before editing.

## 2. Verified repository and integration state

- PR #201 repaired only the bounded 2026-09-02 Room Editor findings. Its
  unchanged final head was
  `e26f3d707a790a4b4779c9267514a3b8de9f18d0`, tree
  `baa89c2548916826b822f59a1c162d6ace38321a`.
- Build #2353 / run `33629339599` passed the actual PR diff through classifier,
  Linux Studio/full browser evidence, Windows Studio and final CI gate.
- PR #201 merged as `dbe37634ea13d076cd00647fffb0dde1b2bd0f69`.
  Post-merge Build #2354 / run `33630127953` repeated every selected gate
  successfully. Root build and Pages were correctly skipped for this Studio/docs
  diff.
- PR #191 and PR #192 remain implemented but not product-side accepted. Their
  deferred live verification is not contradicted by PR #201, CI or this handoff.
- VT-014 was explicitly accepted by Klaus on 2026-09-02. The acceptance is the
  user's decision, not an inference from compiler output, screenshots, reviews,
  CI, PR merge or source integration.

## 3. Accepted / frozen

- VT-000 remains the protected `AUTOMATED GREEN` foundation; accepted
  Checkpoints 1–4 remain frozen.
- VT-012 O1b Backups UI remains user accepted as recorded on 2026-09-01.
- VT-014 is `USER ACCEPTED 2026-09-02` for the bounded private immutable A4c
  Candidate, strict same-actor/same-project trusted-service child attenuation
  and truthful read-only authority presentation.
- VT-014 acceptance does not accept A3a, A4a or A4b and grants no A5/A6,
  materialization, repository-publication, merge, release or operational
  authority.

## 4. Implemented but not accepted, planned and open

### Implemented but not accepted

- CP4.5 / VT-001 remains **REVISE / NEEDS KLAUS LIVE**. The first 12 steps of
  Klaus's preceding walkthrough passed. He then reported Fit collapsing to the
  smallest zoom; Resize initially appearing unavailable because its saved-shape
  prerequisite was unclear; single-use placement; a technical
  `PLACEMENT_ADD_PENDING` message; an unnecessary **Use in room** step; unclear
  removal; and visibly incorrect 90°/180° rotation. Steps 14 onward were not
  tested.
- PR #201 repairs those findings in source and automated evidence. Only Klaus's
  new live observation can accept or reject the behavior.
- VT-011 remains `REVISE`. O2a/VT-013 remains undeployed and needs a separate
  live gate. A3a/A4a/A4b remain source-integrated and not user accepted.

### Planned / not implemented or not authorized

- A later 2.5D/isometric or dimetric renderer over the portable Room Preview
  scene remains planned and is not a VT-001 completion gate.
- A5 and A6 require separate explicit scope. No Candidate materialization,
  repository publication, runtime activation or release path follows from
  VT-014 acceptance.
- No Remote backup/MCP, Pairing, HostBinding, Funnel/public access, O3/O4,
  auto-accept, deletion, activation or browser-agent authority is authorized.

### Open decisions

- Klaus / Product owns the VT-001 live accept-or-revise decision.
- Coordinator / cross-domain owns any new sequence proposal after that result.
- Engineer / Runtime Developer returns only for a named defect or explicit new
  source slice. No roadmap momentum authorizes A5.

## 5. Technical result and fixed boundaries

PR #201 adds or repairs:

- viewport-budget-aware Fit with a visible fitted percentage;
- saved-shape resize in **Purpose & settings** and a dirty-shape guard;
- exact `{assetId, assetVersion, metadataVersion}` palette pins;
- immediate arming of READY Surface/Prop/Item cards without **Use in room**;
- a persistent placement brush with fresh placement IDs and idempotency keys;
- exact unknown-result replay at the original cell with plain-language guidance;
- reachable pending recovery even if the exact preview image later fails;
- confirmed Clear backed only by the existing placements-remove command; and
- visibly rotated cardinal imagery without letting image pixels or visual
  overhang enlarge the authored logical footprint at its current orientation.

The existing portable Preview boundary is unchanged. Logical footprint alone
controls occupancy, collision and navigation. Ground anchor controls floor
contact and primary depth. Visual bounds/offset, elevation, overhang,
transparency and optional background/body/foreground segments are presentation
metadata only. Ordinary Studio Preview is read-only, engine-neutral and not a
Numberdroid runtime preview. EngineBridge remains validate-only.

Principal repair paths:

- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/tests/checkpoint-3-ui.node-test.js`
- `tools/numberdroid-studio/tests/checkpoint-4-5-ui.node-test.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`

Portable Preview paths remain:

- `tools/numberdroid-studio/packages/preview/src/room-preview-scene.js`
- `tools/numberdroid-studio/apps/studio-server/public/room-preview-state.js`
- `tools/numberdroid-studio/tests/room-preview-scene.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-state.portable.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-source-application.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-http-security.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-ui.node-test.js`

Verification on the unchanged repair tree:

- focused Room Editor UI: 19/19 passed;
- full Studio: 748 total, 744 passed, four expected platform skips, zero failed;
- Studio build/syntax: 239 files;
- Checkpoint 1A evidence: `VERIFIED`;
- `git diff --check`: clean;
- five independent interaction/UX, security/authority,
  persistence/idempotency, preview/rendering and test/CI-scope reviews: GO.

Commands for any future source diff, from `tools/numberdroid-studio/`, each with
an explicit timeout:

```bash
timeout 120s node --test tests/checkpoint-3-ui.node-test.js tests/checkpoint-4-5-ui.node-test.js
timeout 180s npm test
timeout 120s npm run build
timeout 120s npm run evidence:verify
```

Repository documentation gates, from the repository root:

```bash
timeout 120s npm run repo:docs-check
timeout 120s npm run repo:docs-check-test
timeout 120s node scripts/repo/ci-change-classifier.selftest.mjs
```

Live Studio URL: `http://127.0.0.1:4317`

## 6. Targeted VT-001 retest

Use exactly the fresh task and room fixtures in
`tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`; never point a fixture
script at `.numberdroid-studio`, an active workspace, a backup or a restored
workspace.

The repair-focused order is:

1. Confirm **Purpose & settings** exposes Width/Height, change them, choose
   **Resize**, verify a new saved Room version appears, and place on the newly
   created cells.
2. Create a dirty shape draft and confirm placement asks for save/discard
   without creating a pending placement. Restore the saved shape.
3. Choose a READY Surface directly from its palette card and place it on at
   least two cells without reselecting it or using a separate action.
4. Repeat with a Prop or Item and confirm each copy is distinct.
5. If an unknown-result message appears, confirm it is plain language and retry
   only the named original cell; no duplicate may appear.
6. At 1440×900 and 1060×900, confirm Fit uses the useful viewport, reports its
   percentage and coexists with manual zoom and middle-mouse pan without page
   overflow.
7. Place a disposable large Prop, inspect 0°/90°/180°/270° ghosts and final
   imagery, and confirm visual rotation without cropping. For the fixture's
   Transfer Apparatus, verify the authored logical footprint is 2×3 at 0°/180°
   and 3×2 at 90°/270°; image pixels and visual overhang must never enlarge
   occupancy.
8. Move it, choose **Clear**, and remove both that disposable Prop and one of
   the disposable Surfaces from step 3; leave the second Surface as the brush
   proof. Preserve the fixture's `prop.preview-overhang` placement.
9. Continue the previously untested task attention, Room error/finding
   navigation, exact saved Preview and editor-return-state steps from the
   Backlog.
10. Record Klaus's exact result as accept or revise. Never derive it from
    automation.

Retain the exact temporary fixtures until the result is recorded. Then discard
only those uniquely allocated temporary directories through normal OS cleanup.

## 7. Process learning and recovery

- A successful semantic command may still be poor brush UX. Persistence of the
  selected exact asset and freshness of each mutation ID are separate concerns.
- Unknown-result recovery must preserve the exact request and idempotency key,
  but the UI must also leave the original retry target reachable after a visual
  asset failure.
- Browser evidence must restore any page-local synthetic projection before
  later gates, or the same run can accidentally validate the wrong state.
- Fit is a geometry contract: include borders/padding and assert containment,
  not merely a chosen zoom constant.
- CSS rotation must be tested as rendered geometry/matrices and clipping, not
  only as a state value.
- No persistence schema changed. Source rollback is an ordinary focused revert;
  no SQLite downgrade, CAS cleanup, task repair, activation or publication
  rollback is required.

Every command and test needs an explicit timeout. Send a heartbeat within 120
seconds. Poll CI every 30–60 seconds for at most 20 minutes and diagnose after
two unchanged polls. Merge only an unchanged exact head after all gates selected
by the actual diff and all required independent reviews are green; observe
post-merge CI before dependent work.

## 8. Cross-role handoff and definition of done

QA / Integrator / Release is primary because the bounded repair is implemented,
independently reviewed, merged and post-merge green; the remaining work is a
human live product decision. Engineer / Runtime Developer already resolved the
reported implementation defects. Product / Designer and Klaus retain acceptance
authority. Coordinator / cross-domain prevents that result from silently
authorizing another roadmap block.

The next gate is done only when:

- current remote `main`, tree, open PRs and Actions are reverified through the
  GitHub connector;
- the exact fresh safe fixture and complete affected Backlog steps are used;
- Klaus's explicit VT-001 acceptance or revision is recorded separately from
  engineering evidence;
- Roadmap, plan, Room status, Backlog and a handoff/status record agree; and
- any repair, if needed, has its own unchanged exact head, actual-diff local,
  browser, Windows and CI gates, blocker-free reviews and observed post-merge
  CI.

If no live retest or explicit new scope is available, stop. Do not begin A5,
A6, 2.5D, remote/operational, materialization, publication or release work.

## 9. Final receiver instruction

1. Verify current `main`, tree, open PRs, relevant branches and Actions only
   through the GitHub connector.
2. Execute the Universal Bootstrap and read the full role/task bundle above.
3. Inspect the actual Room source, tests and current live-fixture instructions.
4. Summarize the verified acceptance and authority state and report any
   conflict before acting.
5. Run the targeted VT-001 retest only on fresh fixtures when Klaus is ready.
6. Record Klaus's explicit decision; do not infer it from source, screenshots,
   reviews or CI.
7. Do not cross into a repair or later milestone without its own concrete
   finding or explicit scope decision.
