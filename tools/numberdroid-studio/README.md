# Numberdroid Studio

Numberdroid Studio is the local-first, agent-first authoring and production system for turning visual sources and level requirements into inspectable, validated game-content candidates. Numberdroid is the first complete target; reusable core and authoring modules may later feed other project or engine adapters. The visual application and MCP server execute the same semantic commands through one application core.

The product lives in this self-contained folder so it can be moved into a standalone repository without moving Numberdroid runtime code with it. Numberdroid-specific imports and exports belong only in `packages/numberdroid-adapter`. The binding product direction is [Product Vision](docs/VISION.md); historical checkpoint contracts remain compatibility and regression records, not the final scope ceiling.

## Status

Checkpoint 1 is the accepted foundation, Checkpoint 2A was user-accepted on 2026-08-21, and **Checkpoint 2B was explicitly user-accepted on 2026-08-22 after the live walkthrough at head `309c24961f89389047db837471b2e434dd13e149`.** The earlier native-file-input and five-second cutter-scroll blockers remain part of the rejection history. Product repair `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d` preserves unchanged cutter DOM/focus/scroll, bounds one poll owner, restores compatible necessary renders, and defers external replacement during a captured drag; selector-only repair `04d876da750f348e24de9420be1ff59c349bc092` keeps the evidence independent of regenerated rectangle IDs. GitHub Actions run `32568108922` and artifact `9474639509` remain the pinned repaired browser evidence; final closure run `32572870510` and artifact `9475808319` are the post-acceptance evidence, and closure-head run `32573543172` passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`. In the live acceptance pass, a 12+ second passive refresh preserved both cutter axes, focused `Top margin = 5`, and page position; definition save, 4/4 preview, 4/4 atomic apply, explicit recut mapping, close/reopen discard of unsaved edits, and a full service restart all behaved as required without duplication.

**Checkpoints 1–4 are user-accepted, and PR #135 was separately merged on 2026-08-24. The latest CP4.5 plus CP5 candidate source was integrated into `main` through PR #137 on 2026-08-25; Checkpoint 4.5 still awaits its live user gate and CP5 remains candidate-only, so the source merge accepts neither checkpoint.** The 4.5 candidate makes delegated tasks list-first with focused creation and one truthful detail flow, adds a useful exact-slice prop preview before approval/placement, replaces the rejected six-page room flow with a persistent canvas/toolbox/dock editor, and adds explicit sparse `VOID`/`BLOCKED` room semantics. Schema v12 persists immutable shape cells; rectangular room bundles stay schema v2 and only masked rooms require schema v3. The first 5 slice freezes exact FINAL closures, builds deterministic virtual Numberdroid files/CAS copy descriptors, and runs the canonical compiler through a fixed bridge. Candidate materialization, candidate-created Git commits, release, publication, and all related agent authority remain blocked; ordinary human-authorized source integration is a separate repository-maintenance action. See the [Checkpoint 4.5 candidate record](docs/CHECKPOINT_4_5_STATUS.md), [Checkpoint 5 contract](docs/CHECKPOINT_5_CONTRACT.md), [Checkpoint 5 candidate status](docs/CHECKPOINT_5_STATUS.md), and [roadmap](docs/ROADMAP.md).

The agent-first A0.1–A0.4 contracts are integrated but not user-accepted.
A1.0–A1.1 now have implemented, likewise unaccepted contract candidates for the
accepted exact-PNG crop operation only: a pure recipe plus a pure result record
with recipe/processor/input/output evidence and structured findings. They add no
persisted processing workflow or new operation. See the [A1.0 status](docs/A1_0_STATUS.md)
and [A1.1 status](docs/A1_1_STATUS.md).

Acceptance was recorded in `52eb9d32cab4fcbf20559455bc141215e7fb8998`. Later commits `f116f25aed2f0a9d935de9061cf6492d3a56bef4` and `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` change only the `visualFixture`/test evidence harness; they do not change product behavior or reopen acceptance. Failed run `32571622269` (both Studio attempts failed; artifact `9475480760`, 846 bytes) and failed run `32572344465` (Studio job `97029542069`, isolating Chrome/CDP post-move pointer-capture bookkeeping) are invalid diagnostic evidence only. Final post-acceptance closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped. Its valid 16-file artifact `9475808319` is 2,839,931 bytes, `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, and expires `2026-09-05T12:26:26Z`. Under Chrome `151.0.7922.137` at 1440×900 and 1060×900, it records zero runtime and visual errors and proves captured press, a same-pointer held move, deferred rendering, matching release/settlement/replacement, exact scroll/context retention, and telemetry cleanup. Run `32568108922` / artifact `9474639509` remain the product-repair evidence; run `32572870510` / artifact `9475808319` are the final post-acceptance closure evidence.

