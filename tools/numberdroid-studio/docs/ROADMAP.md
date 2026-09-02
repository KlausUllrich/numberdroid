# Numberdroid Studio — Roadmap and Verification Loop

This roadmap is outcome-based. A checkpoint is complete only after automated verification, adversarial review, root-agent verification, and explicit user acceptance of the visual/workflow result. Work after a rejected checkpoint returns to planning rather than silently redefining acceptance.

The binding forward direction is [VISION.md](VISION.md): Studio is an agent-first,
Numberdroid-first authoring and production system. Accepted Checkpoints 1–4 are
foundations and compatibility baselines, not the final feature ceiling. Checkpoint
4.5 and Checkpoint 5 remain candidates until their separate user gates, even when
their source is integrated into `main`.

The product completes two connected paths before broad engine generalization:

```text
generated/uploaded image → reproducible processing → semantic asset
level requirements → layout + actors + routes + logic → validated candidate
```

## Working loop for every checkpoint

This full loop applies to milestone and user-checkpoint closure. Candidate
implementation blocks follow the adaptive cadence below.

1. **Plan:** product/architecture agent refines the vertical slice, migration impact, tests, and user-visible evidence.
2. **Adversarial review:** a separate reviewer attacks permission, concurrency, data-loss, UX, and integration assumptions before implementation.
3. **Implement:** code, fixtures, migrations, and user-facing documentation land together in the Studio folder.
4. **Independent verification:** tests, build, type/lint checks, dependency-boundary checks, protocol tests, and visual screenshots/flows are reviewed by an agent that did not implement the slice.
5. **Root verification:** the coordinating agent inspects the full diff, reruns critical tests, validates Numberdroid integration constraints, and prepares a focused draft PR.
6. **User checkpoint:** the user receives launch steps, a short scenario, expected results, known limits, and specific decisions to approve.
7. **Close or iterate:** acceptance is recorded; otherwise findings become checkpoint work and later implementation remains blocked where it would build on the disputed behavior.

No checkpoint may claim user approval from silence or from an automated policy result.

## Autonomous candidate cadence while live user testing is unavailable

As of 2026-08-28 Klaus is temporarily unavailable for live or visual gates. The
engineering loop may continue through small, equally sized implementation
candidates, but it MUST keep these states separate: implemented, automated
green, source-integrated, live/visual-tested, and explicitly user-accepted.

One autonomous block has exactly one testable product promise and at most one
new high-risk axis. Migration, public MCP/HTTP compatibility,
authority/lifecycle, pixel behavior, substantial UX, remote/auth,
materialization, and destructive/recovery boundaries remain separate axes.

Planning, review, and verification follow the binding adaptive policy in
[`CHANGE_RISK_AND_VERIFICATION.md`](../../../docs/agents/CHANGE_RISK_AND_VERIFICATION.md):
D0 documentation uses zero or one reviewer; L1 portable pure contracts use two
or three targeted superagents; L2 integration seams, including compatible
private protocol seams, use three to five; L3 visible/high-risk work, including
public MCP/HTTP compatibility changes, uses five or six plus every triggered
gate. Two to four adjacent L1 microsteps may share one PR only when their
combined diff remains one cohesive pure promise with the same owner, authority,
compatibility, and rollback. Use only triggered roles, one planning pass, and
one independent actual-diff review pass. The implementer and final reviewer
remain different; reviewer majority cannot override a binding contract.

The loop is:

1. verify current `main`, relevant open PRs/Actions, worktree, and authority for
   the selected lane rather than re-auditing unrelated history;
2. classify D0/L1/L2/L3 and freeze promise, scope, exclusions, authority,
   compatibility, tests, docs, rollback, and escalation triggers;
3. run one tier-selected parallel planning pass and resolve findings before
   writing;
4. implement on a focused branch with one writer per shared file area;
5. run focused checks plus only the core, boundary, protocol, persistence,
   migration, restart/fault/race, browser, Windows, root, or evidence gates
   required by the tier and actual triggers;
6. run one independent actual-diff review with the triggered roles and
   coordinator verification; Security/Compatibility GO is mandatory when those
   boundaries are touched;
7. update only directly affected current contract/status documents and append
   one compact but complete candidate record to `VACATION_TEST_BACKLOG.md`
   before source integration;
8. open a focused PR labelled `IMPLEMENTED CANDIDATE — NOT USER ACCEPTED`, wait
   for every selected required check, and correct rather than retrying
   nondeterministically; use the `ci-full` label or `[ci-full]` PR-title marker
   when semantic risk exceeds path inference;
9. merge only when the current human prompt explicitly authorizes repository
   source integration for that class of candidate; a merge is still neither
   product acceptance nor release;
10. resolve the post-merge `main` SHA and observe CI. Read-only planning for the
    next independent block may proceed concurrently, but dependent
    implementation/integration waits; any failure stops that lane. Add a focused
    closure record only when integration facts changed;
11. continue with the next independent unblocked block. If one lane reaches a
    real gate, switch to another authorized lane; stop only when every useful
    lane is gated.

Hard stops without a new explicit decision include widened agent/owner
authority, reinterpretation of accepted schemas or MCP 19/4 and 30/5 surfaces,
destructive migration/cleanup, active restore cutover, provider egress or cost,
remote exposure/authentication, repository/engine materialization, publication,
and any claim of visual acceptance. Deterministic UI candidates may collect
browser evidence, but CP4.5, backup UI, phone/touch behavior, and aesthetic
results remain queued for Klaus's consolidated return walkthrough.

Each candidate adds a return-test record with its dependency, PR/SHA, state,
safe fixture/reset, exact steps and expected result, platform/viewport,
evidence, open decision, known limits, and recovery path. The dated execution
snapshot and copy-paste launch prompt live in
`docs/history/handoffs/HANDOFF_2026-08-28_NUMBERDROID_STUDIO_AUTONOMOUS_A1_EXECUTION.md`;
current code and contracts always override that snapshot.

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

**Status: user-accepted on 2026-08-21.** Accepted implementation `41fad464cd2f904666f7dfecc8437f2286c3254c`; CI run `32493595981`; 65 tests; 26 Chrome screenshots; local production-adapter and visual review passed. The durable acceptance record is `CHECKPOINT_1B_STATUS.md`. PR #135 was later merged on 2026-08-24 only after a separate explicit user decision; checkpoint acceptance alone was not merge or release authority.

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

**Status: Checkpoints 2A, 2B, and 2C are user-accepted.** Checkpoint 2C was accepted on 2026-08-24 through the combined Checkpoint 2C + 3 + 4 walkthrough. The offline, project-scoped portable Studio bundle round trip remains the only accepted import/export authority. PR #135 was merged to `main` on 2026-08-24 after the separate merge decision; merge commit `bcc284684ea4d2e30158d3a20ebda57da77df93d` is the historical checkpoint integration baseline, while newer `main` remains authoritative.

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
3. **2C — Asset-library semantics (accepted):** stable `surface`, `prop`, and `item` versions pin exact committed slices; typed metadata and deterministic findings drive owner-gated lifecycle; durable bounded agent proposals expose per-item diffs and owner rejection before atomic accepted-subset apply; visual inventory/query uses ordinal-first slice labels and exact provenance; schema-v9 MCP discovery is exactly 17 tools/three templates; and a sanitized project bundle round-trips canonical semantics and exact CAS into a new empty workspace.

