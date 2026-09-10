# Animation Clip Editor — Approved Design

Status: **DESIGN APPROVED — 2026-09-10; production implementation and its live gate remain separate.**

Klaus passed the base animation workflow mockup, then requested contextual cut
editing and ping-pong playback. After those extensions, his explicit final result
was **“all pass”**. This document records that complete approved experience.

It specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md), reuses
the [Cutter design](CUTTER_EDITOR_DESIGN.md) and [Assembly design](ASSEMBLY_EDITOR_DESIGN.md),
and follows the [current task router](START_HERE.md). Existing production source
supports static PNG-backed components; this design does not claim that animation
commands, persistence, review or Assembly playback are already implemented.

## Goal and workflow

Prepare reusable animation content without exposing a game-behavior editor.
The human path is saved source cuts → one Animation asset → a component's
presentation state in an Assembly. An agent authors the same semantic content
and submits a reviewable result; owner feedback is readable by the next agent.

- Select saved cuts and create a working clip. The source remains available.
- Group ordered frames inside one Library asset. Individual frames remain
  addressable and inspectable without becoming top-level Library cards by default.
- Give the clip a name, order its frames, define timing and align their artwork.
- Own human Save adds or revises the Animation asset directly. It does not require
  the human to review the same work again. Agent changes retain owner review.
- Save a clip version before using that version as an Assembly dependency.
  Visiting a source/cut editor does not require saving the animation first.

The demonstration uses a coffee-machine display and one image sheet. These are
examples, not mandatory names, states, dimensions or source-count restrictions.
An incomplete but valid working clip may remain useful and evolve through later
versions; technical invalidity must not be disguised as optional polish.

## Clip editor and frame organization

Use a stationary preview, the familiar left tool rail, a horizontal frame strip,
and a contextual inspector with Timing and Alignment views. Keep the preview,
playback controls and useful frame thumbnails visible together on desktop.

- Show full frame previews at consistent thumbnail sizes, with names and timing.
- Select a frame from the strip; selection pauses playback on that frame.
- Reorder with drag-and-drop and accessible Earlier/Later actions.
- Add saved cuts, duplicate a frame occurrence, or remove an occurrence. These
  operations preserve the reusable source cut and other uses of it.
- Undo/Redo restores meaningful clip edits, including ordering, timing and frame
  references. Frame identities remain distinct when a cut is reused.
- Retain the zoom slider, Fit and 100% view. Validation occupies reserved space;
  errors and inspector changes must not move the canvas or its active transform.

The inspector and the visible paused frame must agree. Pausing through Timing,
Alignment or source editing selects the frame currently displayed before an edit
can apply. During playback, the playhead can advance without moving unrelated
controls or replacing the user's editing context.

## Timing and playback modes

Provide one Playback dropdown, plus a default frame rate and optional per-frame
duration overrides. An override holds that frame for its authored duration without
requiring duplicate images. Playback is inspection state, not a content mutation.

| Mode | Example with four authored frames |
| --- | --- |
| Play once | 1 → 2 → 3 → 4, then hold the final frame |
| Loop | 1 → 2 → 3 → 4 → 1 → … |
| Ping-pong | 1 → 2 → 3 → 4 → 3 → 2 → 1 → … |

Ping-pong reuses frame references; it does not add duplicate frame records. Each
visit uses that frame's duration. Endpoints appear once at each turn, with no
accidental extra hold. A one-frame clip stays on that frame; a two-frame ping-pong
clip alternates. Report cycle duration truthfully for the selected mode.

Provide Play/Pause, previous/next frame and a scrub control. Frame selection and
scrubbing address authored frames; selecting one starts from its forward visit.
Pausing and resuming ping-pong retains the current inward/outward playback phase.
Playback of a newer saved clip version must not silently replace an older version
already selected by an Assembly.

The mockup's input ranges and fallback timing are prototype constraints. A
production contract must define resource limits, numeric precision and invalid
input behavior deliberately rather than copying illustrative limits blindly.

## Shared alignment

All frames use a shared clip canvas and anchor. Per-frame image offsets align
cuts with different origins or extents without rewriting their source pixels.
Changing a selected frame's offset leaves other frames alone. Shared canvas and
anchor controls have visible guides and explicit coordinate labels.

