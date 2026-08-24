# Numberdroid Studio — Checkpoint 3 Acceptance Record

- **Date:** 2026-08-23
- **Status:** explicitly user-accepted on 2026-08-24 through the combined Checkpoint 2C + 3 + 4 walkthrough
- **Branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` — remains open, draft, unmerged, and unreleased
- **Accepted prerequisites:** Checkpoints 1, 2A, 2B, and 2C
- **Published product candidate:** `262dfae62de284d88510f27a0e82d51fc5704b10`
- **Published CI/evidence:** run `32602341909`, successful rerun — root job `97102815563` and Studio job `97102815181` passed
- **Dedicated evidence artifact:** `9483317617` (`numberdroid-studio-checkpoint-3-evidence`), 915,094 bytes, `sha256:a6e2b5567d87d5e37fe6020ac6415d67b74f4c1497160e0516a8bca5d36be281`
- **Browser:** Chrome `151.0.7922.137` at 1440×900 and 1060×900

This record includes explicit user acceptance of the bounded Checkpoint 3 room and hallway workflow. Acceptance does not grant merge, release, provider, image-generation, Numberdroid/runtime/repository export, materialization, publication, level-composition, enemy/NPC/route, or general multi-branch authority. The offline, project-scoped portable Studio bundle remains the only accepted import/export boundary.

## Implemented outcome

Checkpoint 3 adds a generic room and hallway authoring slice without coupling Studio to Numberdroid runtime code:

1. immutable room/hallway archetypes and concrete variants retain exact dimensions, structural bands, connectors, intent trace, findings, lifecycle, and lineage;
2. a coordinate-visible layered canvas, exact-version asset palette, structured placement list, inspector, and linked findings provide equivalent visual and non-canvas control;
3. surface placement and set dressing validate deterministic bounds, rotation, macro coverage, collision/navigation, wall safety, tags, connector clearance, and passable access from authored metadata rather than pixels;
4. validation, warning disposition, finalization, and FINAL-to-DRAFT fork remain explicit owner-only operations;
5. the only agent room mutation is a bounded, task-bound, set-dressing-only placement proposal; owner decision/apply remains absent from MCP;
6. schema v10 stores normalized STRICT immutable room/proposal records with transactional migration, rollback, restart, rebuild, exact asset FKs, deep integrity, and tamper detection;
7. portable schema v2 preserves normalized room semantics, exact asset pins, findings, proposal decisions/application, final/fork lineage, and exact CAS closure without live authority or operational queues; roomless bundles remain canonical schema v1.

Official MCP 2026-07-28 discovery is exactly 19 tools and four resource templates when schema v10 room storage is live. The additive surface is `studio_room_placement_proposal_submit`, `studio_room_query`, and `studio://projects/{projectId}/rooms/{roomVariantId}`. Human direct editing, lifecycle, bundle, export, materialization, and publish controls are absent.

## Combined deterministic fixture

The fixture starts from the exact applied Checkpoint 2C Family Hygiene project. It creates one exact-slice prop through the asset workflow, a 4×3 room, and a 6×3 horizontal hallway. A task-bound agent submits three set-dressing additions through the pinned official MCP stdio server over a HostBinding. The owner accepts two safe prop placements, rejects the overlapping third placement with an explicit reason, and applies the accepted subset in one revision.

The room then records current warning dispositions, validates, finalizes immutable version 5, and explicitly forks editable DRAFT version 6. The published fixture is pinned to:

- project revision 26 and Activity count 27;
- two room/hallway variants;
- 14 exact `assetVersion:metadataVersion` placement pins and two connectors on the selected room;
- 26 current room findings and 29 inspectable proposed-state findings;
- APPLIED three-item proposal with two accepted items and one rejected item retained beside both deterministic overlap errors and the human reason;
- immutable FINAL v5 plus DRAFT fork v6.

## Portable-bundle proof

The published export → import → export proof records:

- project document SHA-256: `ea0a8b13bc8e3f0b9a99a0b01a5465f462b69d051d30de1bab5b4db12c46ee81`;
- manifest SHA-256: `52cfe0948aa923fa975ad2643370e0eab67aa568a2b40f10bbe7ad98e4fb471e`;
- five exact CAS artifacts;
- byte-identical canonical project and manifest documents plus identical manifest/CAS digests;
- imported full integrity: green;
- imported live grants, HostBindings, attempts, jobs/events, idempotency, intakes, and agent-access operations: zero;
- imported sanitized APPLIED processing histories: one;
- atomic publication into a new empty workspace: true.

## Verification ledger

- complete Studio Node suite: **243/243 passed** locally and in CI;
- JavaScript syntax sweep, build check, and protected Checkpoint 1A parity: passed;
- room domain coverage: defaults/bounds, strict shapes, intent, connectors, rotation, structural bands, macro coverage, collisions/navigation, deterministic findings, warning disposition, final/fork lineage, and proposal fingerprints: passed;
- application coverage: exact pins, per-item agent budget, authority redaction, set-dressing-only proposal enforcement, owner decision/apply, unresolved-proposal conflicts, validation/finalization/fork: passed;
- persistence coverage: fixed migration checksum, v9→v10 rollback/resume, STRICT normalized records, immutable versions, exact FKs, restart/rebuild, shared transaction faults, head-tamper detection, and portable round trip: passed;
- HTTP/MCP coverage: same-origin CSRF human routes, exact bodies, 19-tool/four-template discovery, private HostBinding authority, and owner controls absent: passed;
- browser evidence: four same-session captures plus DOM/observation records at 1440×900 and 1060×900, zero visual/runtime/network errors, zero horizontal overflow/header collision, exact canvas counts/pins, complete proposal diffs/findings/decisions, and responsive layout: passed;
- root repository test/build job: passed;
- first run attempt failure: invalid diagnostic evidence only — the existing Checkpoint 2A keyboard-opened-tab opener/referrer assertion failed before Checkpoint 2B/2C/3 execution; the successful rerun cleared it without a code change.

Product candidate `f9cf92f758c0885368ec2acd15547f343a9d926f` is superseded because independent screenshot/DOM review found that move proposal items were visually mislabeled as removals and affected proposal findings were not attached to their item. Candidate `262dfae62de284d88510f27a0e82d51fc5704b10` repairs the review, enforces set-dressing-only agent proposals, and adds proposal-focused browser evidence.

## Combined 2C + 3 user walkthrough

1. In **Asset Library**, confirm the three applied Family Hygiene V2 surfaces retain ordinal slice labels, exact previews/provenance, and the rejected fourth asset proposal item.
2. In **Rooms**, switch between the room and hallway, inspect exact palette versions, grid coordinates, layers, connectors/clearance, structured placements, and linked findings.
3. Inspect `proposal.room.gathering-table`: all three complete diffs remain visible; two safe props are accepted; the overlapping prop shows both collision errors and its human rejection reason.
4. Confirm the Activity ledger records the official-MCP agent submit, owner decision/apply, warning disposition, validate, finalize v5, and fork v6 without granting the agent lifecycle authority.
5. Review the portable-bundle proof and confirm exact semantic/CAS closure with zero imported live authority or queues.

## Combined-gate acceptance — 2026-08-24

The user completed the room and hallway walkthrough and accepted Checkpoint 3, including exact asset pins, connector and placement semantics, deterministic findings, the retained rejected set-dressing proposal item, owner-only lifecycle, FINAL version 5, and the explicit DRAFT version 6 fork.

Acceptance does not claim that the current authoring UI is the final designer workflow. The user found the technical structure difficult to read, could not see a clear human/agent room-building flow, and requested explicit irregular-room support. Checkpoint 4.5 must provide guided construction and define cells outside the room as `VOID` separately from in-room but impassable `BLOCKED` cells before changing room persistence or validation semantics.

Final acceptance-head run `32673522709` passed the complete 266-test Studio suite and published Checkpoint 3 artifact `9502074888` (1,034,936 bytes, `sha256:a2aa0bfacc3971e610ea0b9b1fd9269cc8e75990752e2049a07032b60cc9eaa3`).

## Gate disposition

Checkpoint 3 is explicitly user-accepted as of 2026-08-24. PR #135 remains draft, open, unmerged, and unreleased pending the documentation closure, final CI, and explicit merge decision.
