# Handoff — Numberdroid Studio Checkpoint 2

- **Date:** 2026-08-21
- **Repository:** `KlausUllrich/numberdroid`
- **Status:** Checkpoint 1A and 1B user-accepted; Checkpoint 2 planned and not started
- **Baseline `main` SHA at handoff preparation:** `1e1f0ce09a7c996f24cf6b216e400d57cb6dc666`
- **Accepted Studio implementation SHA:** `41fad464cd2f904666f7dfecc8437f2286c3254c`
- **Protected Checkpoint 1A SHA:** `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`
- **Development branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — `https://github.com/KlausUllrich/numberdroid/pull/135`
- **Baseline CI / Pages:** accepted Studio PR run `32493595981` passed root `build` and isolated `studio`; Pages/deployment was intentionally skipped because Studio is a local authoring service. Re-check current `main`, PR head, and Actions before doing new work.
- **Primary receiving role:** Coordinator / Authoring-tool Engineer
- **Secondary roles, activated by triggers:** Technical Artist, QA, Game Design, Level Generation/Runtime Integration, Security
- **Next milestone:** Checkpoint 2 — Source, Atlas Cutter, and Asset Library vertical slice

## 1. Start here: do not trust this handoff over current contracts

You are continuing a local-first, agent-first visual authoring tool that lives inside Numberdroid but is intentionally encapsulated for later extraction. Current binding repository instructions and code outrank this historical handoff. Do not merge PR #135, publish assets, or start a broader checkpoint because this document exists.

Before significant work:

1. verify current `main` HEAD and relevant Actions status;
2. verify the current head, state, and diff of PR #135;
3. confirm whether Checkpoint 2 work should continue on the existing draft branch or a new branch/PR;
4. report any conflict between this handoff, current contracts, and implementation before changing code.

The user explicitly accepted Checkpoint 1B with “ok, pass.” That is product/checkpoint acceptance. It is **not** merge, release, deployment, binary publication, or Checkpoint 2 implementation authorization by itself.

## 2. Mandatory reading order

Read every file in this section completely, in order. Do not jump directly to this handoff or to the old floor-treatment handoff.

### A. Repository bootstrap

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`
6. `docs/agents/HANDOFF_PROTOCOL.md`

There is no nested `tools/numberdroid-studio/AGENTS.md` at this handoff. The root `AGENTS.md` governs the entire Studio subtree.

### B. Current Studio contracts

7. `tools/numberdroid-studio/README.md` — supported launch/admin path and present product boundary.
8. `tools/numberdroid-studio/docs/REQUIREMENTS.md` — binding V1 requirements, exclusions, acceptance state, and known audit gap.
9. `tools/numberdroid-studio/docs/ARCHITECTURE.md` — inward dependencies, actual versus target topology, identities, persistence, authority, and extraction boundary.
10. `tools/numberdroid-studio/docs/MCP_CONTRACT.md` — exact advertised Checkpoint 1 surface versus planned MCP surface.
11. `tools/numberdroid-studio/docs/ROADMAP.md` — long verification loop, Checkpoint 2 gates, later checkpoint boundaries.
12. `tools/numberdroid-studio/docs/CHECKPOINT_1A_BASELINE.md` — permanent protected visual/behavior fixture.
13. `tools/numberdroid-studio/docs/CHECKPOINT_1B_STATUS.md` — accepted implementation/evidence identity and explicit non-features.
14. This handoff — only after the current contracts above.

### C. Accepted implementation and test boundary

Read:

- `tools/numberdroid-studio/package.json`
- `.github/workflows/build.yml`
- `tools/numberdroid-studio/packages/domain/src/command-catalog.js`
- `tools/numberdroid-studio/packages/domain/src/validation.js`
- `tools/numberdroid-studio/packages/application/src/project-store.js`
- `tools/numberdroid-studio/packages/application/src/studio-service.js`
- `tools/numberdroid-studio/packages/persistence/src/index.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-workspace.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-project-store.js`
- `tools/numberdroid-studio/packages/persistence/src/artifacts/content-addressed-artifact-store.js`
- `tools/numberdroid-studio/apps/studio-server/src/server.js`
- `tools/numberdroid-studio/apps/studio-server/src/http-projections.js`
- `tools/numberdroid-studio/apps/studio-server/src/human-agent-access.js`
- `tools/numberdroid-studio/apps/studio-server/public/index.html`
- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/packages/mcp-server/src/index.js`
- `tools/numberdroid-studio/packages/mcp-server/src/official-server.js`
- `tools/numberdroid-studio/apps/studio-mcp/src/local-studio-gateway.js`
- `tools/numberdroid-studio/apps/studio-mcp/src/main.js`

