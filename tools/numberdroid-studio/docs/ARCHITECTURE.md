# Numberdroid Studio — Architecture

## 1. Architectural intent

Numberdroid Studio is a local, agent-first authoring product with multiple clients, not a collection of editor scripts. A single application core owns semantic commands, policy evaluation, validation, revisions, and jobs. The visual app, MCP server, CLI, and future remote API are adapters to that core. [VISION.md](VISION.md) is the binding product direction.

The architecture protects four future moves:

1. extraction from the Numberdroid repository into a standalone application;
2. replacement or addition of presentation and transport layers without changing domain behavior;
3. extension from image-derived assets to complete requirements-driven levels and from one project adapter to proven additional adapters without changing stable identities;
4. concurrent work by multiple task-scoped agents under one authoritative writer.

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

### 2.1 Three product layers

1. **Universal core:** project, artifact/CAS, processing recipe/result, asset, job,
   revision, finding, task branch, review, candidate manifest, backup/recovery.
2. **Optional reusable authoring modules:** bounded 2D processing, atlas/sprite
   sheets, room/grid/level graph, actors/routes, typed variables and trigger/action
   logic, animation, and dialogue/text. A project loads only advertised modules.
3. **Project/engine adapters:** Numberdroid first; later a concrete Godot, Unreal,
   or other project bridge. An adapter declares capabilities, maps candidate data,
   and invokes the target's canonical validation/compiler/import boundary.

These are dependency boundaries, not permission to create empty package facades.
A layer/package is introduced only with a real contract, implementation, fixture,
and boundary test.

### 2.2 Four stable interfaces

| Interface | Responsibility |
| --- | --- |
| `ProjectCapabilityManifest` | Versioned fail-closed declaration of coordinate model, asset kinds, enabled modules, actor/logic vocabulary, limits, validators/compiler operations, output formats, and adapter extension schemas. |
| Authoring Commands/Queries | Transport- and UI-independent semantic operations for every ordinary authoring step, with typed DTOs, validation, revisions, idempotency, dry-run, and conflicts. |
| `CandidateManifest` | Immutable exact closure of requirements, semantic revisions, artifacts/recipes, adapter/compiler versions, logical outputs, findings, provenance, and hashes. It grants no materialization authority. |
| `EngineBridge` | Narrow one-way candidate validation/import/materialization port. It never merges authoring state with engine-editor state implicitly. |

