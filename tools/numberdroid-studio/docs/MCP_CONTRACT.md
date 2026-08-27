# Numberdroid Studio — MCP Contract

## 1. Purpose

The MCP server is the first-class authoring client for agents. It exposes the same semantic application commands and versioned read projections as the visual UI. It is not a filesystem proxy, database console, image-payload tunnel, or UI automation layer. [VISION.md](VISION.md) defines the agent-first product direction.

Every ordinary authoring capability advertised by a project MUST eventually be
performable through semantic MCP commands on an authorized task branch. Human-only
operations are authority issue/revoke, owner review decision, merge, recovered-copy
activation, engine/repository materialization, and publication. The UI may offer a
visual representation and correction workflow, but an agent never needs to click it.

Checkpoint 1B implemented and the user accepted MCP 2026-07-28 through the official maintained SDK. The protocol SDK and transport remain replaceable adapters; Studio command semantics do not depend on a specific MCP revision. Checkpoint 1A contained only a host-injected agent adapter/tool catalog and MUST NOT be described as a complete MCP server.

The Checkpoint 1A visual/interaction shell was accepted by the user on 2026-08-21 and remains the protected baseline. The accepted official transport preserves its command outcomes, successful-command activity visibility, and host-injected authority semantics. Accepted Checkpoint 2A adds two source mutations only when a durable SQLite attempt ledger is live and adds final redacted denied/failed Activity for calls that reach the private mutation bridge after valid HostBinding resolution. Accepted Checkpoint 2B adds atlas and durable-job operations only when both the attempt and job stores are live. Accepted Checkpoint 2C adds one proposal mutation, one read-only asset query, and one asset detail resource only when audit, jobs, and the durable schema-v9 asset store are all live. Accepted Checkpoints 3 and 4 add the scoped room and task-branch surfaces below. These are additive compatibility surfaces, not a permission-model rewrite or a claim of complete authoring parity.

The accepted default 19-tool/four-template and matching-task 30-tool/five-template
surfaces MUST remain exact. Complete agent-first authoring ships as an explicit,
versioned **Authoring v2** feature/schema gate with newly pinned discovery counts.
It MUST NOT rename or silently add tools to an accepted discovery mode.

Accepted transport: local stdio through the official SDK v2 `serveStdio(() => buildServer(), { legacy: "reject" })` entry, so the wire protocol is MCP `2026-07-28`. A child-process contract test negotiates `server/discover` and asserts that revision. The MCP protocol core is treated as stateless: protocol discovery/capability negotiation is not an identity or authorization session. A later team deployment may add authenticated Streamable HTTP without changing tool schemas or authoring behavior.

## 2. Host execution context

An MCP client MUST NOT supply or assert its actor, task, branch, grant, or binding as tool arguments. The local stdio host first registers a short-lived pending request over a non-browser loopback pairing channel and can complete protocol discovery without mutation authority. The Header panel shows only its redacted label, expiry, and verification code. After explicit human confirmation, the Studio service mints an opaque `HostBinding` and delivers the raw token directly to that waiting host connection. Browser responses, DOM, URLs, clipboard setup, storage, logs, and public resources never receive it. The service stores only its SHA-256 digest. The stdio bridge then presents the token only on its private loopback service channel; the service resolves it to an immutable project/task/branch/grant tuple and injects execution context for each invocation. The bridge does not open the database directly. Connection lifetime, discovery, request envelopes, client identity metadata, and protocol initialization do not confer mutation rights.

The host/gateway binding contains an agent identity plus `projectId`, `taskId`, `branchId`, and `grantId`. The gateway first compares the agent-supplied target `projectId` with the bound project. It then calls the application with the following separate trusted execution context:

- `actor`: authenticated `{ id, kind: "agent", displayName }`;
- `taskId`: human-created objective and audit grouping;
- `branchId`: bound branch coordinate (Checkpoint 1 has no isolated branch heads yet);
- `grantId`: immutable human-minted authority;
- `correlationId`: optional end-to-end trace across tool, command, future job, and event.

The application command/read DTO separately contains the requested `projectId`. It rejects authority fields in that DTO and authorizes the requested project against the injected grant context.

Each invocation is evaluated independently against the host-injected context and current grant state. Agent-supplied target IDs are matched against that context; they cannot widen it. The agent cannot create, widen, renew, select, or override a grant. Revocation takes effect before the next command/job step; queued jobs re-check authority at documented safe boundaries.