| Area | Current status |
| --- | --- |
| Product contract | Checkpoints 1–4 user-accepted; Checkpoint 4.5, Checkpoint 5, A0.1–A0.4, and A1.0–A1.1 remain implemented candidates without user acceptance |
| Standalone boundary | Accepted package/dependency boundary; extraction remains a later packaging task |
| Human UI | Accepted source/asset/room/task foundations plus candidate list-first tasks, useful prop previews, and persistent-canvas rectangle/irregular-room authoring |
| Agent access | Accepted schema-v12 compatibility keeps 19 tools/four templates without a task and 30 tools/five templates for a matching task branch. The target requires MCP parity for all ordinary authoring through a separately versioned, feature-gated surface; authority, owner review, merge, materialization, and publication remain human-only. |
| Persistence | SQLite schema v12 WAL ledger with normalized immutable shape cells; sanitized bundles use schema v1/v2 and v3 only for masked rooms |
| Numberdroid export | Dependent CP5 candidate-only snapshot/adapter/compiler foundation; no persistence/approval UI, materialization, commit, or publishing authority yet |

## Run the accepted Checkpoints 1–4 and the Checkpoint 4.5 candidate locally

Requirements: Node.js 22 or newer. Dependencies and the official MCP client/server versions are pinned by `package-lock.json`.
The Studio regression suite runs in CI on Ubuntu and on Windows with Node.js 22.17.0. Test resources are released in reverse acquisition order so Windows can close SQLite WAL files before temporary workspaces are removed.

```bash
cd tools/numberdroid-studio
npm ci
npm test
npm run evidence:verify
npm run dev
```

Open `http://127.0.0.1:4317`, choose **Create / load demo**, then use **Sources** for intake/cutting and **Assets** for exact-slice V2 review. In **Rooms**, create an archetype and DRAFT room or hallway, edit intent/connectors, select an exact-version asset, and place it on the coordinate grid. In **Agent tasks**, compose a scoped isolated branch, inspect its scope/budget/timeline, pause/resume/cancel it, and perform semantic review/merge/revert. Validation, warning disposition, finalization, proposal decision/apply, merge, and revert remain explicit owner controls in the currently accepted surface. `Propose in draft` activates only for an actual matching task branch. The default workspace is `.numberdroid-studio/`: `studio.sqlite` is authoritative, `artifacts/` is the CAS, and the private MCP pairing listener is loopback-only. Set `NUMBERDROID_STUDIO_DATA` to select another workspace.

Checkpoint 2A source intake remains synchronous and bounded to 16 MiB and 4096×4096. It calls no provider and serves the verified original CAS bytes. Checkpoint 2B adds local, deterministic PNG cutting only; WebP remains valid for intake/original preview but cannot be cut by the 2B processor. Provider selection, egress, credentials, cost policy, and reproducibility expectations require a later explicit decision.

The accepted 2A slice remains deliberately single-user and refuses a non-loopback HTTP listener. A future remote/team deployment requires authenticated HTTP/TLS and is a separate adapter, not an environment-variable widening of this local service.

