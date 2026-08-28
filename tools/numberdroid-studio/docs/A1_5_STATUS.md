# A1.5 processing-result adoption persistence status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.5 is a non-visual L3 Domain/Application/Persistence candidate based on
verified `main` head `06ac195a26011e2e8c6e9b41b20521005da89094`. It implements
one private, branch-local, durable unit of work for the strict A1.4
`asset.processing-result.adopt` command. It repeats mutation-time authority,
capability, Asset, metadata, finding, CAS, idempotency, and budget checks and
commits one DRAFT processing Asset projection plus immutable lineage and two
artifact-retention roles. The command and scope remain unregistered and the
current Numberdroid profile remains unsupported, so no live task, public API,
MCP client, HTTP client, or UI can invoke this candidate. Automated tests,
source integration, and CI do not constitute Klaus's contract acceptance.

## Implemented scope

- `packages/domain/src/processing-result-adoption-commit.js` defines a strict
  schema-v1 immutable adoption Aggregate and CommitResult. The Aggregate closes
  the original command, trusted task-authority binding, freshly derived A1.3
  receipt and A1.4 plan, create/update metadata semantics, normalized findings,
  empty warning dispositions, exact processing lineage, both permanent
  artifact roles, one command charge, committing actor/time, and its own
  fingerprint. The CommitResult contains the durable coordinates and result
  fingerprints but deliberately has no `replayed` or authority field.
- The private application service accepts only the original A1.4 command, one
  strict trusted agent-task context, and an optional abort signal. It accepts no
  caller-supplied plan, receipt, evidence, owner decision, lifecycle decision,
  or persistence claim. Its only mutation dependency is an exact plain-object
  `studio.processing-result-adoption-atomic-store` v1 port. Native Promise
  responses are awaited without consulting caller-defined `then` accessors;
  invalid responses and unexpected dependency/corruption details are sanitized.
- Replay is ledger-first. The same task-branch idempotency key plus the same
  task-bound semantic fingerprint returns the original CommitResult
  byte-for-byte, including when a retry supplies a new, otherwise unused
  command ID. It performs no later clock, authority, capability, Asset, or CAS
  read and writes or charges nothing. The same key with different semantics
  fails `IDEMPOTENCY_CONFLICT`; a command ID already bound to another key or
  command fails `COMMAND_ID_CONFLICT`. Lost-response recovery is therefore a
  retry of the same key, not a second effect or a caller assertion.
- The SQLite store reads and closes the ACTIVE Task, active unrevoked Grant,
  trusted agent, non-main branch, current branch head, exact project and Asset
  object scopes, private scope, task/grant expiry, task/grant budgets, current
  branch usage, no-auto-accept policy, and same-project branch document before
  external capability or CAS work. The current branch usage is rederived from
  immutable branch commands; the two proposal-submit command families charge
  their exact item cardinality and this adoption charges exactly one.
- The capability dependency is selected for the exact project/revision and its
  complete manifest is validated against the command pin before CAS reads. The
  store holds verified no-follow CAS file handles and exact validated PNG bytes
  privately while its synchronous SQLite transaction repeats Task/Grant/head,
  capability-value, Asset identity/version, project-scoped registered-LIVE
  artifact metadata, physical descriptor, and findings checks. The fresh
  receipt, plan, Aggregate, and CommitResult are derived inside that mutation
  attempt; A1.4 output is never accepted as an executable input.
- One SQLite `BEGIN IMMEDIATE` transaction inserts the immutable task-branch
  revision and replay result, one normalized processing-adoption Aggregate,
  exactly two role-bearing artifact references (`recipe-input` and
  `selected-output`), the sorted private processing-Asset head projection, Task
  and embedded branch-Grant usage, and one timeline Activity. It advances the
  task head by compare-and-swap. Seven write-boundary fault points prove that a
  failure leaves none of those effects; a post-commit lost response resolves to
  the original result after reopen.
- Create persists a branch-local DRAFT processing Asset at versions `1/1`, with
  the explicit name, validator-normalized explicit-empty authored metadata,
  exact selected-output visual facts, eight deterministic missing-metadata
  `ERROR` findings, and no warning dispositions. Update creates Asset version
  `N+1`, resets it to DRAFT, preserves the prior name and authored metadata,
  recomputes visual facts/findings, and preserves metadata version `M` only for
  an equal fingerprint; otherwise it writes `M+1`. An A1 ProcessingResult
  `ERROR` still blocks adoption and unresolved ProcessingResult warnings remain
  fingerprint-bound rather than owner-dispositioned.
- Additive migration `0013_processing_result_adoptions.sql` creates exactly two
  STRICT branch-native tables with immutable normalized records and foreign
  keys to task-branch history and registered artifacts. Its pinned migration
  checksum is
  `af908897b489d24110dabbd1cad8754bd85959bfc744cf811b81c376b4603043`.
  Faults immediately before and after migration 13 leave a complete v12
  database and reopen resumes cleanly to v13.
- Private artifact references extend CAS retention and workspace-backup roots
  but do not satisfy project artifact authority checks. A later removal of a
  Main reference does not erase already committed private lineage or its CAS
  retention; a new adoption still requires a current Main project reference.
  Same-digest input/output persists two distinct immutable roles while one held
  physical CAS proof is sufficient for the mutation attempt.
- Deep integrity closes the Aggregate, CommitResult, normalized columns,
  branch revision/result/Activity, exact evolving private heads, canonical
  command charges, both evidence records, registered-LIVE descriptors, and
  physical PNG bytes. It detects missing or additional heads, either missing
  role, re-fingerprinted cross-field evidence tampering, physical corruption,
  usage drift, missing Aggregate/replay state, and forbidden MERGED processing
  tasks. Workspace backup and verification include private roots; read-only
  v12 snapshots remain supported and an unknown newer schema fails closed.