C1A grants are historical records after migration and are forced to `LEGACY_UNBOUND`; they never become host credentials. A 1B human grant and its HostBinding coordinates are immutable. Narrowing, widening, or renewing a grant revokes its existing HostBindings, creates a new grant after required confirmation, and requires a new private host approval. `Off` revokes every active HostBinding; an old token can never be aligned to a later grant or silently resurrected.

### Grant fields

The accepted Checkpoint 1 application record uses `id`, `agentId`, `taskId`, `branchId`, `scopes`, `objectScopes`, `budget`, `usage`, expiry/issue/revocation fields, and `status`. The following is the richer target projection vocabulary; adapters must version any transition rather than silently changing the accepted schema:

```json
{
  "grantId": "grant_...",
  "issuerActorId": "user_...",
  "subjectActorId": "agent_...",
  "projectId": "project_...",
  "taskId": "task_...",
  "branchId": "branch_...",
  "capabilities": ["source:write", "asset:write", "validate:run"],
  "objectScopes": [{ "kind": "asset-family", "id": "family_hygiene" }],
  "budget": { "maxCommands": 100, "maxJobs": 10, "maxArtifactBytes": 524288000 },
  "expiresAt": "2026-08-21T18:00:00Z",
  "issuedAtRevision": "rev_...",
  "status": "ACTIVE"
}
```

Capability families include read, source write/approve, generation execute, atlas write, asset write/finalize, room write/finalize, level write/finalize, validation run/disposition, export build/materialize, and publish. Provider cost and artifact-byte budgets are enforced in addition to ordinary command/job budgets. `publish` is never implied by another capability.

### Header Agent access relationship

The Header Agent access selector is a human UI for requesting a posture and inspecting the service-returned effective policy. In Checkpoint 1B, `Off`, `Read only`, and semantic `Execute scoped task` are implemented service operations; the accepted compact visible label for the latter is `Scoped run`. `Propose in draft` remains visible but grants nothing until isolated branch heads exist; otherwise it would falsely commit to the shared head. `Custom…` likewise grants nothing until its detailed human-only editor exists. The service may issue/select/revoke a concrete grant only after authenticating and authorizing that human request. Grant posture and host authorization are displayed separately: an active posture without an authorized binding does not imply that an agent is connected.

The selected label, DOM state, URL, browser storage, and UI request payload are not MCP authority. A host approval request may name only a short-lived `pendingHostId`, explicit confirmation, and idempotency key; actor/task/branch/grant/scopes/budget/token/publish fields are rejected. The trusted service independently binds current actor/task/grant context to each invocation and revalidates it. A revoked/expired/denied selector state grants nothing; `SERVICE_UNAVAILABLE` fails closed. The selector never supplies publish authority and its human-only grant/pair/revoke operations are not advertised as MCP tools.

## 3. Resources

Resources are the preferred way to discover and inspect current state. All resources enforce project/object read scope and expose their projection revision.

### Implemented resource templates

```text
studio://projects/{projectId}
studio://projects/{projectId}/jobs/{jobId}
studio://projects/{projectId}/assets/{assetId}
```

The first template returns the current authorized, redacted project-head projection. The job template returns the same project-scoped, authority-checked, redacted projection as `studio_job_read`, including structured progress/events and output preview resource links when they are live. The asset template returns the same bounded, project-scoped V2 asset projection as `studio_asset_query`, including immutable slice lineage, typed metadata, findings, and proposal provenance. Before the complete v9 feature gate, discovery remains exactly the accepted two project/job templates. With the gate live, it is exactly these three templates; the server does not advertise resource listing or any other URI pattern.

### Planned Authoring v2 resource surface

The patterns below are the intended versioned surface as their owning checkpoints are implemented. They MUST NOT be described as discoverable or usable until runtime registration and contract tests exist.

Target URI patterns:

```text
studio://projects
studio://projects/{projectId}/production-board
studio://projects/{projectId}/capabilities
studio://projects/{projectId}/activity?after={cursor}
studio://projects/{projectId}/branches/{branchId}
studio://projects/{projectId}/revisions/{revisionId}
studio://projects/{projectId}/revisions/{revisionId}/diff?to={revisionId}
studio://projects/{projectId}/sources/{sourceId}
studio://projects/{projectId}/processing-recipes/{recipeId}
studio://projects/{projectId}/atlases/{atlasId}
studio://projects/{projectId}/assets/{assetId}
studio://projects/{projectId}/rooms/{roomId}
studio://projects/{projectId}/levels/{levelId}
studio://projects/{projectId}/level-requirements/{requirementSetId}
studio://projects/{projectId}/levels/{levelId}/actors
studio://projects/{projectId}/levels/{levelId}/logic
studio://projects/{projectId}/tasks/{taskId}
studio://projects/{projectId}/validation?revision={revisionId}
studio://projects/{projectId}/candidates/{candidateId}
studio://artifacts/sha256/{digest}
```

