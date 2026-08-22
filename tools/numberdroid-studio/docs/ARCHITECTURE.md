# Numberdroid Studio — Architecture

## 1. Architectural intent

Numberdroid Studio is a local authoring product with multiple clients, not a collection of editor scripts. A single application core owns semantic commands, policy evaluation, validation, revisions, and jobs. The visual app, MCP server, CLI, and future remote API are adapters to that core.

The architecture protects three future moves:

1. extraction from the Numberdroid repository into a standalone application;
2. replacement or addition of presentation and transport layers without changing domain behavior;
3. extension from static assets to animation and from one designer to collaborative review without changing stable identities.

## 2. Context and dependency boundary

```text
Human ──> Studio UI ─────────────┐
                                │
Agent ──> MCP server ───────────┼──> application commands/queries
                                │              │
Automation ──> future CLI/API ──┘              ├──> domain policies
                                               ├──> revision/event transaction
                                               ├──> validation and jobs
                                               └──> persistence ports
                                                        │
                                             SQLite + artifact CAS
                                                        │
                                         Numberdroid adapter (explicit export)
                                                        │
                                      Level Compiler / repository / GitHub
```

Dependency direction always points inward:

```text
apps and transports -> application -> domain
infrastructure adapters -> application/domain ports
numberdroid-adapter -> versioned Studio ports + Numberdroid contracts
```

The domain and application packages MUST NOT import any UI framework, MCP SDK, database driver, image library, Git provider, or Numberdroid module.

## 3. Package topology

Checkpoint 1 is accepted. Its actual transitional topology is:

```text
apps/studio-server       one-writer local service plus visual shell
apps/studio-mcp          official MCP stdio host and private service bridge
apps/studio-admin        migration, integrity, backup, and restore CLI
packages/domain          pure contracts, validation, and command catalog
packages/application     shared command/query and authorization core
packages/persistence     SQLite/CAS plus protected JSON migration adapter
packages/preview         deterministic audited PNG crop processor
packages/mcp-server      semantic catalog and official MCP adapter
fixtures + scripts       deterministic evidence and verification
```

SQLite/content-addressed persistence and the official MCP transport are the accepted operational path. Checkpoint 2A added source intake/review and its audit/recovery tables. Accepted Checkpoint 2B adds the preview package, durable atlas jobs, job resources, and an in-process worker without changing the inward dependency boundary. Checkpoint 2C asset-library planning and implementation are authorized but not yet implemented or accepted. The JSON adapter remains only for protected 1A regression and migration. The combined `studio-server` UI/service/worker process is an accepted transitional packaging choice, not the final standalone packaging model.

The sections below describe the target topology as checkpoints introduce it. A named target package is not implemented merely because it appears in this document. In particular, `apps/studio-ui`, `apps/studio-service`, and `packages/numberdroid-adapter` do not yet exist as working packages; their current responsibilities remain in the combined server or are deferred.

### `apps/studio-ui`

Visual production board, source/cutter/library workspaces, room canvas, inspectors, validation, revision diff, and agent activity. It sends versioned command DTOs and reads projections/resources. It never opens SQLite or edits project files directly.

### `apps/studio-service`

Owns the local process lifecycle and is the sole writer. It hosts application services, transactions, background workers, static/artifact delivery, and local client endpoints. In a packaged desktop product it remains a distinct logical service even if shipped in one binary.

### `packages/domain`

Entities, value objects, lifecycle transitions, capability vocabulary, invariants, and domain events. Pure and deterministic.

### `packages/application`

Command/query handlers, authorization, unit-of-work orchestration, revision service, validation coordinator, job orchestration, idempotency, and ports. All clients use this package.

### `packages/persistence`

SQLite repositories, migrations, transaction implementation, event/revision storage, CAS implementation, projection rebuild, backup, bundle import/export, and garbage-collection tooling.

### `packages/preview`

Checkpoint 2B implements the deterministic exact-PNG crop kernel in this package. It validates and decodes bounded non-interlaced 8-bit RGB/RGBA PNG input, verifies chunk order and CRC, rejects unsupported transparency chunks, crops exact source pixels, and emits a processor-owned canonical RGBA PNG whose digest and byte size are deterministic. It consumes artifacts and semantic models through ports; it does not decide semantics from pixels. Thumbnailing and compositing remain later work.

