# Asset editor — compatible implementation contract

Status: **USER ACCEPTED — VT-020 PASS**, 2026-09-09.
The [approved Placement & blocking design](PLACEMENT_BLOCKING_EDITOR_DESIGN.md)
owns interaction. This evolution adds direct human Save and typed spatial metadata
to the [accepted Asset core](CHECKPOINT_2C_CONTRACT.md); it preserves legacy semantics
when the new field is absent. It does not change agent review authority.

## Product promise

From a saved cut or an existing Library Asset, open one contextual editor.
Edit name, Surface/Prop/Item kind, placement settings and named blocking regions.
Save creates one new DRAFT version directly for the project owner. A person does
not approve a proposal representing their own edit. Agent proposals remain
isolated until an owner decision and application. No save promotes lifecycle,
approves agent work, publishes content or changes an existing Room's pinned version.

The editor retains unexposed metadata. Library and source return context, draft,
selection, compatible focus, canvas/page scroll and zoom survive read-only geometry
Preview and compatible refresh. A stale project or Asset requires explicit
rechecking without discarding the draft. An uncertain save retains its exact
request and idempotency key until reconciliation; retry cannot duplicate a version.

The duplicate Activity sidebar is removed globally. The Activity navigation page,
durable history, denial auditing, updates and evidence counters remain intact.

## Typed spatial metadata

Optional `metadata.spatial` is one strict versioned document:

```json
{
  "schemaVersion": 1,
  "coordinateSpace": "image-pixels",
  "unitsPerPixel": {"x": 0.01, "y": 0.01},
  "placementBounds": {"x": 0, "y": 0, "width": 200, "height": 300},
  "anchor": {"x": 100, "y": 250},
  "blockingRegions": [
    {"regionId": "body", "name": "Machine body",
     "shape": {"kind": "rectangle", "x": 35, "y": 80, "width": 130, "height": 190}}
  ]
}
```

Shapes are rectangle, oval (same x/y/width/height bounding frame), or polygon
with an ordered points array. Ovals remain analytic ovals; polygon concavity remains
empty. Region IDs are stable and unique; names are editable. Limit each Asset to
16 regions and each polygon to 64 points. Closed polygons require three distinct
points, nonzero area and no self-intersection. Unknown fields, nonfinite values
and invalid topology fail with field-specific corrections.

Coordinates are finite image-local pixels, bounded to +/-65535; positive dimensions
are bounded to 65535. Scale is finite and positive, at least 0.000001 and at most
64 project units per pixel. Physical placement dimensions must be positive and
at most 64 project units per axis. These are bounded implementation limits, not a
claim about every game's geometry. Numeric edits preserve fractions.
All blocking must fit inside authored placement bounds; a smaller bounds draft
retains its shapes and reports invalid containment. The bounded anchor can lie
outside the artwork and does not move other geometry.

The physical mapping is `q=(pixel-placementBounds.origin)*unitsPerPixel`.
Cardinal rotation rotates q about the exact physical placement rectangle;
a Room then translates by its existing placement origin. Artwork, named shapes
and ground anchor use that same transform. Bounds edits affect alignment and
occupied space, never artwork scale. New images default to equal x/y scale;
explicit conversion of legacy assets preserves their existing potentially unequal
scale (old span divided by image dimensions). No existing Asset auto-converts.

For spatial Assets, `spanTiles` is the conservative ceil of physical placement
dimensions. Surfaces require integral physical dimensions for whole-grid macros.
The legacy cell anchor is a derived, clamped projection of the spatial anchor.
`collision` is `{mode:"spatial",bounds:null,parts:[]}`; it references the spatial
document and carries no second geometry. Reject conflicting aliases. Empty regions
mean no blocking: do not apply legacy blocked-envelope fallback. Blocked navigation
with no regions is a finding. Missing descriptive metadata can remain a DRAFT finding.

Old metadata without spatial preserves byte-for-byte normalization, fingerprints,
binding and validator behavior. New metadata uses the same strict schema through
owner saves and existing scoped agent proposals. Pixel dimensions and immutable
imagery identity remain server-derived. A malformed `studio.preview.presentation`
extension must never replace the spatial authority.

## Consumers and explicit limits

A shared browser-compatible pure resolver supplies exact placement bounds, image
bounds, anchor, named shapes and conservative occupancy. Room domain validation,
the live placement ghost, pinned Asset reads, placed artwork and Studio Preview
consume the same transform. Invalid spatial geometry cannot be placed by silently
falling back to old span/collision data.

Connector clearance and navigation cells use positive-area shape/rectangle
intersection, including empty concave corners and analytic ovals; touching an edge
alone is not overlap. Bounding boxes are only candidate filters. Multiple regions
on one Asset form a union. Keep existing Room placement-envelope rules separate
from physical collision.

Disjoint shape bounds prove separation. Rectangle pairs and shape/rectangle pairs
are supported. Where overlapping nonrectangular shapes cannot yet be compared,
return an actionable unsupported ERROR; never invent a physical collision or
report a clear result. A SET_DRESSING pair already forbidden by placement-envelope
overlap may retain that truthful finding without inventing collision evidence.
This includes blocking Surface/Prop pairs across layers: they cannot be assumed
safe merely because ordinary passable floors do not block.

Geometry Preview is read-only inspection, not runtime output, actor clearance or
pathfinding simulation. Existing legacy presentation remains unchanged; incompatible
segmented presentation with spatial geometry must report a finding. The Numberdroid
adapter explicitly rejects unsupported spatial geometry before export. No runtime
conversion or materialization is introduced.

## Direct owner Save

