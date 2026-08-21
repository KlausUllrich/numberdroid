# Handoff — Numberdroid Studio Checkpoint 2B Candidate

- **Date:** 2026-08-22
- **Repository:** `KlausUllrich/numberdroid`
- **Status:** Checkpoint 2B implemented candidate; final frozen verification, GitHub CI/browser evidence, and user acceptance pending
- **Baseline `main` head at creation:** `1e1f0ce09a7c996f24cf6b216e400d57cb6dc666` from the current Checkpoint 2 line; receiver MUST re-verify current `main`
- **Baseline draft-branch head before 2B publication:** `de0a6460293155965cb92b81c8114bb66fe7b1f4` last verified; receiver MUST re-read the remote head before any update
- **Baseline CI / Pages state:** accepted 2A run `32525797103` was green; Pages was intentionally skipped because Studio is a local authoring service; dedicated 2B CI has not run yet
- **Development branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — `https://github.com/KlausUllrich/numberdroid/pull/135`; keep draft and unmerged
- **Primary receiving role:** Coordinator / QA Integrator
- **Secondary / trigger roles:** Authoring-tool Engineer, Security, Technical Artist, repository integration
- **Next milestone / task:** freeze, publish, and independently verify Checkpoint 2B; present one major user gate only after green CI and inspected browser evidence

This handoff is a dated task snapshot. Current code and current binding contracts outrank it. It authorizes no merge, release, binary publication, provider integration, Checkpoint 2C, room work, export, materialization, or publish action.

## 1. Required reading

Read completely in this order:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`
6. `docs/agents/HANDOFF_PROTOCOL.md`
7. `tools/numberdroid-studio/README.md`
8. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
9. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
10. `tools/numberdroid-studio/docs/MCP_CONTRACT.md`
11. `tools/numberdroid-studio/docs/ROADMAP.md`
12. `tools/numberdroid-studio/docs/CHECKPOINT_2A_STATUS.md`
13. `tools/numberdroid-studio/docs/CHECKPOINT_2B_STATUS.md`
14. this handoff

The primary QA/Integrator route then inspects the actual implementation and tests listed below. The full Story, Game Design, room/level, provider, and export corpora are not mandatory initially because this task freezes a local deterministic cutter. If runtime topology/metadata interpretation begins, the Numberdroid adapter/Level Generation trigger applies. If a new image is generated or edited, the Artist generation gate applies. If repository binaries are published, the binary transport contract applies before the write.

## 2. Current state

### Accepted / frozen

- Checkpoint 1A shell and behavior fixture at `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`.
- Checkpoint 1B at `41fad464cd2f904666f7dfecc8437f2286c3254c`, including SQLite/CAS, official MCP, private HostBinding pairing, Header Agent access, and Asset-card preview/fallback behavior.
- Checkpoint 2A source workflow at repaired candidate `31ddbbb838d419879229f878fe0b43a99a3b7459`, with explicit user acceptance recorded on 2026-08-21.
- The 2A repaired original-source preview is contained, capped, and opens the full project-scoped original in a new tab. Do not reintroduce the rejected bottom crop.
- Provider-free operation. The source is imported locally; no provider, credential, egress, or cost policy exists.
- Family Hygiene source identity: PNG, 2,720,519 bytes, 1254×1254, SHA-256 `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`.
- Protected manifest SHA-256 `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.

### Implemented but not accepted

- source-resolution visual atlas cutter with fit/100%/200% zoom, SVG rectangle overlay, pointer/keyboard/numeric editing, inclusion, preview, and explicit per-rectangle new/replacement identity;
- non-authoritative regular-grid proposal plus authoritative explicit rectangle revisions;
- deterministic, audited exact-PNG decoder/crop/canonical-RGBA encoder in `packages/preview`;
- durable `ATLAS_PREVIEW` jobs with immutable input/creator authority, complete one-time job/output-byte budget, progress/events, leases/recovery, cancel/retry/discard, three-attempt ceiling, and quiesced shutdown;
- atomic output metadata/reference/progress publication and atomic semantic slice apply;
- state-specific integrity and snapshot-consistent database/CAS backup;
- schema v8 and an exact 15-tool/two-resource-template MCP candidate surface;
- CI preparation/capture code for dedicated 2B cutter, inspector, and committed views.

These features have backend evidence but no published 2B Actions run or user acceptance at handoff creation.

### Planned / not implemented

