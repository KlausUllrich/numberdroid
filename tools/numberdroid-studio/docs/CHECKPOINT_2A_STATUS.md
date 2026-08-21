# Numberdroid Studio — Checkpoint 2A Candidate

- **Date:** 2026-08-21
- **Status:** implementation and verification candidate; explicit user acceptance pending
- **Branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135`
- **Baseline branch head before 2A:** `a3231aeb6b93ee29455f5037824cd419d257b1d4`
- **Candidate implementation commit:** `c274b046fd7e2e3165470128b14e13ed6bbb60e7`
- **Accepted Studio implementation:** `41fad464cd2f904666f7dfecc8437f2286c3254c`
- **Protected Checkpoint 1A commit:** `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`
- **Protected manifest SHA-256:** `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`

This record describes the candidate that is ready for the user's major Checkpoint 2A review. It does not record acceptance, merge authority, release, publication, or permission to start 2B.

## Outcome

The candidate makes source intake and review usable without repository editing:

1. the loopback human UI streams a bounded PNG/WebP into project-scoped SHA-256 CAS;
2. a durable staged intake can be resumed or explicitly discarded after an interrupted commit;
3. one semantic command atomically claims the intake, installs canonical/lineage references, writes the V2 source revision and Activity, and charges an agent's artifact-byte budget when applicable;
4. the source displays the verified original CAS bytes, dimensions, origin, provenance, lifecycle, and review state;
5. an agent with a valid audit-ready HostBinding may commit a staged intake and propose it for review;
6. only the owner may approve or reject, and rejection requires a reason;
7. denied/failed bound-agent mutations appear durably and redacted in the same Activity timeline.

No provider is called. No credential, network egress, cost, generated derivative, thumbnail job, atlas cut, semantic asset, bundle, room, export, or publish operation exists in this gate.

## Pinned realistic fixture

The candidate uses the recommended approved Family Hygiene floor source:

- repository path: `art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png`;
- source authority: `SOURCE_APPROVED`; runtime integration remains open;
- media: PNG, 1254×1254 RGB;
- bytes: 2,720,519;
- SHA-256: `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`.

The E2E test reads this real repository binary. Intake, preview response, owner review, and restart projection retain the same identity. Separate schema-v6 fixtures prove backup/restore and integrity preservation for claimed intake, lineage, and attempt state. No prompt, provider, model, or seed is invented for the Family Hygiene human-upload record.

## Source and recovery contract

Source lifecycle is explicit and terminal within 2A:

```text
human_upload       -> IMPORTED  -> REVIEWED -> APPROVED_SOURCE | REJECTED
imported_generation -> GENERATED -> REVIEWED -> APPROVED_SOURCE | REJECTED
```

Review remains `PENDING` until the owner records `USER_APPROVED` or `USER_REJECTED`. Opening or previewing does not propose or approve. A rejected source retains immutable artifact/provenance evidence and cannot be re-proposed in 2A; another attempt requires a new source intake/identity.

Staged intakes use explicit retention rather than an automatic expiry. The UI lists every staged record with **Resume** and **Discard**. Resume reuses the staged CAS identity and an in-session idempotency key for unknown outcomes. Discard is itself durable and idempotent and releases only the temporary project reference. CAS garbage collection remains the existing explicit retention-delayed process.

Synchronous source intake accepts only PNG/WebP up to 16 MiB and 4096×4096. It verifies declared and actual media, dimensions, byte length, and optional expected SHA-256. Original preview is same-origin, `nosniff`, `Cross-Origin-Resource-Policy: same-origin`, and `Referrer-Policy: no-referrer`.

## Provenance and lineage

V2 provenance is a discriminated record:

- `human_upload` forbids generation metadata;
- `imported_generation` requires prompt, provider, and model but invokes no provider;
- nested parameters are bounded by nodes, depth, item counts, string length, and encoded size;
- secret-like keys, path values, and URI values are rejected;
- reference artifacts must be canonical Studio CAS URIs that are `LIVE` and already referenced by the same project;
- parent source IDs must already exist;
- permanent `source_lineage` references are installed in the same transaction as the source revision.

## Persistence and rollback

SQLite migration 0006 advances the candidate workspace to user version 6 and adds:

- `source_intakes` with `STAGED`, `CLAIMED`, and `ABANDONED` invariants;
- `agent_attempts` with final `DENIED`/`FAILED` outcomes only.

Migration checksum is `f7b785a60bf02cd0d03944d4bd5983a4845bd715bf2a8a88f9c3ddf8c5a419f5`. The migration is transactional per version and a fault at the v6 boundary leaves user version 5 without partial tables; restart applies v6 cleanly. Workspace integrity verifies intake/reference state, permanent lineage references, attempt JSON/status, SQLite/FK state, and every referenced CAS digest/size. Backup and restore preserve all of them.

Rollback requires stopping the writer and restoring a verified pre-2A database/CAS pair into a new destination or running the prior code against a preserved pre-v6 workspace. Do not downgrade or edit a v6 database in place. Preserve the v6 workspace for diagnosis and recovery evidence.

## MCP and `AGT-008`

The audit-ready SQLite launcher advertises exactly seven tools and one project resource:

- the accepted five: `studio_command_catalog_list`, `studio_project_read`, `studio_project_status_set`, `studio_source_register`, `studio_asset_define`;
- new: `studio_source_intake_commit`, `studio_source_review_propose`;
- resource: `studio://projects/{projectId}`.

