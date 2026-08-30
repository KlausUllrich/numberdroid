# Handoff — Numberdroid Studio O1 Backups UI live review

```text
DATE                         2026-08-30
REPOSITORY                   KlausUllrich/numberdroid
STATUS                       SESSION-TRANSITION HANDOFF
BASELINE MAIN HEAD           b40e3deb3af5ad501aadc43e1f980e35a2670962
BASELINE MAIN CI             Build #2244 / run 33283552159 — SUCCESS
PRIMARY RECEIVING ROLE       QA / Integrator / Coordinator
SECONDARY / TRIGGER ROLES    Studio Engineer + Security only if a concrete defect is found
NEXT MILESTONE / TASK        Klaus live review of VT-012 / O1b Backups UI
CURRENT PRODUCT STATE        implemented candidate — not user accepted
CURRENT STOP                 Waiting for your review
```

This handoff is a dated task snapshot. Current remote `main`, current Actions,
current binding documents, and actual code remain authoritative. If any newer
source conflicts with this file, report the conflict and follow the newer
authority.

## Executive state

- O0 froze the backup/recovery contract and external operations-ledger decision.
- O1a is integrated on `main` through PR
  [#175](https://github.com/KlausUllrich/numberdroid/pull/175), merge commit
  `b40e3deb3af5ad501aadc43e1f980e35a2670962`.
- O1b is the open PR
  [#176](https://github.com/KlausUllrich/numberdroid/pull/176), branch
  `feat/o1b-backups-ui-candidate`.
- The O1b implementation source commit is
  `67464d7906109e8d16d607686b38ba7a99a373bf`, tree
  `75a661d7b0e67a6e868735e36cb181142e1838dd`.
- The final product/evidence head before this documentation handoff is
  `a11362329c5d0cd659fb2e73bcc518c8e9b6009e`, tree
  `83088f6ba5727c9a23db5734891ecfac9585152c`.
- PR CI Build #2248, run
  [33287719553](https://github.com/KlausUllrich/numberdroid/actions/runs/33287719553),
  completed successfully at that head.
- O1b is intentionally not merged. Automated evidence cannot accept the human
  workflow. The next gate belongs to Klaus.

## Mandatory reading order

### 1. Universal bootstrap — read completely

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`

Then verify current remote `main`, open PRs, PR #176 head/state, and relevant
Actions before changing anything.

### 2. Primary QA / Integrator bundle

Read completely, in this order:

1. `tools/numberdroid-studio/README.md`
2. `tools/numberdroid-studio/docs/O0_BACKUP_RECOVERY_CONTRACT.md`
3. `tools/numberdroid-studio/docs/O1A_BACKUP_CORE_STATUS.md`
4. `tools/numberdroid-studio/docs/O1B_BACKUPS_UI_STATUS.md`
5. `tools/numberdroid-studio/docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`
6. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`, especially
   `VT-012`
7. the actual O1b source and tests listed below
8. this handoff last, as the task snapshot

Use the O1/Backups sections of `tools/numberdroid-studio/docs/REQUIREMENTS.md`,
`ARCHITECTURE.md`, and `ROADMAP.md` when checking an implementation claim or a
reported defect. Read the whole affected current authority before changing its
contract.

### 3. Context not mandatory initially

Do not initially load the Numberdroid story, gameplay, art-production, Level
Compiler, or historical A1 handoffs. They are unrelated to the bounded O1 live
review. Activate an additional role route only if an actual defect crosses that
domain.

## Current authority and acceptance states

### Accepted / frozen

- The O0 architecture, threat model, exact four-operation scope, external
  operations ledger, quarantine boundary, safe-path rules, no-overwrite rule,
  loopback-only separation, and first-UI state contract are frozen.
- O1 supports only `CREATE`, `VERIFY`, `RECOVERY_TEST`, and
  `RESTORE_AS_COPY`.
- Restore-as-copy creates a verified quarantined copy. It never activates,
  replaces, or merges into the active workspace.
- Deletion, retention/cleanup, activation/cutover, arbitrary paths, remote
  invocation, proxy trust, MCP/agent authority, materialization, publication,
  and release are excluded.
- PR [#134](https://github.com/KlausUllrich/numberdroid/pull/134) was closed on
  2026-08-30 as **superseded, not rejected**, without merge. Its Family Hygiene
  source remains preserved on `main`; its obsolete direct runtime branch must
  not be rebased, cherry-picked, or revived.

### Implemented but not user accepted

- O1a backend on `main` is an implemented candidate, not a user-accepted
  product gate.
- O1b HTTP/session/UI/evidence in PR #176 is an implemented candidate, not
  user accepted.
- `VT-012` is `NEEDS KLAUS LIVE`.
- CI green, source integration, browser evidence, and user acceptance remain
  distinct states.

### Planned / not implemented or authorized

- O2 always-on authenticated private remote service.
- O3 phone/touch completion and real Android acceptance.
- O4 MCP onboarding/playbooks.
- Backup deletion/retention and restored-copy activation/cutover.

None may begin before Klaus completes and accepts the O1 live gate.

## Open decisions and owners

Klaus owns acceptance or revision of:

- the safety-summary hierarchy and prominence of **Create backup now**;
- the one-use terminal unlock-code experience;
- queued/running/result copy and confidence in durability;
- backup list/detail organization and technical disclosure depth;
- Verify, recovery-test, restore-as-copy, failure, missing, and damaged-state
  remediation;
- the 1440×900 and 1060×900 layouts, keyboard focus, and passive-refresh
  context retention; and
- the explicit truth that a restored copy is ready for inspection but is not
  active.

QA may report a concrete mismatch. It does not own a hidden redesign or a new
authority decision.

## Technical implementation map

Primary human/server paths:

- `tools/numberdroid-studio/apps/studio-server/src/workspace-operator-session.js`
- `tools/numberdroid-studio/apps/studio-server/src/backup-operations-controller.js`
- `tools/numberdroid-studio/apps/studio-server/src/server.js`
- `tools/numberdroid-studio/apps/studio-server/public/o1b-backups-state.js`
- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/index.html`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`

Backend seams consumed by O1b:

- `tools/numberdroid-studio/packages/application/src/backup-operation-service.js`
- `tools/numberdroid-studio/packages/persistence/src/operations/backup-operations-runtime.js`
- `tools/numberdroid-studio/packages/persistence/src/operations/operations-ledger.js`
- `tools/numberdroid-studio/packages/persistence/src/operations/operations-store-adapter.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-workspace.js`

Acceptance/evidence paths:

- `tools/numberdroid-studio/scripts/prepare-o1b-backups-return-fixture.js`
- `tools/numberdroid-studio/scripts/capture-o1b-backups-browser-evidence.js`
- `tools/numberdroid-studio/tests/o1b-workspace-operator-session.node-test.js`
- `tools/numberdroid-studio/tests/o1b-backup-controller.node-test.js`
- `tools/numberdroid-studio/tests/o1b-backup-http.node-test.js`
- `tools/numberdroid-studio/tests/o1b-backups-ui.node-test.js`
- `tools/numberdroid-studio/tests/o1b-return-fixture.node-test.js`

Important constants:

- UI: `http://127.0.0.1:4317/#backups`
- bootstrap secret: 192 bits, displayed once, ten-minute TTL, five failures
- operator session: 256-bit token, 15-minute idle TTL, eight-hour absolute TTL
- cookie: host-only, nonpersistent, `HttpOnly`, `SameSite=Strict`, path
  `/api/backups`
- visible backup window: at most 100 records
- protected browser widths: 1440×900 and 1060×900

## Verified automated evidence

Local source-freeze evidence recorded by the candidate:

- focused O1b: 19/19 passed;
- operations ledger: 4/4 passed;
- focused O1a/runtime/reconciliation/HTTP/gateway/package: 36/36 passed;
- full Studio: 610 total, 606 passed, zero failed, four expected Windows-only
  skips;
- JavaScript syntax: 187 files;
- Markdown: 103 links across 202 files, zero failures;
- two independent actual-diff reviews: GO.

Selected GitHub evidence at `a11362329c5d0cd659fb2e73bcc518c8e9b6009e`:

- Build #2248 / run
  [33287719553](https://github.com/KlausUllrich/numberdroid/actions/runs/33287719553):
  success;
- `build`, `studio`, `studio-windows`, and `CI gate`: success;
- Pages: correctly skipped;
- artifact `numberdroid-studio-o1b-backups-evidence`, ID `9725029756`;
- size: 6,869,776 bytes;
- digest:
  `sha256:bf16de952ef38301e81fdb99cdc02646efcbea1209df1a01bf976908d46aa40e`;
- expiry: 2026-09-13T02:25:52Z.

This evidence proves the selected automated gate only. It does not replace
Klaus's live judgment.

## Exact next action

### If Klaus is not ready to test

Stop. Keep PR #176 open and unmerged at **Waiting for your review**. Do not
start O2, O3, O4, deletion/retention, activation, remote access, or unrelated
cleanup.

### If Klaus is ready to test

Use the exact safe `VT-012` workflow. Never use `.numberdroid-studio`, an
active workspace, the repository checkout, a real backup root, or a previous
test directory.

Linux/macOS from `tools/numberdroid-studio/`:

```bash
O1B_RETURN_ROOT="$(mktemp -d)"
node scripts/prepare-o1b-backups-return-fixture.js "$O1B_RETURN_ROOT"
NUMBERDROID_STUDIO_DATA="$O1B_RETURN_ROOT/live-workspace" \
NUMBERDROID_STUDIO_OPERATIONS_CONFIG="$O1B_RETURN_ROOT/operations.json" \
npm run dev
```

Windows PowerShell:

```powershell
$studioO1bReturn = Join-Path ([System.IO.Path]::GetTempPath()) ("numberdroid-o1b-return-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $studioO1bReturn
node scripts/prepare-o1b-backups-return-fixture.js $studioO1bReturn
$env:NUMBERDROID_STUDIO_DATA = Join-Path $studioO1bReturn 'live-workspace'
$env:NUMBERDROID_STUDIO_OPERATIONS_CONFIG = Join-Path $studioO1bReturn 'operations.json'
npm run dev
```

Then guide Klaus through `VT-012` without skipping its safety steps:

1. locked view and one-use terminal code;
2. create backup and observe queued/running/verified truth;
3. verify again;
4. test recovery;
5. restore as a new copy and confirm it is not active;
6. restart and confirm session invalidation plus durable records;
7. create the exact disposable missing/damaged case described by `VT-012`;
8. inspect 1440×900 and 1060×900, focus and context retention;
9. record explicit accept or revise.

Do not improvise a destructive failure case. Restore the deliberately renamed
test backup to its exact original name before cleaning only the unique fixture
root.

### If a defect is found

- record the exact state, action, expected contract, observed result, platform,
  PR head, and reproducible fixture step;
- classify the repair as L3 when it changes UI, HTTP, authority, persistence,
  filesystem, recovery, or browser evidence;
- change only the bounded defect on the O1b branch;
- rerun the smallest falsifying test, then the triggered complete gates and one
  independent actual-diff review;
- never weaken the O0 safety boundary to make a test pass.

### If Klaus accepts

Acceptance and merge remain separate. Record the explicit acceptance in
`O1B_BACKUPS_UI_STATUS.md`, `VACATION_TEST_BACKLOG.md`, and the current forward
plan. Merge PR #176 only with explicit merge authority and green checks on the
unchanged accepted head. Then verify the new `main` and its post-merge CI before
planning O2.

## Local-checkout warning from the handing-off session

The scratch checkout inherited a stale dirty O1a worktree on local head
`1833e6e3e96231c8e091edebb193a759ee681bb4`. That work was superseded by the
later, reviewed O1a PR #175 already merged on remote `main`. Do not commit,
publish, reset, or delete that local worktree blindly. Start from verified
remote `main` or a clean PR #176 checkout. If the same scratch checkout must be
reused, first compare every dirty path against remote #175 and preserve any
unknown user change.

## Reusable process lessons

- A silent turn can stop even when repository heartbeat rules exist. Preserve
  run/session IDs and resume from remote truth, not from an assumed local
  process.
- Never reapply a large patch merely because the prior turn stopped. First
  determine whether a later PR already integrated or superseded it.
- `CI green`, `merged`, and `user accepted` are different states.
- Long operations use explicit timeouts, resumable handles, at most one
  external poll between updates, and the repository's 120-second user-visible
  heartbeat ceiling.
- The launcher unlock secret must never enter screenshots, network evidence,
  logs, DOM state, or handoff artifacts.

## Definition of done for the receiving session

The next session is complete when one of these truthful outcomes is recorded:

1. Klaus accepts O1b and separately authorizes integration;
2. Klaus reports a bounded defect and the candidate is revised with triggered
   evidence; or
3. Klaus is unavailable, so PR #176 remains unchanged at **Waiting for your
   review** and no blocked downstream work is started.

## Required receiver launch protocol

1. Verify current remote `main`, PR #176, open PRs, and Actions.
2. Read the universal bootstrap completely.
3. Read the QA/Integrator task bundle and actual O1 source/tests listed above.
4. Read this handoff as the dated task snapshot.
5. Summarize current authority, acceptance state, and any conflict found.
6. Inspect the exact current PR diff and evidence before proposing a change.
7. Do not merge, redesign, delete data, activate a restored copy, or begin O2
   without the corresponding explicit user gate.
