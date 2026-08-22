# Numberdroid Studio

Numberdroid Studio is the local-first visual authoring environment for Numberdroid tiles, props, items, rooms, hallways, and level composition. It is designed for equal use by people and agents: the visual application and the MCP server execute the same semantic commands through one application core.

The product lives in this self-contained folder so it can be moved into a standalone repository without moving Numberdroid runtime code with it. Numberdroid-specific imports and exports belong only in `packages/numberdroid-adapter`.

## Status

Checkpoint 1 is the accepted foundation, Checkpoint 2A was user-accepted on 2026-08-21, and **Checkpoint 2B was explicitly user-accepted on 2026-08-22 after the live walkthrough at head `309c24961f89389047db837471b2e434dd13e149`.** The earlier native-file-input and five-second cutter-scroll blockers remain part of the rejection history. Product repair `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d` preserves unchanged cutter DOM/focus/scroll, bounds one poll owner, restores compatible necessary renders, and defers external replacement during a captured drag; selector-only repair `04d876da750f348e24de9420be1ff59c349bc092` keeps the evidence independent of regenerated rectangle IDs. GitHub Actions run `32568108922` and artifact `9474639509` remain the pinned repaired browser evidence; final closure run `32572870510` and artifact `9475808319` are the post-acceptance evidence, and closure-head run `32573543172` passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`. In the live acceptance pass, a 12+ second passive refresh preserved both cutter axes, focused `Top margin = 5`, and page position; definition save, 4/4 preview, 4/4 atomic apply, explicit recut mapping, close/reopen discard of unsaved edits, and a full service restart all behaved as required without duplication.

**Checkpoint 2C is now implemented as a verification candidate and remains not user-accepted.** It adds strict versioned `surface`/`prop`/`item` assets bound to exact committed slices, typed metadata and deterministic findings, owner-gated lifecycle, durable bounded agent proposals with per-item owner decisions and accepted-subset apply, ordinal **Slice 1–64** labels with stable canonical IDs secondary/copyable, schema-v9 MCP discovery of exactly 17 tools and three resource templates, and a sanitized offline project-bundle round trip. The full local Studio suite passes 219/219. Published CI/browser evidence and the independent verifier disposition are recorded in the [2C candidate record](docs/CHECKPOINT_2C_STATUS.md). Its sole authorized import/export operation is the offline, project-scoped portable Studio bundle round trip. PR #135 remains open, draft, and unmerged. Merge, release, providers, rooms, Numberdroid/runtime/repository export, materialization, and publication remain blocked. See the [2C authorization handoff](../../docs/history/handoffs/HANDOFF_2026-08-22_NUMBERDROID_STUDIO_CHECKPOINT_2C.md), [2C candidate record](docs/CHECKPOINT_2C_STATUS.md), [2B acceptance record](docs/CHECKPOINT_2B_STATUS.md), [2A acceptance record](docs/CHECKPOINT_2A_STATUS.md), and [roadmap](docs/ROADMAP.md).

Acceptance was recorded in `52eb9d32cab4fcbf20559455bc141215e7fb8998`. Later commits `f116f25aed2f0a9d935de9061cf6492d3a56bef4` and `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` change only the `visualFixture`/test evidence harness; they do not change product behavior or reopen acceptance. Failed run `32571622269` (both Studio attempts failed; artifact `9475480760`, 846 bytes) and failed run `32572344465` (Studio job `97029542069`, isolating Chrome/CDP post-move pointer-capture bookkeeping) are invalid diagnostic evidence only. Final post-acceptance closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped. Its valid 16-file artifact `9475808319` is 2,839,931 bytes, `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, and expires `2026-09-05T12:26:26Z`. Under Chrome `151.0.7922.137` at 1440×900 and 1060×900, it records zero runtime and visual errors and proves captured press, a same-pointer held move, deferred rendering, matching release/settlement/replacement, exact scroll/context retention, and telemetry cleanup. Run `32568108922` / artifact `9474639509` remain the product-repair evidence; run `32572870510` / artifact `9475808319` are the final post-acceptance closure evidence.

| Area | Current status |
| --- | --- |
| Product contract | Checkpoints 1, 2A, and 2B user-accepted; Checkpoint 2C implemented as a candidate, not user-accepted |
| Standalone boundary | Accepted package/dependency boundary; extraction remains a later packaging task |
| Human UI | Accepted 2A source workflow and 2B atlas cutter; 2C candidate adds ordinal-first asset inventory, proposal diff/review, and lifecycle controls |
| Agent access | Schema v8 advertises the accepted 15 tools/two templates; schema v9 advertises exactly 17 tools/three templates, with owner decision/apply/lifecycle absent |
| Persistence | SQLite schema v9 WAL ledger, durable atlas jobs/proposals/import history, SHA-256 CAS, and sanitized project bundles; JSON remains protected migration input/regression only |
| Numberdroid export | Adapter boundary specified; production publishing deferred |

## Run the accepted 2A/2B slices and the 2C candidate locally

Requirements: Node.js 22 or newer. Dependencies and the official MCP client/server versions are pinned by `package-lock.json`.

```bash
cd tools/numberdroid-studio
npm ci
npm test
npm run evidence:verify
npm run dev
```

Open `http://127.0.0.1:4317`, choose **Create / load demo**, then open **Sources**. Import a PNG or WebP, inspect the original CAS preview and provenance, choose **Propose for review**, and explicitly approve or reject it. For an approved PNG, open the atlas cutter, propose or edit integer rectangles, choose inclusion and recut identity explicitly, build the previews, inspect the job, and commit the slices. Open **Assets** to inspect ordinal-first exact-slice provenance, filter the V2 inventory, review proposal item diffs, record owner accept/reject dispositions, apply an accepted subset, and promote an eligible asset lifecycle explicitly. A staged upload that did not commit remains visible with **Resume** and **Discard** controls after restart. The default workspace is `.numberdroid-studio/`: `studio.sqlite` is authoritative, `artifacts/` is the CAS, and the private MCP pairing listener is loopback-only. Set `NUMBERDROID_STUDIO_DATA` to select another workspace.

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

