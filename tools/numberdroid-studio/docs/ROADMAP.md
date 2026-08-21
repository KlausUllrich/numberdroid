# Numberdroid Studio — Roadmap and Verification Loop

This roadmap is outcome-based. A checkpoint is complete only after automated verification, adversarial review, root-agent verification, and explicit user acceptance of the visual/workflow result. Work after a rejected checkpoint returns to planning rather than silently redefining acceptance.

## Working loop for every checkpoint

1. **Plan:** product/architecture agent refines the vertical slice, migration impact, tests, and user-visible evidence.
2. **Adversarial review:** a separate reviewer attacks permission, concurrency, data-loss, UX, and integration assumptions before implementation.
3. **Implement:** code, fixtures, migrations, and user-facing documentation land together in the Studio folder.
4. **Independent verification:** tests, build, type/lint checks, dependency-boundary checks, protocol tests, and visual screenshots/flows are reviewed by an agent that did not implement the slice.
5. **Root verification:** the coordinating agent inspects the full diff, reruns critical tests, validates Numberdroid integration constraints, and prepares a focused draft PR.
6. **User checkpoint:** the user receives launch steps, a short scenario, expected results, known limits, and specific decisions to approve.
7. **Close or iterate:** acceptance is recorded; otherwise findings become checkpoint work and later implementation remains blocked where it would build on the disputed behavior.

No checkpoint may claim user approval from silence or from an automated policy result.

## Checkpoint 1A — Architecture and observable development shell

**Outcome:** a separately runnable Studio skeleton proves the product boundary, shared command path, host-injected agent authority, and visual audit model without claiming production persistence or a complete MCP transport.

Deliverables:

- binding requirements, architecture, roadmap, and MCP contract;
- standalone-ready package topology and dependency-boundary checks;
- visual project/production-board shell showing current revision, validation summary, agent task/grant state, jobs, and activity;
- shared domain/application command handler used by UI and MCP adapter;
- local persistence port with an explicitly temporary, dependency-free JSON development store and artifact URI validation;
- immutable events/revisions, optimistic concurrency, idempotency, dry run, and actor attribution;
- host-injected agent execution context with grant enforcement in the shared core;
- agent adapter/tool catalog that proves semantic command parity without claiming an official MCP transport;
- tests listed for Checkpoint 1A in the requirements.

User verification scenario:

1. launch the Studio locally;
2. click **Create / load demo** and inspect revision 5, its five attributed activity entries, the narrow Atlas Agent grant, validation summary, and empty C1A jobs state;
3. click **Retry idempotently** and confirm the original revision 3 result is returned while the project head and activity count remain unchanged;
4. click **Submit stale write** and confirm `REVISION_CONFLICT` appears while the project remains at revision 5;
5. click **Revoke agent grant** and confirm one human-attributed revision 6 appears and the grant card shows its revocation time;
6. click **Try agent after revoke** and confirm `GRANT_REVOKED` appears with no new source, revision, or activity;
7. restart the development service with the same data directory and confirm revision 6 and the audit history remain visible;
8. approve or reject the interaction, visibility, and authority model; do not treat this as approval of JSON persistence or a complete MCP server.

Exit decision: approve the interaction model, visible audit information, standalone boundary, and host-injected authority model, then authorize 1B. Acceptance does not make the JSON store production-ready and does not complete Checkpoint 1.

## Checkpoint 1B — SQLite/CAS and official MCP transport

**Outcome:** the development foundation becomes a durable local-authoring and protocol foundation suitable for the asset slice.

Deliverables:

- SQLite in WAL mode, versioned migrations, transactional event/revision/projection/idempotency/grant updates, and backup/reset flow;
- streamed SHA-256 content-addressed artifact storage, integrity checks, retention-safe garbage collection, and URI delivery;
- official MCP 2026-07-28 SDK with local stdio transport;
- stateless MCP protocol core whose trusted host injects actor/task/grant execution context for every tool call;
- scoped project resources, first read/mutation tools, structured concurrency errors, and durable activity evidence;
- human grant mint/revoke UI/API outside the agent-callable MCP tool surface;
- equivalence, permission, persistence, crash/fault, concurrency, artifact, and protocol contract tests;
- supported-platform instructions for install, launch, data location, backup, restore, reset, and diagnostics.

User verification scenario:

1. migrate the 1A sample project into SQLite and restart it;
2. import a small artifact and verify its digest-backed resource link;
3. discover tools/resources through the official stdio MCP transport;
4. attempt a mutation without host authority and observe denial;
5. mint a narrow human grant, bind it through the trusted host, and observe one attributed revision;
6. revoke the grant and confirm a later stateless call is denied;
7. exercise idempotent retry and stale-revision conflict through MCP;
8. back up, reset, restore, and compare the project revision/activity.

Exit decision: approve local durability, artifact handling, and official agent protocol behavior. Only then is Checkpoint 1 complete and the asset vertical slice unblocked.

## Checkpoint 2 — Source, atlas, and asset-library vertical slice

**Outcome:** an approved atlas becomes reproducible, visually searchable assets without repository editing.

