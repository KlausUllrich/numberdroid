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

Checkpoint 1A already separates `packages/domain`, `packages/application`, `packages/persistence`, and `packages/mcp-server`. The development server and JSON adapter remain transitional, while the shared command boundary and host-injected authority are proven. Checkpoint 1B introduces SQLite/content-addressed persistence and the official MCP transport without changing those inward-only boundaries. The transitional JSON store is never an accepted persistence implementation for the asset slice.

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

Deterministic image slicing, thumbnailing, compositing, overlay data, and visual QA projections. It consumes artifacts and semantic models through ports; it does not decide semantics from pixels.

The preview projection also owns deterministic Asset Library card states: resolved image, processing, missing artifact, unsupported media, and load failure. Each state has a stable kind-aware fallback descriptor so the UI never has to infer meaning from a failed image element or expose a filesystem path.

Apps and transport infrastructure host configured generation-provider adapters behind an application port. Provider credentials and network calls remain outside the domain; a generation job records the provider/model response, prompt/seed/options, cost evidence where available, and immutable output artifact before exposing it for review.

### `packages/mcp-server`

Protocol transport plus semantic tool/resource mapping. The stdio bridge does not open SQLite or the CAS directly: it calls the running one-writer Studio service over a private loopback/IPC boundary using a server-minted opaque `HostBinding` credential. Only a digest of that credential is stored. On every call the service resolves the binding, reloads the current immutable grant, and injects actor/task/branch/grant execution context before application dispatch. Protocol connection state, client envelope metadata, and tool arguments are not authorization. This package contains no authoring rules.

### `packages/numberdroid-adapter`

The only package allowed to know Numberdroid repository layout, Level Spec, compiler invocation, runtime asset locations, naming conventions, source-art paths, and exact-fit/tileset export forms. It converts an immutable Studio export snapshot into a deterministic candidate and imports compiler findings into the Studio finding model.

### `fixtures`

Small deterministic project bundles, images, expected slices, command/event histories, and Numberdroid adapter golden outputs shared by unit, integration, UI, MCP, and contract tests.

### 3.1 Protected Checkpoint 1A baseline

The user visually accepted the Checkpoint 1A shell on 2026-08-21. Its navigation, information hierarchy, project/revision/activity visibility, demo command outcomes, and host-injected authority behavior are now regression inputs, not disposable scaffolding.

Before 1B changes persistence or transport, the project records the accepted source revision/commit, fixture and expected revision/activity counts, and representative screenshots. The 1A application remains runnable against a copied frozen JSON data directory. 1B is an infrastructure substitution behind existing application ports; it may add the approved Header Agent mode selector and card preview/fallback but must not silently redesign the accepted shell. Any broader visual change returns to a user checkpoint.

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

All mutations use a common internal envelope. Actor, task, grant, and correlation fields are supplied by a trusted host execution context; an MCP caller cannot assert or replace them through tool arguments:

```json
{
  "commandId": "cmd_...",
  "commandType": "asset.metadata.update",
  "schemaVersion": 1,
  "actor": { "actorId": "agent_...", "actorType": "agent" },
  "projectId": "project_...",
  "taskId": "task_...",
  "grantId": "grant_...",
  "branchId": "branch_...",
  "baseRevision": "rev_...",
  "expectedVersion": 7,
  "idempotencyKey": "client-unique-key",
  "dryRun": false,
  "payload": {}
}
```

Human UI commands use the same envelope; a locally authenticated human context supplies its actor and authorization. The MCP host injects its bound agent/task/grant context after tool-input validation. System commands identify both the initiating actor and the system executor. The application API separates these values as `execute(commandDto, trustedExecutionContext)`: `commandDto` contains no actor, task, grant, binding, or issuer field. Application handlers MUST reject authority fields that arrive inside an untrusted command or payload.

### Agent mode is a policy projection, not authority

The persistent Header Agent mode control is a human-facing posture selector. Its choices (`Off`, `Read only`, `Propose in draft`, `Execute scoped task`, and `Custom…`) request a service operation; they are not local permission flags. The service authenticates the human, creates/selects/revokes the concrete task grant as allowed, then returns a redacted `EffectiveAgentPolicy` projection containing state, project/task/branch, capability and object-scope summary, expiry, budget, and job count.