Initial Godot integration may use supported imports, documented resources, and an
editor plugin for image resources, TileSet/TileMapLayer data, and scenes. Initial
Unreal integration requires a supported editor/import plugin and MUST NOT write
`.uasset` files directly. Godot/Unreal remain authoritative for runtime rendering,
scripting, debugging, and playtesting. Full round-trip synchronization is deferred.

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
packages/numberdroid-adapter  pure deterministic CP5 snapshot/candidate mapping
fixtures + scripts       deterministic evidence and verification
```

SQLite/content-addressed persistence and the official MCP transport are the accepted operational path. Checkpoints 2C, 3, and 4 are accepted: they add slice-bound V2 assets/schema v9, immutable room authoring/schema v10, and isolated task review/schema v11 without changing the inward dependency boundary. The integrated but still unaccepted Checkpoint 4.5 source adds list-first task and guided-room projections plus schema-v12 normalized sparse room-shape cells. Candidate schema v13 adds only private branch-native processing-adoption lineage and retention. Candidate A1.6b2b exposes that one adoption operation only through a separately selected, positively negotiated local Authoring-v2 MCP surface; it adds no public HTTP or UI surface and does not alter accepted legacy discovery. Rectangular portable rooms remain schema v2; a project uses schema v3 only when a room version contains `VOID` or `BLOCKED` cells. Shape replacement is owner-only and absent from every current discovery surface, so the accepted 19-tool/four-template and task-bound 30-tool/five-template contracts remain unchanged. That is a historical compatibility fact, not the forward agent-first target: later Authoring-v2 blocks must expose ordinary shape authoring on isolated task branches without granting owner review/merge/release authority. The integrated candidate-only Checkpoint 5 foundation implements the pure `numberdroid-adapter` and a fixed repository-side canonical compiler bridge, but not candidate persistence/approval or any later-stage authority. Source integration into `main` does not itself accept any candidate or authorize candidate output. The JSON adapter remains only for protected 1A regression and migration. The combined `studio-server` UI/service/worker process is an accepted transitional packaging choice, not the final standalone packaging model.

The sections below describe the target topology as checkpoints introduce it. A named target package is not implemented merely because it appears in this document. In particular, `apps/studio-ui` and `apps/studio-service` do not yet exist as standalone working packages; their current responsibilities remain in the combined server. `packages/numberdroid-adapter` now exists as a pure candidate builder, while persistence, UI review/approval, materialization, and publication remain deferred.

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

Checkpoint 2B implements the deterministic exact-PNG crop kernel in this package. It validates and decodes bounded non-interlaced 8-bit RGB/RGBA PNG input, verifies chunk order and CRC, rejects unsupported transparency chunks, crops exact source pixels, and emits a processor-owned canonical RGBA PNG whose digest and byte size are deterministic. It consumes artifacts and semantic models through ports; it does not decide semantics from pixels. The user-accepted A1.0 contract adds a projection from the pure schema-v1 `ProcessingRecipe` contract to this unchanged kernel. That schema accepts one immutable PNG input and one exact-crop operation, and deliberately excludes atlas pivot/replacement semantics and all execution or owner authority. The user-accepted A1.1 contract adds the pure schema-v1 `ProcessingResult` contract and a source-bytes exact-crop builder. It pins and cross-validates the recipe fingerprint, operation and processor identity, immutable input/output artifact descriptors, output order, dimensions, byte lengths and digests, and normalized structured findings. Separately, the user-accepted A1.2 `AssetInputSelection` value lives in `packages/domain`; it pins one explicit result output as a `surface`, `prop`, or `item` `primary-visual` input without creating or mutating an Asset. The candidate-only A1.3 Domain/Application seam closes those values against one exact capability operation, project revision, Asset identity/head observation, and registered-plus-physical CAS observations. Its immutable receipt is explicitly read-only, nonauthorizing, and stale by definition at any later mutation boundary. Candidate-only A1.4 adds a private, unregistered, agent-task-only command/planning seam. It rechecks exact Task/Grant/non-main branch authority before obtaining a fresh branch-bound A1.3 receipt, then describes explicit create or imagery-only update intent through a processing-specific binding while returning no authority, persistence, commit, or replay state. Candidate-only A1.5 supplies the private atomic-store boundary A1.4 required: it repeats every observation, derives a fresh receipt/plan internally, holds exact CAS evidence, and atomically persists a branch-local DRAFT processing Asset projection, immutable Aggregate/replay result, two retention roles, Activity, and one command charge in schema v13. Same-key/same-semantics retries return the original result without revalidation. The current Numberdroid profile v1 intentionally does not advertise the capability operation, and A1.5 remains unregistered and unwired from production dispatch. Candidate-only A1.6a adds one separately typed private command feature over 33 legacy definitions, the exact 31-scope vocabulary, additive Numberdroid profile v2, trusted task/grant catalog injection, and real SQLite/CAS-backed read ports for an effect-free A1.4 dry-run. Legacy profile/catalog/MCP defaults remain exact and no server, launcher, HTTP, UI, or MCP composition selects the v2 prerequisites. Candidate-only A1.6b1 closes current Grant liveness during strict HostBinding resolution and adds an unwired host-bound A1.5 port whose admission guard runs before replay and again inside the mutation transaction. A1.6b2a composes the hidden private session; candidate-only A1.6b2b adds its exact, positively negotiated local MCP transport. Public owner review/workflow authority and every additional operation remain planned. The forward image module may add trim/padding, canvas/size normalization, deterministic resize, safely specified alpha/background cleanup, and atlas/sprite composition only as concrete Numberdroid needs justify them. No recipe overwrites its source or prior output.

A1.6b2 is now deliberately split. Candidate-only A1.6b2a gives the host-bound
port a distinct kind and composes a private one-shot execution session:
capabilities and real A1.4 dry-run repeat full SQLite/profile admission, while
commit enters the freshly host-bound A1.5 store directly to preserve
ledger-first lost-response replay after budget exhaustion. The SQLite server
stores only the private runtime in a module-private `WeakMap`; its v2
provider/store remain closure-bound and its per-operation reader/ports/session
remain transient. The runtime drains active operations before closing its
writer; no HTTP, launcher, MCP, UI, or returned runtime surface is added.
A1.6b2b now supplies that separate transport/exposure candidate. Only exact
`NUMBERDROID_STUDIO_MCP_PROFILE=authoring-v2` selection requests it; an absent
selector preserves legacy composition unchanged and every other set value
fails startup closed. Before constructing stdio discovery, the gateway requires
a positive Bearer-authenticated private loopback server negotiation for the
same project, HostBinding, Task, Grant, non-main branch, profile fingerprint,
and runtime/store readiness. Negotiation returns `AVAILABLE` while command
budget remains or `REPLAY_ONLY` at exact exhaustion; it is surface admission,
not mutation authority.

The resulting MCP server is static for its lifetime and contains exactly 31
tools and six resource templates: the complete matching-task legacy 30/five
surface plus only `studio_processing_result_adopt` and
`studio://projects/{projectId}/capabilities`. There is no fallback to 30/five.
Capability reads and `dryRun: true` create fresh one-shot sessions and repeat
full, budget-strict admission. `dryRun: false` creates a fresh strict
HostBinding-bound session but enters the ledger-first A1.5 store directly, so a
lost response remains replayable after exact command-budget exhaustion without
authorizing a new command. Discovery does not mutate after revocation; each
subsequent resource/tool invocation resolves current authority and denies it.

The three Authoring-v2 endpoints remain private loopback/Bearer transport
routes, not a public API. MCP cancellation propagates through gateway fetch and
the HTTP abort signal to the one-shot session. The atomic transaction itself is
not interrupted; callers resolve an unknown result with the same idempotency
key. Shutdown stops intake and drains active runtime operations before SQLite
closes. Restart reconstructs the runtime and requires a new positive
negotiation; `REPLAY_ONLY` preserves recovery without granting new work.
Successful negotiation, capability reads, and dry-runs create no
`AUTHORIZED` attempt row. Successful commits use the atomic semantic Activity;
attributable denials/failures create exactly one redacted final row, while
invalid or pre-binding traffic remains without project attribution. See
[`A1_6B2B_STATUS.md`](A1_6B2B_STATUS.md).

The preview projection also owns deterministic Asset Library card states: resolved image, processing, missing artifact, unsupported media, and load failure. Each state has a stable kind-aware fallback descriptor so the UI never has to infer meaning from a failed image element or expose a filesystem path.