Deliverables:

- source import and provider-backed generation, including prompt/seed/model/lineage, explicit egress, and cost budgets;
- immutable CAS ingestion and thumbnail previews;
- source review and approval lifecycle;
- regular-grid proposal plus manual/variable rectangle atlas editor;
- deterministic slices and stable remapping on recut;
- visual library for `surface`, `prop`, and `item`;
- bulk naming/metadata preview and semantic validation;
- equivalent MCP batch workflow and durable image-processing jobs;
- portable project bundle round trip for the slice.

User verification scenario: import one approved atlas, adjust cuts visually, create a small named asset family, add placement/connectivity metadata, ask an agent to complete a bounded batch, reject one proposal, and confirm that source provenance and revisions remain inspectable.

Exit decision: approve cutting accuracy, metadata vocabulary, source lifecycle, and asset browsing speed.

## Checkpoint 3 — Room and hallway designer

**Outcome:** the user can author and finalize a single room or hallway using the visible asset vocabulary.

Deliverables:

- room archetype and variant creation with room/hallway defaults;
- layered grid/canvas, zoom, selection, inspector, palette, keyboard actions, and structured placement list;
- surfaces, props, and items by semantic reference;
- footprint, exact-fit, connector, collision/navigation, bounds, and overlap validation;
- game-design → level-design → room-design intent traceability;
- deterministic preview and visual diff;
- agent batch placement and set-dressing proposals on a task branch;
- finalization and new-draft lineage after edits.

User verification scenario: build one hallway and one single room, use an agent to propose set dressing, inspect invalid-placement explanations, finalize a variant, and create a new revision without changing the final artifact.

Exit decision: approve canvas behavior, placement vocabulary, validation explanations, and room-finalization semantics.

## Checkpoint 4 — Agent-first workflow and review control

**Outcome:** an agent can safely execute a complete source-to-final-room task while the user follows and controls it.

Deliverables:

- task composer with object scope, capabilities, budget, expiry, and branch;
- live command/job timeline, pause/cancel/revoke controls, and structured progress;
- task result comparison, semantic diff, accept/reject/request-changes/merge;
- concurrent task branches and explicit semantic conflicts;
- policy-based low-risk auto-accept with truthful disposition;
- MCP coverage for every V1 authoring step completed so far;
- adversarial permission and multi-agent race suite.

User verification scenario: grant an agent the complete atlas-to-room workflow but not finalization/publish, follow it live, interrupt a long job, resume or retry, compare its branch, accept selected changes, and revert the merge.

Exit decision: approve the default delegation model and decide which actions, if any, can be auto-accepted.

## Checkpoint 5 — Deterministic Numberdroid export candidate

**Outcome:** a finalized Studio room/hallway becomes a verified, reviewable Numberdroid candidate without conflating authoring and publishing.

Deliverables:

- immutable export snapshot and manifest;
- Numberdroid adapter for semantic IDs, runtime/source-art separation, metadata, exact-fit surfaces, and Level Spec/compiler validation;
- golden fixtures and deterministic output hashes;
- candidate preview, compiler findings, and remediation links;
- explicit materialize/commit/publish stages with separate authorization;
- documented recovery and no-partial-publish behavior.

User verification scenario: export the approved room twice, compare manifests/hashes, inspect generated runtime and provenance paths, trigger and fix a compiler failure, then explicitly approve only the candidate. Repository publication remains a separate optional step.

Exit decision: approve adapter fidelity and choose the production publishing workflow.

## V1 completion — Level composition baseline

After the vertical slices are accepted, V1 adds the smallest useful level graph over finalized rooms and hallways:

- place/reuse finalized variants;
- connect compatible room connectors;
- trace level intent and included revision closure;
- validate connectivity and compile a level candidate;
- browse every referenced asset and room from the level view.

Enemy/NPC placement and route drawing are still excluded and attach later through a separate designer.

## V2 — Animated tiles and props

V2 activates the reserved `AnimationClip` identity:

- frame import/cutting and ordered clips;
- duration, loop mode, anchors, events, and playback preview;
- static/animated state variants without changing asset IDs;
- room preview and export adapter support;
- performance and deterministic timing validation.

V2 does not add NPC/enemy animation.

## Future growth

Possible later tracks, each requiring its own accepted architecture slice:

- standalone packaging and automatic updates;
- remote/team service with authenticated Streamable HTTP MCP and collaborative review;
- additional game adapters and export profiles;
- procedural room-template and level-graph assistance;
- plugin/provider SDK for image generation and analysis;
- separate encounter/NPC/route designers consuming finalized level layouts;
- asset dependency impact analysis across multiple projects;
- review environments, signed export manifests, and release promotion.

## Decision log expected at checkpoints

Each accepted checkpoint updates a concise decision log with:

- user-approved behavior and visual evidence;
- defaults that remain provisional;
- deferred findings and their impact;
- schema/API compatibility decision;
- migration or rollback instructions;
- exact revision/commit and fixture versions tested.

This prevents future agents from reinterpreting an accepted workflow based only on code or chat history.
