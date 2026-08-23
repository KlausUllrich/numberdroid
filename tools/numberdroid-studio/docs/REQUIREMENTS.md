# Numberdroid Studio — Product Requirements

Status: binding V1 product contract, with explicitly marked V2 reservations.

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative. Requirement identifiers are stable and should be referenced by tests, issues, and design decisions.

## 1. Problem statement

The current asset-to-level workflow is difficult to inspect and unreliable to repeat. Generation context is lost, atlas cutting and naming are fragile, metadata lives far from the visual source, and GitHub is too slow to serve as an interactive authoring database. People cannot easily see the available design vocabulary, while agents do not have a safe semantic interface for completing the workflow.

Numberdroid Studio MUST make the complete path from generated or uploaded image to validated room and export candidate visual, reproducible, and agent-operable.

## 2. Goals

- **G-001 — Visual ownership.** A user can understand source images, slices, reusable assets, room contents, validation state, and revision history without inspecting repository files.
- **G-002 — Reproducibility.** Generated sources retain prompt, seed, model/provider, references, parameters, and lineage so approved images can be iterated later.
- **G-003 — Reliable extraction.** An approved atlas can be divided into explicit rectangles, reviewed visually, and turned into stable reusable assets.
- **G-004 — Semantic authoring.** Assets carry explicit role, connectivity, placement, footprint, collision, and export metadata.
- **G-005 — Room-first design.** Users and agents can create halls and individual rooms, dress them with visible reusable assets, validate them, and mark revisions final.
- **G-006 — Agent parity.** With an appropriate human-created grant, an agent can perform every authoring step available to a person through a semantic MCP interface.
- **G-007 — Human control.** Every agent action is visible, attributed, interruptible when long-running, reviewable, and reversible.
- **G-008 — Local speed.** Interactive work uses a local database and artifact store; source control is used only for explicit export/publish operations.
- **G-009 — Growth.** The product can expand to level graphs, animations, additional game adapters, multi-user review, and a standalone deployment without replacing its core identities.

## 3. Non-goals and boundaries

- **NG-001.** V1 MUST NOT design enemies, NPCs, enemy/NPC animations, encounters, or patrol routes.
- **NG-002.** The Studio MUST NOT infer authoritative topology, collision, walkability, or connector semantics from pixels. It MAY offer suggestions that remain visibly unconfirmed.
- **NG-003.** The MCP server MUST NOT automate UI clicks. It MUST invoke the same application commands as the UI.
- **NG-004.** Git commits, branches, issues, and pull requests MUST NOT be the interactive persistence layer.
- **NG-005.** V1 is not a replacement for the Numberdroid Level Compiler. It authors semantic inputs and validates through adapter contracts; the compiler remains authoritative for Numberdroid output.
- **NG-006.** Production publishing MUST NOT occur implicitly when an asset, room, or level is finalized in Studio.

## 4. Users and actors

- **Designer:** visually creates and reviews assets, rooms, hallways, set dressing, and level intent.
- **Technical designer:** defines semantic constraints, validates export compatibility, and resolves findings.
- **Agent operator:** grants bounded authority, observes agent work, pauses or cancels jobs, and accepts or rejects results.
- **Agent:** discovers project state through resources and performs allowed semantic commands through MCP.
- **Exporter:** deterministic system actor that builds an immutable export candidate through an adapter.

The system MUST record the true actor for every mutation. `AUTO_ACCEPTED_BY_POLICY` is a machine policy outcome and MUST NOT be represented as `USER_APPROVED`.

## 5. Required workspaces

### 5.1 Production Board

- **UI-001.** The home workspace MUST show projects, active agent tasks, running jobs, validation blockers, pending reviews, and recent revisions.
- **UI-002.** It MUST expose a chronological activity timeline with actor, command, target, status, revision, and human-readable summary.
- **UI-003.** The user MUST be able to move from an activity entry to the affected object and diff.
- **UI-004.** The persistent header MUST show an understandable **Agent access** control for the current project/task context. It MUST show its effective state in text, not by color alone.
- **UI-005.** The Agent access pull-down MUST offer these user-facing postures: `Off`, `Read only`, `Propose in draft`, the compact accepted label `Scoped run`, and `Custom…`. `Scoped run` maps to the semantic posture `Execute scoped task` / `execute_scoped`. Checkpoint 1B visibly marks `Propose in draft` and `Custom…` as later capabilities and fails closed because neither isolated branch heads nor the detailed editor exists yet. They may become active only when those real workflows ship; `finalize`, `export`, and `publish` are never implied by a posture.
- **UI-006.** Selecting a posture is an authenticated human request to the local service. The UI MUST render only the service-returned effective policy and MUST NOT manufacture, cache as authority, or widen a grant locally.
- **UI-007.** For an active posture, the header MUST make task, branch, concise scope/capability summary, expiry, and remaining budget discoverable without leaving the current workspace. A running-job count and a direct route to activity SHOULD be visible.
- **UI-008.** The header MUST represent at least `OFF`, `REQUESTING`, `ACTIVE_READ_ONLY`, `ACTIVE_DRAFT`, `ACTIVE_EXECUTE`, `EXPIRED`, `REVOKED`, `DENIED`, and `SERVICE_UNAVAILABLE`. Expired, revoked, denied, or unavailable states MUST never look active.
- **UI-009.** Moving to broader authority MUST show a concise warning that names the newly enabled capabilities, object scope, branch, expiry, and budget before the service request is confirmed. Narrowing to `Off` or revoking authority MUST remain immediate and easy.
- **UI-010.** The pull-down MUST NOT offer an unbounded `Full access` shortcut. Finalization/export require separate explicit controls; production publish requires its own short-lived grant and confirmation outside the header selector.
- **UI-011.** Primary designer-facing language MUST explain the current state, responsible actor, required decision, and consequence of an action in professional plain language. Internal terms such as branch, grant, provenance, immutable, atomic, semantic, CAS, command, and raw revision or rule identifiers MUST NOT be required to understand the normal workflow. When those details aid diagnosis or expert inspection, the UI SHOULD place them behind a secondary **Technical details** disclosure. A confirmation that ends authority MUST explain the practical result—for example, that completing a task prevents the assigned agent from changing it further—instead of merely naming the internal grant transition.
- **UI-012.** Workspaces SHOULD use progressive disclosure around the current process step. A normal list view SHOULD offer the primary next action, such as **Create task**, without permanently showing the complete creation form, selected-object detail, review controls, and technical history at equal visual weight. Controls that are irrelevant or unavailable in the current state SHOULD be omitted or clearly explained rather than presented as unexplained technical options.

