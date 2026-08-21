# Numberdroid Studio — Checkpoint 2B Candidate Record

- **Date:** 2026-08-22
- **Status:** implemented candidate; dedicated CI/browser evidence and explicit user acceptance pending
- **Branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — remains draft and unmerged
- **Accepted prerequisite:** Checkpoint 2A, recorded in `CHECKPOINT_2A_STATUS.md`
- **Next gate:** root-agent freeze, publish, green CI and visual-evidence inspection, then one major user verification

This record describes the frozen Checkpoint 2B contract that the candidate is intended to prove. It is not an acceptance record. It grants no merge, release, publication, provider, Checkpoint 2C, room, export, or materialization authority.

## Outcome

The candidate turns one approved PNG source into deterministic, inspectable slice versions without repository editing:

1. the user or an authorized agent proposes a non-authoritative regular grid or supplies explicit rectangles;
2. the source-resolution cutter shows the geometry over the approved original and provides equivalent structured controls;
3. one semantic revision freezes an authoritative atlas definition;
4. a separate semantic command atomically creates a durable `ATLAS_PREVIEW` job and charges its complete bounded work once;
5. the worker creates verified canonical PNG outputs from the immutable input;
6. the user or agent inspects progress, events, and preview resource links and can cancel, retry, or discard where valid;
7. a final semantic command atomically promotes verified results to stable slice heads and marks the job `APPLIED`.

Asset kinds/metadata, bulk naming, project bundles, rooms, Level Compiler integration, export, and publication are not part of this gate.

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
- Every included rectangle has a unique opaque ID, positive safe-integer size, in-bounds geometry, and no overlap. The candidate permits at most 64 rectangles and 67,108,864 aggregate output pixels; a canonical output above 16 MiB is rejected before work is enqueued.
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

The candidate workspace is SQLite schema v8:

- migration 0007 `jobs_and_job_events`: `aa951c02158f76f6343819271b78816e211bfe3015cc9f4f979947a075ef25e9`;
- migration 0008 `authorized_agent_attempts`: `2323dafbef16e418b752ba1602c6d62c1260f00935212358980e6c3e90936730`.

Integrity checks exact input/applied revision semantics, atlas/source/fingerprint ownership, job/event state, output metadata, immutable creator coordinates, and state-specific temporary/permanent references. Stale or mismatched job references are findings. Backup refuses a workspace that fails complete SQLite/semantic/CAS integrity and then preserves a snapshot-consistent database plus referenced CAS closure. Restore verification covers every job state, event, output/reference class, and applied slice projection represented in the snapshot.

Rollback requires stopping the writer and restoring a verified pre-v8 database/CAS pair into a new destination, or running prior code against a preserved pre-v8 workspace. Do not downgrade or edit a v8 database in place. Preserve the v8 candidate workspace for diagnosis and recovery evidence.

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

- complete Studio Node suite: **108/108 passed**;
- focused UI/MCP/job set: **44/44 passed**;
- final adversarial sets: **23/23 and 36/36 passed**, with a GO recommendation;
- official MCP suite: **5/5 passed**;
- protected Checkpoint 1 evidence: **VERIFIED**;
- final integrity-tamper coverage includes the repaired state-specific job/reference case;
- dedicated Checkpoint 2B real-Chrome CI run, published commit, artifact ID/digest, browser version, and screenshot inspection: **pending publication and Actions**;
- explicit user major-gate decision: **pending; do not infer from automated results**.

The CI capture must prepare the pinned source, define the four rectangles, run and apply the preview job, and capture cutter/inspector/committed views at 1440×900 and 1060×900. It must assert exact source and overlay geometry, four remap controls, successful project-scoped resources, keyboard focus retention after a one-pixel edit, accessibility/label state, no horizontal overflow, and no browser/network errors.

## Known limits and blocked work

- The processor is deliberately PNG-only and does not perform automatic grid detection, semantic topology inference, padding, resampling, thumbnailing, or provider generation.
- Only `preserve_exact_rect` is implemented. Rectangles may not overlap.
- Job processing is local and single-service. This is not remote/team execution.
- A terminal discarded result releases Studio references but does not synchronously erase shared/unreferenced CAS bytes; explicit retention-delayed garbage collection remains authoritative.
- Source/atlas detail resource templates, subscriptions, general batch execution, and isolated task branches remain later work.
- Checkpoint 2C asset-library semantics, providers, rooms, levels, Numberdroid adapter/export, materialization, Git commit, publish, and release remain blocked.

## Major-gate protocol

The user should test only after the coordinating agent has frozen the diff, published it to the existing draft branch without force, observed green CI, and inspected the dedicated browser artifact. The user gate then covers cutter layout, coordinate accuracy, preview usefulness, explicit remap clarity, job visibility/control, committed slice results, and restart persistence. Only an explicit user acceptance may convert this candidate record into an acceptance record and unblock planning for 2C.
