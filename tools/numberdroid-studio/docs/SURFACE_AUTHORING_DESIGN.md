# Studio — Surface Painting and Fill Design

Status, 2026-09-23: **DESIGN APPROVED by Klaus on 2026-09-22;
IMPLEMENTATION CANDIDATE IN PROGRESS — not merged and not user accepted.**

Klaus said **“nice, approved. However, we need to close the session now.
Please prepare for server shutdown”** after the interactive mockup. The next
session resumed implementation without repeating that design-approval gate.
This is not production-feature or overall Studio acceptance. Use the
[resume handoff](../../../docs/history/handoffs/HANDOFF_2026-09-22_SURFACE_DESIGN_APPROVED_RESUME.md)
to recover the protected live projects and next implementation block.

This is the bounded follow-up to the
[Surface-authoring observations](VACATION_TEST_BACKLOG.md#2026-09-22-next-room-batch--responsive-surface-painting-and-fill-tools).
It specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md),
[Room contract](CHECKPOINT_4_5_CONTRACT.md), and
[semantic floor metadata contract](../../../docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md).
The compact mockup uses decorative 1×1 Surfaces and simulated saves only.
It does not connect to a Studio server or alter a project. Its interactive
artifact is retained in the current BB thread storage as
`surface-tools-proposal.html`; this document retains the approved design semantics
independently of that local artifact.

## Implementation candidate — 2026-09-23

The current source candidate implements one deterministic shared Surface planner,
atomic `room.variant.surfaces.apply`, human-only compensating Undo, and the Paint /
Fill editor. Rapid Paint retains an explicit bounded queue; each saved click has
its own mutation identity, while an uncertain result retains the exact original
request and idempotency key. Fill previews and saves one complete plan, not a
loop of per-cell mutations. Same-pin/anchor/rotation no-ops create no saved
version. Stale saved state requires a fresh preview; it is not an uncertain-result
retry. Final actual-diff verification, integration and Klaus's bundled live
decision remain open; no aggregate green or acceptance is claimed here.