### 5.2 Source and Generation

- **SRC-001.** A user or agent MUST be able to import an image without treating it as an approved asset.
- **SRC-002.** A generation record MUST support prompt, negative prompt, seed, provider, model, model version when known, generation parameters, reference artifacts, parent generation, author, and timestamps.
- **SRC-003.** The system MUST preserve the original uploaded/generated bytes as an immutable content-addressed artifact.
- **SRC-004.** Approval MUST be an explicit lifecycle transition. Importing, generating, or visually opening a source MUST NOT approve it.
- **SRC-005.** A source MAY have multiple derived atlases and assets without copying the original bytes.
- **SRC-006.** A configured generation provider MUST be invokable as a durable job with an explicit prompt, seed policy, parameters, output limits, cost/budget policy, and network-egress disclosure. Its result MUST create a complete `GenerationRecord` before it can be reviewed.
- **SRC-007.** A staged source intake MUST remain project-scoped and recoverable until it is atomically claimed by a source revision or explicitly abandoned; an incomplete request MUST NOT create a partial source or silently release the staged reference.
- **SRC-008.** Human upload and imported-generation provenance MUST be discriminated. Human uploads MUST NOT invent provider metadata; imported-generation records MUST name their provider/model and MUST NOT retain credentials, local paths, or arbitrary external URIs in generation parameters.

### 5.3 Atlas Cutter

- **ATL-001.** The cutter MUST display the source at useful zoom levels with a visible coordinate grid and explicit extraction rectangles.
- **ATL-002.** It MUST support regular grid proposals, margins, spacing, variable-size rectangles, manual adjustment, inclusion/exclusion, and preview.
- **ATL-003.** Grid detection and image analysis MUST create proposals, never silent authoritative cuts.
- **ATL-004.** Every slice MUST retain its source artifact, exact integer rectangle, optional pivot, transparent-padding policy, and derivation revision.
- **ATL-005.** A slice identity MUST survive a recut when the designer explicitly maps the replacement; otherwise a new identity is required.
- **ATL-006.** Cutting MUST be repeatable and produce byte-identical output for identical inputs and parameters, where the image codec permits deterministic encoding.
- **ATL-007.** Included rectangles MUST be bounded by the source, non-overlapping, uniquely identified, and limited by explicit rectangle, pixel, and output-byte budgets before a job is created.
- **ATL-008.** A committed slice replacement MUST be one-to-one and compare the expected prior slice version. Excluded rectangles MUST NOT replace a committed slice.
- **ATL-009.** The cutter MUST preserve source-resolution integer coordinates at every visual zoom level. Pointer and keyboard edits MUST have equivalent structured numeric controls and MUST retain focus after a keyboard edit.
- **ATL-010.** Preview output metadata MUST be verified against the canonical processor, exact rectangle, dimensions, media type, byte size, digest, input revision, and definition fingerprint before it can become a committed slice version.

### 5.4 Visual Asset Library

- **AST-001.** The library MUST show visual thumbnails and filterable metadata; users and agents MUST be able to query the same inventory.
- **AST-002.** V1 asset kinds MUST include `surface`, `prop`, and `item`. A surface can represent a floor, wall, transition, connector, or other structural tile role.
- **AST-003.** Each asset MUST have a stable semantic ID independent of filename, atlas position, display name, and export path.
- **AST-004.** Metadata MUST support tags, dimensions, footprint, anchor/pivot, placement rules, collision, navigation effect, connector edges, compatibility constraints, variant group, visual weight, and adapter extensions.
- **AST-005.** The UI MUST distinguish missing metadata, proposed metadata, confirmed metadata, validation errors, and approved/final state.
- **AST-006.** Bulk naming and metadata assignment MUST show a preview and resulting validation before commit.
- **AST-007.** Props and items MUST be referenceable from room set dressing by semantic ID, not by source filename or atlas coordinates.
- **AST-008.** Required current Numberdroid semantics, including exact-fit footprints and explicit connectivity/collision, MUST be representable without loss.
- **AST-009.** Every Asset Library card MUST reserve a small, consistently sized preview region. A successfully resolved visual artifact MUST be rendered there with transparency visible and without changing the asset's aspect ratio.
- **AST-010.** A card MUST never have a blank or collapsed preview. Missing artifact, processing, unsupported media, and load failure MUST each use a deterministic accessible fallback that includes the asset kind and a textual status; these states MUST NOT be confused with an intentionally empty/transparent asset.
- **AST-011.** Preview loading MUST use the authorized artifact/resource URI and MUST NOT expose local filesystem paths. Preview failure MUST leave naming, metadata, selection, and inspection usable.
- **AST-012.** A V2 asset version MUST pin the exact committed slice version, atlas/source lineage, rectangle, digest, CAS metadata, pivot, and committed revision. A later recut MUST NOT silently retarget an existing asset version.
- **AST-013.** Human slice choices MUST show ordinal `Slice 1` through `Slice 64` as the primary label while retaining the stable canonical slice ID as secondary, copyable provenance.
- **AST-014.** V2 metadata MUST be kind-discriminated, bounded, and fail closed on unknown ordinary fields. Namespaced adapter extensions MUST reject secrets, authority, machine paths, and arbitrary URIs. Missing authored semantics produce deterministic findings rather than inferred values.
- **AST-015.** V2 lifecycle is `DRAFT → METADATA_COMPLETE → VALIDATED → FINAL`. Blocking findings prevent validation/finalization, warning disposition is explicit, and finalization remains separate from runtime export, repository materialization, publication, and runtime acceptance.
- **AST-016.** A bounded asset proposal MUST remain durable across clients and restart, expose ordered per-item diffs/findings, require one complete owner decision vector with a reason for every rejection, and apply the accepted subset in exactly one semantic revision or not at all.
- **AST-017.** Passive refresh MUST preserve a focused or dirty asset-review field, selection, local/page scroll, and captured project/revision/proposal context. A changed proposal MUST produce an explicit conflict instead of silently discarding the draft.

