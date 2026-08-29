# Numberdroid Studio — Consolidated Return Test Backlog

Status: **current live backlog for candidate work created while Klaus cannot test**

Source baseline recorded: 2026-08-29 at integrated A1.7 visual-candidate `main`
`2bac6e77d5e8dae8ee88021aaa9dfba7345c5196`. A later documentation-only
integration record does not change the candidate runtime tree. Receivers MUST
replace this with newer verified source `main` truth as work lands.

## Purpose

Klaus intends to run one larger test session after his vacation. Every candidate
created meanwhile must add a bounded record here so the return session can be
run in dependency order without reconstructing chat history.

Keep these states distinct:

- `AUTOMATED GREEN` — implemented and all declared automated gates passed;
- `NEEDS KLAUS REVIEW` — a non-visual product/contract decision remains;
- `NEEDS KLAUS LIVE` — visual, workflow, device, or gameplay testing remains;
- `BLOCKED` — a named dependency or authority gate is open;
- `REJECTED` — a live or contract gate failed and the candidate is superseded.

`Merged`, `CI green`, and browser evidence never mean user-accepted.

## Current queue

| ID | Candidate | State | Depends on | User gate |
| --- | --- | --- | --- | --- |
| VT-000 | Protected Studio baseline and restart | AUTOMATED GREEN | accepted CP1–4 | Quick safety/regression confirmation at session start |
| VT-001 | CP4.5 designer workflow candidate | NEEDS KLAUS LIVE | VT-000 | Desktop list/create/detail, preview, persistent editor, `VOID`/`BLOCKED` |
| VT-002 | A0.1–A0.4 interface candidates | NEEDS KLAUS REVIEW | VT-000 | Accept/revise bounded capability, candidate, query, and validate-only bridge contracts |
| VT-003 | CP5 candidate-only adapter/compiler foundation | BLOCKED | VT-001 and later explicit CP5 gate | Candidate fidelity only; no materialization or publication |
| VT-004 | A1.3 project-bound adoption preflight | NEEDS KLAUS REVIEW | VT-000 and accepted A1.0–A1.2 | Accept/revise the read-only capability/Asset/CAS closure; no live workflow |
| VT-005 | A1.4 processing-result adoption plan | NEEDS KLAUS REVIEW | VT-004 | Accept/revise the private agent-task command/policy and commitless create/update semantics |
| VT-006 | A1.5 private adoption persistence | NEEDS KLAUS REVIEW | VT-005 | Accept/revise the private atomic/replay/retention boundary and DRAFT persistence semantics |
| VT-007 | A1.6a Authoring-v2 prerequisites | NEEDS KLAUS REVIEW | VT-006 | Accept/revise the private v2 overlay/profile and real effect-free planning composition |
| VT-008 | A1.6b1 host-bound adoption admission | NEEDS KLAUS REVIEW | VT-007 | Accept/revise the current Binding/Grant replay and mutation-UoW admission boundary |
| VT-009 | A1.6b2a private Authoring-v2 session | NEEDS KLAUS REVIEW | VT-008 | Accept/revise the one-shot/full-admission versus ledger-first commit boundary |
| VT-010 | A1.6b2b Authoring-v2 MCP transport | NEEDS KLAUS REVIEW | VT-009 | Accept/revise explicit handshake-gated 31/6 discovery, fresh authority, and restart replay |
| VT-011 | A1.7 processed-asset review UI candidate | NEEDS KLAUS LIVE | VT-000 and VT-004–VT-010 | Accept/revise the selected-task preview, correction hierarchy, responsive layout, fallback, and return-state continuity |

Future A1, O1, MCP, UI, backup, remote, and mobile blocks MUST append their own
ID only after implementation exists. Planned work is not a candidate. The
documentation-only O0 decision in
[`O0_BACKUP_RECOVERY_CONTRACT.md`](O0_BACKUP_RECOVERY_CONTRACT.md) receives no
`VT-` item; the required first O1 backup UI must append one when its
implementation candidate exists.

The implementation-grounded A1.7 D0 state contract is frozen in
[`A1_7_STATE_CONTRACT.md`](A1_7_STATE_CONTRACT.md), and the separately
classified read projection is an implemented candidate recorded in
[`A1_7_READ_PROJECTION_STATUS.md`](A1_7_READ_PROJECTION_STATUS.md). Neither D0
nor a non-visual prerequisite receives `VT-011`. After the visual surface also
exists, `VT-011` must record the combined visible return test while retaining
the blocks' distinct PR/CI evidence and the **implemented candidate — not user
accepted** state.

## VT-000 — protected baseline and restart

- **Implementation/merge:** accepted CP1–4 history; current `main` must be
  recorded at test time.
- **Safe fixture:** a newly allocated temporary Studio workspace only. Never
  start this test without an explicit `NUMBERDROID_STUDIO_DATA` value.
- **Allocate on Linux/macOS:** run `mktemp -d`, copy the exact printed absolute
  path, and replace `PASTE_ABSOLUTE_RETURN_BASELINE_PATH` below with that path.
  Do not substitute `.numberdroid-studio` or an existing directory.
- **Allocate on Windows PowerShell:** run:

  ```powershell
  $studioReturnBaseline = Join-Path ([System.IO.Path]::GetTempPath()) ("numberdroid-return-baseline-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $studioReturnBaseline
  ```

- **Start on Linux/macOS:** from `tools/numberdroid-studio/`, run `npm ci`,
  `npm test`, `npm run evidence:verify`, then:

  ```bash
  NUMBERDROID_STUDIO_DATA="PASTE_ABSOLUTE_RETURN_BASELINE_PATH" npm run dev
  ```

- **Start on Windows PowerShell:** from `tools/numberdroid-studio/`, run the
  same verification commands, then:

  ```powershell
  $env:NUMBERDROID_STUDIO_DATA = $studioReturnBaseline
  npm run dev
  ```

  Open `http://127.0.0.1:4317` and choose **Create / load demo**.
- **Check:** project/revision/activity load; source, asset, room, and task
  navigation work; restart preserves the same head and previews; no duplicate
  activity or mutation appears.
- **Expected:** accepted CP1–4 behavior remains intact. Any regression stops the
  later walkthroughs.
- **Recovery:** stop Studio. Retain the exact temporary directory until the
  session result is recorded, then discard only that uniquely allocated
  directory through the operating system's normal temporary-file cleanup. On
  PowerShell also run `Remove-Item Env:NUMBERDROID_STUDIO_DATA`. Never use active
  user data or an existing backup as a reset target.

## VT-001 — CP4.5 desktop designer gate

- **Implementation:** PR #137; candidate status and evidence are pinned in
  `CHECKPOINT_4_5_STATUS.md`.
- **State:** implemented, source-integrated, Linux/Windows/browser green, not
  user-accepted.
- **Platform:** desktop Chrome at a useful width; protected automated widths are
  1440×900 and 1060×900.
- **Safe fixtures:** this gate requires two different freshly allocated
  directories. The accepted CP4 task fixture contains task/review states; the
  CP2C → CP3 → CP4.5 chain contains the real prop and persistent room editor.
  Neither fixture script may target an existing directory.
