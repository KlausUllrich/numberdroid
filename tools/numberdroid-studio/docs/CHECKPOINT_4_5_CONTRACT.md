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
4. a shared top save bar names the active tool and keeps saved/dirty/conflict/read-only state plus explicit `Save changes` / `Discard changes` actions adjacent to the canvas;
5. the right dock contains tool options, purpose/settings, selection/layers/assets, and check/findings/lifecycle controls without replacing the canvas;
6. `Entrance`, `Surface`, and `Prop` remain distinct domain objects and commands but are editor tools for the same room version and canvas; `Purpose` and `Check` are dock panels, not canvas tools.

Every cell projects exactly one visible editor class: ordinary room floor, outside room, or blocked in room. The summary is a partition of the envelope rather than an inclusive “room cells” count. Pointer painting removes the coordinate from both sparse masks before applying the chosen class; the structured coordinate alternative rejects cross-list overlap before changing the draft. Visible placement/connector overlays cannot intercept paint input. The unified draft below supersedes the former save/discard barrier between shape edits and other tools; an unfinished save or unknown save outcome still blocks incompatible edits.

This projection changes no accepted room command, CAS, immutable-version, proposal, lifecycle, or agent-authority semantic.

### Responsive placement editing — approved direction, 2026-09-23

The earlier Move/Rotate autosave candidate (PR272) was integrated and tested,
but Klaus reported **“immer noch langsam”**. He then explicitly replaced the
save policy for **all Room Editor tools**: local edits, one top save bar, user-
chosen Save, and a full Room check before persistence. This supersedes both
per-action autosave and the earlier proposed persisted unchecked/check split.
Implementation and later human acceptance are separate from this decision.

#### Unified manual Room draft

- Shape painting, placements/rotation/clear, Surface Paint/Fill/overlap repair,
  entrance changes, room size and intent edit one local Room draft. Tool changes
  preserve it. No tool click may append a project/Room revision or auto-save.
- The shared top bar says `Unsaved changes` and offers standard-sized
  `Save changes` and `Discard changes`. Save is muted when content matches the
  captured saved base. Repeated moves retain final positions, not intermediate
  version history; moving back or adding then removing cancels that change.
- Save freezes one bounded complete edit set and idempotency key. The trusted
  service checks the combined final Room before atomically storing one Room
  version, project revision, findings, activity and replay receipt. It must not
  loop through the old commands or expose partially saved intermediate Rooms.
- Saved state remains immutable authority; the draft is a separate display
  projection. Old saved findings must not be described as checks of the new
  draft. Save runs the full check; saved DRAFTs may still contain findings under
  the existing policy. `Saved` never means validated, finalized or published.
- Finalize/Validate and owner proposal decisions remain separate explicit
  actions and cannot silently save or discard a dirty draft. Studio preview
  remains pinned to saved content; the UI explains when Save/Discard is needed.
- Discard before transmission restores the captured saved arrangement without
  writing. Definite rejection retains the unsaved draft and its explanation.
  Stale saved context requires explicit resolution, never silent rebase.
  Browser close, navigation and Refresh protect the draft; passive reads cannot
  overwrite it. Creation of Rooms/templates remains a separate explicit action.
- During the one save, editing is locked while pan/zoom remain available. An
  unknown result retains the exact frozen request/key; Retry repeats it without
  duplicate versions, and Discard cannot falsely imply that it did not save.
  After a confirmed write, interrupted confirmation retries only the read.
- Local rendering must not rebuild all placements and saved findings for every
  status notification. Verify input-to-visible feedback separately from Save
  duration, using mixed tools, representative history, 1440/1060 viewports,
  no-op/discard, concurrency, failed-save recovery and exact saved reopening.