### 5.5 Room and Hallway Designer

- **ROM-001.** The designer MUST support a bounded grid/canvas with visible cells, layers, origin, dimensions, and scale.
- **ROM-002.** The default creation choices MUST include a single room and a hallway. More complex archetypes MAY be introduced later.
- **ROM-003.** Structural surfaces and set dressing MUST be separate logical layers even if visually composited.
- **ROM-004.** Users and agents MUST place surfaces, props, and items by stable asset reference with explicit transforms and adapter-safe placement data.
- **ROM-005.** A room archetype MUST describe reusable intent and constraints; a room variant MUST contain a concrete authored arrangement.
- **ROM-006.** Room metadata MUST trace intent from game design to level design to room design. Agent-created metadata MUST cite the governing rule or mark the value as a proposal.
- **ROM-007.** The user MUST be able to browse the available asset vocabulary alongside the room, filter it, preview placement, and inspect why an asset is invalid for a position.
- **ROM-008.** Validation MUST cover overlaps, bounds, footprint/exact-fit constraints, connectors, required access, navigation/collision, required tags, unresolved proposals, and adapter-specific rules.
- **ROM-009.** Finalization MUST create an immutable final revision; subsequent edits create a new draft lineage.

### 5.6 Level Composition

- **LVL-001.** A level graph MUST be able to reference finalized room variants and hallway segments, their connectors, and semantic relationships.
- **LVL-002.** V1 MAY expose only the minimum composition necessary to export one room/hallway slice. The domain model MUST nevertheless reserve stable level-graph identities.
- **LVL-003.** Future enemy placement and route drawing MUST attach to a finalized layout through a separate designer and MUST NOT be embedded in room authoring commands.
- **LVL-004.** A level candidate MUST remain traceable to the exact room, asset, and source revisions it contains.

### 5.7 Validation, finalization, and export

- **VAL-001.** Validation MUST produce stable findings with severity, rule ID, object/location, explanation, suggested remediation, and originating validator version.
- **VAL-002.** Errors block finalization. Warnings require an explicit accepted disposition or policy outcome. Informational findings do not block.
- **VAL-003.** Every accepted mutation MUST validate the affected aggregate and MUST schedule or perform full project/compiler validation when required by the Numberdroid contract.
- **EXP-001.** Export MUST operate on an immutable snapshot and produce a manifest before publishing.
- **EXP-002.** Identical snapshot, adapter version, and export options MUST produce identical logical output and manifest hashes.
- **EXP-003.** Exported runtime assets belong under Numberdroid `public/`; source/provenance belongs in its source-art directory as defined by the adapter. Studio domain packages MUST NOT know these paths.
- **EXP-004.** Export, filesystem materialization, Git commit, and publication MUST be separate, visible steps.
- **EXP-005.** Production publication requires a separate human-minted `publish` grant and SHOULD require explicit confirmation even if authoring was fully delegated.

### 5.8 Revisions, concurrency, and recovery

- **REV-001.** Accepted mutations MUST append immutable events and create a new immutable revision; state is a projection, not the audit source.
- **REV-002.** Revisions MUST form a DAG to support draft branches, agent alternatives, merges, and non-destructive revert.
- **REV-003.** Every mutation MUST carry `baseRevision`, target `expectedVersion`, and `idempotencyKey`.
- **REV-004.** Stale versions MUST fail with a structured conflict. Last-write-wins is forbidden for semantic mutations.
- **REV-005.** Revert MUST create a new revision that semantically restores prior state; it MUST NOT delete history.
- **REV-006.** The system MUST support one authoritative local writer service. Multiple UI and agent clients communicate with that writer.
- **REV-007.** Independent agents SHOULD work on separate draft branches. Merge MUST be explicit and validated.

### 5.9 Agent operation and human control

- **AGT-001.** MCP tools MUST expose semantic intent and batch operations, not raw database writes, arbitrary filesystem writes, or UI gestures.
- **AGT-002.** Read access and mutation access MUST be separate. Mutation commands require a valid human-created grant.
- **AGT-003.** An agent mutation grant MUST be bounded by project, task, branch, capabilities, object scope, budget, expiry, and issuer.
- **AGT-004.** Agents MUST NOT mint, widen, renew, or reinterpret their own grants.
- **AGT-005.** `finalize`, `export`, and `publish` MUST be distinct capabilities from ordinary edit capabilities.
- **AGT-006.** Long operations MUST run as durable jobs with progress, structured events, cancellation, retry policy, and durable results.
- **AGT-007.** Tool results MUST return resource and artifact URIs. Large images and binaries MUST NOT be embedded as base64 in JSON tool responses.
- **AGT-008.** Every agent mutation MUST be visible in the same activity timeline as human mutations, including failed and denied attempts at an appropriate audit level.
- **AGT-009.** The user MUST be able to revoke a grant immediately, cancel cancellable jobs, compare an agent branch, reject it, merge it, or revert accepted changes.
- **AGT-010.** A dry-run mode MUST show proposed changes, findings, required capability, and expected revision without committing.
- **AGT-011.** When the user grants generation authority and a provider budget, an agent MUST be able to request source generation and iterate from retained prompt/seed/lineage without receiving the provider credential.
- **AGT-012.** The trusted MCP host MUST inject authenticated actor/task/grant execution context per call. MCP tool arguments MUST NOT accept authority fields that let an agent claim or select an actor, task, or grant.
- **AGT-013.** Local HostBinding credentials MUST be delivered only to a short-lived waiting host over a non-browser loopback pairing channel after explicit human verification. Browser responses, DOM, clipboard configuration, URLs, storage, resources, and logs MUST NOT receive raw credentials or grant IDs.
- **AGT-014.** HostBinding coordinates are immutable. Grant narrowing, widening, renewal, and `Off` MUST revoke affected bindings; no stale token may be aligned with or resurrected onto a later grant.
- **AGT-015.** A job created by an agent MUST retain its immutable creator actor/task/branch/grant coordinates. Claim, retry, cancellation, discard, output publication, and semantic apply MUST re-authorize the operation at the applicable safe boundary; another task MUST NOT take control of the job.
- **AGT-016.** Job creation MUST consume its semantic command, job count, and complete estimated output-byte budget once in the same transaction as the input revision. Retry MUST be bounded and MUST NOT silently create a second semantic command or charge the same logical output twice.
- **AGT-017.** Agent-visible job projections MUST expose redacted structured state, events, result metadata, and same-origin resource links without raw binary data, credentials, grant IDs, machine paths, stack traces, or unsanitized worker errors.
- **AGT-018.** Asset proposal submission uses a distinct `asset.proposal.submit` scope and charges every contained operation against the grant command budget. Owner decision, accepted-subset apply, lifecycle promotion/finalization, and portable bundle operations MUST NOT be exposed through MCP.

