# A1.7 processing-adoption read projection status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

This separately classified L3 prerequisite implements the minimal human-safe,
read-only projection required by the frozen
[`A1_7_STATE_CONTRACT.md`](A1_7_STATE_CONTRACT.md). It does not implement the
A1.7 browser surface. The visible product candidate remains pending and, when
implemented, must stop at **Waiting for your review** with the explicit label
**implemented candidate — not user accepted**.

## Bounded result

The application now exposes an exact versioned read port and public DTO for one
project/task pair. The SQLite adapter closes the complete declared task branch,
every immutable processing-result adoption Aggregate and CommitResult, the
cumulative private adoption heads, exactly two retained artifact roles, and all
stored descriptor/evidence fingerprints before returning data. It requires the
exact supported SQLite schema v13; an incomplete branch, stale task head,
unknown older/newer schema, or semantic mismatch fails closed and cannot become
an empty `NO_DRAFT` result.

The two additive loopback HTTP resources are:

- `GET /api/projects/:projectId/tasks/:taskId/processing-result-adoptions`;
- `GET /api/projects/:projectId/tasks/:taskId/processing-result-adoptions/:branchRevision/selected-output`.

A successful collection response contains only schema/project/task identity,
`availability: AVAILABLE`, and ascending immutable adoption entries. Each entry
contains the branch revision and commit time, create/update meaning, DRAFT Asset
identity/version/pixel facts, a server-generated same-origin preview resource,
allowlisted plain-language correction guidance, and unresolved ProcessingResult
warning guidance. `AVAILABLE` with an empty array means only `NO_DRAFT`.
Read/integrity failure is a fixed redacted non-2xx error, never an empty array.

The preview resource re-closes the same project, task, revision and exact
`selected-output` role, requires LIVE non-GC metadata, and streams only PNG bytes
already read and verified through a held no-follow CAS handle. The existing Main
`hasProjectReference` rule is unchanged: a private adoption preview remains
available through this task-scoped route while the generic project artifact
route continues to deny it.

## Compatibility and authority

This candidate adds no command, grant/scope, HostBinding, MCP tool/resource,
migration, startup semantic write, retention root, Main/Asset-Library projection,
pixel operation, task review decision, merge path, warning disposition,
lifecycle transition, finalization, materialization, repository write,
publication, or release action.

The following remain exact:

- legacy command/scope definitions: 33/30;
- MCP discovery: 19 tools/four templates without a task, 30/five for a matching
  legacy task, and explicit Authoring-v2 31/six;
- SQLite schema v13 and portable bundles v1-v3;
- Numberdroid capability profile v1/v2 fingerprints and all existing Main,
  task-review, recovery, backup and private runtime boundaries.

Grant/Binding/actor execution identity, command/idempotency/correlation identity,
raw ledger/result documents, CAS digests/URIs/paths, fingerprints, stacks,
secrets, unsanitized errors and action/permission claims are excluded from the
browser DTO. Foreign expected-code errors are rewritten with fixed public copy;
hostile errors, proxies, accessors, sparse arrays, Promise subclasses and
thenables cannot widen the projection or execute through its exact port.

## Verification

Local candidate evidence on 2026-08-29:

- full Studio suite under Node 24.19.0: **535 passed, 0 failed**;
- `npm run check`: **152 JavaScript files passed**;
- syntax-checker self-test: passed;
- production-adapter evidence: `VERIFIED`, protected source-manifest hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- focused evidence covers empty success, ordered create/update history, deep
  immutable allowlists, known/generic correction labels, ProcessingResult
  warnings, GC/non-LIVE preview fallback, lost-response replay visibility,
  complete-ledger removal, branch/head tamper, v12/v14 rejection, cross-project/
  task/revision isolation, Main-reference isolation, held-handle path replacement,
  physical CAS corruption, fixed public errors, no durable GET effects, and
  production startup wiring.

Automated evidence and source integration cannot satisfy the deferred Klaus
visual/live gate. `VT-011` is created only after the separate bounded visual
candidate exists; until then A1.7 and A1 remain incomplete.

## Safe rollback

Source rollback is a focused revert of this additive application/persistence/
HTTP projection. There is no migration or new persisted state to downgrade or
repair. Existing schema-v13 workspaces, adoption rows, CAS objects, task ledgers,
HostBindings, Grants, backups and portable bundles remain unchanged.