#### Engine-neutral room preview scene

Room preview extends the reusable preview boundary with a pure, read-only scene
projection. It consumes an exact project revision and immutable room version and
returns only portable presentation primitives: room cells, ordered layers,
connectors, asset/version references, transform, logical footprint, ground
anchor, visual bounds/offset, elevation, transparency/occlusion hints and
findings. It performs no application command and owns no task, review, merge,
candidate, repository or release authority.

The scene is renderer-independent:

room revision -> preview scene -> top-down renderer or later 2.5D renderer

Logical footprint remains the authority for placement, collision and navigation.
Visual bounds may extend outside that footprint. Renderers sort ordinary sprites
deterministically by layer and ground anchor; optional bounded
background/body/foreground segments handle the rare asset whose pixels must
occlude on both sides of another object. Renderer metadata never changes room
semantics.

The initial top-down Studio renderer is approximate but positionally faithful.
A later 2.5D renderer may apply an isometric/dimetric projection, simple
elevation and side-facing/billboard sprites. Neither renderer invokes the
validate-only EngineBridge. Higher-fidelity Numberdroid, Godot or Unreal
previews are optional adapter ports and must truthfully identify their additional
compiler, registry and runtime pins.

Apps and transport infrastructure host configured generation-provider adapters behind an application port. Provider credentials and network calls remain outside the domain; a generation job records the provider/model response, prompt/seed/options, cost evidence where available, and immutable output artifact before exposing it for review.

### `packages/mcp-server`

Protocol transport plus semantic tool/resource mapping. The stdio bridge does not open SQLite or the CAS directly. It registers a short-lived pending host over a raw loopback pairing socket that browsers cannot speak, starts MCP discovery without authority, and receives a server-minted opaque `HostBinding` only after matching human approval in the Header panel. It then calls the running one-writer Studio service over the private loopback bridge. Only a digest of the credential is stored. On every call the service resolves the immutable binding, reloads its current grant, and injects actor/task/branch/grant execution context before application dispatch. Protocol connection state, client envelope metadata, and tool arguments are not authorization. Strict HostBinding resolution now closes both persisted Binding and current Grant liveness. Existing generic and specialized audited MCP routes use a separately typed `NOT_GRANTED` subject only for redacted denial/failure attribution, then repeat strict resolution inside the audited boundary. Policy, service selection, atomic authorized-attempt data, and dispatch use only the live result, while both phases retain one request correlation. This package contains no authoring rules.

A1.6b2b does not replace that model. Exact Authoring-v2 process selection is a
request to negotiate, never authority; only the private server can positively
prove the v2 task/grant/branch/profile/store surface. The MCP mapper fixes the
feature, tool, command type, and inner schema discriminators rather than
accepting them from the caller, and delegates capability and adoption
operations back to the one-writer service. Legacy 19/four and 30/five builders,
the 33-command/30-scope catalog, Numberdroid profile v1, schema v13, and bundle
v1-v3 remain unchanged.

### Target authoring modules and adapter contracts

Future physical packages may separate image, atlas/sprite, level graph,
actor/route, logic, animation, or dialogue concerns only when a checkpoint needs
them. Their schemas depend inward on domain/application ports and never import a
game adapter. Adapter-contract code owns `ProjectCapabilityManifest`, generic
candidate DTOs, and the `EngineBridge` port; it contains no Numberdroid path,
registry, encounter, or compiler import.

An authoring module contributes semantic commands, queries, validators, resource
projections, and capability schema as one tested unit. UI panels and MCP mappings
are adapters to those commands, not the module's authority. Unknown or disabled
module data fails closed.

### `packages/numberdroid-adapter`

The only package allowed to know Numberdroid repository layout, Level Spec, compiler invocation, runtime asset locations, naming conventions, source-art paths, encounter vocabulary, and exact-fit/tileset export forms. It supplies the first `ProjectCapabilityManifest`, converts an immutable Studio export snapshot into a deterministic candidate, and imports compiler findings into the Studio finding model.