`studio_source_intake_commit` has a distinct `source.intake.commit` scope so an old `source.write` grant cannot gain it accidentally. Both new mutations require the project object scope, command budget, immutable task/branch/grant HostBinding coordinates, and a live final attempt ledger; intake also validates and atomically charges `maxArtifactBytes`. Retry with the same logical idempotency key does not charge twice.

`source.review.decide` is owner-only and absent from MCP discovery. Agents receive neither local paths nor provider credentials. The intake tool claims an already staged project object and canonical artifact metadata; binary upload is not an MCP/JSON tunnel.

Accepted agent commands already create atomic semantic Activity. For denied/failed mutations after a valid HostBinding resolves trusted project/actor context, 2A stores one final redacted attempt and merges it into Activity. No `STARTED` or duplicate `COMMITTED` request row exists. If the final audit write fails, the attempted call fails closed. Missing/invalid bearer tokens and pairing failures occur before trusted attribution and remain redacted operational security logs.

## Evidence at candidate freeze

- 76/76 Node tests pass; the focused Checkpoint 2A suite is 11/11 and official MCP suite is 5/5.
- All ten JavaScript build/syntax targets pass.
- `git diff --check` is clean.
- Protected Checkpoint 1 evidence verifies with the unchanged manifest hash above and the production `better-sqlite3` adapter. The local exported workspace cannot prove Git commit ancestry; strict full-checkout provenance is delegated to GitHub CI.
- Legacy `source.register` application behavior is byte-for-byte unchanged.
- The CI workflow prepares a deterministic revision-4 Family Hygiene workspace plus one recoverable staged intake and one redacted denied attempt, then captures eight real-Chrome screenshots at 1440×900 and 1060×900: intake form, staged recovery, approved source, and Activity. The capture asserts loaded original preview, visible lifecycle/review/origin, Resume/Discard recovery, labelled/live form state, denied Activity, no browser/network errors, no horizontal overflow, and Header containment.

GitHub evidence for the candidate implementation commit:

- Actions run [`32521812841`](https://github.com/KlausUllrich/numberdroid/actions/runs/32521812841), Build workflow run 2011: root `build` and isolated `studio` succeeded; Pages was intentionally skipped for this local authoring service.
- The Studio job ran the full 76-test suite, build checks, strict protected Checkpoint 1A verification, and all real-Chrome captures from a full Git checkout.
- Browser: Chrome `151.0.7922.137` using DevTools protocol `1.3`.
- Checkpoint 2A artifact: `numberdroid-studio-checkpoint-2a-visual`, ID `9460863029`, 3,411,273 bytes, digest `sha256:ce78afb3321f703c257052d2d85ac40070899b5c4a738b0ce549787c1578f207`, retained through 2026-09-04.
- The coordinator inspected all eight artifact screenshots after the automated assertions passed. The two viewports show readable intake, recoverable staged state, the contained original preview and approval metadata, and the redacted denial in both Activity surfaces without a visual blocker.

Automated and coordinator evidence does not count as user approval.

## Known limits

- The two MCP mutations operate on a pre-staged intake. Checkpoint 2A does not advertise an MCP binary upload, intake-list resource, or source-detail resource; the host task/user must provide the staged intake ID and canonical artifact metadata. This avoids paths and binary tunnels but leaves richer agent discovery to a later versioned resource surface.
- Staged intake retention is explicit and indefinite until claim or discard; there is no automatic expiry or retention warning.
- The UI keeps retry keys for the current page session. After a full browser reload, durable staged records remain recoverable through **Resume**, and a completed unknown-outcome commit is visible from the project revision/source state.
- Original preview decodes the full verified source in the browser. Derivative thumbnails, zoom/pan inspection, and processing jobs are deliberately deferred.
- Source review commits to the accepted shared linear head. Isolated agent branches, proposal comparison, and merge/review dispositions remain Checkpoint 4 work.
- The local service remains loopback-only, single-user, and not an authenticated remote/team deployment.

## User verification

```bash
cd tools/numberdroid-studio
npm ci
npm test
npm run evidence:verify
npm run dev
```

1. Open `http://127.0.0.1:4317`, choose **Create / load demo**, and open **Sources**.
2. Import the pinned Family Hygiene PNG as **Human upload** with a stable source ID and name.
3. Confirm the original preview, `IMPORTED` lifecycle, `PENDING` review, 1254×1254 dimensions, and absence of invented provider metadata.
4. To exercise recovery, interrupt after staging or use a prepared staged fixture, restart, then choose **Resume** or **Discard**. Confirm the intake remains visible until one succeeds.
5. Choose **Propose for review**, then explicitly approve. Confirm `APPROVED_SOURCE` / `USER_APPROVED`. In a separate intake, reject with a reason and confirm it is terminal.
6. Open **Activity** and verify true actor/task attribution plus a redacted denied/failed agent entry when that scenario is exercised.
7. Pair an MCP host under **Scoped run** and confirm seven tools are discovered; verify that owner decision is absent and revoked/over-budget/wrong-scope calls do not mutate the project.
8. Restart with the same data directory and confirm source identity, preview, review, revision, and Activity remain unchanged.

## Decisions at the major gate

The user is asked to decide only:

1. accept or reject Family Hygiene as the first realistic Checkpoint 2 fixture;
2. accept or reject the intake/recovery, original-preview, lifecycle, and owner-review workflow;
3. confirm that 2A remains provider-free until provider/egress/credential/cost/reproduction policy is chosen;
4. accept Checkpoint 2A and authorize planning/implementation of 2B, or return specific findings for another 2A loop.

Until explicit acceptance, 2B is blocked and Draft PR #135 remains draft and unmerged.