### 5.10 Animations (V2 reservation)

- **ANM-001.** V1 MUST reserve `animationClip` as a stable domain identity attachable to an asset without changing that asset's semantic ID.
- **ANM-002.** V2 clips MUST support ordered frames, per-frame or default duration, loop mode, anchor consistency, event markers, and preview.
- **ANM-003.** A room placement references an asset and optional clip/state, never a raw frame filename.
- **ANM-004.** Static assets MUST remain valid without an animation clip.
- **ANM-005.** NPC and enemy animation remains outside this product even after tile/prop animation ships.

## 6. Data and persistence requirements

- **DAT-001.** Metadata, identities, relations, revisions, jobs, grants, and findings MUST be stored in local SQLite in V1.
- **DAT-002.** Binary artifacts MUST use an immutable content-addressed store (CAS), addressed by cryptographic digest and recorded media type/size.
- **DAT-003.** Database records MUST reference artifact URIs; they MUST NOT contain large binary payloads.
- **DAT-004.** The user MUST be able to export and import a portable project bundle with schema version, database projection or normalized manifests, artifacts, and integrity hashes.
- **DAT-005.** Schema migrations MUST be versioned, forward-tested, and transactional. An export made by a released version MUST have a documented compatibility path.
- **DAT-006.** Deleting a reference MUST NOT immediately delete shared CAS content. Garbage collection MUST be explicit and recoverable within a documented retention window.
- **DAT-007.** A portable Studio project bundle MUST be a normalized, project-scoped, snapshot-consistent semantic document plus exact CAS closure. Import targets a new empty destination, verifies the complete tree and every hash before visibility, publishes atomically, and excludes live grants, HostBindings, tokens, attempts, idempotency, staged intakes, leases, machine paths, raw failures, and secrets.
- **DAT-008.** Terminal applied atlas-job history MAY round-trip only as reserved nonauthorizing `bundle_import` provenance sufficient for semantic integrity. It MUST NOT become a live controllable job or revive any authority.

## 7. Standalone and integration requirements

- **ARC-001.** All Studio implementation and product documentation MUST live under `tools/numberdroid-studio/` until extraction.
- **ARC-002.** Only `packages/numberdroid-adapter` may import Numberdroid-specific schemas, paths, compiler APIs, or naming rules.
- **ARC-003.** Core packages MUST depend on ports/interfaces, never on React, MCP transports, SQLite drivers, GitHub APIs, or Numberdroid internals.
- **ARC-004.** UI and MCP MUST use the same application command/query interfaces and policy evaluator.
- **ARC-005.** Cross-boundary data MUST use versioned DTOs and documented schemas.
- **ARC-006.** Extracting the folder MUST require replacing workspace wiring and adapter configuration, not rewriting domain code.

### 7.1 Accepted baseline and migration protection

- **BASE-001.** Checkpoint 1A's visual shell and verified interaction flow were user-accepted on 2026-08-21 and remain a permanent protected regression baseline after 1B acceptance.
- **BASE-002.** 1B preserved the accepted navigation, information hierarchy, activity/revision visibility, demo semantics, and host-injected authority behavior. A later visual redesign requires a separate user checkpoint. The approved Agent access selector and Asset Library preview/fallback are additive requirements, not permission for a broader redesign.
- **BASE-003.** The accepted 1A revision/commit, fixture inputs, expected revision/activity counts, reproducible capture workflow, and visual evidence run/digest/viewport record are retained after 1B cutover. The current 26 screenshot bytes live only in a retention-limited Actions artifact; publishing permanent binary goldens remains an explicit evidence-retention task subject to repository binary rules.
- **MIG-001.** The 1A JSON directory MUST be treated as read-only migration input. Migration MUST first create a dated backup plus integrity manifest and MUST NOT delete, rewrite, or merge the source ledger.
- **MIG-002.** JSON-to-SQLite/CAS migration MUST be versioned, idempotent, resumable or safely restartable, and staged into a new destination. A failure MUST leave both the accepted 1A data and the previously active destination usable.
- **MIG-003.** Before cutover, migration verification MUST compare project/aggregate IDs, head revision, event and activity ordering/counts, grants/revocations, semantic projection hashes, artifact references, and validation summaries. Cutover occurs only after all required parity checks pass.
- **MIG-004.** Cutover MUST be one explicit configuration/pointer change after the writer is stopped. Studio MUST never run JSON and SQLite as concurrent authoritative writers.
- **MIG-005.** Rollback MUST preserve the failed/new SQLite database, CAS, logs, and migration report for diagnosis. Returning to the frozen 1A JSON baseline MUST be explicit; post-cutover 1B writes MUST NOT be silently discarded and require a verified recovery/export before rollback.
- **MIG-006.** The C1A application and fixture MUST remain launchable against a copied baseline data directory after 1B acceptance. C1B and later code MUST keep regression tests that compare its visible projection and command outcomes with the protected baseline.

## 8. Quality attributes

- **NFR-001 — Determinism.** IDs, slicing, manifests, previews used for QA, and exports must be deterministic wherever inputs are identical.
- **NFR-002 — Performance.** Common local reads and single-object edits SHOULD feel interactive; the initial target is under 100 ms for metadata queries and under 250 ms for accepted simple commands on a representative project, excluding image processing.
- **NFR-003 — Accessibility.** All authoring actions MUST be keyboard reachable; canvas-only meaning MUST have a structured inspector/list alternative; state MUST NOT depend on color alone.
- **NFR-004 — Reliability.** A process crash during an accepted command MUST leave either the prior committed revision or the complete new revision, never a partial semantic state.
- **NFR-005 — Observability.** Commands, jobs, validation, storage failures, and MCP invocations MUST have correlation IDs and structured local logs with secret-safe redaction.
- **NFR-006 — Testability.** Domain and application logic MUST run without UI, MCP transport, or Numberdroid checkout. Adapter contract tests use deterministic fixtures.
- **NFR-007 — Privacy.** Prompts, source images, and local paths remain local unless an explicit provider generation or publish action says otherwise.

