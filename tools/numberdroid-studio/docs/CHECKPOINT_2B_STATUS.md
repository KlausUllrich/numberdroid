# Numberdroid Studio — Checkpoint 2B Acceptance Record

- **Date:** 2026-08-22
- **Status:** explicitly user-accepted on 2026-08-22 after the complete live walkthrough
- **Branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — remains open, draft, and unmerged
- **Accepted prerequisite:** Checkpoint 2A, recorded in `CHECKPOINT_2A_STATUS.md`
- **Feature commit:** `ae250378943258770330d53c6ec685a94e17dd0e`
- **Product-repair chain:** `2d8e5bfe379add0423f80919d5ae9e70c61a5fdd`, `d8b6efdd626c7d931f169914c5c65cba240156c5`, through `2e68a81cb00c52da552bd12b5356d18f13772ee8`
- **Current repair commits:** product `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d`; selector-only harness follow-up `04d876da750f348e24de9420be1ff59c349bc092`
- **Accepted head:** `309c24961f89389047db837471b2e434dd13e149`
- **Next gate:** none implied; Checkpoint 2C requires separate user authorization

This record describes the frozen Checkpoint 2B contract and its explicit user acceptance. Acceptance grants no merge, release, publication, provider, Checkpoint 2C, room, export, or materialization authority.

## Outcome

The accepted slice turns one approved PNG source into deterministic, inspectable slice versions without repository editing:

1. the user or an authorized agent proposes a non-authoritative regular grid or supplies explicit rectangles;
2. the source-resolution cutter shows the geometry over the approved original and provides equivalent structured controls;
3. one semantic revision freezes an authoritative atlas definition;
4. a separate semantic command atomically creates a durable `ATLAS_PREVIEW` job and charges its complete bounded work once;
5. the worker creates verified canonical PNG outputs from the immutable input;
6. the user or agent inspects progress, events, and preview resource links and can cancel, retry, or discard where valid;
7. a final semantic command atomically promotes verified results to stable slice heads and marks the job `APPLIED`.

Asset kinds/metadata, bulk naming, project bundles, rooms, Level Compiler integration, export, and publication are not part of this gate.

## User-gate blocker and repair

The user did not accept the first 2B gate attempt. Selecting the approved PNG opened the native chooser, but the periodic five-second workspace refresh rerendered the intake form and detached that native file input. The visible field returned to **No file chosen**, so the import step was blocked.

The repaired product preserves the active file-input node and selection across trusted refreshes; clears it deliberately before staged Resume; pins project ID, revision, CSRF, idempotency, and staged-intake context for the whole asynchronous operation; disables conflicting project/source/cutter controls without hiding the live status; rejects stale or cross-project results; and renders a post-stage failure as the exact staged Resume/Discard context rather than silently ignoring a newly displayed file. Chrome `151.0.7922.137` then exposed that `[A-Za-z0-9][A-Za-z0-9._:-]{0,127}` is invalid under the HTML `pattern` attribute's UnicodeSets (`v`) semantics. The repaired pattern escapes the literal hyphen, and browser evidence proves one valid source ID passes and a slash-bearing ID fails.

Earlier product repairs are the commit chain through `2e68a81cb00c52da552bd12b5356d18f13772ee8`. Former harness-only repairs are `f132f4d2e15ae9819e2cc42de9a75b49ca110cb5` and `a3d9a18e5deb0d9049e7ba6f879ad22eea1dfb29`; the latter re-focused the intake/recovery/approved target and repeated strict protocol-error checks, but its candidate was later superseded by the scrollbar defect below.

The user then reached the cutter and reported a second gate blocker: after **Propose regular grid**, the large image's local scrollbar jumped to the top on each five-second refresh. The root cause was unconditional passive workspace replacement plus adjacent focused-draft loss, duplicate/stale poll ownership, incomplete project/source/atlas/instance binding, and pointer-drag detachment races. Product repair `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d` preserves unchanged DOM/focus/scroll, restores compatible necessary renders, makes polling single-owner and fail-closed on stale identities, and defers external replacement through pointer settlement. Selector-only commit `04d876da750f348e24de9420be1ff59c349bc092` removed the evidence harness's stale generated-rectangle-ID assumption. The `a3d9` candidate is therefore superseded and rejected for the reported scrollbar defect.

