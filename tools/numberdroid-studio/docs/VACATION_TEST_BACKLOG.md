# Numberdroid Studio — Consolidated Return Test Backlog

Status: **current live backlog for candidate work created while Klaus cannot test**

Baseline recorded: 2026-08-28 at A1.5-closure `main`
`5816c88e14b74e521d742c3966b5186b7651f661`. Receivers MUST replace this with
newer verified `main` truth as work lands.

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

Future A1, O0/O1, MCP, UI, backup, remote, and mobile blocks MUST append their
own ID only after implementation exists. Planned work is not a candidate.

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
  effect-free SQLite/CAS planning reads, and the A1.6b exact 31-tool/six-template
  handshake target. Automation cannot answer this product-contract decision.
- **Recovery:** A1.6a adds no migration and its dry-run writes no workspace/CAS
  state. Revert the focused source candidate; no database downgrade, backup
  restore, CAS cleanup, task repair, or fixture deletion is required.

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