When implemented, list resources return summaries and pagination cursors. Detail resources return versioned JSON projections plus resource links to large previews/artifacts. Image bytes are fetched through a resource/artifact URI; they are never embedded as base64 in JSON.

Asset summaries include a small authorized `previewResource` when available and a structured `previewState` otherwise (`PROCESSING`, `MISSING`, `UNSUPPORTED`, or `LOAD_FAILED`) so clients can render the same deterministic kind-aware fallback. A preview failure never removes the semantic asset resource.

Resources that describe mutable heads MUST include `revisionId`, aggregate `version`, and `etag`/content hash so an agent can construct safe mutations.

The project-capabilities projection is the MCP view of the versioned
`ProjectCapabilityManifest`. It tells a clean agent which modules, coordinate
model, asset kinds, actor/logic vocabulary, validators/compiler operations,
limits, output formats, and adapter extensions are actually available. Tool
descriptions are never the authority; execution revalidates the same manifest.

## 4. Tool design rules

1. Tools represent semantic user intent, not tables, rows, arbitrary patches, paths, or clicks.
2. Prefer one validated batch operation over hundreds of chat round trips when the batch has one coherent intent and atomicity boundary.
3. Every mutation supports `dryRun` and uses the common mutation envelope.
4. Every mutation requires `baseRevision`, target `expectedVersion`, and `idempotencyKey`; the trusted host injects actor/task/grant authority outside the tool arguments.
5. Tools return concise structured results plus resource links. They do not return entire projects or large images.
6. Validation findings use stable rule IDs and machine-readable locations.
7. Destructive-looking operations are modeled as new revisions, archive states, or explicit garbage-collection jobs—not history deletion.
8. Tools that may exceed a short request return a durable `jobId` immediately.
9. A tool schema change requires a versioned DTO or additive backward-compatible extension and contract tests.
10. A project advertises only tools supported by its versioned capability manifest; unsupported operations fail closed at discovery and execution.
11. Every ordinary UI authoring action maps to the same semantic command as its MCP operation. Canvas coordinates, DOM selectors, editor clicks, and raw engine files are never MCP intent.
12. Efficient batch/replace-draft tools declare one atomic boundary, per-item findings, expected versions, idempotency, and complete budget accounting.

## 5. Common mutation envelope and result

### Implemented Checkpoint 1 command input

The command type is fixed by the selected MCP tool. The accepted runtime schema uses integer revisions, puts semantic fields in `payload`, and rejects authority fields and unknown properties:

```json
{
  "schemaVersion": 1,
  "commandId": "cmd_...",
  "idempotencyKey": "unique-per-logical-command",
  "projectId": "project_...",
  "baseRevision": 4,
  "expectedVersion": 4,
  "dryRun": false,
  "payload": {}
}
```

Before dispatch, the trusted host combines those target/concurrency fields with its authenticated execution context:

```json
{
  "actor": { "id": "agent_...", "kind": "agent", "displayName": "Atlas Agent" },
  "taskId": "task_...",
  "grantId": "grant_...",
  "branchId": "branch_...",
  "correlationId": "corr_..."
}
```

The second object is never accepted from MCP tool arguments. A target project mismatch is denied before application dispatch. Branch authority is host-injected and therefore cannot appear in the agent-supplied input.

Implemented committed result:

```json
{
  "schemaVersion": 1,
  "projectId": "project_...",
  "revision": 5,
  "value": {},
  "event": {},
  "replayed": false
}
```

An idempotent replay has the same shape with `replayed: true`. A dry run leaves the persisted revision unchanged, returns `event: null`, `dryRun: true`, and a `proposal` containing the predicted revision, summary, changes, findings, and required capabilities.

The richer `APPLIED`/`PROPOSED` result with changed-resource links, review disposition, and the async `ACCEPTED` job result is the planned V1 target. It is not the accepted Checkpoint 1 result schema.

## 6. Tool catalog

Names below are the intended stable semantic surface. Checkpoint implementation status must be discoverable from the server; an unavailable future tool is not advertised.

### Always advertised from the accepted Checkpoint 1B surface

