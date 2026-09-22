# Numberdroid Studio — Approved Surface design / shutdown resume

DATE: 2026-09-22
REPOSITORY: `KlausUllrich/numberdroid`
STATUS: **Surface design approved; user requested session close; implementation not started**
BASELINE MAIN HEAD AT CREATION: `105311b8f0e552acc14ede99b71d010f20db5d1d`, tree `b56598ac9268fe77e56c64cbd31dba2fb81bf5d8` (pre-handoff baseline; re-resolve current main)
BASELINE CI / PAGES STATE: PR #266 merged; exact-head Build2521/run35743763909 and post-merge Build2522/run35743969147 SUCCESS; documentation-only gates, Studio/root/Pages/Windows skipped
PRIMARY RECEIVING ROLE: Engineer / Runtime Developer for the approved bounded Surface-authoring batch
SECONDARY / TRIGGER ROLES: Product / Designer for deviations; QA / Integrator / Release; security/authority, persistence/idempotency, Room semantics and interaction/accessibility reviewers
NEXT MILESTONE / TASK: Resume the retained projects safely, implement the approved Surface batch, then provide one bundled human test

## Decision and exact pause point

Klaus said: **“nice, approved. However, we need to close the session now.
Please prepare for server shutdown”** after trying the clickable Surface-tools
mockup. The design gate is satisfied. Do not ask for it again. The shutdown turn
records acceptance/continuity only; no Surface production implementation starts
before the next session. No server termination is claimed by this handoff.

Current design authority is
[Surface Authoring Design](../../../tools/numberdroid-studio/docs/SURFACE_AUTHORING_DESIGN.md).
The approved mockup is retained at
`/home/klaus/.bb/thread-storage/thr_frvv8dkm74/surface-tools-proposal.html`.
It is a simulation, not production. Evidence copied outside `/tmp` to
`/home/klaus/.bb/thread-storage/thr_frvv8dkm74/surface-authoring-evidence-20260922/`
contains normal-mode timing results, scratch harnesses, mockup screenshots and
browser/accessibility results. Harnesses still reference their original scratch
locations; adapt them to a new unique fixture, never a retained working project.

## Required reading / role transition

Verify remote main/tree, open PRs and Actions through the GitHub connector.
Read the complete Universal Bootstrap from `AGENTS.md`, then the Engineer route
and the trigger-relevant review/verification policy. Read these current owners:

1. `tools/numberdroid-studio/docs/START_HERE.md`
2. `tools/numberdroid-studio/docs/VISION.md`
3. `tools/numberdroid-studio/docs/AUTHORING_PRODUCT_MODEL.md`
4. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
5. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
6. `tools/numberdroid-studio/docs/SURFACE_AUTHORING_DESIGN.md`
7. `tools/numberdroid-studio/docs/CHECKPOINT_3_CONTRACT.md`
8. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_CONTRACT.md`
9. `tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md`
10. `tools/numberdroid-studio/docs/MCP_CONTRACT.md`
11. `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`
12. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
13. `docs/architecture/ARCHITECTURE.md`
14. Current Surface entry in `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
15. This handoff last; register the actual task route using `CODEX_CONTEXT_RETENTION.md`.

Add the current persistence and task-authority contract bundle before altering
those boundaries; route through `ROLE_ENTRYPOINTS.md`, do not infer authority
from this snapshot. Full art-production/generation, remote operations, later
A5/A6 and 2.5D design are not initially required. They become triggers only if
separately scoped work enters them. Existing approved art may be reused without
new art generation. No agent credentials, grants or pairing are authorized here.

Product has resolved the interaction direction. Engineering now owns the
bounded semantic implementation; return to Product only for a material design
deviation. Klaus owns the later production acceptance, not the technical reviews.

## Accepted, implemented and still open

- Accepted/frozen: VT-012, VT-014, VT-023, VT-024, VT-025 and the bounded Rooms
  collection navigation/earlier live passes remain as their current records say.
  Surface mockup approval is now additional **design approval only**.
