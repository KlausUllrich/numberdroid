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

**Status: visually accepted by the user on 2026-08-21.** The accepted shell and interaction flow are the protected baseline for 1B. This records visual/workflow acceptance only; JSON persistence and the host-only agent adapter remain development implementations.

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

Decision recorded: the interaction model and visual shell were accepted as the 1B baseline. The implementation retains a runnable frozen JSON fixture, expected command/revision/activity results, the accepted source revision/commit, a reproducible browser-capture workflow, and the accepted visual run/digest/viewport record. The screenshot bytes themselves remain in a retention-limited Actions artifact rather than permanent repository goldens. Acceptance did not make the JSON store production-ready; later acceptance of 1B completed Checkpoint 1.

## Checkpoint 1B — SQLite/CAS and official MCP transport

**Status: user-accepted on 2026-08-21.** Accepted implementation `41fad464cd2f904666f7dfecc8437f2286c3254c`; CI run `32493595981`; 65 tests; 26 Chrome screenshots; local production-adapter and visual review passed. The durable acceptance record is `CHECKPOINT_1B_STATUS.md`. Draft PR #135 remains unmerged; checkpoint acceptance is not merge or release authority.

**Outcome:** the development foundation becomes a durable local-authoring and protocol foundation suitable for the asset slice.

Deliverables:

- SQLite in WAL mode, versioned migrations, transactional event/revision/projection/idempotency/grant updates, and backup/reset flow;
- one-writer/reader concurrency, foreign-key/integrity checks, fault-safe commit, SQLite-native live backup/restore, and tested projection rebuild;
- copy-and-verify migration from the protected 1A JSON directory into a new destination, with source digest manifest, parity report, explicit cutover pointer, and non-destructive rollback;
- streamed same-filesystem SHA-256 content-addressed artifact storage, size/media/dimension limits, atomic placement, corruption/missing detection, retention-safe mark/sweep garbage collection, paired backup/restore, and URI delivery;
- official MCP 2026-07-28 SDK with local stdio transport;
- stateless MCP protocol core whose trusted host injects actor/task/grant execution context for every tool call;
- scoped project/resources, first read/mutation tools, runtime-validated schemas, structured concurrency errors, clean shutdown, protocol-only stdout, and durable activity evidence;
- persistent Header Agent access selector with implemented `Off`, `Read only`, and semantic `Execute scoped task` (visible `Scoped run`); `Propose in draft` and `Custom…` stay visibly fail-closed until branch heads/editor workflows exist;
- private loopback MCP-host pairing: secret-free launcher setup, short-lived verification code, explicit Header approval, digest-only credential storage, redacted binding status/revoke, and no credential exposure to browser surfaces;
- an effective-policy detail/warning for scope, branch, capabilities, expiry, budget, and broadening; finalization/export/publish remain separate;
- a small preview region on every Asset Library card, with authorized image resource or distinct accessible kind-aware fallback for processing/missing/unsupported/failure;
- equivalence, permission, persistence, crash/fault, concurrency, artifact, and protocol contract tests;
- protected 1A visual and command-outcome regression suite;
- supported-platform instructions for install, launch, data location, backup, restore, reset, and diagnostics.

User verification scenario:

1. launch the protected 1A fixture and compare the accepted shell/screenshots and command outcomes;
2. stop its writer, create a source manifest/backup, migrate a copy into SQLite/CAS, inspect the parity report, and restart 1B;
3. confirm project IDs, revision/activity history, grant revocation, validation, and visible navigation match the 1A baseline;
4. import a small artifact and verify its digest-backed resource link, restart integrity, and duplicate-content behavior;
5. inspect Asset Library cards with a valid preview and each fallback class; confirm no card is blank and semantic controls remain usable;
6. use the Header Agent access selector to move from `Off` to read-only and `Scoped run`; select the visibly deferred draft/custom entries and confirm they grant nothing; inspect warnings/effective policy and confirm client-side state cannot grant authority;
7. copy the secret-free host setup, start the stdio MCP host, match its verification code in the Header, authorize it, and discover only implemented tools/resources with diagnostics off stdout;
8. attempt a mutation without host authority, with a stale revision, and after revocation; observe denial/conflict without partial changes;
9. exercise one granted mutation and idempotent retry through MCP and compare its events/result with the UI path;
10. create a live backup, restore it, and compare database/CAS manifests; simulate migration failure before cutover and confirm 1A still launches unchanged;
11. test documented rollback with preserved SQLite/CAS/recovery evidence and no silent loss of post-cutover writes.

Exit decision: **approved by the user on 2026-08-21.** Checkpoint 1 is complete and the asset vertical slice is unblocked.

## Checkpoint 2 — Source, atlas, and asset-library vertical slice