Schema v9 also verifies staged/claimed/abandoned source-intake references, permanent source/atlas/asset lineage references, the authorized/denied/failed agent-attempt ledger, job state and event invariants, exact input/applied revision ownership, durable asset-proposal decisions, immutable imported APPLIED history, and state-specific temporary/permanent CAS references. Backup and bundle export first run the complete semantic/CAS integrity precondition. Backup captures a snapshot-consistent database/CAS pair; bundle export writes only a canonical project semantic document and its exact artifact closure, never live grants, HostBindings, attempts, work queues, idempotency, local paths, or credentials. Migrations 0007 and 0008 retain their accepted checksums; migration 0009 is pinned to `e387c3e56fb0bb03bd14743c6a7c7a6baad230c02dde8f158e485e25776e7175`.

## Accepted Checkpoint 1 baseline

The accepted navigation, information hierarchy, revision/activity visibility, demo command outcomes, and host-injected authority behavior MUST remain reproducible after 1B. The protected source commit, read-only JSON fixtures, integrity manifest, expected counts/hashes, reproducible browser capture workflow, and accepted run/digest/viewport record remain regression evidence for later checkpoints. The 26 screenshot bytes are currently only in a retention-limited Actions artifact; permanent screenshot goldens have not been published. See [the 1A baseline record](docs/CHECKPOINT_1A_BASELINE.md) and [1B acceptance record](docs/CHECKPOINT_1B_STATUS.md).

Checkpoint 1B adds two approved visual requirements without authorizing a broader redesign:

- a persistent Header **Agent access** pull-down with implemented `Off`, `Read only`, and semantic `Execute scoped task` authority, rendered compactly as the user-accepted `Scoped run`; the visible `Propose in draft` and `Custom…` entries are marked for later and grant nothing until branch/editor workflows exist;
- a small preview region on every Asset Library card, using an authorized image resource or an accessible kind-aware fallback for processing, missing, unsupported, or failed media.

## Product principles

1. **Visual and inspectable.** A user can see available material, every agent action, validation findings, and the exact revision being changed.
2. **Semantic, not pixel-inferred.** Connectivity, collision, placement, role, and traversal semantics are explicit metadata. Image analysis may suggest values but cannot silently decide them.
3. **One command core.** UI, MCP, CLI, and future automation call identical commands and receive identical validation.
4. **Local first.** Work-in-progress lives in a local database and content store. GitHub is an explicit, deterministic publish boundary, not an editing transport.
5. **Reversible by default.** Mutations are attributed, revisioned, idempotent where required, and recoverable through a revision DAG.
6. **Least authority for agents.** A human creates bounded grants. Reading, editing, finalizing, and publishing are distinct capabilities.
7. **Exportable product.** No package except the Numberdroid adapter may depend on Numberdroid repository internals.

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
│   └── numberdroid-adapter/      # the only Numberdroid-aware package
├── fixtures/                    # shared deterministic test projects
└── docs/                        # product and architecture contract
```

This is a target topology, not a statement that every listed folder exists today. Folders are introduced only when a checkpoint needs them; empty scaffolding is avoided.

## Scope

V1 covers source provenance, atlas definition and cutting, visual asset cataloguing, surface/prop/item metadata, one-room and hallway authoring, set dressing, validation, revision history, agent operation, and a deterministic Numberdroid export candidate.

Enemy/NPC design, enemy routes, NPC animation, combat encounter authoring, and final production publishing are not part of V1. Tile and prop animations are reserved in the V1 identity model and become authorable in V2.

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP contract](docs/MCP_CONTRACT.md)
- [Roadmap and user checkpoints](docs/ROADMAP.md)
- [Accepted Checkpoint 1A baseline](docs/CHECKPOINT_1A_BASELINE.md)
- [Accepted Checkpoint 1B foundation](docs/CHECKPOINT_1B_STATUS.md)
- [Accepted Checkpoint 2A source workflow](docs/CHECKPOINT_2A_STATUS.md)
- [Checkpoint 2B acceptance record](docs/CHECKPOINT_2B_STATUS.md)
- [Checkpoint 2C candidate record](docs/CHECKPOINT_2C_STATUS.md)

These documents are normative for the Studio implementation. If code and documentation disagree, the discrepancy must be resolved explicitly; it must not become an accidental new contract.

## Safe reset and recovery

Stop the Studio process before moving a data directory. Prefer the verified administration flow above for durable recovery.

1. For a reset, rename `.numberdroid-studio/` to a dated backup such as `.numberdroid-studio.backup-2026-08-21/` instead of deleting it.
2. Start Studio again; it creates a new empty data directory. Use **Create / load demo** if a test fixture is wanted.
3. To recover, stop Studio, rename the new data directory out of the way, restore the backup directory to `.numberdroid-studio/`, and restart.
4. Run `npm run admin -- integrity <restored-directory>`, then confirm the expected project revision, activity count, and Asset previews before continuing work.

Never merge data directories, copy only a live SQLite main file, edit ledgers manually, or reuse a restore destination. C1A migration is copy-and-verify into a new SQLite/CAS destination; the original baseline remains untouched as accepted regression and migration evidence even after 1B acceptance. Cutover is explicit, JSON and SQLite are never concurrent authoritative writers, and rollback preserves the failed/new destination plus recovery evidence instead of silently discarding post-cutover work.