- `studio_command_catalog_list` — read the exact command definitions exposed to agents;
- `studio_project_read` — read the authorized redacted project head;
- `studio_project_status_set` — update the project lifecycle state;
- `studio_source_register` — register a CAS-backed PNG/WebP source with Checkpoint 1 provenance fields;
- `studio_asset_define` — define a draft/in-review `surface`, `prop`, or `item` crop from a registered source.

`studio_project_create` is a human-only application command and is deliberately filtered from the official agent catalog. Grant issue/revoke commands are likewise owner-only and never advertised to agents.

### Additive accepted Checkpoint 2A surface when durable audit is live

- `studio_source_intake_commit` — atomically claim a project-scoped staged intake and create a V2 source with validated provider-neutral provenance;
- `studio_source_review_propose` — move a newly imported/generated V2 source into explicit owner review without deciding it.

These tools are advertised only when the launcher and running SQLite service declare the attempt ledger live. The private service checks that condition again before dispatch, so a forged launcher flag cannot bypass it. `studio_source_intake_commit` requires the distinct `source.intake.commit` capability, project object scope, command budget, and artifact-byte budget. `studio_source_review_propose` requires `source.review.propose`. The tool input references an already staged project intake and canonical CAS metadata; it never accepts binary bytes, a local path, provider credential, or arbitrary external artifact location.

Owner-only `source.review.decide` is used by the human UI and is never advertised. With the audit store live but no durable job store, discovery is exactly seven tools and one project resource template. With the audit flag absent, the accepted five-tool surface remains and the two source mutations fail closed from discovery.

### Accepted Checkpoint 2B surface when durable audit and jobs are live

- `studio_atlas_propose_grid` — read-only calculation of a non-authoritative regular-grid proposal against an approved source revision;
- `studio_atlas_define_rects` — commit exact authoritative rectangles, inclusion, pivots, and explicit recut mapping;
- `studio_atlas_preview_slices` — atomically create the semantic input revision and one durable `ATLAS_PREVIEW` job with its complete budget charge;
- `studio_atlas_commit_slices` — atomically promote a succeeded job's verified outputs to stable slice heads/versions and mark it `APPLIED`;
- `studio_job_read` — read the redacted project-scoped job projection and resource links;
- `studio_job_cancel` — idempotently request cooperative cancellation of queued/running work;
- `studio_job_retry` — idempotently queue the next attempt for failed/cancelled work, with `expectedAttempt` and a three-attempt ceiling;
- `studio_job_discard` — idempotently release temporary outputs from terminal unapplied work and mark it `DISCARDED`.

Together with the accepted seven tools, the audit/job-ready official server advertises exactly 15 tools and the two project/job resource templates above. `studio_job_cancel`, `studio_job_retry`, and `studio_job_discard` require the original agent task/object authority and commit their `AUTHORIZED` attempt record atomically with the job transition. Job read and resource read are project-scoped. No job schema accepts actor/task/branch/grant identity, bytes, base64, credentials, local paths, or arbitrary artifact URIs.

### Accepted Checkpoint 2C surface when audit, jobs, and schema v9 are live

- `studio_asset_proposal_submit` — submit one bounded ordered V2 asset proposal against exact committed slice versions; every item is charged against `maxCommands` and requires the narrow `asset.proposal.submit` scope;
- `studio_asset_query` — read-only bounded filter/query of V2 asset heads, findings, and optionally durable proposal state.

With the complete durable gate live, the official server advertises exactly 17 tools and three resource templates. `studio_asset_proposal_decide`, `studio_asset_proposal_apply`, `studio_asset_lifecycle_set`, bundle import/export, raw binary access, and any owner decision/finalization operation are deliberately absent. Query and detail projections contain current-project preview links only and redact proposer grant/branch authority. Until all three durable gates are true, the two 2C tools and asset resource remain absent and discovery stays exactly 15 tools/two templates.

### Planned foundation and task expansion — Authoring v2

- `studio_project_update_settings` — update generic project settings through versioned fields.
- `studio_task_submit` — mark an agent branch ready for review with summary and evidence links.
- `studio_validation_run` — validate a revision or scoped target, synchronously or as a job.
- `studio_revision_revert` — create a compensating revision; requires explicit capability.
- `studio_batch_execute` — atomically execute a bounded list of supported commands after validating the whole batch.

Grant mint/revoke endpoints exist for the authenticated human UI/service API. They MUST NOT be advertised as agent-callable MCP mutation tools. MCP resources expose the effective, redacted grant so the agent can plan within its authority.