- **Prepare the task fixture on Linux/macOS:** allocate with `mktemp -d`, copy
  the exact absolute path, replace `PASTE_ABSOLUTE_RETURN_TASK_PATH`, then from
  `tools/numberdroid-studio/` run:

  ```bash
  node scripts/prepare-checkpoint-4-visual-evidence.js "PASTE_ABSOLUTE_RETURN_TASK_PATH"
  NUMBERDROID_STUDIO_DATA="PASTE_ABSOLUTE_RETURN_TASK_PATH" npm run dev
  ```

- **Prepare `$studioReturnTask` on Windows PowerShell:** allocate a unique temp
  directory as in VT-000, replacing the variable name, then run:

  ```powershell
  node scripts/prepare-checkpoint-4-visual-evidence.js $studioReturnTask
  $env:NUMBERDROID_STUDIO_DATA = $studioReturnTask
  npm run dev
  ```

- **Task walkthrough:**
  1. Open **Agent tasks** and verify list → focused creation → one selected-task
     flow, including next actor, consequence, conflict-disabled completion,
     rejection, and one-time undo.
  2. Stop Studio after recording the task result. Do not reuse this directory
     for room preparation.
- **Prepare the room fixture on Linux/macOS:** allocate a second directory with
  `mktemp -d`, copy its exact path, replace
  `PASTE_ABSOLUTE_RETURN_ROOM_PATH`, then run the full fixture chain:

  ```bash
  node scripts/prepare-checkpoint-2c-visual-evidence.js "PASTE_ABSOLUTE_RETURN_ROOM_PATH" applied
  node scripts/prepare-checkpoint-3-visual-evidence.js "PASTE_ABSOLUTE_RETURN_ROOM_PATH"
  node scripts/prepare-checkpoint-4-5-visual-evidence.js "PASTE_ABSOLUTE_RETURN_ROOM_PATH"
  NUMBERDROID_STUDIO_DATA="PASTE_ABSOLUTE_RETURN_ROOM_PATH" npm run dev
  ```

- **Prepare `$studioReturnRoom` on Windows PowerShell:** allocate a second unique
  temp directory, then run:

  ```powershell
  node scripts/prepare-checkpoint-2c-visual-evidence.js $studioReturnRoom applied
  node scripts/prepare-checkpoint-3-visual-evidence.js $studioReturnRoom
  node scripts/prepare-checkpoint-4-5-visual-evidence.js $studioReturnRoom
  $env:NUMBERDROID_STUDIO_DATA = $studioReturnRoom
  npm run dev
  ```

- **Room/preview walkthrough:**
  1. Open **Rooms** and verify that the central canvas remains visible while
     switching among all seven tools and the Purpose/Check dock panels.
  2. Paint one cell outside, blocked, then room floor with a pointer. Exactly
     one tool remains active and the three counts always sum to the envelope.
  3. Verify surface, prop, and connector overlays are ghosted and do not capture
     painting; no empty conflict bar is shown.
  4. Verify dirty/save/reload/conflict truth above the canvas; incompatible
     mutation is blocked while dirty; Purpose/Check never replace the canvas.
  5. Inspect a real prop and judge whether exact image, footprint, anchor,
     rotation, collision/navigation, and placement readiness are useful before
     acting.
- **Decision:** accept or reject the task flow, useful preview, persistent
  editor, and `VOID`/`BLOCKED` authoring semantics. Automation cannot close it.
- **Recovery:** stop Studio and retain both exact temp directories until results
  are recorded. Discard only those unique directories through normal temp-file
  cleanup; clear `NUMBERDROID_STUDIO_DATA` in PowerShell. Never aim a fixture
  script at `.numberdroid-studio`, an active workspace, or any backup.

## VT-002 — A0 interface review

- **Implementation:** A0.1–A0.4 are integrated candidates; current status is
  summarized in the Roadmap and exact heads/fingerprints are recorded in the
  2026-08-28 handoff and verifiable from current Git history/tests.
- **Review:** confirm that `ProjectCapabilityManifest`, its read-only query,
  immutable `CandidateManifest`, and validate-only `EngineBridge` are the right
  bounded interfaces for the Numberdroid-first direction.
- **Expected:** no persistence/UI/MCP expansion, destination, materialization,
  commit, publish, or product acceptance is implied.
- **Decision:** accept, request changes, or keep candidate-only. This may be
  batched with the later A1 contract review.

## VT-003 — CP5 candidate-only foundation

- **Implementation:** see `CHECKPOINT_5_CONTRACT.md` and
  `CHECKPOINT_5_STATUS.md`.
- **Blocked by:** the CP4.5 user gate and a separately prepared CP5 candidate
  walkthrough. Source integration alone is insufficient.
- **Boundary:** review deterministic snapshot/manifest/virtual outputs and
  compiler findings only. Materialization, repository commit, publication, and
  runtime acceptance remain separate and unavailable.

## VT-004 — A1.3 project-bound adoption preflight

- **Implementation:** focused A1.3 candidate in PR #150 at implementation head
  `9ad3b68ac64a1a073fbdcec63b62d2205aa01d98`, based on tested `main`
  `dcf85b36f7b68d9b88d314cdccb49287dc70bdc8`. Final PR head
  `13c1e5275c3ffe3e9939485a8cf93ee3d0d7b6aa` was source-integrated into `main`
  as merge commit `e0099629d9b932660ac85395e952db34b35d3e2b`. Exact contract
  and fixture hashes are in `A1_3_STATUS.md`.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-000 and the accepted
  A1.0–A1.2 contracts. Source integration and CI do not close this decision.
- **Safe fixture/reset:** no Studio workspace, database, CAS directory, server,
  browser, or Numberdroid checkout is used. The fixture is pure immutable data
  inside `tests/processing-adoption-preflight.node-test.js`; therefore it cannot
  alter user data and needs no reset.