Register internal `asset.save`: ownerOnly, requiredScope null, durable Asset-store
gate. Default internal command count evolves 33 to 34 with 30 scopes; private
authoring overlay evolves 34 to 35 definitions with 31 scopes. Agent MCP catalogs
remain exactly 19 tools/4 templates or 30/5 for matching tasks; owner Save is absent.

`POST /api/projects/:projectId/assets/:assetId/save` accepts exact fields:
expectedRevision, idempotencyKey, operation (create/update), expectedAssetVersion,
expectedMetadataVersion, name, kind, metadata and image. Image is either
`{mode:"retain"}` or `{mode:"saved-slice",sliceId,expectedSliceVersion}`.

Create expects absent versions (0/0) and an exact currently saved slice.
Update expects the exact current Asset and metadata versions. Retain copies the
prior immutable Asset binding even after a source is recut. An explicitly replaced
image must resolve the specified current slice version inside the transaction.
The caller supplies no actor, grant, digest, artifact, path or proposal identity.
The local human route reuses the existing owner, origin/CSRF, body-limit and
idempotent semantic-command boundary. Nonowners, agents and remote browser clients
gain no direct Save authority.

One atomic appendRevision owns Asset version/binding/findings/references, head/tag
projections, project snapshot, Activity and replay state. Content changes reset the
new version to DRAFT and clear warning dispositions. MetadataVersion changes only
when the existing typed metadata fingerprint changes. Prior versions/references
remain intact. Human saved versions have null proposal links, never fabricated
proposal/decision records. Existing nullable v9 columns suffice; migrations remain
immutable.

## Integrity and portable exchange

Native integrity proves owner-save revision provenance, exact prior versions,
retained/replaced binding, null proposal links and the resulting snapshot.
Imported provenance is sanitized and non-authorizing, with equivalent semantic
consistency proof. Portable schema v4 represents projects containing owner-saved
or spatial Assets. Projects without those features retain exact v1-v3 canonical
formats. Older formats do not silently admit new semantics.

Bundle checks retain exact keys, bounds, CAS closure, lineage, authority exclusion,
destination safety and atomic import. Export/import/export and restart must preserve
all spatial shapes and old pinned versions. Workspace backups remain distinct from
portable project exchange.

## Selected proof and acceptance

This is L3: schema/authority/persistence and cross-consumer UI behavior.
Start with focused geometry, owner-save/replay/denial, fault/rollback,
recut-retention, pinned-history and bundle roundtrip tests. Run the actual-diff
selected full Studio/core/build, Linux browser and Windows compatibility gates once
at freeze; repeat only checks affected by a concrete correction.

Use fresh fixture directories for implementation and actual-agent verification.
A real agent must submit a malformed shape through the semantic interface, use its
actionable error to correct it, submit isolated valid work, and read recorded owner
feedback/current saved versions before the next round. Scripted owner decisions
in an isolated fixture are technical proof, not Klaus's acceptance. Native browser
proof covers stable dragging/errors, numeric and pointer shapes, Shift, Undo/Redo,
exact Save/retry, Preview return and Activity after sidebar removal.

Klaus completed the batch walkthrough on clean main `93652c2` and explicitly
reported **“all pass”** on 2026-09-09. This accepts the bounded Asset editor and
Activity sidebar removal; mockup approval, CI and source integration remain
separate evidence.
VT-001 / CP4.5 and A1.7 remain REVISE until their separate gates are explicitly met.

## Implementation verification checkpoint — 2026-09-09

Focused geometry, zero-clearance compatibility, owner Save, denial/replay/fault,
legacy and spatial bundle round trips, native/imported provenance corruption and
controller retention tests pass. Native Chrome at 1440 and 1060 pixels verifies
polygon/oval/rectangle editing, eight handles, live Shift, Undo/Redo, negative
fractional typing, stable validation, unfinished numeric-field retention,
read-only Preview return, exact lost-response Save replay, prior Room pins and
restart. Activity remains in main navigation; its duplicate sidebar is absent.

An actual agent used production MCP discovery and tools on an isolated synthetic
fixture. Studio reported mismatched revisions and a crossed polygon; the agent
corrected both without a human review round. It then read a recorded owner
correction request, revised only the requested polygon coordinates, and read back
the explicitly applied Asset v1/metadata v1 with its exact slice and findings.
The host was drained and stopped. This proves a bounded semantic authoring round,
not CP4 Resume or a complete agent-assisted Artist production loop.

The exact source/CI identities and final selected suite results belong in the
focused PR. [VT-020](VACATION_TEST_BACKLOG.md#vt-020--asset-placement-and-blocking-editor)
records Klaus's completed human batch. Root build verification uses the runtime version
pinned by the current Actions workflow so accepted PNG byte hashes are comparable.

## User acceptance — 2026-09-09

Klaus's exact response to the implemented editor batch was **“all pass”**. The
accepted scope covers named-cut creation, Asset naming/properties, polygon /
rectangle / oval editing with Shift and Undo/Redo, independent bounds and anchor,
Preview/return, direct Save and Inspect, and Activity in main navigation with the
duplicate sidebar removed. The running source was clean main
`93652c238b7d6e9b1aa3006bee85731ea1645f00`, integrated through
[PR #227](https://github.com/KlausUllrich/numberdroid/pull/227); post-merge
[Build #2425](https://github.com/KlausUllrich/numberdroid/actions/runs/34330959284)
passed. Preserve this acceptance unless a concrete regression reopens it.

This closes VT-020 only. The next approved design block is the Assembly editor;
its compatible component/version/geometry contract must precede implementation.
