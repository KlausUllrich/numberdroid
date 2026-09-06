# Checkpoint 4.5 Contract — Designer Workflow and Preview Usability

Status: implementation contract amended on 2026-08-24 after live user feedback and three independent repair reviews; user acceptance remains separate.

This checkpoint is bounded to the designer workflow requested by the combined gate handoff. Checkpoints 1–4 remain accepted. Checkpoint 5 export, materialization, publication, provider-backed generation, branch-local image jobs, and any expansion of agent authority remain out of scope.

## 1. Task workflow

1. The Tasks workspace opens on a normal task list. Its primary action is `Create task`.
2. Task creation is a separate focused step with `Back to tasks`. Cancelling it mutates nothing. A successful create selects the new task and opens its detail.
3. One selected task is presented as one state flow: current state, next actor, practical consequence, available action, progress, review, completion, and undo. Review is not a separate peer card.
4. Primary copy says who acts next and what the decision changes. Branch, grant, command, revision, CAS, policy-disposition, and raw capability identifiers are secondary technical detail.
5. Conflict completion remains visibly disabled. A programmatic click on the disabled action opens no confirmation dialog. Since this checkpoint adds no rebase operation, the truthful recovery is to end the task without applying its changes and create a new task from the current project.
6. Existing CP4 pause, resume, review, merge, revert, atomicity, grant revocation, and immutable history semantics remain unchanged.
7. An undo action is offered only until the corresponding merge has been reverted. Real persisted event names are mapped to human language; unknown names remain available under `Technical details`.
8. A recorded semantic conflict becomes the dominant task-detail state before
   task facts or history. It names the affected object, explains that applying
   the result could overwrite newer project work, and recommends ending the
   task without adding changes before deliberately creating a replacement from
   the current project. The blocked merge action is not presented as an
   available choice; ending and saving review intent state their different
   consequences directly.
9. One-line comparison, event, command, object, and revision metadata appears
   as compact secondary text beside the item it explains. A full-width
   disclosure is reserved for genuinely multi-line identifiers, permissions,
   payloads, or diagnostics; essential problems, actions, and consequences
   never depend on opening technical details.

### 1.1 Exact-review feedback candidate — 2026-09-06

The [task review feedback contract](TASK_REVIEW_FEEDBACK.md) extends the existing
owner review with a required nonblank Request Changes summary (maximum 4,000
characters), optional per-item reasons (maximum 2,000), and mutation-time review
version comparison. The UI always pins the rendered review version. Historical
Accept/Reject payloads without feedback remain compatible; Request Changes or
new feedback requires the expected version. Trusted service context supplies
the author and timestamp of immutable `review.feedback`; existing review JSON
versions require no SQL migration.

Current editable non-conflicting reviews appear after Current step and any
processed-asset preview, before facts/timeline. Conflict-first placement stays
intact. Draft text, choices, focus, selection and scroll survive only a
compatible exact review version. Superseded reviews and saved feedback remain
read-only history. Resume permits continued work; Studio does not start an
agent. An unknown response requires reloading and inspecting the current review
before another write, without claiming idempotent replay. Existing owner,
policy, Candidate, derived-child and A1.7 read-only restrictions remain binding.
This extension is an implemented candidate; live acceptance and complete CI
remain separate.

## 2. Frozen minimum useful prop preview

The preview is a deterministic browser projection. It creates no bitmap, persistence record, job, provider call, or inferred semantic fact.

1. The exact project-scoped, digest-checked pinned slice is displayed uncropped and without distortion on a transparency checkerboard.
2. The stage makes the authored tile footprint visible and states `Occupies W x H cells`.
3. The authored anchor is marked separately from the placement top-left.
4. Rotation choices come from the authored rotation policy and can be inspected with buttons and keyboard focus.
5. Collision and navigation are overlaid from typed metadata and explained as `Blocks movement` or `Can be crossed`.
6. Attachment and wall suitability are stated in plain language.
7. The same useful preview appears before owner proposal acceptance and before human room placement.
8. Slice, digest, asset/metadata versions, lineage, raw findings, and rule identifiers remain in closed technical detail when healthy. Missing, unsupported, or failed imagery remains inspectable and rejectable, but the current-session accept/place control is disabled with an actionable explanation.

## 3. Persistent room editor

The live gate rejected the original six canvas-replacing steps. The room workspace follows the established image-editor model instead:

1. one room header keeps room identity, lifecycle, and saved version visible;
2. one persistent central canvas remains visible while the active tool or dock panel changes;
3. a left toolbox exposes mutually exclusive `Select`, `Room floor`, `Outside room`, `Blocked in room`, `Entrance`, `Surface`, and `Prop` tools with icon, label, tooltip, keyboard reachability, and pressed state;
4. a contextual options bar names the active tool and keeps saved/dirty/conflict/read-only state plus explicit shape save/reload actions adjacent to the canvas;
5. the right dock contains tool options, purpose/settings, selection/layers/assets, and check/findings/lifecycle controls without replacing the canvas;
6. `Entrance`, `Surface`, and `Prop` remain distinct domain objects and commands but are editor tools for the same room version and canvas; `Purpose` and `Check` are dock panels, not canvas tools.