The UI renders only that projection. It cannot forge an `ACTIVE` state, attach a grant to an MCP invocation, or widen a policy by changing client state. On service disconnect it renders `SERVICE_UNAVAILABLE`, which carries no authority. `EXPIRED`, `REVOKED`, and `DENIED` are likewise inactive. Broadening from read/draft to execute requires a warning/confirmation; finalization/export remain separate commands and publish is never a header posture.

Application command flow:

1. Parse and validate the versioned DTO.
2. Verify the trusted host execution context and load the referenced immutable grant.
3. Authorize command, object scope, branch, budget, and expiry.
4. Check idempotency and optimistic concurrency.
5. Load aggregates at `baseRevision` inside the unit of work.
6. Evaluate domain invariants and calculate events.
7. Run required synchronous validation; enqueue expensive validation as a durable job only where finalization rules permit.
8. On dry run, return proposed events/diff/findings without commit.
9. Atomically append events, update projections, consume grant budget, create a revision, and record activity.
10. Publish post-commit notifications and job work.

An exception before commit changes nothing. A repeated idempotency key with the identical payload returns the original result; reuse with a different payload is an error.

Queries are side-effect-free and read versioned projections. Strongly consistent reads can request a revision; UI list views may use current projections but MUST display their revision.

## 7. Persistence

### SQLite

The local service owns one SQLite database per workspace or one database with explicit project isolation. The initial default is one workspace database in WAL mode with foreign keys enabled, a bounded busy timeout, one authoritative writer, and explicit schema/user versioning. Live backups use the SQLite backup API or a documented checkpointed procedure; copying only the main file while WAL writes are active is forbidden.

One command transaction includes events, revision and parent links, aggregate versions, projection updates, activity, idempotency result, command-required findings, and grant budget consumption. Migrations run transactionally where SQLite permits; multi-phase migrations use explicit durable states and recovery instructions. The service does not expose a writable API until migration and integrity checks complete.

Logical tables include projects, branches, events, revisions, revision parents, aggregate versions, projections, artifacts, artifact references, grants, jobs, job events, findings, idempotency records, and schema migrations. Projection tables are rebuildable from events plus verified snapshots.

SQLite is an infrastructure adapter. Tests use a conforming in-memory repository only where the same contract suite also runs against SQLite. Fault injection covers every commit boundary, restart/recovery, WAL checkpoint behavior, busy writers, concurrent readers, backup/restore, and projection rebuild/hash comparison.

### Content-addressed store

Artifacts are immutable and addressed by SHA-256. Writes stream into a bounded same-filesystem staging area, enforce media/byte/image-dimension limits, calculate and verify the digest, durably close the file, then atomically rename it into a digest-sharded path. Existing digest content is verified/deduplicated rather than overwritten. Metadata is committed only after durable artifact placement. A failed database transaction may leave a quarantined/unreferenced blob, which explicit retention-delayed mark/sweep garbage collection can safely reclaim.

Logical URIs use `studio://` resources. Binary retrieval resolves to authenticated local artifact endpoints or resource links. Tool payloads never carry base64 images or local paths. Reads fail closed on missing/digest-mismatched content; integrity audit, backup, and restore operate over the database/CAS pair and verify their manifest.

### 1A JSON migration and rollback

Migration is copy-and-verify, never in-place conversion:

1. stop the 1A writer and copy its JSON directory to a dated protected baseline;
2. write a manifest containing source files/digests, Studio/schema version, project heads, aggregate/event/activity counts, and accepted fixture evidence;
3. migrate into a new SQLite database and CAS staging destination using a versioned idempotent migration ID;
4. verify identifiers, ordering, grant/revocation state, semantic projection hashes, findings, artifact references, and visible demo outcomes;
5. atomically switch the configured active-store pointer only after all checks pass;
6. retain the JSON baseline, new database/CAS, and migration report through the 1B acceptance/retention window.

