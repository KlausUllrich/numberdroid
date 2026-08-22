# Handoff — Numberdroid Studio Checkpoint 2C Authorized Bootstrap

- **Date:** 2026-08-22
- **Repository:** `KlausUllrich/numberdroid`
- **Status:** Checkpoint 2C planning and implementation explicitly user-authorized on 2026-08-22; not yet implemented, verified, or user-accepted
- **Baseline `main` head at creation:** `1e1f0ce09a7c996f24cf6b216e400d57cb6dc666`; receiver MUST re-verify current `main`
- **Development branch:** `agent/numberdroid-studio-foundation`
- **Branch head before this authorization handoff:** `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`; receiver MUST re-read the remote head before any update
- **Accepted 2B product head:** `309c24961f89389047db837471b2e434dd13e149`
- **Accepted 2B record:** `52eb9d32cab4fcbf20559455bc141215e7fb8998`
- **2B final evidence-only commits:** `f116f25aed2f0a9d935de9061cf6492d3a56bef4`, `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d`
- **CI state before this handoff:** closure-head run `32573543172` passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`; Studio job `97032448115` and root job `97032448320` succeeded; Pages was intentionally skipped
- **Draft PR:** `#135` — `https://github.com/KlausUllrich/numberdroid/pull/135`; keep open, draft, and unmerged
- **Primary receiving role:** Coordinator / Authoring-tool Architect-Engineer
- **Secondary / trigger roles:** Persistence/Security, MCP/QA, Technical Artist for surface metadata, independent adversarial verifier
- **Next milestone / task:** implement and internally verify Checkpoint 2C asset-library semantics, bounded agent proposal flow, and portable Studio project bundle; return to the user only for the major 2C acceptance gate or a genuine authority/blocking conflict

This handoff is the authorization boundary for Checkpoint 2C. Current code and current binding contracts outrank it. It authorizes the planning, implementation, tests, evidence, documentation, and offline project-scoped Studio bundle export/import required for 2C only. It does **not** authorize merge, release, provider integration, image generation, rooms, Numberdroid runtime integration or export, runtime/repository materialization, repository publication, or any claim that 2C is accepted.

## 1. User collaboration mode and authority

The user explicitly requested a long agent loop. The receiving coordinator should use fresh bounded sub-agents for reconnaissance, implementation, adversarial review, independent verification, and documentation. Keep routine design questions, code review, test repair, and evidence inspection inside that loop. Do not ask the user to test incremental slices.

Return to the user only when one of these is true:

1. the complete 2C acceptance candidate is green, independently verified, documented, and ready for one guided major-checkpoint walkthrough;
2. a new decision would materially expand authority or scope beyond this handoff;
3. a destructive or permission-sensitive action needs explicit approval;
4. the team finds an irreconcilable product decision that changes the user's acceptance scenario rather than an internal implementation choice.

Passing tests, green CI, inspected evidence, user acceptance, PR readiness, merge, and release remain separate states. Do not conflate them.

## 2. Required reading and role routing