## 9. Checkpoint acceptance criteria

Checkpoint 1 was split into two user-verifiable deliveries. Both were explicitly accepted on 2026-08-21, so the foundation checkpoint is complete and Checkpoint 2 is unblocked. Acceptance does not merge Draft PR #135 or imply release/publication authority.

### Checkpoint 1A — architecture and development foundation

**Status: visually accepted by the user on 2026-08-21.** This acceptance protects the shell and interaction model as the 1B baseline; it does not approve JSON as production persistence or claim MCP protocol completion.

1. The Studio starts from its own subfolder and shows a visual project/activity shell.
2. UI and a host-injected agent adapter call the same tested application command handler; neither writes storage directly.
3. A project can be created/opened locally and survives restart through the persistence port using the explicitly labelled dependency-free JSON development store.
4. A successful mutation creates an attributed event and revision; a failed or stale mutation does not partially change the project.
5. The visual shell displays human and agent activity, current revision, task/grant state, and validation summary.
6. Agent authority is supplied by trusted host execution context, not accepted from agent tool arguments; an ungranted mutation is denied.
7. Automated tests cover grant denial, idempotent retry, stale revision conflict, transactional rollback, actor attribution, and rejection of embedded binary payloads.
8. Documentation states the data limitations, launch/test/data-location/reset steps, and the mandatory 1B replacement path.

### Checkpoint 1B — production local store and official MCP boundary

**Status: user-accepted on 2026-08-21.** The exact accepted implementation and evidence are recorded in `CHECKPOINT_1B_STATUS.md`.

1. SQLite runs in WAL mode with foreign keys enabled, a bounded busy timeout, one authoritative writer, explicit schema version, transactional migrations, and clean shutdown/checkpoint behavior.
2. One transaction atomically commits command events, revision/revision parents, aggregate versions, projections, activity, idempotency result, validation findings required by the command, and grant-budget consumption. Crash/fault tests prove that none can commit alone.
3. The SQLite adapter passes the shared persistence contract suite, restart/recovery tests, concurrent-reader/single-writer tests, integrity checks, and supported backup/restore verification.
4. The C1A JSON migration satisfies `MIG-001` through `MIG-006`; the user can inspect a migration report and no automatic step destroys or overwrites the protected baseline.
5. CAS ingestion streams into same-filesystem staging, enforces media/size/dimension limits, calculates SHA-256, verifies any claimed digest, durably closes the file, and atomically renames it to an immutable digest-sharded location.
6. Database references store artifact URI, digest, media type, size, and required image dimensions. Tool and normal JSON responses contain URI/resource links rather than base64 or arbitrary filesystem paths.
7. CAS deduplication, missing/corrupt-blob detection, reference tracking, backup/restore, and retention-delayed mark/sweep garbage collection are tested. Failed transactions may leave only quarantined/unreferenced blobs, never live references to incomplete content.
8. The official MCP 2026-07-28 SDK/stdio transport starts as a subprocess through SDK v2 `serveStdio` in strict modern mode, negotiates `server/discover`, proves the active `2026-07-28` revision, lists only implemented underscore-named tools/resources, reads a scoped project resource, performs at least one granted mutation, and maps application conflicts/errors to structured protocol results.
9. MCP stdout is reserved for protocol frames; diagnostics use redacted stderr/structured logs. Clean shutdown, malformed input, cancellation, oversized payload, and host/service failure behavior are tested.
10. The MCP protocol core is stateless with respect to authorization. A service-minted opaque HostBinding is delivered through short-lived private loopback pairing, stored only as a digest, resolved on the private bridge, and revalidated per call; the trusted service injects actor/task/branch/grant/correlation context separately from the command DTO. Agent tool schemas do not accept authority fields and cannot expose grant mint/revoke operations. C1A grants migrate only as inactive `LEGACY_UNBOUND` audit history.
11. A human can request/select/revoke the implemented `Read only` and `Execute scoped task` policies and separately authorize/revoke a waiting MCP host through the service-backed Header control. `Propose in draft` and `Custom…` remain visible, explicitly unavailable, and fail closed until real branch heads/editor workflows exist. The browser sees only secret-free setup, pending verification data, and redacted binding status. Ungranted, expired, revoked, stale-token, over-budget, project/task/branch/object-out-of-scope, and attempted authority-override mutations are denied without mutation. The accepted UI and structured MCP result make the immediate denial visible; durable Activity-ledger entries for denied/failed calls remain an explicit implementation gap under `AGT-008` and must be added before claiming full denial-audit coverage.
12. UI and MCP adapter equivalence tests produce the same domain events, revision, validation, idempotency behavior, and actor attribution for the same semantic command.
13. The protected C1A visual regression and demo interaction suite still passes. Every Asset Library card shows either a valid preview or the defined accessible fallback.
14. Install, data-location, migration, integrity-check, backup, restore, rollback, protocol-diagnostic, and safe-reset instructions are exercised on the supported platform.
15. The package-boundary test proves that Studio core does not import Numberdroid repository internals. A real `packages/numberdroid-adapter` and its contract/golden fixtures are deferred to Checkpoint 5; Checkpoint 1 cannot materialize or publish production output.

Checkpoint 1 is complete because both 1A and 1B were explicitly accepted. Checkpoint 2 must use the accepted SQLite/CAS store and official MCP boundary; it cannot regress to the JSON development store or host-only adapter.

### Checkpoint 2A — source intake and review

**Status: user-accepted on 2026-08-21.** The user accepted the source workflow and provider-free constraint, selected importing the approved Family Hygiene image and making individual tiles as the first fixture, and authorized Checkpoint 2B planning and implementation. This does not authorize merge, release, publication, provider work, or Checkpoint 2C.

