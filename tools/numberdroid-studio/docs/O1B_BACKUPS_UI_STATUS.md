# O1b first Backups UI candidate status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

O1b composes the bounded human acceptance surface frozen by
[`O0_BACKUP_RECOVERY_CONTRACT.md`](O0_BACKUP_RECOVERY_CONTRACT.md) on top of the
integrated O1a backend recorded in
[`O1A_BACKUP_CORE_STATUS.md`](O1A_BACKUP_CORE_STATUS.md). The implementation is
based on source-integrated `main`
`b40e3deb3af5ad501aadc43e1f980e35a2670962` and supports exactly `CREATE`,
`VERIFY`, `RECOVERY_TEST`, and `RESTORE_AS_COPY`.
The implementation source freeze is PR
[#176](https://github.com/KlausUllrich/numberdroid/pull/176) at head
`67464d7906109e8d16d607686b38ba7a99a373bf`, tree
`75a661d7b0e67a6e868735e36cb181142e1838dd`. The final product/evidence head
before the session-transition handoff is
`a11362329c5d0cd659fb2e73bcc518c8e9b6009e`, tree
`83088f6ba5727c9a23db5734891ecfac9585152c`; its third commit changes only
the bounded Windows test completion window after the implementation and
documentation-record commits.

This is the first visual candidate Klaus can later use for acceptance. It is
not accepted now. It adds no deletion, cleanup/retention, activation/cutover,
remote function, proxy trust, MCP/agent authority, owner review, merge,
materialization, publication, or release authority.

## Implemented boundary

- One additive Application query port and external-ledger adapter expose at
  most 100 durable operations through the existing safe operation projection.
  The bounded window always retains the running and actually oldest queued
  operation even beyond the recent cutoff. The exact O1a command and worker
  ports remain unchanged.
- SQLite startup performs the restored-copy quarantine preflight and validates
  the administrator-owned operations configuration before opening the live
  writer. It then composes the external control ledger, reconciliation,
  serialized worker pump, and human controller before listening. JSON mode
  reads no operations configuration, opens no ledger or worker, emits no
  launcher secret, and registers no backup route.
- A fresh 192-bit bootstrap is emitted exactly once to the controlling terminal
  (`/dev/tty` or `CONOUT$`). Only its SHA-256 digest is retained in memory. With
  no controlling terminal and no trusted test injector, backup controls remain
  unavailable and ordinary Studio work can stay open.
- Bootstrap exchange is one-use, expires after ten minutes, and permits at most
  five failures. The resulting 256-bit operator token is retained only as an
  in-memory digest, expires after 15 idle minutes or eight absolute hours, and
  is invalid after restart. Its host-only, nonpersistent cookie is
  `HttpOnly`, `SameSite=Strict`, and scoped to `/api/backups`.
- Every backup read requires the direct loopback socket, a loopback Host, and
  the operator session. Every mutation additionally requires the existing
  exact same-origin and CSRF checks. Proxy-supplied address/identity headers are
  not trusted.
- The human HTTP surface is limited to bootstrap exchange, one allowlisted
  overview, one safe operation detail, and submission of the four exact O1
  request shapes. Responses contain only opaque IDs, safe destination labels,
  kind/state/progress, manifest identity, counts/bytes, health/timestamps, and
  allowlisted failure code/message. Roots, paths, tokens, fingerprints, actor
  authority, leases, raw errors, stacks, and `databaseSha256` are omitted.
- A wake-latched single worker drain starts only after durable acceptance.
  Navigation, reload, or an aborted HTTP response does not cancel accepted
  work, and a request arriving at a drain boundary cannot be stranded.
- The existing shell gains only additive destination **08 Backups**. Its order
  is safety summary → **Create backup now** and destination → current durable
  operation → backup list → one selected detail/action view → closed technical
  disclosure.
- Visible copy distinguishes unavailable, locked, empty, queued, running,
  verified, recovery-passed, restored-copy-not-active, failed, interrupted,
  unverified, suspect, and missing states. A damaged backup keeps **Verify
  again** available while disabling recovery and restore. There is no path
  picker, delete, activate/switch, remote, or MCP control.
- Passive refresh preserves a compatible selected backup, focused control,
  list scroll, and open technical disclosure. The launcher code is cleared
  immediately after request serialization, never enters application state,
  and is deliberately excluded from browser network evidence.
- Every visible view and O1 status projection says **implemented candidate —
  not user accepted**.

## Verification state

Local source-freeze evidence on 2026-08-30:

- focused O1b session, controller, HTTP/real-SQLite, and UI contract suite:
  **19 passed, 0 failed**;
- external operations-ledger suite, including the bounded current-operation
  window with 102 durable requests: **4 passed, 0 failed**;
- focused legacy HTTP/gateway/package and O1a runtime/reconciliation suite:
  **36 passed, 0 failed**;
- full Studio suite: **610 total, 606 passed, 0 failed, 4 expected
  Windows-only skips**;
- JavaScript syntax check: **187 files passed**; syntax-checker self-test,
  classifier self-test, and Markdown checker/self-test pass. Markdown checks
  cover 103 links across 202 files with zero failures;
- two independent actual-diff reviews are **GO** with no open findings.

The real-SQLite HTTP test creates one backup, verifies it, completes an isolated
recovery test, restores one quarantined inactive copy, restarts Studio, and
reads the same four operations and backup from the external ledger. It also
proves that the returned JSON contains no configured root.

The repository's bounded Chrome evidence script covers every frozen visible
operation and health state at exactly 1440×900 and 1060×900, checks the
Accessibility tree and damaged-action gates, proves compatible
selection/focus/disclosure retention, verifies restored-copy non-activation,
and scans its bounded observation artifact for token/path fields. No suitable
Chrome executable is installed in the local workspace, so local browser
execution is deliberately **not claimed**.

The selected L3 gate is green at final product/evidence head
`a11362329c5d0cd659fb2e73bcc518c8e9b6009e`: Build #2248, run
[33287719553](https://github.com/KlausUllrich/numberdroid/actions/runs/33287719553).
The `build`, `studio`, `studio-windows`, and `CI gate` jobs succeeded;
Pages was correctly skipped. Artifact
`numberdroid-studio-o1b-backups-evidence`, ID `9725029756`, is 6,869,776
bytes with digest
`sha256:bf16de952ef38301e81fdb99cdc02646efcbea1209df1a01bf976908d46aa40e`
and expiry `2026-09-13T02:25:52Z`. This is automated evidence only and does
not replace Klaus's live judgment.

## Open gate

After source review and selected CI are green, stop at **Waiting for your
review**. Klaus must later use an administratively configured safe destination
to judge the hierarchy and copy and to walk through Create, Verify,
Recovery-test, Restore-as-copy, restart, and a deliberate failure/damaged case.
Only that live review can accept O1. O2 remote access, O3 phone completion, and
all owner/activation/publication work remain blocked.
