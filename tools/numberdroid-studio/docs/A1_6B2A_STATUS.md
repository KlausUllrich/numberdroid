# A1.6b2a private Authoring-v2 execution-session status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.6b2a is a non-visual L3 Application/Persistence/Authority compatibility
candidate based on verified `main` head
`cab9aa7c0d8f4037ead6f44d6127446c53598d45`. It composes the existing A1.6a
read ports and A1.6b1 host-bound A1.5 store behind one private, one-shot
Authoring-v2 execution session. The SQLite production server constructs the
runtime with the exact Numberdroid profile v2 and stores only that runtime in a
module-private `WeakMap`; its provider/store remain closure-bound, while reader,
ports, and sessions are created transiently per operation. No route, launcher
selector, MCP tool/resource, UI, or returned server field exposes them. Source
integration and automated tests do not constitute Klaus's contract acceptance.

## Implemented scope

- `AuthoringV2AdmissionService` accepts only exact schema-v2 feature
  coordinates and two separately typed, read-only ports. It reads current
  HostBinding/Grant/Task/branch/ledger truth, reads the server-pinned
  capability profile, then repeats admission and requires identical current
  evidence. The capability result is accepted only when its canonical
  fingerprint equals the pinned Numberdroid v2 fingerprint
  `5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106`.
  Before that fingerprint pin is stored, the reusable Domain validator also
  requires profile version 2 and the exact processing-adoption operation,
  module, and format contract; a pinned legacy profile v1 therefore fails at
  construction rather than advertising the v2 command.
- `SqliteAuthoringV2AdmissionReader` is bound to an exact active HostBinding
  projection produced by strict server resolution. It closes the same
  project/agent/task/grant/non-main-branch coordinates against current SQLite
  rows, the immutable task-branch ledger, current head, private scope, project
  object scope, task/grant usage, expiry, and the no-auto-accept rule. A
  target-bound dry-run additionally requires the exact Asset scope;
  capabilities are intentionally project-wide redacted discovery with no
  target Asset and create no executable authority or public admission evidence.
- `AuthoringV2ExecutionSession` is consumed synchronously before validation or
  asynchronous work. A second or parallel operation fails with
  `AUTHORING_V2_SESSION_CONSUMED`; failure or cancellation does not make the
  session reusable. A retry always requires a freshly strict-resolved
  HostBinding and a new session.
- The capabilities request is pinned to schema v2, feature
  `studio.authoring-v2`, and the bound project. It returns only the frozen
  profile/feature projection; Binding and Grant identities remain private.
- The adoption request contains exactly schema v2, feature ID, tool name
  `studio_processing_result_adopt`, required Boolean `dryRun`, and the complete
  unchanged A1.4 schema-v1 command. It cannot carry actor, task, grant,
  Binding, context, profile, port, receipt, plan, owner decision, review,
  lifecycle, merge, or release input.
- `dryRun: true` performs full fresh admission, runs the real A1.4 planner over
  A1.6a SQLite/CAS ports, then repeats full admission before returning. It
  writes no revision, Asset, Aggregate, replay row, Activity, retention
  reference, usage charge, or CAS object.
- `dryRun: false` deliberately does **not** run full admission or A1.4 before
  commit. After strict envelope/command/signal validation it calls a freshly
  bound A1.6b1/A1.5 store directly. That store checks current Binding/Grant
  before ledger-first replay and again inside `BEGIN IMMEDIATE` before
  concurrent replay or writes.
- The host-bound store now has the distinct port kind
  `studio.processing-result-adoption-host-bound-atomic-store`. The original
  unbound A1.5 port remains
  `studio.processing-result-adoption-atomic-store`; the one-shot session
  accepts only the host-bound kind.
- The production server uses one injected clock for HostBinding resolution,
  admission, profile selection, A1.4 planning, A1.5 commit, and session
  composition. Its private lifecycle implementation closes the runtime and
  drains active operations before closing the SQLite writer. A behavioral
  active-operation shutdown probe remains deferred until A1.6b2b provides a
  callable transport seam; A1.6b2a verifies idle startup/shutdown and reviews
  the drain ordering in source.

## Ledger-first replay is a compatibility requirement

Full admission is mandatory for capability reads and dry-run, but must not run
before commit replay. After a successful one-command task has charged
`maxCommands: 1`, a lost response must still be recoverable with a new session:

- same key and same semantics returns the original result;
- an unused new command ID with the same key and semantics aliases the original
  result;
- same key with changed semantics remains `IDEMPOTENCY_CONFLICT`;
- reused command ID with another key remains `COMMAND_ID_CONFLICT`;
- a genuinely new command remains blocked by current revision/budget policy;
- no replay performs a second profile/CAS read, write, retention, or charge.