### Authoring v2 source and processing families

- `studio_source_generate`
- `studio_source_register_generation`
- `studio_processing_recipe_define`
- `studio_processing_recipe_preview`
- `studio_processing_recipe_apply`
- `studio_processing_result_adopt`

`studio_source_generate` invokes a configured provider as a durable job, requires generation authority and budget, and never exposes the provider credential. Neither provider operation is implemented or authorized by Checkpoint 2B.

### Authoring v2 asset-library expansion

The accepted 2C boundary deliberately exposes durable proposal submission rather than a general branch/batch wrapper. Direct rename, replacement-slice mapping, agent lifecycle/finalization, and partial-success batches remain later work. A future batch tool must return per-item findings and preserve one documented atomic boundary; it cannot use `atomic: false` unless the contract explicitly reports a revision for every accepted subgroup.

### Room and hallway tools — accepted Checkpoint 3

Schema v10 advertises exactly two additive room tools, for a total of 19 tools and four resource templates:

- `studio_room_placement_proposal_submit` — the only agent room mutation; submits 1–64 complete add/move/remove placement items against one exact DRAFT room version and charges one command per item;
- `studio_room_query` — bounded project/room/lifecycle/archetype query with optional immutable versions and redacted proposal state.

The room detail resource is `studio://projects/{projectId}/rooms/{roomVariantId}`. Without an actual task binding, direct create, resize, intent, connector, placement, warning-disposition, validation, finalization, fork, proposal-decision, and proposal-apply controls remain authenticated human UI/service commands and are deliberately absent from MCP. Placement records reference exact semantic `assetId`/`assetVersion`/`metadataVersion`, layer, cell anchor, and cardinal rotation; they never reference a loose filename or current asset head as authority.

### Delegated task branch tools — accepted Checkpoint 4

The default schema-v10 discovery surface remains exactly 19 tools and four resource templates. Only when the private gateway has resolved a live HostBinding to a real matching Checkpoint 4 task branch does discovery advertise exactly 30 tools and five resource templates. The additive task-bound tools are:

- `studio_room_archetype_create`
- `studio_room_variant_create`
- `studio_room_variant_intent_set`
- `studio_room_variant_resize`
- `studio_room_variant_connectors_set`
- `studio_room_variant_placements_add`
- `studio_room_variant_placements_move`
- `studio_room_variant_placements_remove`
- `studio_room_variant_validate`
- `studio_task_read`
- `studio_task_submit_for_review`

The fifth resource is `studio://projects/{projectId}/task`. The task identity comes from the trusted HostBinding, never from a caller-selectable URI segment. It projects the bound task, redacted authority/budget, timeline, and current review without the grant ID. Every direct room mutation is executed by `AgentTaskService` against the isolated compare-and-swap branch store; calling `StudioService` on `branch.main` with task coordinates fails `TASK_BRANCH_REQUIRED`.

Warning disposition, asset/room finalization, grant issue/revoke, review decision, task control, merge, compensating revert, portable bundle operations, Numberdroid export, materialization, and publish remain absent from agent discovery. The branch rejects `source.intake.commit`, `atlas.preview.slices`, and `atlas.commit.slices` because those commands consume shared CAS/job state whose accepted v8 foreign keys are main-revision-bound. An agent task may consume already committed atlas/slice results; Checkpoint 2B jobs retain their separate scoped read/cancel/retry/discard surface.

### Requirements, level, actor, and logic tools — Authoring v2

The final names and grouping are frozen only with their DTO schemas. The required
semantic families are:

- project capability read and version negotiation;
- level requirement create/update/validate and coverage query;
- level graph create and semantic space/connection/path/zone edits;
- exact-version asset placement and set-dressing batches;
- actor instance, archetype reference, route, pickup/drop, and spawn edits;
- typed variable definition and trigger/condition/action graph edits;
- static validation, bounded explanatory simulation, and canonical adapter/compiler validation;
- immutable candidate plan/build/read and submit-for-review.

Representative names may include `studio_level_requirements_define`,
`studio_level_graph_update`, `studio_level_actors_update`,
`studio_level_routes_update`, `studio_level_logic_update`,
`studio_level_validate`, `studio_level_simulate`, and
`studio_candidate_build`. A coherent atomic replace-draft or batch operation is
preferred over hundreds of single-node calls when it preserves typed references,
per-item findings, revision conflicts, and budget accounting.