The preview projection also owns deterministic Asset Library card states: resolved image, processing, missing artifact, unsupported media, and load failure. Each state has a stable kind-aware fallback descriptor so the UI never has to infer meaning from a failed image element or expose a filesystem path.

Apps and transport infrastructure host configured generation-provider adapters behind an application port. Provider credentials and network calls remain outside the domain; a generation job records the provider/model response, prompt/seed/options, cost evidence where available, and immutable output artifact before exposing it for review.

### `packages/mcp-server`

Protocol transport plus semantic tool/resource mapping. The stdio bridge does not open SQLite or the CAS directly. It registers a short-lived pending host over a raw loopback pairing socket that browsers cannot speak, starts MCP discovery without authority, and receives a server-minted opaque `HostBinding` only after matching human approval in the Header panel. It then calls the running one-writer Studio service over the private loopback bridge. Only a digest of the credential is stored. On every call the service resolves the immutable binding, reloads its current grant, and injects actor/task/branch/grant execution context before application dispatch. Protocol connection state, client envelope metadata, and tool arguments are not authorization. This package contains no authoring rules.

### `packages/numberdroid-adapter`

The only package allowed to know Numberdroid repository layout, Level Spec, compiler invocation, runtime asset locations, naming conventions, source-art paths, and exact-fit/tileset export forms. It converts an immutable Studio export snapshot into a deterministic candidate and imports compiler findings into the Studio finding model.

### `fixtures`

Small deterministic project bundles, images, expected slices, command/event histories, and Numberdroid adapter golden outputs shared by unit, integration, UI, MCP, and contract tests.

### 3.1 Protected Checkpoint 1A baseline

The user visually accepted the Checkpoint 1A shell on 2026-08-21. Its navigation, information hierarchy, project/revision/activity visibility, demo command outcomes, and host-injected authority behavior are now regression inputs, not disposable scaffolding.

Checkpoint 1B completed that infrastructure substitution behind the existing application ports and was accepted on 2026-08-21. The protected source commit, fixture, expected revision/activity counts, migration parity record, reproducible capture workflow, and exact visual evidence run/digest/viewport record are retained. The 26 screenshot bytes are currently only in a retention-limited Actions artifact; permanent screenshot goldens have not been published. The 1A application remains runnable against a copied frozen JSON data directory. Later checkpoints may build on the approved Header Agent access selector and card preview/fallback but must not silently redesign the accepted shell. Any broader visual change returns to a user checkpoint.

## 4. Domain model

| Aggregate / entity | Responsibility and identity rule |
| --- | --- |
| `Project` | Root scope for content, configuration, branches, and adapter binding. Stable ID is independent of folder name. |
| `Artifact` | Immutable binary or text blob in CAS with digest, media type, size, dimensions where applicable, and lineage. URI is digest-based. |
| `GenerationRecord` | Prompt/seed/provider/model/options/reference provenance. References input/output artifacts; approval is separate. |
| `AtlasDefinition` | Source artifact plus explicit integer extraction rectangles and slice settings. Rectangles are authoritative; a grid is only a proposal convenience. |
| `Asset` | Stable semantic identity for a `surface`, `prop`, or `item`, with versions of imagery and metadata. Export names are aliases, not identity. |
| `AnimationClip` | Reserved V1 identity; V2 ordered frames, timing, looping, anchors, and events attached to an asset. |
| `RoomArchetype` | Reusable room/hallway intent, dimensions or ranges, connector requirements, allowed vocabulary, and governing rules. |
| `RoomVariant` | Concrete layers and placements that reference assets by ID and record a validation/finalization lifecycle. |
| `LevelGraph` | Stable room/hallway nodes, connectors, relationships, and layout references. Enemy route data is intentionally absent. |
| `ValidationFinding` | Stable rule result with severity, target/location, message, disposition, validator version, and evidence. |
| `Revision` | Immutable DAG node containing parents, command/event range, actor, timestamp, summary, and projection/content hashes. |
| `AgentTask` | Human-defined objective and bounded branch context; links grants, jobs, activities, budget use, and result disposition. |
| `Grant` | Human-minted authority scoped by actor/task/project/branch/capabilities/objects/budget/expiry. Immutable; revocation is a new event. |
| `Job` | Durable long operation with input snapshot, state, progress, events, cancellation, attempts, and result artifacts. |
| `ExportSnapshot` | Immutable closure of exact project revisions, referenced artifacts, adapter/version/options, findings, and manifest hash. |

