# O0 backup and recovery operations contract

Status: **D0 CONTRACT FROZEN — O1 IMPLEMENTATION AND USER ACCEPTANCE PENDING**

Decision date: 2026-08-29

Implementation base: remote `main`
`f31a0c2df962b4747ade6119ee6850e40e888186`. This base contains the required
PR #166 merge lineage and the current Studio schema v13 migration
`0013_processing_result_adoptions.sql`. O0 changes documentation only. It adds
no schema, listener, route, authentication behavior, worker, UI, MCP surface,
backup, restore, deletion, activation, remote function, materialization,
publication, or release authority.

The owner selected an **external operations ledger**. The first O1 product
candidate comprises `CREATE`, `VERIFY`, `RECOVERY_TEST`, and
`RESTORE_AS_COPY`, followed by a bounded first human backup UI. Deletion,
retention, active-workspace activation/cutover, and remote invocation remain
outside O1. The backend block alone can be an implemented candidate, but it
cannot satisfy the O1 user gate without the UI.

## Promise and finish boundary

O0 freezes the implementation-grounded safety contract for one trustworthy
local backup workflow. O1 will reuse the accepted SQLite/CAS primitives behind
a durable human-owned operation rather than presenting the administration CLI
as an online API.

The complete O1 candidate path is:

```text
configured destination
→ durable human operation
→ consistent SQLite/CAS snapshot
→ complete verification
→ atomic no-overwrite publication
→ first Backups UI
→ implemented candidate — not user accepted
```

O1 is not complete or user-accepted until Klaus can use the UI to create and
verify a backup, run a recovery test, restore it as a new quarantined copy, and
observe a deliberate failure without damage. Automated proof, source
integration, and CI cannot close that gate.

There is no O1 command or control for:

- deleting a published backup or restored copy;
- automatic retention or cleanup of published output;
- activating, merging into, or replacing the active workspace;
- selecting an arbitrary server path;
- remote invocation, a widened listener, remote MCP, or agent authority; or
- materialization, repository publication, or release.

Exact removal of an operation-owned, never-published stage or disposable
recovery-test copy is internal failure/recovery hygiene, not a deletion
feature. It must use the immutable operation identity and may never target a
published backup, restored copy, active workspace, or caller-provided path.

## Actual implementation baseline

| Current seam | Current fact | Frozen O1 use |
| --- | --- | --- |
| `createWorkspaceBackup` | Verifies the live workspace, creates a SQLite snapshot, copies the referenced CAS closure, verifies that snapshot, and writes manifest v1. It creates the requested directory directly and does not durably stage, lease, or publish it. | Protected persistence primitive invoked only inside an operation-owned stage after path reservation and the CAS/GC read barrier are active. It never receives browser input or a final destination. |
| `verifyWorkspaceBackup` | Rechecks manifest schema, database digest, exact CAS set, artifact manifest, and semantic integrity through a read-only SQLite store. | Canonical content verification primitive for create, verify, recovery test, restore, restart reconciliation, and pre-publication proof. |
| `restoreWorkspaceBackup` | Verifies the source and copies SQLite/CAS into caller-supplied destinations with exclusive database creation, but has no whole-copy stage, quarantine, or atomic publication. | Protected copy primitive used only inside a generated restore/recovery-test stage. The O1 orchestrator adds full-copy verification, quarantine, durable close, and publication. |
| `SqliteWorkspace` / `SqliteProjectStore` | The live service owns the writer lock; SQLite uses WAL, `synchronous=FULL`, migrations, reader mode, and `VACUUM INTO` backup. | The running service remains the sole semantic writer. O1 composes the live store; it never opens a second project writer. |
| `ContentAddressedArtifactStore` | CAS placement and manifests are digest-verified and same-filesystem aware. | O1 pins the exact snapshot-referenced closure and holds a backup/GC read barrier until every required byte is copied and verified. |
| `studio-admin` | Offline CLI requires the Studio writer to be stopped and accepts explicit machine paths. | Remains an offline administration/recovery tool. Its raw-path contract is not reused by HTTP or the browser. |
| Local HTTP UI | Loopback binding, same-origin checks, and CSRF protect mutations, but `/api/ui-session` does not establish a distinct workspace-operator capability. | CSRF alone is insufficient. O1 adds a separate local human workspace-operator session and applies it to every backup metadata read and operation. |
| Store mode | The server can currently start with SQLite or the protected JSON development store. The backup primitives require SQLite/CAS. | O1 is available only in SQLite mode. JSON mode opens no control ledger, worker, operator bootstrap, or backup route and remains fail-closed `OPERATIONS_UNAVAILABLE`. |
| Schema | Workspace schema v13 owns migration 0013. No backup-operation tables exist. | O1 allocates no workspace migration. The external control ledger starts its own unrelated control schema at version 1. |

These primitives are necessary but not sufficient for online backup safety. O1
must not relabel the current CLI functions as durable jobs without the controls
below.

## Frozen architecture decisions

### 1. External service control ledger

The O1 ledger is a separate SQLite control store rooted outside the live
workspace and outside every backup/restore destination. Trusted startup
configuration supplies one absolute `controlRoot`; the implementation places
these fixed service-owned entries below it:

```text
operations.sqlite
operations.lock
recovery-tests/
```

The control store has its own schema version 1, WAL, foreign keys, full
synchronous durability, checksummed migrations, and one writer owned by the
Studio service process. It is a second infrastructure writer, never a second
semantic **project** writer. It may store only:

- opaque operation, backup, destination, and restored-copy IDs;
- operation kind, request fingerprint, idempotency key, state, phase, progress,
  timestamps, lease owner/generation/expiry, and sanitized terminal result;
- generated stage/final basenames and stable configured-root identity;
- manifest identity, safe counts/bytes, and verification/recovery timestamps;
  and
- append-only operation events needed for restart and audit.

It must not store or mutate projects, revisions, assets, rooms, tasks, grants,
HostBindings, semantic Activity, CAS bytes, credentials, browser tokens, raw
caller paths, or arbitrary serialized exceptions.

The control root, ledger, lock, and recovery-test directory are excluded from
workspace backup and restore. Restored copies therefore contain no operation
queue, lease, destination registry, or source-host resume authority. A missing
or unavailable control ledger makes the backup subsystem
`OPERATIONS_UNAVAILABLE`; ordinary local authoring may remain available, but no
backup operation may be accepted, resumed, or reported successful.

Startup order is fixed:

1. resolve the requested data root without creating or opening it and run the
   fixed-name quarantine-marker preflight;
2. if the marker exists, fail `RESTORED_COPY_QUARANTINED` before
   `SqliteProjectStore.open`, writer-lock acquisition, directory creation,
   migration, pairing, listener, or worker composition;
3. require SQLite mode, then parse and validate trusted operations
   configuration and disjoint roots;
4. acquire the existing live-workspace writer lock;
5. acquire the external operations lock and open/migrate control schema v1;
6. reconcile ledger records, generated stages, and published outputs;
7. invalidate stale leases by increasing their fencing generation;
8. compose the in-process operation service and single serialized effect
   worker; and only then
9. expose the local human operation routes and start worker intake.

The service never infers a valid backup from a stage. If the ledger is lost or
rebuilt, only a service-named final directory with a complete manifest that
passes canonical verification may be imported with provenance `DISCOVERED` and
health `VERIFIED`. An unmatched stage receives disposition `ORPHANED`; it is neither
resumed nor removed automatically. Reconciliation of a known operation that
published before ledger completion may verify its exact reserved final identity
and finish the original operation idempotently.

### 2. Implementation base and migration ownership

O1 is based on remote `main`
`f31a0c2df962b4747ade6119ee6850e40e888186`, where the semantic workspace is
already schema v13 and migration 0013 is pinned to
`af908897b489d24110dabbd1cad8754bd85959bfc744cf811b81c376b4603043`.

The external ledger uses an independent namespace and control schema version
1. It does not use the workspace `PRAGMA user_version`, `schema_migrations`, or
the `0001`–`0013` sequence. O1 therefore adds no `0014` Studio migration. If a
later proposal needs semantic workspace state, it must stop, reclassify the
change, use the then-current migration sequence (0014 is only the current next
available slot), and obtain a new architecture decision.

### 3. Human workspace-operator authority

The exact O1 capability is `workspace.backup.manage`. It is available only to
a service-minted `LOCAL_WORKSPACE_OPERATOR` session inside the accepted
loopback single-user trust boundary. Project ownership, task membership,
Grant/HostBinding state, MCP pairing, command scope, browser DOM state, CSRF,
or possession of a backup ID cannot derive this capability.

The authentication root is an out-of-band local launcher bootstrap, not CSRF.
On SQLite-mode startup with operations configured, the launcher generates one
192-bit random bootstrap secret, keeps only its digest in process memory, and
prints the secret exactly once to the controlling terminal outside the normal
application logger. The service never emits it through HTTP or HTML, and it is
never stored in project/control SQLite, environment echo, command arguments, a
URL, MCP, pairing, or a log. If the Node launcher cannot open `/dev/tty` on
Linux or `CONOUT$` on Windows, or
there is no trusted programmatic test injector, the operations subsystem
remains `OPERATIONS_UNAVAILABLE`.

O1 local session rules are:

- the **Backups** UI requires an explicit **Unlock backup controls** step in
  which the human enters that launcher secret into a same-origin,
  loopback-only, CSRF-protected, rate-limited bootstrap request;
- the secret is transiently permitted only in a password field with
  `autocomplete="off"` and that one bootstrap request body. The UI
  clears the field immediately after request serialization and retains no
  state, telemetry, DOM attribute, error echo, or evidence copy; the server
  compares the digest in one bounded validation scope and never logs or returns
  the submitted value;
- the bootstrap secret expires after ten minutes, is invalidated after one
  successful exchange, and permits at most five failed attempts; loss, expiry,
  or exhaustion requires a local service restart and a new launcher secret;
- success mints a distinct high-entropy operator token with 15-minute idle and
  eight-hour absolute expiry; the token rotates only through a new authenticated
  bootstrap and is invalidated on service shutdown/restart;
- the operator token is a host-only `HttpOnly`, `SameSite=Strict`, path-scoped
  non-persistent session cookie held in browser memory; it is never readable by
  UI JavaScript or placed in a URL, Web Storage, workspace/control SQLite, logs,
  or returned operation data;
- every backup list/detail read and every create/verify/recovery-test/restore
  mutation requires the live operator session; mutations additionally retain
  the current same-origin and CSRF checks; and
- MCP, the private Authoring-v2 bridge, project/task authority, the ordinary
  administration CLI, and project command dispatch cannot read the bootstrap
  secret or mint/supply an operator session.

This is local single-user authentication, not remote identity. O2 must replace
or wrap it with its separately reviewed HTTPS authentication/session contract;
O1 must not make it remotely reachable.

