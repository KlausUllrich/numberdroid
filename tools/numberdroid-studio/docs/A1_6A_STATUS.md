# A1.6a Authoring-v2 prerequisites status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.6a is a non-visual L3 Domain/Application/Persistence/Numberdroid-adapter
candidate based on verified `main` head
`5816c88e14b74e521d742c3966b5186b7651f661`. It adds the private prerequisites
needed before any Authoring-v2 transport can safely expose A1.5: a separately
typed command-feature/scope overlay, an additive Numberdroid capability profile v2,
trusted task/grant provisioning support, and real read-only SQLite/CAS planning
ports. It does **not** select that profile or overlay in the server, launcher,
HTTP API, UI, or MCP bridge. Consequently no current client can invoke the new
scope, dry-run, or commit path. Automated tests, source integration, and CI do
not constitute Klaus's contract acceptance.

## Implemented scope

- `authoring-v2-registry.js` defines one schema-v2 feature overlay. It describes
  exactly `asset.processing-result.adopt` / `studio_processing_result_adopt`
  and exactly one private grant scope, `asset.processing-result.adopt`, over the
  legacy catalogs. The definition requires an agent task branch, exact project
  and Asset object scopes, the A1.5 atomic store, and Numberdroid profile v2's
  dedicated A1.3 validate operation. It forbids auto-accept and carries no
  owner-review or lifecycle capability.
- Legacy compatibility remains the default. `COMMAND_DEFINITIONS` is still
  exactly 33 entries, `KNOWN_GRANT_SCOPES` is still exactly 30 entries, and the
  default StudioService/AgentTaskService behavior still rejects the private
  scope. The v2 overlay is one separately typed command feature plus the exact
  31-scope vocabulary; it is deliberately not a mapper-compatible 34th legacy
  command definition. Trusted composition cannot omit, duplicate, rewrite, or
  append a scope outside the exact legacy-v1 or Authoring-v2 vocabulary.
- Numberdroid capability profile v2 is additive to the unchanged profile v1.
  It adds `studio.image-processing` v1; schema-v1 JSON formats for
  ProcessingRecipe, ProcessingResult, AssetInputSelection, and the adoption
  preflight receipt; and the exact
  `studio.asset.processing-result-adoption-preflight` validate operation. It
  adds no compiler, repository, destination, materialization, publication, or
  owner-decision operation.
- `SqliteProcessingResultAdoptionStore.asPlanningPorts()` supplies the exact
  A1.4 task-authority and task-branch-preflight read ports from current durable
  Task, Grant, immutable branch-ledger, Asset, artifact-registration, physical
  CAS, and selected capability-profile truth. It validates ledger/projection
  agreement and canonical branch usage before returning authority evidence.
- A real dry-run obtains a fresh A1.3 receipt and A1.4 plan against the current
  branch revision. It returns `READY` only after capability, Asset, registered
  `LIVE`, and physical PNG evidence match. Missing references/metadata, a
  non-live artifact, or missing/corrupt content returns a stable blocker.
  Stale branch coordinates fail before capability or CAS reads.
- Dry-run is read-only: it creates no project or task revision, Aggregate,
  replay row, artifact-retention reference, Activity, Asset projection, Grant
  use, command charge, job, or owner decision. A following A1.5 commit still
  repeats all mutation-time checks and charges exactly once.
- Cancellation propagates through both reads. Unexpected dependency failures
  are sanitized at the A1.4 port boundary. The SQLite/CAS adapter recognizes
  only direct own-data `StudioError` codes on a non-proxy instance and never
  consults traps or accessors on a hostile thrown value.
- `asset.processing-result.adopt` is added to the Domain's forbidden
  auto-accept set. Even a trusted v2 task catalog cannot turn adoption into
  `AUTO_ACCEPTED_BY_POLICY` or `USER_APPROVED`.

## Pinned compatibility identities

- legacy Numberdroid profile v1 SHA-256:
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`;
- additive Numberdroid Authoring-v2 profile SHA-256:
  `5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106`;
- default registered command definitions/grant scopes: **33/30**;
- private v2 additions: **one command feature/one scope**, yielding 31 scopes;
- accepted MCP discovery remains **19 tools/four templates** without a task and
  **30 tools/five templates** for a matching legacy task.

## Preserved compatibility and authority boundaries

- No existing project, task, grant, HostBinding, launcher, environment value,
  or MCP connection selects profile v2 or the v2 feature/scope overlay. The new
  dependencies are reachable only through explicit trusted in-process
  composition and tests.
- The legacy command schema, fingerprints, task surface, redacted authority
  model, MCP resource/tool mapping, JSON Schema, gateway, HTTP routes, UI,
  accepted visual evidence, and durable schema v13 remain unchanged.
- A1.6a adds no SQLite migration and no new durable state. It uses the existing
  authoritative writer and CAS retention/maintenance boundaries; dry-run does
  not acquire or publish retention roots.
- A1.5 remains the only implementation that can commit the private command,
  and only through its exact atomic-store port. A1.4 planning evidence is never
  executable authority and is stale at any later mutation boundary.
- There is no owner fallback, review decision, warning disposition, merge,
  lifecycle promotion, finalization, materialization, repository write,
  release, or publication authority.

## Explicitly deferred to A1.6b

A1.6b is a separate transport/composition candidate. It must leave both legacy
discovery surfaces exact and expose the new adoption tool only after a
server-validated Authoring-v2 HostBinding/task/grant/branch/profile/store
handshake. The candidate contract is exactly **31 tools/six resource
templates** for a matching v2 task: the one adoption tool plus one
`studio://projects/{projectId}/capabilities` resource over the legacy task
surface. `dryRun: true` must call A1.4 planning; `dryRun: false` must call A1.5
commit. Environment or client claims may request the feature but can never
create authority. Generic StudioService/AgentTaskService execution and all
owner review/apply/finalize surfaces remain excluded.

## Verification

Frozen local candidate verification on 2026-08-28:

- focused A1.3-A1.6a, task, capability, SQLite, fault, and compatibility suite:
  **158 passed, 0 failed**;
- full Studio suite under Node 24.19.0: **459 passed, 0 failed**;
- `npm run check`: **140 JavaScript files passed**;
- Numberdroid root suite: **208 passed, 0 failed**, followed by a successful
  production build;
- production-adapter evidence verification: `VERIFIED`, with protected source
  manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.

Repository Markdown links (**58 checked, 0 failures**), `git diff --check`, and
the link, classifier, and Studio syntax-checker self-tests pass. The exact
change classifier selects `docs`, `root`, `studio`, `studio_visual`, and
`studio_windows`; it leaves `docs_only`, `root_visual`, `pages`, and `full`
false. Five independent final actual-diff reviews covering Domain/authority,
security, compatibility, SQLite/CAS races, and QA all returned **GO** with no
remaining technical finding. Source identity, PR, merge, and Actions evidence
are recorded only after those integration gates complete. Until integration
this document describes a local implemented candidate, not `main` truth.

## Recovery

A1.6a adds no migration and its dry-run writes no workspace/CAS state. Source
rollback is a focused revert of this candidate. No database downgrade, backup
restore, CAS cleanup, task repair, or user-workspace reset is required. Any
future A1.6b live composition must preserve A1.5's documented v13 backup and
single-writer/maintenance recovery boundary.