- Portable project bundles remain schema v1-v3 and deliberately omit
  CANCELLED/REJECTED private task state and private-only artifacts. Active tasks
  remain non-quiescent. An unexpected MERGED processing-adoption task fails
  export closed because current portable Asset schemas cannot represent its
  processing-specific lineage.

The pinned synthetic generic-profile v2 create fixture identities are:

- Aggregate fingerprint:
  `830e7e387347e527efc31062a7801c6cbbac1f13f72cc8616da0f256116b9dac`;
- complete canonical Aggregate SHA-256:
  `253e9fe8cbc8d0aa6c2c0ee847c424e94c2bbfbe44a40c4e991242c127eb66b5`;
- canonical CommitResult SHA-256:
  `0da632143b8adaec8e7100cf55d0abbf0a57b7ece1d36d8d605de3ec5cc920f4`.

These are synthetic contract fixtures, not Numberdroid capability, live
authority, user acceptance, review, merge, or product-workflow evidence.

## Atomicity and operational boundary

The all-or-none claim covers the complete SQLite mutation and an exact held
byte image of each already-existing immutable CAS object. A1.5 does not create
new pixel output and does not claim a joint filesystem/SQLite transaction. The
open handles protect the bytes used for validation through the SQLite commit,
while the two committed role references become the durable retention roots.
This candidate assumes the existing single authoritative SQLite writer and no
concurrent uncoordinated CAS garbage collector or external filesystem mutator.
GC, backup, restore, and adoption must run under the existing operational
single-writer/exclusive-maintenance discipline; adding a shared filesystem
writer lease and failure-atomic backup publication is separate infrastructure
work.

Migration 13 is forward-only. Operational rollback after a committed v13 write
is restoration of a verified pre-change workspace backup or a forward repair;
running older v12 code on a v13 database or deleting private lineage rows is not
a supported downgrade. Backup/restore retain their existing absent-destination
and coordinated-maintenance preconditions.

## Preserved compatibility

- `asset.processing-result.adopt` remains absent from the 33 registered command
  definitions and the private scope remains absent from the 30 accepted grant
  scopes. There is no StudioService or AgentTaskService dispatch route.
- Current Numberdroid capability profile v1 remains byte-identical at
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`
  and still fails A1.3/A1.5 capability checks closed.
- The only durable job kind remains `ATLAS_PREVIEW`; MCP discovery remains 19
  tools/four templates without a task and 30/five for a matching task. No MCP,
  HTTP, server, client, UI, browser flow, or visual evidence changed.
- CandidateManifest v1, EngineBridge v1, Numberdroid adapter/compiler goldens,
  CP2C Main `asset_versions`/`asset_heads`, `ExactSliceBinding`, accepted Asset
  proposals, project revisions/Activity, existing artifact-reference authority,
  portable bundle v1-v3 bytes, and accepted visual contracts remain unchanged.
  Schema v13 is one additive private persistence extension; v12 read-only
  backup verification remains supported.

## Explicitly not implemented or authorized

- no command/scope registration, grant issuance, Numberdroid profile v2,
  production capability selection, public dispatch, job, MCP resource/tool,
  HTTP endpoint, UI state, or live workflow;
- no Main/CP2C Asset version or head, project revision, Main Activity,
  CandidateManifest, repository, materialization, publication, or release write;
- no owner fallback, owner decision, auto-accept, review item, merge, warning
  acceptance, lifecycle promotion, finalization, or replacement/remap authority;
- no reuse of CP2C `ExactSliceBinding`, new portable bundle schema, new image
  operation, provider call, output generation, or end-to-end satisfaction of
  `IMG-006`;
- no claim that automated fault, restart, integrity, backup, Windows, or CI
  evidence answers Klaus's product-contract decision.

A1.6 may expose this private seam only through separately versioned,
feature-gated Authoring-v2 MCP contracts with newly pinned discovery counts. It
must still grant no owner review, merge, lifecycle, materialization, or release
authority. A1.7 remains the separate visual review/correction candidate and
live Klaus gate.

## Verification

Frozen local candidate verification on 2026-08-28:

- focused A1.3-A1.5, SQLite, migration, fault, integrity, backup, and
  compatibility suite: **111 passed, 0 failed**;
- full Studio suite under Node 24.19.0: **435 passed, 0 failed**;
- `npm run check`: **137 JavaScript files passed**;
- production-adapter evidence verification: `VERIFIED`, with protected source
  manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- repository Markdown link check: **55 links, 0 failures across 191 files**;
- classifier self-test, link-checker self-test, Studio syntax-checker self-test,
  migration checksum verification, and `git diff --check`: passed.

Independent Security/Authority, Domain, CAS/Atomicity, Compatibility, and QA
actual-diff reviews all reported GO. The Security review found one hostile
thrown-value sanitization gap before freeze; the fixed boundary rejects proxies
before reflection and reads allow-listed `StudioError` codes only from a direct
own data descriptor. Sync and Promise-rejection Proxy/Accessor regressions are
included in the final 111/435 counts. The exact reviewed candidate diff
frozen immediately before recording this identity line had binary diff SHA-256
`3baa14f4bdf712963b2c20da288d0768b5809839cacf6a774474457b572fc5bd`.
The implementation source commit is
`cfa731c751b07b207c7497024f8be1ad3e09f023`. Exact changed-path
classification set docs, Studio, Studio visual, and Studio Windows true; docs
only, root, root visual, Pages, and full remained false. Implementation
PR/merge and pre-/post-merge Actions evidence are recorded after integration.
Those facts remain pending here and do not constitute Klaus's contract
acceptance when added.
