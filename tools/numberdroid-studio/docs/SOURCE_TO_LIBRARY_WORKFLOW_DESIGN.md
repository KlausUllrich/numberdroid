# Source to Library — workflow redesign proposal

Status: **DESIGN APPROVED; LIVE IMPLEMENTATION AUTHORIZED, 2026-09-16**.

Klaus approved the interaction model: “yes, much better” and requested the live
version with the real original-image cutter retained. The simplified mockup
canvas is not the intended production cutter. The accepted source image,
boundaries, precise controls, zoom, grid, handles and Undo/Redo remain intact.
The first [implementation block](SOURCE_TO_LIBRARY_IMPLEMENTATION_CONTRACT.md)
covers individual Image destinations and reliable save. Automatic earlier-layout
reuse for a revised original, archive and deletion remain separate blocks.

Klaus rejected the workflow exposed by the VT-025 candidate after saving nine
generated cuts failed with an already-existing identity. He agreed to a different
mental model: Workbench is an editor, Library is the managed collection. The
following prototype is a design gate, not production behavior or acceptance.
The prior [Sources navigation contract](SOURCES_NAVIGATION_IMPLEMENTATION_CONTRACT.md)
and [VT-025](VACATION_TEST_BACKLOG.md#vt-025--source-images-and-image-workbench)
remain unaccepted. This proposal does not authorize merging PR #255 or claim its
remaining CI failures are resolved.

## One coherent user promise

Select areas of an approved original, inspect/name the resulting images, choose
their Library destinations, then save there. Normal authoring does not expose a
second independently managed inventory of saved cut files. Internal immutable
cut records, original bytes, exact versions and provenance remain necessary.

The standalone [interactive prototype](prototypes/image-library-workflow/index.html)
uses only synthetic in-memory examples. It has no API connection, upload, file
mutation, database, agent grant or persistent browser storage. Refresh resets the
sample. All sample originals are already approved; import does not bypass the
real source-review rules. Product implementation is a later L3 block requiring
owning contracts, independent reviews, semantic agent proof, native browser,
recovery/platform evidence and exact-head CI.

## Sources and image work

- **Source Images** preserves originals; **Image Workbench** edits their cuts.
- **Cut images** is left and **View Output** right, consistently.
- Output is a proposal of what to add/update, not another file cabinet.
- Each included image has a name, supported use and explicit destination:
  **Add as new Library image**, **Update [named item]**, or **Skip**.
- The primary action names its effect: Add N images to Library, or Save N
  updates + M additions. Unchanged/skipped results are counted separately.
- New Library content is a DRAFT. Placement/readiness validation is not implied
  by saving pixels, and unknown geometry is not silently fabricated.
- After save, show the named Library destinations and exact versions. Repeating
  unchanged work gives the existing result, not duplicates or an identity error.
- Existing Library content has no separate Workbench approval. Own human saves
  retain validation but do not create an agent-review ceremony.

The initial prototype addresses individual Library Images. Do not generalize
that choice into automatically making every animation frame or component a
top-level Asset. The accepted Animation/Assembly editors and the
[Authoring Product Model](AUTHORING_PRODUCT_MODEL.md) retain their nested content
and explicit composition decisions. A frame-destination extension needs its own
bounded mockup and semantic batch design.

## Updating an original or an existing Library image

“Update an existing source” is an explicit relationship to a **new immutable
original**, not an overwrite. Offer its earlier cut layout for inspection;
revalidate against new dimensions and show any invalid areas. Prior originals,
cuts and Library versions remain readable.

For linked work, show each proposed Library target and existing version visibly.
For unrelated work, default to new content and let the user explicitly select an
existing target. Do not invent links from equal names, card positions, image
dimensions or pixels. A target must be compatible, same-project and current.
Two results cannot update one target in the same save.

Only a chosen update target gets a comparison: **In Library vN** versus **Your
proposed image**. There is no undifferentiated gallery labelled Compare with
saved output images. Skipping or omitting a cut never archives/deletes old content.

Replacing the image creates a new Asset version, retaining non-exposed semantic
metadata and validating geometry. Existing Room, Assembly and clip references
remain pinned until a separate explicit supported update. Updating an Asset that
shares a cut must not retarget its other consumers.

Current implementation can bind a new saved slice when updating an Asset, but
cannot retarget an existing atlas to a different source. Therefore the new-source
relationship, new cut lineage and user-visible mapping need a reviewed contract;
the UI cannot bypass immutable atlas/source boundaries.

## Reliable save and recovery

Three different situations must not be conflated:

1. **Already saved, unchanged:** application-level exact equivalence and durable
   destination history resolve to existing items/versions; no new mutation.
2. **Changed work:** explicit add/update/skip plus exact target-version checks.
3. **Unknown result:** retain and retry the identical request/idempotency key.
   Do not edit the retained payload, create fresh IDs or infer success from a
   newer project head.

The present atlas commit derives an unmapped slice identity from atlas,
definition version and rectangle identity. Generating another job from that same
definition does not create a new identity; its commit can fail ENTITY_EXISTS.
Fix the semantic workflow, not the error text or a blanket catch-and-ignore.
Pixel equality alone does not prove identical source lineage, geometry, name,
pivot, metadata, destination or intent.

Today cut commit and individual Asset save are separate operations. A single
user-facing batch therefore needs either an atomic application command or a
durable resumable operation with a clear per-item receipt. A browser-only loop
that partly saves, fails, and starts again on refresh is prohibited. Define the
matching semantic agent operation and preserve owner-only review boundaries.

The prototype's repeat-save button demonstrates the intended result only. It is
not proof of durable idempotency, restart, partial-failure or network recovery.

## Library cleanup

Archive is reversible: hide from ordinary selection while preserving existing
uses, exact saved history and an Archived filter with Restore. It is a new
lifecycle capability, not currently implemented by Studio's leaf Asset APIs.

Permanent deletion requires a complete, rechecked reference closure: current and
historical Rooms, Assets, Assemblies, clips, proposals, active tasks, revisions,
exports and other retained records—not only current visible placements. An
in-use item shows named dependencies and offers Archive instead. Concurrent new
references must prevent an unsafe deletion. Original sources are never removed
implicitly. Shared artifact bytes require separate recoverable garbage
collection; removing a catalog entry is not permission to delete CAS files.

The cleanup example simulates Archive/Restore, a blocked used item, and a
confirmed unused sample deletion. It is **not permission to delete user data**.
Production cleanup must be a separately verified lifecycle/recovery block, with
Archive before any hard-deletion/garbage-collection implementation.

## Bundled design review

Review all four examples together:

1. **New source:** select cuts, inspect destinations, add to Library, repeat the
   same save, and confirm one managed collection with no duplicates.
2. **Updated source:** inspect explicit targets and meaningful paired previews;
   save changes, then see old Room/Assembly uses still pinned. Unchanged results
   require no save.
3. **Unrelated source:** choose a target manually or add new. Skip one image.
   No old item disappears. Duplicate update targets are visibly blocked.
4. **Cleanup:** archive/restore an item, inspect why an in-use item cannot be
   deleted, then confirm deletion of an unused sample item.

Klaus approved this interaction model, subject to retaining the actual cutter.
That approval does not establish production acceptance.
Do not infer acceptance of production, source art, new agent authority, runtime
materialization, repository publication or release.

## Implementation sequence after the design gate

1. Define and implement one coherent extraction-to-Library operation with exact
   destinations, repeat-save recognition and fault/restart recovery.
2. Add the explicitly versioned updated-original relationship and revalidated
   layout/target mapping. Do not overwrite existing source or atlas identities.
3. Implement reversible Library archive/dependency presentation; hard deletion
   and artifact collection retain separate retention and safety gates.

Preserve accepted precise cutting, Animation/Assembly semantics, shared Review
and exact Asset/Room pins. Do not combine new cleanup machinery with a cosmetic
Sources patch or reset the retained live fixture to conceal the reported error.