The accepted workflow uses the approved Family Hygiene floor 2×2 source, pinned by its repository path, SHA-256, byte length, and dimensions. The user selected importing that image and making individual tiles as the first 2B fixture. `AGT-008` is closed for denied/failed mutation attempts that reach the private execution bridge after valid HostBinding resolution; unauthenticated pre-binding traffic has no trusted project/actor attribution and remains in operational security logs.

2A user verification scenario: import the approved source, inspect the original preview and provenance, restart from a staged intake and use **Resume** or **Discard**, propose it for review, approve or reject explicitly, then confirm the final lifecycle and Activity. Verify the MCP host discovers seven tools only when the SQLite audit ledger is live and never discovers the owner decision.

2A exit decision: **accepted by the user on 2026-08-21.** The Family Hygiene fixture, intake/recovery UX, source lifecycle, complete original-preview behavior, and provider-free boundary are accepted; 2B planning and implementation are authorized. Checkpoint 2C remains a separate gate.

2B acceptance evidence pins the 1254×1254 approved source to four 622×622 rectangles at `(3,3)`, `(629,3)`, `(3,629)`, and `(629,629)`. Its deterministic outputs are four 1,548,341-byte PNGs with the hashes recorded in `CHECKPOINT_2B_STATUS.md`. Schema v8 provides durable `ATLAS_PREVIEW` jobs with `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `APPLIED`, and `DISCARDED` states, a three-attempt ceiling, immutable creator authority, state-specific integrity, and snapshot-consistent backup. When the job and attempt stores are live, MCP advertises exactly 15 tools and two resource templates.

The first 2B user gate was rejected at file selection and repaired through the Chrome UnicodeSets source-ID fix. The next live gate then exposed a cutter defect: after grid proposal, the five-second refresh jumped the image's local scrollbar to the top. Unconditional passive rerendering and adjacent focus, duplicate-poll, stale-context, and active-drag races were repaired in `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d`; `04d876da750f348e24de9420be1ff59c349bc092` is the selector-only evidence follow-up. The former `a3d9a18e5deb0d9049e7ba6f879ad22eea1dfb29` candidate remains superseded and rejected for the user-reported scroll defect. Run `32568108922` and artifact `9474639509` are the pinned repaired browser evidence. The user completed the resumed walkthrough at head `309c24961f89389047db837471b2e434dd13e149` and explicitly accepted Checkpoint 2B on 2026-08-22. Docs-head run `32568704927` also passed Studio job `97020985366` and root job `97020985521`.

2B exit decision: **accepted by the user on 2026-08-22.** Frozen CI verification passes 109/109 Node tests. GitHub Actions run `32568108922` passed Studio job `97019592824` and root job `97019592908` under Chrome `151.0.7922.137`; artifact `9474639509` remains the pinned product-repair evidence. The live walkthrough additionally proved a 12+ second passive refresh retained both axes, the focused `Top margin = 5` draft, and page position; save succeeded; preview reached `SUCCEEDED` 4/4 on attempt 1 with four distinct quadrants; commit reached `APPLIED` 4/4 on attempt 1 with four stable v1 slice heads; recut mapping worked; unsaved `X = 4`/remap vanished on close/reopen while saved `X = 3` and v1 heads remained; and a full service restart preserved the approved source, exact rectangles, applied job, v1 previews, Fit/no-jump state, and no duplication. The acceptance record is commit `52eb9d32cab4fcbf20559455bc141215e7fb8998`. Post-acceptance commits `f116f25aed2f0a9d935de9061cf6492d3a56bef4` and `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` are `visualFixture`/test-only evidence-harness repairs with no product behavior change; acceptance was not reopened.

Runs `32571622269` (both Studio attempts failed; artifact `9475480760`, 846 bytes) and `32572344465` (Studio job `97029542069`, isolated Chrome/CDP post-move capture bookkeeping) are invalid diagnostics only. Final post-acceptance closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped. Its valid 16-file artifact `9475808319` is 2,839,931 bytes, `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, expires `2026-09-05T12:26:26Z`, and was captured under Chrome `151.0.7922.137` at both 1440×900 and 1060×900. The observations record zero runtime and visual errors and telemetry for captured press, same-pointer held move, deferred render, matching release/settlement/replacement, exact scroll/context, and cleanup. Thus `32572870510` / `9475808319` are the final post-acceptance closure evidence, while `32568108922` / `9474639509` remain the product-repair evidence. Closure-head run `32573543172` passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`. The accepted Checkpoint 2C implementation provides ordinal **Slice 1–64** primary labels with stable canonical IDs secondary/copyable. PR #135 was merged to `main` on 2026-08-24 as `bcc284684ea4d2e30158d3a20ebda57da77df93d`; release, providers, Numberdroid/runtime/repository export, materialization, and publication remain blocked.

Checkpoint 2C user verification was completed during the combined 2C + 3 + 4 walkthrough on 2026-08-24. The exact Family Hygiene proposal/assets, rejection reason, typed findings, human-facing slice labels, and portable-bundle boundary were accepted. A human-usable prop preview build remains explicit Checkpoint 4.5 scope.

Exit decision: **Checkpoint 2C was accepted by the user on 2026-08-24.** Checkpoint 2 is complete. Acceptance does not authorize providers, Numberdroid/runtime/repository export, materialization, publication, PR merge, or release.

## Checkpoint 3 — Room and hallway designer

**Status: explicitly user-accepted on 2026-08-24 through the combined Checkpoint 2C + 3 + 4 walkthrough.** The accepted boundary is the current rectangular room/hallway workflow with exact pins, deterministic findings, owner lifecycle, FINAL/fork semantics, and sanitized bundle behavior. Guided authoring and irregular-room `VOID`/`BLOCKED` semantics are deferred to Checkpoint 4.5.

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

Exit decision: **accepted by the user on 2026-08-24.** The current canvas behavior, placement vocabulary, validation explanations, and room-finalization/fork semantics are accepted. Guided authoring and irregular-room geometry remain Checkpoint 4.5 scope.

## Checkpoint 4 — Agent-first workflow and review control

**Status: explicitly user-accepted on 2026-08-24 after the repaired conflict control passed on Windows and Linux.** The accepted boundary includes schema v11 isolated task branches, semantic review/conflicts, atomic merge, compensating revert, and the committed-atlas-to-DRAFT-room workflow. Branch-local bitmap jobs remain deferred and require separate authorization.

**Outcome:** an agent can safely execute the accepted committed-atlas-to-DRAFT-room task while the user follows and controls it.

Deliverables:

- task composer with object scope, capabilities, budget, expiry, and branch;
- live command/job timeline, pause/cancel/revoke controls, and structured progress;
- task result comparison, semantic diff, accept/reject/request-changes/merge;
- concurrent task branches and explicit semantic conflicts;
- policy-based low-risk auto-accept with truthful disposition;
- MCP coverage for every V1 authoring step completed so far;
- adversarial permission and multi-agent race suite.

User verification scenario: grant an agent the committed-atlas-to-DRAFT-room workflow but not finalization/publish, follow the task timeline, pause/resume the branch, compare concurrent results, accept selected changes, and revert the merge. Separately verify the accepted Checkpoint 2B cooperative long-job controls; decide whether a later branch-local job ledger is required before accepting the broader source-to-room wording.

Exit decision: **accepted by the user on 2026-08-24.** The bounded delegation model is accepted. Auto-accept remains disabled by default and limited to explicitly configured low-risk policy scopes; branch-local bitmap jobs, agent finalization, export, and publication remain outside the accepted boundary.

## Checkpoint 4.5 — Designer workflow and preview usability

**Status: frozen-contract candidate and bounded Room Editor continuations are source-integrated through PR #201 on 2026-09-02; Linux/Windows CI and Chrome evidence are green, while VT-001 remains REVISE pending Klaus's live retest. Source integration does not accept CP4.5 or CP5.**

**Outcome:** a professional designer can understand the current step, create or review the relevant object, and see a useful preview without needing to understand Studio's internal branch, grant, revision, provenance, or validation vocabulary.

The 2026-08-24 walkthrough accepted the technical foundations while showing that the product still presents too much implementation structure at once. Checkpoint 4.5 must apply `UI-011` and `UI-012` across the product rather than treating the Checkpoint 4 wording repair as a complete redesign:

- make the task list the normal entry view, with **Create task** as its primary action and creation as a separate step or dialog;
- make task selection, selected-task detail, progress, review, completion, and undo visibly one workflow rather than several unrelated cards;
- show only controls relevant to the current state and explain who acts next;
- replace primary technical language with professional designer-facing outcomes, while retaining exact IDs, provenance, revisions, rule codes, and authority details under optional technical disclosure;
- add a human-usable preview build for props before asking a designer to place or approve them;
- present room construction as a guided flow and explicitly design irregular-room support, distinguishing cells outside the room (`VOID`) from cells that remain part of the room but cannot be crossed (`BLOCKED`).

Normal healthy invariants should not read like warnings or proof obligations. The UI should surface a warning when provenance, integrity, validation, or authority is incomplete; otherwise it should state the useful result in terms a professional designer can act on.

User verification scenario: begin from the normal task list, create a task through a separate focused step, understand who acts next at every state, review a prop through a useful visual preview, and construct both a rectangular and an irregular room without opening technical details.

Exit decision: approve the designer-facing task flow, prop preview, guided room construction, and the exact `VOID`/`BLOCKED` authoring semantics. Checkpoint 5 production use and acceptance remain blocked until this checkpoint is accepted; dependent fail-closed implementation work is permitted and does not revise this gate.

Candidate implementation: `CHECKPOINT_4_5_CONTRACT.md` freezes the bounded semantics and `CHECKPOINT_4_5_STATUS.md` records the candidate. The implementation adds list/create/detail task views, trusted expiry projection, useful exact-slice previews, one persistent canvas with toolbox/options/dock workflow, owner-only complete shape replacement, schema-v12 normalized shape cells, schema-v2 rectangular parity, and schema-v3 masked-room round trips. It adds no generation, bitmap-job, export, materialization, publication, or wider agent authority.

### Room Editor usability continuation — repaired and source-integrated, live retest pending

Klaus's 2026-09-01 live verification authorized a bounded sequence before A4c
continues. The complete source sequence is now integrated and automated green;
none of these merges substitutes for Klaus's later live acceptance:

1. repair Surface-under-Prop placement, rotated prop preview and narrow intent
   layout — integrated through PR #191; implemented, not user accepted;
2. add 100–1000% zoom, Fit, scaled canvas labels and middle-mouse pan —
   integrated through PR #192 after exact-head CI and independent review;
   implemented, not user accepted;
3. add placement ghosts and direct select/move/rotate/delete interactions while
   retaining semantic command, exact-version and idempotency boundaries —
   integrated through PR #194;
4. surface persisted room errors and task conflicts/action-required state in the
   overview, with readable sequential finding navigation — integrated through
   PR #195;
5. add an engine-neutral, read-only Studio Preview from the exact current saved
   Project head and current saved Room head.
   Top-down ships first. It preserves positions, rotations, layers, transparency
   and the separation between logical footprint and visual bounds/overhang. It
   explicitly does not claim runtime fidelity — integrated through PR #196;
6. repair the 2026-09-02 live findings: viewport-aware Fit, discoverable
   saved-shape resize, direct exact-asset palette arming, a persistent placement
   brush, plain/safe pending retry, confirmed Clear and visibly correct cardinal
   rotation — integrated through PR #201, final head
   `e26f3d707a790a4b4779c9267514a3b8de9f18d0`, merge
   `dbe37634ea13d076cd00647fffb0dde1b2bd0f69`, exact-head Build #2353 / run
   `33629339599`, post-merge Build #2354 / run `33630127953`; and
7. prepare, but do not require for this usability milestone, a later 2.5D
   renderer over the same preview scene. It may use ground-anchor depth sorting,
   elevation, side-facing/billboard sprites and optional segmented occlusion.

The generic Studio Preview does not invoke Numberdroid or EngineBridge.
Engine-specific previews remain later adapter features. The 2.5D renderer is
planned after the top-down preview and is not a prerequisite for resuming A4c.
Exact merge, CI, verification and acceptance state is recorded in
[`ROOM_EDITOR_L3_STATUS.md`](ROOM_EDITOR_L3_STATUS.md). The separately bounded
A4c Candidate and derived-child source slices have since been integrated; Room
Editor acceptance remains an independent Klaus gate.

## Checkpoint 5 — First deterministic Numberdroid adapter candidate

**Outcome:** the accepted room/hallway slice proves the first immutable
Numberdroid adapter/compiler boundary without conflating authoring and publishing.
It is a foundation for the complete requirements-to-level path, not the final
Numberdroid product scope.

Deliverables:

- immutable export snapshot and manifest;
- Numberdroid adapter for semantic IDs, runtime/source-art separation, metadata, exact-fit surfaces, and Level Spec/compiler validation;
- golden fixtures and deterministic output hashes;
- candidate preview, compiler findings, and remediation links;
- explicit materialize/commit/publish stages with separate authorization;
- documented recovery and no-partial-publish behavior.

User verification scenario: export the approved room twice, compare manifests/hashes, inspect generated runtime and provenance paths, trigger and fix a compiler failure, then explicitly approve only the candidate. Repository publication remains a separate optional step.

Exit decision: approve adapter fidelity and choose the production publishing workflow.

Candidate implementation, source-integrated through PR #137 / merge
`2ead87bdd1f386eb0c3d35265914ac8de161f454` without accepting CP4.5 or CP5:
`CHECKPOINT_5_CONTRACT.md` freezes a candidate-only first slice.
`packages/numberdroid-adapter` now creates a content-addressed immutable snapshot,
maps exact room/asset/source pins to virtual Level Spec/provenance files and CAS
copy descriptors, imports stable adapter/compiler findings, and emits a manifest
whose later stages remain `NOT_AUTHORIZED`. A fixed in-process repository bridge
accepts only the exact non-serializable snapshot object created by the trusted
factory, loads the canonical compiler, override validator, Prop Registry, and
Prop Art Registry, and fingerprints their authority files. This foundation deliberately
does not yet add candidate persistence/approval UI, materialization, commit, or
publication. Irregular masks, ambiguous hallways, unsupported items, implicit
resizing, missing runtime surface binding, incomplete exact-fit dependencies,
and registry/path mismatches fail closed rather than being flattened or inferred.

## Parallel masterplan track — Operations, Remote Access & Mobile

**Status: O0 frozen; O1, O2a, A3a, A4a, A4b and the complete bounded A4c source
sequence are source-integrated and automated green; VT-014 and O1b are user
accepted; Room Editor L3 including PR #201 is source-integrated and green but
VT-001 remains REVISE; O2 deployment remains open; no A5 source work is
authorized by this status.**

This track neither accepts Checkpoint 4.5 nor materializes the Checkpoint 5
export candidate into Numberdroid runtime/repository output. Its planning and
implementation sources may live on `main`. It adds four product outcomes:

- simple verified backup/recovery in the human UI;
- an always-on, authenticated private Studio service reachable from Klaus's phone;
- a responsive, touch-usable smartphone experience; and
- bounded MCP onboarding/playbooks for **Artist** and **Level Designer** agents.

The gates are:

1. **O0 — Contract and threat model.** Freeze backup job ownership,
   destination configuration, local/remote separation, authentication/proxy
   trust, MCP transport scope, mobile hierarchy, and adversarial tests. The
   frozen external-ledger decision and implementation-grounded state/test
   contract are in `O0_BACKUP_RECOVERY_CONTRACT.md`; O1 allocates no workspace
   migration on the current schema-v13 base. Its post-freeze platform proof
   requires fixed Win32 root inspection/publication and one shared/exclusive
   live-CAS maintenance barrier before O1a code may proceed.
2. **O1 — Backup and recovery.** Reuse the accepted SQLite/CAS integrity,
   backup, verify, and restore-to-new-destination primitives behind a durable
   human-owned job; then add **Create backup now**, **Verify again**, recovery
   testing, and **Restore as a new working copy**. No overwrite, deletion,
   automatic cleanup, active cutover, arbitrary path, or agent authority.
3. **O2 — Always-on private service.** Add a separately authenticated HTTPS
   deployment with persistent mounts, supervised restart, explicit proxy trust,
   and private-network access. Never widen the accepted loopback listener.
4. **O3 — Mobile/touch completion.** Deliver phone-first list/detail/action
   hierarchy, 44px touch targets, no hover-only controls or page-level
   horizontal scrolling, reconnect/state retention, canvas touch safety, and a
   real Android/Chrome user gate. Room-editor touch work depends on the CP4.5
   candidate and cannot replace its separate desktop/designer acceptance; it
   either starts after CP4.5 acceptance or remains explicitly stacked and
   non-accepting.
5. **O4 — MCP onboarding.** Add a scoped getting-started/capabilities surface,
   local connection guide, Artist and Level Designer playbooks, failure/recovery
   guidance, and clean-agent scenarios that stop at **Waiting for your review**.
   The first slice must use server instructions and existing project/task
   resources without changing the accepted 19/4 and 30/5 discovery counts. Any
   new resource template requires a separately versioned feature gate with new
   exact counts. Remote Streamable HTTP MCP remains optional and separately
   security-reviewed.

The fail-closed O1a application/job seam and bounded O1b local-human UI are
source-integrated and automated green, recorded in `O1A_BACKUP_CORE_STATUS.md`
and `O1B_BACKUPS_UI_STATUS.md`. Klaus **user-accepted O1b through VT-012 on
2026-09-01**. The accepted boundary still grants no remote backup
metadata/operation authority. The low-priority `Technical details` reload-state
finding remains recorded without reopening acceptance. The
separately bounded O2a service, A3a contracts, A4a lossless Numberdroid
projection, and A4b reference behavior are now source-integrated and automated
green, without deployment or user acceptance. Phone acceptance, remote backup
authority, and remote MCP remain later gates.

Detailed contract: `OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`.

## Forward program — complete the agent-first vertical path

The next program is deliberately interface-first and Numberdroid-first. Lettered
gates do not retroactively change accepted checkpoint discovery counts, schemas,
or user acceptance.

### A0 — Product interfaces and capability profile

- freeze the universal-core / optional-module / adapter dependency rule;
- add a versioned fail-closed `ProjectCapabilityManifest` contract;
- freeze semantic Authoring Command/Query, immutable `CandidateManifest`, and
  `EngineBridge` ports;
- describe the current Numberdroid compiler and LevelSpec abilities as the first
  capability profile without moving Numberdroid concepts into core;
- preserve the accepted 19/4 and task-bound 30/5 MCP surfaces until a separate
  authoring-v2 feature gate pins new exact counts.

This was the safest first non-visual interface block. It added contracts and tests, not broad
UI, database migration, Godot/Unreal output, materialization, or publication.

Implementation note (2026-08-27, **implemented but not user-accepted**): A0.1
adds the pure schema-v1 `ProjectCapabilityManifest` validator, canonical JSON,
and pinned SHA-256 fingerprint in `packages/domain`, plus the first
adapter-owned Numberdroid profile. The profile separates the current LevelSpec
target vocabulary from the five operations actually exercised by the CP5
snapshot/candidate bridge and explicitly marks the known export and authority
gaps. It adds no application query, MCP tool/resource, SQLite migration, UI,
materialization, commit, or publication surface. At the A0.1 checkpoint, the
remaining A0 ports and read-only capability projection were still planned;
A0.2–A0.4 below later implemented those bounded candidates without user
acceptance.

A0.2 adds the injected read-only application query for that manifest and wires
the fixed Numberdroid profile only at the Studio server composition root. Owner
and task-scoped agent reads use the existing `project.read` authorization and
receive the same manifest/fingerprint. This remains **implemented but not
user-accepted** and still adds no HTTP/MCP resource, tool, UI, persistence, or
repository-output authority.

A0.3 adds the pure schema-v1 universal `CandidateManifest` contract and an
adapter-owned projection from the already trusted CP5 Numberdroid snapshot and
candidate. It pins the project/snapshot/capability profile, adapter/compiler
evidence, semantic revisions, requirement and recipe closure, CAS artifacts,
logical file outputs, findings, and deterministic fingerprint. Materialize,
commit, and publish remain fixed at `NOT_AUTHORIZED`; the existing
Numberdroid-specific CP5 manifest bytes and golden hash are unchanged. This is
**implemented but not user-accepted** and adds no candidate persistence/query,
MCP/HTTP/UI surface, `EngineBridge`, destination, or repository write.

A0.4 adds the schema-v1 application `EngineBridge` safe common denominator as a
strict `VALIDATE_ONLY`, `CANDIDATE_TO_ENGINE` port. It accepts only a verified
universal `CandidateManifest` with its recomputed fingerprint and returns a
frozen validation receipt pinned to the exact candidate, bridge identity,
bridge version, and evidence hash. Unknown versions/fields and any destination,
approval, materialize, commit, publish, or round-trip member fail closed. This
is **implemented but not user-accepted** and adds no concrete bridge or service
composition, candidate review/approval, persistence, MCP/HTTP/UI surface, engine
import, repository write, or release authority. The exact materialization side
of `EngineBridge` remains an explicit later product/authority decision and will
require a separately versioned contract.

### A1 — Artist path: image to validated asset

- versioned non-destructive `ProcessingRecipe` and deterministic derived artifacts;
- crop/extract, trim/padding, canvas/size normalization, deterministic resize,
  safely specified alpha/background cleanup, and atlas/sprite-sheet operations;
- visual before/after, lineage, recipe, exact pixels, findings, and replacement
  review;
- complete semantic MCP coverage for the ordinary Artist workflow on a task branch;
- reusable recipe/module boundaries proven by Numberdroid fixtures.

Implementation note (2026-08-27, **A1.0 implemented and explicitly user-accepted**):
the pure schema-v1 `ProcessingRecipe` contract now covers only one immutable PNG
input and one typed, bounded `studio.image.exact-png-crop` operation backed by
the accepted `numberdroid-studio.exact-png-crop.v1` processor. Its compatibility
projection reproduces the four pinned Family Hygiene outputs byte-for-byte and
strips atlas pivot/remap semantics from pixel intent. It adds no persisted
recipe/result, new image operation, job, SQLite schema, command/query, MCP/HTTP/
UI surface, semantic asset adoption, review, materialization, repository write,
or publication authority. Exact evidence and remaining scope are recorded in
[`A1_0_STATUS.md`](A1_0_STATUS.md).

Implementation note (2026-08-27, **A1.1 implemented and explicitly user-accepted**):
the pure schema-v1 `ProcessingResult` contract now records an immutable result
descriptor for A1.0's one exact-PNG crop operation. It closes the recomputed recipe
fingerprint, processor, complete input descriptor, ordered derived output IDs,
content addresses, dimensions, canonical byte lengths and digests, plus bounded
structured findings. Its trusted compatibility builder snapshots the pinned
source bytes and executes the unchanged accepted crop kernel; the four Family
Hygiene outputs remain byte-identical. A result URI does not prove CAS presence
or `LIVE` state, and its fingerprint is a descriptor identity rather than an
attestation. A1.1 adds no persistence, job/command integration, semantic asset
adoption, replacement/review, capability check, MCP/HTTP/UI surface, new pixel
operation, materialization, repository write, or publication authority. Exact
evidence and remaining scope are recorded in
[`A1_1_STATUS.md`](A1_1_STATUS.md).

Implementation note (2026-08-27, **A1.2 explicitly user-accepted**): the pure
schema-v1 `AssetInputSelection` contract records one caller-explicit `surface`,
`prop`, or `item` choice and one exact ProcessingResult output as the fixed
`primary-visual` input role. It pins the complete result
fingerprint plus recipe, operation, input, and selected-output lineage and
validates that closure against the full ProcessingResult. The result fingerprint
binds findings, including `ERROR`, but selection grants no adoption, approval,
or lifecycle authority.
A1.2 adds no project/asset mutation, CAS proof, persistence, job/command,
capability advertisement, CandidateManifest/adapter mapping, MCP/HTTP/UI surface,
new pixel operation, materialization, repository write, or publication authority.
It therefore does not satisfy `IMG-006` end to end. Exact evidence and remaining
scope are recorded in [`A1_2_STATUS.md`](A1_2_STATUS.md).

#### A1.3 — project-bound adoption preflight

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** A1.3 adds
the planned read-only, nonauthorizing Domain/Application preflight contract,
not an Asset mutation. It closes one validated `ProcessingRecipe` →
`ProcessingResult` → `AssetInputSelection` chain and returns an immutable
receipt that:

- models an explicit `create` or `update` target with stable Asset identity and
  exact expected Asset and metadata versions, matching the accepted CP2C
  vocabulary without reusing its slice binding;
- pins the exact capability-manifest schema/version/fingerprint and dedicated
  validate operation without mutating the current pinned Numberdroid profile;
- requires a project-scoped CAS revalidation port to prove registered `LIVE`
  metadata and independently observed physical input/selected-output digest,
  bytes, media type, and dimensions;
- requires a project-scoped read-only Asset-state port that proves a `create`
  target is unused or an `update` target matches the exact expected current
  Asset and metadata heads;
- blocks `ERROR` findings and carries `WARNING` findings forward without
  accepting or dispositioning them;
- distinguishes a valid preflight from authorization, semantic adoption,
  review, lifecycle, finalization, materialization, or publication.

The current Numberdroid profile v1 does not advertise the dedicated operation,
so it deterministically blocks before Asset/CAS reads; success is proven only
with a synthetic generic profile-v2 fixture. A1.3 does not reinterpret CP2C
`ExactSliceBinding` or `AssetProposal`: A1 lineage lacks committed
atlas/slice/pivot/remap authority. It adds no production port adapter, SQLite
migration, command registration, durable job, MCP/HTTP/UI surface,
CandidateManifest/adapter mapping, new pixel operation, or repository write.
Exact scope, fixture fingerprints, tests, and exclusions are recorded in
[`A1_3_STATUS.md`](A1_3_STATUS.md). The subsequent A1.4 candidate revalidates
rather than trusting the receipt and deliberately stops before atomic mutation.

#### A1.4 — processing-result adoption planning

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** A1.4
freezes a strict private `asset.processing-result.adopt` command and one
agent-task-only planning policy without registering, executing, or persisting
the command. The service:

- requires exact ACTIVE Task and active Grant evidence bound to the trusted
  agent, project, non-main task branch, branch revision, private scope, exact
  project/Asset object scopes, expiry, one remaining command budget, and no
  auto-accept entry before any preflight read;
- embeds the complete A1.3 request rather than accepting a prior receipt, then
  requires a fresh project/branch/revision-bound A1.3 result on every prepare;
- returns no plan for a blocked receipt and preserves unresolved warnings for a
  passing one without dispositioning them;
- freezes the later atomic/idempotent rule without executing it: same key and
  same task-bound semantics return the original result, same key with different
  semantics fails as a conflict, a reused command ID with another key fails,
  all listed effects are all-or-none, and an unknown outcome is resolved by
  retrying the same key;
- describes an explicit-name, validator-normalized explicit-empty-metadata
  DRAFT create, or an imagery-lineage-only update that resets the new version
  to DRAFT while preserving the name and authored metadata; derived visual
  metadata, findings, and empty warning dispositions must be recomputed in the
  later atomic unit of work, preserving metadata version `M` only when its
  fingerprint stays equal and otherwise producing `M+1`;
- uses a processing-specific lineage binding rather than CP2C
  `ExactSliceBinding`, and enumerates all authority, head, capability, Asset,
  CAS, idempotency, Activity, reference, budget, and revision work A1.5 must
  repeat atomically.

Every result remains `NONE`, `NOT_GRANTED`, `NOT_PERFORMED`, `NOT_ATTEMPTED`,
and `REQUIRED_IN_ATOMIC_UNIT_OF_WORK`. The command type and scope remain absent
from the 33-command/30-scope compatibility contracts, so current tasks cannot
receive it. There is no production port, persistence, migration, dispatch,
MCP/HTTP/UI surface, review, merge, lifecycle, materialization, or release
authority. Exact scope, fixture identities, tests, and exclusions are recorded
in [`A1_4_STATUS.md`](A1_4_STATUS.md).

#### A1.5 — private processing-result adoption persistence

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** A1.5
implements the durable private boundary A1.4 specified without registering or
publicly dispatching the command. One exact atomic-store port and additive
schema v13 now:

- resolve same-key/same-task-semantics replay from the immutable branch ledger
  before clock, authority, capability, or CAS work, returning the original
  result even for a new unused retry command ID; semantic-key and command-ID
  conflicts retain deterministic precedence;
- re-close ACTIVE Task, active Grant, exact agent/task/non-main branch/head,
  immutable head-ledger agreement, project/Asset scopes, private scope, expiry,
  no-auto-accept, command budget/usage, exact capability pin, Asset head,
  derived metadata/findings, both current Main-authorized artifact descriptors,
  and held physical PNG bytes;
- derive a fresh A1.3 receipt, A1.4 plan, immutable adoption Aggregate, and
  replay result internally rather than accepting any of them from a caller;
- commit one branch revision, private DRAFT processing Asset projection, exact
  processing lineage, two immutable role-bearing retention references,
  Activity, and one branch command charge in one SQLite transaction;
- prove create/update `1/1`, `N+1`, and `M`/`M+1` semantics; fault rollback,
  lost-response/restart replay, deep tamper detection, usage rederivation,
  private CAS retention, v12/v13 backup compatibility, unknown-newer-schema
  rejection, and unchanged portable bundle v1-v3 semantics.

Private references preserve CAS/backup reachability after temporary Main
references are released but never satisfy new project artifact-authority
checks. Main project/CP2C Asset tables and `ExactSliceBinding` remain unchanged.
Unexpected MERGED processing state fails integrity and bundle export closed;
CANCELLED/REJECTED private state remains absent from portable bundles. The
all-or-none claim covers exact held pre-existing CAS bytes plus SQLite records,
not a joint filesystem/database transaction or concurrent uncoordinated GC.

The command/scope remain absent from the 33-command/30-scope contracts, current
Numberdroid profile v1 remains unsupported, and MCP discovery remains 19/4 or
task-bound 30/5. There is no StudioService/AgentTaskService route, Numberdroid
profile v2, MCP/HTTP/UI exposure, owner decision, review, merge, lifecycle,
materialization, or release authority. Exact scope, identities, tests,
operational limits, and rollback are recorded in
[`A1_5_STATUS.md`](A1_5_STATUS.md).

#### A1.6a — Authoring-v2 prerequisites

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** A1.6a
deliberately stops before transport exposure. It adds one separately versioned
private command-feature/scope overlay, additive Numberdroid profile v2, trusted
task/grant provisioning support, and real SQLite/CAS-backed A1.4 planning ports.
The overlay is one separately typed command feature plus the exact 31-scope
vocabulary while the legacy definitions/scopes remain 33/30; profile v1 is
byte-identical while profile v2 adds only the dedicated
processing-adoption preflight vocabulary and operation. Real dry-run returns a
fresh `READY` plan or current blockers without writing, retaining, charging, or
granting authority. A1.5 commit remains the only private mutation seam and
repeats every check.

At the A1.6a boundary no server, launcher, HostBinding, HTTP route, UI, or MCP
composition selected these prerequisites. Legacy MCP discovery remains exactly 19/4 without
a task and 30/5 for a matching task. There is no owner decision, auto-accept,
review, merge, lifecycle, materialization, or release authority. Exact scope,
hashes, tests, and exclusions are recorded in
[`A1_6A_STATUS.md`](A1_6A_STATUS.md).

#### A1.6b1 — host-bound adoption admission

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** Before any
transport exposure, A1.6b1 closes the current Grant during strict HostBinding
resolution and adds a separately composed host-bound A1.5 port. The port checks
the exact current Binding↔project/actor/task/grant/branch and Grant liveness
before any replay, then repeats that guard inside the existing mutation
transaction before concurrent replay or writes. Revocation or expiry crossed
during capability or held-CAS work therefore leaves no adoption effect.
Existing generic and specialized MCP denial auditing remains redacted and
durable through a nonauthorizing audit subject followed by strict resolution;
only the strict live result supplies dispatch identity and both phases share
one request correlation.

At the A1.6b1 boundary no server composed the new port and no MCP/HTTP/UI surface, profile selection,
command/scope registration, migration, owner decision, review, merge,
lifecycle, materialization, or release authority is added. Exact behavior,
tests, and recovery are recorded in
[`A1_6B1_STATUS.md`](A1_6B1_STATUS.md).

#### A1.6b2a — private Authoring-v2 execution session

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** A1.6b2a
composes the previously unwired prerequisites behind one private, one-shot
Application session. Capabilities and `dryRun: true` perform repeated current
HostBinding/Grant/Task/branch/ledger admission around the exact Numberdroid v2
profile and real A1.4 planning ports. `dryRun: false` instead enters a freshly
bound, distinctly typed A1.6b1/A1.5 port directly so ledger-first
lost-response replay remains available after `maxCommands: 1` is charged.

The SQLite production server constructs the v2 provider, adoption store, and
runtime with one clock, stores only the runtime in a module-private `WeakMap`,
and creates reader, planning ports, and sessions transiently per operation.
The runtime drains active operations before writer shutdown and returns none
of these internals. There is still no route, launcher selector, gateway,
MCP tool/resource, UI, migration, startup semantic write, owner decision,
review, merge, lifecycle, materialization, publication, or release authority.
Exact behavior, tests, and recovery are recorded in
[`A1_6B2A_STATUS.md`](A1_6B2A_STATUS.md).

#### A1.6b2b — explicit Authoring-v2 transport exposure

**Status: IMPLEMENTED CANDIDATE — NOT USER ACCEPTED (2026-08-28).** A1.6b2b
adds the callable local transport without changing accepted legacy behavior.
Only exact `NUMBERDROID_STUDIO_MCP_PROFILE=authoring-v2` selection requests the
candidate; absence preserves legacy startup and every other set value fails
closed. Before stdio construction, a private loopback/Bearer server negotiation
must positively close the matching HostBinding, active Task/Grant, non-main
branch, Numberdroid-v2 fingerprint, and store/runtime. It reports `AVAILABLE`
with remaining command budget or `REPLAY_ONLY` at exact exhaustion; neither
state is command authority.

The process then freezes exactly 31 tools/six resource templates: the complete
matching-task 30/five surface plus only `studio_processing_result_adopt` and
`studio://projects/{projectId}/capabilities`. Capabilities and `dryRun: true`
create fresh one-shot sessions and repeat full budget-strict admission.
`dryRun: false` creates a fresh strict HostBinding-bound session but enters the
A1.5 ledger-first atomic store directly, preserving same-key lost-response
replay after `maxCommands: 1` while new semantics remain denied. Running
discovery stays static after revocation; subsequent calls resolve current
authority and fail closed. There is no legacy fallback.