The server enforces one authoritative SQLite writer. `NUMBERDROID_STUDIO_STORE=json npm run dev` launches the protected JSON regression adapter explicitly; never run JSON and SQLite as simultaneous writers for the same logical workspace.

## Connect a local MCP host

1. In the Header **Agent access** pull-down, choose the narrowest suitable posture and confirm any broadening.
2. Open the effective-policy badge and choose **Show host setup**. Copy this secret-free MCP server entry into the local agent host.
3. Start/restart that host. Its stdio server starts immediately while its private loopback pairing request appears in the Header panel with a six-digit verification code.
4. Compare the code with the host diagnostic on stderr, then choose **Authorize**. The opaque credential travels only over the non-browser pairing channel and is held by the host process; it is never returned to the DOM, clipboard configuration, URL, logs, or browser storage.
5. The panel now lists the redacted authorized binding. **Revoke** stops it immediately. Changing posture revokes existing bindings; create and authorize a new host request for the new immutable grant. `Off` revokes all active bindings and they never reactivate later.

MCP stdout is protocol-only. Pairing state and protocol diagnostics go to stderr. The Header distinguishes an active policy from an authorized host: a `SCOPED` policy alone does not mean that an agent is connected.

## Administration, migration, and recovery

Stop the Studio process before administrative commands. Backup and restore destinations must be new. `migrate-json` creates a migration-intent identity file and may reopen only the same matching partial migration after a crash; it refuses unrelated directories, other migration IDs, changed source manifests, foreign projects, or non-migration data.

```bash
# Inspect and protect a C1A JSON source before cutover
npm run admin -- manifest-json /path/to/frozen-json
npm run admin -- migrate-json /path/to/frozen-json /path/to/new-1b-data migration-2026-08-21

# Verify and back up a SQLite/CAS workspace
npm run admin -- integrity /path/to/1b-data
npm run admin -- backup /path/to/1b-data /path/to/new-backup
npm run admin -- verify-backup /path/to/new-backup

# Export/verify/import a sanitized project bundle through new destinations
npm run admin -- bundle-export /path/to/1b-data PROJECT_ID /path/to/new-bundle
npm run admin -- bundle-verify /path/to/new-bundle
npm run admin -- bundle-import /path/to/new-bundle /path/to/new-data

# Restore only into a new destination
npm run admin -- restore /path/to/new-backup /path/to/new-restored-data
```

Migration writes a protected JSON copy, source manifest, parity report, and `cutoverPerformed: false`; selecting the new data directory remains an explicit operator step. If migration stops, rerun the exact same command with the same frozen source, destination, and migration ID. The destination identity and every already-copied project are verified before continuation; never rename or edit the intent file to force reuse of another store.

`admin integrity` checks SQLite integrity and foreign keys plus every distinct referenced CAS object. It verifies that referenced metadata is `LIVE`, the digest-addressed object exists, its SHA-256 digest matches, and its byte length agrees with SQLite. It prints an `artifacts.findings` array and exits with status `2` whenever SQLite or any referenced artifact fails. An empty findings array with exit status `0` is required before cutover, backup, or recovery acceptance.

Schema v12 also verifies staged/claimed/abandoned source-intake references, permanent source/atlas/asset lineage, jobs, immutable assets/rooms and sparse shape cells, proposals, task branch/review/merge/revert lineage, rebuilt heads, imported APPLIED history, and state-specific CAS references. Portable export refuses nonterminal tasks and transfers no task authority/history. Roomless bundles remain schema v1, rectangular room projects remain schema v2, and masked-room projects use strict schema v3. Migration 0011 remains pinned to `f6ed508f3098e6cdeb3dca2af0a9be7baca12c18fcd9d518f75f4f353242639d`; migration 0012 is pinned to `1e48171a0c70c4d015001287d254aad8359ea34970bddcb17168a8a368dd17e1`.

## Accepted Checkpoint 1 baseline

