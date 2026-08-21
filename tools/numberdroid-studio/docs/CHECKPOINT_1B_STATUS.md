# Checkpoint 1B acceptance record — 2026-08-21

Status: **USER_ACCEPTED**. Checkpoint 1A and 1B together complete the Numberdroid Studio foundation checkpoint. This record freezes the accepted 1B behavior and evidence; it does not claim that Checkpoint 2 asset authoring exists.

## Accepted identities and evidence

- Protected Checkpoint 1A baseline commit: `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`.
- User-accepted Checkpoint 1B implementation commit: `41fad464cd2f904666f7dfecc8437f2286c3254c`.
- Development branch: `agent/numberdroid-studio-foundation`.
- Draft integration PR: `#135` — `https://github.com/KlausUllrich/numberdroid/pull/135`.
- Final accepted CI run: `32493595981` — `https://github.com/KlausUllrich/numberdroid/actions/runs/32493595981`.
- CI result: root `build` and isolated `studio` jobs passed; deployment was intentionally skipped because Studio is a local authoring service rather than a Pages application.
- Studio test result: `65/65` passed with the pinned production dependencies.
- Browser evidence: 26 real Chrome screenshots at `1440×900` and the supported minimum `1060×900`, covering every protected 1A workspace, every 1B workspace, and the open Header policy popover.
- Visual artifact: `numberdroid-studio-checkpoint-1b-visual`, Actions artifact ID `9450775977`, digest `sha256:7fde350eb04be8c3bcc48098ac597d72ad8cf08dee1d652c1e0609755e0e997e`.
- Evidence runtime: Chrome `151.0.7922.137`, Node `22.22.0`, fixed UTC fixtures.
- User local verification: production `better-sqlite3` adapter, protected evidence `VERIFIED`, visual fixture revision `7` with two assets, and interactive browser review passed on 2026-08-21.

The implementation commit above is the visual acceptance identity. Later documentation-only commits do not redefine the accepted pixels or authority behavior. Any implementation change affecting the accepted surfaces requires new evidence and, when user-visible, a new user checkpoint.

## Accepted foundation behavior

### Durable local workspace

- SQLite is the authoritative local ledger, runs in WAL mode, and is owned by one writer service.
- Versioned migrations, optimistic compare-and-swap, immutable revisions/activity, idempotency, restart behavior, integrity checks, backup/restore, and fault rollback are covered by tests.
- The dependency-free JSON store remains only as protected Checkpoint 1A migration/regression input. It is not an accepted interactive persistence implementation for Checkpoint 2.
- JSON-to-SQLite migration is copy-and-verify into a new destination. It is resumable only for the same source manifest, destination identity, and migration ID; it never silently repurposes foreign or already active data.

### Artifact storage and previews

- Binary artifacts use the SHA-256 content-addressed store; SQLite references verified artifact metadata and project ownership.
- PNG and WebP ingestion validate complete container/image structure, limits, digest, dimensions, and safe publication before a resource becomes live.
- Every Asset Library card has a consistent square preview region.
- A `READY` visual uses a same-origin authorized resource URI and preserves aspect ratio with transparent-area visibility.
- `PROCESSING`, missing, unsupported, failed, or intentionally nonvisual states use deterministic accessible fallbacks; a blank card is not accepted.
- A crop cannot display its full source atlas as if it were already the cropped tile. Until a real derived preview exists, the crop remains visibly `PROCESSING`.

### Human-controlled agent access

- The Header control is a service-backed pull-down, not a client-side permission flag.
- Implemented semantic postures are `Off`, `Read only`, and `Execute scoped task`. The accepted compact visible label for the third posture is **`Scoped run`**.
- The adjacent status/detail control separately shows effective policy and host state, for example `SCOPED · NO HOST`; an active policy never implies that an MCP host is connected.
- The accepted detail treatment is a viewport-bounded anchored popover. It exposes task, branch, capabilities/scopes, object scope, expiry, budget, running jobs, warnings, pending hosts, and redacted authorized bindings.
- `Propose in draft` and `Custom…` remain visible but fail closed. They must not grant authority until isolated branch heads and the detailed editor respectively exist.
- `finalize`, `export`, and `publish` remain separate capabilities. No Header posture grants publish authority.
- Expired, revoked, denied, unavailable, unbound, stale-token, over-budget, and out-of-scope operations fail closed without mutation and return redacted structured results. Accepted commands are durable Activity entries. Durable Activity entries for denied/failed calls are not yet implemented and remain a tracked gap under `AGT-008`.

### Official MCP boundary

- The local agent transport uses the official MCP TypeScript SDK v2 in strict modern mode for protocol revision `2026-07-28` over stdio.
- Protocol discovery is not authorization. The stdio process must pair through the private loopback service channel and receive an immutable human-approved HostBinding before mutation.
- Browser configuration is secret-free. Raw binding credentials never enter browser responses, DOM, URLs, storage, clipboard configuration, logs, broad resources, or SQLite plaintext.
- The service stores only a credential digest, resolves the binding for every call, reloads the immutable grant, and injects trusted actor/task/project/branch/grant/correlation context after tool-input validation.
- Tool schemas cannot carry authority-selection fields. The agent cannot mint, widen, renew, select, or reinterpret its own grant.
- MCP stdout is protocol-only. Malformed frames, application failures, cancellation races, and service outages use stable redacted diagnostics and structured results.