- Checkpoint 2C `surface`/`prop`/`item` asset identities from slices, bulk metadata, placement/connectivity/collision validation, general batch equivalence, and portable bundle;
- provider-backed generation, credentials, network egress, cost enforcement, or reproduction policy;
- automatic pixel/grid detection, topology inference, padding/resampling, WebP cutting, or general thumbnails;
- isolated task branches, proposal comparison/merge, subscriptions, and a Custom grant editor;
- rooms/hallways, level composition, Numberdroid adapter, export/materialize/commit/publish, or release;
- V2 animation and all enemy/NPC/encounter/route authoring.

### Open decisions

| Decision | Owner | Required before |
| --- | --- | --- |
| Does the cutter layout, coordinate editing, preview, explicit remap, and job control feel acceptable? | User | accepting 2B |
| Is the final frozen test/CI/browser evidence complete and internally consistent? | Coordinator / independent verifier | presenting the user gate |
| Any 2B defect found by final adversarial review | Coordinator + implementing engineer | publishing or asking the user to test |
| Whether to start 2C | User, after explicit 2B acceptance | any asset-library semantics work |

## 3. Exact fixture and deterministic output

Approved source path:

`art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png`

Pinned rectangles and outputs:

| Rectangle | `(x,y,w,h)` | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `rect.family.0.0` | `(3,3,622,622)` | 1,548,341 | `ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2` |
| `rect.family.0.1` | `(629,3,622,622)` | 1,548,341 | `3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e` |
| `rect.family.1.0` | `(3,629,622,622)` | 1,548,341 | `9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526` |
| `rect.family.1.1` | `(629,629,622,622)` | 1,548,341 | `a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318` |

All outputs are 622×622 canonical RGBA PNGs from processor `numberdroid-studio.exact-png-crop.v1`.

## 4. Persistence and job invariants

Schema v8 migrations:

- 0007 `jobs_and_job_events`: `aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9`;
- 0008 `authorized_agent_attempts`: `2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730`.

The exact job states are:

```text
QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED | APPLIED | DISCARDED
```

There is no `WAITING_FOR_USER` and no respond operation. Retry never changes the immutable input and cannot exceed three total attempts. New atlas definitions/previews require the previous preview to be applied or discarded.

Do not weaken these atomic boundaries:

- define rectangles: semantic revision/event/projection/Activity/idempotency;
- preview creation: semantic revision plus job, initial event, creator authority, command/job/artifact-byte usage, Activity, and idempotency;
- output publication: lease/authority compare-and-swap plus exact artifact metadata, temporary reference, progress, and event;
- apply: exact live metadata plus slice revisions/heads, permanent refs, removal of temporary refs, semantic revision/Activity/idempotency, and `APPLIED` revision;
- agent cancel/retry/discard: authorized attempt record plus job transition/event in one transaction.

The worker must recheck revoke/expiry/task/object scope at claim and output safe points. A stale lease owner cannot publish. Failure text must stay sanitized. Service shutdown must await worker quiescence before closing SQLite.

Integrity is state-specific and links input/applied revisions to the matching atlas/source/fingerprint/slices and allowed reference owners. Backup requires a complete semantic/CAS integrity pass and copies one snapshot-consistent database/CAS closure. Never copy only a live SQLite main file or downgrade v8 in place.

## 5. MCP candidate surface

When both durable stores are live, discovery is exactly 15 tools:

```text
studio_command_catalog_list
studio_project_read
studio_project_status_set
studio_source_register
studio_asset_define
studio_source_intake_commit
studio_source_review_propose
studio_atlas_propose_grid
studio_atlas_define_rects
studio_atlas_preview_slices
studio_atlas_commit_slices
studio_job_read
studio_job_cancel
studio_job_retry
studio_job_discard
```

Resource templates are exactly:

```text
studio://projects/{projectId}
studio://projects/{projectId}/jobs/{jobId}
```

The job tool/resource must be project-scoped and return no binary/base64 payload, machine path, credential, HostBinding token, grant ID, stack trace, or raw worker error. Output preview links are project-scoped same-origin HTTP resources. `source.review.decide` remains owner-only and absent.

## 6. Actual implementation and regression map

Inspect at minimum:

- `tools/numberdroid-studio/packages/domain/src/atlas-definition.js`
- `tools/numberdroid-studio/packages/domain/src/command-catalog.js`
- `tools/numberdroid-studio/packages/application/src/studio-service.js`
- `tools/numberdroid-studio/packages/preview/src/index.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/0007_jobs_and_job_events.sql`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/0008_authorized_agent_attempts.sql`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-job-store.js`
- `tools/numberdroid-studio/packages/persistence/src/integrity/workspace-integrity.js`
- `tools/numberdroid-studio/packages/persistence/src/backup/workspace-backup.js`
- `tools/numberdroid-studio/apps/studio-server/src/atlas-preview-worker.js`
- `tools/numberdroid-studio/apps/studio-server/src/server.js`
- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/packages/mcp-server/src/index.js`
- `tools/numberdroid-studio/packages/mcp-server/src/official-server.js`
- `tools/numberdroid-studio/scripts/prepare-checkpoint-2b-visual-evidence.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`
- `.github/workflows/build.yml`

Run every Studio Node test and pay special attention to:

- `tests/checkpoint-2b-preview.node-test.js`
- `tests/checkpoint-2b-integration.node-test.js`
- `tests/checkpoint-2b-http.node-test.js`
- `tests/sqlite-jobs.node-test.js`
- `tests/official-mcp.node-test.js`
- `tests/specialized-mcp-audit.node-test.js`
- persistence, integrity, backup, gateway, package-boundary, and protected-evidence suites.

## 7. Verification state at handoff creation

- Complete frozen Studio Node suite: **108/108 passed**.
- Focused UI/MCP/job set: **44/44 passed**.
- Final adversarial sets: **23/23 and 36/36 passed**, with a GO recommendation.
- Official MCP suite: **5/5 passed**.
- Protected Checkpoint 1 evidence: **VERIFIED**.
- The final integrity-tamper gap is closed and included in the passing state-specific job/reference coverage.
- The draft-branch commit, GitHub Actions run, Chrome version, artifact ID/digest, screenshot count, and visual inspection are intentionally pending publication.

## 8. Exact next actions

1. Stop concurrent implementation/document edits and inspect the complete diff.
2. Have the independent adversary review the frozen tree, especially job authority, atomicity, resource ownership, shutdown, integrity/backup, UI retry/race behavior, and documentation claims.
3. Run from `tools/numberdroid-studio/`:

   ```bash
   npm test
   npm run build
   NUMBERDROID_EVIDENCE_REQUIRE_PRODUCTION_ADAPTER=1 npm run evidence:verify
   ```

4. Run `git diff --check` and relevant root repository tests/preflights. Preserve the accepted Checkpoint 1 and 2A evidence.
5. Replace provisional verification text with exact frozen counts/identities.
6. Re-read the remote draft-branch head. Publish only the confirmed textual/code paths to the existing branch without force; do not merge.
7. Wait for both root and isolated Studio Actions jobs. Inspect the dedicated 2B artifact and every 1440×900 and 1060×900 cutter/inspector/committed screenshot. Confirm source/overlay geometry, four remap controls, one-pixel keyboard edit with retained focus, successful resources, accessibility, no crop, no overflow, and no browser/network errors.
8. If any check fails, return to plan/implement/adversary/verify. Do not ask the user to debug an unfrozen candidate.
9. Only after all checks pass, give the user exact launch steps and walk through one major 2B verification scenario. Await explicit acceptance before changing the status or planning 2C.

## 9. Process lessons carried forward

- A computed CSS rule is not visual evidence. The 2A first candidate passed automated checks while the source was visibly cropped; browser evidence must compare actual image/content boxes and the coordinator must inspect screenshots.
- An unknown HTTP outcome must replay the exact logical operation with the same idempotency key and immutable inputs. A browser refresh may reconcile state but must not silently issue a new mutation.
- A worker lease is authority to attempt work, not permission to publish after the lease or grant changes. Output metadata/reference/progress must share the ownership compare-and-swap.
- Durable job output is budgeted artifact work even before semantic apply. Charge once at job creation and release references by state; do not count retries as new semantic work.
- Job-control audit that commits after the transition can lie after a crash. Authorized attempt and transition belong in the same transaction.
- Documentation must distinguish accepted 2A, implemented 2B candidate, green CI, visually inspected evidence, user acceptance, merge, and release as separate states.

## 10. Final receiver launch protocol

1. verify current `main`, draft PR head/state, and Actions;
2. read the universal bootstrap and Studio files listed above;
3. inspect actual source, migrations, worker, UI, MCP registrations, and tests;
4. summarize the frozen candidate and report any authority conflict;
5. complete the exact verification/publish sequence without expanding scope;
6. do not cross the user major gate, 2C gate, merge gate, provider gate, or publication gate without explicit authorization.
