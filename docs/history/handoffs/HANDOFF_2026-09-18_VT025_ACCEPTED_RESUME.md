# Numberdroid Studio — VT-025 accepted, end-of-session resume

DATE: 2026-09-18

REPOSITORY: `KlausUllrich/numberdroid`

STATUS: **USER ACCEPTED — PASS; CODE CI GREEN; PR #256 UNMERGED; PAUSED AT KLAUS'S REQUEST**

BASELINE MAIN HEAD AT CREATION: `d7c1d2a7978c5624baacf243ea9c21d530a9ec6c`,
tree `f82e41cf2e0e52e6f3c18f81bafd7e0c1c0fce31`. This is the pre-handoff baseline;
resolve current remote `main`, task head and their trees again through the connector.

BASELINE CI / PAGES STATE: accepted code head
`9189b79571635b0f85bfa3223a456142d006e3fe`, Build2490 / run35332417113,
all selected gates green; Pages correctly skipped. A later documentation-only
checkpoint containing this handoff is not automatically covered by that run.
Resolve its actual PR-head CI independently before any merge.

PRIMARY RECEIVING ROLE: QA / Integrator / Release.

SECONDARY / TRIGGER ROLES: Coordinator before choosing later work; Product and
Klaus for new scope/design; Engineer only for a concrete defect or approved
implementation block; Authority/Security and Persistence for changes to those seams.

NEXT MILESTONE / TASK: reverify integration state, resume the exact accepted
workspace when Klaus returns, and settle the current PR before dependent work.
Do not treat a request to resume as permission to reset data or reopen accepted tests.

## 1. Required reading and verification

First verify remote `main`, its tree, open PRs #255/#256, the relevant task
branches and current Actions through the GitHub connector only. No Git/gh/curl
remote fallback. Read the full universal bootstrap in order:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`

Follow the QA / Integrator / Release route and its required bundle. Then read:

1. `docs/agents/HANDOFF_PROTOCOL.md`
2. `tools/numberdroid-studio/docs/START_HERE.md`
3. `tools/numberdroid-studio/README.md`
4. `tools/numberdroid-studio/docs/SOURCES_NAVIGATION_IMPLEMENTATION_CONTRACT.md`
5. `tools/numberdroid-studio/docs/SOURCE_TO_LIBRARY_WORKFLOW_DESIGN.md`
6. `tools/numberdroid-studio/docs/SOURCE_TO_LIBRARY_IMPLEMENTATION_CONTRACT.md`
7. `tools/numberdroid-studio/docs/CUTTER_EDITOR_DESIGN.md`
8. `tools/numberdroid-studio/docs/ROADMAP.md`
9. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
10. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md` (VT-025 owns this decision).
11. This handoff last. Register the task route under `CODEX_CONTEXT_RETENTION.md`.

Initial resumption does not require the full art-production, Operations/Remote,
A5/A6 or later renderer packages. Read those only if a separately scoped task
enters their domain. Source/schema/MCP changes require the exact authority,
persistence, compatibility and implementation documents before editing. This
snapshot never overrides current contracts or creates missing permission.

## 2. Human decisions and boundaries

### Accepted / frozen

- Klaus reported **“all pass.”** for the complete VT-025 workflow on local
  `53885f5` / remote `e89e459`; Build2488 was independently green.
- He reported five concrete Cutter findings and explicitly selected
  **“Keep Save layout → Generate as separate actions”**.
- After the fixes he reported **“pass.”** on local `b1dbff3` / remote `9189b795`,
  then requested today's shutdown/pause. This accepts all five bounded fixes:
  selected cut above overlaps; truthful valid/dirty/action readiness; muted clean
  Save before Generate; Sources-style tabs; spacing above Animation creation.
- Preserve the accepted Sources navigation and owner Add new / Update named
  Image / Skip workflow, precise Cutter, and existing accepted Animation path.
- Earlier VT-020, VT-022, VT-023, VT-024, protected foundations and bounded
  accepted authority remain frozen. Automation is not their acceptance source.

### Implemented but not accepted or integrated

- PR #256 is open and unmerged despite code CI and live acceptance being green.
- Older PR #255 remains open with failed older evidence. Its Sources work is
  incorporated into #256; do not independently merge the obsolete candidate.
  Reconcile its status explicitly during integration, preserving useful history.