### 4. Destination registry and safe path resolution

The only trusted path input is an administrator-owned startup configuration
file selected through `NUMBERDROID_STUDIO_OPERATIONS_CONFIG`. Its schema v1
contains one `controlRoot`, one or more labelled backup roots, and one or more
labelled restore-copy roots. Registry entries have an opaque stable
`destinationId`; browser/API DTOs contain only that ID. Raw roots are never
returned to the browser, operation result, Activity, MCP, or normal log.

At startup and again before reservation/publication, the platform-safe
filesystem adapter must:

1. require absolute configured roots and reject caller path fragments entirely;
2. canonicalize case according to the volume and reject case-fold duplicates;
3. reject symlinks, Windows reparse points/junctions, and non-directory roots;
4. allow only the fixed `controlRoot/recovery-tests` child; reject equality or
   nesting in either direction among the live workspace, `controlRoot`, every
   configured backup root, and every configured restore root, and reject any
   recovery-test path outside that fixed control child;
5. pin stable root identity and same-filesystem identity for every stage/final
   pair;
6. generate basenames from validated opaque operation IDs, never labels,
   manifest content, dates supplied by a caller, or project names;
7. derive only fixed or strict generated basenames, use `lstat`, `realpath`, and
   stable `stat` identity before each defined side-effect boundary, and reject
   every injected root/parent identity change before the next mutation; and
8. fail closed on containment drift, directory swap, unsupported durability,
   permission ambiguity, or another conforming writer.

Configured output roots are exclusively service-managed by the one locked
Studio process. The O1 threat model admits no other writer under the same OS
service identity; a hostile administrator or unrestricted same-identity process
is outside O1. Under that explicit boundary, fixed/generated basenames,
service-exclusive roots, one serialized effect worker, and repeated identity
checks remove an in-model check/use competitor. Fault tests must still inject a
root/parent swap at every adapter seam and observe `BACKUP_PATH_UNSAFE` before
the following mutation.

The concrete adapter lives under `packages/persistence/src/operations/` and
uses the existing Node 22 `node:fs/promises` surface; control schema v1 uses the
existing `better-sqlite3` dependency. Linux publication uses Node file/directory
sync plus same-filesystem rename. Windows publication invokes the fixed,
checked-in, noninteractive
`packages/persistence/src/operations/windows-publish.ps1` helper. The helper
reads stage/final coordinates as bounded JSON on stdin, calls `MoveFileExW` with
`MOVEFILE_WRITE_THROUGH` and without `MOVEFILE_REPLACE_EXISTING`, and returns
only a stable success/error code. It emits no path and accepts no command text.
O1 adds no compiled native addon.

Supported roots are a same-volume local filesystem with atomic durable
directory rename: Linux filesystems that permit directory sync and Windows
NTFS through the fixed helper. Missing PowerShell/Win32 support or another
filesystem fails configuration with `BACKUP_PATH_UNSAFE` or
`BACKUP_DURABILITY_FAILED`; O1 does not silently weaken one lane.

Manifest-relative names remain the fixed schema values `studio.sqlite`,
`artifacts`, and `workspace-manifest.json`. Manifest content is never used as a
general path.

### 5. Atomic visibility and durability

Create and restore allocate one unguessable service-generated identity and one
same-filesystem sibling stage:

| Output | Hidden stage basename | Final basename |
| --- | --- | --- |
| Backup | `.numberdroid-backup-stage-<operationId>` | `backup-<backupId>` |
| Restored copy | `.numberdroid-restore-stage-<operationId>` | `workspace-copy-<copyId>` |

The control-ledger reservation, operations lock, service-exclusive root, and
single serialized effect worker make the conforming service the only publisher.
Publication is allowed only after fixed-name content creation, canonical
verification, durable file close, database and manifest flush, stage-directory
metadata flush on Linux, final-parent identity revalidation, and an immediate
proof that the reserved final basename is absent. The platform publisher then
performs one same-filesystem directory move: Node rename on Linux or the fixed
no-replace write-through helper on Windows. It then reopens and verifies the
exact final. Because there is no in-model competing writer, the Linux rename
cannot encounter an entry created after the absence proof; the Windows helper
also forbids replacement at the syscall boundary. A final that already exists
produces `BACKUP_DESTINATION_CONFLICT` and is never renamed over.

Linux additionally syncs the final parent. On Windows NTFS the adapter flushes
and closes every database/artifact/manifest handle, requires no open stage
handle, delegates the no-replace write-through rename to the fixed helper, then
reopens and verifies the final. Failure of a required lane-specific
close/sync/write-through/reopen proof produces `BACKUP_DURABILITY_FAILED`; the
UI never reports durable success on a weaker fallback.

The ledger records `PUBLISHED` only after rename and the lane-specific publish
durability/reopen proof.
It records `SUCCEEDED` only after re-resolving and verifying the exact final
identity. A crash between publication and ledger completion is reconciled by
that reserved identity and verification, never by creating another final.
Failed stages are unusable, never listed as backups, never silently reused by a
new operation, and never overwrite earlier output.

### 6. Durable operation model

The external ledger stores these immutable request coordinates:
`operationId`, `kind`, `idempotencyKey`, canonical request fingerprint,
destination ID where applicable, backup ID where applicable, generated output
ID where applicable, and creator session subject. Mutable state is limited to
status, phase, monotonic progress, lease/fencing data, timestamps, and sanitized
result.

Common status is exactly:

| Status | Meaning | Terminal |
| --- | --- | --- |
| `QUEUED` | Durable request exists and no worker owns it. | No |
| `RUNNING` | One live worker generation owns the lease. | No |
| `SUCCEEDED` | Exact final evidence is durably complete and verified. | Yes |
| `FAILED` | A known failure occurred before success; any stage is inert. | Yes |
| `INTERRUPTED` | Restart reconciliation cannot safely prove or resume the recorded phase. | Yes |

Cancellation is absent from O1. Browser disconnect and request abort stop only
response delivery; they do not cancel the durable operation. Same
`idempotencyKey` plus byte-identical canonical request returns the original
operation. Reusing the key with any changed semantic field fails with
`OPERATION_IDEMPOTENCY_CONFLICT`.

One service process holds both required writer locks and runs exactly one
serialized filesystem-effect worker. The time-bounded ledger lease and
monotonically increasing fencing generation are restart/reconciliation
metadata, not permission to run a second live effect worker. A live process
never reclaims an apparently expired lease while its worker may still execute;
it marks the subsystem unhealthy and stops new intake instead.

The worker holds one in-process publish critical section from the final fencing
check through final-absence proof, rename, final reopen/verification, and the
ledger `PUBLISHED` transition. No worker can change the generation inside that
section. Restart recovery can claim work only after the former process no
longer owns either writer lock, which also means its worker no longer exists. A
process crash after rename but before `PUBLISHED` is handled by exact-identity
reconciliation, not concurrent fencing.

The fixed phase sequences are:

| Kind | Ordered phases |
| --- | --- |
| `CREATE` | `RESERVED` → `SOURCE_VERIFIED` → `DB_SNAPSHOTTED` → `CAS_COPIED` → `MANIFEST_WRITTEN` → `SNAPSHOT_VERIFIED` → `DURABLY_CLOSED` → `PUBLISHED` → `COMPLETED` |
| `VERIFY` | `RESERVED` → `BACKUP_RESOLVED` → `CONTENT_VERIFIED` → `COMPLETED` |
| `RECOVERY_TEST` | `RESERVED` → `BACKUP_VERIFIED` → `COPY_STAGED` → `COPY_VERIFIED` → `READ_ONLY_OPENED` → `PARITY_VERIFIED` → `TEST_COPY_CLEANED` → `COMPLETED` |
| `RESTORE_AS_COPY` | `RESERVED` → `BACKUP_VERIFIED` → `COPY_STAGED` → `COPY_VERIFIED` → `QUARANTINE_WRITTEN` → `DURABLY_CLOSED` → `PUBLISHED` → `COMPLETED` |

`COMPLETED` pairs only with terminal `SUCCEEDED`. A known error produces
`FAILED`; an unprovable post-crash boundary produces `INTERRUPTED`. On restart,
read-only verification is rerun from the beginning. Create/restore may resume
only from an exact ledger-owned stage after revalidating every completed phase
and source/final identity; otherwise the operation becomes `INTERRUPTED` and
the stage stays inert. Recovery test may rebuild or remove only its exact
operation-owned disposable copy. A found reserved final is never republished;
it is verified and reconciled or the operation fails closed.

Operation status is distinct from durable backup health. Each published backup
has provenance `CREATED` or `DISCOVERED` and exactly one health state:

| Backup health | Usable for recovery | Transition rule |
| --- | --- | --- |
| `UNVERIFIED` | No | A discovered or crash-reconciled final starts here until canonical verification succeeds. |
| `VERIFIED` | Yes, subject to a fresh operation-start verification | Successful create or verify records exact manifest identity and verification time. |
| `SUSPECT` | No | Any later canonical content/integrity verification failure marks the backup suspect without erasing earlier history. |
| `MISSING` | No | The reserved final identity no longer exists. A UI/API caller cannot repair this by choosing a path. |

A later successful `VERIFY` may move `UNVERIFIED` or `SUSPECT` back to
`VERIFIED`; `MISSING` remains blocked until the exact reserved final reappears
and passes canonical verification. `RECOVERY_TEST` and `RESTORE_AS_COPY` require
current `VERIFIED` health and repeat canonical source verification before
copying. A source-content failure moves health to `SUSPECT`; a destination,
capacity, permission, or disposable-copy failure after source verification
leaves the source backup's health unchanged.

Stage disposition is separately `ACTIVE`, `INERT`, or `ORPHANED`; it is never
a backup health or operation status and never appears in the valid-backup list.
A successful restored-copy record has fixed lifecycle
`QUARANTINED_VERIFIED`. O1 defines no transition out of that lifecycle.

Create holds a service-level snapshot/CAS-GC read barrier from snapshot closure
selection until all referenced bytes are copied. Semantic commits may continue;
the result must equal one complete pre- or post-commit state. Atlas discard,
reference release, and CAS GC cannot remove snapshot-required bytes while the
barrier is live.

### 7. Recovery-test and restored-copy quarantine

A recovery test uses a generated directory below the fixed recovery-test root.
It verifies the source backup, restores the full SQLite/CAS pair, verifies the
copy, opens SQLite read-only, compares canonical integrity/manifest evidence,
starts no HTTP listener, pairing socket, MCP host, atlas worker, operation
worker, or semantic writer, and then removes only that exact disposable copy.
Its durable result retains safe parity evidence and timestamps, not paths.