MCP cancellation propagates through gateway/private HTTP to the application
session without interrupting an active atomic commit; unknown outcomes use the
same idempotency key. Shutdown drains active v2 operations before closing the
writer, and restart requires fresh positive negotiation while allowing
`REPLAY_ONLY` recovery. Successful negotiation/capability/dry-run produces no
authorization row; successful commit/replay uses atomic semantic Activity;
each attributable denial/failure produces one redacted final attempt and
pre-binding traffic produces none. The block adds no public HTTP/UI, launcher
auto-opt-in, scope-catalog exposure, provider-v1 change, owner review/apply/
finalize, merge/revert, lifecycle, materialization, publication, or release.
Legacy 33/30, profile v1, 19/four, 30/five, schema v13, and bundle v1-v3
contracts remain unchanged. Exact scope and recovery are recorded in
[`A1_6B2B_STATUS.md`](A1_6B2B_STATUS.md).

#### Remaining A1 completion sequence after A1.6b2b

A1.6b2b supplies an implemented, non-accepted candidate path for `IMG-006`,
but it does not complete the Artist path. The next dependent block is:

1. **A1.7 — visual review/correction candidate:** the implementation-grounded
   D0 workflow/state contract is frozen in
   [`A1_7_STATE_CONTRACT.md`](A1_7_STATE_CONTRACT.md). The separately
   classified minimal L3 task/adoption read projection is now an implemented,
   non-accepted candidate recorded in
   [`A1_7_READ_PROJECTION_STATUS.md`](A1_7_READ_PROJECTION_STATUS.md). Its
   dependent bounded selected-task UI is also an implemented, non-accepted
   candidate with dedicated browser evidence, recorded in
   [`A1_7_UI_CANDIDATE_STATUS.md`](A1_7_UI_CANDIDATE_STATUS.md). The Klaus live
   gate remains deferred. Neither block adds a browser mutation or owner/release
   authority.