The first Checkpoint 5 slice keeps this package free of filesystem, process,
network, Git, and GitHub authority. It emits virtual JSON files and CAS-referenced
copy descriptors only. The repository-side bridge has fixed canonical imports
and accepts only the exact in-process snapshot object branded by the trusted
factory. Serialization deliberately removes that trust; a rehashed JSON object
cannot become provenance authority. Callers cannot select a module, repository
path, branch, destination, or publication action.

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
| `ProcessingRecipe` | Versioned typed, bounded, reproducible transformation graph from immutable input artifacts to immutable derived artifacts. Processor identity and parameters are pinned. |
| `ProcessingResult` | Immutable result descriptor for one recipe application, pinning the exact recipe fingerprint, processor, operation-level input/output artifact descriptors, and structured findings. Its hash is a descriptor identity and grants no storage, lifecycle, adoption, review, or publication authority. |
| `AssetInputSelection` | Candidate-only immutable selection intent that pins exactly one ProcessingResult output as the caller-explicit `primary-visual` input of a `surface`, `prop`, or `item`. It creates no Asset and grants no adoption, lifecycle, review, or publication authority. |
| `ProcessingAdoptionPreflightReceipt` | Candidate-only immutable observation closing Recipe, Result, Selection, exact capability, project/Asset head, and registered-plus-physical CAS evidence. `PREFLIGHT_PASSED` is read-only, grants nothing, and must be revalidated at mutation time. |
| `ProcessingResultAdoptionPlan` | Candidate-only immutable A1.4 plan binding exact processing lineage to one task branch and explicit create or imagery-only update intent. It grants no authority, performs no persistence or commit, and enumerates the checks and writes A1.5 must repeat atomically. |
| `ProcessingResultAdoptionAggregate` | Candidate-only immutable A1.5 branch record closing the original command, trusted authority binding, fresh receipt/plan, DRAFT Asset projection, processing lineage, two exact artifact roles, one budget charge, and durable CommitResult. It is neither a Main/CP2C Asset nor merge/review authority. |
| `AtlasDefinition` | Source artifact plus explicit integer extraction rectangles and slice settings. Rectangles are authoritative; a grid is only a proposal convenience. |
| `Asset` | Stable semantic identity for a `surface`, `prop`, or `item`, with versions of imagery and metadata. Export names are aliases, not identity. |
| `AnimationClip` | Ordered frames, timing, looping, anchors, and events attached to an asset or project-supported actor visual without changing the parent identity. |
| `RoomArchetype` | Reusable room/hallway intent, dimensions or ranges, connector requirements, allowed vocabulary, and governing rules. |
| `RoomVariant` | Concrete layers and placements that reference assets by ID and record a validation/finalization lifecycle. |
| `LevelRequirementSet` | Versioned typed intent, constraints, priorities, ambiguities/assumptions, acceptance criteria, and traceability IDs used to build and validate a level. |
| `LevelGraph` | Stable spaces, connections, zones/paths, placements, actors, routes, pickups, and logic bindings. Core uses capability-level concepts rather than game-specific encounter types. |
| `ActorArchetypeRef` / `ActorInstance` | Adapter-owned runtime behavior/archetype reference plus a level-local instance, placement, parameters, route, visual, and logic bindings. |
| `Route` / `Pickup` | Stable level-local path and item/drop/collection declarations with typed references and adapter validation. |
| `VariableDefinition` | Typed level-local state with stable identity, initial value, bounds/domain, and explicit adapter mapping. |
| `LogicGraph` | Versioned triggers, conditions, ordered actions, and dialogue/text references; semantic declarations rather than executable code or UI coordinates. |
| `ProjectCapabilityManifest` | Versioned adapter declaration that determines which modules, vocabularies, limits, validations, and output operations are valid for a project. |
| `ValidationFinding` | Stable rule result with severity, target/location, message, disposition, validator version, and evidence. |
| `Revision` | Immutable DAG node containing parents, command/event range, actor, timestamp, summary, and projection/content hashes. |
| `AgentTask` | Human-created root objective or trusted-service-derived attenuated child with bounded branch/ancestor context; links grants, jobs, activities, budget use, and result disposition. |
| `Grant` | Immutable human-minted root authority or service-derived attenuation record scoped by actor/task/project/branch/capabilities/objects/budget/expiry. Revocation is a new event; derivation never widens the root chain. |
| `Job` | Durable long operation with input snapshot, state, progress, events, cancellation, attempts, and result artifacts. |
| `ExportSnapshot` | Immutable input closure of exact project revisions, requirements, referenced artifacts/recipes, adapter/version/options, and findings. |
| `CandidateManifest` | Immutable content-addressed output closure containing logical files/data, input traceability, compiler/adapter versions, validation evidence, and hashes; it has no implicit materialization or publication authority. |

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

### Agent-first command completeness

Every ordinary authoring mutation begins as a semantic application command.
Human UI controls and MCP tools map to that command; neither may implement a
second authoring path. Capability discovery determines whether the command is
valid for the selected project. The first Authoring-v2 candidate gate adds only
processing-result adoption and project capabilities at exact 31/six after
explicit selection and positive server negotiation. Later additions require
their own pinned schemas and exact discovery counts rather than mutating this
candidate or the accepted 19/4 and task-bound 30/5 contracts silently.

The UI is primarily the visual control, review, and correction adapter. Agents
read resources and invoke semantic commands; they do not click UI controls. The
human-exclusive boundary is root-task/root-grant creation and widening, owner
review decision, task merge, recovered-workspace activation, repository/engine
materialization, and publication. The trusted service may derive only the
separately approved immutable, budget-reserved A4c child attenuation from an
active parent; the agent request never becomes authority. Ordinary drafting,
processing, placement, actor/route/logic editing, validation, candidate build,
and review submission are agent-operable under the corresponding narrow task
capabilities.

Multiple agents share immutable CAS artifacts but write mutable semantics only
through isolated task branches. Dependencies are explicit; branch/apply/merge
uses compare-and-swap and semantic conflict keys under the single writer.

## 7. Persistence

### SQLite

The local service owns one SQLite database per workspace or one database with explicit project isolation. The initial default is one workspace database in WAL mode with foreign keys enabled, a bounded busy timeout, one authoritative writer, and explicit schema/user versioning. Live backups use the SQLite backup API or a documented checkpointed procedure; copying only the main file while WAL writes are active is forbidden.

One command transaction includes events, revision and parent links, aggregate versions, projection updates, activity, idempotency result, command-required findings, and grant budget consumption. Migrations run transactionally where SQLite permits; multi-phase migrations use explicit durable states and recovery instructions. The service does not expose a writable API until migration and integrity checks complete.

