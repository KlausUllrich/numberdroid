# Numberdroid Studio

Numberdroid Studio is the local-first visual authoring environment for Numberdroid tiles, props, items, rooms, hallways, and level composition. It is designed for equal use by people and agents: the visual application and the MCP server execute the same semantic commands through one application core.

The product lives in this self-contained folder so it can be moved into a standalone repository without moving Numberdroid runtime code with it. Numberdroid-specific imports and exports belong only in `packages/numberdroid-adapter`.

## Status

Checkpoint 1 is the foundation checkpoint and is deliberately split in two. **Checkpoint 1A was visually accepted by the user on 2026-08-21** and remains the protected baseline. **Checkpoint 1B is implemented as a verification candidate and is not yet user-accepted.** It preserves the shell while adding SQLite/CAS durability, an official MCP 2026-07-28 stdio transport, private human-approved host pairing, a service-backed Header Agent access selector, and preview/fallback regions on every Asset Library card. Asset cutting, room authoring, and runtime export follow as vertical slices; see [the roadmap](docs/ROADMAP.md).

| Area | Current status |
| --- | --- |
| Product contract | Checkpoint 1B verification candidate; user acceptance pending |
| Standalone boundary | Checkpoint 1A: package and dependency rules defined |
| Human UI | Protected 1A shell plus Header access pull-down, private host-pairing status, and Asset card previews/fallbacks |
| Agent access | Official MCP 2026-07-28 stdio; immutable HostBindings; private loopback pairing; per-call grant validation |
| Persistence | SQLite WAL ledger and SHA-256 CAS by default; JSON retained only for protected migration input/regression |
| Numberdroid export | Adapter boundary specified; production publishing deferred |

## Run the Checkpoint 1B candidate locally

Requirements: Node.js 22 or newer. Dependencies and the official MCP client/server versions are pinned by `package-lock.json`.

```bash
cd tools/numberdroid-studio
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:4317`, choose **Create / load demo**, and inspect Overview, Sources, Asset library, and Activity. The default workspace is `.numberdroid-studio/`: `studio.sqlite` is the authoritative ledger, `artifacts/` is the CAS, and the private MCP pairing listener is loopback-only. Set `NUMBERDROID_STUDIO_DATA` to select another workspace.

The server enforces one authoritative SQLite writer. `NUMBERDROID_STUDIO_STORE=json npm run dev` launches the protected JSON regression adapter explicitly; never run JSON and SQLite as simultaneous writers for the same logical workspace.

## Connect a local MCP host

1. In the Header **Agent access** pull-down, choose the narrowest suitable posture and confirm any broadening.
2. Open the effective-policy badge and choose **Show host setup**. Copy this secret-free MCP server entry into the local agent host.
3. Start/restart that host. Its stdio server starts immediately while its private loopback pairing request appears in the Header panel with a six-digit verification code.
4. Compare the code with the host diagnostic on stderr, then choose **Authorize**. The opaque credential travels only over the non-browser pairing channel and is held by the host process; it is never returned to the DOM, clipboard configuration, URL, logs, or browser storage.
5. The panel now lists the redacted authorized binding. **Revoke** stops it immediately. Changing posture revokes existing bindings; create and authorize a new host request for the new immutable grant. `Off` revokes all active bindings and they never reactivate later.

MCP stdout is protocol-only. Pairing state and protocol diagnostics go to stderr. The Header distinguishes an active policy from an authorized host: a `SCOPED` policy alone does not mean that an agent is connected.

## Administration, migration, and recovery

Stop the Studio process before administrative commands. Every destination must be new; commands refuse to overwrite it.

```bash
# Inspect and protect a C1A JSON source before cutover
npm run admin -- manifest-json /path/to/frozen-json
npm run admin -- migrate-json /path/to/frozen-json /path/to/new-1b-data migration-2026-08-21

# Verify and back up a SQLite/CAS workspace
npm run admin -- integrity /path/to/1b-data
npm run admin -- backup /path/to/1b-data /path/to/new-backup
npm run admin -- verify-backup /path/to/new-backup

# Restore only into a new destination
npm run admin -- restore /path/to/new-backup /path/to/new-restored-data
```

Migration writes a protected JSON copy, source manifest, parity report, and `cutoverPerformed: false`; selecting the new data directory remains an explicit operator step. Exercise launch and integrity checks on the restored destination before replacing any active pointer.

