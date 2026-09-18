# Sources navigation — Production implementation contract

Status: **WORKFLOW USER-PASSED 2026-09-18; BOUNDED CUTTER FOLLOW-UP OPEN**.
The initial production screen failed Klaus's clarity review. Klaus subsequently
reported “all pass.” for the corrected VT-025 Source-to-Library batch on build
`53885f5`, while reporting five concrete Cutter follow-ups. Preserve the passed
workflow; those findings retain their own focused retest. This is not a merge.

**2026-09-18 scope evolution:** the approved
[Source-to-Library implementation](SOURCE_TO_LIBRARY_IMPLEMENTATION_CONTRACT.md)
supersedes this document's output gallery/Save/comparison and separate Image
authoring paragraphs. It adds explicit Library destinations and atomic owner
Save with recovery receipts. This document continues to own the two content
views, review counts, filtering and navigation; its original no-schema-change
boundary describes only the earlier presentation slice, not the later L3 block.

This contract binds the production implementation of the user-approved
[Sources Navigation Design](SOURCES_NAVIGATION_DESIGN.md). It reorganizes the
existing source and atlas projections without changing their commands, schemas,
review authority, persistence, processing, or publication meaning.

## Bounded promise

The Sources workspace provides exactly two content views:

- **Source Images** lists original inputs and their real source-review lifecycle;
- **Image Workbench** lists actual persisted atlas/cut definitions and saved cut
  outputs.

**Needs review** is a status filter scoped to the selected content. Each tab may
show its own nonzero review count in brackets with an explanatory tooltip.
Remove the separate attention notice and permanent Workbench explanation bar.
Do not import Library proposal groups into Sources counts or results. Current
Workbench records have no separate review decision; unsaved work is not review.

Source cards show whole-image preview, useful dimensions, plain-language status
and the next available action. Technical identity and provenance remain
available in a closed disclosure. Import is progressive disclosure, while
staged-intake recovery remains visible. An approved PNG opens the existing
Cutter under Image Workbench and returns there. An approved original explicitly
needs no review; an existing work item is presented as derived work, not a second
copy of the original.

Workbench cards are projected only from saved atlas records. A saved definition
with no outputs says **Cut layout saved**; a record with output heads reports the
exact **saved output images** count. Neither label claims active or idle job
state. The list does not infer processing state from `latestPreviewJobId`; the
opened Cutter owns exact queued/running/failure state.
Show saved output thumbnails and a smaller source relationship/link on Workbench
cards. The Back button uses the normal outlined secondary-button treatment.

The Cutter provides one Output images gallery, identifying generated results as
not saved yet and committed results as saved. **Generate output images** and
**Save output images** are clearer labels for the existing preview/commit
operations, not new commands. When generated results exist, expose saved results
only through the optional closed **Compare with saved output images** disclosure.
The `sliceHeads` projection accumulates saved output identities; it is not a
one-to-one previous version of the current generated set. Preserve its exact
versions, authoring actions and recovery controls. Saving switches
the primary gallery to the saved state without duplicating the same results.

## Preserved behavior and boundaries

- Original source bytes, provenance, lifecycle and owner review remain unchanged.
- Import/propose/approve/reject commands and idempotency remain unchanged.
- Atlas definitions, exact job controls, saved cuts and recut version rules remain
  unchanged.
- Saved cuts remain non-semantic outputs. Existing Asset/Animation authoring
  creates Library content from exact cuts and supplies the separate semantic
  identity and metadata. Explain that creating Library content is authoring its
  use/placement, not approving the same output again.
- Existing shared Review groups remain Image/Animation/Assembly groups. This
  implementation does not invent an atomic source-plus-cut proposal.
- Disabled Sources actions expose a hover and keyboard-focusable reason when the
  control is rendered unavailable.
- No provider, generation, media expansion, MCP/HTTP authority, schema,
  materialization, runtime export, publication or release change is included.

## Implementation surfaces

- `apps/studio-server/public/sources-navigation-state.js` owns pure filtering and
  truthful status presentation;
- `apps/studio-server/public/app.js` renders the two views, attention filter,
  progressive import and compact technical disclosures;
- `apps/studio-server/public/cutter-editor-view.js` names the Image Workbench
  context and return destination;
- `apps/studio-server/src/server.js` serves the new browser module through the
  existing explicit static allowlist;
- focused state tests and a real-Chrome two-viewport check cover names, filtering,
  focus retention, actual saved atlas/output projection, closed disclosures,
  absence of a process-like Review tab, domain-correct counts, one primary output
  gallery, original/output relationship, Back-button geometry and horizontal
  containment.

## Acceptance boundary

Automated checks, screenshots, reviews, integration and green CI do not accept
this screen. [VT-025](VACATION_TEST_BACKLOG.md#vt-025--source-images-and-image-workbench)
requires Klaus's explicit PASS or REVISE on a fresh test fixture. Earlier
Checkpoint 2A/2B acceptance remains intact and should be repeated only where this
navigation changed the visible route or explanation.
