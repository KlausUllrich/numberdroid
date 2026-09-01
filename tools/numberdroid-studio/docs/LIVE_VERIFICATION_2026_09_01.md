# Numberdroid Studio live verification — 2026-09-01

Status: **binding live-test record; VT-001 and VT-011 require revision; VT-012 accepted**

Tester: Klaus, Linux desktop Chrome. Baseline: `main` initially
`6aec62e9f7f4e286be366d84524d3f37fcc5c99b`, tree
`751aa19dd4bf2bd4bf9590160fb0cc9990440c5c`. Studio suite: 678 tests,
674 passed, four expected skips, zero failures. Protected evidence verified.

## Decisions

- VT-000: PASS.
- VT-001: REVISE. Core task and room persistence works, but functional and
  usability defects block acceptance.
- VT-011: REVISE. Task-local processed-result review is safe, but the correction
  loop is not understandable or connected to a real harness.
- VT-012: USER ACCEPTED 2026-09-01. Its detailed acceptance remains in
  `O1B_BACKUPS_UI_STATUS.md`.
- VT-002 and VT-004–VT-010 remain later contract reviews; VT-003 remains
  blocked; VT-013 remains a separate deliberate private-host deployment gate.

## VT-001 verified behavior

PASS: all eight navigation entries; protected baseline/restart; task conflict
prevents unsafe merge; end-without-changes; completed-task undo; room floor,
outside and blocked painting; layer toggles; save/reload/browser persistence;
surface palette, selection and ordinary placement; prop placement; clickable
findings selecting their object.

### P0 functional defects

1. Surface painting under an existing Prop is blocked because the Prop receives
   the click. Surfaces and Props must remain independent layers; Surface mode
   must target the underlying cell without changing the Prop.
2. Rotated multi-cell Prop preview, demonstrated by Transfer Apparatus at 90°,
   scales/crops incorrectly.
3. A saved DRAFT can retain errors without a sufficiently prominent saved-with-
   errors result or navigation to those errors.
4. Task overview does not expose a conflict/action-required state that is
   visible only inside task detail.

### P1 editor usability

- Use distinct semantic badges: attention color (for example yellow) for
  “Waiting for your review”; calm completed color for “Task completed”; clear
  problem state for conflicts.
- Replace fixed 100/200 controls with 100–1000% zoom slider plus Fit; scale
  canvas labels; add middle-mouse pan (optionally Space-drag).
- Provide placement ghost/footprint before click.
- Directly select, move, rotate and delete any canvas object; use a shared
  inspector, preferably a resizable area below the canvas.
- Prevent `Save intent trace` overflow at narrow desktop widths.
- Keep finding-list scroll/context when selecting successive findings.
- Translate findings into plain language, focus the exact target, and enlarge
  remediation text. Safe deterministic Auto-Fix with preview/diff is low
  priority.
- Add game/runtime Preview.
- Move compact layer visibility (eye icons for Surfaces, Set dressing,
  Connectors) below the toolbox.
- Allow iterative room resizing.
- Add scalable Prop search/filter; treat Triggers as a likely separate tool.

## Authoring direction confirmed by Klaus

The primary workflow is agent-first: Game Design and section-06 Level Design
inform natural-language Level and Room Design prose; an agent translates prose
into a separately editable deterministic Program View; generator/compiler
creates rooms and level; the human reviews, edits and pins overrides. Regenerate
must preserve pinned work and show preview/diff. Prose remains human authority;
the Program View remains editable. Fine-grained sentence-to-program provenance
is low priority.

## VT-011 findings

PASS: processed draft remains task-local; preview/fallback and missing-detail
hierarchy are visible; Review current result opens one pending item; Request
Changes persists a decision; no result enters project/Main.

REVISE:

- Request Changes has no required feedback field or per-item comments.
- “Let agent continue” only changes state in the fixture; no agent is started.
- After resume, old review text/decision remains visually ambiguous and
  “Waiting for your review” conflicts with the implied agent-working state.
- UI does not distinguish agent blocked, continuation authorized/waiting for
  harness, agent run active, and new revision submitted.
- The product must not imply a live agent received feedback until a harness
  exists.

Future bidirectional task/harness direction is recorded in
`FUTURE_HARNESS_ARCHITECTURE_DISCUSSION.md`.

## VT-012 acceptance summary

Unlock, Create, Verify, Recovery-test, Restore-as-copy, restart/session
invalidation, durable state, deliberate missing-backup failure, restored health,
keyboard focus and responsive layouts passed. Restored copies remained inactive.
Low priority: an open Technical details disclosure closes after F5.

## Incidental local finding

An accidental root `npm run dev` materialized 13 untracked PNG outputs and
failed Transfer Apparatus grounding-shadow drift validation with SHA-256
`7d4c55eb1346195278ac9c2aaa816f1ab1a531d3dc8d29c8063e0dc8462668f8`.
Those files were neither deleted nor adopted. Future engineering must use a
clean worktree from verified remote main and diagnose this separately.

## Next sequence

1. record this evidence and statuses on main;
2. implement a bounded L3 Room Editor repair slice beginning with Surface-under-
   Prop, rotated preview, visible error/action state and responsive overflow;
3. follow with zoom/pan/ghost/direct manipulation and Preview in coherent slices;
4. resume private A4c Level Candidate work without widening MCP, remote,
   repository, materialization, publication or release authority.