- **Optional automated reproduction:** with Node 22.17.0 and lockfile
  dependencies installed, run from `tools/numberdroid-studio/`:

  ```bash
  node --test tests/processing-adoption-preflight.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm the request closes the full accepted Recipe → Result → Selection
     values plus exact project/revision and explicit `create` `0/0` or positive
     exact `update` Asset/metadata coordinates.
  2. Confirm capability success requires the dedicated validate operation and
     exact module/format versions; broad `studio.asset` presence is
     insufficient.
  3. Confirm current Numberdroid profile v1 remains unchanged and returns
     `PREFLIGHT_BLOCKED` before Asset or CAS reads.
  4. Confirm each recipe-input and selected-output check independently matches
     registered project reference, `LIVE` metadata, and physical descriptor.
  5. Confirm `ERROR` blocks, `WARNING` remains `UNRESOLVED`, malformed protocol
     data produces no receipt, and dependency failures disclose no local path.
  6. Confirm even `PREFLIGHT_PASSED` says `READ_ONLY`, `NOT_GRANTED`, no Asset
     mutation, and mandatory revalidation at any later mutation boundary.
- **Platform/evidence:** non-visual contract review; no browser, viewport,
  Windows, device, or gameplay gate. Local Node 22.17.0 evidence is 10/10 focused
  A1.3, 76/76 focused compatibility, and 346/346 full Studio tests. Synthetic
  request/receipt hashes are
  `edbcc5deddec9a49eba30a8a42f315722c833c96504ec74e14944599379fd840`
  and `fe6e897d4eec5a770fc6b79a25dd812d31f183de69a518f932c4926ca83b66fb`.
  PR Actions run [33150271295](https://github.com/KlausUllrich/numberdroid/actions/runs/33150271295)
  and post-merge `main` run
  [33150374430](https://github.com/KlausUllrich/numberdroid/actions/runs/33150374430)
  passed the change classifier, Linux Studio, and CI gate; root, visual,
  Windows, and Pages jobs were correctly skipped.
- **Known limits:** port contracts and fakes only; no production Asset/CAS
  adapter, Numberdroid profile v2, persistence, mutation, command, job, MCP,
  HTTP, UI, review/lifecycle, race guarantee, or `IMG-006` completion.
- **Open Klaus decision:** accept or revise the A1.3 request/evidence/receipt
  boundary and the deliberate current-profile fail-closed policy. Automation
  cannot answer this product-contract decision.
- **Recovery:** because A1.3 writes no workspace or schema state, source rollback
  is a normal revert of its focused source commit/PR. No data restoration,
  migration rollback, CAS cleanup, or fixture deletion is required.

## VT-005 — A1.4 processing-result adoption planning

- **Implementation:** focused A1.4 candidate based on verified `main`
  `1482a4ae1df450900e37209d0fc09c1ddfc831c3`. PR #152 implementation head
  `8a2f372226add6a4ff3435a8ab5414e27035be17` was source-integrated into
  `main` as `30de2527f607b7c3a899aad75d36e174872bbc49`. Exact command, semantic,
  lineage, receipt, plan, and reviewed-diff hashes are in `A1_4_STATUS.md`.
  Source integration and Actions do not close the user decision.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-004 because the plan
  deliberately repeats A1.3 rather than treating its receipt as authority.
- **Safe fixture/reset:** no Studio workspace, database, CAS directory, server,
  browser, or Numberdroid checkout is used. The successful authority evidence
  exists only in `tests/processing-adoption-command.node-test.js`; the new
  command/scope is unregistered, so the fixture cannot grant live authority or
  alter user data and needs no reset.
- **Optional automated reproduction:** with Node 22.17.0 and lockfile
  dependencies installed, run from `tools/numberdroid-studio/`:

  ```bash
  node --test tests/processing-adoption-command.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm the command carries the complete A1.3 request but no receipt,
     actor, task, grant, branch, review, lifecycle, or destination authority.
  2. Confirm only an agent with exact ACTIVE Task, active Grant, non-main branch
     and branch revision, private scope, project/Asset object scopes, expiry,
     budget, and no auto-accept reaches the preflight read.
  3. Confirm every prepare repeats a fresh A1.3 preflight for the same project,
     branch, revision, and request; stale or cross-bound evidence fails closed.
  4. Confirm create plans one explicit DRAFT name, output pixel size, null pivot,
     validator-normalized explicit-empty DRAFT metadata, its fingerprint and
     eight deterministic missing-metadata `ERROR` findings, empty Asset warning
     dispositions, and versions `1/1` without writing them. Those findings are
     valid evidence for an incomplete DRAFT and block later `VALIDATED`
     promotion, not planning or DRAFT creation.
  5. Confirm update plans imagery lineage only, resets the new immutable version
     to DRAFT, preserves the current name and authored metadata, and requires
     derived visual metadata/findings to be recomputed atomically. The metadata
     version remains `M` only for an equal revalidated fingerprint and otherwise
     becomes `M+1`, including dimension or pivot drift.
  6. Confirm a `ProcessingResult` `ERROR` blocks preflight and therefore leaves
     no plan, while a `ProcessingResult` `WARNING` remains fingerprint-bound and
     `UNRESOLVED`. Confirm that this is separate from the Asset findings and
     empty Asset warning-disposition list, and that neither result grants
     warning disposition or owner authority.
  7. Confirm all results say `NONE`, `NOT_GRANTED`, `NOT_PERFORMED`,
     `NOT_ATTEMPTED`, and mandatory revalidation in a later atomic unit of work.
  8. Confirm A1.4 only freezes the all-or-none/idempotency policy: same key plus
     same task-bound semantics returns the original result, different semantics
     conflict, reusing a command ID with another key fails, and unknown outcomes
     retry the same key; no ledger or replay is read, written, or claimed by the
     candidate.
  9. Confirm the type/scope remain absent from the accepted command/grant
     catalogs and there is no SQLite, StudioService, MCP, HTTP, or UI wiring.