Accepted Checkpoint 1 tables include `projects`, `revisions`, `revision_parents`, `activity_events`, `aggregate_versions`, `projections`, `idempotency_records`, `grants`, `migration_runs`, `artifacts`, `artifact_references`, `cas_gc_marks`, `host_bindings`, and `human_agent_access_operations`, plus the migration ledger maintained by the runner. Accepted schemas v6–v11 add source intake/audit, durable jobs, exact V2 assets/proposals, immutable room/proposal records, and isolated task/review/merge/revert ledgers. Candidate schema v12 adds the STRICT `room_variant_shape_cells` table with exact project/room/version lineage, canonical cell order, kind, coordinates, and immutable updates. Candidate schema v13 adds STRICT immutable `task_branch_processing_result_adoptions` and `task_branch_processing_result_artifact_references` tables only; private references extend retention/backup roots without becoming project artifact authority. Migrations 0009–0011 retain their accepted checksums; migration 0012 is pinned to `1e48171a0c70c4d015001287d254aad8359ea34970bddcb17168a8a368dd17e1` and migration 0013 to `af908897b489d24110dabbd1cad8754bd85959bfc744cf811b81c376b4603043`. Projection tables are rebuildable from events plus verified snapshots.

SQLite is an infrastructure adapter. Tests use a conforming in-memory repository only where the same contract suite also runs against SQLite. Fault injection covers every commit boundary, restart/recovery, WAL checkpoint behavior, busy writers, concurrent readers, backup/restore, and projection rebuild/hash comparison.

### Content-addressed store

Artifacts are immutable and addressed by SHA-256. Writes stream into a bounded same-filesystem staging area, enforce media/byte/image-dimension limits, calculate and verify the digest, durably close the file, then atomically rename it into a digest-sharded path. Existing digest content is verified/deduplicated rather than overwritten. Metadata is committed only after durable artifact placement. A failed database transaction may leave a quarantined/unreferenced blob, which explicit retention-delayed mark/sweep garbage collection can safely reclaim.

Logical URIs use `studio://` resources. Binary retrieval resolves to authenticated local artifact endpoints or resource links. Tool payloads never carry base64 images or local paths. Reads fail closed on missing/digest-mismatched content; integrity audit, backup, and restore operate over the database/CAS pair and verify their manifest.

### O0 external backup operations control plane

The frozen O0 decision is
[`O0_BACKUP_RECOVERY_CONTRACT.md`](O0_BACKUP_RECOVERY_CONTRACT.md). O1 uses an
external SQLite control ledger with its own schema v1, writer lock,
idempotency, phases, leases/fencing, destination registry, and sanitized
results. The control root is outside the live workspace and every
backup/restore destination; it is excluded from workspace snapshots and never
stores semantic project state. The Studio service remains the one project
writer and composes the operation worker with the already-open SQLite/CAS
adapters plus one fair, live-CAS-root-scoped shared/exclusive maintenance
barrier. Create holds shared access through staged snapshot verification;
`markUnreferenced` and `sweepQuarantine` cannot bypass exclusive access. The
ledger owns only its fixed SQLite WAL sidecars, while `operations.lock` is a
separate rollback-journal SQLite database held in one lifetime
`BEGIN EXCLUSIVE` transaction rather than a stale-reclaimable PID file.

The current workspace is schema v13 and migration 0013 is already owned by
processing-result adoption. O1 allocates no workspace migration; the external
control schema is not part of the workspace migration sequence. Existing
backup, verification, and restore functions remain protected persistence
primitives. Online O1 orchestration supplies configured opaque destinations,
safe same-filesystem staging, durable no-overwrite publication, restart
reconciliation, read-only recovery testing, and restored-copy quarantine.
Linux pins realpath/device/inode identity and syncs the staged tree bottom-up.
Windows additionally uses fixed bounded-stdin Win32 inspection and publication
helpers: no-follow handles reject every reparse point and non-NTFS or mixed
case-sensitive root, while identity-bound `MoveFileExW` uses write-through and
never replace/copy fallback. Recovery-test copies receive the same quarantine
marker before their internal read-only open.

O1 authority is the dedicated local human capability
`workspace.backup.manage`, authenticated through a one-use secret emitted only
to the local launcher terminal. Same-origin/CSRF protection alone, project
ownership, task/Grant/HostBinding state, MCP discovery, or caller paths cannot
derive it. O1 is SQLite-only; JSON mode composes no operations control plane or
authority. The accepted loopback listener and exact MCP catalogs remain
unchanged. The O1 product gate requires the bounded first **Backups** UI;
deletion, retention, active-workspace activation/cutover, and remote invocation
remain absent.

The non-visual implementation of this boundary is recorded in
[`O1A_BACKUP_CORE_STATUS.md`](O1A_BACKUP_CORE_STATUS.md). It composes the exact
four-operation in-process service, serialized worker, external ledger/lock,
configured-root filesystem adapters, quarantine readers, and fail-closed
restart reconciliation without adding a server route or UI. It remains an
implemented candidate. The separately classified local-human HTTP/session
composition and bounded **Backups** surface are now implemented as recorded in
[`O1B_BACKUPS_UI_STATUS.md`](O1B_BACKUPS_UI_STATUS.md). O1a and O1b are
source-integrated and automated green, but remain **not user accepted**; only
Klaus's live UI walkthrough can close O1. That gate continues to block remote
backup metadata/operation authority, not a separately authenticated O2a
remote-human adapter. O2a must leave the accepted Studio server loopback-only,
use a positive route registry, fail closed on auth/proxy/mount/writer startup,
and deny backup, internal MCP, pairing, and remote agent-authority routes even
after login.

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