Additional processing operations remain one deterministic processor block each.
A1 is complete only when an authorized task can execute the ordinary
image-to-semantic-asset path end to end and stop at **Waiting for your review**
without acquiring owner review, merge, finalization, materialization, or
publication authority. A2 planning may proceed independently, but it cannot
claim complete Artist parity while A1.7 and the remaining required processing
coverage are incomplete and unaccepted.

### A2 — Agent parity and concurrent production

- every ordinary source/processing/asset/level authoring command available through
  versioned MCP, never UI automation;
- capability-driven discovery, typed batches, dry-run, idempotency, dependencies,
  and clean-agent guidance;
- concurrent Artist and Level Designer tasks sharing immutable artifacts while one
  authoritative writer preserves isolated semantic branches and explicit conflicts;
- owner-only authority, review, merge, recovery activation, materialization, and
  publication.

### A3 — Requirements-driven level graph, actors, and logic

- versioned typed `LevelRequirementSet` with ambiguities, assumptions, constraints,
  acceptance criteria, and traceability;
- layout, rooms/corridors/zones/paths, placements, actor instances, routes, pickups,
  and runtime behavior references;
- typed level variables, triggers, conditions, ordered actions, dialogue/text, and
  capability-advertised waves/spawners;
- deterministic validation, requirement coverage, bounded explanatory simulation,
  and explicit unsupported-capability findings;