The bounded command is `room.variant.editor.save`, local-human/owner-only like
the included owner-defined shape operation. Existing scoped agent commands and
MCP catalogs remain unchanged; this save bar grants no agent authority. Its
strict payload contains expected Room version, width/height, both cell masks,
intent, connectors, and explicit placement additions/moves/removals. Existing
placement pins/provenance remain server-owned; added placements use verified
exact pins and null direct-placement proposal provenance. Contradictory IDs,
client findings/lifecycle/fingerprints/authority fields are rejected. Each edit
list is bounded by 256 and the final Room retains its existing 256-placement,
32-connector and bounded-shape limits. No persistence schema or portable Room
format change is implied.

### Confirmed placement refresh

After a confirmed Move or Rotate, the editor may read only the affected Room
through the existing Room query. It adopts that projection only when the
captured project/Room context, command result, query revision, saved version,
fingerprint, exact asset pins and requested placement changes agree. A newer,
unavailable or mismatched result uses the ordinary authoritative project reload;
an uncertain POST retains the existing idempotency/recovery behavior.

The success path retains the actual canvas and cells, selection, focus and
viewport while refreshing placement imagery, Inspector coordinates, saved
findings and version labels. It invalidates stale in-flight reads and the old
Preview binding. This is confirmed saved state, never optimistic persistence;
the separately approved pending display projection must not replace this state.
Other Room commands keep their existing reload paths. SQLite summary projection
may use the already committed head without reading all historical snapshots;
the complete immutable history, public store return and transaction remain intact.

Current-only trusted project reads and Room queries may use an internal exact
head reader instead of decoding every historical project revision. It reads the
authoritative revision and reapplies the same live grant status as a full read;
legacy and task stores fall back to their complete-document reader. Move
execution resolves historical Asset pins from immutable authority. The first
responsive block may use a private owner-only shared-SQLite command context with
indexed replay/command-ID lookup and exact historical Asset reads instead of
decoding the complete ledger. It must preserve replay/collision/CAS/authorization
precedence, dry-run behavior and live grant overlays. Legacy, agent and task
stores retain the complete-document fallback. A partial document must never
masquerade as the full history. Its
atomic append may explicitly omit the unused document return; default callers
retain the complete return, and no transaction, replay or CAS check is skipped.
Passive status refreshes are cancellable and cannot resume their summary-to-full
reload chain or adopt a projection after a foreground Move supersedes them.
Explicit recovery reads remain authoritative. Only timer-driven refreshes are
cancellable; an explicit Refresh live status keeps its request, and Move/Rotate
waits until it finishes. Native performance evidence covers the complete
click-to-ready path with grown history. Delayed-response regression tests prove
the polling race separately; a completed native refresh is not overlap evidence.

### Room creation and current editor context

The approved 2026-09-22 [Rooms navigation design](ROOMS_NAVIGATION_DESIGN.md)
places **New room** and **New template** at the top of their collection tabs.
Opening Rooms starts at that collection; opening a saved Room enters the focused
editor with **Back to Rooms** at the upper left. Creation controls no longer
belong inside the current Room's dock. This supersedes their earlier compact
disclosure placement, not the command or state-protection semantics below.

Creating a Room must immediately align the selector, header, canvas and command
target with that exact saved Room. After confirmed creation and reload, verify
the new Room exists, clear the previous Room's interaction context, select the
new Room and render it without carrying old Room DOM state. Focus its heading
and bring the new Room header into view, even when collection filters would hide
it. A failed creation
or unavailable exact new head preserves the previous selection; it does not
select an unseen fallback. Dirty shape/review drafts and unresolved placement
or gesture state cannot be discarded implicitly by starting another Room.

An empty Rooms collection explains the two steps in plain language: create a
reusable **Room template**, then create an editable Room from it. Offer template
creation when none exists and Room creation when a template exists but no Room
does. Each creation action opens one focused form with contextual Back, readable
labels of at least 13px, entered text/numbers of 16px and a separate action row
whose label does not wrap. Explain that a new Room has no placed assets, retains
the existing default entrances and leaves other Rooms unchanged. Preserve list
filters, focus and scroll on return; protect unfinished forms and existing
editor drafts before leaving. These UI rules change no Room validation or saved
command semantics. Design approval does not establish production acceptance.

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
