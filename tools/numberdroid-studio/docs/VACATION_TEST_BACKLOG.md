# Numberdroid Studio — Consolidated Return Test Backlog

Status: **current live backlog for candidate work created while Klaus cannot test**

Baseline recorded: 2026-08-28 at pre-documentation `main`
`0592d90f7bcfd23c3c01df490ef92cb2ed212a37`. Receivers MUST replace this with
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

- **Implementation:** focused A1.3 candidate based on tested `main`
  `dcf85b36f7b68d9b88d314cdccb49287dc70bdc8`; PR, implementation head, merge
  SHA if any, and Actions run are appended after those facts exist. Exact
  contract and fixture hashes are in `A1_3_STATUS.md`.
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
- **Known limits:** port contracts and fakes only; no production Asset/CAS
  adapter, Numberdroid profile v2, persistence, mutation, command, job, MCP,
  HTTP, UI, review/lifecycle, race guarantee, or `IMG-006` completion.
- **Open Klaus decision:** accept or revise the A1.3 request/evidence/receipt
  boundary and the deliberate current-profile fail-closed policy. Automation
  cannot answer this product-contract decision.
- **Recovery:** because A1.3 writes no workspace or schema state, source rollback
  is a normal revert of its focused source commit/PR. No data restoration,
  migration rollback, CAS cleanup, or fixture deletion is required.

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