- animation clips may cover actors as well as tiles/props; runtime behavior and
  animation-state execution remain game responsibilities.

#### A3a — typed level-intent and logic-validation kernel

- add immutable, versioned `LevelRequirementSet`, `LevelGraph`, and `LogicGraph`
  contracts with stable IDs, canonical serialization, and deterministic
  fingerprints in Domain/Application boundaries;
- validate typed references, graph integrity, requirement coverage, and declared
  project capabilities with stable findings;
- use the reference chain “actor defeated → key drop → pickup → state change →
  visible text” only as a contract/validation fixture; and
- explicitly reject that fixture under the current Numberdroid capability
  profile where actor-authoring, actor-defeated triggers, drop actions,
  visible-text actions, or typed variables are unsupported.

A3a adds no persistence, UI, MCP surface, runtime execution, materialization,
publication, or release. It does not make the reference chain playable; the
concrete Numberdroid extension and complete playable candidate remain A4.

Implementation note (2026-08-30, **source-integrated / automated green — not
user accepted**): PR #179 integrated the strict schema-v1 Domain contracts,
canonical fingerprints, and pure Application validator after Build #2264 / run
`33313560001`; merge `7322542b07907710bbba16e3ffd7d1b2fc6aa5a3` passed
post-merge Build #2265 / run `33313888975`. The unchanged Numberdroid capability
profile still blocks the actor-to-text chain. No production capability or
operational surface is enabled. Scope and evidence are recorded in
[`A3A_LEVEL_LOGIC_KERNEL_STATUS.md`](A3A_LEVEL_LOGIC_KERNEL_STATUS.md).

