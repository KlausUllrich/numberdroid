# Cutter Editor — Approved Design

Status: **DESIGN APPROVED by Klaus, 2026-09-07; product implementation and agent-workflow verification pending**.

Klaus's explicit result was: “I tested the mockup: all pass, good work”. This
accepts the full standalone cutter v3 mockup, including the corrections below.
It does not accept a deployed Studio implementation, the complete authoring
workflow, or VT-001 / CP4.5. The working artifact was `cutter-v3.html`, SHA-256
`028285337375f7288c0fdd140c7cb072a991cfc9b7a042d788d5a15f931af5d8`.

This screen specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md).
The [current task router](START_HERE.md) owns sequencing; existing
[cutter requirements](REQUIREMENTS.md#53-atlas-cutter) and
[Checkpoint 2B evidence](CHECKPOINT_2B_STATUS.md) remain compatibility authorities.

## Goal

Select only the desired regions of a source image, name and precisely adjust
them, inspect the resulting cuts, and preserve their source relationship. The
same semantics must be available to an authorized agent; the visual editor is
also a direct human correction surface.

## Workspace and tools

- Keep one canvas node and a stable source-to-screen transform during a drag.
  Validation messages must not move, resize or rescale the image. Their region
  has reserved height and can scroll internally if needed.
- Use a left tool rail for Select, Draw cut, Grid, Remove cut, Undo, Redo and
  Save work. The rail and inspector have bounded dimensions and may scroll
  independently; changing their content must not move the canvas.
- Grid settings open in an overlaid popup, with explicit Close and keyboard
  dismissal. Opening, editing or closing settings must not reflow the canvas.
- A contextual inspector exposes the cuts to keep, the current cut's name,
  and exact Left, Top, Width and Height values in source pixels.
- The cut being edited is distinct from the cuts included in outputs. Numbered
  regions and list entries show that relationship; excluded cuts remain visible
  but visually muted. Name changes retain the same cut identity.

## Precise cutting

- Drag inside a cut to move it. Four corner handles resize both dimensions;
  four edge-midpoint handles change only their corresponding boundary. Oblique
  pointer motion on an edge handle must not alter the other axis.
- Numeric fields provide equivalent exact editing. Arrow keys move a focused
  cut one source pixel; Shift moves ten. Zoom does not change those units.
- Use a zoom slider plus **Fit** and a direct **100% / 1:1** button. At 100%,
  one source pixel maps to one canvas CSS pixel. Larger slider values support
  close inspection without changing stored geometry.
- Cuts retain integer source coordinates. Bounds, positive size and overlap
  checks explain invalid results and prevent output creation where required by
  the existing cutter contract. Expected transient errors during a drag must
  not cause coordinate drift or alternating valid/error flicker.
- Undo/Redo restores the relevant cut edits, including geometry, inclusion,
  names and explicit layout replacement. Saving work does not ask the human to
  review the same edits again.

## Grid guides and optional snapping

Grid guides are distinct from cut rectangles. Show/hide, cell width/height,
origin and spacing settings change the guides without replacing existing cuts.
Grid guides can be visible without snapping, and snapping can be enabled
explicitly. The editor states whether snapping is active.

When enabled, grid snapping applies to drawing, moving and resizing. Holding
Alt bypasses snapping for a pointer adjustment. Numeric fields and arrow keys
remain source-pixel precise. Edge handles keep their one-axis constraint while
snapping. Grid state or a validation message must not change the coordinate
transform captured for the active drag.

**Create cuts from grid** is a separate, explicit action. It previews the number
of full-cell cuts, says that it replaces the current cut layout, and explains
unused margins and Undo. It enforces existing cut-count/output limits before
replacement; a fine guide grid may remain useful even when it has too many
cells to generate all cuts in one operation.

## Names, outputs and return

Human names appear in cut selection, output cards and output details, while
stable identities remain independent of names. An unnamed working cut has a
readable numbered fallback. Existing assets must never be silently retargeted
by a rename or recut.

Preview contains only included cuts, at their exact authored source bounds.
Output cards show the complete image, name and pixel dimensions. A picture opens
its full image in a new tab; the detail view retains original source and exact
cut coordinates. Returning preserves compatible names, inclusion, geometry,
selection, zoom and scroll. Saving outputs preserves source and cutting lineage
and must not duplicate results on a repeated action or uncertain delivery.

## Verification and implementation limits

The mockup passed focused native-browser interaction checks for selection,
pointer/keyboard/numeric editing, names, zoom, grid guides and snapping, output
selection and return. Dedicated checks measured unchanged canvas bounds and
transforms while repeated pointer positions crossed valid/error states. Grid
popup changes preserved the canvas; oblique drags on all four edge handles
changed only their intended axis. Klaus subsequently passed the entire mockup.

These are design-prototype results, not production command, persistence,
permission, recovery or agent-interface evidence. The reviewed artifact uses
sample content and simulated saves. Implementing the screen must retain or
explicitly evolve the accepted cutter/asset contracts, persist names through a
defined compatible model, and expose matching supported semantic tools. Apply
the actual-diff risk policy; prove the real agent workflow before asking Klaus
for product verification. Existing VT-001 / CP4.5 acceptance remains open.

## Bounded implementation contract — 2026-09-08

The first production block implements this editor and named image cuts. An
optional, nonempty `name` belongs to a rectangle's semantic definition. Absent
names remain absent in normalized legacy data, preserving existing unnamed
fingerprints and protected fixtures exactly. A present name is validated bounded
text and participates in immutable definition/input fingerprints. It does not
change the crop processor, PNG bytes/digests or stable identity derivation.
Preserve names through saved definitions, job input/output reads, committed slice
geometry, exact Asset bindings, project/bundle projections and restart. No
existing source, slice or Asset version is retargeted. Older data stays readable;
new optional fields need strict compatibility and round-trip tests.

Retain the existing define → preview job → save outputs boundaries. **Save work**
commits the cutting instructions; **Preview cuts** prepares exact included PNGs;
**Save cuts** promotes those inspected results once. These are explicit content
operations, not an additional human review of the owner's own editing. Existing
job cancellation, retry, discard, stale-version, budget and recovery protections
remain accessible. History restores local edits without reverting saved project
history. Preview/details are contextual views; Back restores compatible editing
and view state. Closing the editor retains the existing explicit saved-versus-
unsaved distinction and must not silently save or retarget content.

The accepted scoped MCP cutter commands already support source preparation on
the shared project head. They retain their current names, tool counts, scopes and
authority checks with a compatible optional rectangle-name field. Isolated CP4
task branches still reject preview/commit operations over shared job/CAS state;
this block does not bypass that boundary or claim a complete isolated agent
review loop. Verify the supported cutter with an actual agent using semantic
commands in a fresh test-only project: invalid bounds and correction, two of four
cuts, names, preview, save, identical retry and restart. Test-host provisioning
of a narrow grant and synthetic approved source is not owner content acceptance.
Broader task-isolated processing remains a separately scoped integration need.

The implementation must freeze its source-to-screen inverse and guide settings
at pointerdown, preserve the actual canvas through gesture updates, and reserve
validation space. Persist semantic cut data through the shared command core;
selection, tool, guide visibility, zoom, popup and local Undo history remain editor
state. Keep strict old unnamed fixtures and verify the new visible controls with
updated browser scenarios rather than retaining obsolete one-handle/zoom-select
presentation assertions. The actual diff selects L3 UI/protocol/persistence and
browser/platform gates; unchanged green checks are not repeated for reassurance.