**Status: 2A user-accepted on 2026-08-21; 2B user-accepted on 2026-08-22 after the live walkthrough at head `309c24961f89389047db837471b2e434dd13e149`; 2C is implemented and verified as a candidate but remains not user-accepted.** On 2026-08-22 the user explicitly deferred the 2C walkthrough, authorized Checkpoint 3, and requested one combined 2C + 3 acceptance gate. The offline, project-scoped portable Studio bundle round trip is the only import/export authority included in 2C. Draft PR #135 remains open, draft, and unmerged. Checkpoint implementation does not imply acceptance, merge, release, publication, provider, Numberdroid/runtime/repository export, or materialization authority.

**Outcome:** an approved atlas becomes reproducible, visually searchable assets without repository editing.

Deliverables:

- source import and provider-neutral generation records, including prompt/seed/model/lineage; provider-backed generation remains separately gated by egress, credentials, cost, and reproducibility decisions;
- immutable CAS ingestion and thumbnail previews;
- source review and approval lifecycle;
- regular-grid proposal plus manual/variable rectangle atlas editor;
- deterministic slices and stable remapping on recut;
- visual library for `surface`, `prop`, and `item`;
- bulk naming/metadata preview and semantic validation;
- equivalent MCP batch workflow and durable image-processing jobs;
- portable project bundle round trip for the slice.

Internal implementation gates:

1. **2A — Source intake and review (accepted):** bounded local upload into CAS, discriminated provenance and project-live lineage, original-byte preview, durable Resume/Discard recovery, explicit owner review lifecycle, schema v6 integrity/recovery, two scoped MCP mutations, and final-only denied/failed bound-agent Activity. Original preview requires no image-processing job, so 2A deliberately creates none. The user accepted this workflow and its provider-free constraint.
2. **2B — Visual atlas cutter (accepted):** the approved Family Hygiene PNG is cut through a source-resolution SVG overlay with fit/100%/200% zoom, deterministic regular-grid proposal, manual/variable integer rectangles, include/exclude preview, deterministic derived PNGs, and explicit stable remapping when a recut replaces a slice. Preview work runs as a durable bounded job with read/cancel/retry/discard controls; semantic apply is a separate atomic revision.
3. **2C — Asset-library semantics (candidate):** stable `surface`, `prop`, and `item` versions pin exact committed slices; typed metadata and deterministic findings drive owner-gated lifecycle; durable bounded agent proposals expose per-item diffs and owner rejection before atomic accepted-subset apply; visual inventory/query uses ordinal-first slice labels and exact provenance; schema-v9 MCP discovery is exactly 17 tools/three templates; and a sanitized project bundle round-trips canonical semantics and exact CAS into a new empty workspace.

The accepted workflow uses the approved Family Hygiene floor 2×2 source, pinned by its repository path, SHA-256, byte length, and dimensions. The user selected importing that image and making individual tiles as the first 2B fixture. `AGT-008` is closed for denied/failed mutation attempts that reach the private execution bridge after valid HostBinding resolution; unauthenticated pre-binding traffic has no trusted project/actor attribution and remains in operational security logs.

2A user verification scenario: import the approved source, inspect the original preview and provenance, restart from a staged intake and use **Resume** or **Discard**, propose it for review, approve or reject explicitly, then confirm the final lifecycle and Activity. Verify the MCP host discovers seven tools only when the SQLite audit ledger is live and never discovers the owner decision.

2A exit decision: **accepted by the user on 2026-08-21.** The Family Hygiene fixture, intake/recovery UX, source lifecycle, complete original-preview behavior, and provider-free boundary are accepted; 2B planning and implementation are authorized. Checkpoint 2C remains a separate gate.