## Pinned Family Hygiene fixture

Approved source:

- path: `art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png`;
- media/dimensions: PNG, 1254×1254;
- byte length: 2,720,519;
- SHA-256: `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`.

The accepted 2×2 proposal uses four included rectangles in row-major order:

| Rectangle | x | y | width | height | Output bytes | Output SHA-256 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `rect.family.0.0` | 3 | 3 | 622 | 622 | 1,548,341 | `ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2` |
| `rect.family.0.1` | 629 | 3 | 622 | 622 | 1,548,341 | `3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e` |
| `rect.family.1.0` | 3 | 629 | 622 | 622 | 1,548,341 | `9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526` |
| `rect.family.1.1` | 629 | 629 | 622 | 622 | 1,548,341 | `a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318` |

Every output is a 622×622 canonical RGBA PNG produced by `numberdroid-studio.exact-png-crop.v1`. Identical source bytes, rectangle, and processor parameters produce the same bytes and digest.

## Cutter and identity contract

- The original source remains a small contained preview with a keyboard-accessible **Open original in new tab ↗** link.
- The cutter uses a source-resolution SVG overlay at fit, 100%, and 200% zoom. Display scale never changes integer source coordinates.
- Regular-grid calculation is a proposal only. Manual/variable rectangles, include/exclude, numeric editing, pointer editing, keyboard editing, and preview remain explicit.
- Every included rectangle has a unique opaque ID, positive safe-integer size, in-bounds geometry, and no overlap. The accepted contract permits at most 64 rectangles and 67,108,864 aggregate output pixels; a canonical output above 16 MiB is rejected before work is enqueued.
- Each row explicitly selects either a new slice identity or one existing `sliceId` plus expected version. Replacement is one-to-one. An excluded rectangle cannot replace a slice.
- Keyboard movement changes exactly one source pixel per unmodified arrow key and retains focus after the SVG element is rerendered. The numeric inspector remains the accessible non-canvas alternative.

Checkpoint 2B cuts approved PNG sources only. The processor accepts bounded, non-interlaced, 8-bit RGB/RGBA PNG input; malformed chunk order/CRC, excessive inflate, unsupported color/interlace/critical chunks, and RGB transparency chunks fail closed. Checkpoint 2A may still intake and display an original WebP, but 2B does not cut it.

## Durable job and atomicity contract

The only implemented job kind is `ATLAS_PREVIEW`. Its complete state set is:

```text
QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELLED | APPLIED | DISCARDED
```

There is no `WAITING_FOR_USER` state and no response operation. Initial execution plus explicit/recovery retries are limited to three total attempts.

Job creation is atomic with the semantic input revision, authoritative input/fingerprint, initial event, Activity, idempotency result, job-count usage, and complete output-byte budget. A same-key replay returns the original logical result and cannot double-charge or enqueue. The job stores immutable creator actor/task/branch/grant coordinates; cross-task control is denied.

The worker rechecks original authority at claim and output safe points, uses a renewable lease, recovers abandoned work within the attempt ceiling, and atomically publishes metadata, temporary CAS reference, progress, and event only while it still owns the lease. Cancellation is cooperative. Errors expose a stable safe code/message rather than a path, stack, raw decoder failure, or worker detail. Graceful shutdown stops new work and awaits the active loop before SQLite closes.

`studio_job_cancel`, `studio_job_retry`, and `studio_job_discard` are idempotent. For an agent, the authorized attempt record and job transition share one SQLite transaction. Failure/cancellation/retry/discard releases temporary outputs at the defined boundary. `DISCARDED` is terminal and cannot apply; `APPLIED` is terminal and cannot discard.

Semantic apply verifies exact job/input revision, atlas/source/fingerprint/processor, rectangle set, digest, media type, dimensions, canonical byte size, artifact state, and expected prior slice version. One transaction creates the slice heads/versions and semantic revision, installs permanent references, releases temporary job references, marks the job `APPLIED` at that exact revision, and writes Activity/idempotency evidence.