Read the regression map before changing behavior:

- `tools/numberdroid-studio/tests/studio-service.node-test.js`
- `tools/numberdroid-studio/tests/sqlite-persistence.node-test.js`
- `tools/numberdroid-studio/tests/artifact-store.node-test.js`
- `tools/numberdroid-studio/tests/http-server.node-test.js`
- `tools/numberdroid-studio/tests/official-mcp.node-test.js`
- `tools/numberdroid-studio/tests/package-boundaries.node-test.js`
- `tools/numberdroid-studio/fixtures/checkpoint-1a/README.md`
- `tools/numberdroid-studio/fixtures/checkpoint-1a/acceptance-manifest.json`

Run the baseline from `tools/numberdroid-studio/`:

```bash
npm ci
npm test
npm run build
npm run evidence:verify
```

Use Node 22 or newer. In a full Git checkout/CI also run `NUMBERDROID_EVIDENCE_REQUIRE_PRODUCTION_ADAPTER=1 npm run evidence:verify`. An exported workspace legitimately reports `EXPORTED_WORKSPACE_NOT_GIT_VERIFIED`; record that limitation instead of weakening the strict CI gate.

## 3. State ledger

### Accepted and frozen

- Checkpoint 1A visual shell and six-step behavior fixture at commit `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`.
- Checkpoint 1B implementation at commit `41fad464cd2f904666f7dfecc8437f2286c3254c`.
- Navigation and information hierarchy: Overview, Sources, Asset library, Rooms, Levels, Activity; persistent activity context and visible revision/authority state.
- SQLite authoritative local ledger in WAL mode with migrations, optimistic compare-and-swap, transactional revisions/events/projections/idempotency/grant usage, integrity, backup/restore, and protected JSON migration.
- SHA-256 content-addressed artifact store with verified PNG/WebP ingestion, project-aware delivery, deduplication, integrity checks, and backup pairing.
- Official MCP TypeScript SDK v2 at pinned version `2.0.0`, strict modern stdio protocol revision `2026-07-28`.
- Private loopback human-approved MCP HostBinding flow; raw token never enters browser-visible surfaces or SQLite plaintext.
- Header **Agent access** pull-down. Implemented postures are `Off`, `Read only`, and semantic `Execute scoped task`, displayed compactly as `Scoped run`.
- `Propose in draft` and `Custom…` are visible but fail closed.
- Effective-policy details use the accepted anchored, viewport-bounded popover. Grant posture and HostBinding state are shown separately.
- Every Asset Library card has a square visual preview or a deterministic accessible fallback.
- `finalize`, `export`, and `publish` remain separate; no Header posture implies publish.

Accepted evidence:

- CI run `32493595981`;
- 65/65 tests;
- 26 Chrome screenshots at `1440×900` and `1060×900`;
- artifact `numberdroid-studio-checkpoint-1b-visual`, ID `9450775977`, digest `sha256:7fde350eb04be8c3bcc48098ac597d72ad8cf08dee1d652c1e0609755e0e997e`;
- evidence runtime Chrome `151.0.7922.137`, Node `22.22.0`;
- protected source-manifest hash `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- user local run used production `better-sqlite3`, reproduced revision 7 / two assets, and passed browser review on port 4318 after an old process occupied 4317.

Actions artifact retention is temporary (recorded through 2026-09-04). No screenshot bytes were committed as permanent goldens. The protected fixture, reproducible capture workflow, artifact digest/manifest metadata, viewport record, user decision, and exact run/commit identities are durable; regenerate visual evidence after expiry unless a later explicitly authorized binary-evidence task publishes permanent goldens.

### Implemented but deliberately small

The accepted official MCP server advertises exactly:

- `studio_command_catalog_list`
- `studio_project_read`
- `studio_project_status_set`
- `studio_source_register`
- `studio_asset_define`
- resource `studio://projects/{projectId}`

Its mutation input is:

```json
{
  "schemaVersion": 1,
  "commandId": "cmd_...",
  "idempotencyKey": "logical-operation-key",
  "projectId": "project_...",
  "baseRevision": 4,
  "expectedVersion": 4,
  "dryRun": false,
  "payload": {}
}
```

Revisions are integers. `branchId`, actor, task, grant, and binding are trusted execution context and are forbidden in tool input. Committed results use `{schemaVersion, projectId, revision, value, event, replayed}`. Do not implement against the richer future result examples without versioning the contract and tests.

`studio_project_create` is filtered from the agent catalog. Human grant issue/revoke operations are also owner-only. The many source/atlas/asset/room/job/batch/export URI and tool names in `MCP_CONTRACT.md` are planned surface, not current discovery results.

### Known gap that must remain visible

Accepted commands are durable Activity entries. Denied and failed calls are fail-closed and immediately return a redacted structured result, but Checkpoint 1 does **not** append them to the durable Activity ledger. Full `AGT-008` coverage remains open. Do not say “every denied attempt is durably audited” until code, migrations/projections, privacy rules, UI, MCP tests, and recovery tests prove it.

The package boundary is proven by tests, but `packages/numberdroid-adapter` and its contract/golden fixtures do not exist yet. They belong to Checkpoint 5. Do not claim Numberdroid materialization or publication.

### Planned and not implemented

- user-facing source import/review/approval workflow;
- provider-backed generation, credentials, egress, and cost enforcement;
- atlas grid proposal, manual/variable rectangles, cut/re-cut, derived slice previews, stable remapping;
- bulk asset naming and semantic metadata authoring;
- durable image-processing jobs, batch execution, progress/resource subscriptions;
- portable project-bundle round trip;
- isolated task branches, proposal comparison, merge/review dispositions, Custom editor;
- room/hallway canvas, set dressing, finalization, and level composition;
- Numberdroid adapter/materialization/publication;
- animated tiles/props (V2);
- NPC/enemy design, animation, encounter placement, or route authoring (separate products).

### Open decisions and owner

| Decision | Owner | Required before |
| --- | --- | --- |
| First realistic Checkpoint 2 atlas fixture; Family Hygiene is recommended but not assumed | Klaus / user | freezing the 2A acceptance fixture and 2B cutter evidence |
| Whether 2A includes one provider-backed generation implementation or only the provider port/imported generation record | Klaus / user, informed by the planning agent’s egress/cost proposal | provider dependency, credential, or network work |
| Exact placement of durable denied/failed Activity audit work (`AGT-008`) in 2A versus the earliest later agent-observability gate | Coordinator, proposed explicitly to Klaus | claiming complete activity audit or expanding MCP work |
| Branch/PR strategy after Checkpoint 1 acceptance | Klaus / user | starting implementation commits for Checkpoint 2 |

The 1B Header/popup/preview visual questions are closed. They are not open decisions for the receiving agent.

## 4. Checkpoint 2 scope and recommended internal gates

Checkpoint 2 outcome: one approved atlas becomes reproducible, visually searchable semantic assets without repository editing. Do not pull room placement or Level Compiler integration into this milestone.

