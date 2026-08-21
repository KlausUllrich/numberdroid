# Numberdroid Studio

Numberdroid Studio is the local-first visual authoring environment for Numberdroid tiles, props, items, rooms, hallways, and level composition. It is designed for equal use by people and agents: the visual application and the MCP server execute the same semantic commands through one application core.

The product lives in this self-contained folder so it can be moved into a standalone repository without moving Numberdroid runtime code with it. Numberdroid-specific imports and exports belong only in `packages/numberdroid-adapter`.

## Status

Checkpoint 1 is the foundation checkpoint and is deliberately split in two. This first change set delivers **Checkpoint 1A**: binding architecture, a dependency-free JSON development store, a shared command core, a host-injected agent adapter, and a visual foundation shell. **Checkpoint 1B** replaces the development persistence with SQLite plus a content-addressed artifact store and adds the official MCP 2026-07-28 SDK/stdio transport. The foundation is not complete until 1B is accepted. Asset cutting, room authoring, and runtime export follow as vertical slices; see [the roadmap](docs/ROADMAP.md).

| Area | Current status |
| --- | --- |
| Product contract | Checkpoint 1A: binding requirements documented |
| Standalone boundary | Checkpoint 1A: package and dependency rules defined |
| Human UI | Checkpoint 1A: foundation shell delivered for user verification |
| Agent access | Checkpoint 1A: host-injected adapter; official MCP transport follows in 1B |
| Persistence | Checkpoint 1A: JSON development store; SQLite and CAS required in 1B |
| Numberdroid export | Adapter boundary specified; production publishing deferred |

## Run Checkpoint 1A locally

Requirements: Node.js 22 or newer. The checkpoint has no third-party runtime dependencies.

```bash
cd tools/numberdroid-studio
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:4317`, choose **Create / load demo**, and inspect Overview, Sources, Asset library, and Activity. The demo is persisted under `.numberdroid-studio/` unless `NUMBERDROID_STUDIO_DATA` points to another local directory.

This is a development checkpoint: do not use the JSON adapter as a multi-process production database. Checkpoint 1B replaces it with SQLite and a content-addressed artifact store.

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

These documents are normative for the Studio implementation. If code and documentation disagree, the discrepancy must be resolved explicitly; it must not become an accidental new contract.

## Safe reset and recovery

The JSON adapter is development-only, but its project ledger is recoverable. Stop the Studio process before moving its data directory.

1. For a reset, rename `.numberdroid-studio/` to a dated backup such as `.numberdroid-studio.backup-2026-08-21/` instead of deleting it.
2. Start Studio again; it creates a new empty data directory. Use **Create / load demo** if a test fixture is wanted.
3. To recover, stop Studio, rename the new data directory out of the way, restore the backup directory to `.numberdroid-studio/`, and restart.
4. Confirm the expected project revision and activity count before continuing work.

Never merge two JSON directories or edit their ledgers manually. Checkpoint 1B will add supported SQLite backup, restore, integrity diagnostics, and migration tooling.