1. A loopback human UI can stream a PNG/WebP of at most 16 MiB and 4096×4096 into project-scoped CAS with media, dimensions, byte length, and claimed SHA-256 verified before use.
2. The staged intake is durable and idempotent. Commit atomically creates one V2 source revision, canonical source reference, lineage references, intake claim, Activity event, and grant artifact-byte charge; a fault leaves all of them at the prior state.
3. A staged intake remains visible after restart and has explicit idempotent **Resume** and **Discard** recovery. Checkpoint 2A uses no automatic expiry.
4. V2 provenance discriminates `human_upload` from `imported_generation`, validates existing project-live lineage artifacts and parent sources, bounds nested parameters, and rejects secret-bearing keys, paths, and external URI values.
5. The lifecycle is explicit: `IMPORTED` or `GENERATED` → `REVIEWED` → `APPROVED_SOURCE` or terminal `REJECTED`. Opening or previewing does not approve; rejection requires a reason; owner decision is not advertised to agents.
6. Preview serves the verified original CAS object through a same-origin resource with no derivative job. Source bytes, paths, credentials, and provider traffic never enter JSON/MCP payloads.
7. SQLite schema v6 transactionally adds source intakes and final-only agent attempts. Integrity, migration-resume, backup, restore, and source-reopen tests cover their references and exact fixture bytes.
8. An audit-ready SQLite MCP host advertises exactly the accepted five tools plus `studio_source_intake_commit` and `studio_source_review_propose`. The new commands require distinct scopes, project object scope, immutable HostBinding context, command/artifact budgets, and idempotent retry.
9. Accepted agent commands remain semantic revision Activity entries. Every denied or failed mutation reaching `/internal/mcp/execute` after valid HostBinding resolution is durably appended once as a final redacted Activity record; inability to write that record fails closed. Pre-binding authentication/pairing failures remain operational security logs because no trusted project/actor exists to attribute.
10. The real Family Hygiene source fixture retains SHA-256 `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`, 2,720,519 bytes, and 1254×1254 dimensions through intake, preview, review, and restart. Separate schema-v6 fixtures prove backup/restore and integrity preservation for claimed intake, lineage, and attempt state.
11. Protected Checkpoint 1 command/evidence behavior and the legacy `source.register` contract remain unchanged. Atlas cutting, generated derivatives, provider invocation, durable image jobs, asset semantics, bundles, room work, and export remain later gates.

### Checkpoint 2B — visual atlas cutter

**Status: explicitly user-accepted on 2026-08-22 after the live walkthrough at product head `309c24961f89389047db837471b2e434dd13e149`.** After the native-file-input and Chrome UnicodeSets repairs, the user reported that the cutter's local image scrollbar jumped to the top every five seconds after grid proposal. The cause was unconditional passive rerendering plus focus, polling, stale-context, and drag races. Product repair `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d` and selector-only evidence repair `04d876da750f348e24de9420be1ff59c349bc092` passed GitHub Actions run `32568108922`; the prior `a3d9a18e5deb0d9049e7ba6f879ad22eea1dfb29` candidate remains superseded by the user-reported defect. Acceptance was recorded in commit `52eb9d32cab4fcbf20559455bc141215e7fb8998`. Later commits `f116f25aed2f0a9d935de9061cf6492d3a56bef4` and `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` are `visualFixture`/test-only evidence-harness changes, not product behavior changes, and did not reopen acceptance. Draft PR #135 stays open, draft, and unmerged. Checkpoint 2C is implemented and verified as a candidate but is not user-accepted. On 2026-08-22 the user deferred its walkthrough, authorized Checkpoint 3, and requested a combined 2C + 3 acceptance gate. The offline, project-scoped portable Studio bundle round trip remains the only import/export authority. Provider work, Numberdroid/runtime/repository export, materialization, publication, merge, and release remain blocked.

1. The accepted Family Hygiene source remains the exact PNG with SHA-256 `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`, 2,720,519 bytes, and 1254×1254 dimensions.
2. A non-authoritative 2×2 proposal yields four explicit 622×622 rectangles at `(3,3)`, `(629,3)`, `(3,629)`, and `(629,629)`. The user can inspect and edit source-resolution integer geometry through the SVG overlay and structured controls at fit, 100%, or 200% zoom.
3. The editor supports manual/variable rectangles, include/exclude, exact numeric editing, pointer editing, keyboard editing, preview, and an explicit per-rectangle choice between creating a new slice identity and replacing one prior slice version. A recut never retargets an identity implicitly.
4. Rectangle validation rejects unsafe integers, duplicates, overlap, out-of-bounds geometry, invalid pivots/remaps, more than 64 rectangles, more than 64 Mi output pixels, or a canonical slice exceeding 16 MiB before job creation. Checkpoint 2B accepts approved PNG sources for cutting; unsupported/malformed/interlaced/transparency-chunk inputs fail closed.
5. `atlas.define.rects` atomically revisions the authoritative definition. `atlas.preview.slices` atomically creates the input revision, immutable job, initial job event, complete output-byte reservation, job-count charge, command charge, Activity, and idempotency result. Unknown client outcomes are resolved by replaying the same logical operation key and immutable request.
6. The only 2B job kind is `ATLAS_PREVIEW`. Its states are `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `APPLIED`, and `DISCARDED`; there is no `WAITING_FOR_USER` or response tool. Jobs have at most three attempts and explicit idempotent read, cancel, retry, and terminal-unapplied discard operations.
7. The worker uses immutable input revision/fingerprint/rectangles, checks cancellation and original agent authority at safe points, recovers expired leases, atomically publishes each verified output with its temporary reference and progress event, sanitizes failures, and is quiesced before database shutdown.
8. `atlas.commit.slices` verifies exact canonical digest, media type, byte size, dimensions, processor, rectangle, source, fingerprint, and input ownership before one atomic semantic revision promotes stable slice heads, installs permanent slice references, releases temporary job references, marks the job `APPLIED`, and writes Activity/idempotency evidence.
9. Identical input produces four deterministic 622×622 RGBA PNGs of 1,548,341 bytes each, pinned respectively to `ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2`, `3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e`, `9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526`, and `a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318` in row-major rectangle order.
10. SQLite schema v8 includes migrations 0007 (`aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9`) and 0008 (`2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730`). Integrity is state-specific for job revisions/metadata/references; backup requires complete semantic/CAS integrity and preserves a snapshot-consistent database/CAS pair.
11. With both durable stores live, official MCP discovery is exactly 15 tools and two templates: the project resource and `studio://projects/{projectId}/jobs/{jobId}`. Atlas grid/define/preview/commit and job read/cancel/retry/discard use the shared application core; agent controls require the original task/object authority and their authorized attempt record is committed atomically with the job transition.
12. JSON/MCP/job results expose only redacted metadata and resource links. The implementation returns no bitmap/base64 payload, grant ID, credential, arbitrary URI, local path, stack trace, or raw worker error.
13. Dedicated real-Chrome CI proves the cutter, inspector, and committed views at 1440×900 and 1060×900. The inspected evidence records exact overlay/source geometry, retained keyboard focus, successful resources, accessibility, containment, no crop/overflow, and zero browser/network errors. This automated/visual evidence supports but does not itself constitute the separately recorded user acceptance.
14. Source import MUST preserve a selected native file-input node across trusted periodic refreshes; pin project ID, revision, CSRF, idempotency, and staged-intake context across asynchronous hashing/upload/commit; disable conflicting controls while leaving the live status exposed; reject stale/cross-project completion; and return post-stage failure to an unambiguous Resume/Discard context. The source-ID HTML pattern MUST remain valid under UnicodeSets (`v`) semantics and accept only an initial ASCII alphanumeric followed by at most 127 ASCII alphanumeric, dot, underscore, colon, or hyphen characters.
15. An unchanged passive cutter refresh MUST retain the same DOM, focused valid draft, both local scroll axes, and window position. A necessary render MUST restore compatible clamped scroll while applying authoritative geometry. Job polling MUST have one current project/source/atlas/instance owner and reject stale identities. An active pointer drag MUST mark the model dirty on its first actual move and defer external replacement until pointer settlement, leaving inspector and SVG geometry synchronized. Closing or changing cutter context MUST reset local scroll deliberately.
16. Canonical slice IDs remain the durable machine identity, but a future human-facing UI SHOULD present ordinal **Slice 1–64** labels as the primary label and expose the canonical ID secondarily with a copy affordance. The user found the canonical IDs unusable as primary human labels, explicitly deferred this nonblocking UX improvement, and accepted Checkpoint 2B without it.