Stable IDs MUST not encode a mutable display name, file path, atlas coordinate, room position, or revision. Human-readable slugs and adapter export keys are versioned aliases with uniqueness rules.

## 5. Orthogonal lifecycles

A frequent source of workflow ambiguity is treating several kinds of approval as one boolean. Studio keeps these axes separate.

### Source/artifact lifecycle

```text
IMPORTED or GENERATED -> REVIEWED -> APPROVED_SOURCE -> SUPERSEDED
                     \-> REJECTED
```

### Asset lifecycle

```text
DRAFT -> METADATA_COMPLETE -> VALIDATED -> FINAL
  ^            |                 |          |
  └──────── revision after change ──────────┘
```

### Room/level lifecycle

```text
DRAFT -> VALIDATED -> FINAL -> EXPORT_CANDIDATE
  ^          |          |              |
  └──── new draft lineage after edit ──┘
```

### Review disposition

```text
PENDING | USER_APPROVED | USER_REJECTED | AUTO_ACCEPTED_BY_POLICY
```

Review disposition does not replace lifecycle state. In particular, an asset may be valid but not final, an approved source may contain no accepted slices, and a policy-accepted agent command is not user-approved.

### Publish lifecycle

```text
NOT_EXPORTED -> CANDIDATE_BUILT -> VERIFIED -> MATERIALIZED -> COMMITTED -> PUBLISHED
```

Each transition is a separate command with separate authorization and evidence.

## 6. Command and query model

All mutations use a common command DTO plus a separate trusted execution context. An MCP caller cannot assert or replace actor, task, grant, branch, or correlation fields through tool arguments. The accepted Checkpoint 1 shapes are:

```json
{
  "schemaVersion": 1,
  "commandId": "cmd_...",
  "idempotencyKey": "client-unique-key",
  "type": "asset.define",
  "projectId": "project_...",
  "baseRevision": 7,
  "expectedVersion": 7,
  "dryRun": false,
  "payload": {}
}
```

```json
{
  "actor": { "id": "agent_...", "kind": "agent", "displayName": "Atlas Agent" },
  "taskId": "task_...",
  "grantId": "grant_...",
  "branchId": "branch_...",
  "correlationId": "corr_..."
}
```

Human UI commands use the same command DTO; a locally authenticated human context supplies its actor and authorization. The MCP host injects its bound agent/task/grant context after tool-input validation. System commands identify both the initiating actor and the system executor. The application API separates these values as `execute(commandDto, trustedExecutionContext)`: `commandDto` contains no actor, task, grant, branch, binding, or issuer field. Application handlers MUST reject authority fields that arrive inside an untrusted command or payload.

### Agent access is a policy projection, not authority

The persistent Header Agent access control is a human-facing posture selector. Its choices (`Off`, `Read only`, `Propose in draft`, the compact accepted label `Scoped run`, and `Custom…`) request a service operation; they are not local permission flags. `Scoped run` maps to the semantic mode `Execute scoped task` / `execute_scoped`. Checkpoint 1B implements only Off/read/scoped execution. Draft proposal is fail-closed until the revision model has isolated branch heads, and Custom is fail-closed until the detailed editor ships. The local service verifies the loopback human UI request, creates/selects/revokes the concrete task grant as allowed, then returns a redacted `EffectiveAgentPolicy` projection containing state, project/task/branch, capability and object-scope summary, expiry, budget, and job count. A separate section lists redacted pending and authorized MCP hosts. Browser configuration contains only command, project, service URL, and loopback pairing endpoint; it never contains a HostBinding token or grant ID.

