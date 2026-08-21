# Numberdroid Studio — MCP Contract

## 1. Purpose

The MCP server is a first-class Studio client for agents. It exposes the same semantic application commands and versioned read projections as the visual UI. It is not a filesystem proxy, database console, image-payload tunnel, or UI automation layer.

Checkpoint 1B MUST implement MCP 2026-07-28 through the official maintained SDK. The protocol SDK and transport remain replaceable adapters; Studio command semantics do not depend on a specific MCP revision. Checkpoint 1A contains only a host-injected agent adapter/tool catalog and MUST NOT be described as a complete MCP server.

The Checkpoint 1A visual/interaction shell was accepted by the user on 2026-08-21 and remains the protected baseline. Adding the official transport MUST preserve the accepted command outcomes, activity visibility, and host-injected authority semantics; it is a transport implementation, not a permission-model rewrite or UI redesign.

Initial 1B transport: local stdio. It MUST use the official SDK v2 `serveStdio(() => buildServer(), { legacy: "reject" })` entry so the wire protocol is actually MCP `2026-07-28`; directly connecting `McpServer` to `StdioServerTransport` is insufficient because that path remains the legacy era. A child-process contract test MUST negotiate `server/discover` and assert `2026-07-28`. The MCP protocol core is treated as stateless: protocol discovery/capability negotiation is not an identity or authorization session. A later team deployment may add authenticated Streamable HTTP without changing tool schemas or authoring behavior.

## 2. Host execution context

An MCP client MUST NOT supply or assert its actor, task, branch, grant, or binding as tool arguments. The local stdio host first registers a short-lived pending request over a non-browser loopback pairing channel and can complete protocol discovery without mutation authority. The Header panel shows only its redacted label, expiry, and verification code. After explicit human confirmation, the Studio service mints an opaque `HostBinding` and delivers the raw token directly to that waiting host connection. Browser responses, DOM, URLs, clipboard setup, storage, logs, and public resources never receive it. The service stores only its SHA-256 digest. The stdio bridge then presents the token only on its private loopback service channel; the service resolves it to an immutable project/task/branch/grant tuple and injects execution context for each invocation. The bridge does not open the database directly. Connection lifetime, discovery, request envelopes, client identity metadata, and protocol initialization do not confer mutation rights.

The injected execution context consists of:

- `actorId`: authenticated agent identity;
- `projectId`: project boundary;
- `taskId`: human-created objective and audit grouping;
- `branchId`: normally a task-specific draft branch;
- `grantId`: immutable human-minted authority;
- `correlationId`: end-to-end trace across tool, command, job, and event.

Each invocation is evaluated independently against the host-injected context and current grant state. Agent-supplied target IDs are matched against that context; they cannot widen it. The agent cannot create, widen, renew, select, or override a grant. Revocation takes effect before the next command/job step; queued jobs re-check authority at documented safe boundaries.

C1A grants are historical records after migration and are forced to `LEGACY_UNBOUND`; they never become host credentials. A 1B human grant and its HostBinding coordinates are immutable. Narrowing, widening, or renewing a grant revokes its existing HostBindings, creates a new grant after required confirmation, and requires a new private host approval. `Off` revokes every active HostBinding; an old token can never be aligned to a later grant or silently resurrected.

### Grant fields

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

### Header Agent mode relationship

The Header Agent mode selector is a human UI for requesting a posture and inspecting the service-returned effective policy. In Checkpoint 1B, `Off`, `Read only`, and `Execute scoped task` are implemented service operations. `Propose in draft` remains visible but grants nothing until isolated branch heads exist; otherwise it would falsely commit to the shared head. `Custom…` likewise grants nothing until its detailed human-only editor exists. The service may issue/select/revoke a concrete grant only after authenticating and authorizing that human request. Grant posture and host authorization are displayed separately: an active posture without an authorized binding does not imply that an agent is connected.

The selected label, DOM state, URL, browser storage, and UI request payload are not MCP authority. A host approval request may name only a short-lived `pendingHostId`, explicit confirmation, and idempotency key; actor/task/branch/grant/scopes/budget/token/publish fields are rejected. The trusted service independently binds current actor/task/grant context to each invocation and revalidates it. A revoked/expired/denied selector state grants nothing; `SERVICE_UNAVAILABLE` fails closed. The selector never supplies publish authority and its human-only grant/pair/revoke operations are not advertised as MCP tools.