Run `32561781843` and its `a3d9` 2B candidate are superseded by the user-reported scrollbar defect. Failed run `32567878956` and 2B artifact `9474582144` are diagnostic only: all new product probes passed, but the harness still assumed a pre-reproposal rectangle ID. Run `32568108922`, Studio job `97019592824`, root job `97019592908`, and 2B artifact `9474639509` remain the pinned product-repair evidence. During the accepted live walkthrough, a 12+ second passive refresh preserved both image axes, focused `Top margin = 5`, and page position; definition save succeeded; preview reached `SUCCEEDED` 4/4 on attempt 1 with distinct quadrants; commit reached `APPLIED` 4/4 on attempt 1 with four stable v1 slice heads; explicit recut mapping worked; close/reopen discarded unsaved `X = 4`/remap while retaining saved `X = 3` and the v1 heads; and a full service restart preserved the approved source, exact rectangles, applied job, v1 previews, Fit/no-jump state, and no duplication.

Post-acceptance failed run `32571622269` (both Studio attempts failed; artifact `9475480760`, 846 bytes) and failed run `32572344465` (Studio job `97029542069`, isolated Chrome/CDP post-move capture bookkeeping) are invalid diagnostic evidence only. Final closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped. Its valid 16-file artifact `9475808319` is 2,839,931 bytes, `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, expires `2026-09-05T12:26:26Z`, and covers Chrome `151.0.7922.137` at 1440×900 and 1060×900. It records zero runtime and visual errors and telemetry proving captured press, a same-pointer held move, deferred rendering, matching release/settlement/replacement, exact scroll/context, and cleanup. Run `32572870510` / artifact `9475808319` are the final post-acceptance closure evidence; closure-head run `32573543172` also passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`. These do not alter or reopen the 2B acceptance decision. The ordinal **Slice 1–64** label debt is now authorized 2C scope, distinct from merge, release, or publication authority.

### Checkpoint 3 — room and hallway designer

**Status: implemented and published candidate with domain/application/persistence/HTTP/MCP/UI, portable-bundle, CI, and Chrome evidence verification; not user-accepted.** Checkpoint 2C acceptance remains deferred and will be decided together with Checkpoint 3. The combined user walkthrough remains the sole open candidate-gate decision; green automation does not imply acceptance. The bounded implementation authority and exact non-scope are frozen in `CHECKPOINT_3_CONTRACT.md`; published pins are recorded in `CHECKPOINT_3_STATUS.md`.

1. A human can create one bounded room archetype and one hallway archetype, then create concrete DRAFT variants with visible dimensions, origin, structural-surface and set-dressing layers, connector edges, and game-design → level-design → room-design intent trace.
2. Every placement references one exact V2 asset/version/metadata version and uses explicit cell anchor, cardinal rotation, layer, and adapter-safe semantic data. No pixel, filename, path, atlas coordinate, or current asset head becomes placement authority.
3. Surface macro validation subtracts structural bands first and rejects divisibility, alignment, clipping, overlap, or incomplete-coverage errors before validation/finalization.
4. Set-dressing validation covers rotated footprint, attachment, wall safety, required/compatibility tags, bounds, collision/envelope overlap, connector clearance, and remaining passable access with stable ordered explanations.
5. Canvas actions have equivalent structured list/inspector controls, keyboard reachability, non-color-only findings, Fit/100%/200% zoom, and useful 1440×900/1060×900 layouts.
6. One task-bound agent may submit a bounded durable placement proposal through a narrow scope. Every item is charged, owner decision covers every item with rejection reasons, and the accepted subset applies in exactly one semantic revision or not at all. General branch heads/merge and agent finalization remain absent.
7. Finalization is owner-only, requires deterministic validation and warning disposition, and creates an immutable FINAL room version. An explicit fork creates a later DRAFT lineage without modifying the final version.
8. SQLite schema v10, normalized room records, exact room-version asset references, rebuild, integrity, migration, restart, backup, fault/tamper coverage, and the extended sanitized portable Studio bundle all agree.
9. Official MCP v10 discovery is exactly 19 tools and four resource templates: the accepted v9 surface plus room proposal submit, room query, and room detail resource. Human room editing/finalization, bundle operations, export, materialization, and publish remain absent.
10. The combined user fixture preserves the exact 2C Family Hygiene proposal/assets, adds one exact-slice prop, builds one room and one hallway, reviews one three-item agent placement proposal including an overlapping rejected prop, preserves linked invalid-placement explanations, finalizes room version 5, forks DRAFT version 6, and proves restart/bundle parity.