The UI renders only that projection. It cannot forge an `ACTIVE` state, attach a grant to an MCP invocation, or widen a policy by changing client state. On service disconnect it renders `SERVICE_UNAVAILABLE`, which carries no authority. `EXPIRED`, `REVOKED`, and `DENIED` are likewise inactive. Any capability/time/budget expansion requires a warning/confirmation based on the concrete grant diff rather than a coarse mode rank; finalization/export remain separate commands and publish is never a header posture.

Application command flow:

1. Parse and validate the versioned DTO.
2. Verify the trusted host execution context and load the referenced immutable grant.
3. Authorize command, object scope, branch, budget, and expiry.
4. Check idempotency and optimistic concurrency.
5. Load aggregates at `baseRevision` inside the unit of work.
6. Evaluate domain invariants and calculate events.
7. Run required synchronous validation; later checkpoints enqueue expensive validation as a durable job only where finalization rules permit.
8. On dry run, return proposed events/diff/findings without commit.
9. Atomically append events, update projections, consume grant budget, create a revision, and record activity.
10. In later checkpoints, publish post-commit notifications and job work.

An exception before commit changes nothing. A repeated idempotency key with the identical payload returns the original result; reuse with a different payload is an error.

Queries are side-effect-free and read versioned projections. Strongly consistent reads can request a revision; UI list views may use current projections but MUST display their revision.

## 7. Persistence

### SQLite

The local service owns one SQLite database per workspace or one database with explicit project isolation. The initial default is one workspace database in WAL mode with foreign keys enabled, a bounded busy timeout, one authoritative writer, and explicit schema/user versioning. Live backups use the SQLite backup API or a documented checkpointed procedure; copying only the main file while WAL writes are active is forbidden.

One command transaction includes events, revision and parent links, aggregate versions, projection updates, activity, idempotency result, command-required findings, and grant budget consumption. Migrations run transactionally where SQLite permits; multi-phase migrations use explicit durable states and recovery instructions. The service does not expose a writable API until migration and integrity checks complete.

Accepted Checkpoint 1 tables include `projects`, `revisions`, `revision_parents`, `activity_events`, `aggregate_versions`, `projections`, `idempotency_records`, `grants`, `migration_runs`, `artifacts`, `artifact_references`, `cas_gc_marks`, `host_bindings`, and `human_agent_access_operations`, plus the migration ledger maintained by the runner. Accepted schema v6 adds `source_intakes` and the original final-attempt ledger. Accepted schema v8 adds `jobs`, `job_events`, immutable creator authority and output-byte accounting, and extends `agent_attempts` with atomic `AUTHORIZED` control records. Migration 0007 is pinned to `aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9`; migration 0008 is pinned to `2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730`. Branch heads and durable findings remain later work. Projection tables are rebuildable from events plus verified snapshots.

SQLite is an infrastructure adapter. Tests use a conforming in-memory repository only where the same contract suite also runs against SQLite. Fault injection covers every commit boundary, restart/recovery, WAL checkpoint behavior, busy writers, concurrent readers, backup/restore, and projection rebuild/hash comparison.

### Content-addressed store

Artifacts are immutable and addressed by SHA-256. Writes stream into a bounded same-filesystem staging area, enforce media/byte/image-dimension limits, calculate and verify the digest, durably close the file, then atomically rename it into a digest-sharded path. Existing digest content is verified/deduplicated rather than overwritten. Metadata is committed only after durable artifact placement. A failed database transaction may leave a quarantined/unreferenced blob, which explicit retention-delayed mark/sweep garbage collection can safely reclaim.

Logical URIs use `studio://` resources. Binary retrieval resolves to authenticated local artifact endpoints or resource links. Tool payloads never carry base64 images or local paths. Reads fail closed on missing/digest-mismatched content; integrity audit, backup, and restore operate over the database/CAS pair and verify their manifest.

### Checkpoint 2A source intake and audit