`studio_candidate_build` never implies owner acceptance, merge, materialization,
commit, or publication. `studio_engine_materialize`, repository commit, and publish
operations remain human-only and are not advertised to agents.

### Animation tools — Authoring v2 optional module

- `studio_animation_create_clip`
- `studio_animation_update_frames`
- `studio_animation_update_timing`
- `studio_animation_preview`
- `studio_animation_finalize`

Animation tools preserve the parent asset and placement identities.

## 7. Planned batch and transaction semantics

`studio_batch_execute` is not implemented in Checkpoint 1. When introduced, it accepts ordered semantic subcommands, a single base revision, limits, and an `atomic` mode. In atomic mode the service:

1. authorizes the union of capabilities and object scopes;
2. checks all expected versions;
3. evaluates every command against the evolving in-memory transaction state;
4. validates the final state;
5. either commits one revision containing all events or commits nothing.

The result maps each input operation to events/findings and returns one revision. Batches have maximum operation count, payload size, estimated artifact bytes, and execution cost. Oversized work becomes a durable job or must be partitioned explicitly.

An agent cannot use a broad batch wrapper to bypass a missing capability for a contained command.

## 8. Checkpoint 2B durable atlas jobs

`studio_atlas_preview_slices` returns immediately after the semantic input revision and durable job have committed atomically:

```json
{
  "status": "ACCEPTED",
  "jobId": "job_...",
  "jobResource": "studio://projects/project_.../jobs/job_...",
  "inputRevisionId": "revision:6"
}
```

Agents follow progress through `studio_job_read` or `studio://projects/{projectId}/jobs/{jobId}`. Job events include state, attempt, monotonic sequence, completed/total units, safe point, and redacted details. Succeeded outputs contain exact digest, media type, byte size, dimensions, rectangle identity, and a same-origin preview resource URI; they never contain image bytes, base64, local paths, grant IDs, or unsanitized failures.

Job controls:

- `studio_job_cancel` — cooperative cancellation within the original task/grant/object scope;
- `studio_job_retry` — new attempt with the same immutable input after expected-attempt and three-attempt-limit checks;
- `studio_job_discard` — release temporary outputs from `SUCCEEDED`, `FAILED`, or `CANCELLED` work that was not applied.