### 2A — Source intake and review

Implement local file intake into CAS, complete provenance/lineage, thumbnail/preview, and explicit review lifecycle. Add only the durable job seam actually needed for image work. Keep provider generation behind a port until the user chooses provider, allowed egress, credential storage, cost budget, and reproduction expectations.

Exit evidence: the user can import the chosen approved atlas, inspect a real preview and provenance, approve/reject it explicitly, restart, and see the identical source/revision state. An agent with the right HostBinding can perform the same semantic operation without receiving local paths or credentials.

### 2B — Visual atlas cutter

Implement source zoom, checker/grid overlay, regular-grid proposal, manual and variable integer rectangles, include/exclude preview, deterministic slice artifacts, and explicit stable remapping when a recut replaces prior imagery. Pixel analysis may suggest rectangles but never makes semantic or topology decisions.

Exit evidence: the user visually adjusts cuts, sees exact rectangle coordinates and resulting tile previews, commits them once, retries idempotently, and verifies deterministic artifacts after restart. Re-cutting cannot silently retarget an existing Asset identity.

### 2C — Asset Library semantics

Create stable `surface`, `prop`, and `item` identities from slices. Add visual bulk naming/metadata preview, explicit placement/connectivity/collision/footprint properties, validation, bounded MCP batch equivalence, and portable project-bundle round trip.

Exit evidence: user and agent can inspect every available asset visually, propose and review a bounded family update, reject one proposal without partial mutation, and export/import the slice with matching hashes and identities.

Before committing the 2A plan, ask the user which approved atlas is the first realistic fixture. The approved Family Hygiene floor atlas is an obvious candidate, but do not silently choose it.

## 5. Required working loop

For each gate use the same loop:

1. planning agent produces scope, schemas/migrations, UX flow, threat model, tests, and user evidence;
2. an independent adversarial agent reviews permissions, concurrency, data loss, accessibility, integration boundaries, and scope creep;
3. implementation lands code, tests, fixtures, migrations, and documentation together;
4. a separate verifier runs automated and visual checks without relying on the implementer’s narrative;
5. the coordinating agent reviews the complete diff, reruns critical checks, and reconciles docs with actual discovery/runtime behavior;
6. user receives exact launch steps, a short scenario, expected results, known limits, and the decisions that need approval;
7. only explicit user acceptance closes the gate.

Use sub-agents for bounded parallel planning/review/verification. Do not let several agents edit the same files concurrently without an explicit partition. Keep PRs draft until the user explicitly authorizes readiness/merge.

## 6. Triggered reading and reference map

These references are **not** universal reading. Read them completely when the matching trigger fires.

### Trigger: planning or implementing thumbnailing, atlas extraction, slicing, packing, resampling, seams, alpha, or image validation

This trigger is mandatory before freezing 2A image-processing work and before any 2B cutter implementation. It activates the **Technical Artist / Art Tools** route even though Studio remains an encapsulated application. Read the complete Artist bundle:

- `docs/art/README.md`
- `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- the relevant art-direction document under `docs/art/direction/`
- the relevant category/world contract under `docs/art/`
- `docs/art-production-methods/README.md`
- `docs/art-production-methods/METHOD_SELECTION_GATE.md`
- selected method README(s), if a production method is involved
- the consuming `art-source/recipes/.../recipe.md`
- the actual runtime/map consumer for the chosen fixture.

Then read the mandatory Technical Artist bundle:

- `docs/art-production-toolkit/README.md`
- `docs/art-production-toolkit/CAPABILITY_INDEX.md`
- the relevant tool document(s) under `docs/art-production-toolkit/tools/`, selected through the capability index
- the corresponding current implementation under `scripts/art/toolkit/`
- relevant root/build/package scripts that invoke or validate that capability.

Classify each operation before adding it: reusable deterministic tool, production method with its own authority model, or asset-specific recipe step. Do not duplicate an existing proven toolkit capability inside Studio. A documented `PLANNED` capability is not implemented until code, Numberdroid production/regression evidence, and limitations exist. For semantic floor tiles, also read `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md` before generation or slicing.

### Trigger: SQLite schema, CAS references, migration, backup, or restore changes

Read:

- `tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/*.sql`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/migration-runner.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-artifact-metadata-store.js`
- `tools/numberdroid-studio/packages/persistence/src/integrity/workspace-integrity.js`
- `tools/numberdroid-studio/packages/persistence/src/backup/workspace-backup.js`
- `tools/numberdroid-studio/tests/json-sqlite-migration.node-test.js`
- `tools/numberdroid-studio/tests/workspace-backup.node-test.js`
- `tools/numberdroid-studio/tests/admin-cli.node-test.js`
- SQLite WAL: `https://www.sqlite.org/wal.html`
- SQLite Online Backup API: `https://www.sqlite.org/backup.html`

Preserve transactional events/revisions/idempotency/grant usage, CAS integrity, copy-and-verify migration, and paired database/blob recovery. Never copy only a live SQLite main file.

### Trigger: adding/changing MCP tools, resources, jobs, progress, or cancellation

Read the accepted MCP implementation/tests listed above plus:

- MCP protocol versions: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md`
- MCP 2026-07-28 migration/support: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md`
- MCP logging/progress/cancellation: `https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/servers/logging-progress-cancellation.md`

The server/client packages are pinned at `2.0.0`. Do not casually change the SDK or protocol revision. Update schemas, runtime validation, discovery tests, authorization tests, UI equivalence, and contract documentation together. Never advertise an unimplemented tool/resource.

### Trigger: approved Family Hygiene floor atlas becomes the real fixture

Read:

- `docs/art/README.md`
- `docs/art/production/ARTIST_AGENT_WORKFLOW.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
- `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`
- `docs/art/transfer-hall/TRANSFER_HALL_LAYER_RULES.md`
- `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- `art-source/approved/area-01-transfer-ship/floor-treatment/README.md`

Approved source:

- `art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png`

Historical context only when old-pipeline provenance or decisions matter, and only after current contracts:

- `docs/history/handoffs/HANDOFF_2026-08-20_FLOOR_TREATMENT.md`

Do not treat that older handoff as current authority.

### Trigger: actually generating or editing a new image

This fires immediately before the first real generation/edit call, not while merely designing a provider interface. Follow the Artist route and read:

- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md`
- `docs/art/production/IMAGE_GENERATION_TURN_CONTRACT.md`
- `docs/art/production/ART_ASSET_VALIDATION_RULES.md`
- `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`
- `docs/art-production-methods/README.md`
- `docs/art-production-methods/METHOD_SELECTION_GATE.md`
- the selected method document;
- the relevant asset recipe.

Preserve provider/model/prompt/seed/options/reference lineage, explicit egress, cost evidence, credential isolation, and the approval boundary.

### Trigger: Studio metadata maps into Numberdroid runtime/compiler semantics

This fires when adding `packages/numberdroid-adapter`, export fixtures, or interpreting connector/collision/footprint metadata as actual LevelSpec/Tiled behavior. Read:

- `docs/game-design/LEVEL_DESIGN_RULES.md`
- `docs/level-generation/README.md`
- `docs/level-generation/LEVEL_SPEC.md`
- `docs/architecture/TILED_MAPS.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
- `src/levelgen/familyFloorPresentation.ts`
- `src/levelgen/familyFloorPresentation.test.ts`
- `src/levelgen/mainHallFloorTileMetadata.ts`
- `src/levelgen/mainHallFloorPresentation.ts`
- `src/levelgen/mainHallFloorPresentation.test.ts`
- `src/levelgen/primusFloorTileMetadata.ts`
- `src/levelgen/primusFloorPresentation.ts`
- `src/levelgen/primusFloorPresentation.test.ts`
- `src/levelgen/transferFloorPresentation.ts`
- `src/levelgen/transferFloorPresentation.test.ts`

Studio-neutral core packages must not import those modules. Only the future Numberdroid adapter may know repository-specific contracts.

### Trigger: room/hallway placement, canvas, set dressing, or finalization appears

Stop scope expansion and re-plan it as Checkpoint 3. Read the Level Design/Level Generation bundle above before specifying its semantic mapping. Checkpoint 2 may author asset metadata that later room placement consumes; it must not implement rooms incidentally.

### Trigger: publishing any PNG/WebP/JPG/ZIP/audio or other binary to GitHub

Before the repository write, read:

- `docs/agents/BINARY_ASSET_TRANSPORT.md`

Then run:

```bash
npm run repo:binary-preflight -- <file>
```

This trigger does not fire merely because Studio imports a local file into its local CAS. It fires when publishing a binary into GitHub. Never transport binary bytes as inline Base64 in GitHub calls.

### Trigger: adding a dependency/package or changing extraction boundaries

Re-read:

- `REPOSITORY_STRUCTURE.md`
- `tools/numberdroid-studio/docs/ARCHITECTURE.md`
- `tools/numberdroid-studio/tests/package-boundaries.node-test.js`
- `tools/numberdroid-studio/package.json`

Core remains repository-independent. A target folder named in Architecture is not implemented until code/tests exist.

### Trigger: story or gameplay meaning enters an asset

For narrative-specific imagery or campaign sequencing, read:

- `docs/story/STORY_WORLD_FOUNDATION.md`
- `docs/story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md` when sequencing matters.

For gameplay affordance, traversal, collision, interactable/resource semantics, or faction meaning, read:

- `docs/game-design/GAME_DESIGN.md`
- relevant specialized design documents;
- `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`.

Generic catalog/UI work does not trigger these domains.

### Trigger: tile/prop animation, NPCs, enemies, encounters, or routes

- Tile/prop animation authoring is V2. Preserve the reserved `AnimationClip` identity in V1 but do not build its editor in Checkpoint 2.
- NPC/enemy design, NPC/enemy animation, encounter placement, and route drawing are outside this product’s current V1 scope. Establish a separate product/role boundary before proceeding.

## 7. Operational cautions

- Local default URL is `http://127.0.0.1:4317`.
- If `EADDRINUSE` occurs, an older process may still be serving stale UI. Stop it or use a new port, for example `NUMBERDROID_STUDIO_PORT=4318`; do not diagnose this first as browser caching.
- Set `NUMBERDROID_STUDIO_DATA` to an explicit test workspace. Do not point experimental code at an accepted user workspace.
- Keep JSON and SQLite from acting as concurrent authoritative writers for the same logical project.
- Backup/restore and migration targets must be new destinations. Preserve failed destinations and reports for diagnosis.
- An Asset crop must not show the entire atlas as if it were the cropped tile; show `PROCESSING` until a real derived preview exists.
- Preview failure must never erase semantic asset identity or controls.
- UI, MCP, CLI, and tests must use one semantic command core. No direct SQLite writes from UI/MCP.
- GitHub is an explicit export/publication boundary, not the interactive database.
- PR #135 is draft and unmerged at handoff. Do not merge without explicit user authorization.

## 8. First response expected from the receiving agent

After the mandatory reading and state verification, report:

1. current `main`, branch/PR, and Actions identities;
2. the accepted Checkpoint 1 invariants in your own words;
3. every code/document discrepancy you found;
4. a bounded 2A plan with data model/migrations, UI flow, MCP changes, tests, visual evidence, risks, and rollback;
5. the explicit user decision needed for the first real atlas fixture and, separately, whether provider-backed generation is in 2A or only its adapter seam.

Do not begin 2B, rooms, export, animation, or repository publication before their prerequisites and checkpoint authority exist.