The human loopback upload streams through CAS with an intake-specific maximum of 16 MiB and 4096×4096. A `source_intakes` row and temporary `source_intake` artifact reference keep verified bytes reachable while the semantic commit is pending. One SQLite transaction claims the staged row, creates the revision/event/projection/idempotency records, installs canonical `source` and permanent `source_lineage` references, removes the temporary reference, and charges agent artifact bytes. Explicit idempotent abandonment removes only the temporary reference; shared CAS bytes remain subject to retention-delayed garbage collection.

V2 source projections preserve complete provider-neutral provenance and an explicit lifecycle. Human uploads cannot carry generation metadata. Imported-generation records require provider/model/prompt but their bounded parameter tree rejects secret-like keys, local paths, and external URI values. Referenced artifacts must already be `LIVE` and referenced by the same project. Original preview is a read of the verified source CAS object, not a thumbnail or processing job.

`agent_attempts` stores only final `DENIED` or `FAILED` outcomes for mutation calls that reach the private execution bridge after a valid HostBinding resolves a trusted project/actor. It stores a safe project target, observed revision, semantic command identity when valid, stable error code, and allowlisted redacted details. Accepted commands remain in the semantic revision Activity ledger; there are no non-atomic `STARTED` or `COMMITTED` request rows. If a required attempt row cannot be written, the call fails closed. Pairing, missing/invalid bearer, and other pre-binding failures stay in operational security logs because there is no trusted project/actor to append.

### Checkpoint 2B atlas definitions and durable jobs

An `AtlasDefinition` is a versioned semantic projection over one approved PNG source. It contains exact safe-integer rectangles, explicit inclusion, optional local pivot, the only accepted padding policy (`preserve_exact_rect`), and optional one-to-one replacement of an expected prior slice version. Included rectangles are unique, in bounds, non-overlapping, limited to 64 entries and 67,108,864 aggregate output pixels, and rejected before job creation if one canonical output would exceed 16 MiB. A stable fingerprint binds the source dimensions, processor identity, and complete normalized rectangle list.

`atlas.define.rects` is a normal semantic revision. `atlas.preview.slices` precomputes the complete deterministic output-byte budget, then one SQLite transaction commits the semantic input revision and Activity together with one immutable `ATLAS_PREVIEW` job, its `QUEUED` event, creator actor/task/branch/grant coordinates, job-count and artifact-byte usage, and both semantic/job idempotency records. A replay cannot charge or enqueue again. A new definition/preview is blocked until the prior job has been applied or discarded so temporary results cannot become ambiguous.

The worker claims with a lease, revalidates the original agent grant/task/object scope and expiry/revocation, reads the source by expected digest, and processes immutable rectangles only. Each canonical output is published through one transaction that verifies current lease ownership and authority, installs exact artifact metadata and a temporary `job_output` reference, advances progress, and appends the job event together. This prevents an expired worker from publishing after another worker recovers the lease. Cancellation is cooperative at safe points; failures are reduced to stable codes and safe messages. Startup recovers expired work within the global three-attempt ceiling. Shutdown first stops new claims and awaits the worker's current loop before closing SQLite.