The accepted navigation, information hierarchy, revision/activity visibility, demo command outcomes, and host-injected authority behavior MUST remain reproducible after 1B. The protected source commit, read-only JSON fixtures, integrity manifest, expected counts/hashes, reproducible browser capture workflow, and accepted run/digest/viewport record remain regression evidence for later checkpoints. The 26 screenshot bytes are currently only in a retention-limited Actions artifact; permanent screenshot goldens have not been published. See [the 1A baseline record](docs/CHECKPOINT_1A_BASELINE.md) and [1B acceptance record](docs/CHECKPOINT_1B_STATUS.md).

Checkpoint 1B adds two approved visual requirements without authorizing a broader redesign:

- a persistent Header **Agent access** pull-down with implemented `Off`, `Read only`, and semantic `Execute scoped task` authority, rendered compactly as the user-accepted `Scoped run`; the visible `Propose in draft` and `Custom…` entries are marked for later and grant nothing until branch/editor workflows exist;
- a small preview region on every Asset Library card, using an authorized image resource or an accessible kind-aware fallback for processing, missing, unsupported, or failed media.

## Product principles

1. **Agent-first.** Every ordinary authoring action is a semantic command available to an appropriately authorized agent; agents do not automate UI gestures.
2. **Visual and inspectable.** A user can see available material, every agent action, validation findings, requirement coverage, and the exact revision being changed.
3. **Semantic, not pixel-inferred.** Connectivity, collision, placement, role, and traversal semantics are explicit metadata. Image analysis may suggest values but cannot silently decide them.
4. **One command core.** UI, MCP, CLI, and future automation call identical commands and receive identical validation.
5. **Numberdroid first, interfaces reusable.** The complete Numberdroid path proves abstractions before another adapter is built.
6. **Local first.** Work-in-progress lives in a local database and content store. GitHub is an explicit, deterministic publish boundary, not an editing transport.
7. **Reversible by default.** Mutations are attributed, revisioned, idempotent where required, and recoverable through task branches and immutable history.
8. **Least authority for agents.** A human creates scoped grants. Authoring, review, merge, materialization, and publishing are distinct capabilities.
9. **Exportable product.** No core or reusable authoring module may depend on Numberdroid repository internals.

## Accepted Checkpoint 1 implementation layout

The accepted implementation uses these physical boundaries:

```text
tools/numberdroid-studio/
├── apps/
│   ├── studio-server/           # one-writer local service plus visual shell
│   ├── studio-mcp/              # official MCP stdio host and private bridge
│   └── studio-admin/            # migration, integrity, backup, and restore CLI
├── packages/domain/             # contracts, validation, errors, command catalog
├── packages/application/        # command/query core and storage port
├── packages/persistence/        # SQLite, CAS, migration, backup, JSON regression adapter
├── packages/preview/            # deterministic audited PNG decode/crop/encode
├── packages/mcp-server/         # secured semantic catalog and official MCP adapter
├── fixtures/                    # protected deterministic evidence
├── scripts/                     # verification/evidence preparation
└── docs/                        # product and architecture contracts
```

These are physical package boundaries, not facade names: domain has no outward dependency, application owns the storage port, persistence implements it, and the MCP adapter calls application commands through the running one-writer service. The combined UI/service host remains an accepted transitional packaging choice. No accepted core package imports Numberdroid internals. Empty reserved package directories do not count as implemented packages or capabilities.

## Target workspace layout as the product grows

```text
tools/numberdroid-studio/
├── apps/
│   ├── studio-ui/               # visual application
│   └── studio-service/          # one local writer and query service
├── packages/
│   ├── domain/                  # entities, invariants, value objects
│   ├── application/             # commands, queries, policies, jobs
│   ├── persistence/             # SQLite and content-addressed storage
│   ├── preview/                 # deterministic visual projections
│   ├── mcp-server/              # MCP tools/resources over application APIs
│   ├── authoring-modules/       # optional image/atlas/level/actor/logic modules
│   ├── adapter-contracts/       # capability, candidate, and engine-bridge ports
│   └── numberdroid-adapter/     # the only Numberdroid-aware package
├── fixtures/                    # shared deterministic test projects
└── docs/                        # product and architecture contract
```