- Implemented: Rooms navigation PR #260, indexed-PNG input PR #262, and Room
  finding identity/portable-history compatibility PR #264 are integrated with
  selected CI and post-merge green. These are not new overall milestone passes.
- Engineering proof: real Family Table input, furnished real-art Room and
  isolated semantic agent/feedback/subset/revocation/restart passed. Agent proof
  used a disposable project, not the live pilot or sandbox.
- Planned, not implemented: new Surface paint/replace/fill/randomization/undo
  and performance repair. Existing production still has broad refresh and can
  save overlapping Surfaces in a Draft.
- Open: production implementation/verification and Klaus's bundled live result.
  VT-001 remains in its recorded REVISE/deferred-live state. No A5/A6, runtime
  activation, publication, release or operational-access authority follows.

## Retained live projects — do not regenerate fixtures here

Read-only checks around 17:56 UTC found both servers running. Browser-only
unsaved edits cannot be established from server snapshots; ask the user to save
them before shutdown. Saved project directories are outside `/tmp`.

### Permanent Family room pilot, port 4321

- Directory: `/home/klaus/Numberdroid-Studio/family-room-pilot`
- Project: `project.working.e70a5cca-ef3d-4534-b7bd-4e1ff97be86b`, revision **34**.
- Room: `room:family-room-01:df8ca5f5`, **Family room 01**, v17, 4×4,
  16 placements, zero ERROR findings. No grants.
- SHA256 of `JSON.stringify(snapshot)`:
  `9757ea9875e92cba62870549df813df1381e3c328789ea3ddfe85da5539752b0`.
- Last terminal: `term_fbzabtishb`; URL https://klaus-bb--4321.getbb.app.
- Started 10:20 UTC with an eight-hour bound. Backend predates PR #262/#264;
  restart from the verified latest checkout to load them. Do not infer code
  freshness from this old terminal title.

### Real-art sandbox, port 4322 — includes newer user edits

- Directory: `/home/klaus/.bb/thread-storage/numberdroid-real-asset-sandbox-20260922.A6l86Q`
- Project: `project.working.839b66c8-b406-4d36-870c-9dd6dd592edf`, revision **111**.
- `room:family-table-furnishing-proof:c343bac8`, **Family table furnishing
  proof**, v49, 6×6, 39 placements, two ERROR findings.
- `room:family-room-real-artwork:cd1ab40e`, **Family room — real artwork**,
  v41, 6×6, 37 placements, zero ERROR findings. No grants.
- SHA256 of `JSON.stringify(snapshot)`:
  `c0acc3f985846b8c21f7bc8651014324e74f5d3d1ddb15e1642a735343d50c7e`.
- Last terminal: `term_j9v5ti6qae`; URL https://klaus-bb--4322.getbb.app.
- Started 12:29 UTC with an eight-hour bound. Backend includes indexed PNG but
  predates PR #264. `start.mjs` beside the data safely opens this exact existing
  working project. Its old hard-coded candidate log is historical, not current
  code identity; verify the source checkout independently.

**Never restore sandbox r15/r67/r87 or Room v5/v25 merely to match old QA.**
The v49/r111 state is later work and must survive. A later revision is also not
an error: re-read and record, do not reset. No live-database file copy was made
while the writer was running; this record is not a backup claim.

Safe shutdown: save desired browser edits, then `q` + Enter in each Studio
terminal (or Ctrl+C), wait for its stopped message, then shut down BB/the host.
Do not kill arbitrary Node processes or delete working directories. The agent
left termination to Klaus so unsaved browser work was not interrupted.