Playback settings and timing do not define movement blocking or gameplay
collisions. The existing placement/blocking contracts retain their authority;
frame-dependent physics is not introduced by this design.

## Contextual single-cut editing

The selected frame has direct **Edit source cut** and read-only inspection actions.
Source inspection shows the cut, its version and the original sheet. Cut editing
opens in the same tab, with a clear **Back to animation** route.

Retain the complete animation draft while visiting the cut editor: frame order,
names, timing, playback mode, alignment, selection, Undo/Redo and compatible
focus/scroll/zoom. No preliminary animation Save is required.

The contextual cutter shows the original sheet and the selected cut. Use exact
source-pixel bounds, independent edge/corner handles, movement, cut naming, Fit,
100% and zoom. Edge handles change only their respective axis. Keep its canvas
fixed during gestures and validation. A revised-cut preview makes the result clear.

**Back without applying** returns without changing the animation's frame reference
and retains the unfinished cut draft for reopening. Invalid or incomplete cut
coordinates remain editable but cannot be applied as a valid image. Saving an
otherwise valid animation must not silently apply a pending cut draft.

**Use revised cut** saves a new cut version, or reuses the exact matching revision,
and updates the animation draft. Where the cut occurs more than once, offer:

- **This frame only**;
- **All uses in this animation**.

Do not show that extra choice when it has only one use. Applying to all uses is
explicit and includes frames pinned to different versions of that same cut.
Other saved clips and Assemblies retain their existing exact references.

Preserve artwork alignment when the crop origin changes. For each affected frame,
adjust its image offset by the new source origin minus that frame's own pinned
old source origin. Keep its name, timing, identity, shared canvas and shared anchor
unchanged. This prevents trimming from introducing unintended animation jitter.

Animation Undo restores the former frame pins and offsets. The separately saved
cut revision remains available; Undo must not erase shared source history.

## Assembly presentation and version use

An Assembly component can use an image, a saved Animation version or no content
for a named presentation state. The coffee-machine example shares its body and
uses the display clip while Brewing, with still presentations for Idle/Ready.
The cup remains a separate component.

Changing Graphite/Copper must retain the selected state and playback phase.
Saving a revised clip does not retarget an existing Assembly binding; selecting
the newer version is explicit. Draft clip edits remain separate from the saved
version being previewed by the Assembly.

Studio authors and previews order, timing, repetition, alignment and references.
The game decides when a clip starts or stops, when brewing completes, and when
states change. Proximity, inventory, timers, triggers and gameplay transitions
remain runtime concerns. This is not authorization for a general logic editor.

## Evidence and implementation boundary

The accepted V2 artifacts are `animation-v2.html`, `animation-v2.mjs` and
`animation-timing-v2.mjs`. Their SHA-256 values are:

| Artifact | SHA-256 |
| --- | --- |
| animation-v2.html | 1fdd8de27e352dbcec4d46f58889a68940d496a1e699f9cd66162a9fbf985061 |
| animation-v2.mjs | 01677402f7106e7712f80abdac443f01cc198f63926cade7f890e99cb31190eb |
| animation-timing-v2.mjs | 99313ebe136abfe019de1240085a02b74a68a6bbd3ddb48de8aef84ca1f45630 |

Thirteen pure timing checks passed. Native browser checks at 1440 and 1060 px
passed the base workflow and the cut/ping-pong extensions: weighted reverse
playback, stable canvas/handles/validation, retained drafts, selected/all-use
updates, alignment compensation, saved-version isolation and Undo. Independent
review also checked the actual helper integration. Klaus then said **“all pass”**.

These artifacts are isolated design mockups with synthetic SVG artwork and
browser-local saves. They do not prove production PNG processing, durable project
storage, concurrency, backup/restore, public agent tools or runtime integration.
The passed V1 remains historical evidence for the initial workflow.

Before production source work, define the compatible implementation contract for
clip/frame identities, exact source/cut references, timing and state bindings,
storage/exchange and agent/owner operations. Preserve existing checksums, saved
pins, authority and recovery behavior. Use the actual-diff risk policy, focused
development checks and a real semantic-agent workflow before human verification.
Do not reproduce the UI by bypassing the command, validation or review core.

Only implemented work receives a new live-verification backlog item. This design
approval does not close VT-021, VT-001/CP4.5 or A1.7, and does not authorize image
generation, new provider work, audio, materialization/export or publication.
