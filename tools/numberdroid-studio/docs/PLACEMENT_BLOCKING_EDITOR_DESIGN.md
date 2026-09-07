# Placement & Blocking Editor — Approved Design

Status: **DESIGN APPROVED by Klaus, 2026-09-07; product implementation and real-agent verification pending**.

Klaus passed the six focused placement v1 walkthrough checks: inward polygon
point editing, point insertion, point removal/Undo, independent polygon creation,
placement-bounds editing, and anchor editing. After the final check he requested
an Oval tool and Shift constraints. His explicit v2 result was: “perfect, pass”.
The final standalone artifact was `placement-v2.html`, SHA-256
`8fb32f7df8e69cfc5428dfb878638afca5208e93ba320544243f2716376132ff`.

This is approval of the mockup's design and interaction. It is not acceptance of
implemented Studio commands, persistence, engine integration or VT-001 / CP4.5.
The screen specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md)
and reuses the interaction foundation of the [approved cutter](CUTTER_EDITOR_DESIGN.md).
The [current task router](START_HERE.md) owns the next design block.

## Goal and geometric meaning

Author movement-blocking shapes over the asset artwork without confusing them
with image bounds, placement space or the alignment anchor. Blocking is an
explicit semantic decision; shadows, glow, overhang and transparent pixels do
not automatically define it. A simplified ground footprint can be more correct
than a detailed trace of every visible pixel.

- **Blocking regions:** polygons, rectangles or ovals describing blocked space.
  Multiple named regions can belong to one asset. A concave L-shaped polygon
  preserves its unfilled inner corner; it is not replaced by a bounding box.
- **Placement bounds:** separately authored space used when positioning the
  asset. Editing the blue dashed bounds leaves blocking regions and artwork fixed.
- **Anchor:** the asset's alignment reference. Moving the cyan marker changes
  that reference while leaving artwork, placement bounds and blocking shapes fixed
  in asset-local coordinates.

The mockup uses asset-local pixels. Production coordinate storage, mapping to
project/game units and transformation into placements must be explicit in the
implementation contract. The sample's canvas size and numeric limits are not a
universal geometry or game restriction.

## Shared editor interaction

Keep one stationary canvas and a stable coordinate transform during each drag.
Validation has a reserved-height region; errors, inspector changes and grid
popups must not move or rescale the image. Tool rail and inspector content can
scroll independently inside bounded panels. Preserve exact geometry, selection,
compatible field focus, zoom and scroll through preview and return.

Use the left tool rail for Select, Polygon, Rectangle, Oval, Point+, Remove,
Grid, Undo, Redo and Save work. Zoom uses a slider plus Fit and direct 100% / 1:1.
The inspector separates Blocking and Placement. Region names and exact numeric
coordinates are available beside the visual editor.

Grid guides and snapping are optional. Grid settings do not alter saved shapes.
Alt bypasses snapping during pointer adjustment; numeric coordinates remain exact.
Arrow keys move a selected point or selected shape in the editor's local units,
with the documented larger step under Shift. Pointer aspect constraints below
are distinct from that keyboard movement shortcut.

## Polygon authoring

- Click to place points. Close by clicking the first point or pressing Enter.
  Escape cancels an unfinished outline or active gesture without changing the
  previously authored regions.
- Select and drag a point, or edit its coordinates. Other points remain fixed.
- Point+ inserts a point along a selected polygon edge without changing its
  existing outline. The new point can then be moved independently.
- Remove deletes the selected point while retaining its region and connecting
  its neighbors. Removing a whole region remains a separately explicit action.
- Undo restores point creation, deletion and movement as meaningful edits.
- A closed polygon requires at least three distinct points and non-zero area.
  Crossed edges and invalid coordinates produce actionable findings. Concavity
  is permitted. Too few points or an insertion away from an edge must explain
  what the user needs to correct.

The editor keeps numbered points and a coordinate list available as alternatives
to visual hit targets. Region identity is independent of its human-readable name.
Incomplete work and invalid drafts must not be presented as validated usable
geometry merely because a working copy was saved.

## Rectangle, Oval and Shift constraints

The general curved-shape tool is **Oval**. A circle is the equal-width/height
case, not a separate required tool. Oval properties expose center, width and
height. The rectangular resize frame is an editing guide, not additional blocking.

Rectangles and ovals support eight handles. Without Shift, edge handles change
only their respective axis; corner handles can change both. Holding Shift during
drawing or handle resizing creates a square or circle, including when the
starting shape has unequal dimensions. This explicit constraint may change both
axes even when an edge handle is used.

Corner resizing retains the opposite corner. Constrained edge resizing retains
the opposite edge and the perpendicular center. Pressing Shift during an active
drag applies the constraint immediately; releasing it restores free resizing
within that gesture. Moving the whole shape does not change its aspect ratio.
Undo restores the prior geometry. Polygon point editing retains its own behavior.

## Preview, engine boundary and verification

Preview shows the exact authored regions and names without editing them. It must
say that this is geometry inspection: it does not simulate character size,
pathfinding or game movement. Returning restores the edited draft and context.

Current Studio asset and Room collision code consumes rectangles. Polygons and
ovals therefore require corresponding geometry, validation, persistence, semantic
tool and integration work; a visual-only implementation is incomplete. Preserve
the actual authored shapes. A project integration must support them or provide
a validated conversion under an explicit contract, otherwise report the unsupported
feature. Never silently substitute a blocking bounding box.

Existing schemas, accepted asset/Room behavior and authority boundaries remain
protected until explicitly evolved by a scoped implementation. How assemblies
reuse component blocking is a separate Assembly-editor decision; this approval
does not resolve that inheritance model or add runtime behavior.

Focused native-browser checks covered concavity, point edits, independent regions,
primitive drawing, stable validation, anchor/placement independence and preview
return. The v2 follow-up additionally proved free oval axes, Shift during drawing
and corner/edge resizing, modifier press/release within a drag, exact Undo and
unchanged polygon editing. Klaus passed the walkthrough and the completed
requested revisions.
These prototype results do not replace risk-selected product tests, supported
agent-interface proof, recovery checks or explicit product acceptance.