`RESTORE_AS_COPY` and the offline `studio-admin restore` publish a complete
copy only after writing and durably verifying the fixed quarantine marker
`.numberdroid-restored-copy-quarantine.json`. Normal Studio startup must detect
that marker through a fixed-name, no-follow data-root preflight before
`SqliteProjectStore.open`, directory creation, writer lock, migration, listener,
pairing, or worker startup and fail with `RESTORED_COPY_QUARANTINED`. The marker
identifies the restored-copy and source backup by opaque IDs and verified
manifest identity; it contains no credential or source-host path.

The guard is also mandatory in the shared persistence open path, not only the
server launcher. Before directory creation, SQLite open, writer-lock creation,
or migration, `SqliteWorkspace.open` checks the data-root marker. Every writer
or migration-capable open fails `RESTORED_COPY_QUARANTINED`, including direct
`SqliteProjectStore.open`, direct `SqliteWorkspace.open`, and every
`studio-admin` command that opens a workspace. A marker-bearing reader opens
only with an explicit internal `VERIFY` or `RECOVERY_TEST` purpose; the default
reader path also fails closed. No HTTP/MCP/UI caller can select that purpose.

The copied workspace may physically contain historical sessions, HostBindings,
grants, nonterminal semantic jobs, or service metadata because it is a faithful
snapshot. Quarantine, read-only recovery testing, absence of the external
ledger, and the startup guard ensure none becomes live authority or resumable
work in O1.

### 8. Activation remains outside O1

Restore-as-copy is not activation. O1 exposes no marker removal, active pointer,
workspace switch, merge, credential rewrite, or writer start for a restored
copy. A later owner-only activation contract must separately require:

- the original authoritative writer stopped and recorded;
- explicit reauthentication and short-lived activation authority;
- pre-cutover backup and full source/copy verification;
- invalidation or rotation of copied sessions, HostBindings, grants, pairing
  credentials, leases, and resumable jobs;
- one atomic active-workspace selection with a rollback record; and
- post-cutover verification plus documented rollback.

Deletion, retention, activation, and remote operation remain separate future
decisions even after O1 acceptance.

## Package and transport boundary

| Layer | O1 responsibility | Forbidden dependency/authority |
| --- | --- | --- |
| Domain/Application | Operation kinds, request fingerprint, state transitions, failure projection, human capability check, orchestration ports, snapshot/GC barrier. | Filesystem paths, HTTP/MCP details, SQLite implementation, owner activation. |
| Persistence | Existing backup/verify/restore primitives plus `packages/persistence/src/operations/` for control schema v1, configured roots, safe staging/publication, read-only recovery, shared pre-open quarantine guard, marker-writing O1/admin restore, and reconciliation. | Browser DTOs, capability minting, semantic project mutation from the control ledger. |
| Studio service composition | SQLite mode only: preflight the data root, own both locks, create the launcher bootstrap, compose one serialized effect worker with the live store/CAS, and drain intake on shutdown. JSON mode exposes none of these. | New listener, remote bind, MCP catalog entry, parallel filesystem workers. |
| O1a backend candidate | In-process operation service and adversarial tests. No public route or visual acceptance claim. | UI acceptance, remote exposure, delete, activation. |
| O1b first UI candidate | Additive loopback launcher-secret bootstrap, human-only HTTP projection/actions, and a bounded **Backups** view. | Agent/MCP use, arbitrary paths, remote auth, mobile-complete redesign. |

The accepted legacy MCP 19/four and matching-task 30/five catalogs and the
explicit Authoring-v2 31/six catalog remain exact. O1 adds no tool, resource,
server instruction, role, scope, or pairing behavior. The accepted listener
remains loopback-only and hard-refuses non-local bind addresses.

The bounded human request shapes are fixed semantically as:

```text
CREATE          { schemaVersion: 1, destinationId, idempotencyKey }
VERIFY          { schemaVersion: 1, backupId, idempotencyKey }
RECOVERY_TEST   { schemaVersion: 1, backupId, idempotencyKey }
RESTORE_AS_COPY { schemaVersion: 1, backupId, destinationId, idempotencyKey }
```

No request accepts a path, stage/final name, manifest filename, control-root
coordinate, delete flag, activation flag, remote target, task/grant/HostBinding
identity, or agent context. The response allowlist contains only opaque IDs,
kind, status, phase, monotonic progress, safe destination label, safe counts and
bytes, timestamps, verification state, and allowlisted failure code/message.

### Local/remote, proxy, MCP, and mobile separation

O1 remains in the accepted local deployment mode. Its human routes bind only to
loopback, derive origin/remote address from the direct socket, and do not trust
`Forwarded`, `X-Forwarded-*`, or another proxy-supplied identity/address header.
There is no O1 proxy mode. O2 must introduce a distinct deployment adapter with
explicit trusted-hop configuration, authenticated HTTPS sessions, direct-port
denial, and its own security evidence; widening `NUMBERDROID_STUDIO_HOST` is
forbidden.

MCP remains local stdio/private loopback pairing with its exact existing
catalogs. Neither O1 operation metadata nor the local operator-session bootstrap
is exposed through MCP server instructions, tools, resources, pairing, or the
Authoring-v2 bridge.

The information hierarchy frozen above also governs the later phone layout:
safety summary and primary action first, then current operation, backup list,
one selected detail/action view, and optional technical disclosure. At phone
widths it becomes list → selected detail rather than compressed desktop columns.
That hierarchy decision lets O1 avoid a desktop-only data contract, but O1b is
not O3 mobile/touch completion and cannot satisfy the real-device gate.

