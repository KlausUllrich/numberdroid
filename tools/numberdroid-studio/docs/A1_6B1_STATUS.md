# A1.6b1 host-bound adoption admission status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.6b1 is a non-visual L3 Authority/Persistence compatibility candidate based
on verified `main` head `5a699b75597eac219580bddf2d3d8609c63ec2b0`.
It closes the revocation window that had to be removed before A1.5 could ever
be exposed through Authoring v2: current HostBinding resolution now joins and
validates the current Grant, and a separately composed host-bound A1.5 port
revalidates both before replay and again inside the mutation transaction. It
does **not** add the Authoring-v2 handshake, select profile v2, register the
private feature, or change MCP/HTTP/UI discovery. Automated tests, source
integration, and CI do not constitute Klaus's contract acceptance.

## Implemented scope

- Current HostBinding reads join the authoritative Grant row. Strict
  `resolve()` rejects a missing, legacy-unbound, revoked, expired, inactive, or
  coordinate-drifted Grant as well as a revoked or expired HostBinding. Status
  considers both Grant `authorization_status` and `status`, not only the
  immutable HostBinding row.
- The accepted generic and specialized audited MCP routes remain intact. Their narrowly
  named `resolveAttemptSubject()` returns only an explicitly
  `NOT_GRANTED` audit subject after the HostBinding itself and the immutable
  Binding↔Grant coordinates close. Each route then calls strict `resolve()`
  inside its existing audited failure boundary before application dispatch;
  only that live result supplies actor/task/grant/branch execution identity.
  Audit attribution and live dispatch share one request correlation without
  treating the audit subject as authority.
  Unknown, expired, or revoked HostBindings never become audit subjects; a
  Binding or current-Grant denial after attribution remains redacted and
  durably `DENIED`. Asset/room denials retain the accepted schema-v8
  project-target audit shape; job targets remain exact.
- `SqliteProcessingResultAdoptionStore.asHostBoundAtomicStore(binding)` accepts
  only the exact active schema-v1 projection produced by strict resolution. It
  captures only own enumerable data fields, rejects proxies, accessors,
  symbols, missing/extra fields, forged status, and mismatched command context,
  and invokes no hostile trap or getter.
- A host-bound invocation checks the current Binding and Grant before the
  ledger-first replay lookup. Revocation therefore prevents both a first
  mutation and disclosure of an already committed replay through a no-longer
  authorized host session. No capability or CAS dependency is consulted for a
  denied replay.
- After asynchronous capability and held-CAS checks, the same captured
  Binding↔project/actor/task/grant/branch coordinates and current Binding/Grant
  liveness are checked again under the existing `BEGIN IMMEDIATE` transaction,
  before concurrent replay and before any write. The transaction clock is read
  inside that unit of work for the host-bound path.
- Revocation during capability or CAS work, or Binding/Grant expiry crossed
  between initial admission and the transaction clock, therefore produces no
  adoption effect. If another writer has already committed the same replay
  while the host is revoked, host admission wins before the concurrent replay lookup.
  Revocation after the synchronous transaction has acquired and used its
  current truth linearizes after that commit.
- Stable HostBinding/Grant denial codes pass through the existing application
  sanitization allowlist without paths, tokens, Grant IDs, Binding IDs, SQL,
  causes, or stack data.

## Preserved compatibility and authority boundaries

- The original `asAtomicStore()` and its private A1.5 ledger-first replay
  semantics remain unchanged. Only the new explicitly host-bound closure adds
  current session admission before replay.
- The accepted generic execution and specialized read/mutation audit behavior is unchanged:
  authorized polling is suppressed, denied/failed attempts remain redacted and
  durable, and atomic job mutations retain their existing audit transaction.
- There is no migration, schema-version change, new durable row, background
  job, capability-profile change, command/scope catalog change, or CAS write.
  Schema remains v13 and portable bundles remain v1-v3.
- Numberdroid profile v1 and v2 fingerprints, the legacy 33/30 catalogs, one
  separately typed v2 feature, and the existing 19/4 and matching-task 30/5
  MCP discovery surfaces remain unchanged.
- No server currently composes the host-bound adoption port. There is no
  Authoring-v2 environment selector, handshake, capability resource, adoption
  tool, public route, UI, owner decision, review/apply/finalize, merge,
  lifecycle, materialization, publication, or release authority.

## Explicitly deferred to A1.6b2

A1.6b2 may compose this port only from a freshly strict-resolved HostBinding
and must still positively validate the exact v2 Task/Grant/non-main branch,
scope/object/budget/ledger, Numberdroid profile, planning ports, and atomic
store before building the static Authoring-v2 MCP surface. The only additive
surface remains one required-`dryRun` adoption tool plus one capabilities
resource, yielding exactly 31 tools/six templates. Every invocation must repeat
the gate; discovery is never executable authority. Explicitly requested v2
must fail closed rather than deriving readiness from an environment/client
claim or silently creating authority.

## Verification

Frozen local candidate verification on 2026-08-28:

- focused HostBinding, A1.3-A1.6, HTTP/MCP, audit, package-boundary, SQLite/CAS,
  replay, fault, and compatibility suite: **172 passed, 0 failed**;
- full Studio suite under Node 24.19.0: **481 passed, 0 failed**;
- `npm run check`: **141 JavaScript files passed**;
- production-adapter evidence verification: `VERIFIED`, with protected source
  manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.

Repository Markdown links (**60 checked, 0 failures**), `git diff --check`, and
the link, classifier, and Studio syntax-checker self-tests pass. The exact
change classifier selects `docs`, `studio`, `studio_visual`, and
`studio_windows`; it leaves `docs_only`, `root`, `root_visual`, `pages`, and
`full` false. Five independent final actual-diff reviews covering
Security/Authority, Compatibility, Domain/Application, QA/CI, and
CAS/Atomicity/Recovery are **GO**.

The implementation source commit is
`df75727211c1ea7767916fb2e2c2192f450031b6`. PR
[#158](https://github.com/KlausUllrich/numberdroid/pull/158) was
source-integrated into `main` as squash commit
`06ceaf58e2f7ebdad1fec17a1cf6178655c32e9a`. PR Actions run
[#2194 / 33172043996](https://github.com/KlausUllrich/numberdroid/actions/runs/33172043996)
passed the change classifier, Linux Studio including browser evidence,
Windows Studio, and CI gate; the root build and Pages were correctly skipped.
Post-merge `main` Actions run
[#2195 / 33172499006](https://github.com/KlausUllrich/numberdroid/actions/runs/33172499006)
passed the same selected jobs and again skipped root build and Pages.
Conservative browser/Windows selection is regression coverage for the
server/persistence paths, not a new UI or visual-acceptance claim. Source
integration and CI do not change the candidate-only acceptance state.

## Recovery

A1.6b1 adds no migration or durable data. Source rollback is a focused revert
of this candidate. Existing HostBinding, Grant, task, adoption, audit, and CAS
rows require no downgrade, backup restore, cleanup, or repair. A future live
A1.6b2 composition remains subject to the documented single-writer and
exclusive-maintenance boundary.