- VT-001/CP4.5 remains REVISE. Broader VT-021 Assembly and A1.7/full isolated
  agent-assisted authoring retain their separate gates. Shared Review acceptance
  and the semantic Cutter proof do not close those gates.

### Planned / not implemented or authorized by this block

No Library/source deletion, archival/CAS cleanup, automatic layout copying onto
a changed original, new agent tools/grants, complete isolated agent processing,
materialization, runtime activation, A5/A6, publication/release, remote access
expansion or image generation follows from VT-025 acceptance.

### Open decisions

Integrator must re-resolve exact heads and gates before a human-authorized
merge, then observe post-merge CI before dependent work. Coordinator/Product
select the next bounded step toward real Numberdroid assets and agent access;
do not silently start another roadmap block. Klaus prefers bundled meaningful
tests, plain-language guidance and no repeat of passed behavior without cause.

## 3. Exact code and engineering evidence

Local worktree: `/home/klaus/.bb/thread-storage/numberdroid-review-proposed-addition`

Local branch: `agent/source-library-live-local`

Accepted local code: `b1dbff3e99ba18d976966e672ebf490f90394169`

Remote branch: `agent/source-library-live-20260916`

Accepted remote code: `9189b79571635b0f85bfa3223a456142d006e3fe`

Identical accepted code tree: `afbfca5d187309c0b581407c649a6f64bb745caf`