The state set is `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `APPLIED`, and `DISCARDED`. `FAILED` and `CANCELLED` can be retried with the same immutable input while the next attempt is at most three. A terminal unapplied job can be explicitly discarded, releasing every temporary output reference; an applied job cannot be discarded. There is no `WAITING_FOR_USER` state or job response operation in 2B.

`atlas.commit.slices` joins the job outputs to live CAS metadata and revalidates processor/source/fingerprint/input revision plus canonical digest, media type, dimensions, byte size, rectangle, and replacement version. One transaction creates stable slice heads/versions, appends the semantic revision and Activity, installs permanent `atlas_slice` references, removes temporary job references, marks the job `APPLIED` with the exact applied revision, and records idempotency. Cancel/retry/discard similarly commit the authorized attempt audit in the same SQLite transaction as the job transition.

Workspace integrity is state-specific: it validates input and applied revision semantics, atlas/source/fingerprint ownership, event sequence/state, exact output metadata, creator coordinates, and the allowed temporary/permanent CAS references for each state. A stale job reference is a finding. Backup now runs this complete semantic and CAS integrity check before opening a snapshot and copies the referenced CAS closure for that same database snapshot; backup is refused if the precondition fails or the closure changes.

### 1A JSON migration and rollback

Migration is copy-and-verify, never in-place conversion:

1. stop the 1A writer and copy its JSON directory to a dated protected baseline;
2. write a manifest containing source files/digests, Studio/schema version, project heads, aggregate/event/activity counts, and accepted fixture evidence;
3. migrate into a new SQLite database and CAS staging destination using a versioned idempotent migration ID;
4. verify identifiers, ordering, grant/revocation state, semantic projection hashes, findings, artifact references, and visible demo outcomes;
5. atomically switch the configured active-store pointer only after all checks pass;
6. retain the JSON baseline, accepted database/CAS evidence, and migration report permanently as regression and recovery evidence after 1B acceptance.

JSON and SQLite never run as concurrent authoritative writers. A failed migration leaves the active pointer untouched and can safely restart against the staged destination. Rollback preserves the SQLite/CAS state for diagnosis and returns to the frozen JSON baseline only through an explicit operator action. If 1B accepted writes occurred after cutover, the service first creates a verified recovery bundle/down-export; it never silently loses those revisions merely to make older code start.

C1A grant history is migrated for audit only. Every legacy grant is marked `LEGACY_UNBOUND` and cannot authorize a 1B call; the human must issue a new immutable 1B grant and create a new host binding. Unresolved legacy artifact URIs remain explicit `MISSING_ARTIFACT` findings and are never converted into invented CAS digests.

### Planned portable bundle

A portable project bundle is not implemented in Checkpoint 1. Its target contract contains a versioned normalized manifest, event/revision data or a portable projection with audit data, referenced CAS blobs, adapter configuration, and integrity hashes. Import verifies every digest before making the project visible. Bundles do not include secrets or machine-specific absolute paths.

## 8. Planned V1 revision DAG and multi-agent work

Checkpoint 1 creates a linear immutable revision sequence on the shared head and records a bound `branchId` only as authority metadata; isolated branch heads, merge commits, review disposition, and compensating reverts are not implemented. The target V1 model below adds a revision DAG: every accepted semantic command creates one revision node, or a documented batch command creates one revision for its atomic event set. Nodes have one or more parents. Branch heads are mutable pointers updated by compare-and-swap; revisions are immutable.

The default agent workflow is:

1. user creates an `AgentTask` from a known base revision;
2. the service creates a dedicated draft branch;
3. user mints a scoped grant for the task and branch;
4. agent reads resources and commits semantic changes to that branch;
5. user watches live activity and validation;
6. agent submits a review candidate;
7. user or an explicit policy accepts, rejects, requests changes, or merges;
8. merge creates a new validated revision with both parents when appropriate.

Two commands cannot silently update the same aggregate version. Different agents may make independent changes on separate branches. Semantic merge logic is aggregate-specific; unresolved conflicts are first-class findings, not file conflict markers.

Revert emits compensating semantic events on a new revision. History, attribution, and prior exported snapshots remain intact.

## 9. Implemented atlas jobs and expanded observability

Checkpoint 2B implements durable jobs for deterministic atlas preview slicing. The original-source preview remains synchronous; generation providers, general derivative processing, validation, bundles, and export do not gain jobs by implication. Every atlas job records its exact semantic input revision, definition fingerprint, source digest, normalized rectangles, processor identity, creator authority, output-byte reservation, progress, events, and artifact metadata so a retry cannot switch to a newer project head.

The implemented state set is `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `APPLIED`, and `DISCARDED`. State transitions append monotonically sequenced events. Cancellation is cooperative and visible; atomic metadata/reference/progress and semantic-apply windows are not interruptible. Retry is explicit, uses the same immutable input, and is capped at three total attempts. Discard is explicit for terminal unapplied work and releases temporary output references. Accepted 2B deliberately has no `WAITING_FOR_USER` state or response command.