### A4 — Complete Numberdroid vertical candidate

- preserve Numberdroid's existing rooms, connections, props, actors, staged actors,
  routes, pickups, zones, triggers, events, and flags without loss;
- extend only the missing typed semantics needed for the reference scenario:
  a routed actor is defeated, drops a key, and key collection changes state and
  displays text;
- create, validate, compile, preview, diff, and submit an immutable complete level
  candidate entirely through a scoped agent task;
- require human review/merge and keep repository materialization/publication separate.

A4 proceeds in bounded dependency order:

1. **A4a — lossless Numberdroid projection and capability delta:** adapter-owned
   projection of existing LevelSpec/compiler semantics into A3a contracts,
   pinned TS-01/gold-slice fixtures, and no capability claim without proof;
2. **A4b — bounded reference behavior:** add only the missing routed
   actor-defeated → key-drop → pickup → boolean-state → visible-text semantics
   and advertise them only after compiler/runtime tests pass; and
3. **A4c — task-scoped candidate path:** create, validate, compile, preview,
   diff, and submit one immutable candidate, stopping at human review without
   materialization, repository write, publication, or release authority.

**A4c authority decision — 2026-08-31 (implemented in bounded source slices on
2026-09-01; VT-014 user accepted 2026-09-02):** every chain remains rooted in a human-created
task/grant. The private application scope `level.candidate.create` may authorize
exactly the task-bound create → validate → compile → preview → diff → submit
sequence and must stop at `IN_REVIEW` / `OPEN` / all `PENDING` /
`REVIEW_SUBMITTED` / **Waiting for your review**. An agent may separately
request a trusted-service-derived child task only as an atomic attenuation of
its exact active parent: same project/actor, exact parent head, subset scope,
reserved parent budget, no later expiry, ancestor rechecks, cascading denial,
disabled auto-accept, and no further child delegation in the first slice.
Neither mechanism grants root-task/grant management, review, merge, main append,
materialization, repository write, publication, release, Remote MCP, Pairing,
HostBinding, browser, public, or Funnel authority. Existing 19/4, 30/5, and
selected 31/6 discovery catalogs do not change. The candidate path comes first;
derived-child persistence is a separate L3 slice, not a prerequisite.