The exact advertised Checkpoint 1 surface is intentionally small:

- tools: `studio_command_catalog_list`, `studio_project_read`, `studio_project_status_set`, `studio_source_register`, and `studio_asset_define`;
- resource: `studio://projects/{projectId}`;
- command input: integer `baseRevision`/`expectedVersion`, top-level `commandId` and `idempotencyKey`, and semantic `payload`; actor/task/branch/grant/binding fields are forbidden;
- result: `{schemaVersion, projectId, revision, value, event, replayed}`, with the documented dry-run proposal extension.

Other MCP names and URI patterns in `MCP_CONTRACT.md` are future checkpoint contracts and are not advertised by the accepted server.

## Accepted visual decisions

The following 1B questions are closed unless a concrete defect or a future checkpoint requires a deliberate redesign:

1. The permission model is a persistent Header pull-down.
2. The compact scoped-execution label is `Scoped run`; the detail projection continues to name the semantic mode `execute_scoped` / `Execute scoped task`.
3. Effective-policy details use the contained anchored popover, not a permanent side panel.
4. Host-binding state is displayed separately from grant posture.
5. Every Asset Library card always contains a preview or explicit fallback.
6. The protected 1A navigation, persistent activity context, dark visual language, and revision/authority visibility remain intact.

## Preserved baseline and retention

The protected fixture under `fixtures/checkpoint-1a/`, source manifest hash `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`, expected revision/activity projections, capture workflow, and visual run/digest/viewport record remain durable regression evidence. The 26 screenshot bytes are held only by the retention-limited Actions artifact (recorded retention through 2026-09-04); no permanent screenshot goldens were committed. Publishing them later is a separate binary-evidence task and must follow repository binary transport rules. This retention gap does not undo the explicit user acceptance, but future visual comparison must regenerate the evidence unless permanent goldens are deliberately published.

For a durable workspace:

- never copy only a live SQLite main file while WAL writes may exist;
- stop the service before administration operations;
- use the documented integrity/backup/verify/restore flow;
- use a new destination for migration or restore;
- preserve a failed/new destination and recovery evidence rather than hiding post-cutover writes;
- never run JSON and SQLite as simultaneous authoritative writers.

## Local verification recipe and known pitfall

From `tools/numberdroid-studio/`, with Node 22 or newer:

```bash
npm ci
npm test
npm run evidence:verify
npm run evidence:visual-prepare -- .numberdroid-studio-visual
NUMBERDROID_STUDIO_DATA=.numberdroid-studio-visual npm run dev
```

Expected evidence includes `status: "VERIFIED"`, `databaseAdapter: "better-sqlite3"`, and the visual fixture at revision `7` with two assets. Local evidence deliberately reports `EXPORTED_WORKSPACE_NOT_GIT_VERIFIED`; strict commit-provenance verification is a CI-only gate.

If `npm run dev` reports `EADDRINUSE`, an older Studio process is still serving the port. Stop that process or launch the accepted candidate separately, for example:

```bash
NUMBERDROID_STUDIO_PORT=4318 NUMBERDROID_STUDIO_DATA=.numberdroid-studio-visual npm run dev
```

Do not mistake the older process on port `4317` for a browser-cache failure.

## Explicitly not implemented by Checkpoint 1

- provider-backed image generation and provider credential handling;
- source import/review/approval UI beyond the foundation seam;
- visual atlas grid proposal, manual rectangles, cutting, recutting, and slice remapping;
- bulk naming and semantic metadata authoring;
- portable project-bundle round trip;
- durable Activity-ledger records for denied/failed tool calls (the immediate structured denial remains visible and fail-closed);
- room/hallway canvas, set dressing, room finalization, and level composition;
- task branches, proposal comparison/merge, and the detailed Custom grant editor;
- Numberdroid materialization or repository publication;
- tile/prop animation authoring, which remains V2;
- NPC/enemy design, NPC/enemy animation, encounters, and route authoring, which remain separate products.

## Next milestone

Checkpoint 2 is now unblocked but not started. Its vertical slice is deliberately staged internally:

1. **2A — Source intake and review:** local upload into CAS, complete provenance including prompt/seed/model/lineage where applicable, visual preview, and explicit source lifecycle. Provider generation may remain an adapter seam until a provider/budget policy is chosen.
2. **2B — Atlas cutter:** source zoom/grid overlay, regular-grid proposal, manual and variable rectangles, deterministic derived slices, preview, inclusion/exclusion, and stable explicit remapping on recut.
3. **2C — Asset library semantics:** create `surface`, `prop`, and `item` assets from slices; bulk naming/metadata preview; placement/connectivity/collision validation; equivalent bounded MCP batch flow; and portable bundle round trip.

Checkpoint 2 requires the same plan → adversarial review → implementation → independent verification → root verification → user checkpoint loop. It must not bypass the accepted authority boundary or mutate the Numberdroid repository as an interactive database.