## Schema, integrity, backup, and recovery

The accepted workspace is SQLite schema v8:

- migration 0007 `jobs_and_job_events`: `aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9`;
- migration 0008 `authorized_agent_attempts`: `2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730`.

Integrity checks exact input/applied revision semantics, atlas/source/fingerprint ownership, job/event state, output metadata, immutable creator coordinates, and state-specific temporary/permanent references. Stale or mismatched job references are findings. Backup refuses a workspace that fails complete SQLite/semantic/CAS integrity and then preserves a snapshot-consistent database plus referenced CAS closure. Restore verification covers every job state, event, output/reference class, and applied slice projection represented in the snapshot.

Rollback requires stopping the writer and restoring a verified pre-v8 database/CAS pair into a new destination, or running prior code against a preserved pre-v8 workspace. Do not downgrade or edit a v8 database in place. Preserve the accepted v8 workspace for diagnosis and recovery evidence.

## MCP surface

When the durable attempt and job stores are both live, the official MCP 2026-07-28 server advertises exactly these 15 tools:

- `studio_command_catalog_list`
- `studio_project_read`
- `studio_project_status_set`
- `studio_source_register`
- `studio_asset_define`
- `studio_source_intake_commit`
- `studio_source_review_propose`
- `studio_atlas_propose_grid`
- `studio_atlas_define_rects`
- `studio_atlas_preview_slices`
- `studio_atlas_commit_slices`
- `studio_job_read`
- `studio_job_cancel`
- `studio_job_retry`
- `studio_job_discard`

It advertises exactly two resource templates:

```text
studio://projects/{projectId}
studio://projects/{projectId}/jobs/{jobId}
```

The job tool and resource return the same redacted, authority-checked projection. Output previews are project-scoped same-origin resource links. Tool/resource/JSON results contain no bitmap/base64 payload, local path, credential, raw HostBinding, grant ID, stack trace, or unsanitized worker error. Owner source decision remains absent from discovery.

## Verification ledger

Frozen local verification after implementation, repair, independent review, and final adversarial review:

- complete Studio Node suite: **109/109 passed**;
- focused UI/MCP/job set: **44/44 passed**;
- final adversarial sets: **23/23 and 36/36 passed**, with a GO recommendation;
- official MCP suite: **5/5 passed**;
- protected Checkpoint 1 evidence: **VERIFIED**;
- final integrity-tamper coverage includes the repaired state-specific job/reference case;
- current repairs `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d` and selector-only `04d876da750f348e24de9420be1ff59c349bc092`;
- GitHub Actions run [`32568108922`](https://github.com/KlausUllrich/numberdroid/actions/runs/32568108922): Studio job `97019592824` and root job `97019592908` succeeded;
- docs-head GitHub Actions run `32568704927`: Studio job `97020985366` and root job `97020985521` succeeded;
- evidence runtime: Chrome `151.0.7922.137`, DevTools protocol `1.3`;
- valid 2A artifact: `numberdroid-studio-checkpoint-2a-visual`, ID `9473018855`, 2,157,707 bytes, digest `sha256:55937b09b896b0a0417cc818f9d9eb64b415b0d5256606c364a75b4fa983ef89`, created `2026-08-22T08:17:49Z`, expires `2026-09-05T08:17:48Z`;
- valid 2B artifact: `numberdroid-studio-checkpoint-2b-visual`, ID `9474639509`, 2,838,857 bytes, digest `sha256:86366bc207fe081effeb8825b7cc4586026654fbe1c83ce026e1e12e6fc7ebd8`, expires `2026-09-05T10:40:37Z`;
- the downloaded 2A ZIP digest was independently recomputed and matches the Actions identity;
- the 2A artifact contains 20 files: fixture/server records, two approved-source DOM snapshots, eight screenshots, and eight observation JSON files. All six Sources observations record the correct intake/recovery/approved focus target fully inside the 900px viewport both before layout and immediately before capture, exact source-ID validity behavior, preserved file selection, staged recovery/operation isolation where applicable, and zero unexpected/synthetic/runtime/visual errors;
- the 2B artifact contains `fixture.json`, `server.log`, two DOM snapshots, six PNG screenshots, and six observation JSON files — 16 files total;
- all six screenshots were personally inspected: cutter canvas, rectangle inspector, and committed slices at 1440×900 and 1060×900 show the complete source, exact rectangles, responsive layout, and no crop or overflow;
- every observation records project `numberdroid-studio-checkpoint-2b`, revision 7, Activity 7, `ready: true`, `APPLIED` 4/4 on attempt 1, four overlays, four committed previews, zero runtime/network errors, no horizontal overflow, and zero Header overlaps;
- both viewport interactions prove unchanged passive refresh keeps the same cutter/scroller/field DOM, focused uncommitted `top=5`, local X321/Y417, and window position; the necessary proposal render yields exact y5/h621 geometry while retaining scroll; the VM race harness proves one poll owner and rejects stale project/source/atlas/job/instance identities; active-drag evidence proves deferred replacement, early dirty state, inspector/SVG agreement, and exact local/window scroll; close/reopen creates a new Fit instance at local 0,0; runtime/network errors remain zero;
- the fixture source digest and all four output digests/dimensions match the pinned local record;
- explicit user major-gate decision: **accepted on 2026-08-22 at head `309c24961f89389047db837471b2e434dd13e149` after the complete live walkthrough**.

The formerly current `a3d9` run `32561781843` is superseded by the user's scrollbar report and MUST NOT be cited as repaired 2B evidence. Failed run `32567878956` and 2B artifact `9474582144` are diagnostic only: the new scroll/grid/poll/drag product probes passed, but the harness still selected the pre-reproposal rectangle ID. Earlier invalid and diagnostic runs remain historical non-evidence. Run `32568108922` and 2B artifact `9474639509` remain the pinned repaired browser evidence; the explicit live decision above, not CI alone, records user acceptance.

The accepted live walkthrough proved that a 12+ second passive refresh retained image X/Y, focused `Top margin = 5`, and page position; definition save succeeded; preview reached `SUCCEEDED` 4/4 on attempt 1 with four distinct quadrants; commit reached `APPLIED` 4/4 on attempt 1 with four stable v1 slice heads; and explicit recut mapping functioned. On close/reopen, unsaved `X = 4` and the unsaved remap vanished while saved `X = 3` and the v1 heads remained. After a full service restart, the approved source, exact rectangles, applied job, v1 previews, Fit/no-jump state, and absence of duplication all persisted.

The user also reported a nonblocking UX finding: canonical slice IDs are unusable as primary human labels. A future UI should show ordinal **Slice 1–64** labels primarily, with the canonical ID secondary and copyable. The user explicitly asked not to fix this now and accepted Checkpoint 2B with it deferred.

## Known limits and blocked work

- The processor is deliberately PNG-only and does not perform automatic grid detection, semantic topology inference, padding, resampling, thumbnailing, or provider generation.
- Only `preserve_exact_rect` is implemented. Rectangles may not overlap.
- Job processing is local and single-service. This is not remote/team execution.
- A terminal discarded result releases Studio references but does not synchronously erase shared/unreferenced CAS bytes; explicit retention-delayed garbage collection remains authoritative.
- Source/atlas detail resource templates, subscriptions, general batch execution, and isolated task branches remain later work.
- Checkpoint 2C asset-library semantics, providers, rooms, levels, Numberdroid adapter/export, production-asset materialization/commits, publishing, merge, and release remain blocked. Checkpoint acceptance and evidence-only documentation commits do not grant those separate authorities.

## Gate disposition

The coordinating agent froze the repair diff, observed green CI, independently verified the artifact digest, and inspected every dedicated browser screenshot/observation before the live walkthrough. The user then completed the repaired scrollbar/focus gate and the remaining preview, apply, recut, close/reopen, and restart checks and explicitly accepted Checkpoint 2B. PR #135 remains open, draft, and unmerged. Do not start Checkpoint 2C, provider work, rooms, export, materialization, publication, merge, or release without a separate explicit authorization.