The authority-neutral A4c Domain DTO foundation is **source-integrated /
automated green; covered only as an internal part of VT-014 acceptance, with no
separate visible gate** through PR #186, final head
`c70019e5d510dcc06d2593b0258bd1970a0e2a6d`, Build #2279 / run
`33365246228`, merge `93187bfd039e00147ce930a937ff0801c09c9784`, and
post-merge Build #2280 / run `33368143760`. It performs no I/O and does not
implement the Application candidate path, EngineBridge trust check, task/review
persistence, child derivation, or any operational surface. Exact contract,
recovery provenance, pins, and next gates are recorded in
[`A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md`](A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md).

The private immutable Candidate Application is **source-integrated / automated,
browser and Windows green — VT-014 user accepted 2026-09-02** through PR #198, final head
`6ea743ff5570677c24a58fae2c5cad210af19d3d`, Build #2344 / run
`33553937139`, merge `053f9c407f5ecd7c93c1775249aa0630c88b6460`, and
post-merge Build #2345 / run `33554781224`. It binds the real A4b source,
A4a/A3a/adapter/compiler/validate-only EngineBridge closure and immutable
submission atomically, then stops at `IN_REVIEW` / `OPEN` / `PENDING` /
**Waiting for your review** with `main` unchanged.

The separately bounded derived-child slice is likewise **source-integrated /
automated, browser and Windows green — VT-014 user accepted 2026-09-02** through PR #199,
final head `6f7c6bfee89fec2e22200fe66002b3d3c73fb968`, Build #2347 / run
`33562709548`, merge `122a2533a12abe5e51e6458fa80f2047825240b4`, and
post-merge Build #2348 / run `33563416584` attempt 2. It derives only a
same-actor/same-project, exact-head, equal-or-narrower, budget-reserved,
no-later-expiry, depth-one child from an active human-rooted parent. Exact
implementation and verification truth is recorded in
[`A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md`](A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md).