Safe restart: verify saved directories/working-project manifests, local source
tree and port ownership. Reopen the existing project using the launcher
`--open-project` option, select the verified current worktree dynamically, and
use `--base-port 4321` or `4322`; **never** select a fresh fixture profile for
these directories. Use `--offline` after connector-based main verification to
avoid a CLI remote Git read. Alternatively use the retained sandbox `start.mjs`
after verifying its source imports. Start a bounded BB terminal, check readiness,
re-expose the actual port with `bb connect expose`, and give its returned URL.
Recheck exact saved Room heads and no new grants before inviting a live test.

## First bounded implementation block

Implement the approved Surface batch, not another mockup-only cycle:

1. Profile and remove unnecessary project-wide reload/Room rebuild from painting
   while preserving confirmed revision checks, active brush, viewport, dirty
   shape guards, pending feedback and exact unknown-result recovery.
2. Replace instead of stacking; no-op identical exact placements. Mark existing
   overlaps and require explicit keep/remove choices, including whole footprint
   consequences. Never remove Library assets or unrelated Props/Items.
3. Rectangle/additive selection, whole-room and selected fill; empty-only versus
   replacement; compatible pinned pool and legal cardinal rotation; stable exact
   preview, explicit Shuffle, Apply/Cancel and one-step undo.
4. Use one bounded semantic atomic operation, not per-cell loops or separate
   remove/add commits. Current add/remove commands each cap at 64; final Room
   cap is **256 total placements**, across layers, not 256 cells. Count the
   post-replacement result and never bypass a limit with chunked commits.
5. Respect whole rotated footprints, usable-domain origin, VOID/structural
   bands, BLOCKED-cell coverage, boundary/continuity metadata and exact pins.
   No free mixing of 2×3/3×2 footprints without a designed packing policy.
6. Keep authority/revision/idempotency admission and agent-first API/MCP
   mapping explicit. Undo is a new immutable compensating version, head-gated;
   it does not rewrite history. No new agent grants are needed for development.

Principal paths: `tools/numberdroid-studio/apps/studio-server/public/app.js`,
`public/styles.css` below the same server, `apps/studio-server/src/server.js`,
`packages/domain/src/room-definition.js`, `packages/application/src/studio-service.js`,
and the command catalog/MCP/persistence consumers found by current source search.
Inspect actual paths and tests; do not rely on historical line numbers.

Measured baseline: five normal-mode fresh-fixture clicks each made six requests
and two workspace replacements. POST headers 6.2–11 ms, final replacement
25.6–37.5 ms after click. At fixed five placements, history r16→51 increased
POST16.4→51.2 ms, five-read batch14.4→79.5 ms, payload35,450→208,320 bytes.
Multi-second delay was not reproduced. Do not claim remote-tunnel, mature-project
or overlapping-passive-poll performance from that small local fixture.

## Verification, progress and definition of done

Classify production L3 and select current trigger-relevant checks/reviewers.
Use subagents for required independent reviews, each with a bounded deadline.
Start focused, checkpoint/publish exact task-owned state early, then the required
Studio/browser/recovery gates and actual-diff CI. Windows is opt-in only on
Klaus's explicit request; none is requested for this next run.

Use fresh unique disposable fixtures for mutation/failure tests. Bundle human
checks for rapid paint, replacement/overlap, both fill scopes/policies, mixed
assets/rotations, preview/shuffle/undo and exact saved Preview. Engineering must
also cover stale/failed/unknown results, multi-cell fit and capacity, including
safe closure of DB/browser/server writers. Do not subject Klaus to each small
technical repair test or rerun unrelated accepted checks.

Done means implemented approved scope, selected evidence and blocker-free
independent reviews, unchanged exact-head CI, authorized merge and observed
post-merge CI, followed by a clear bundled Klaus test. Source green is not his
acceptance. Production Preview stays approximate, read-only and engine-neutral.

Final receiver protocol: verify main/Actions; execute bootstrap and the current
role route; inspect exact saved projects/source; report conflicts; state the
bounded L3 scope and proceed with implementation. The mockup gate is already
satisfied. Resume only when Klaus returns; no background implementation is
authorized during this requested session pause.
