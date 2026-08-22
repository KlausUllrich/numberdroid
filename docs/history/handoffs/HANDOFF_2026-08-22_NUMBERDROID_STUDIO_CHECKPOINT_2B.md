# Handoff — Numberdroid Studio Checkpoint 2B Accepted

- **Date:** 2026-08-22
- **Repository:** `KlausUllrich/numberdroid`
- **Status:** explicitly user-accepted on 2026-08-22 after the complete live walkthrough
- **Baseline `main` head at creation:** `1e1f0ce09a7c996f24cf6b216e400d57cb6dc666` from the current Checkpoint 2 line; receiver MUST re-verify current `main`
- **Feature commit:** `ae250378943258770330d53c6ec685a94e17dd0e`
- **Product-repair head:** `2e68a81cb00c52da552bd12b5356d18f13772ee8`; earlier repair commits include `2d8e5bfe379add0423f80919d5ae9e70c61a5fdd` and `d8b6efdd626c7d931f169914c5c65cba240156c5`
- **Current repair commits:** product `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d`; selector-only harness follow-up `04d876da750f348e24de9420be1ff59c349bc092`; receiver MUST re-read the remote head before any update
- **Accepted head:** `309c24961f89389047db837471b2e434dd13e149`
- **Acceptance-record commit:** `52eb9d32cab4fcbf20559455bc141215e7fb8998`
- **Post-acceptance evidence-only commits:** `f116f25aed2f0a9d935de9061cf6492d3a56bef4`, `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` — `visualFixture`/test only; no product behavior change and acceptance was not reopened
- **CI / Pages state:** repaired-evidence run `32568108922` passed Studio job `97019592824` and root job `97019592908`; final closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped because Studio is a local authoring service
- **Development branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — `https://github.com/KlausUllrich/numberdroid/pull/135`; keep open, draft, and unmerged
- **Primary receiving role:** Coordinator / QA Integrator
- **Secondary / trigger roles:** Authoring-tool Engineer, Security, Technical Artist, repository integration
- **Next milestone / task:** none implied; await separate user authorization before any Checkpoint 2C planning

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
- Checkpoint 2B visual cutter, job, apply, recut, close/reopen, and restart workflow at accepted head `309c24961f89389047db837471b2e434dd13e149`, with explicit user acceptance recorded on 2026-08-22.

### Checkpoint 2B accepted / frozen

- source-resolution visual atlas cutter with fit/100%/200% zoom, SVG rectangle overlay, pointer/keyboard/numeric editing, inclusion, preview, and explicit per-rectangle new/replacement identity;
- non-authoritative regular-grid proposal plus authoritative explicit rectangle revisions;
- deterministic, audited exact-PNG decoder/crop/canonical-RGBA encoder in `packages/preview`;
- durable `ATLAS_PREVIEW` jobs with immutable input/creator authority, complete one-time job/output-byte budget, progress/events, leases/recovery, cancel/retry/discard, three-attempt ceiling, and quiesced shutdown;
- atomic output metadata/reference/progress publication and atomic semantic slice apply;
- state-specific integrity and snapshot-consistent database/CAS backup;
- schema v8 and the accepted exact 15-tool/two-resource-template MCP surface;
- CI preparation/capture code for dedicated 2B cutter, inspector, and committed views.

These features have frozen local, published CI, and inspected browser evidence. The first live gate's detached native-file-input blocker was repaired. The next live gate reached the cutter and exposed another five-second refresh defect: after grid proposal, the large image's local scrollbar jumped to the top. Unconditional passive replacement plus focused-draft, poll-ownership/stale-context, and captured-drag races were repaired in `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d`; selector-only `04d876da750f348e24de9420be1ff59c349bc092` removed the harness's stale generated-ID assumption. The prior `a3d9` candidate remains superseded. The user completed the repaired walkthrough at head `309c24961f89389047db837471b2e434dd13e149` and explicitly accepted Checkpoint 2B on 2026-08-22.