A4a implementation note (2026-08-30, **source-integrated / automated green —
not user accepted**): PR #182 final head
`4b2d61ebfb37e280e7819c6c5db7b63ddcb7b6ff` passed Build #2271 / run
`33337454662`; merge `e0b2396c31f7f58d500591dbc5c6f9a431d9ef45`
passed post-merge Build #2272 / run `33337734484`, including Pages. The exact
bounded Numberdroid source/compiler closure, safe A3a subset, exhaustive
coverage/gaps, and `NOT_ADVERTISED` capability delta are integrated. The
production capability profile remains unchanged; all A4b vocabulary is still
blocked. Scope and evidence are recorded in
[`A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md`](A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md).

A4b implementation note (2026-08-30, **source-integrated / automated green —
not user accepted**): PR #184 final head
`475280def81cee3371c0a62606a496e846f010bc` passed Build #2275 / run
`33341970255`; merge `8238d05a29ee6524f6457bfccc315179ee3896b5`
passed post-merge Build #2276 / run `33342294000`, including Pages. The bounded
Actor-defeated → key-drop → Pickup → Boolean-state → visible-text reference
function, causal save restoration, additive profile-v3 capability delta, and
honest unprojected-reference gaps are integrated. The fixture is not registered
as a playable production Floor, so no distinct live `VT-` item is created and
the slice remains not user accepted. Scope and evidence are recorded in
[`A4B_REFERENCE_BEHAVIOR_STATUS.md`](A4B_REFERENCE_BEHAVIOR_STATUS.md).
The currently authorized A4 source sequence is complete in source. Klaus
explicitly accepted the bounded Candidate/child product and authority decision
as VT-014 on 2026-09-02. Room Editor VT-001 remains separately `REVISE`; its
reported UI defects are repaired and green through PR #201 but await a live
retest. VT-014 acceptance does not accept
A3a/A4a/A4b or authorize A5, A6, materialization, repository publication or
release.

### A5 — Thin portability proof

Only after A4, build one deliberately small Godot 2D/Tower Defense fixture. Use
paths, spawners/waves, actors, tower slots, typed game variables, reached-goal/
defeated events, and a victory condition to test the core/module/adapter split.
The engine editor remains authoritative for runtime/rendering/playtest. Unreal
support waits for a concrete project and supported editor-plugin/import boundary;
Studio never writes `.uasset` files directly.

### A6 — Human UI and mobile refinement

- first create low-fidelity workflow/state maps for Artist, Level Designer, review,
  conflict, and candidate flows;
- stabilize capability-driven information architecture and error/empty/loading/
  conflict states;
- then create detailed responsive/touch mockups and implement them behind separate
  visual checkpoints;
- reuse central canvas, tools, asset palette, layers, inspector, lineage, and live
  preview patterns from suitable Adobe/game-engine/reference tools without copying
  their complexity.

Detailed UI mockups are therefore useful, but they are not an A0 dependency.
Polished mockups become valuable immediately before A1/A3/A6 visual implementation,
after semantic commands and workflow states stop moving.

## Later growth after the first portability proof

Possible later tracks, each requiring its own accepted architecture slice:

- standalone packaging and automatic updates;
- team collaboration beyond multiple task-scoped agents on the private owner service;
- authenticated Streamable HTTP MCP only if its separate O4 transport contract is accepted;
- additional concrete game adapters and export profiles;
- procedural assistance operating on the same typed requirements and command core;
- plugin/provider SDK for image generation and analysis;
- asset dependency impact analysis across multiple projects;
- engine round-trip synchronization only when ownership/conflict semantics are proven;
- review environments, signed candidate manifests, and release promotion.

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