### Checkpoint 4 — delegated task branches and review control

**Status: implemented candidate; not user-accepted.** The user authorized continuation while unable to perform acceptance, so the next decision is one combined Checkpoint 2C + 3 + 4 walkthrough. The exact authority and bounded branch-local-job interpretation are recorded in `CHECKPOINT_4_CONTRACT.md` and `CHECKPOINT_4_STATUS.md`.

1. Only the project owner may compose or control an `AgentTask`. The task pins its project, agent, isolated branch, immutable main base revision, exact capabilities/object scopes, command/job/artifact/cost ceilings, expiry of at most seven days, and optional disabled-by-default low-risk auto-accept allowlist.
2. Schema v11 persists the task, base/head documents, immutable branch revisions, monotonic task timeline, immutable versioned reviews, atomic merge lineage, and compensating revert lineage in STRICT tables with fixed migration checksum.
3. A bound agent command must match trusted project/task/branch/grant/actor context, active task state, expiry, capability, object scope, and remaining grant/task budget. Paused, terminal, expired, revoked, forged, or cross-branch work fails before branch mutation.
4. Task branches never mutate `branch.main` directly. Branch append is compare-and-swap; command IDs and idempotency keys are unique per task branch; same-head races permit exactly one winner.
5. Review compares semantic `(entityType, entityId)` change keys against main changes after the task base. Every change has a visible disposition; `AUTO_ACCEPTED_BY_POLICY` is immutable policy truth and MUST NOT become `USER_ACCEPTED` or `USER_APPROVED`.
6. Request-changes supersedes the review, moves the task to `CHANGES_REQUESTED`, and requires explicit owner resume before the agent may revise and resubmit. Reject/cancel revokes the grant and preserves history.
7. Merge rechecks fresh conflicts and terminal decisions, simulates accepted branch commands against current main, and commits the replay revisions, grant revoke, review/task disposition, and merge record in one transaction. Any simulation/persistence fault leaves main and workflow disposition unchanged.
8. Revert creates a new compensating semantic revision and immutable revert record; it never deletes or rewrites the original main/branch/review/merge history.
9. The human task workspace exposes composition, scope/budget/expiry, branch base/head, timeline, pause/resume/cancel, semantic conflicts, per-change decision, merge, and revert. Its primary language identifies the responsible actor and process state—for example **Waiting for your review**—while branch/grant/revision identifiers remain secondary technical details. Completing a task explicitly says that accepted changes enter the project, the task ends, and its assigned agent can no longer change it. `Propose in draft` activates only for a real matching branch.
10. Non-task official discovery stays exactly 19 tools/four resource templates. A live matching task binding exposes exactly 30 tools/five templates, adding branch-safe direct room authoring plus task read/submit. Human lifecycle, authority, review decision, merge/revert, export, materialization, and publish remain absent.
11. Portable export refuses every nonterminal task and transfers no task/grant/HostBinding/review/timeline/merge/revert state. Full workspace integrity validates the v11 branch/review lineage before backup/export.
12. The v8 atlas job ledger remains authoritative-main-revision-bound. Task branches reject shared-effect intake/atlas preview/atlas commit operations and consume already committed atlas/slice inputs. The combined user gate decides whether a later branch-local job ledger is required for the roadmap's broader source-to-room wording.

## 10. Open decisions and recommended defaults

These are deliberately open until validated by implementation or user testing. The recommendation is binding only as an interim default.

| Decision | Recommended default | Reason / trigger to revisit |
| --- | --- | --- |
| Desktop wrapper | Browser UI plus local service first | Keeps core portable; add Tauri/Electron only when file dialogs, packaging, or GPU needs justify it. |
| Metadata database | SQLite in WAL mode, one writer | Mature portable local store; revisit only for shared remote collaboration. |
| Artifact store | SHA-256 CAS beside the database | Deduplication, integrity, portable bundles. |
| MCP transport | Local stdio first; Streamable HTTP later | Simplest secure local agent use; HTTP is needed for remote/team deployment. |
| Canvas rendering | DOM/SVG overlays over raster previews initially | Inspectable and accessible; move hot paths to Canvas/WebGL after profiling. |
| Asset IDs | Random or monotonic opaque IDs plus editable human slug | Identity must not change when names/paths change. |
| Branch policy | Checkpoint 4 isolated task branches; activate `Propose in draft` only for an exact matching live task | Avoids falsely committing a proposal to the shared head and fails closed without real branch state. |
| Auto acceptance | Allowed only for explicit low-risk policy scopes | Must never be reported as user approval. |
| Header Agent access behavior | Accepted service-backed `Off`/read/`Scoped run`; candidate `Propose in draft` only for a real task branch; Custom remains unavailable | `Scoped run` means `Execute scoped task`; Checkpoint 4 must not manufacture branch authority from a UI posture. |
| Publish authority | Separate, short-lived human grant | Publishing is higher risk than authoring. |
| First Checkpoint 2 fixture | Import the approved Family Hygiene image and make individual tiles | Accepted at the 2A gate; replace only with another explicitly approved, hash-pinned source. |
| Provider integration | No provider in 2A | Accepted at the 2A gate; choose provider, egress, credential store, cost budget, and reproduction policy before any network work. |
| Staged-intake retention | Explicit durable Resume/Discard | Add expiry only with a visible retention policy and recovery evidence. |
| Animation model | Reserved identity in V1, authoring in V2 | Avoids migration of asset and placement references. |
| Checkpoint 3 room canvas | DOM/SVG grid, Fit/100%/200%, provisional 10×8 room and 12×3 horizontal hallway creation defaults | Preserves inspectability/accessibility and aligns with accepted cutter zoom language; dimensions remain explicitly editable within the frozen bound. |

Open product questions for later user checkpoints include: first canonical asset taxonomy, whether source generation providers are built in or imported by manifest, production bundle format, and the exact Level Compiler invocation boundary. The Checkpoint 3 room dimensions/zoom defaults are now provisional implementation inputs for the combined user gate rather than unanswered blockers.