The accepted walkthrough retained both image axes, focused `Top margin = 5`, and page position through a 12+ second passive refresh; saved the definition; completed `SUCCEEDED` 4/4 preview and `APPLIED` 4/4 commit on attempt 1 with four distinct quadrants and four stable v1 heads; exercised explicit recut mapping; discarded unsaved `X = 4`/remap on close/reopen while retaining saved `X = 3` and v1 heads; and preserved the approved source, exact rectangles, applied job, v1 previews, Fit/no-jump state, and no duplication through a full service restart.

Accepted nonblocking UX finding: canonical slice IDs are unusable as primary human labels. A future UI should present ordinal **Slice 1–64** labels primarily and keep the canonical ID secondary and copyable. The user explicitly deferred this improvement and accepted 2B without it.

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
| Cutter layout, coordinate editing, preview, explicit remap, job control, and restart persistence | Resolved: user accepted on 2026-08-22 | complete |
| Final repaired test/CI/browser evidence | Resolved: coordinator / independent verifier | complete; supports the accepted gate |
| Final adversarial disposition | Resolved: GO after harness repair | complete; no open blocker |
| Whether to start 2C | User, by separate explicit authorization | any asset-library semantics work |

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

## 5. MCP surface

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

- Complete frozen Studio Node suite: **109/109 passed**.
- Focused UI/MCP/job set: **44/44 passed**.
- Final adversarial sets: **23/23 and 36/36 passed**, with a GO recommendation.
- Official MCP suite: **5/5 passed**.
- Protected Checkpoint 1 evidence: **VERIFIED**.
- The final integrity-tamper gap is closed and included in the passing state-specific job/reference coverage.
- Current repairs: product `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d`; selector-only harness follow-up `04d876da750f348e24de9420be1ff59c349bc092`.
- GitHub Actions run [`32568108922`](https://github.com/KlausUllrich/numberdroid/actions/runs/32568108922): Studio job `97019592824` and root job `97019592908` succeeded.
- Docs-head GitHub Actions run `32568704927`: Studio job `97020985366` and root job `97020985521` succeeded.
- Final post-acceptance closure run `32572870510`: Studio job `97030836851` and root job `97030836927` succeeded; Pages was intentionally skipped.
- Chrome `151.0.7922.137`, DevTools protocol `1.3`.
- Valid 2A artifact ID `9473018855`: 2,157,707 bytes, digest `sha256:55937b09b896b0a0417cc818f9d9eb64b415b0d5256606c364a75b4fa983ef89`, created `2026-08-22T08:17:49Z`, expires `2026-09-05T08:17:48Z`. Its downloaded ZIP digest was independently recomputed and matches.
- The 2A artifact has 20 files: fixture/server records, two approved-source DOM snapshots, eight PNGs, and eight observations. All six Sources observations record correct fully-contained before-layout/final focus, exact source-ID pattern validity, retained file selection, staged recovery/operation isolation where applicable, and zero unexpected/synthetic/runtime/visual errors.
- Valid 2B artifact ID `9474639509`: 2,838,857 bytes, digest `sha256:86366bc207fe081effeb8825b7cc4586026654fbe1c83ce026e1e12e6fc7ebd8`, expires `2026-09-05T10:40:37Z`.
- Final post-acceptance 2B closure artifact ID `9475808319`: 2,839,931 bytes, digest `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, expires `2026-09-05T12:26:26Z`.
- The 2B artifact contains `fixture.json`, `server.log`, two DOM snapshots, six PNGs, and six observation files — 16 files total.
- All six cutter/inspector/committed screenshots at 1440×900 and 1060×900 were inspected: the full source is contained; exact rectangles and responsive layout are visible; crop and overflow are absent.
- Every observation records project `numberdroid-studio-checkpoint-2b`, revision 7, Activity 7, ready, `APPLIED` 4/4 attempt 1, four overlays, four committed previews, zero runtime/network errors, no horizontal overflow, and zero Header overlaps.
- Both viewports prove unchanged passive refresh retains the same DOM/focus, uncommitted `top=5`, local X321/Y417, and window position; necessary render yields y5/h621 and retains scroll; the VM race harness proves one poll owner and rejects stale identities; drag replacement is deferred with dirty and inspector/SVG agreement plus exact local/window scroll; close/reopen creates a new Fit instance at 0,0; runtime/network errors are zero.
- The final closure artifact has 16 files under Chrome `151.0.7922.137` at 1440×900 and 1060×900, records zero runtime and visual errors, and proves captured press, same-pointer held move, deferred rendering, matching release/settlement/replacement, exact scroll/context, and bounded telemetry cleanup.
- Fixture source and all four output digests/dimensions match the local pins.
- The formerly current `a3d9` run `32561781843` is superseded by the user-reported scrollbar defect. Failed run `32567878956` and 2B artifact `9474582144` are diagnostic only: all new product assertions passed, but the harness retained a stale generated-rectangle-ID selector. Post-acceptance run `32571622269` failed both Studio attempts and produced invalid diagnostic artifact `9475480760` (846 bytes). Post-acceptance run `32572344465`, Studio job `97029542069`, isolated Chrome/CDP post-move pointer-capture bookkeeping and is invalid diagnostic evidence only. Earlier invalid/diagnostic runs remain non-evidence. Run `32568108922` and artifact `9474639509` identify the pinned product-repair evidence; run `32572870510` and artifact `9475808319` identify the final post-acceptance closure evidence. The two later commits are evidence-harness only and do not reopen the acceptance recorded separately at head `309c24961f89389047db837471b2e434dd13e149`.
- Live acceptance retained image X/Y, focused `Top margin = 5`, and page position through a 12+ second passive refresh; save succeeded; preview reached `SUCCEEDED` 4/4 attempt 1 with distinct quadrants; commit reached `APPLIED` 4/4 attempt 1 with stable v1 heads; recut mapping worked; close/reopen discarded unsaved `X = 4`/remap while retaining saved `X = 3` and v1 heads; and a full service restart preserved the approved source, exact rectangles, applied job, previews, Fit/no-jump state, and no duplication.
- Explicit user decision: **Checkpoint 2B accepted on 2026-08-22.** Canonical IDs as primary human labels are deferred nonblocking UX debt; future UI should use ordinal **Slice 1–64** labels primarily and canonical IDs secondarily/copyably.

## 8. Exact next actions

1. Preserve the accepted Checkpoint 2B behavior and its rejected/diagnostic evidence history.
2. Keep PR #135 open, draft, and unmerged unless the user separately authorizes a merge action.
3. Do not start Checkpoint 2C, providers, rooms, export, materialization, publication, merge, or release without separate explicit authorization.
4. When a later UI gate authorizes label work, present ordinal **Slice 1–64** as the primary human label and the canonical slice ID as secondary/copyable; do not treat this deferred finding as a reason to reopen 2B acceptance.

## 9. Process lessons carried forward

- A computed CSS rule is not visual evidence. The 2A first candidate passed automated checks while the source was visibly cropped; browser evidence must compare actual image/content boxes and the coordinator must inspect screenshots.
- An unknown HTTP outcome must replay the exact logical operation with the same idempotency key and immutable inputs. A browser refresh may reconcile state but must not silently issue a new mutation.
- A worker lease is authority to attempt work, not permission to publish after the lease or grant changes. Output metadata/reference/progress must share the ownership compare-and-swap.
- Durable job output is budgeted artifact work even before semantic apply. Charge once at job creation and release references by state; do not count retries as new semantic work.
- Job-control audit that commits after the transition can lie after a crash. Authorized attempt and transition belong in the same transaction.
- Documentation must distinguish accepted 2A, accepted 2B, green CI, visually inspected evidence, user acceptance, merge, and release as separate states.

## 10. Final receiver launch protocol

1. verify current `main`, draft PR head/state, and Actions;
2. read the universal bootstrap and Studio files listed above;
3. inspect actual source, migrations, worker, UI, MCP registrations, and tests;
4. summarize the frozen accepted checkpoint and report any authority conflict;
5. complete the exact verification/publish sequence without expanding scope;
6. do not infer 2C, merge, provider, release, or publication authority from the completed 2B user gate.