The complete state set is `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `APPLIED`, and `DISCARDED`. There is no `WAITING_FOR_USER` state and no `studio_job_respond`. A retry never switches to a newer project head. `studio_atlas_commit_slices` compare-and-swaps the exact input/fingerprint/output contract and moves `SUCCEEDED` to `APPLIED`; definition changes require the prior preview to be applied or discarded. Cancellation, retry, discard, output publication, and apply recheck immutable creator authority at their safe boundaries. Authorized job-control audit and the state transition share one SQLite transaction.

## 9. Errors and conflicts

Tool errors use stable codes and structured recovery details. Checkpoint 1 currently uses application codes such as `UNTRUSTED_AGENT_CONTEXT`, `CONTEXT_PROJECT_MISMATCH`, `GRANT_REVOKED`, `GRANT_SCOPE_MISSING`, `OBJECT_SCOPE_DENIED`, `BUDGET_EXCEEDED`, `PROJECT_NOT_FOUND`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, and `SCHEMA_VERSION_UNSUPPORTED`, wrapped in the official structured MCP error result. The following is the normalized target vocabulary; renaming an accepted code requires a versioned compatibility decision:

- `AUTHENTICATION_REQUIRED`
- `GRANT_REQUIRED`
- `GRANT_EXPIRED`
- `GRANT_REVOKED`
- `CAPABILITY_DENIED`
- `OBJECT_SCOPE_DENIED`
- `BUDGET_EXCEEDED`
- `PROJECT_NOT_FOUND`
- `RESOURCE_NOT_FOUND`
- `SCHEMA_VERSION_UNSUPPORTED`
- `VALIDATION_FAILED`
- `BASE_REVISION_STALE`
- `VERSION_CONFLICT`
- `IDEMPOTENCY_KEY_REUSED`
- `ARTIFACT_INTEGRITY_FAILED`
- `JOB_NOT_CANCELLABLE`
- `PUBLISH_CONFIRMATION_REQUIRED`
- `INTERNAL_ERROR`

The accepted `REVISION_CONFLICT` includes expected and actual integer revisions and never applies a partial mutation. A future richer concurrency result may add a diff or resource URI suitable for replanning. Internal errors do not expose secrets, stack traces, or arbitrary local paths.

Protocol/tool invocation failure is distinct from a successful command that produced validation findings. Blocking findings use a normal structured result when the request was valid and fully evaluated.

## 10. Human-visible agent operation

Accepted semantic commands append to the revision Activity timeline with actor/task/revision attribution. Accepted Checkpoint 2A also records exactly one final `DENIED` or `FAILED` row for every mutation attempt that reaches `/internal/mcp/execute` after a valid HostBinding resolves trusted project and actor context. Only stable error codes and allowlisted scalar details are retained; prompts, idempotency keys, tokens, grant IDs, artifact URIs, payloads, and paths are excluded. The UI merges these rows into the chronological Activity projection without inventing a semantic revision.

There are deliberately no non-atomic request `STARTED`/`COMMITTED` rows: successful commands already have atomic semantic Activity, and an audit-write failure on a denied/failed attempt makes that call fail closed. Invalid/missing bearer tokens, pairing failures, and other pre-binding traffic stay in redacted operational security logs because no trusted project/actor exists to attribute. That boundary is the exact 2A closure of `AGT-008`, not a claim of complete request/job telemetry.

The target V1 activity timeline displays every MCP tool call that reaches application policy, with:

- authenticated actor and task;
- requested semantic command and target summary;
- grant/capability decision without secret material;
- dry-run/applied/denied/failed/cancelled status;
- base/result revisions and idempotent replay marker;
- duration, job/correlation IDs, findings, and changed resource links;
- review disposition (`PENDING`, `USER_ACCEPTED`, `USER_REJECTED`, `CHANGES_REQUESTED`, or `AUTO_ACCEPTED_BY_POLICY`).

The accepted user can revoke the grant/HostBinding from the Header. Checkpoint 2B adds visible read/cancel/retry/discard controls for its atlas-preview jobs, and the agent receives the equivalent scoped MCP operations. Accepted Checkpoint 4 activates `Propose in draft` only when a real matching task branch exists; without that task it retains the protected `DRAFT_BRANCH_NOT_AVAILABLE_1B` fail-closed result. Review decision, merge, and owner-history revert are human service/UI actions rather than MCP tools. Checkpoint 4.5 keeps room-shape replacement owner-only and absent from both accepted discovery surfaces. Authoring v2 must add ordinary shape/level/actor/logic drafting on isolated task branches without adding owner review, merge, activation, materialization, or publication authority.

## 11. Security invariants

- Agent-visible tools cannot mint/widen grants, change their actor ID, escape their project/branch, or select an arbitrary storage/export path.
- Resource reads are authorized independently from tool calls.
- Host credentials, grant IDs, and transport credentials are not returned in logs or broad resources; agents receive only a redacted effective-policy view sufficient to plan allowed work.
- Browser-visible MCP launcher setup is secret-free. Raw HostBinding material crosses only the pending host's loopback pairing connection and the private host-to-service channel; it is never persisted in plaintext.
- Agent project reads omit the complete grant collection. A successful Checkpoint 1 read returns only the caller's active `effectivePolicy` (`taskId`, `branchId`, scopes, object scopes, budget/usage, `status: "active"`, and expiry), without its grant ID or any foreign agent/grant data. Revoked or expired grants are rejected before a projection is returned; separate redacted Header projections communicate inactive states to the human UI.
- All identifiers are parsed as opaque values; no URI/path segment becomes a filesystem path without adapter validation.
- Source intake enforces PNG/WebP media, a 16 MiB and 4096×4096 synchronous bound, claimed digest verification, project-scoped staged ownership, and no path-bearing input. Generic CAS operations retain their separately configured limits.
- Tool descriptions are not authority. Server policy is the only authorization source.
- Prompt or source metadata is untrusted content and cannot redefine capabilities or system behavior.
- Publish requires a separate short-lived grant and explicit snapshot/manifest identity.

Client cancellation is propagated through the official MCP request context, the local HTTP bridge, and the application service. Reads and synchronous mutations check cancellation before persistence and immediately before their atomic write. Once an atomic store call has begun it is not interrupted: the client may no longer know whether that one commit completed, so it MUST retry the same logical command with the same idempotency key. The replay then returns the original committed revision or proves that no commit occurred; cancellation never licenses a second mutation. Atlas jobs additionally persist a cancel request and stop cooperatively before claim, before each crop/output publication, or at the next documented worker safe point; they do not interrupt an atomic output or semantic-apply transaction.

## 12. MCP acceptance and adversarial tests

Checkpoint 1A adapter tests proved that tool definitions map to the shared application commands, trusted host execution context supplies actor/task/grant authority, agent payloads cannot override that context, and mutations have the same events/validation as the UI adapter. Those tests alone did not constitute MCP protocol compliance.

Accepted Checkpoint 1B protocol tests continue to prove:

1. the official MCP 2026-07-28 SDK server starts as a clean subprocess, negotiates capabilities, and supports tool/resource discovery through stdio without treating connection state as authorization;
2. a scoped project resource can be read and an out-of-scope resource cannot;
3. the same logical command through UI adapter and MCP produces the same domain events and validation;
4. mutation without, after expiry of, and after revocation of a grant is denied;
5. agent arguments cannot assert actor/grant identity, and a valid host-injected grant cannot be reused across project, task, branch, capability, or object scope;
6. stale revision/version is rejected and returns replan information;
7. identical idempotent retry returns the original result and creates no new event/revision;
8. idempotency-key reuse with changed payload is rejected;
9. cancellation before the atomic store boundary leaves a valid documented revision outcome, and same-key retry resolves an uncertain completion;
10. binary command fields use resource/artifact links rather than base64 payloads;
11. `finalize`, `export`, and `publish` do not follow from ordinary write access;
12. accepted agent commands are visible with true actor/task/revision attribution;
13. cross-project IDs, unknown schema fields, embedded binary data, and malformed/oversized artifact input are rejected safely;
14. stdout contains protocol frames only, while diagnostics are redacted to stderr/structured results; malformed frames and graceful shutdown cannot corrupt Studio state;
15. the accepted surface without the 2A audit-ready flag remains five underscore-named tools and one project resource, and published schemas match runtime validation;
16. the service-backed Header Agent access state matches the effective policy but changing client-side selector state cannot change authorization;
17. Asset Library cards receive an authorized preview URI or an explicit fallback state, never a local path or embedded bitmap;
18. replacing the 1A host-only adapter with stdio preserves the protected baseline's semantic command results, actor attribution, revisions, and activity projection.

Accepted Checkpoint 2A extends those tests with exact seven-tool audit-ready discovery; distinct intake/review scopes; project object and artifact-byte budgets; staged-intake claim/recovery; canonical source and lineage references; bounded discriminated provenance; human-only decision; final-only redacted denied/failed Activity; audit-write fail-closed behavior; and byte-identical Family Hygiene preview/reopen evidence.

Accepted Checkpoint 2B extends them with exact 15-tool/two-template discovery; non-authoritative grid proposal; source-resolution rectangle validation; deterministic pinned PNG outputs; semantic/job creation atomicity; complete one-time budget charge; job/resource read equivalence; cancel/retry/discard idempotency; three-attempt enforcement; immutable creator-task authority; revoked/expired/cross-task denial; authorized-control audit atomicity; worker lease recovery and stale-worker exclusion; sanitized failures; exact output metadata and reference ownership; atomic semantic apply; restart/recovery; state-specific integrity; snapshot-consistent backup; and quiesced shutdown.

The following target checks remain for the checkpoint that introduces the feature: general atomic batch rollback and batch budget accounting; source/atlas/asset detail resources beyond the current project/job templates; capability-driven Authoring v2 discovery; and the complete image-to-asset and requirements-to-candidate task flows.

Authoring v2 must additionally prove:

1. a clean agent can discover the exact Numberdroid capability manifest and required inputs without repository or UI knowledge;
2. unsupported module/tool/type/extension use fails closed at discovery and execution;
3. multiple Artist/Level Designer tasks can share immutable artifacts while isolated branch mutations, dependencies, stale versions, and semantic conflicts remain explicit;
4. a headless agent can author processing recipes/assets and level layout/actors/routes/pickups/variables/logic, run validation/compiler checks, build an immutable candidate, and submit it for review;
5. requirement coverage and candidate traceability identify exact requirements, revisions, recipes, artifacts, adapter/compiler versions, findings, and hashes;
6. no agent can decide owner review, merge, activate a restored copy, choose an arbitrary destination, materialize, commit, or publish;
7. the Numberdroid reference scenario (routed actor, defeat, key drop, collection, state change, visible text) round-trips through resources and commands; and
8. after the Numberdroid vertical proof, one thin Godot 2D/Tower Defense fixture uses the same core command/candidate contracts with a different capability profile.

Later checkpoints extend this same suite for every advertised authoring tool. A tool is not considered delivered merely because it appears in documentation; it must be capability-discoverable, schema-tested, authorized, observable, and exercised end to end.