## Protected 1A baseline and 1B additions

The accepted navigation, information hierarchy, revision/activity visibility, demo command outcomes, and host-injected authority behavior MUST remain reproducible throughout 1B. Before migration work, record the accepted source revision/commit, copy the JSON fixture read-only, capture its integrity manifest and expected counts/hashes, and retain representative screenshots. See [the baseline record](docs/CHECKPOINT_1A_BASELINE.md).

Checkpoint 1B adds two approved visual requirements without authorizing a broader redesign:

- a persistent Header **Agent mode** pull-down showing `Off`, `Read only`, `Propose in draft`, `Execute scoped task`, and `Custom…`; it displays service-returned effective policy but never creates client-side authority;
- a small preview region on every Asset Library card, using an authorized image resource or an accessible kind-aware fallback for processing, missing, unsupported, or failed media.

## Product principles

1. **Visual and inspectable.** A user can see available material, every agent action, validation findings, and the exact revision being changed.
2. **Semantic, not pixel-inferred.** Connectivity, collision, placement, role, and traversal semantics are explicit metadata. Image analysis may suggest values but cannot silently decide them.
3. **One command core.** UI, MCP, CLI, and future automation call identical commands and receive identical validation.
4. **Local first.** Work-in-progress lives in a local database and content store. GitHub is an explicit, deterministic publish boundary, not an editing transport.
5. **Reversible by default.** Mutations are attributed, revisioned, idempotent where required, and recoverable through a revision DAG.
6. **Least authority for agents.** A human creates bounded grants. Reading, editing, finalizing, and publishing are distinct capabilities.
7. **Exportable product.** No package except the Numberdroid adapter may depend on Numberdroid repository internals.

## Checkpoint 1A implementation layout

Checkpoint 1A is intentionally dependency-free and compact:

```text
tools/numberdroid-studio/
├── apps/studio-server/          # local dev host plus visual shell
├── packages/domain/             # contracts, validation, errors, command catalog
├── packages/application/        # command/query core and storage port
├── packages/persistence/        # in-memory and atomic JSON development adapters
├── packages/mcp-server/         # secured MCP-shaped catalog/dispatcher seam
└── docs/
```

These are physical package boundaries, not facade names: domain has no outward dependency, application owns the storage port, persistence implements it, and the MCP-shaped adapter calls application commands. The combined development server is transitional. No 1A package may import Numberdroid internals.

## Workspace layout as the product grows

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

The folders are introduced only when a checkpoint needs them. Empty scaffolding is avoided.

## Scope

V1 covers source provenance, atlas definition and cutting, visual asset cataloguing, surface/prop/item metadata, one-room and hallway authoring, set dressing, validation, revision history, agent operation, and a deterministic Numberdroid export candidate.

Enemy/NPC design, enemy routes, NPC animation, combat encounter authoring, and final production publishing are not part of V1. Tile and prop animations are reserved in the V1 identity model and become authorable in V2.

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP contract](docs/MCP_CONTRACT.md)
- [Roadmap and user checkpoints](docs/ROADMAP.md)
- [Accepted Checkpoint 1A baseline](docs/CHECKPOINT_1A_BASELINE.md)

These documents are normative for the Studio implementation. If code and documentation disagree, the discrepancy must be resolved explicitly; it must not become an accidental new contract.

## Safe reset and recovery

Stop the Studio process before moving a data directory. Prefer the verified administration flow above for durable recovery.

1. For a reset, rename `.numberdroid-studio/` to a dated backup such as `.numberdroid-studio.backup-2026-08-21/` instead of deleting it.
2. Start Studio again; it creates a new empty data directory. Use **Create / load demo** if a test fixture is wanted.
3. To recover, stop Studio, rename the new data directory out of the way, restore the backup directory to `.numberdroid-studio/`, and restart.
4. Run `npm run admin -- integrity <restored-directory>`, then confirm the expected project revision, activity count, and Asset previews before continuing work.

Never merge data directories, copy only a live SQLite main file, edit ledgers manually, or reuse a restore destination. C1A migration is copy-and-verify into a new SQLite/CAS destination; the original baseline remains untouched until 1B acceptance. Cutover is explicit, JSON and SQLite are never concurrent authoritative writers, and rollback preserves the failed/new destination plus recovery evidence instead of silently discarding post-cutover work.
