# O1a backup core candidate status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

O1a implements the bounded, non-visual backup backend frozen by
[`O0_BACKUP_RECOVERY_CONTRACT.md`](O0_BACKUP_RECOVERY_CONTRACT.md). It supports
exactly `CREATE`, `VERIFY`, `RECOVERY_TEST`, and `RESTORE_AS_COPY` through an
in-process human-only service and one serialized effect worker. It adds no
HTTP route, launcher bootstrap, UI, MCP surface, remote function, deletion,
retention policy, activation/cutover, materialization, publication, or release
authority.

This backend is not the O1 product gate. A separately classified O1b
**Backups** UI is required for Klaus's review and acceptance. Until that live
review, every result remains **implemented candidate — not user accepted**.

## Implemented boundary

- Domain/Application define four exact request shapes, semantic idempotency
  fingerprints, fixed monotonic phases, sanitized failures, the dedicated
  `workspace.backup.manage` human capability, closed command/worker ports, and
  one serialized phase worker.
- The external control root owns independent schema-v1 `operations.sqlite`
  state plus a persistent rollback-journal `operations.lock`. Neither is part
  of `studio.sqlite`, a backup, a restored copy, or the workspace migration
  sequence; the workspace remains schema v13.
- The ledger durably reserves immutable request/output coordinates, append-only
  phase events, leases and fencing generations, stage disposition, backup
  provenance/health, and quarantined restored-copy evidence. Public projections
  omit roots, paths, fingerprints, subjects, lease data, and raw errors.
- Trusted configuration supplies pairwise-disjoint live, control, backup, and
  restore roots plus opaque destination IDs and safe labels. Requests never
  accept a filesystem path or generated filename.
- Create holds the shared live-CAS maintenance permit across integrity,
  snapshot, exact referenced-CAS copy, staged verification, and manifest
  creation. The only destructive CAS collection path acquires the matching
  exclusive root permit before freshly reading SQLite references and holds it
  through mark, sweep, and the required rename/unlink parent syncs.
- Linux publication pins root and entry device/inode identity, syncs files and
  directories bottom-up, uses one no-overwrite same-filesystem rename, syncs
  the parent, and rechecks final identity and content.
- Windows uses only the two fixed bounded PowerShell/Win32 helpers. They inspect
  the original configured coordinates for the live, control, backup, and
  restore roots, require local fixed-drive NTFS, reject every ancestor or
  descendant reparse tag and case-sensitive directory, pin stable volume/file
  IDs, and publish through identity-bound
  `MoveFileExW(MOVEFILE_WRITE_THROUGH)` without replace or copy fallback.
  Fence loss terminates a running helper, and resource cleanup waits for the
  spawned child to actually settle even when termination itself reports an
  error.
- Recovery testing creates one exact operation-owned disposable copy, writes
  its quarantine marker before an internal read-only open, proves semantic and
  SQLite/CAS parity, and removes only the same recorded filesystem identity.
- Restore-as-copy publishes only a complete reverified copy with lifecycle
  `QUARANTINED_VERIFIED`. Every public writer/default-reader open rejects that
  copy before directory creation, SQLite open, lock, migration, listener, or
  worker composition.
- Runtime composition binds the validated live-root identity to the actual
  SQLite writer and exact live CAS, proves configured roots before either
  control database is created, and permanently closes intake on an expired
  live-process lease or fatal worker/control uncertainty.
- The serialized worker renews its exact non-banked lease periodically and at
  effect boundaries, checks the process-lifetime control lock at every store
  boundary, and aborts in-flight cooperative filesystem/CAS work on lease or
  heartbeat loss. It renews immediately after the synchronous SQLite snapshot
  and before inspecting or recording stage evidence. Cleanup cannot hide a
  primary fence failure; a cleanup-only failure is sanitized.
- Every durable phase performs only its named effect. Mutating Create, recovery,
  and restore phases revalidate the exact root/stage identity first; a restored
  copy passes marker-protected SQLite/CAS verification in its stage before
  publication and is verified again at the final identity.
- Backup health is independent of operation state. Current canonical source
  failure records `SUSPECT` or `MISSING`; a successful later `VERIFY` can restore
  `VERIFIED`. Destination/copy failure after current source verification leaves
  source health unchanged.

## Restart and discovery policy

Startup acquires the external process-lifetime lock before opening and
reconciling the ledger. Queued requests remain queued. A stale read-only
`VERIFY` is rerun canonically under a new fencing generation. A Create or
Restore crash after durable publication is completed only when its exact
ledger stage, configured-root identity, stage/final identity, fixed final name,
and complete content all reverify; otherwise it becomes `INTERRUPTED` and its
stage becomes inert. Earlier effect phases are safely terminal rather than
guessed or reused.

A stale recovery test may remove only its exact recorded disposable identity
and then becomes `INTERRUPTED`. Unknown service-named stages are recorded as
`ORPHANED` and are neither resumed nor deleted. An unregistered service-named
backup final becomes `DISCOVERED/VERIFIED` only after complete canonical
verification; invalid finals remain unregistered. A final reserved by a known
operation is never re-imported under a second provenance path.

## Local verification

Local candidate evidence on 2026-08-29:

- focused O1a Domain/Application, ledger, CAS, filesystem, quarantine, runtime,
  failure/health, and restart suite: **59 tests — 55 passed, 0 failed, 4 Windows-only skips**;
- full Studio suite: **589 tests — 585 passed, 0 failed, 4 Windows-only skips**;
- JavaScript syntax check: **177 files passed**.

The focused tests prove same-request replay with one durable output, changed
semantic-key conflict, all four successful operations, active-workspace byte
stability, source health transitions and repair, destination conflict,
quarantine-before-open, external-lock exclusion, stage/final no-overwrite,
published-crash reconciliation, safe interruption, exact recovery cleanup,
orphan classification, valid discovery, invalid-final rejection, fresh-reference
CAS-GC exclusion, root/stage swap rejection, truthful per-phase effects,
pre-publication restored-copy verification, live-store binding, and fatal lease
intake closure. It also proves periodic and immediate post-snapshot lease
renewal, cooperative fencing between CAS objects and publication steps,
primary-error precedence during cleanup, and Windows helper settlement before
resource release. A static helper-bootstrap regression additionally closes the
fixed PowerShell stderr-redirection API and keeps regular descendant files on
the no-follow reparse proof before directory-only NTFS identity checks. Real
Windows file durability uses one writable file handle for the required flush;
there is no read-only retry or fallback.
The
existing full suite additionally preserves schema-v13 SQLite/CAS behavior,
legacy HTTP/MCP catalogs, A1.4–A1.7, accepted checkpoint behavior, and package
boundaries.

Actual PowerShell/PInvoke behavior is intentionally not claimed by Linux local
evidence. The candidate requires the repository's selected Windows Studio lane
to execute that test before source integration. No browser lane belongs to
O1a because this block changes no visual or HTTP surface.

## Next gate

After O1a source integration, O1b must compose the local launcher-secret and
human HTTP boundary and add the frozen bounded **Backups** view: safety summary,
Create action, current operation, backup health/list/detail, Verify again,
Recovery test, and Restore as a new working copy. It must display unavailable,
empty, queued/running/succeeded/failed/interrupted, health, quarantine, and
restart states while offering no delete, retention, activation, remote, or MCP
action. O1b must append the first backup return-test item and stop at Klaus's
live review gate.