This is a target topology, not a statement that every listed folder exists today. Folders are introduced only when a checkpoint needs them; empty scaffolding is avoided.

## Scope

The first complete product slice covers source provenance, reproducible non-destructive image processing, atlas/sprite extraction, visual asset cataloguing, semantic asset metadata, requirements-driven Numberdroid level authoring, layout, actors, routes, pickups, typed level variables, triggers/actions, validation, revision history, parallel agent tasks, and an immutable Numberdroid candidate.

Studio may configure level-local actors and logic by reference to runtime systems. It does not implement the game's renderer, physics, combat, navigation, economy, or general AI. Repository materialization and production publishing remain separate human-authorized operations. A thin Godot 2D/Tower Defense proof follows only after the Numberdroid vertical path works; Unreal support requires a concrete later project and supported editor integration.

## Documentation

- [Product vision](docs/VISION.md)
- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP contract](docs/MCP_CONTRACT.md)
- [Roadmap and user checkpoints](docs/ROADMAP.md)
- [Operations, Remote Access & Mobile masterplan](docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md)
- [Accepted Checkpoint 1A baseline](docs/CHECKPOINT_1A_BASELINE.md)
- [Accepted Checkpoint 1B foundation](docs/CHECKPOINT_1B_STATUS.md)
- [Accepted Checkpoint 2A source workflow](docs/CHECKPOINT_2A_STATUS.md)
- [Checkpoint 2B acceptance record](docs/CHECKPOINT_2B_STATUS.md)
- [Accepted Checkpoint 2C record](docs/CHECKPOINT_2C_STATUS.md)
- [Accepted Checkpoint 3 record](docs/CHECKPOINT_3_STATUS.md)
- [Accepted Checkpoint 4 record](docs/CHECKPOINT_4_STATUS.md)
- [Checkpoint 4.5 candidate record](docs/CHECKPOINT_4_5_STATUS.md)
- [Checkpoint 4.5 frozen contract](docs/CHECKPOINT_4_5_CONTRACT.md)
- [Checkpoint 5 candidate contract](docs/CHECKPOINT_5_CONTRACT.md)
- [Checkpoint 5 candidate status](docs/CHECKPOINT_5_STATUS.md)
- [A1.0 ProcessingRecipe candidate status](docs/A1_0_STATUS.md)
- [A1.1 ProcessingResult candidate status](docs/A1_1_STATUS.md)
- [Checkpoint 3 frozen implementation contract](docs/CHECKPOINT_3_CONTRACT.md)

These documents are normative for the Studio implementation. If code and documentation disagree, the discrepancy must be resolved explicitly; it must not become an accidental new contract.

## Safe reset and recovery

Stop the Studio process before moving a data directory. Prefer the verified administration flow above for durable recovery.

1. For a reset, rename `.numberdroid-studio/` to a dated backup such as `.numberdroid-studio.backup-2026-08-21/` instead of deleting it.
2. Start Studio again; it creates a new empty data directory. Use **Create / load demo** if a test fixture is wanted.
3. To recover, stop Studio, rename the new data directory out of the way, restore the backup directory to `.numberdroid-studio/`, and restart.
4. Run `npm run admin -- integrity <restored-directory>`, then confirm the expected project revision, activity count, and Asset previews before continuing work.

Never merge data directories, copy only a live SQLite main file, edit ledgers manually, or reuse a restore destination. C1A migration is copy-and-verify into a new SQLite/CAS destination; the original baseline remains untouched as accepted regression and migration evidence even after 1B acceptance. Cutover is explicit, JSON and SQLite are never concurrent authoritative writers, and rollback preserves the failed/new destination plus recovery evidence instead of silently discarding post-cutover work.