### Checkpoint 2C V2 assets and portable bundle

`asset.proposal.submit` resolves every caller-supplied slice coordinate to the exact committed historical slice and LIVE artifact metadata before persistence. The proposal stores immutable ordered items, typed metadata, deterministic findings/diffs/fingerprint, and redacted proposer attribution. Owner decision covers every item exactly once and requires a rejection reason. Later apply revalidates slice and asset versions and creates the accepted assets, findings, asset-version references, Activity, idempotency, and grant charge in one SQLite transaction; rejected items remain durable without an asset version. Lifecycle promotion is owner-only and creates another immutable asset version without implying runtime export or publication.

The portable artifact is a bounded directory, separate from workspace backup and from Numberdroid export:

```text
manifest.json
manifest.sha256
project.json
artifacts/sha256/aa/bb/<digest>
```

Export runs full workspace integrity and one SQLite read transaction, requires terminal proposals/jobs, projects a normalized schema-v1 semantic document, and copies only its exact CAS closure. The manifest and semantic document are canonical JSON with independent hashes; every artifact is independently checked for digest, bytes, media type, and dimensions. Import rejects symlinks, traversal, extra/missing files, unsupported schema, noncanonical/oversize JSON, digest mismatch, active authority/work, and same-ID/destination conflicts before visibility. It materializes a fresh v9 workspace in a sibling stage, reconstructs terminal APPLIED atlas history only under reserved nonauthorizing `bundle_import` provenance, runs deep database/asset/CAS integrity, checkpoints/closes, and atomically renames the stage. Grants, HostBindings, tokens, attempts, idempotency, staged intakes, access operations, live jobs/events, leases, machine paths, and raw failures do not survive. Export → import → export is required to preserve canonical `project.json`, manifest, and CAS bytes exactly.

## 8. Checkpoint 4 isolated task branches and multi-agent work

The authoritative main project retains the accepted linear immutable revision sequence. Checkpoint 4 adds one durable isolated project document per `AgentTask`, pinned to a main base revision and advanced by compare-and-swap. Branch revisions are immutable and retain explicit task/branch identity and command payload for validated replay. Merge lineage records both the current main parent and immutable branch parent; it does not pretend the existing main revision table has become a general-purpose DAG.

The default agent workflow is:

1. user creates an `AgentTask` from a known base revision;
2. the service creates a dedicated draft branch;
3. user mints a scoped grant for the task and branch;
4. agent reads resources and commits semantic changes to that branch;
5. user watches live activity and validation;
6. agent submits a review candidate;
7. the user records per-change accept, reject, or request-changes decisions; an explicit bounded policy may record `AUTO_ACCEPTED_BY_POLICY` but never human approval;
8. merge simulates accepted branch commands against current main, then atomically appends the validated main revision batch, grant revoke, review/task disposition, and immutable merge record.

Two commands cannot silently update the same aggregate version. Different agents may make independent changes on separate branches. Semantic merge logic is aggregate-specific; unresolved conflicts are first-class findings, not file conflict markers.

Revert emits a compensating semantic main revision and immutable revert record. History, attribution, and earlier revisions remain intact. A portable bundle refuses nonterminal tasks and excludes all task/grant/review/merge/revert operational state.

The v8 atlas job tables remain bound by foreign key to authoritative main revisions. Checkpoint 4 therefore rejects shared-effect intake/preview/commit commands inside an isolated task branch rather than creating misleading branch-local jobs. Tasks consume already committed atlas/slice inputs; a later explicit schema/worker change is required if branch-local bitmap jobs become an acceptance requirement.

### A4c derived child-task extension — authorized, not implemented or accepted

Checkpoint 4's owner-created workflow remains its accepted compatibility truth.
The additive A4c extension permits an agent to request one trusted-service
derivation from its exact current parent. In one transaction the service must
pin the parent's current branch head, keep project and actor unchanged, allocate
a non-main child branch, derive capability/object subsets, reserve command/job/
artifact/cost budget from the parent, cap expiry at the parent, disable
auto-accept and further child creation, and append the audit record. The same
idempotency key cannot produce a second child or charge budget twice.

Every command on the child walks the immutable ancestor chain. Parent pause or
review denies new mutation; cancellation, rejection, merge, expiry, or revoke
invalidates execution for all descendants. No request field can select another
actor, project, root grant, base, branch destination, capability, or budget. The
first implementation is a separate L3 task/grant/persistence risk slice after
the Level Candidate path and requires race, restart, cascade, fault, and
cross-principal negative tests.

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

## 11. Candidate and engine-bridge boundary

The integrated Checkpoint 5 candidate implements the first pure Numberdroid
snapshot/adapter/compiler slice. It does not yet persist or approve a candidate
and it does not materialize, commit, or publish. The target flow begins when the
application freezes an `ExportSnapshot`; the adapter then:

1. verifies required finalized assets/rooms and artifact integrity;
2. maps stable Studio identities to deterministic Numberdroid semantic IDs and paths;
3. creates virtual logical outputs and CAS copy descriptors for an immutable
   `CandidateManifest` without selecting or writing a repository destination;
4. invokes adapter and Level Compiler validation;
5. writes a manifest containing every logical path, digest, provenance reference, adapter version, and validation result;
6. exposes the candidate for visual/user verification and task review;
7. only after separate human-authorized commands, passes the verified manifest to
   an `EngineBridge` for materialization, commit, or publication.