## Stable O1 failure codes

| Code | Fixed meaning |
| --- | --- |
| `WORKSPACE_OPERATOR_REQUIRED` | No live local human workspace-operator session is present. |
| `WORKSPACE_OPERATOR_FORBIDDEN` | The supplied session cannot exercise `workspace.backup.manage`. |
| `OPERATIONS_UNAVAILABLE` | SQLite mode, control configuration/lock/ledger, launcher bootstrap source, worker, or required filesystem support is unavailable. |
| `OPERATION_NOT_FOUND` | The opaque operation, backup, or restored-copy ID is unknown in the current registry. |
| `OPERATION_IDEMPOTENCY_CONFLICT` | One idempotency key was reused with changed semantic input. |
| `OPERATION_STATE_CONFLICT` | The requested transition is not valid from the durable state/phase. |
| `OPERATION_LEASE_LOST` | The worker no longer owns the current fencing generation. |
| `BACKUP_DESTINATION_UNKNOWN` | The requested opaque destination ID is not configured for this operation. |
| `BACKUP_PATH_UNSAFE` | Root identity, containment, link/reparse, nesting, case-fold, TOCTOU, or platform-safety proof failed. |
| `BACKUP_DESTINATION_CONFLICT` | A reserved stage/final identity already exists or no-overwrite publication lost a race. |
| `BACKUP_SOURCE_INTEGRITY_FAILED` | Canonical live semantic/SQLite/CAS integrity failed before snapshot creation. |
| `BACKUP_SNAPSHOT_FAILED` | A consistent database or required CAS closure could not be created. |
| `BACKUP_SNAPSHOT_INTEGRITY_FAILED` | Staged backup semantic/SQLite/CAS verification failed. |
| `BACKUP_SCHEMA_UNSUPPORTED` | The backup manifest or SQLite schema cannot be verified by this implementation. |
| `BACKUP_CONTENT_MISMATCH` | Database, manifest, CAS set, digest, or semantic closure differs from verified evidence. |
| `BACKUP_DURABILITY_FAILED` | Required lane-specific file/directory close, sync, or final-reopen proof could not be proved. |
| `BACKUP_PUBLISH_FAILED` | Verified output could not be atomically published without overwrite. |
| `RECOVERY_TEST_FAILED` | The verified read-only restored copy or parity proof failed. |
| `RESTORE_COPY_FAILED` | A new full copy could not be staged and verified without touching active/source/prior data. |
| `RESTORED_COPY_QUARANTINED` | Normal service startup or mutation was attempted against an inert restored copy. |
| `OPERATION_INTERRUPTED` | Restart reconciliation could not safely prove or resume the recorded operation phase. |

Lower-level integrity findings remain available only through a bounded
allowlist. Raw paths, destination roots, tokens, secrets, stack traces,
credentials, socket endpoints, HostBinding/Grant IDs, and unbounded exception
details are always redacted from UI/API results and ordinary logs.

## Threat model

| Threat | Control | Required falsification evidence |
| --- | --- | --- |
| Live workspace loss | Restore never writes active data; all outputs use generated disjoint roots and no-overwrite publish. | Inject every restore failure and prove active DB/CAS hashes unchanged. |
| Mixed SQLite/CAS snapshot | SQLite native snapshot plus snapshot-derived CAS closure and GC read barrier. | Race semantic commit, atlas discard, reference release, and GC; result equals one complete boundary state. |
| Existing-output overwrite | Ledger reservation, service-exclusive root, single effect worker, immediate final-absence proof, exact final identity. | Precreate stage/final and race two reservations; earlier backups remain byte-identical. |
| Traversal or root escape | No caller path; fixed filenames; pinned configured roots; safe filesystem adapter. | Traversal, absolute/drive/UNC, symlink, reparse/junction, case-fold, nesting, and directory-swap probes fail before mutation. |
| Confused deputy | Dedicated human capability and opaque registry IDs; no project/task/agent derivation. | Project owner, task grant, HostBinding, MCP, and guessed IDs all fail. |
| Session theft/replay | Out-of-band one-use launcher secret, rate-limited bootstrap, in-memory expiring operator session, CSRF/origin checks, idempotency fingerprint. | HTTP cannot read/mint the launcher secret; missing/expired/reused secret or token, cross-origin request, stale CSRF, and changed replay fail without operation. |
| Direct-port/remote bypass | Existing loopback refusal unchanged; O1 routes require operator session. | Non-loopback bind/start and non-loopback socket request fail; no metadata leaks. |
| Second project writer | Existing workspace lock plus operations lock and ordered startup. | Competing service process cannot start worker/listener or publish. |
| Crash or lost response | External durable state, phase evidence, leases/fencing, exact reserved identity, idempotent reconciliation. | Kill after every boundary; retry returns one operation/output or a safe terminal state. |
| Disk-full/permission/durability failure | Stage-only writes, explicit flush, fail-closed publication. | Fault each write/flush/rename; no final success or changed prior output. |
| Corrupt/swapped backup | Canonical verification before use and after publication; IDs bind exact final identity. | Mutate/swap DB, manifest, missing/extra CAS at verify/recovery/restore boundaries. |
| Stale worker | Both process locks, one serialized effect worker, no live lease takeover, and one publish critical section. | A second claimant cannot run while the first process lives; post-crash reconciliation creates no second output. |
| Copied authority resumes | External ledger excluded; recovery read-only; shared persistence pre-open quarantine guard. | Server, admin CLI, and direct writer/migration opens fail before mutation; copied sessions, grants, HostBindings, jobs and leases start no listener/worker/writer. |
| Cleanup targets wrong data | Cleanup accepts only ledger-owned disposable identity below recovery-test root. | Swap IDs/roots and inject stale cleanup; active/source/prior/final hashes stay unchanged. |
| Path/secret leakage | Opaque IDs and projection/log allowlists. | Scan API, HTML, DOM, logs, errors, fixtures, and artifacts for roots/tokens/stack/credentials. |
| JSON-mode widening | O1 composition is SQLite-only and JSON mode has no ledger, bootstrap, route, or worker. | JSON startup preserves protected behavior and every O1 operation fails closed without side effects. |