2B acceptance evidence pins the 1254×1254 approved source to four 622×622 rectangles at `(3,3)`, `(629,3)`, `(3,629)`, and `(629,629)`. Its deterministic outputs are four 1,548,341-byte PNGs with the hashes recorded in `CHECKPOINT_2B_STATUS.md`. Schema v8 provides durable `ATLAS_PREVIEW` jobs with `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `APPLIED`, and `DISCARDED` states, a three-attempt ceiling, immutable creator authority, state-specific integrity, and snapshot-consistent backup. When the job and attempt stores are live, MCP advertises exactly 15 tools and two resource templates.

The first 2B user gate was rejected at file selection and repaired through the Chrome UnicodeSets source-ID fix. The next live gate then exposed a cutter defect: after grid proposal, the five-second refresh jumped the image's local scrollbar to the top. Unconditional passive rerendering and adjacent focus, duplicate-poll, stale-context, and active-drag races were repaired in `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d`; `04d876da750f348e24de9420be1ff59c349bc092` is the selector-only evidence follow-up. The former `a3d9a18e5deb0d9049e7ba6f879ad22eea1dfb29` candidate remains superseded and rejected for the user-reported scroll defect. Run `32568108922` and artifact `9474639509` are the pinned repaired browser evidence. The user completed the resumed walkthrough at head `309c24961f89389047db837471b2e434dd13e149` and explicitly accepted Checkpoint 2B on 2026-08-22. Docs-head run `32568704927` also passed Studio job `97020985366` and root job `97020985521`.

2B exit decision: **accepted by the user on 2026-08-22.** Frozen CI verification passes 109/109 Node tests. GitHub Actions run `32568108922` passed Studio job `97019592824` and root job `97019592908` under Chrome `151.0.7922.137`; artifact `9474639509` remains the pinned product-repair evidence. The live walkthrough additionally proved a 12+ second passive refresh retained both axes, the focused `Top margin = 5` draft, and page position; save succeeded; preview reached `SUCCEEDED` 4/4 on attempt 1 with four distinct quadrants; commit reached `APPLIED` 4/4 on attempt 1 with four stable v1 slice heads; recut mapping worked; unsaved `X = 4`/remap vanished on close/reopen while saved `X = 3` and v1 heads remained; and a full service restart preserved the approved source, exact rectangles, applied job, v1 previews, Fit/no-jump state, and no duplication. The acceptance record is commit `52eb9d32cab4fcbf20559455bc141215e7fb8998`. Post-acceptance commits `f116f25aed2f0a9d935de9061cf6492d3a56bef4` and `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` are `visualFixture`/test-only evidence-harness repairs with no product behavior change; acceptance was not reopened.

Runs `32571622269` (both Studio attempts failed; artifact `9475480760`, 846 bytes) and `32572344465` (Studio job `97029542069`, isolated Chrome/CDP post-move capture bookkeeping) are invalid diagnostics only. Final post-acceptance closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped. Its valid 16-file artifact `9475808319` is 2,839,931 bytes, `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, expires `2026-09-05T12:26:26Z`, and was captured under Chrome `151.0.7922.137` at both 1440×900 and 1060×900. The observations record zero runtime and visual errors and telemetry for captured press, same-pointer held move, deferred render, matching release/settlement/replacement, exact scroll/context, and cleanup. Thus `32572870510` / `9475808319` are the final post-acceptance closure evidence, while `32568108922` / `9474639509` remain the product-repair evidence. Closure-head run `32573543172` passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`. The 2C candidate now implements ordinal **Slice 1–64** primary labels with stable canonical IDs secondary/copyable. PR #135 remains open, draft, and unmerged; merge, release, providers, rooms, Numberdroid/runtime/repository export, materialization, and publication remain blocked.

Checkpoint 2C user verification is deferred into the combined 2C + 3 gate: inspect the exact Family Hygiene four-item MCP proposal, its authored placement/connectivity/collision semantics and deterministic findings; confirm the fourth rejection reason; inspect the three READY DRAFT assets and provenance; and review the verified portable-bundle round trip before continuing through the room/hallway checks.

Exit decision: Checkpoint 2B cutting accuracy, job workflow, recut mapping, and persistence were accepted on 2026-08-22. Checkpoint 2C remains a candidate; its acceptance decision is deferred and combined with Checkpoint 3. No acceptance, merge, release, or downstream export follows from internal verification or the authorization to continue.

## Checkpoint 3 — Room and hallway designer

**Status: implemented and published candidate with green domain/application/persistence/HTTP/MCP/UI, portable-bundle, CI, and Chrome evidence verification; not user-accepted.** The remaining candidate-gate work is the combined user walkthrough. The frozen bounded implementation contract is `CHECKPOINT_3_CONTRACT.md`, and published candidate pins are in `CHECKPOINT_3_STATUS.md`. The final user gate combines the deferred Checkpoint 2C decision with Checkpoint 3. This authority does not include providers, general branch/merge workflow, level composition, Numberdroid export/materialization/publication, PR merge, or release.

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

**Candidate status (2026-08-23):** implemented on the draft branch with schema v11 isolated task branches, semantic review/conflicts, atomic merge, compensating revert, UI/HTTP/MCP coverage, and adversarial tests. User acceptance remains combined with Checkpoints 2C and 3. The current candidate consumes already committed atlas results; the v8 main-revision-bound bitmap job ledger is deliberately not presented as branch-local work.

**Outcome:** an agent can safely execute a complete source-to-final-room task while the user follows and controls it.

Deliverables:

- task composer with object scope, capabilities, budget, expiry, and branch;
- live command/job timeline, pause/cancel/revoke controls, and structured progress;
- task result comparison, semantic diff, accept/reject/request-changes/merge;
- concurrent task branches and explicit semantic conflicts;
- policy-based low-risk auto-accept with truthful disposition;
- MCP coverage for every V1 authoring step completed so far;
- adversarial permission and multi-agent race suite.

User verification scenario: grant an agent the committed-atlas-to-DRAFT-room workflow but not finalization/publish, follow the task timeline, pause/resume the branch, compare concurrent results, accept selected changes, and revert the merge. Separately verify the accepted Checkpoint 2B cooperative long-job controls; decide whether a later branch-local job ledger is required before accepting the broader source-to-room wording.

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

Resolved 1B visual decision: the Header uses the **Agent access** pull-down, compact `Scoped run` label, separate host-status indicator, anchored policy popover, and a preview/fallback region on every Asset Library card. These are accepted regression inputs; only a concrete defect or deliberate later user checkpoint reopens them.
