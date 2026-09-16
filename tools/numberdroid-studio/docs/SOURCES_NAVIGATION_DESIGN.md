# Sources navigation — Approved Design

Status: **CLARITY CORRECTION APPROVED, 2026-09-16; VT-025 REVISE**. Klaus passed
the earlier mockup and selected **Image Workbench**, but rejected the production
explanation as confusing. He then approved the correction below and authorized
implementation. The corrected production screen still requires a live retest.

This screen specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md),
the accepted [Cutter Editor Design](CUTTER_EDITOR_DESIGN.md), and the shared
[Review Changes Design](REVIEW_CHANGES_DESIGN.md). It changes navigation and
explanation, not source, review, authority, persistence, processing, or Library
semantics.

## Goal and mental model

Sources answers two different questions:

1. **Source Images** — Which originals do we have, and are they approved for use?
2. **Image Workbench** — What image work, saved cut definitions and saved outputs
   have been made from those originals?

Review is an attention state across that content, not a third kind of content and
not a required production stage. The Sources navigation therefore has exactly
two content tabs, with **Needs review** available as a status filter. Each tab
may show its own nonzero needs-review count in brackets, with a tooltip naming
the count. Do not add a separate review-attention or permanent explanation bar.
Search/filter controls have comfortable spacing before the results.

The names do not describe a mandatory wizard. A user may return to an original,
reuse it for several work items, or create several Library items from different
saved outputs. An original is never consumed when work or Library content is
created from it.

## Source Images

Source Images contains imported or generated originals and their real source
lifecycle. The primary card surface shows the whole image, name, useful size,
plain-language status and next available action. IDs, artifact identity,
provider/model data, byte size and lifecycle enums are collapsed under
**Technical details** rather than occupying the browsing surface.

Use these user-facing distinctions:

- **Ready to submit** — the original is saved but not submitted for owner review;
- **Needs review** — an explicit owner decision is required;
- **Ready to use** — the exact original is owner approved; explicitly say that
  no review is needed and offer existing image work when it exists;
- **Not approved** — the record remains inspectable but cannot start new image
  work;
- a truthful legacy label when older data has no current lifecycle state.

Import is a deliberate **Import source image** action. Its full provenance form
is progressive disclosure, while durable staged-intake Resume/Discard recovery
remains visible. Import does not approve the original or contact an image
provider.

## Image Workbench

Image Workbench contains actual persisted image work: saved atlas/cut
definitions and saved output images. Cards show output thumbnails when available,
the saved-output count and a smaller **Created from** link to the original.
Repeating the original as the main picture would make one source and its derived
work look like duplicate inventory. The original remains in Source Images.
Use state-specific guidance and actions on the card instead of a permanent
paragraph explaining internal storage concepts.

The list must not infer that a background process is running from the mere
presence of a job identity. With the current projection it can truthfully say
**Saved work · nothing running** or report the number of saved cuts. Exact queued,
running, failed and preview-ready state remains inside the opened Cutter, where
the current job projection is available.

Opening an approved original may create or reopen its non-destructive work item.
The Cutter's return action says **Back to Image Workbench**, using the normal
outlined secondary-button height and padding. Saved cuts remain Workbench
outputs; they do not become semantic Library content merely because a human
accepted an image or saved a cut. Existing Library consumers should remain
reachable without implying they must be created again.

## One output gallery

The opened work item presents one **Output images** gallery, with an explicit
state and next action:

- no outputs: explain that **Generate output images** creates images from the
  selected cut areas;
- generated results: say **Not saved yet**, explain the save consequence and
  offer **Save output images**;
- saved results: say that these images are saved and can be used to create
  Library content; offer the existing Library-authoring route.

These names describe existing define → preview job → commit operations. They
do not collapse command boundaries or introduce automatic saves. While new
generated results are being checked, earlier saved results remain protected and
may be shown under a closed **Compare with saved version** disclosure. Do not
show two equally prominent galleries called Preview cuts and Saved cuts.
After saving, the same output gallery shows its saved state, not another copy.

## Why a saved cut still needs Library authoring

Review answers whether a proposed exact change may be saved. Image Workbench
answers how pixels are prepared. Library authoring answers what those pixels mean
and how the game/editor may use them. These are different decisions:

- the Source Image preserves the immutable original and provenance;
- a saved cut preserves exact coordinates and output bytes derived from it;
- a Library Image adds stable Asset identity, use such as Surface/Prop/Item,
  placement geometry and other supported semantic metadata.

Creating Library content from a saved cut is therefore not a second approval of
the same cut. It creates a different semantic object. Direct human authoring can
save that supported Library draft without inventing an agent review. An agent
proposal still uses the one shared Review owned by the existing review contract.

## Review and filters

The status filter starts with **All statuses** and **Needs review**. Counts and
results belong to the selected content view. Unsaved edits, saved cutting work,
and Library-only Image/Animation/Assembly proposals must not inflate Sources
review counts. With the current contracts, a saved Workbench item has no review
decision of its own. A truthful empty result explains that there is nothing to
review there. Library proposals stay discoverable in Library's Reviews view.
The UI must not create separate approvals for an original, its cuts and a Library
Asset unless the underlying commands genuinely contain separate proposals.

Current shared Review supports Image, Animation and Assembly proposal items. It
does not yet provide one atomic source-plus-cut proposal. The Sources UI must not
pretend otherwise. A later contract may add a cross-source processing proposal;
that is new state/authority scope, not part of this navigation block. In the
animation-editor fixture, the original is already approved, nine outputs are
already saved, and the two pending Animation/Assembly decisions belong to
Library. No Source Images or Image Workbench approval is required.

Statuses use both text and consistent semantic color. **Needs review** keeps the
green owner-attention treatment; **Awaiting agent** keeps the distinct amber
treatment wherever that supported state is shown. Color alone never carries the
meaning.

## Interaction and accessibility rules

- Search and status filters retain focus while updating results.
- Technical detail disclosures are closed by default.
- Disabled actions provide the reason on hover and through a keyboard-focusable
  wrapper; the reason must not rely only on a disabled button's tooltip.
- Pictures retain the accepted whole-image, uncropped preview and safe original
  link behavior.
- Source import file selection, staged recovery, Cutter drafts, exact job state,
  idempotency, and refresh retention remain protected.
- Do not add an Activity shortcut inside Sources. Immutable completed review
  history remains available through the main Activity workspace.

## Approved mockup and production boundary

The accepted mockup is stored outside the repository at
`/home/klaus/.bb/thread-storage/numberdroid-sources-design/`. Klaus passed its
clarity, disabled-reason, destination explanation and Activity-removal checks,
then requested the final two-tab/filter correction and chose **Image Workbench**
from the naming alternatives.

The production implementation may organize existing source and atlas projections
under this design. It must not change schemas, commands, HTTP/MCP authority,
provider egress, image generation, materialization, runtime publication or
release. Those retain separate contracts and explicit gates.