The adapter must preserve Numberdroid rules: runtime files under the runtime public tree, authoring/provenance under the source-art tree, semantic metadata rather than pixel-inferred topology, exact-fit macro dimensions, stable IDs/subseeds, and canonical compiler validation.

GitHub integration receives files from a verified candidate manifest. It is downstream of authoring and cannot mutate Studio state except to record publication evidence. A future Godot or Unreal bridge follows the same one-way separation; engine-native round-trip ownership is not assumed.

### A4c private task-candidate path — authorized, not complete or accepted

The private application scope `level.candidate.create` is not an MCP-discovered
operation. It binds one current task/grant/actor/branch/base/head closure to the
actual A4b LevelSpec, A4a/A3a projection and validation, canonical compiler,
validate-only EngineBridge receipt, complete output bytes, deterministic preview,
ADD-only create diff, and idempotent submission. Domain DTO validation alone is
not a trusted bridge invocation or task transition; the Application layer must
revalidate the receipt against its configured port/selection and perform fresh
authority/head checks in the same atomic submission boundary.

Success leaves `main` untouched and commits task `IN_REVIEW`, one `OPEN` review
with every item `PENDING`, exact branch head, `REVIEW_SUBMITTED`, and visible
**Waiting for your review**. There is no automatic decision, merge, destination,
filesystem/repository write, materialization, publication, or release member.
Current 19/4, 30/5, and selected 31/6 discovery catalogs remain unchanged.

## 12. Security and trust boundaries

- The accepted local service is loopback-only and hard-refuses non-local bind addresses; no configuration may widen that listener.
- A1.6b2b's handshake, capability read, and adoption routes are private
  loopback/Bearer endpoints only. They are not a public HTTP API, and neither
  an environment value nor a successful discovery session creates authority.
- MCP stdio is the initial 1B transport. Future network transports require per-call authenticated host context, origin controls, and TLS at the deployment boundary.
- The 1B HTTP service refuses non-loopback bind addresses. Remote/team access must arrive through a separately authenticated deployment adapter; it cannot expose the local single-user API by changing the bind host.
- Local host approval uses a raw loopback pairing listener rather than an HTTP/browser route for credential delivery. The verification request is in memory, expires quickly, is single-use, and disappears on service or host disconnect.
- HostBinding coordinates never change. Any grant posture rotation revokes bindings before a new immutable grant can be host-bound; stale tokens cannot acquire new rights.
- Grants are immutable, signed or server-authenticated capabilities identified by opaque IDs. Only authenticated humans may mint, widen, or renew root grants. The trusted service may create an immutable attenuated child grant under the A4c derived-child contract; an agent request or payload is never authority.
- The Header Agent access control displays service-returned effective policy; its DOM/client state, selected label, and browser storage are never authorization inputs.
- Tool payloads cannot name arbitrary filesystem paths. Imports use approved file handles/roots; exports use configured destinations and manifest-relative paths.
- Archive and image processing defends against traversal, decompression bombs, oversized dimensions, malformed codecs, and symlink escapes.
- Provider credentials remain in a local secret store and never enter project bundles, events, prompts returned to ungranted readers, or MCP logs.
- Read resources enforce project and object scope, not only mutation tools.
- Publish is a separate high-risk capability with short expiry and a complete preview/manifest.

Checkpoint 1 threat-focused tests cover its implemented grant/HostBinding forgery and widening paths, expired/revoked grants, cross-project references, stale replay, idempotency collisions, artifact/path validation, size/hash failures, cancellation at the atomic boundary, and unauthorized reads. Checkpoint 2B extends that suite to immutable job authority, cross-task controls, retry ceilings, lease recovery/stale-worker races, cancellation/discard reference release, sanitized failures, atomic output promotion/apply/audit, shutdown quiescence, state-specific integrity, and backup snapshot consistency. Accepted Checkpoint 2C additionally covers recut binding, batch/version conflicts, per-item budgets, exact asset references, cross-project preview/query containment, bundle sanitation, tampered trees/semantics/blobs, destination atomicity, and nonauthorizing imported job history. Accepted Checkpoint 4 covers isolated task branches, review, semantic conflict handling, merge, and compensating revert. Providers, the complete Numberdroid authoring-to-candidate path, candidate persistence/approval, materialization, and publish escalation remain later gates; the current CP5 candidate proves only the pure snapshot/adapter/compiler boundary.

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