The human UI and authorized agents can read the same redacted job projection, including progress/events and same-origin output preview links while temporary results are live. Job operations are attributed to `job` targets. For an agent, the original task/binding authority and current grant remain mandatory, and each authorized cancel/retry/discard record is atomic with the transition. Denied and failed bridge attempts continue to use final redacted attempt records. No projection/log/attempt contains tokens, grant IDs, prompts, raw idempotency keys, machine paths, stack traces, unsanitized worker messages, bitmap bytes, or base64 payloads.

## 10. Validation architecture

Validators are pure rule functions where possible. They consume a versioned snapshot and emit `ValidationFinding` values. Rule IDs are stable and namespaced, for example `studio.room.overlap` and `numberdroid.exact_fit.mismatch`.

Validation layers:

1. DTO/schema validation;
2. domain invariants at command time;
3. cross-aggregate Studio validation;
4. adapter validation for Numberdroid semantics;
5. canonical Numberdroid Level Compiler validation for export candidates.

Pixel/image analysis produces suggestions and quality findings, not authoritative semantic state. Full compiler validation is run on every accepted edit when the existing Numberdroid authoring contract requires it; performance optimization may cache inputs but MUST not weaken the result.

## 11. Planned deterministic export boundary

The Numberdroid adapter and its golden fixtures are not implemented until Checkpoint 5. Its target flow begins when the application freezes an `ExportSnapshot`; the adapter then:

1. verifies required finalized assets/rooms and artifact integrity;
2. maps stable Studio identities to deterministic Numberdroid semantic IDs and paths;
3. materializes a candidate in a temporary or dedicated export directory;
4. invokes adapter and Level Compiler validation;
5. writes a manifest containing every logical path, digest, provenance reference, adapter version, and validation result;
6. exposes the candidate for visual/user verification;
7. only after a separate authorized command, materializes or publishes it to the repository.

The adapter must preserve Numberdroid rules: runtime files under the runtime public tree, authoring/provenance under the source-art tree, semantic metadata rather than pixel-inferred topology, exact-fit macro dimensions, stable IDs/subseeds, and canonical compiler validation.

GitHub integration receives files from a verified export manifest. It is downstream of authoring and cannot mutate Studio state except to record publication evidence.

## 12. Security and trust boundaries

- The accepted local service is loopback-only and hard-refuses non-local bind addresses; no configuration may widen that listener.
- MCP stdio is the initial 1B transport. Future network transports require per-call authenticated host context, origin controls, and TLS at the deployment boundary.
- The 1B HTTP service refuses non-loopback bind addresses. Remote/team access must arrive through a separately authenticated deployment adapter; it cannot expose the local single-user API by changing the bind host.
- Local host approval uses a raw loopback pairing listener rather than an HTTP/browser route for credential delivery. The verification request is in memory, expires quickly, is single-use, and disappears on service or host disconnect.
- HostBinding coordinates never change. Any grant posture rotation revokes bindings before a new immutable grant can be host-bound; stale tokens cannot acquire new rights.
- Grants are immutable, signed or server-authenticated capabilities identified by opaque IDs. Only authenticated human roles can mint or widen them.
- The Header Agent access control displays service-returned effective policy; its DOM/client state, selected label, and browser storage are never authorization inputs.
- Tool payloads cannot name arbitrary filesystem paths. Imports use approved file handles/roots; exports use configured destinations and manifest-relative paths.
- Archive and image processing defends against traversal, decompression bombs, oversized dimensions, malformed codecs, and symlink escapes.
- Provider credentials remain in a local secret store and never enter project bundles, events, prompts returned to ungranted readers, or MCP logs.
- Read resources enforce project and object scope, not only mutation tools.
- Publish is a separate high-risk capability with short expiry and a complete preview/manifest.

Checkpoint 1 threat-focused tests cover its implemented grant/HostBinding forgery and widening paths, expired/revoked grants, cross-project references, stale replay, idempotency collisions, artifact/path validation, size/hash failures, cancellation at the atomic boundary, and unauthorized reads. Checkpoint 2B extends that suite to immutable job authority, cross-task controls, retry ceilings, lease recovery/stale-worker races, cancellation/discard reference release, sanitized failures, atomic output promotion/apply/audit, shutdown quiescence, state-specific integrity, and backup snapshot consistency. Archives, providers, branch review, export, and publish escalation remain later gates.