Read completely in this order before editing:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`
6. `docs/agents/HANDOFF_PROTOCOL.md`
7. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
8. `tools/numberdroid-studio/README.md`
9. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
10. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
11. `tools/numberdroid-studio/docs/MCP_CONTRACT.md`
12. `tools/numberdroid-studio/docs/ROADMAP.md`
13. `tools/numberdroid-studio/docs/CHECKPOINT_2A_STATUS.md`
14. `tools/numberdroid-studio/docs/CHECKPOINT_2B_STATUS.md`
15. `docs/history/handoffs/HANDOFF_2026-08-22_NUMBERDROID_STUDIO_CHECKPOINT_2B.md`
16. `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
17. `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
18. `art-source/approved/area-01-transfer-ship/floor-treatment/README.md`
19. this handoff

Then inspect the implementation/test map in section 10. The full Story, room/level, provider, generation, and Numberdroid export corpora are not initially required. Trigger the Technical Artist / Numberdroid adapter route if a proposed generic surface contract could change runtime topology semantics. Trigger Security for authority, redaction, bundle sanitation, or import boundaries. Trigger repository binary transport only if the task later receives separate binary-publication authority; 2C itself requires no repository binary write.

## 3. Accepted and frozen baseline

The receiver must preserve all accepted behavior from Checkpoints 1, 2A, and 2B, including:

- SQLite/CAS as the operational path and official MCP through private HostBinding resolution;
- accepted Asset-card READY preview and accessible kind-aware fallback behavior;
- atomic staged source intake, approval, provenance/lineage, and redacted final denied/failed agent-attempt audit;
- the provider-free boundary: no credentials, network egress, cost enforcement, or image generation;
- the source-resolution visual cutter, explicit rectangles, deterministic exact-PNG crops, durable jobs, atomic slice apply, explicit recut mapping, restart recovery, state-specific integrity, and snapshot-consistent backup;
- schema v8 migrations `0001`–`0008` and their fixed checksums; never rewrite them;
- the accepted 15-tool/two-resource-template MCP surface when the durable attempt/job stores are live;
- no `WAITING_FOR_USER` job state and no response command;
- passive refresh, focus, selection, local scroll, page scroll, single-poll ownership, stale-context containment, and captured-drag behavior repaired in 2B;
- the exact Family Hygiene fixture and four committed v1 slice heads.

Accepted 2B fixture identity:

- source: PNG, 2,720,519 bytes, 1254×1254;
- source SHA-256: `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`;
- approved path: `art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png`;
- rectangles: `(3,3,622,622)`, `(629,3,622,622)`, `(3,629,622,622)`, `(629,629,622,622)`;
- slice output digests: `ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2`, `3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e`, `9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526`, `a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318`.

The source is `SOURCE_APPROVED`; that does not mean its assets are `FINAL`, runtime-integrated, exported, materialized, published, or `LIVE_ACCEPTED`. Family Hygiene runtime materialization remains open.

## 4. Authorized 2C outcome

Checkpoint 2C must deliver one coherent asset-library vertical slice:

1. create stable `surface`, `prop`, and `item` asset identities from exact committed slice versions;
2. browse and filter the asset library visually, with useful previews and provenance;
3. preview bounded bulk naming and typed metadata changes before mutation;
4. validate placement, connectivity, navigation, and collision metadata deterministically;
5. let an agent submit a bounded, auditable batch proposal and let a human owner reject one item with a reason before atomically applying the accepted subset;
6. expose equivalent bounded agent operations only through the accepted HostBinding/grant/audit model;
7. preserve proposals, decisions, assets, findings, exact artifact lineage, Activity, and idempotency across restart;
8. export, verify, and import a sanitized portable **Studio project bundle** into a new empty destination and prove semantic/CAS equivalence;
9. present ordinal **Slice 1–64** as the primary human label while keeping the canonical slice ID secondary and copyable;
10. preserve every accepted 1A/1B/2A/2B regression.

Checkpoint 2C is not complete merely because legacy `asset.define` can add a source crop. It is complete only when slice-bound assets, typed metadata, durable review, validation, persistence/integrity, bounded MCP equivalence, bundle round trip, browser evidence, and documentation agree.

## 5. Explicit non-scope

Do not implement or imply:

- provider-backed generation, provider credentials, network egress, cost policy, or reproduction workflows;
- automatic pixel, grid, topology, connector, collision, navigation, or gameplay inference;
- WebP cutting, padding, resampling, atlas materialization, or new image generation;
- rooms, hallways, set dressing, level composition, enemies, NPCs, encounters, or routes;
- isolated general branch heads, general proposal comparison/merge, or relabeling `Propose in draft` as live; those remain Checkpoint 4 concerns;
- Numberdroid repository layout coupling inside Studio packages;
- Numberdroid export, build candidate, materialize, commit, publish, runtime integration, or release;
- merge or ready-for-review actions on PR #135.

Pixels are never topology authority. Metadata is an explicit author decision, a bounded agent proposal, or imported trusted semantics—not an inference from the image.

## 6. Actual implementation baseline and gaps

The receiving team must design from the current implementation, not only from planned documentation.

### Legacy asset behavior that must remain compatible

- `packages/domain/src/command-catalog.js` defines `asset.define` with `assetId`, `sourceId`, `name`, `kind`, source `region`, arbitrary `properties`, and `draft | in_review`.
- `packages/application/src/studio-service.js` reduces that command to one snapshot entry and checks only asset-ID uniqueness and source existence.
- legacy assets have no slice/version binding, independent asset version, typed metadata, durable proposal, findings, lifecycle, or CAS reference;
- assets persist inside immutable revision JSON and `projects.head_snapshot_json`; there are no asset tables;
- the protected demo and accepted MCP contract still use legacy `asset.define`.

Preserve the existing command and its protected behavior. Add the 2C semantic surface alongside it. Do not silently reinterpret old assets as validated V2 assets.

### Existing reusable substrate

- committed slice heads already contain exact slice/atlas/source identity, version, rectangle, digest, artifact URI, media/dimensions, pivot, revision, job, actor, and prior digest;
- application revision, Activity, command fingerprint, idempotent replay, project CAS, grant charging, and audit infrastructure are established;
- SQLite `appendRevision()` already owns the semantic transaction boundary;
- `artifact_references` already gives committed slices permanent ownership as `${sliceId}.v${version}`;
- content-addressed metadata, integrity, snapshot-consistent workspace backup, and strict artifact paths are reusable primitives;
- HTTP project projections, official MCP dynamic registration, private gateway, CSRF/origin/body validation, and browser evidence harnesses are existing seams.

### Missing capability

- typed asset definition and stable findings;
- asset heads/versions and exact immutable slice binding;
- durable cross-client proposal/decision flow;
- filterable asset projections and detail resource;
- atomic asset-version artifact references;
- asset integrity, migration, rollback/recovery, and tamper coverage;
- 2C HTTP and feature-gated MCP routes;
- project-specific portable bundle;
- 2C browser fixture, capture mode, assertions, and CI artifact.

## 7. Required domain and product invariants

### Stable asset imagery

A V2 asset version must copy and pin the exact committed imagery lineage needed to survive later recuts:

- stable `assetId` and independent display name;
- asset and metadata version coordinates;
- kind `surface | prop | item`;
- exact `sliceId`, `sliceVersion`, `atlasId`, `sourceId`, rectangle, digest, artifact URI, media type, dimensions, and pivot;
- actor, revision, and proposal/decision lineage.

Looking up only the current slice head is forbidden because it silently retargets an asset after recut. Replacing imagery must be an explicit versioned operation with expected asset and slice versions.

Multiple assets may reference the same committed slice version unless an adversarial contract review finds a binding reason to forbid it. Asset IDs and proposal item coordinates remain unique.

### Typed metadata

Use discriminated, bounded metadata rather than growing the legacy arbitrary `properties` bag. At minimum represent, when relevant to the kind:

- tags and variant/compatibility grouping;
- pixel dimensions, tile footprint / `spanTiles`, anchor, and pivot;
- attachment and cardinal rotation policy;
- placement flags and `wallSafe`;
- collision mode and bounded explicit collision bounds/parts;
- navigation effect and `runtimeEligible`;
- cardinal connectors, continuity profile, continuity/placement tags, and `selectionPriority`;
- visual weight;
- bounded namespaced adapter extensions.

For `surface`, the binding floor metadata contract is normative. Structural bands must be excluded before macro tiling, macro spans must divide the usable region exactly, and clipped partial macros are invalid. Add explicit tests for structural-band subtraction, span divisibility, and clipped partial-macro rejection. Do not import Numberdroid runtime modules into Studio; keep the domain generic and reserve bounded adapter extensions for later integration.

Unknown ordinary fields fail closed. Extensions must be namespaced and recursively bounded, and must reject secrets, tokens, machine paths, raw authority fields, and arbitrary URIs. Missing author decisions should produce stable findings rather than invented values.

### Findings and lifecycle

Findings must be deterministic and ordered, with stable identifiers and at least:

```text
findingId, severity, ruleId, targetKind, targetId, path,
explanation, remediation, validatorVersion
```

Use stable `studio.asset.*` rule IDs. Validate metadata bounds, exact-fit containment, cardinal connector uniqueness/profile rules, collision containment, kind-specific required fields, slice/source/atlas agreement, and finalization prerequisites.

Use an explicit lifecycle such as `DRAFT → METADATA_COMPLETE → VALIDATED → FINAL`. Persisting a draft with blocking findings may be valid; claiming `VALIDATED` or `FINAL` while blocking findings remain is not. Finalization is a separate human capability and must not imply Numberdroid export, runtime/repository materialization, publication, or runtime acceptance.

### Durable bounded proposal

General branch heads are out of scope, but the user acceptance flow requires an agent proposal to remain inspectable by a human client. Implement a project-scoped, durable, asset-specific batch proposal:

- bounded ordered items with exact expected project, proposal, asset, and slice versions;
- deterministic preview/diff/findings/fingerprint;
- immutable proposer actor/task/grant coordinates and redacted Activity;
- owner-only per-item accept/reject decision, with a required rejection reason;
- atomic application of the accepted subset in one later semantic revision or no application;
- rejected items remain inspectable and create no asset version;
- ordered idempotent replay and conflict detection;
- no partial semantic, finding, reference, budget, Activity, or idempotency commit on failure.

Do not expose owner decision or finalization through MCP. Existing `asset.write` authority must not silently gain 2C powers. Add a narrow 2C proposal scope/capability and preserve project object scope, expiry, revocation, task binding, durable attempt audit, and complete operation-count budget charging. A batch must not bypass `maxCommands` or artifact/job limits.

Batch count should be explicitly bounded; 64 is the preferred ceiling unless a smaller documented limit is chosen. Bound bytes, depth, strings, metadata entries, collision parts, connectors, and estimated cost as well.

## 8. Persistence, integrity, and portable bundle boundary

Add migration `0009_asset_library.sql`; register its fixed checksum and never alter `0001`–`0008`. The exact normalized table split is an implementation decision, but it must support immutable asset versions, durable proposal/decision records, findings, filterable heads, restart, deterministic rebuild, and fault-injected rollback.

Required persistence behavior:

- write asset versions, findings, proposal decisions, semantic revision, Activity, idempotency, head/projection, grant charge, and `artifact_references` in the same SQLite transaction where applicable;
- create permanent `owner_kind='asset_version'` references with an unambiguous `${assetId}.v${version}` owner ID;
- inside that transaction, join the exact committed slice version and LIVE artifact metadata; never trust caller-supplied digests, paths, artifact URIs, or authority fields;
- retain old version references for provenance;
- add fault points after each material asset/finding/reference/head stage;
- rebuild projections deterministically and preserve legacy assets without claiming they are V2-valid;
- extend integrity so asset heads, immutable versions, revisions, findings, exact slice owners, LIVE artifacts, and references prove one another;
- include assets in backup preconditions, recovery, and tamper tests.

Do not rename or repurpose `workspace-backup.js`. It is full-workspace disaster recovery and contains operational/authority state.

The portable 2C artifact is a distinct, project-scoped, offline **Studio project bundle**. The team must freeze its representation before implementation, with an adversarial Security/Persistence review. A bounded directory format is preferred because it avoids archive traversal and a new ZIP dependency. Whether the normalized semantic document uses canonical JSON plus CAS or a sanitized compacted project SQLite is an internal design choice, provided all of these invariants hold:

- export is snapshot-consistent and pins one semantic project revision;
- only the exact semantic CAS closure is included;
- manifest and every artifact are independently hashed and size/media/dimension bounded;
- sources, atlases/slices, legacy assets, V2 asset heads/versions/findings, terminal 2C proposals with every item/decision/rejection reason/finding, and redacted semantic Activity round-trip;
- grants are absent or imported inactive as `LEGACY_UNBOUND`; HostBindings, token digests, access operations, attempts, idempotency keys, staged intakes, temp job outputs, leases, machine paths, raw worker failures, and secrets do not survive;
- pending asset proposals and active/non-quiescent jobs are rejected;
- atlas heads that reference a terminal `APPLIED` preview job preserve a normalized integrity-compatible `appliedJobHistory`: the same job ID/type/state, immutable semantic input/fingerprint, processor, applied revision, output digests/metadata/rectangles, and event order; active authority, grant/HostBinding coordinates, leases, attempts, idempotency keys, and temporary references are stripped. Import reconstructs that terminal history under a reserved non-authorizing `bundle_import` provenance marker, preserves atlas/job links, and compares the documented canonical transformation rather than pretending the sanitized authority record is byte-identical;
- paths, symlinks, traversal, extra/missing files, unknown schema, unsupported counts/sizes, active authority, digest mismatch, and same-ID conflicts fail before project visibility;
- import targets a new empty destination only for 2C and publishes the project atomically after all JSON/database/blob checks pass;
- a failed import may leave only unreferenced staged CAS bytes, never a partially visible project.

This bundle is not a Numberdroid export candidate and must never be described as one.

## 9. UI, HTTP, MCP, and refresh requirements

### Human UI

The Asset Library must add, without weakening the accepted card/fallback behavior:

- slice-backed asset creation and bounded bulk proposal preview;
- ordinal-first slice selection (`Slice 1`, `Slice 2`, …), thumbnail, and secondary copyable canonical ID;
- name, kind, lifecycle, tags, placement/connectivity/collision summary, findings, and exact provenance;
- filters/search and a usable detail/review surface;
- per-item proposal diffs, rejection reason, accepted-subset apply, and clear validation state;
- READY previews built from the current project and pinned digest; never trust a stored cross-project HTTP path;
- keyboard-accessible copy/filter/reject/apply controls, labels, non-color-only errors, and responsive placement at 1060 px.

Polling must not replace a focused or dirty bulk editor, lose selection, jump local/page scroll, or let a stale response mutate a newly selected project. Preserve one poll owner and captured project/revision/proposal context. A necessary external revision must preserve a still-valid draft or present an explicit conflict; it must not silently discard local input.

### HTTP and MCP

Add exact-key, bounded, CSRF/origin-protected human routes for asset preview/proposal/decision/query/bundle operations as appropriate. Do not accept caller authority fields. Contain cross-project slice/asset/proposal access and late responses.

New MCP tools/resources must be feature-gated by a durable asset-store capability. Until schema v9, integrity, audit, and runtime registration are live, the accepted discovery remains exactly 15 tools and two templates. The final advertised list, runtime registration, schemas, gateway methods, documentation, and contract tests must match exactly.

Agent access may include bounded proposal/create/update/query operations through the new narrow scope. Owner decision/finalization, bundle import/export, raw binaries, machine paths, grant IDs, HostBinding tokens, secrets, stack traces, and worker errors remain absent. Add a project-scoped asset detail resource only with equivalent authorization and redaction tests.

## 10. Implementation and regression map

Inspect and update only as required:

- `tools/numberdroid-studio/packages/domain/src/command-catalog.js`
- `tools/numberdroid-studio/packages/domain/src/index.js`
- new focused asset-domain module, preferably `packages/domain/src/asset-definition.js`
- `tools/numberdroid-studio/packages/application/src/studio-service.js`
- `tools/numberdroid-studio/packages/application/src/ports/project-store.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/migration-runner.js`
- new `tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/0009_asset_library.sql`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-project-store.js`
- a focused asset query store only if needed; writes remain coupled to `appendRevision()`
- `tools/numberdroid-studio/packages/persistence/src/integrity/workspace-integrity.js`
- `tools/numberdroid-studio/packages/persistence/src/backup/workspace-backup.js` only for asset-aware preconditions/tests, not portable-bundle behavior
- new `tools/numberdroid-studio/packages/persistence/src/bundle/project-bundle.js`
- `tools/numberdroid-studio/packages/persistence/src/index.js`
- `tools/numberdroid-studio/apps/studio-admin/src/main.js`
- `tools/numberdroid-studio/apps/studio-server/src/http-projections.js`
- `tools/numberdroid-studio/apps/studio-server/src/server.js`
- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/packages/mcp-server/src/index.js`
- `tools/numberdroid-studio/packages/mcp-server/src/official-server.js`
- `tools/numberdroid-studio/apps/studio-mcp/src/local-studio-gateway.js`
- `.github/workflows/build.yml`
- new 2C fixture/evidence scripts and focused domain/integration/bundle/browser tests.

Primary regression suites include `studio-service.node-test.js`, `sqlite-persistence.node-test.js`, `workspace-backup.node-test.js`, `gateway-security.node-test.js`, `agent-contract.node-test.js`, `official-mcp.node-test.js`, `package-boundaries.node-test.js`, every 2A/2B test, and all protected visual evidence.

## 11. Required acceptance fixture and user flow

Build the candidate and automated evidence around the exact accepted Family Hygiene 2B fixture:

1. restore the approved source, exact four committed v1 slices, provenance, and applied job;
2. show `Slice 1–4` as primary choices with canonical IDs secondary/copyable;
3. prepare four explicitly authored Family Hygiene `surface` proposals with human-readable names, 1×1 footprint, passable navigation, no collision, `runtimeEligible=false`, and confirmed/proposed placement/connectivity metadata; do not infer semantics from pixels and do not move these fixture assets to `FINAL`;
4. submit the bounded proposal through the real official MCP/HostBinding path;
5. show deterministic per-item diffs/findings in the UI;
6. reject one item with a human note and atomically apply the other three;
7. prove three READY cards resolve to the exact committed slice digests while the rejected item remains inspectable and creates no asset;
8. inspect source/slice/asset provenance, Activity, actor/task attribution, versions, and findings;
9. preserve a focused dirty batch field, selection, local scroll, and page scroll through at least 12 seconds of passive refresh;
10. restart the service and prove assets, proposal decision, findings, source/slices, and references remain exact and non-duplicated;
11. export and verify a portable project bundle, import it into a new empty data directory, and compare normalized project/head/assets/provenance/activity/artifact hashes;
12. keep PR #135 open, draft, and unmerged.

The final user walkthrough should be concise and guided. The user should verify the meaningful product decisions, not diagnose intermediate implementation defects.

## 12. Verification and evidence matrix

| Priority | Layer | Required proof |
| --- | --- | --- |
| P0 | Domain | all three kinds; exact immutable slice/version/digest binding; mismatch/stale-version rejection; bounded typed metadata; deterministic finding IDs/order; structural-band subtraction, span divisibility, clipped partial-macro rejection, connectivity/collision rules; lifecycle gates |
| P0 | Application | durable proposal and owner-only decision; one-item rejection; accepted subset atomic; no partial revision on invalid item/fault; ordered idempotent replay/conflict; grant/object/task/expiry/revocation and per-operation budget accounting |
| P0 | Persistence | v8→v9 migration and rollback/resume; immutable asset versions/findings/references; restart parity; deterministic rebuild; integrity catches wrong/missing slice, digest, finding, head, version, and reference; legacy assets preserved |
| P0 | HTTP/security | exact keys, body/count/depth limits, CSRF/origin; no authority fields; cross-project denial; project-safe preview URI; stale response/project switching contained |
| P0 | MCP | exact advertised/runtime schemas; feature gating; asset operation/resource equivalence; owner decision absent; HostBinding/grant/audit enforcement; oversized batch rejection; one final redacted denied/failed audit result |
| P0 | Bundle | new-destination round trip; normalized semantic and CAS hashes exact; no live authority/secrets/paths; tampered manifest/semantic data/blob, extra file, symlink, unsupported schema, active job, and ID conflict fail before visibility |
| P0 | Browser 1440×900 and 1060×900 | inventory, proposal review, rejection, findings, ordinal-first labels, canonical copy, READY/fallback previews, provenance, no crop/overflow/header collision/runtime/network errors |
| P0 | Browser interaction | focused dirty editor and both scroll contexts survive 12+ seconds; valid conflict behavior; stale async and duplicate-poll containment |
| P1 | Accessibility/UX | keyboard operation, labels, live validation, errors not color-only, actions usable on preview failure, responsive action placement |
| P1 | Regression | full Studio and root suites plus protected 1A/1B/2A/2B behavior and evidence remain green |

Evidence must contain exact fixture metadata, browser/viewport versions, DOM/observation records, zero-error assertions, screenshots, portable-bundle round-trip hashes, and a manifest of every file. Inspect the screenshots; a green selector or computed style is not visual proof.

## 13. Required long agent loop

Use a staged loop with non-overlapping ownership and explicit handbacks:

1. **Fresh 2C coordinator:** re-verifies remote branch/PR/CI/authority, reads this bundle, inventories actual seams, and writes a bounded contract/change/test plan.
2. **Domain/Application specialist:** freezes V2 asset, metadata, findings, lifecycle, proposal, idempotency, and authorization contracts with pure tests.
3. **Persistence/Security specialist:** adversarially approves migration, atomicity, integrity, redaction, and portable-bundle design before those writes begin.
4. **UI/MCP specialist:** freezes human workflow, refresh ownership, HTTP schemas, exact MCP discovery/gating, and acceptance fixture.
5. **Adversarial reviewer:** tries to break scope, legacy compatibility, recut binding, batch atomicity/budgets, cross-project security, import sanitation, and evidence sufficiency. No implementation phase advances with an unresolved P0.
6. **Bounded implementers:** work in separable domain, persistence/bundle, and UI/MCP/test slices; each hands back changed files, invariants, commands, and open risk.
7. **Integrator:** runs focused tests after each slice, then the complete Studio/root suites, migration/fault/tamper/restart/bundle tests, protected evidence, and browser capture.
8. **Fresh independent verifier:** reviews the final diff from the accepted baseline, reruns the adversarial matrix, inspects every screenshot/observation/bundle manifest, and issues GO/NO-GO without relying on implementer claims.
9. **Documentation/CI closer:** updates requirements, architecture, MCP contract, roadmap, status record, handoff, PR metadata, and exact CI/evidence pins while keeping the PR draft/unmerged.
10. **Coordinator:** only after independent GO and green published CI, gives the user one step-by-step 2C acceptance walkthrough.

Agents may delegate further bounded work, but the coordinator owns integration and authority. Every handback must distinguish implemented facts, verified facts, planned work, and open decisions.

## 14. Exact first actions for the fresh receiver

1. Fetch and verify current `main`, branch head, PR #135 state/body, and Actions. Stop if the remote head moved incompatibly.
2. Read the complete required bundle and inspect the exact files in section 10.
3. Confirm no unrelated local dirty change will be reset, cleaned, overwritten, committed, or pushed. In the current shared environment, local history is not authoritative; publish only reviewed intended files against the verified remote parent.
4. Produce a contract table for asset versions, metadata, findings, proposal decision, scopes, tables, references, HTTP/MCP operations, and portable-bundle sanitation.
5. Resolve internal design choices with the Persistence/Security and adversarial reviewers; do not ask the user unless the choice changes the authorized acceptance scenario.
6. Add pure domain tests first, then application behavior, migration/atomic persistence, integrity/recovery, feature-gated MCP/HTTP, bundle round trip, UI, browser evidence, and documentation in that order.
7. Preserve legacy `asset.define`, the accepted 15-tool/two-template surface until the new durable gate is live, and every protected 2B behavior.
8. Rebase/re-read the remote branch before each publication; use fast-forward commits only and verify the created tree contains exactly the intended paths.
9. Keep the PR open, draft, and unmerged. Do not generate or publish binaries.
10. Return to the user only for the major 2C acceptance gate or a genuine blocker defined in section 1.

## 15. Definition of done before the user gate

The coordinator may present Checkpoint 2C to the user only when:

- the 2C contract is documented and internally adversarially approved;
- stable slice-bound V2 assets, typed metadata/findings/lifecycle, durable batch proposal/rejection/apply, query/filter UI, and bounded MCP equivalence are implemented;
- schema v9, atomic artifact references, rebuild, integrity, backup/restart, failure injection, tamper detection, and portable bundle round trip pass;
- the exact Family Hygiene acceptance fixture is reproducible and provider-free;
- full Studio and root tests and every protected checkpoint regression pass locally and in published CI;
- 1440×900 and 1060×900 evidence is captured and manually inspected with no unresolved P0/P1 acceptance blocker;
- a fresh independent verifier issues GO;
- current documentation and PR metadata accurately say **2C candidate, not yet user-accepted**, and the PR remains draft/unmerged;
- the user walkthrough is ready as a short sequence of meaningful checks with clear ignore-for-now notes.

## 16. Process lessons carried forward

- A computed CSS rule is not visual evidence; compare actual image/content boxes and inspect screenshots.
- Passive polling is not permission to replace focused, dirty, scrolled, or captured interaction state.
- A stable semantic identity must pin immutable artifact lineage; following the latest slice head silently is data corruption.
- Dry-run output visible only to one client cannot satisfy human review of an agent proposal; the review object must be durable and scoped.
- Batch syntax is not atomicity. Validate evolving state, charge every contained operation, and commit one revision or none.
- Artifact references, findings, Activity, idempotency, grant charge, and semantic heads belong in the same failure boundary.
- Full-workspace backup and portable project exchange have different trust and redaction models; never reuse the name or assume the same payload is safe.
- Removing authority rows from a copied database is insufficient if secrets remain recoverable in free pages; use a normalized format or a compacted sanitized database.
- Source approval, asset validation, finalization, portable Studio bundle exchange, Numberdroid/runtime export, publication, merge, and release are distinct lifecycle decisions.

## 17. Final receiver launch protocol

The fresh receiver begins by stating the verified remote head/PR/CI and the 2C authority boundary, then posts its contract/change/test plan to the coordinator. It must not infer broader authority from this handoff. It may continue autonomously through implementation and internal verification, but it must stop before merge, release, publication, provider work, room work, Numberdroid export/materialization, or any claim of user acceptance.