## 3. Resources

Resources are the preferred way to discover and inspect current state. All resources enforce project/object read scope and expose their projection revision.

Canonical URI patterns:

```text
studio://projects
studio://projects/{projectId}
studio://projects/{projectId}/production-board
studio://projects/{projectId}/activity?after={cursor}
studio://projects/{projectId}/branches/{branchId}
studio://projects/{projectId}/revisions/{revisionId}
studio://projects/{projectId}/revisions/{revisionId}/diff?to={revisionId}
studio://projects/{projectId}/sources/{sourceId}
studio://projects/{projectId}/atlases/{atlasId}
studio://projects/{projectId}/assets/{assetId}
studio://projects/{projectId}/rooms/{roomId}
studio://projects/{projectId}/levels/{levelId}
studio://projects/{projectId}/tasks/{taskId}
studio://projects/{projectId}/jobs/{jobId}
studio://projects/{projectId}/validation?revision={revisionId}
studio://projects/{projectId}/exports/{snapshotId}
studio://artifacts/sha256/{digest}
```

List resources return summaries and pagination cursors. Detail resources return versioned JSON projections plus resource links to large previews/artifacts. Image bytes are fetched through a resource/artifact URI; they are never embedded as base64 in JSON.

Asset summaries include a small authorized `previewResource` when available and a structured `previewState` otherwise (`PROCESSING`, `MISSING`, `UNSUPPORTED`, or `LOAD_FAILED`) so clients can render the same deterministic kind-aware fallback. A preview failure never removes the semantic asset resource.

Resources that describe mutable heads MUST include `revisionId`, aggregate `version`, and `etag`/content hash so an agent can construct safe mutations.

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

## 5. Common mutation envelope and result

Agent-supplied tool input:

```json
{
  "schemaVersion": 1,
  "projectId": "project_...",
  "branchId": "branch_...",
  "baseRevision": "rev_...",
  "expectedVersion": 4,
  "idempotencyKey": "unique-per-logical-command",
  "dryRun": false,
  "input": {}
}
```

Before dispatch, the trusted host combines those target/concurrency fields with its authenticated execution context:

```json
{
  "actorId": "agent_...",
  "taskId": "task_...",
  "grantId": "grant_...",
  "authorizedProjectId": "project_...",
  "authorizedBranchId": "branch_...",
  "correlationId": "corr_..."
}
```

The second object is never accepted from MCP tool arguments. A target project or branch mismatch is denied before application dispatch.

Synchronous result:

```json
{
  "schemaVersion": 1,
  "status": "APPLIED",
  "commandId": "cmd_...",
  "revisionId": "rev_...",
  "previousRevisionId": "rev_...",
  "changedResources": ["studio://projects/project_.../assets/asset_..."],
  "activityResource": "studio://projects/project_.../activity?after=event_...",
  "findings": [],
  "reviewDisposition": "PENDING",
  "idempotentReplay": false
}
```

Dry-run returns `status: PROPOSED`, a semantic diff, findings, required capabilities, and predicted affected resources without a revision. Async result returns `status: ACCEPTED`, `jobId`, and its resource URI.

## 6. Tool catalog

Names below are the intended stable semantic surface. Checkpoint implementation status must be discoverable from the server; an unavailable future tool is not advertised.

### Foundation and task tools — Checkpoint 1B

- `studio_project_create` — create a local project and initial revision under a host-authorized workspace scope.
- `studio_project_update_settings` — update generic project settings through versioned fields.
- `studio_task_submit` — mark an agent branch ready for review with summary and evidence links.
- `studio_validation_run` — validate a revision or scoped target, synchronously or as a job.
- `studio_revision_revert` — create a compensating revision; requires explicit capability.
- `studio_batch_execute` — atomically execute a bounded list of supported commands after validating the whole batch.

Grant mint/revoke endpoints exist for the authenticated human UI/service API. They MUST NOT be advertised as agent-callable MCP mutation tools. MCP resources expose the effective, redacted grant so the agent can plan within its authority.

### Source and atlas tools — Checkpoint 2