JSON and SQLite never run as concurrent authoritative writers. A failed migration leaves the active pointer untouched and can safely restart against the staged destination. Rollback preserves the SQLite/CAS state for diagnosis and returns to the frozen JSON baseline only through an explicit operator action. If 1B accepted writes occurred after cutover, the service first creates a verified recovery bundle/down-export; it never silently loses those revisions merely to make older code start.

C1A grant history is migrated for audit only. Every legacy grant is marked `LEGACY_UNBOUND` and cannot authorize a 1B call; the human must issue a new immutable 1B grant and create a new host binding. Unresolved legacy artifact URIs remain explicit `MISSING_ARTIFACT` findings and are never converted into invented CAS digests.

### Portable bundle

A project bundle contains a versioned normalized manifest, event/revision data or a portable projection with audit data, referenced CAS blobs, adapter configuration, and integrity hashes. Import verifies every digest before making the project visible. Bundles do not include secrets or machine-specific absolute paths.

## 8. Revision DAG and multi-agent work

Every accepted semantic command creates one revision node, or a documented batch command creates one revision for its atomic event set. Nodes have one or more parents. Branch heads are mutable pointers updated by compare-and-swap; revisions are immutable.

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

## 9. Jobs and observability

Image slicing batches, thumbnail generation, validation, generation-provider calls, bundle creation, and export are durable jobs. A job records input revision and artifact references so a retry cannot accidentally operate on newer state.

Job states are `QUEUED`, `RUNNING`, `WAITING_FOR_USER`, `SUCCEEDED`, `FAILED`, and `CANCELLED`. State transitions append job events. Cancellation is cooperative and visible; non-cancellable commit windows are short and explicitly reported.

All command, MCP request, validation run, and job events share correlation IDs. The production board consumes the same activity projection exposed to agents. Logs must redact tokens, grant secrets if any, prompts marked private, and machine-specific sensitive paths.

## 10. Validation architecture

Validators are pure rule functions where possible. They consume a versioned snapshot and emit `ValidationFinding` values. Rule IDs are stable and namespaced, for example `studio.room.overlap` and `numberdroid.exact_fit.mismatch`.

Validation layers:

1. DTO/schema validation;
2. domain invariants at command time;
3. cross-aggregate Studio validation;
4. adapter validation for Numberdroid semantics;
5. canonical Numberdroid Level Compiler validation for export candidates.

Pixel/image analysis produces suggestions and quality findings, not authoritative semantic state. Full compiler validation is run on every accepted edit when the existing Numberdroid authoring contract requires it; performance optimization may cache inputs but MUST not weaken the result.

## 11. Deterministic export boundary

The application freezes an `ExportSnapshot` before invoking an adapter. The Numberdroid adapter then:

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

- The local service binds to loopback by default and refuses non-local connections unless explicitly configured.
- MCP stdio is the initial 1B transport. Future network transports require per-call authenticated host context, origin controls, and TLS at the deployment boundary.
- Grants are immutable, signed or server-authenticated capabilities identified by opaque IDs. Only authenticated human roles can mint or widen them.
- The Header Agent mode control displays service-returned effective policy; its DOM/client state, selected label, and browser storage are never authorization inputs.
- Tool payloads cannot name arbitrary filesystem paths. Imports use approved file handles/roots; exports use configured destinations and manifest-relative paths.
- Archive and image processing defends against traversal, decompression bombs, oversized dimensions, malformed codecs, and symlink escapes.
- Provider credentials remain in a local secret store and never enter project bundles, events, prompts returned to ungranted readers, or MCP logs.
- Read resources enforce project and object scope, not only mutation tools.
- Publish is a separate high-risk capability with short expiry and a complete preview/manifest.

Threat-focused tests cover grant forgery/widening, expired/revoked grants, cross-project object references, stale replay, idempotency collisions, path traversal, artifact hash mismatch, oversized input, cancellation races, unauthorized resource reads, and publish escalation.

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

At each checkpoint, reviewers MUST be able to demonstrate:

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
- an agent branch can be inspected, rejected, merged, and reverted without deleting history;
- exports match golden manifests for stable fixtures;
- `AUTO_ACCEPTED_BY_POLICY` never appears as `USER_APPROVED`.