The O1 trust boundary assumes the configured roots and their parent permissions
are administered for the Studio service account. A hostile operating-system
administrator or process with the same account's unrestricted filesystem and
process-memory access is outside O1; protecting against that actor requires a
separate host isolation and credential model. O1 still detects simulated root
identity swaps and never treats a path check alone as authority.

## Adversarial test matrix

| ID | Smallest falsifying test seam | Required lane |
| --- | --- | --- |
| `O1-T01` | Same key/same request returns one operation; changed request conflicts. | Domain/Application, Linux + Windows |
| `O1-T02` | Competing requests reserve exactly one stage/final; a second effect worker cannot run or reclaim a live lease. | Control-ledger integration, Linux + Windows |
| `O1-T03` | Fault after every create phase, including each CAS copy, flush, rename, and ledger completion. | Persistence/control integration, Linux + Windows |
| `O1-T04` | Fault after every restore and recovery-test phase; active/source/prior hashes never change. | Persistence/control integration, Linux + Windows |
| `O1-T05` | Disk-full, permission, read-only, Linux sync, Windows write-through-helper absence/failure, close/reopen, preexisting-final, and rename failures. | Safe-filesystem adapter, Linux + Windows |
| `O1-T06` | Traversal, absolute/drive/UNC, symlink, reparse/junction, case-fold, nested roots, and root-swap race. | Platform filesystem, Linux + Windows |
| `O1-T07` | DB/manifest digest mismatch and missing/extra/swapped CAS fail verify, recovery test, and restore. | Existing backup primitives + orchestrator |
| `O1-T08` | Concurrent semantic commit, atlas discard, reference release, and GC produce one complete snapshot. | Real SQLite/CAS integration |
| `O1-T09` | Process death/restart at every phase reconciles one output or exact safe terminal state. | Spawned-process integration, Linux + Windows |
| `O1-T10` | Browser disconnect after acceptance leaves durable work intact; replay resolves original operation. | HTTP integration + real browser |
| `O1-T11` | Launcher secret is absent from HTTP/logs; missing/expired/reused/exhausted bootstrap or operator session, CSRF/origin failure, owner/task/HostBinding/MCP attempts all deny. | HTTP/security integration |
| `O1-T12` | Recovery copy opens only with explicit read-only purpose; restored-copy guard blocks server, admin CLI, direct ProjectStore/Workspace writer or migration, and default reader before any mutation/listener/worker. | Persistence + spawned-process integration |
| `O1-T13` | Cleanup can address only exact generated test identity; hostile identity/root substitution fails. | Control/filesystem integration |
| `O1-T14` | Server output, operation projections, errors, logs, post-submit DOM/field, telemetry and evidence contain no launcher secret, raw root/path, token or stack; the bounded bootstrap request is never captured as evidence. | Unit + HTTP + browser artifact scan |
| `O1-T15` | Legacy 19/four, task 30/five, Authoring-v2 31/six, loopback bind, and accepted non-backup HTTP behavior stay exact. | Compatibility suites |
| `O1-T16` | First UI renders locked/unavailable plus every operation/health state, retains context across polling/restart, and offers no delete/activate/remote action. | Real Chrome at protected desktop widths |
| `O1-T17` | `UNVERIFIED`/`VERIFIED`/`SUSPECT`/`MISSING` transitions gate recovery; destination failures do not corrupt source health. | Control-ledger + canonical verification integration |
| `O1-T18` | JSON mode opens no O1 ledger/bootstrap/route/worker and returns no backup metadata or authority. | Server compatibility integration |

O1a runs the smallest relevant Domain/Application, control-ledger, real
SQLite/CAS, process/restart, Linux, and Windows lanes. It does not require a
browser lane because it adds no UI. O1b adds focused HTTP, accessibility, and
real-browser evidence without rerunning unrelated game/runtime lanes. Root/game,
Pages, remote-network, mobile-device, and release lanes remain out of scope
unless the actual diff triggers them.

## First O1 UI state contract

The bounded O1b surface is one additive **Backups** destination in the existing
human shell. It is the acceptance surface, not an administrative filesystem
console. Its information hierarchy is:

1. plain-language current safety summary;
2. one dominant **Create backup now** action and configured destination label;
3. current durable operation phase/progress that survives navigation/reload;
4. completed backup list with last verified time and problem state;
5. selected backup actions **Verify again**, **Test recovery**, and
   **Restore as a new working copy**; and
6. closed optional technical details with safe counts, bytes, manifest identity,
   timestamps, operation ID, and failure code.

It contains no path editor, directory picker, delete/cleanup/retention button,
activate/switch button, remote control, MCP affordance, or success language at
queue acceptance.