Current HostBinding/Grant admission remains intentionally earlier than replay.
A revoked or expired host session cannot recover or disclose an earlier result.

## Preserved compatibility and authority boundaries

- Legacy command definitions/scopes remain exactly **33/30**. The private
  feature remains one separately typed overlay and the v2 scope vocabulary
  remains 31.
- Numberdroid profile v1 remains byte-identical at
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`.
  Existing `StudioService` and `AgentTaskService` production composition keeps
  profile v1; only the hidden runtime receives profile v2.
- Public MCP discovery remains exactly **19 tools/four templates** without a
  task and **30 tools/five templates** for a matching legacy task. There is no
  `studio_processing_result_adopt` tool or capabilities resource yet.
- No environment/client claim can select profile v2, create authority, or
  obtain a session. There is no HTTP/internal-HTTP route, gateway mapper,
  launcher field, browser state, UI control, background worker, migration, or
  startup semantic write.
- Schema remains v13, portable bundles remain v1-v3, and A1.5 remains the only
  mutation unit. Main/CP2C Assets, owner review/decision, auto-accept,
  apply/finalize, merge/revert, lifecycle promotion, materialization,
  repository writes, publication, and release remain outside this block.

## Verification

Frozen local candidate verification on 2026-08-28:

- focused A1.3-A1.6, HostBinding, HTTP/MCP, audit, package-boundary, SQLite/CAS,
  replay, fault, and compatibility suite: **183 passed, 0 failed**;
- conservative expanded risk suite including the deep SQLite/fault matrices:
  **310 passed, 0 failed**;
- full Studio suite under Node 24.19.0: **492 passed, 0 failed**;
- `npm run check`: **145 JavaScript files passed**;
- production-adapter evidence: `VERIFIED`, with protected source-manifest hash
  unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- repository Markdown links: **64 checked, 0 failures**; link-checker,
  classifier, and Studio syntax-checker self-tests plus `git diff --check`
  passed.

The 11 additive tests cover exact/adversarial ports and one-shot use, rejection
of pinned legacy profile v1, native Promise versus hostile thenable/proxy
handling, strict native `AbortSignal`, positive full admission, revocation
during profile read, write-free real dry-run, distinct host-bound commit,
`maxCommands: 1` replay/alias/conflicts, injected post-commit lost-response
reopen recovery without another profile/CAS read, hidden production
composition, startup write-freedom, and unchanged legacy discovery.

The exact 22-path local classifier result is `docs=true`, `docs_only=false`,
`root=false`, `root_visual=false`, `studio=true`, `studio_visual=true`,
`studio_windows=true`, `pages=false`, and `full=false`; the L3 PR nevertheless
uses `[ci-full]`. Five independent final actual-diff reviews covering
Security/Authority, Compatibility/MCP, Domain/Application,
Persistence/Recovery, and QA/Docs are **GO** with no open findings.

The implementation source commit is
`6de42142fc0fa72cb1d662dd2da8d1c313ec8c5e`. PR
[#160](https://github.com/KlausUllrich/numberdroid/pull/160) was
source-integrated into `main` as squash commit
`89d6d4397057d5801aa7ba04e0b1cf6138df55eb`. PR Actions run
[#2198 / 33202315502](https://github.com/KlausUllrich/numberdroid/actions/runs/33202315502)
passed the classifier, forced Root build, Linux Studio including browser
evidence, Windows Studio, and CI gate; Pages was correctly skipped in the PR
context. Post-merge `main` Actions run
[#2199 / 33202908594](https://github.com/KlausUllrich/numberdroid/actions/runs/33202908594)
passed the classifier, Linux Studio including browser evidence, Windows
Studio, and CI gate while Root build and Pages were correctly skipped by the
actual 22-path classification. Conservative PR Root/browser/Windows coverage
is regression evidence, not a new UI, visual-acceptance, or product-contract
claim. Source integration and CI leave this candidate **NOT USER ACCEPTED**.

## Subsequent block pointer

A1.6b2b now implements the separately selected private transport/exposure
candidate described in `A1_6B2B_STATUS.md`. It preserves this block's repeated
full admission for capabilities/dry-run and ledger-first commit exception,
while adding the positive-handshake-gated static 31/6 MCP surface. A1.6b2b is
also **NOT USER ACCEPTED**; A1.7 is the next bounded development block after
its integration gates close.

## Recovery

A1.6b2a adds no migration or durable state. Source rollback is a focused revert
of the application/session, distinct port kind, SQLite reader, and hidden
server composition. Existing Binding, Grant, task, adoption, audit, CAS,
schema-v13, and bundle data require no downgrade, backup restore, cleanup, or
repair. A future transport must continue to honor the single-writer and
exclusive-maintenance boundary.