## 13. Standalone extraction

The folder is extraction-ready when:

- package imports use Studio package names/ports, never paths above this directory;
- root repository scripts merely delegate into this folder;
- all Numberdroid knowledge is behind adapter interfaces and fixtures;
- data paths are supplied by configuration, not inferred from repository location;
- the UI and service can run with a generic/no-op game adapter;
- CI for this folder can run independently;
- licenses and third-party notices are local to the product;
- a standalone repository can preserve commit history with a subtree split.

Extraction should require changing workspace/package publishing configuration, CI wiring, and adapter installation—not entity IDs, database schemas, command contracts, or UI workflows.

## 14. Architecture acceptance tests

At each checkpoint, reviewers MUST be able to demonstrate the checks that correspond to capabilities implemented by that checkpoint. Checkpoint 1 proves package isolation, UI/MCP command equivalence for its implemented commands, SQLite/CAS migration and recovery, protected visual behavior, and fail-closed authority. Accepted 2A additionally proves atomic staged-intake claim/abandon, provenance/lineage validation, source lifecycle, exact original preview, schema-v6 recovery, bounded MCP authority/budgets, and redacted final attempt audit. Accepted 2B additionally proves exact/deterministic PNG crops, stable remap semantics, atomic durable-job creation/output/apply/control audit, authority revalidation, bounded recovery, state-specific integrity, snapshot-consistent backup, and equivalent UI/MCP job operation. Authorized 2C must add stable slice-bound asset versions, typed validation and bounded batch equivalence, portable-bundle verification, and corresponding recovery/evidence before it can be presented for acceptance. Branch review/merge and Numberdroid export checks below are later-checkpoint targets.

- a forbidden import test prevents core packages from referencing UI/MCP/SQLite/Numberdroid;
- the accepted 1A visual/demo baseline remains reproducible, and approved additive UI changes do not alter its command outcomes;
- UI and MCP produce equivalent events for the same command fixture;
- repository contract tests pass against in-memory and SQLite adapters;
- JSON-to-SQLite migration is idempotent, preserves semantic/event/activity hashes, leaves its source untouched, and can fail before cutover without changing the active store;
- crash/fault injection cannot create a revision without its events or vice versa;
- stale and duplicate requests have deterministic outcomes;
- resource authorization prevents cross-project reads;
- artifact digest and bundle integrity failures are detected before use;
- every Asset Library card renders either its authorized preview or a stable accessible fallback without exposing local paths;
- the real Family Hygiene bytes survive source intake, original preview, owner review, and restart with the same hash/dimensions; separate schema-v6 fixtures prove backup, restore, lineage, intake, attempt, and integrity preservation;
- a source-intake fault cannot claim the intake, charge artifact bytes, or create revision/source/lineage references independently;
- denied/failed bound-agent mutations append one redacted final Activity record, while an audit-write fault fails the attempted call closed;
- the exact Family Hygiene rectangles produce four canonical 1,548,341-byte outputs with the pinned digests in `CHECKPOINT_2B_STATUS.md`, and a restart preserves the same slice heads and `APPLIED` job;
- an atlas preview fault cannot independently commit its semantic revision, job, budget, initial event, output metadata/reference, progress, applied slice revision, or authorized job-control audit;
- retry never exceeds three attempts or switches input revision; revoked/expired/cross-task authority cannot claim, publish, cancel, retry, discard, or apply the job;
- cancellation, failure, discard, recovery, and apply retain exactly the references permitted for their state, and graceful shutdown awaits the active worker before SQLite closes;
- official audit/job-ready MCP discovery is exactly 15 tools and the two project/job resource templates; job results expose resource links rather than bitmap data, paths, or base64;
- a complete integrity pass is required before backup, and the backed-up database and CAS closure remain valid under concurrent terminal-job discard;
- once Checkpoint 4 implements task branches, an agent branch can be inspected, rejected, merged, and reverted without deleting history;
- once Checkpoint 5 implements the adapter, exports match golden manifests for stable fixtures;
- `AUTO_ACCEPTED_BY_POLICY` never appears as `USER_APPROVED`.