The [MCP contract](MCP_CONTRACT.md#explicit-surface-authoring-mapping--candidate-surfaces-v1)
defines an explicit `surfaces-v1` adapter mapping: 32 tools / six existing
resources, selected only with positively negotiated Authoring-v2 task authority.
Apply requires the new narrow `room.variant.surfaces.apply` task capability;
existing grants gain nothing. Agent changes remain on their isolated task branch
until the existing owner-review/apply gate. Undo is never an agent tool.
Startup/environment/launcher activation and live host exposure are deferred.

Use the [bundled retest](VACATION_TEST_BACKLOG.md#2026-09-23-surface-candidate-bundled-retest)
after the candidate is ready. Its disposable fixture identity is still TBD;
do not invent a project/Room/asset name or repurpose the live pilot r34 or sandbox
r111. Both protected projects remain untouched by this implementation block.
Windows testing was not requested and is not run.

## One focused Surface tool

Keep the existing Room editor, canvas and contextual Surface palette. Inside
that tool, **Paint** and **Fill** use the shared underlined tab treatment.
Primary actions retain standard readable button size. Keep the canvas and
viewport stable while updating the affected cells and save status.

**Paint:** choose one exact READY Surface, then click cells repeatedly. Replace
the current Surface rather than adding an invisible second layer. Reapplying
the same exact asset/metadata pin, anchor and rotation is a no-op. Show pending,
saved or unresolved state honestly; do not silently drop input or present an
unconfirmed mutation as saved. Optional random rotation uses only legal
cardinal orientations and retains the chosen result for retry.

**Fill:** choose one Surface for a uniform floor, or several compatible Surfaces
for a random mix. Choose **Whole room** or **Selected cells**. Clicking toggles
individual cells; rectangle drag selects an area, Shift-drag adds another area,
and keyboard selection remains available. Show selection boundaries/count.

Choose **Keep existing — fill empty cells only** (default) or **Replace existing
Surfaces**. Then **Preview fill** shows the exact proposed arrangement on the
canvas and the numbers of empty cells filled, existing cells replaced, existing
cells retained and no-op cells. **Shuffle** explicitly changes the arrangement.
**Apply fill** commits that exact preview; **Cancel** leaves saved data unchanged.
Changing scope, pool, rotation or policy invalidates the preview and requires a
new one. A normal re-render must not shuffle it. Props, Items, entrances, shape
and Library assets are not changed by a Surface fill.

## Overlap is visible, and repair is explicit

Mark cells with multiple structural Surfaces and expose the full occupying
placement list. Plain-language guidance explains which cell is affected and
what action will change it. Existing overlaps must not silently choose a winner:
offer **Keep [named Surface]**, describe which whole room placements will be
removed, and preserve Library assets. Such repairs are undoable.

Paint or fill touching an unresolved overlap opens that explanation and blocks
the affected operation. Unrelated cells remain editable. The proposed example
marks cell `(2, 2)` with two Surfaces and offers an explicit keep choice.

## Complete footprints, not arbitrary pixel tiling

Room coverage includes blocked in-room cells, excludes VOID and accounts for
authored structural bands before placing larger Surfaces. Visual image bounds
and transparency never define occupancy. Respect exact asset readiness,
rotation policy, boundary suitability, semantic roles and continuity families.
Do not randomly mix directional/route tiles merely because they look similar.

Start bulk filling with compatible rotated footprint classes. A square Surface
can use its legal cardinal orientations; a 2×3 Surface cannot freely alternate
between 2×3 and 3×2 without a separately designed packing algorithm. Explain
ineligible choices rather than silently substituting a different asset/version.

A fill must contain complete Surface footprints aligned to their usable-domain
origin. Existing Room macro alignment also constrains Paint: larger Surface
anchors must use the usable-domain origin plus whole rotated-footprint steps.
Explain a rejected anchor and the legal steps; never silently move the requested
placement or relax the Room contract. Show cells that cannot be filled and how
to correct the selection or pool. Never clip a larger Surface or hide part of it
under a structural band.
If replacement would remove a whole placement extending outside the selection,
show that footprint and require explicit selection expansion before applying.
The 1×1 mockup does not claim to demonstrate these larger-footprint cases.

## Atomic save, exact retry, and one-step undo

The existing add/remove commands each accept at most 64 placements and create
separate Room versions. Production therefore needs a bounded semantic atomic
Surface operation, not loops of per-cell calls or a remove-then-add sequence.
The Room cap is 256 total placements across both layers, not 256 cells. Preflight
the final count after exact removals/additions; never split requests to evade
the cap or silently truncate a fill.

Use existing project/Room revision checks, exact asset pins, authority admission,
immutable history and idempotency boundaries. The preview must identify exact
removals, new placements, positions, rotations and stable mutation identities.
The server validates the same plan against the same saved head and commits the
whole change and its findings atomically. A stale head requires a new preview;
an unknown result retries the original request and key without rerolling.
No-op plans submit no write. Fail closed on operation-created overlap, illegal
footprints and capacity errors without requiring unrelated Draft findings to
disappear first. Dirty shape drafts retain their existing save/discard guard.

**Undo last Surface change** creates a new immutable Room version restoring the
prior affected Surface set; it never deletes history. It is available only
while its exact saved result is still the current Room head. Another Room
mutation disables that undo with a clear reason. Undo itself needs stale-head
and exact unknown-result replay handling.

The production command/API/MCP mapping follows the existing agent-first contract.
Browser and agent callers use the same semantic validation. The candidate's
new narrow Apply capability must be explicitly granted to an admitted task;
neither the design nor its opt-in mapping grants live agent access, a new role,
autonomous acceptance or publication authority.

## Diagnosis and production verification

Source inspection shows the current click path waits for placement POST,
project/activity/access/intake/task reloads and Room rendering. It does not call
a browser-page reload. Measure those phases separately on disposable data,
including a realistic history/task load, before claiming a latency cause or
speed improvement. Normal-mode passive refresh must be considered; a visual
fixture that disables polling cannot prove normal-mode performance.

Measured on 2026-09-22 against source tree
`ce87b95092b46aacfcf06d8c8b1c602172c1a5e1`: five normal-mode browser clicks in a
fresh local 6×6 Room each caused six requests (one POST and five refresh GETs)
and two workspace child replacements. POST response headers arrived in
6.2–11.0 ms; the final replacement occurred 25.6–37.5 ms after click. No browser
long tasks were observed. A separate loopback API experiment kept five
placements fixed while history grew from revision 16 to 51: POST time increased
16.4→51.2 ms, the five-read batch 14.4→79.5 ms, and project payload
35,450→208,320 bytes. This demonstrates history-associated growth in that
fixture, not a single isolated causal layer. The reported multi-second delay
was not reproduced. Remote tunnel, mature project/task volume and an overlapping
passive poll remain unmeasured. Raw local evidence and scratch harnesses are
retained under `/tmp/numberdroid-surface-perf.iNZ9qe/`; all owned servers and
browser processes closed, and neither live instance was read or changed.

Design artifacts are separate from production changes. Production is expected
L3: focused semantic/persistence/recovery tests, actual native browser evidence,
the selected Studio gates and independent trigger-relevant reviews. Bundle the
human test: rapid paint, replacement and overlap repair, rectangle/additive
selection, both fill policies, compatible mixed assets/cardinal rotations,
stable preview/shuffle, undo, failed/stale/unknown-result recovery and exact
saved Preview. Include multi-cell boundary and capacity cases in engineering
evidence. Windows tests remain opt-in only on Klaus's explicit request.

Current live pilot and real-artwork sandbox must not be reset or restarted
underneath unsaved edits. Mockup approval, production integration and later
Klaus acceptance remain separate gates.