At each checkpoint, reviewers MUST demonstrate the checks that correspond to implemented capabilities. Accepted Checkpoints 1–4 cover package isolation, UI/MCP equivalence, SQLite/CAS recovery, source/atlas jobs, exact V2 asset review, immutable room lifecycle, isolated tasks, semantic conflicts, and atomic merge/revert. The Checkpoint 4.5 candidate additionally proves list/create/detail task truth, useful exact-slice preview gating, one persistent room canvas across toolbox/options/dock state, deterministic `VOID`/`BLOCKED` validation, owner-only HTTP authority, schema-v12 fault recovery/integrity, schema-v2 rectangle compatibility, schema-v3 masked-room canonical round trips, and protected-width real-browser evidence. User acceptance remains separate. The Checkpoint 5 adapter/compiler slice is candidate-only and does not complete the agent-first Numberdroid path.

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
- A1.0/A1.1/A1.2 contract tests cross-validate recipe, result, and selected-output closure, recompute the four Family Hygiene outputs from the pinned source bytes, and fail closed on pin, order, digest, metadata, path, sparse-field, prototype/accessor/serialization-hook, or authority drift;
- candidate-only A1.3 tests additionally close the exact capability operation, create/update Asset coordinates, project revision, registered `LIVE` and physical CAS descriptors, findings policy, cancellation, sanitized port failure, and nonauthority while proving the unchanged Numberdroid profile v1 fails closed before Asset/CAS reads;
- candidate-only A1.4 tests require exact active agent Task/Grant/non-main branch/scope/object/budget authority before a fresh task-branch A1.3 read, reject hostile command/context/port graphs, preserve cancellation and sanitized failures, distinguish deterministic create/update planning, and prove no command/scope registration or mutation claim was added;
- candidate-only A1.5 tests close real SQLite/CAS create/update, alias-key replay, command/key collision precedence, held physical evidence, exact two-role retention, metadata `M`/`M+1`, usage derivation, fault rollback, lost-response/restart recovery, deep tamper detection, v12/v13 backup compatibility, unknown-newer-schema rejection, and portable-bundle omission while proving Main/CP2C and public command/MCP surfaces remain unchanged;
- candidate-only A1.6a tests pin unchanged legacy 33/30 catalogs and profile v1, one separately typed v2 command feature plus the exact 31-scope vocabulary and Numberdroid profile v2, trusted task/grant provisioning without auto-accept, and real SQLite/CAS-backed `READY`, blocked, stale, cancelled, and sanitized effect-free dry-runs while accepted MCP discovery remains 19/4 or 30/5;
- candidate-only A1.6b1 tests close current HostBinding/Grant status, expiry, and coordinates; reject hostile host-bound captures and all command/context coordinate drift before dependencies; require current admission before replay; preserve live-only dispatch identity and one audit correlation; and prove revocation or crossed expiry during capability/CAS or before concurrent replay leaves no second adoption effect while accepted attempt auditing and discovery remain unchanged;
- candidate-only A1.6b2a tests require exact one-shot/profile/store admission, hostile thenable/proxy and strict signal handling, revocation closure across profile reads, write-free real dry-run, a distinct host-bound commit port, `maxCommands: 1` replay/alias/conflict precedence, reopen/lost-response recovery, hidden write-free production composition, one shared clock, and unchanged 33/30 plus 19/4 or 30/5 compatibility surfaces;
- candidate-only A1.6b2b tests require exact selector fail-closed behavior,
  positive private server negotiation with `AVAILABLE`/`REPLAY_ONLY`, static
  31/six discovery with only the one-tool/one-template delta, fresh strict
  capability/dry-run admission, ledger-first commit replay after restart,
  post-start revocation denial without discovery mutation, cancellation
  propagation, active-operation shutdown drain, exact redacted audit behavior,
  and unchanged 33/30, profile v1, 19/four, 30/five, schema v13, and bundle
  v1-v3 compatibility;
- an atlas preview fault cannot independently commit its semantic revision, job, budget, initial event, output metadata/reference, progress, applied slice revision, or authorized job-control audit;
- retry never exceeds three attempts or switches input revision; revoked/expired/cross-task authority cannot claim, publish, cancel, retry, discard, or apply the job;
- cancellation, failure, discard, recovery, and apply retain exactly the references permitted for their state, and graceful shutdown awaits the active worker before SQLite closes;
- official audit/job-ready MCP discovery is exactly 15 tools and the two project/job resource templates; job results expose resource links rather than bitmap data, paths, or base64;
- a complete integrity pass is required before backup, and the backed-up database and CAS closure remain valid under concurrent terminal-job discard;
- V2 asset versions preserve exact historical slice/digest lineage through recut, findings and permanent `${assetId}.v${version}` CAS references are atomic, and rejected proposal items create no asset version;
- official schema-v9 MCP discovery is exactly 17 tools and three resource templates, with owner decision/apply/lifecycle and bundle operations absent;
- portable export/import rejects nonquiescent or tampered input before visibility, retains zero live authority/operational rows, and re-exports byte-identical canonical semantics, manifest, and CAS bytes;
- a Checkpoint 4 task branch can be inspected, paused, resumed, cancelled, rejected, reviewed, merged, and reverted without deleting history or mutating main before merge;
- concurrent branch appends use CAS, overlapping main/branch semantic keys produce explicit conflicts, and a fault cannot split main revisions from task/review/merge disposition;
- official non-task discovery remains exactly 19 tools/four templates while a real matching task binding exposes exactly 30 tools/five templates without owner lifecycle/authority/release operations;
- once Checkpoint 5 implements the adapter, exports match golden manifests for stable fixtures;
- the forward interface gate proves that universal core and reusable authoring modules import no Numberdroid/Godot/Unreal code, an unsupported capability fails closed, and the Numberdroid capability fixture describes the canonical compiler boundary;
- a complete headless clean-agent Numberdroid fixture can eventually execute image-to-asset and requirements-to-candidate authoring through MCP, ending at **Waiting for your review** without owner review, merge, materialization, or publication authority;
- after that Numberdroid proof, one thin Godot 2D/Tower Defense fixture verifies that core identities, commands, recipes, logic graph, and candidate manifest do not depend on Numberdroid-specific schemas;
- `AUTO_ACCEPTED_BY_POLICY` never appears as `USER_APPROVED`.