- `studio_source_import`
- `studio_source_generate`
- `studio_source_register_generation`
- `studio_source_propose_review`
- `studio_atlas_propose_grid`
- `studio_atlas_define_rects`
- `studio_atlas_preview_slices`
- `studio_atlas_commit_slices`

`studio_source_generate` invokes a configured provider as a durable job, requires generation authority and budget, and never exposes the provider credential. `studio_atlas_propose_grid` may use image analysis but cannot mark rectangles authoritative. `studio_atlas_commit_slices` receives explicit integer rectangles and produces artifact/resource URIs.

### Asset library tools — Checkpoint 2

- `studio_asset_create_from_slices`
- `studio_asset_update_metadata`
- `studio_asset_rename_aliases`
- `studio_asset_map_replacement_slice`
- `studio_asset_finalize`

Batch tools return per-item findings while committing atomically by default. A caller may request `atomic: false` only where the tool contract explicitly supports partial success and reports a revision per accepted subgroup.

### Room and hallway tools — Checkpoint 3

- `studio_room_create`
- `studio_room_update_intent`
- `studio_room_resize`
- `studio_room_place_assets`
- `studio_room_move_placements`
- `studio_room_remove_placements`
- `studio_room_update_connectors`
- `studio_room_finalize`

Placement tools reference semantic `assetId`, transforms, layer, cells/anchor, and optional variant. They never reference a loose filename as the identity.

### Level and export tools — later V1

- `studio_level_create`
- `studio_level_place_rooms`
- `studio_level_connect_rooms`
- `studio_level_finalize`
- `studio_export_plan`
- `studio_export_build_candidate`
- `studio_export_materialize`
- `studio_publish_execute`

These operations require increasingly narrow capabilities. `build_candidate` never implies `materialize`; `materialize` never implies `publish`.

### Animation tools — V2

- `studio_animation_create_clip`
- `studio_animation_update_frames`
- `studio_animation_update_timing`
- `studio_animation_preview`
- `studio_animation_finalize`

Animation tools preserve the parent asset and placement identities.

## 7. Batch and transaction semantics

`studio_batch_execute` accepts ordered semantic subcommands, a single base revision, limits, and an `atomic` mode. In atomic mode the service:

1. authorizes the union of capabilities and object scopes;
2. checks all expected versions;
3. evaluates every command against the evolving in-memory transaction state;
4. validates the final state;
5. either commits one revision containing all events or commits nothing.

The result maps each input operation to events/findings and returns one revision. Batches have maximum operation count, payload size, estimated artifact bytes, and execution cost. Oversized work becomes a durable job or must be partitioned explicitly.

An agent cannot use a broad batch wrapper to bypass a missing capability for a contained command.

## 8. Jobs

Long-running tools return:

```json
{
  "status": "ACCEPTED",
  "jobId": "job_...",
  "jobResource": "studio://projects/project_.../jobs/job_...",
  "inputRevisionId": "rev_..."
}
```

Agents follow progress through job resources/subscriptions where supported. Job events include phase, completed/total units when meaningful, findings, artifact links, and whether cancellation is currently safe.

Job controls:

- `studio_job_cancel` — cooperative cancellation within the task/grant scope;
- `studio_job_retry` — new attempt with the same immutable input after retry policy checks;
- `studio_job_respond` — provide requested structured input for `WAITING_FOR_USER` only when the response is within the grant.

A job never switches to a newer project head automatically. Results identify the exact input revision and become stale if the caller chooses not to merge/apply them.

## 9. Errors and conflicts

Tool errors use stable codes and structured recovery details. Minimum codes:

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

A concurrency error returns the current revision/version and a diff or resource URI suitable for replanning. It never applies a partial patch. Internal errors provide a correlation ID but do not expose secrets, stack traces, or arbitrary local paths.

Protocol/tool invocation failure is distinct from a successful command that produced validation findings. Blocking findings use a normal structured result when the request was valid and fully evaluated.

## 10. Human-visible agent operation

The activity timeline displays every MCP tool call that reaches application policy, with:

- authenticated actor and task;
- requested semantic command and target summary;
- grant/capability decision without secret material;
- dry-run/applied/denied/failed/cancelled status;
- base/result revisions and idempotent replay marker;
- duration, job/correlation IDs, findings, and changed resource links;
- review disposition (`PENDING`, `USER_APPROVED`, `USER_REJECTED`, or `AUTO_ACCEPTED_BY_POLICY`).

The user can revoke the grant and cancel eligible jobs from the visual production board. Agent changes normally remain on their draft branch until an explicit review transition.

## 11. Security invariants

- Agent-visible tools cannot mint/widen grants, change their actor ID, escape their project/branch, or select an arbitrary storage/export path.
- Resource reads are authorized independently from tool calls.
- Host credentials, grant IDs, and transport credentials are not returned in logs or broad resources; agents receive only a redacted effective-policy view sufficient to plan allowed work.
- Browser-visible MCP launcher setup is secret-free. Raw HostBinding material crosses only the pending host's loopback pairing connection and the private host-to-service channel; it is never persisted in plaintext.
- Agent project reads omit the complete grant collection. They return only the caller's `effectivePolicy` (`taskId`, scopes, active/revoked/expired status, and expiry), without its grant ID or any foreign agent/grant data.
- All identifiers are parsed as opaque values; no URI/path segment becomes a filesystem path without adapter validation.
- Imports enforce media type, byte/dimension limits, digest verification, and configured roots/file handles.
- Tool descriptions are not authority. Server policy is the only authorization source.
- Prompt or source metadata is untrusted content and cannot redefine capabilities or system behavior.
- Publish requires a separate short-lived grant and explicit snapshot/manifest identity.

Client cancellation is propagated through the official MCP request context, the local HTTP bridge, and the application service. Reads and synchronous mutations check cancellation before persistence and immediately before their atomic write. Once an atomic store call has begun it is not interrupted: the client may no longer know whether that one commit completed, so it MUST retry the same logical command with the same idempotency key. The replay then returns the original committed revision or proves that no commit occurred; cancellation never licenses a second mutation. Long-running jobs add their own documented cooperative safe points in later checkpoints.

## 12. MCP acceptance and adversarial tests

Checkpoint 1A adapter tests MUST prove that tool definitions map to the shared application commands, trusted host execution context supplies actor/task/grant authority, agent payloads cannot override that context, and mutations have the same events/validation as the UI adapter. These tests do not constitute MCP protocol compliance.

Checkpoint 1B protocol tests MUST prove:

1. the official MCP 2026-07-28 SDK server starts as a clean subprocess, negotiates capabilities, and supports tool/resource discovery through stdio without treating connection state as authorization;
2. a scoped project resource can be read and an out-of-scope resource cannot;
3. the same logical command through UI adapter and MCP produces the same domain events and validation;
4. mutation without, after expiry of, and after revocation of a grant is denied;
5. agent arguments cannot assert actor/grant identity, and a valid host-injected grant cannot be reused across project, task, branch, capability, or object scope;
6. stale revision/version is rejected and returns replan information;
7. identical idempotent retry returns the original result and creates no new event/revision;
8. idempotency-key reuse with changed payload is rejected;
9. atomic batch failure leaves no semantic or budget-consumption partial state;
10. cancellation races leave a valid documented job/revision outcome;
11. binary results are resource/artifact links, never base64 payloads;
12. `finalize`, `export`, and `publish` do not follow from ordinary write access;
13. agent action is visible with true actor and correct review disposition;
14. malformed URIs, path traversal, cross-project IDs, oversized inputs, unknown schema fields, and artifact hash mismatch are rejected safely;
15. stdout contains protocol frames only, while diagnostics are redacted to stderr/structured logs; malformed frames and graceful shutdown cannot corrupt Studio state;
16. only implemented underscore-named tools/resources are advertised and their published JSON schemas match runtime validation;
17. the service-backed Header Agent mode state matches the effective policy but changing client-side selector state cannot change authorization;
18. Asset Library resources return an authorized preview URI or an explicit fallback state, never a local path or embedded bitmap;
19. replacing the 1A host-only adapter with stdio preserves the protected baseline's semantic command results, actor attribution, revisions, and activity projection.

Later checkpoints extend this same suite for every advertised authoring tool. A tool is not considered delivered merely because it appears in documentation; it must be discoverable, schema-tested, authorized, observable, and exercised end to end.