Every cell projects exactly one visible editor class: ordinary room floor, outside room, or blocked in room. The summary is a partition of the envelope rather than an inclusive “room cells” count. Pointer painting removes the coordinate from both sparse masks before applying the chosen class; the structured coordinate alternative rejects cross-list overlap before changing the draft. Visible placement/connector overlays cannot intercept paint input. A dirty shape draft blocks all other room mutations until it is saved or discarded, because the existing APIs do not offer an atomic mixed shape/placement/resize commit.

This projection changes no accepted room command, CAS, immutable-version, proposal, lifecycle, or agent-authority semantic.

## 4. Irregular-room semantics

### 4.1 Versioned value

`width x height` remains the bounded authoring envelope. A room variant adds two optional sparse, row-major sorted, duplicate-free coordinate arrays:

- `voidCells[]`: cells outside the room.
- `blockedCells[]`: cells that belong to the room but are statically impassable.

Each coordinate is exactly `{ x, y }`. Both arrays default to empty. Empty arrays preserve the accepted rectangular CP3 behavior. The sets must be disjoint, inside the envelope, and leave at least one non-VOID room cell. Non-VOID cells must form one four-neighbour component.

### 4.2 VOID

VOID is outside the room:

- excluded from the accepted usable structural-surface domain;
- excluded from navigation;
- cannot be intersected by a placement envelope or collision footprint;
- cannot be used by a connector aperture or its inside clearance;
- creates a room boundary for authored wall attachment and wall-safety checks.

### 4.3 BLOCKED

BLOCKED belongs to the room:

- remains part of exact structural-surface coverage whenever it lies inside the accepted usable domain after structural bands are subtracted;
- is excluded from navigation;
- cannot be intersected by set dressing;
- remains distinct from asset-authored collision and `navigation.effect`.

Traversable cells are non-VOID cells minus explicit BLOCKED cells minus placement-derived collision cells.

### 4.4 Coverage, connectors, and navigation

1. Every non-VOID cell in the accepted Checkpoint 3 usable surface domain, including BLOCKED, requires exactly one structural-surface cover. Structural bands remain excluded before coverage is evaluated, and VOID requires zero coverage.
2. A surface macro must lie wholly in non-VOID cells inside that usable domain. A set-dressing footprint must lie wholly in ordinary, non-BLOCKED room cells.
3. CP4.5 connectors remain on the four outer envelope edges. Apertures and inside clearance may touch neither VOID nor BLOCKED. Connectors on internal VOID boundaries are follow-up scope.
4. Connector reachability uses traversable cells and preserves the accepted deterministic four-neighbour flood fill.

## 5. Authority and commands

`room.variant.shape.set` is a new human-owner-only semantic command. It atomically replaces the complete `voidCells` and `blockedCells` masks on an editable DRAFT using both project revision CAS and expected room-version CAS.

The command is absent from both ordinary and task-bound MCP tool catalogs. Existing agent room operations continue to validate against the owner-defined shape. No per-cell revision is created; the UI stages a complete local mask and saves it once.

## 6. Persistence and portable compatibility

1. SQLite migration `0012` adds a STRICT normalized immutable child table for versioned room shape cells. Existing v10/v11 room rows and fingerprints are never rewritten.
2. Missing shape data reads as two empty arrays with rectangular semantics.
3. Projection rebuild, restart, integrity verification, transaction faults, backup, and immutable-history checks cover the new rows.
4. Rectangular projects retain canonical portable schema v2 output. Projects containing a non-empty shape use schema v3. Import accepts v1, v2, and canonical v3; an empty-mask v3 document is noncanonical and rejected. Canonical v3 round-trips exactly and transfers no authority, jobs, tasks, or live branches.

## 7. Acceptance evidence

Candidate verification must demonstrate:

- Tasks starts with list plus `Create task`, then a focused composer and a single task state flow.
- Every task state names the next actor and consequence; technical details are closed by default.
- Conflict completion stays disabled and opens zero confirmations; undo disappears after revert.
- A representative real prop preview visibly distinguishes image, tile footprint, anchor, rotation, collision, and navigation at 1440x900 and 1060x900.
- The user can construct a rectangular room with empty masks and an irregular room containing both VOID and BLOCKED cells.
- VOID and BLOCKED are visually and textually distinct, keyboard reachable, and not distinguished by colour alone.
- Shape drafts, the active tool, canvas scroll, and keyboard focus survive passive refresh; a concurrent version change produces an explicit non-empty conflict.
- Real pointer input above visible placements paints `room floor → outside → blocked → room floor` immediately, keeps the masks disjoint, and partitions the envelope exactly.
- Tool and Purpose/Check dock changes keep one canvas visible at 1440x900 and 1060x900; only the canvas scroller may overflow horizontally.
- CP1–4 domain, application, persistence, HTTP, MCP, adversarial, evidence, Windows, and root build gates remain green.

Passing automation produces a CP4.5 candidate only. It does not record user acceptance.