PR: [#256](https://github.com/KlausUllrich/numberdroid/pull/256)

The later pause-document commit will have different local/remote commit IDs;
re-resolve them and compare tree IDs, not commit-ID equality. Do not reset an
unrelated dirty checkout or infer current source from an old local branch name.

[Build2490](https://github.com/KlausUllrich/numberdroid/actions/runs/35332417113)
completed successfully on the accepted remote code head:

- Linux Studio:1209 total,1204 passed,5 expected skips,0 failed; full browser lane green.
- Windows Studio:1209 total,1201 passed,8 expected skips,0 failed.
- Both:403 syntax/build files and frozen Checkpoint1A evidence VERIFIED.
- Root:230 tests across46 files, build and grounding-browser gate green.
- Classifier and final CI gate green; Pages correctly skipped.
- Five trigger-relevant independent review axes GO: interaction/UX, native
  geometry, authority/safety, persistence/recovery and test/CI scope.
- Native six-view evidence at1440/1060 proved all eight handles, selected-cut
  overlap resizing without semantic order changes, Undo/dirty/action recovery,
  tab parity, Save ordering and20px Animation-action gap.

An earlier local full run had one obsolete HTTP wording assertion; its affected
module was corrected and passed6/6. Do not rewrite that historical run as green.
The final exact-code CI above independently ran the complete suites successfully.

Primary implementation paths, relative to `tools/numberdroid-studio/`:

- `apps/studio-server/public/{app.js,styles.css,cutter-editor-state.js,cutter-editor-view.js,source-library-controller.js}`
- `apps/studio-server/src/server.js`
- `packages/application/src/source-library-service.js`
- `packages/persistence/src/sqlite/source-library-operation-store.js`
- `packages/persistence/src/sqlite/migrations/0019_source_library_operations.sql`
- `packages/persistence/src/integrity/source-library-integrity.js`
- `tests/cutter-editor-state.node-test.js`, `tests/cutter-ui.node-test.js`
- `tests/source-library-{service,http,controller,integrity,migration}.node-test.js`
- `scripts/verify-cutter-editor-browser.js`, `scripts/verify-source-library-recovery-browser.js`

Do not rerun full product suites for this documentation pause. For a future
source diff, classify actual risk first, start with its focused modules under
`timeout 120s`, then run only tier/path-selected complete gates. Existing L3
baseline commands from the Studio directory are `timeout 180s npm test`,
`timeout 120s npm run build`, and `timeout 120s npm run evidence:verify`.
Browser and Windows obligations follow the current policy and actual changes.

## 4. Saved workspace and exact restart

**Preserve this existing directory; do not generate a new fixture into it:**

`/home/klaus/.bb/thread-storage/numberdroid-vt025-live-20260918.VWA6R1/data`

It is outside the repository and `/tmp`, so ordinary reboot does not recreate
or discard it. Project ID `project.animation-editor`, display name
**Animation editor — synthetic test**. The last read-only server query reported
revision **27**, updated `2026-09-18T10:07:10.898Z`. Re-read on return; do not force
that revision or assume no later user save occurred. This is a preserved synthetic
test workspace, not permission to import production art automatically.

Original `source.animation-sheet`; layout `atlas.animation-components` began
with nine cuts. Klaus tested saved layouts and a named **Workflow test image**.
Preserve his current results and schema19 receipts, not the original seed state.
Do not rerun `prepare-animation-editor-fixture.js` against this directory.

BB terminal at pause: `term_p6fva8vb7s`, title
**Studio VT-025 Cutter retest · b1dbff3**, thread `thr_frvv8dkm74`.
The root agent did not stop it unexpectedly. Klaus may stop it using Ctrl-C and
wait for terminal exit. Save any wanted browser-only draft first; an unsaved
browser draft is not guaranteed by preserving the server data directory.

On return inspect port4317 and existing process/terminal before starting anything;
never launch two writers on this directory. After confirming it is stopped,
use the same code or a verified compatible successor in a persistent BB terminal
with this already-used startup command:

```bash
env -u NUMBERDROID_STUDIO_OPERATIONS_CONFIG \
  NUMBERDROID_STUDIO_DATA=/home/klaus/.bb/thread-storage/numberdroid-vt025-live-20260918.VWA6R1/data \
  NUMBERDROID_STUDIO_HOST=127.0.0.1 \
  NUMBERDROID_STUDIO_PORT=4317 \
  NUMBERDROID_STUDIO_STORE=sqlite \
  timeout --signal=INT --kill-after=20s 8h \
  /usr/bin/node /home/klaus/.bb/thread-storage/numberdroid-review-proposed-addition/tools/numberdroid-studio/apps/studio-server/src/server.js
```

Local health endpoint: `http://127.0.0.1:4317/health`. Read projects using
`GET /api/projects`; verify the actual saved project before giving a test link.
Read the BB CLI/share-server-links skills before using their commands. Re-expose
port4317 through BB Connect if needed and use the URL it returns. The pause URL
was `https://klaus-bb--4317.getbb.app/?build=b1dbff3#sources`; it requires Klaus's
BB session and a running local server. It is not an anonymous deployment.

Old pre-pause workspace remains untouched at
`/home/klaus/.bb/thread-storage/numberdroid-pause-20260916.p3Pj7e/workspace`.
Do not open it with the schema19 writer, delete locks, downgrade SQLite or clean
up either workspace. This pause did not authorize worktree/data cleanup. Code
and handoff are published; fixture data remains on this machine, not in GitHub.

## 5. Process learning and next action

Render the selected cut last without reordering semantic rectangles or changing
IDs/output identity. Geometry validity is distinct from save/job readiness:
valid dirty work says Save first; clean work needs no redundant Save; Undo or
manual return to saved geometry clears dirty. Preserve the immutable original
request/key for uncertain Save recovery, including a stale displayed definition.

Accepted cuts do not require a second acceptance. Owner Save creates/updates
named DRAFT Library Images atomically; it does not silently make them READY or
retarget existing Room/Assembly/Animation version pins. Source relationship is
provenance, not permission for cascading deletion or a reason to keep unwanted
Library items. Future deletion needs its own reference-closure design and scope.

QA / Integrator is primary because implementation and live acceptance are
complete. Engineer returns only for a named regression or approved new block.
The first resumption is read-only verification plus starting the existing
workspace when requested. Summarize the verified state and any conflict before
new mutations. Integration remains gated by current exact-head checks and merge
authority; broader product acceptance remains Klaus's decision.

Definition of the pause being complete: both human passes recorded consistently,
source and pause docs durable remotely, saved workspace retained, no local
development/test/watch operation left requiring attendance. A newly triggered
documentation-head CI run executes on GitHub and may finish after shutdown;
next session must read its actual result, not infer it from Build2490.

Final receiver launch protocol:

1. Verify current remote main, PRs, task heads and Actions through the connector.
2. Read universal bootstrap, primary route and the exact bundle above.
3. Inspect local branch/tree, source compatibility and retained process/data state.
4. Report conflicts; preserve existing user data and accepted decisions.
5. Reopen the retained workspace when Klaus is ready; no seed/reset or repeat batch.
6. Reconcile integration before dependent development. Propose the next bounded
   scope visibly; do not cross design, agent-authority, art or release gates.