| Visible state | Source fact | Primary copy and available action |
| --- | --- | --- |
| `OPERATIONS_UNAVAILABLE` | Config/ledger/worker/operator bootstrap cannot safely operate. | **Backups are unavailable.** Existing work remains open; show one sanitized remediation and no operation action. |
| `OPERATOR_LOCKED` | O1 is configured and the one-use launcher bootstrap is available, but no live operator session exists. | **Unlock backup controls.** Accept the terminal-displayed code through the explicit unlock form; show no backup metadata before success. |
| `NO_BACKUPS` | Registry read succeeds with no verified published backup. | **No verified backup yet.** Offer **Create backup now**. |
| `QUEUED` | Durable operation status is `QUEUED`. | **Backup request saved. Waiting to start.** Navigation or disconnect does not cancel it. |
| `RUNNING` | Durable operation status is `RUNNING` with one fixed phase. | Plain phase-specific progress such as **Checking current work**, **Copying protected files**, or **Verifying the backup**; no premature success. |
| `VERIFIED_BACKUP` | Durable backup health is `VERIFIED`, exact final identity exists, and the last create/verify operation succeeded. | **Backup complete and verified.** Offer Verify, recovery test, and restore-as-copy. |
| `RECOVERY_TEST_PASSED` | Recovery test is terminal `SUCCEEDED` after read-only parity and exact cleanup. | **Recovery test passed. This backup can be restored as a new copy.** |
| `RESTORED_COPY_READY` | Restore is terminal `SUCCEEDED`, final copy verified and quarantine marker present. | **Restored copy is ready for inspection. It is not active.** No activation action. |
| `FAILED` | Operation is terminal `FAILED`. | **Backup action did not complete. Your active work and earlier backups were not changed.** Show safe code/remediation and an allowed fresh retry where applicable. |
| `INTERRUPTED` | Operation is terminal `INTERRUPTED`. | **The interrupted action could not be resumed safely.** Stage remains unusable; offer no cleanup control. |
| `BACKUP_DAMAGED` | Durable backup health is `SUSPECT` or `MISSING` after canonical source verification/identity failure. | **This backup needs attention. Do not use it for recovery.** Preserve earlier success history; disable recovery test and restore until the exact backup is present and verification succeeds. |

Healthy state is quiet and task-oriented. Technical IDs and counts are
secondary. Failures state what remains safe and what Klaus can do next without
exposing implementation paths. Polling replaces only changed bounded content
and retains compatible selection, focus, scroll, and open technical disclosure.

Every O1 UI and status record must say **implemented candidate — not user
accepted** until Klaus completes the live gate. The future implementation must
append its own `VT-` entry to `VACATION_TEST_BACKLOG.md`; this O0 planning
contract does not create a candidate backlog item by itself.

## Explicit owner gates that remain open

| Gate | Why O0 does not decide it |
| --- | --- |
| Exact deployment destination IDs, labels, and administered roots | They are host configuration, must be supplied and validated for the real controlled machine, and are never browser defaults. |
| O1 first-UI acceptance | Only Klaus can judge the understandable workflow and complete the live create/verify/recovery/restore/failure walkthrough. |
| Published-backup deletion or retention | Excluded from O1; it needs a separately recoverable owner-only contract. |
| Restored-copy activation/cutover | Excluded from O1; it needs stopped-writer, reauthentication, security rotation, rollback, and its own acceptance. |
| O2 remote host, identity, HTTPS/proxy trust, and network exposure | Remote operation is not implied by local backup and remains blocked by O1 UI acceptance. |
| O3 phone hierarchy and real-device acceptance | The first desktop backup UI is not a mobile-completion claim. |

No unresolved owner choice above changes the O1a backend contract. If actual
implementation reveals that one does, O1 must stop rather than choose a hidden
default.

## D0 verification record

- Remote `main` was reverified at
  `f31a0c2df962b4747ade6119ee6850e40e888186`; it is 20 commits ahead of and
  zero commits behind required merge commit
  `03e3b05f4e947703555c2c8f56e373ce30886290`.
- The contract was derived from the actual schema-v13 SQLite/CAS writer,
  backup, verification, restore, admin, server-startup, JSON-mode, listener,
  Origin/CSRF, and worker seams rather than from a proposed implementation.
- `git diff --check`, the repository Markdown-link check, and the Studio
  JavaScript syntax check pass on the D0 source candidate.
- An independent adversarial security/architecture review ended `GO` after
  the shared quarantine guard, platform-specific durable publication, and
  launcher-secret/session boundaries were made explicit. It found no remaining
  contradiction, hidden authority, or implementation blocker.
- O0 changes documentation only. It adds no route, UI, migration, listener,
  worker, filesystem effect, backup, restore, or authority.

## O0 acceptance and next boundary

O0 is complete when this contract and the linked current authorities agree,
the D0 documentation checks pass, and an independent security/architecture
review finds no unresolved contradiction against the actual v13 code.

That completion authorizes only the next coherent O1a backend candidate. O1a
must remain **implemented candidate — not user accepted** and cannot claim the
backup product gate. O1b then provides the required first UI and automated
browser evidence, but still stops for Klaus at the live user-acceptance gate.
O2 remote service work remains blocked until that acceptance.

## Safe rollback

O0 has no runtime or data effect. Reverting it is a documentation revert.
Future O1 rollback must stop worker intake, drain or safely interrupt active
operations, preserve the external control ledger and every published backup or
restored copy, and remove no user data automatically. No O1 rollback may
downgrade workspace schema v13, delete a backup, remove quarantine, activate a
copy, or change the active workspace.