- **Platform/evidence:** non-visual contract review; no browser, viewport,
  Windows, device, or gameplay acceptance gate. Local Node 22.17.0 evidence is
  13/13 A1.4, 136/136 broad focused compatibility, 359/359 full Studio, and
  129/129 JavaScript syntax files. Production-adapter evidence remains
  `VERIFIED` at
  protected source-manifest hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
  links, classifier self-test, link-checker self-test, and diff check pass. The
  exact classifier selects Studio, browser evidence, and Windows while leaving
  root, Pages, and full false. Independent QA, Security/Authority, Domain,
  CAS/Atomicity, and Compatibility reviews all reported GO. PR Actions run
  [33156327525](https://github.com/KlausUllrich/numberdroid/actions/runs/33156327525)
  and post-merge `main` run
  [33156739135](https://github.com/KlausUllrich/numberdroid/actions/runs/33156739135)
  passed the classifier, Linux Studio including browser evidence, Windows
  Studio, and CI gate; root, Pages, and full jobs were correctly skipped.
  Conservative browser/Windows CI does not imply new UI or visual acceptance.
- **Known limits:** read ports and test fakes only; no command/scope
  registration, production Task/Grant/preflight adapter, Numberdroid profile
  v2, persistence, mutation, transaction, reference/Activity/idempotency/budget
  write, race guarantee, job, MCP, HTTP, UI, owner review/merge/lifecycle,
  materialization, publication, or end-to-end `IMG-006` completion.
- **Open Klaus decision:** accept or revise the private command shape, strict
  agent-task authority policy, fresh-preflight rule, validator-normalized
  explicit-empty DRAFT create semantics, conditional `M`/`M+1` imagery-only
  update semantics, and A1.5 atomic revalidation/write checklist. Automation
  cannot answer this product-contract decision.
- **Recovery:** A1.4 writes no workspace or schema state. Source rollback is a
  normal revert of its focused source commit/PR; no migration rollback, data
  restore, CAS cleanup, task repair, or fixture deletion is required.

## VT-006 — A1.5 private processing-result adoption persistence

- **Implementation:** non-visual A1.5 candidate based on verified `main`
  `06ac195a26011e2e8c6e9b41b20521005da89094`. It adds the strict private
  Aggregate/CommitResult, atomic-store port, one additive schema-v13 migration,
  branch-local SQLite/CAS store, deep integrity, retention/backup compatibility,
  and portable-bundle guards described in `A1_5_STATUS.md`. PR #154 integrated
  it as squash commit `9c182a2211acdb2888fe360c55f592bc1c2e54ea` after
  PR Actions run 33162846969 passed; post-merge run 33163256273 also passed.
  Neither source integration nor Actions closes the user decision.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-005 because the store
  enforces the exact private command, create/update, idempotency, and
  revalidation policy A1.4 froze. VT-004/VT-005 acceptance may revise this
  candidate contract even when all automated persistence evidence is green.
- **Safe fixture/reset:** do not point any command at a personal Studio
  workspace. Successful authority/capability exists only in fresh temporary
  directories created by
  `tests/processing-adoption-persistence.node-test.js` and
  `tests/processing-adoption-sqlite-store.node-test.js`; each test deletes its
  own SQLite/CAS fixture. The command and scope remain unregistered, the
  Numberdroid profile remains unsupported, and no live server/browser/task can
  invoke the seam. No manual reset is required.
- **Optional automated reproduction:** with Node 22.17.0 and lockfile
  dependencies installed, run from `tools/numberdroid-studio/`:

  ```bash
  node --test \
    tests/processing-adoption-commit-application.node-test.js \
    tests/processing-adoption-persistence-domain.node-test.js \
    tests/processing-adoption-persistence.node-test.js \
    tests/processing-adoption-sqlite-store.node-test.js \
    tests/processing-adoption-compatibility.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm the application accepts only the original command, trusted
     agent-task context, and optional signal; no caller plan, receipt, evidence,
     owner decision, lifecycle state, or `replayed` claim crosses the port.
  2. Confirm the first commit repeats ACTIVE Task/Grant/head-ledger, actor,
     non-main branch, project/Asset scopes, private scope, expiry, no-auto-accept,
     budget/usage, capability, Asset, metadata/findings, current Main artifact
     authority, and registered-LIVE plus physical CAS checks.
  3. Confirm same key plus identical task-bound semantics returns the original
     result with zero clock/capability/CAS calls, writes, or second charge—even
     when a retry uses a new unused command ID. Confirm changed semantics and a
     reused command ID retain their distinct deterministic conflicts.
  4. Confirm Create records only a private branch-local DRAFT at versions `1/1`
     with explicit name, normalized explicit-empty authored metadata, exact
     processing lineage, eight incomplete-metadata findings, and empty warning
     dispositions. Confirm Update produces `N+1`, preserves authored metadata,
     and uses `M` only for an equal visual-facts fingerprint, otherwise `M+1`.
  5. Confirm one transaction closes the branch revision/result, Aggregate, two
     exact artifact roles, evolving private heads, Task/embedded-Grant usage,
     and Activity. Each injected failure leaves none; retry after an unknown
     post-commit outcome returns the original result after reopen.
  6. Confirm private references preserve both CAS digests for GC/backup after a
     temporary Main reference is released but never make
     `hasProjectReference()` true or authorize a new adoption. Same digest must
     remain two semantic roles.
  7. Confirm deep integrity rejects Aggregate/result/column/head/usage/evidence
     and physical-CAS tampering, unknown schema v14, and any MERGED processing
     task. Confirm v12 backup reading, v13 backup/verify, CANCELLED/REJECTED
     omission, and portable bundle v1-v3 compatibility remain intact.
  8. Confirm Main project revisions/Activity, CP2C Asset versions/heads,
     `ExactSliceBinding`, command/scope counts, Numberdroid profile v1, MCP
     counts, HTTP/UI, and accepted visual evidence are unchanged.
  9. Confirm the atomicity statement is deliberately limited to one SQLite
     transaction plus exact held bytes of pre-existing immutable CAS objects;
     it is not a joint filesystem/database transaction and assumes no
     concurrent uncoordinated GC or external filesystem mutation.
- **Platform/evidence:** non-visual contract/persistence review; no browser,
  viewport, device, gameplay, or live-workspace acceptance gate. Exact local
  test counts, syntax/evidence/link/classifier checks, independent review
  verdicts, PR Actions, and post-merge Actions are recorded in
  `A1_5_STATUS.md`. Both integration runs passed their classifier-selected
  Linux, Windows, browser-evidence, and CI-gate jobs. Conservative
  Windows/browser selection is regression coverage and does not imply a changed
  UI or visual acceptance.
- **Known limits:** private unwired port only; no registered command/scope,
  Numberdroid profile v2, production task/capability dispatch, job, MCP/HTTP/UI,
  Main/CP2C Asset mutation, review/merge/lifecycle, new pixel operation,
  materialization, publication, or end-to-end `IMG-006`. Existing coordinated
  maintenance and absent-destination backup/restore preconditions remain; there
  is no schema downgrade after committed v13 writes.
- **Open Klaus decision:** accept or revise the durable private Aggregate and
  result shapes, ledger-first alias replay, strict head/authority revalidation,
  DRAFT create/update metadata policy, two-role retention without authority
  widening, and documented CAS/SQLite/GC operational boundary. Automation
  cannot answer this product-contract decision.
- **Recovery:** before exercising any future wired form, create and verify a
  workspace backup under exclusive maintenance. Migration 13 is forward-only;
  rollback after a committed v13 adoption means restoring that verified
  pre-change workspace backup or applying a forward repair, never opening the
  database with v12 code or deleting immutable private rows. The current
  candidate is unwired, so ordinary users cannot create such state.

## VT-007 — A1.6a Authoring-v2 prerequisites

- **Implementation:** non-visual A1.6a candidate based on verified A1.5-closure
  `main` `5816c88e14b74e521d742c3966b5186b7651f661`. It adds the private
  separately typed Authoring-v2 command feature, exact 31-scope vocabulary,
  additive Numberdroid profile v2,
  trusted task/grant catalog injection, and real SQLite/CAS-backed A1.4
  planning ports described in `A1_6A_STATUS.md`. Implementation source commit
  `d978d6f89b4e2e1c83c590685727b12937f9215b` was integrated through PR
  [#156](https://github.com/KlausUllrich/numberdroid/pull/156) as squash commit
  `cdb531ed5d23422b5e143c3d61ecb789bea36515`. Neither source integration nor
  Actions can close the user decision.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-006 because the real
  planning ports and profile describe exactly the A1.5 command and mutation
  boundary. VT-004–VT-006 acceptance may revise this candidate even when all
  automated compatibility and no-effect evidence is green.
- **Safe fixture/reset:** no live client can select the v2 overlay/profile or
  planning ports. Reproduction uses only fresh temporary SQLite/CAS directories
  created and deleted by `tests/authoring-v2-prerequisites.node-test.js` and
  `tests/processing-adoption-persistence.node-test.js`. Never point exploratory
  code at a personal Studio workspace. No manual reset is required.
- **Optional automated reproduction:** with Node 24.19.0 and lockfile
  dependencies installed, run from `tools/numberdroid-studio/`:

  ```bash
  node --test \
    tests/authoring-v2-prerequisites.node-test.js \
    tests/processing-adoption-*.node-test.js \
    tests/agent-task*.node-test.js \
    tests/project-capability*.node-test.js \
    tests/checkpoint-4-*.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm legacy command/grant catalogs remain exactly 33/30 and profile v1
     remains at its pinned hash; only explicit trusted composition can select
     the one-feature/31-scope overlay or profile v2.
  2. Confirm profile v2 adds only the image-processing module, four JSON
     formats, and exact A1.3 validate operation; it adds no engine write,
     destination, review, lifecycle, materialization, or release capability.
  3. Confirm the default task service rejects the private scope while a trusted
     complete v2 scope catalog lets an owner mint only the exact task/grant and
     project/Asset object scopes. Adoption is always forbidden from auto-accept.
  4. Confirm the real authority reader cross-checks Task, Grant, branch head,
     immutable ledger, object/scope/expiry/budget state, and canonical usage.
  5. Confirm real dry-run obtains fresh capability, Asset, registered-LIVE, and
     physical CAS evidence and returns `READY` or a stable blocker without any
     revision, charge, Activity, Asset, Aggregate, replay, or retention write.
  6. Confirm stale branch coordinates stop before capability/CAS reads,
     cancellation propagates, and hostile thrown CAS values are sanitized
     without invoking proxy traps or accessors.
  7. Confirm a later A1.5 commit repeats all checks and charges once; no A1.4
     receipt or plan becomes executable authority.
  8. Confirm MCP remains 19/4 or legacy task-bound 30/5 and that no launcher,
     HostBinding, HTTP, UI, or environment selector activates A1.6a.
- **Platform/evidence:** non-visual contract/composition review; no browser,
  viewport, device, gameplay, or live-workspace acceptance gate. Local evidence
  is 158/158 focused, 459/459 full Studio, 140/140 JavaScript syntax files, and
  208/208 Numberdroid root tests followed by a successful production build.
  Production-adapter evidence remains `VERIFIED` at protected source-manifest
  hash `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
  Exact link/classifier/diff gates and five independent final actual-diff
  reviews are green. PR Actions run
  [#2190 / 33167832235](https://github.com/KlausUllrich/numberdroid/actions/runs/33167832235)
  passed the classifier, root build, Linux Studio including browser evidence,
  Windows Studio, and CI gate while Pages was correctly skipped. Post-merge
  `main` Actions run
  [#2191 / 33168278934](https://github.com/KlausUllrich/numberdroid/actions/runs/33168278934)
  passed the same selected jobs and again skipped Pages. Browser/Windows CI is
  conservative regression coverage, not new UI or visual acceptance.
- **Known limits:** private prerequisites only; no positive server handshake,
  profile/overlay selection, public dispatch, MCP resource/tool, HTTP/UI,
  durable job, new pixel operation, Main/CP2C Asset mutation, owner review,
  merge/lifecycle, materialization, publication, or end-to-end `IMG-006`.
- **Open Klaus decision:** accept or revise the separately versioned overlay,
  additive Numberdroid profile v2, trusted catalog-injection boundary, real
  effect-free SQLite/CAS planning reads, and the A1.6b2b exact 31-tool/six-template
  handshake target. Automation cannot answer this product-contract decision.
- **Recovery:** A1.6a adds no migration and its dry-run writes no workspace/CAS
  state. Revert the focused source candidate; no database downgrade, backup
  restore, CAS cleanup, task repair, or fixture deletion is required.

## VT-008 — A1.6b1 host-bound adoption admission

- **Implementation:** non-visual A1.6b1 candidate based on verified A1.6a
  closure `main` `5a699b75597eac219580bddf2d3d8609c63ec2b0`. It closes
  current Grant liveness in strict HostBinding resolution, preserves the
  accepted generic and specialized attempt-audit boundary, and adds the unwired
  host-bound A1.5 atomic port described in `A1_6B1_STATUS.md`. Implementation
  source commit `df75727211c1ea7767916fb2e2c2192f450031b6` was integrated
  through PR [#158](https://github.com/KlausUllrich/numberdroid/pull/158) as
  squash commit `06ceaf58e2f7ebdad1fec17a1cf6178655c32e9a`. Neither source
  integration nor Actions can close the user decision.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-007 because the
  port is a security prerequisite for exposing A1.6a's private feature and
  A1.5's commit seam. VT-004–VT-007 acceptance may still revise the underlying
  contract even when every race and compatibility test is green.
- **Safe fixture/reset:** no live server composes the host-bound adoption port
  and no client can invoke it. Reproduction uses only fresh temporary SQLite
  and CAS directories created and deleted by `host-binding.node-test.js` and
  `processing-adoption-sqlite-store.node-test.js`. Never point exploratory
  code at a personal Studio workspace. No manual reset is required.
- **Optional automated reproduction:** with Node 24.19.0 and lockfile
  dependencies installed, run from `tools/numberdroid-studio/`:

  ```bash
  node --test \
    tests/host-binding.node-test.js \
    tests/specialized-mcp-audit.node-test.js \
    tests/processing-adoption-*.node-test.js \
    tests/authoring-v2-prerequisites.node-test.js \
    tests/official-mcp.node-test.js \
    tests/checkpoint-4-mcp.node-test.js \
    tests/checkpoint-2c-http-mcp.node-test.js \
    tests/package-boundaries.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm strict HostBinding resolution joins the current Grant and rejects
     either status column, revocation, expiry, legacy state, missing state, or
     Binding↔Grant coordinate drift.
  2. Confirm the generic and specialized audit-only subject says
     `NOT_GRANTED`, rejects an invalid HostBinding, and is always followed by
     strict resolution inside the redacted attempt-failure boundary. Confirm
     only the live result supplies dispatch identity and both phases share one
     request correlation.
  3. Confirm only the exact own-data active HostBinding projection can create a
     host-bound port; proxies/accessors/extras and command-context drift fail
     without traps or dependency reads.
  4. Confirm current Binding/Grant admission runs before initial replay and
     inside `BEGIN IMMEDIATE` before concurrent replay or any write.
  5. Confirm revocation or Binding/Grant expiry crossed during capability/CAS
     prevents adoption, and revoked authority cannot receive a prior or
     concurrently committed replay.
  6. Confirm legacy A1.5 in-process replay, redacted attempt auditing, schema
     v13, catalogs/profiles, and MCP 19/4 or 30/5 remain unchanged.
- **Platform/evidence:** non-visual Authority/Persistence/compatibility review;
  no browser, viewport, device, gameplay, or live-workspace acceptance gate.
  Local evidence is 172/172 focused, 481/481 full Studio, and 141/141
  JavaScript syntax files. Production-adapter evidence remains `VERIFIED` at
  protected source-manifest hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
  Exact link/classifier/diff gates and five independent final actual-diff
  reviews are green. PR Actions run
  [#2194 / 33172043996](https://github.com/KlausUllrich/numberdroid/actions/runs/33172043996)
  passed the classifier, Linux Studio including browser evidence, Windows
  Studio, and CI gate while root build and Pages were correctly skipped.
  Post-merge `main` Actions run
  [#2195 / 33172499006](https://github.com/KlausUllrich/numberdroid/actions/runs/33172499006)
  passed the same selected jobs and again skipped root build and Pages.
  Browser/Windows CI is conservative regression coverage, not new UI or visual
  acceptance.
- **Known limits:** private admission prerequisite only; no v2 handshake,
  profile selection, adoption route/tool, capabilities resource, 31/6
  discovery, public HTTP/UI, Main/CP2C mutation, owner review/merge/lifecycle,
  materialization, publication, or end-to-end `IMG-006`.
- **Open Klaus decision:** accept or revise the strict current-Grant
  HostBinding semantics, nonauthorizing attempt-audit compatibility seam, and
  the rule that host-bound replay is denied after authority revocation while
  the private unhosted A1.5 store retains its original ledger-first recovery
  semantics. Automation cannot answer this product-contract decision.
- **Recovery:** A1.6b1 adds no migration or durable state. Revert the focused
  candidate; no database downgrade, backup restore, CAS cleanup, task repair,
  audit repair, or fixture deletion is required.

## VT-009 — A1.6b2a private Authoring-v2 execution session

- **Implementation:** non-visual A1.6b2a candidate based on verified A1.6b1
  closure `main` `cab9aa7c0d8f4037ead6f44d6127446c53598d45`. It adds the
  private admission reader/service, one-shot execution session, distinct
  host-bound atomic-port kind, and closed SQLite production composition
  described in `A1_6B2A_STATUS.md`. Implementation source commit
  `6de42142fc0fa72cb1d662dd2da8d1c313ec8c5e` was integrated through PR
  [#160](https://github.com/KlausUllrich/numberdroid/pull/160) as squash commit
  `89d6d4397057d5801aa7ba04e0b1cf6138df55eb`. Neither source integration nor
  Actions closes the user decision.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-008 because the
  one-shot session composes A1.6b1 current Binding/Grant admission and A1.5
  replay. VT-004–VT-008 acceptance may still revise the underlying contract.
- **Safe fixture/reset:** reproduction uses only fresh temporary SQLite/CAS
  directories allocated by `authoring-v2-private-session.node-test.js`. Never
  point exploratory code at a personal Studio workspace. The production
  startup probe creates its own temporary directory and closes the private
  runtime before deleting it. No manual reset is required.
- **Optional automated reproduction:** with Node 24.19.0 and lockfile
  dependencies installed, run this exact focused 183-test regression command
  from `tools/numberdroid-studio/`:

  ```bash
  node --test \
    tests/host-binding.node-test.js \
    tests/specialized-mcp-audit.node-test.js \
    tests/processing-adoption-*.node-test.js \
    tests/authoring-v2-*.node-test.js \
    tests/official-mcp.node-test.js \
    tests/checkpoint-4-mcp.node-test.js \
    tests/checkpoint-2c-http-mcp.node-test.js \
    tests/package-boundaries.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm one private session accepts exactly one capabilities or adoption
     operation and is consumed even on invalid input, failure, or cancellation.
  2. Confirm capabilities and dry-run repeat current Binding/Grant/Task/branch,
     ledger, scope/object/budget, no-auto-accept, and exact profile-v2 admission
     around asynchronous reads.
  3. Confirm `dryRun: true` returns the real A1.4 plan without revision,
     Activity, retention, CAS, or usage effects.
  4. Confirm `dryRun: false` accepts only the distinct host-bound port and does
     not place full admission ahead of A1.5 ledger-first replay.
  5. Confirm a lost first response with `maxCommands: 1` replays after reopen,
     including a new command-ID alias, without another profile/CAS read or
     effect; semantic/key conflicts retain A1.5 precedence.
  6. Confirm the SQLite server returns no v2 provider/store/runtime/session,
     writes no semantic startup state, and adds no HTTP, launcher, MCP, gateway,
     resource, or UI exposure; legacy 33/30 and 19/4 or 30/5 remain exact.
- **Platform/evidence:** non-visual Application/Persistence/Authority review;
  no browser, viewport, device, gameplay, or live-workspace acceptance gate.
  Local evidence is 183/183 focused, 310/310 conservatively expanded,
  492/492 full Studio, and 145/145 JavaScript syntax files. Production-adapter
  evidence is `VERIFIED` at protected hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
  64/64 Markdown links, checker self-tests, and full tracked-plus-new-file
  `git diff --check` pass. Exact local classification is `docs=true`,
  `docs_only=false`, `root=false`, `root_visual=false`, `studio=true`,
  `studio_visual=true`, `studio_windows=true`, `pages=false`, `full=false` over
  22 paths; the L3 PR still uses `[ci-full]`. Five independent actual-diff
  reviews for Security/Authority, Compatibility/MCP, Domain/Application,
  Persistence/Recovery, and QA/Docs are **GO** with no open findings. CI facts
  are also green: PR Actions run
  [#2198 / 33202315502](https://github.com/KlausUllrich/numberdroid/actions/runs/33202315502)
  passed the classifier, forced Root build, Linux Studio including browser
  evidence, Windows Studio, and CI gate while Pages was correctly skipped.
  Post-merge `main` Actions run
  [#2199 / 33202908594](https://github.com/KlausUllrich/numberdroid/actions/runs/33202908594)
  passed classifier, Linux Studio/browser, Windows Studio, and CI gate while
  Root build and Pages were correctly skipped by the actual path
  classification. This conservative CI evidence is not visual or contract
  acceptance.
- **Lifecycle evidence boundary:** the hidden runtime's active-operation drain
  is source-reviewed in A1.6b2a, while this block behaviorally probes idle
  startup/shutdown only. A bounded in-flight shutdown probe belongs to A1.6b2b,
  once the transport supplies a callable operation without exposing a test-only
  production backdoor.
- **Known limits:** private server composition only; no callable route,
  handshake, adoption MCP tool, capabilities resource, 31/6 discovery,
  transport audit, public UI, Main/CP2C mutation, owner review/merge/lifecycle,
  materialization, publication, or end-to-end `IMG-006`. A1.6b2b remains the
  separate transport/exposure block.
- **Open Klaus decision:** accept or revise the private one-shot API, repeated
  full admission for capabilities/dry-run, and the explicit exception that
  commit enters current-host-bound A1.5 directly so exhausted-budget
  lost-response replay remains recoverable. Automation cannot answer this
  product-contract decision.
- **Recovery:** A1.6b2a adds no migration or durable state. Revert the focused
  candidate; no database downgrade, backup restore, CAS cleanup, task repair,
  audit repair, or fixture deletion is required.

## VT-010 — A1.6b2b Authoring-v2 MCP transport

- **Implementation:** non-visual A1.6b2b transport candidate at frozen source
  head `5e2d5d96b6c7860290eaa9d07f87626de1634b1c`. It adds the
  explicit launcher selector, private positive server handshake, three narrow
  loopback/Bearer routes, gateway mapping, and the single Authoring-v2 MCP
  tool/resource delta described in `A1_6B2B_STATUS.md`. PR
  [#162](https://github.com/KlausUllrich/numberdroid/pull/162) integrated it as
  squash commit `0c5f6e5845b277716fd788375ade52905a9bf391`. Five independent
  final actual-diff reviews are **GO** with no open findings; automation does
  not close the user decision.
- **State/dependency:** `NEEDS KLAUS REVIEW`; depends on VT-009 because the
  transport exposes exactly the A1.6b2a one-shot/full-admission versus
  ledger-first commit boundary. VT-004–VT-009 acceptance may still revise the
  underlying contract. A1.7 D0 is frozen and its minimal read projection is an
  implemented candidate; the bounded visual candidate is the next separate
  implementation block and is not part of this gate.
- **Safe fixture/reset:** reproduction uses only unique directories allocated
  with `mkdtemp` by the Authoring-v2 transport/official-MCP tests. The fixture
  provisions synthetic schema-v13 SQLite/CAS data, a private task/Grant/
  HostBinding, and test PNG artifacts, then closes MCP, HTTP, runtime, and
  SQLite handles before deleting only that exact directory. Never aim these
  tests or an exploratory launcher at `.numberdroid-studio`, a personal Studio
  workspace, a backup, or a Numberdroid checkout. No manual reset or migration
  rollback is required.
- **Optional automated reproduction:** with Node 24.19.0 and lockfile
  dependencies installed, run this exact focused 208-test regression command
  from `tools/numberdroid-studio/`:

  ```bash
  node --test \
    tests/host-binding.node-test.js \
    tests/gateway-security.node-test.js \
    tests/specialized-mcp-audit.node-test.js \
    tests/processing-adoption-*.node-test.js \
    tests/authoring-v2-*.node-test.js \
    tests/official-mcp.node-test.js \
    tests/checkpoint-4-mcp.node-test.js \
    tests/checkpoint-2c-http-mcp.node-test.js \
    tests/package-boundaries.node-test.js
  ```

- **Review steps and expected result:**
  1. Confirm an absent `NUMBERDROID_STUDIO_MCP_PROFILE` preserves exact legacy
     19/4 or matching-task 30/5 discovery, while only the exact value
     `authoring-v2` requests the candidate; every other set value exits without
     protocol output or fallback.
  2. Confirm a private current-authority handshake is required before MCP
     construction and returns `READY` with either `AVAILABLE` or
     `REPLAY_ONLY`; project/profile mismatch, incomplete durable readiness, and
     revoked/expired authority fail closed.
  3. Confirm the static selected surface is exactly 31 tools/six templates and
     its entire 30/5 delta is `studio_processing_result_adopt` plus
     `studio://projects/{projectId}/capabilities`.
  4. Confirm the capabilities resource remains nonauthorizing full admission,
     required `dryRun: true` repeats full admission and has no persistent
     effect, and callers cannot smuggle actor/task/grant/profile coordinates.
  5. Confirm commit stays ledger-first: after one `maxCommands: 1` adoption and
     a full MCP/Studio/SQLite restart, `READY`/`REPLAY_ONLY` permits the same-key
     semantic replay or command-ID alias with no second effect/charge, while a
     new semantic command remains budget-denied.
  6. Confirm post-start revocation leaves discovery static at 31/6 but denies
     every fresh capability/tool operation; a new child fails its handshake
     rather than serving 30/5. Attributable failures create one redacted audit
     row, while successful discovery/dry-run creates no generic authorization
     row.
  7. Confirm cancellation propagates across MCP/gateway/HTTP/session, JSON
     bodies are bounded to 1 KiB/1 KiB/1 MiB, and shutdown drains an in-flight
     operation before closing SQLite.
  8. Confirm schema remains v13, bundles remain v1-v3, and there is no UI,
     owner review/decision, apply/finalize, merge/revert, lifecycle promotion,
     Main/CP2C mutation, materialization, publication, or release operation.
- **Platform/evidence:** non-visual MCP/HTTP/Authority/Persistence contract
  review; no browser, viewport, device, gameplay, or live-workspace acceptance
  gate. Frozen local evidence is 208/208 focused, 513/513 full Studio, and
  149/149 JavaScript syntax files. `npm run check:selftest` is green.
  Production-adapter evidence is `VERIFIED` at protected hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
  Five independent final actual-diff reviews are **GO** with no open findings.
  Initial PR Actions run
  [#2202 / 33208418002](https://github.com/KlausUllrich/numberdroid/actions/runs/33208418002)
  found a Windows-only `EBUSY` fixture teardown ordering bug. The fixed source
  head closes runtime/SQLite before removing its temporary directory. Final PR
  Actions run
  [#2203 / 33209352949](https://github.com/KlausUllrich/numberdroid/actions/runs/33209352949)
  passed classifier, forced Root build, Linux Studio/browser, Windows Studio,
  and CI gate while Pages was correctly skipped. Post-merge `main` Actions run
  [#2204 / 33209824883](https://github.com/KlausUllrich/numberdroid/actions/runs/33209824883)
  passed classifier, Linux Studio/browser, Windows Studio, and CI gate while
  Root build and Pages were correctly skipped. This is regression evidence,
  not visual or contract acceptance.
- **Known limits:** explicit private opt-in for one adoption tool and one
  capabilities template only; no launcher auto-opt-in, public Authoring-v2
  HTTP API, UI, owner decision/review, proposal apply/finalize, merge/revert,
  lifecycle, materialization, repository publication, release, or end-to-end
  `IMG-006` user acceptance. This candidate is **NOT USER ACCEPTED**.
- **Open Klaus decision:** accept or revise the exact selector and positive
  handshake, static 31/6 surface, fresh-authority behavior after revocation,
  nonauthorizing full-admission capabilities/dry-run boundary, and the
  ledger-first `REPLAY_ONLY` restart-recovery exception. Automation cannot
  answer this product-contract decision.
- **Recovery:** A1.6b2b adds no migration or durable state format. Revert squash
  commit `0c5f6e5845b277716fd788375ade52905a9bf391`; existing
  schema-v13 databases, portable bundles, HostBindings, Grants, task ledgers,
  adoption rows, retained CAS objects, and audit rows require no downgrade,
  cleanup, or repair.

## VT-011 — A1.7 processed-asset review UI candidate

- **Implementation:** the implementation-grounded D0 contract was integrated
  through PR [#167](https://github.com/KlausUllrich/numberdroid/pull/167) as
  merge commit `385620d1155db215b0dfaa80f2a27b6fc770a58f`; the separately
  classified read projection was integrated through PR
  [#168](https://github.com/KlausUllrich/numberdroid/pull/168) as merge commit
  `df2e65a02d1c10ca7de9084539ebc262865f206b`. The bounded visual candidate is
  PR [#169](https://github.com/KlausUllrich/numberdroid/pull/169), based on that
  exact `main`. Its final tested head
  `ea4079dd9599d10fbe077be092bdc6f558177f5c` has tree
  `a0bcb5115d1bde5d2266ad391ce1dae51bebf0db` and was integrated as normal merge
  commit `2bac6e77d5e8dae8ee88021aaa9dfba7345c5196`. The final tested source `main`
  is that merge commit. The visible result is **implemented candidate — not
  user accepted**.
- **State/dependency:** `NEEDS KLAUS LIVE`; depends on VT-000 for the protected
  Studio baseline and on VT-004–VT-010 for the adoption semantics and private
  transport it presents without extending. Automated rendering and Chrome
  evidence cannot accept the visual hierarchy or correction experience.
- **Safe fixture/reset:** use only one newly allocated, empty temporary Studio
  directory. The fixture refuses a non-empty target. Never use
  `.numberdroid-studio`, an active workspace, checkout, backup, or another
  return-test directory. From `tools/numberdroid-studio/` on Linux/macOS:

  ```bash
  A1_7_RETURN_DATA="$(mktemp -d)"
  node scripts/prepare-visual-a1-7-evidence.js "$A1_7_RETURN_DATA"
  NUMBERDROID_STUDIO_DATA="$A1_7_RETURN_DATA" npm run dev
  ```

  On Windows PowerShell:

  ```powershell
  $studioA17Return = Join-Path ([System.IO.Path]::GetTempPath()) ("numberdroid-a1-7-return-" + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $studioA17Return
  node scripts/prepare-visual-a1-7-evidence.js $studioA17Return
  $env:NUMBERDROID_STUDIO_DATA = $studioA17Return
  npm run dev
  ```

- **Bounded Chrome walkthrough and expected result:**
  1. Open `http://127.0.0.1:4317`, choose **Agent tasks**, and select
     **Review processed transfer console**. Do not invoke submit-review, owner
     decision, merge, revert, lifecycle, materialization, publication, or
     release controls during this visual gate.
  2. Confirm **Processed asset draft** appears directly after **Current step**
     and before general task facts, visibly labeled **implemented candidate —
     not user accepted** with the successful state **Waiting for your review**.
  3. At 1440×900, judge the two-column preview/facts hierarchy: the exact
     64×64 transfer-console image remains centered and contained on the
     checkerboard, with useful name, dimensions and no implied Main/FINAL state.
  4. Inspect the eight correction subjects and one unresolved warning. Confirm
     that each explanation/remediation is scannable and that absence, a denied
     attempt, and a durable DRAFT are not visually conflated.
  5. Open and close **History** and **Technical details**. Confirm that version
     identifiers remain secondary, disclosures are keyboard-focusable, and no
     authority, digest, CAS path, workspace path, or new action control appears.
  6. Reload once, then switch to another workspace and back. Confirm the task
     returns coherently without stealing the other workspace, and that a
     compatible refresh retains focus, text selection, disclosure and scroll
     context rather than resetting the whole page.
  7. Repeat the selected-task inspection at 1060×900. Confirm preview and facts
     stack without horizontal overflow, clipped controls, replaced image, or a
     new shell/minimum-width regression.
  8. Record accept or revise for the preview treatment, correction/warning
     hierarchy, fallback clarity, responsive composition and retained context.
     Automation cannot record acceptance; until Klaus does, the result remains
     **implemented candidate — not user accepted** and **Waiting for your
     review**.
- **Automated evidence at local source freeze:** 17/17 focused A1.7/CP4.5/HTTP
  regression and 540/540 full Studio tests pass; 156 JavaScript files pass the
  syntax checker and its self-test; protected production-adapter evidence is
  `VERIFIED` at source-manifest hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
  Fresh-fixture refusal, production Authoring-v2 fixture preparation and
  graceful SIGTERM shutdown pass. Five final actual-diff reviews are **GO**.
  Markdown checks cover 89 links across 199 files with zero failures; Markdown
  and classifier self-tests pass. The
  exact 18-path classifier selects docs, Root, Root visual, Studio, Studio
  visual, Studio Windows, Pages and full lanes because the changed Actions
  workflow is intentionally fail-closed. Final PR Actions
  [#2223](https://github.com/KlausUllrich/numberdroid/actions/runs/33264560427)
  passed classification, Root, Studio Linux/browser, Studio Windows and CI
  gate. Its independently reverified A1.7 artifact
  [#9718313654](https://github.com/KlausUllrich/numberdroid/actions/runs/33264560427/artifacts/9718313654)
  has digest
  `18f7f41a98aecc31d78e74436e65689764ce23410f728a721af703f47e76a890`.
  Post-merge `main` Actions
  [#2224](https://github.com/KlausUllrich/numberdroid/actions/runs/33264894733)
  passed classification, Root, Studio Linux/browser, Studio Windows, Pages and
  CI gate. Its independently reverified artifact
  [#9718416600](https://github.com/KlausUllrich/numberdroid/actions/runs/33264894733/artifacts/9718416600)
  has digest
  `8df3dc8a9ce333c0e0f7f4b69d42587b49bc067796b64c5fccda4b5b98b893c8`.
  Both artifacts contain final 1440×900 screenshot
  `cd03a98645cdf71c9d32268482cd1fdc05e8bf8b101d8619dcf8da22c969e8c6`
  and 1060×900 screenshot
  `b3b838fd4a81332c64d3bd993f4c7eab93ae9b94edfd79a18890eb511647a269`.
  Diagnostic runs #2218–#2222 exposed and bounded, respectively, asynchronous
  task-selection capture, CSP evidence probes, compatible text/scroll restore,
  and Windows fixture-cleanup ordering before the clean #2223 source freeze.
- **Required platform/evidence:** desktop Chrome at exactly 1440×900 and
  1060×900. CI must retain and inspect the safe A1.7 evidence bundle containing
  both screenshots, bounded DOM/Accessibility observations, transport log,
  manifest and checksums. That artifact is automated evidence only and cannot
  replace Klaus's live judgment.
- **Known limits:** read-only selected-task presentation only. There is no new
  processing operation, task submission, owner review/decision, merge/revert,
  finalization, lifecycle promotion, Main/CP2C mutation, materialization,
  publication, release, mobile/device gate, or end-to-end `IMG-006` acceptance.
  Generic pre-existing task controls remain outside the A1.7 section and are
  deliberately not exercised here.
- **Open Klaus decision:** accept or revise the exact low-fidelity hierarchy,
  useful preview/fallback behavior, correction and unresolved-warning copy,
  technical disclosure depth, two protected responsive layouts and compatible
  refresh/context retention. Only Klaus can close this visual product gate.
- **Recovery:** stop Studio and retain the exact temporary directory until the
  result is recorded. Then discard only that uniquely allocated directory
  through normal temporary-file cleanup and clear
  `NUMBERDROID_STUDIO_DATA` in PowerShell. The candidate adds no migration or
  durable format; source rollback needs no SQLite/bundle downgrade, CAS or
  reference cleanup, task/Main repair, materialized-file cleanup, publication
  rollback, or release rollback.

## Required record for every new candidate

Append one section containing:

- ID and prerequisite IDs;
- PR, implementation head, merge SHA if any, and exact tested `main`;
- state from the vocabulary above;
- exact safe start/reset instructions and fixture identity;
- five to ten bounded user steps with expected visible/result state;
- required device, browser, viewport, or platform;
- Actions run/jobs/artifact links and relevant fingerprints;
- known limitations and what is deliberately not accepted;
- exact open Klaus decision;
- safe rollback/recovery path.

## Planned return-session order

1. VT-000 baseline/start/restart.
2. VT-001 CP4.5 desktop designer flow.
3. New A1 image-to-asset candidates in dependency order, followed by VT-002
   interface review where useful.
4. Agent/MCP scope, revoke, conflict, review, and **Waiting for your review**.
5. Backup UI and restore-as-copy only after an O1 UI candidate exists.
6. CP5 candidate review after its prerequisites.
7. Remote/Android tests only after all O2/O3 predecessor gates are explicitly
   satisfied; automated phone screenshots do not replace the real device gate.

Every backup/recovery test targets a new or copied workspace. No active user
workspace, prior backup, or source backup may be overwritten or cleaned up as a
test convenience.
