# Studio — Rooms Navigation Design

Status: **design approved and bounded production navigation batch USER ACCEPTED
by Klaus on 2026-09-22; source integration remains pending**.

Klaus approved the populated Rooms/Templates navigation mockup, requested stable
vertical alignment when switching tabs, then authorized implementation. This
document records that bounded design. Klaus subsequently reported “all pass” for
the presented production batch on local `ee2748053aad08a2867ac266cf896997d70108c6`:
collection entry, existing Room/Back, stable tabs, template rules, new second Room
and preservation of the first. This does not accept the overall Room milestone.
It specializes the
[Authoring Product Model](AUTHORING_PRODUCT_MODEL.md) and the
[CP4.5 Room contract](CHECKPOINT_4_5_CONTRACT.md).

## Collection first

- Choosing **Rooms** in main navigation opens the collection, not an arbitrary
  Room editor. The workspace heading is **Rooms**; project identity remains in
  the application header.
- **Rooms** and **Templates** use the shared selected-underline tab treatment,
  readable controls and keyboard tab navigation. Their headings, tabs and
  filters keep the same vertical position even when content heights differ.
- Rooms includes Draft, Validated and Final Rooms, with search and a lifecycle
  filter. Cards show the name, dimensions, kind, saved lifecycle, template,
  useful visual overview and concise attention information. Final is not a
  synonym for published or available in Numberdroid.
- The Rooms collection offers **New room** at the top. The Templates collection
  offers **New template**. Creation is not buried in an existing Room's settings.
- Template cards show kind, suggested dimensions and that they contain starting
  rules, not floor or furniture. Actions are **Create room from this template**
  and **View rules**. Rules inspection is read-only.

## What creation means

A template is a versioned reusable intent/constraints preset. A Room is a
separately saved concrete arrangement that references its exact template version.
Editing a Room does not edit its template or other Rooms. This navigation change
does not introduce copying the contents of a furnished Room.

**New room** is a focused form for name, template and dimensions. Opening it
from a template preselects that template and its suggested dimensions. State the
consequence before creation: a separate editable Draft with no placed assets and
the existing default entrance configuration; existing Rooms and Library assets
stay unchanged. Successful creation opens that exact new Room even if collection
filters would hide it. Failure must not select an unrelated fallback Room.

**New template** saves the existing bounded kind, dimension and rule preset; it
does not create a Room. After saving, show the saved template and a clear route
to create a Room from it. Do not imply that its sample outline is saved content.

For an empty project, explain why a template is needed and offer **New template**
before Room creation. When a template exists but no Room does, guide the user to
**New room**. Distinguish an empty collection from search/filter results with no
matches. This production empty-state requirement was not demonstrated by the
populated mockup and needs its own implementation evidence.

## Focused Room and contextual return

Opening a Room shows its name as the primary heading, its exact saved identity
and lifecycle, and one upper-left **← Back to Rooms** button using the shared
`studio-back-button` treatment. Keep the existing editor tools and read-only
Studio Preview. Remove unrelated New template/New room controls from the editor.
Validated and Final saved versions retain their existing read-only restrictions;
this work grants no new lifecycle action.

Template rules use **← Back to Templates**. Creation returns to its actual
origin, including the named template when opened from its rules. Back never
saves, accepts, creates or deletes content. Restore collection tab, search,
filters, focus and scroll on return; do not silently clear filters to reveal a
new item. If a saved item is filtered out, explain that without losing the filter.

An unfinished creation form offers **Keep editing** or explicit discard before
leaving. Existing compatible editor drafts remain protected. Dirty shape/review
drafts, unresolved placement requests and gesture state must not be silently
discarded, retargeted or replayed against a different Room through Back, sidebar
navigation, refresh, collection actions or creation. The existing save/discard,
conflict and unknown-result recovery contracts still govern those states.

Once creation has been submitted, a lost response or failed saved-project reload
is not an unsaved form. Keep the original item and connector IDs, payload,
project revision and idempotency key. **Retry same creation** sends that exact
request and opens only its confirmed saved result; do not regenerate an ID or
offer discard while the outcome is unknown. Keep the page open during recovery.
A newly saved item hidden by the retained filters has an explicit **Show all**
choice, rather than silently changing those filters.

## Boundaries and verification

This is a navigation/presentation slice over existing queries and commands. It
does not change persistence schemas, exact Asset/template pins, Room geometry,
validation, lifecycle, task review, CAS or agent authority. No template editing,
deletion, furnished-room duplication, materialization, publication or runtime
activation is included. Preview stays approximate, engine-neutral and read-only.

Production verification must exercise empty and populated collections, filters,
template inspection, both creation paths, exact post-create selection, contextual
return, dirty/pending guards and read-only lifecycle states. Check keyboard access
and stable layout at 1440 px and 1060 px desktop widths. Apply the actual-diff
[risk policy](../../../docs/agents/CHANGE_RISK_AND_VERIFICATION.md); Windows is
opt-in only on Klaus's explicit request. Automated evidence, source integration
and Klaus's later bundled production acceptance are separate outcomes.
