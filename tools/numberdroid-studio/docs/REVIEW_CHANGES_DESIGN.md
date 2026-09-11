# Review Changes — Approved Design

Status: **V2 DESIGN APPROVED — PASS, 2026-09-11**. Shared Review production
implementation and its real-agent/user verification remain pending.

Klaus approved the shared Review mockup with “pass” after requesting a batch of
checks. The batch covered comparison and detail return, dependencies and full
acceptance, partial acceptance, feedback/history, discard, and an outdated
proposal. The reviewed artifact was `review-v1.html`, SHA-256
`7537b42f30f5d9fd7ae3d144d03781c7465720e7b5515aa314740953453e39df`.

This approves the design under the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md).
It does not accept implemented Studio behavior, the real-agent loop or VT-001 /
CP4.5. The [current task router](START_HERE.md) owns implementation sequencing.

## V2 approval — 2026-09-11

Klaus explicitly reported **“All pass”** after the five-item Review V2 mockup
batch: request changes and the Library status; saved feedback editing/cancellation
and history; reconsidered acceptance; a newer proposal while feedback is being
drafted; and contextual navigation plus readable Activity rows.

Approved artifact: `review-v2.html` in
`/home/klaus/.bb/thread-storage/numberdroid-design/`, SHA-256
`fd318a5f13a81940c6253f6ecd1c1a4f51efaaaf63181a6bf7127cd74839bde9`.
The verified file is attached to BB Tasks ND-2, attachment
`01M283JQNMXARF95H4XZXKDB4E`. Chrome checks passed at 1440 and 1060 widths
(28 checks each), followed by four focused presentation checks. The mockup
uses in-tab sample state; simulated agent and saved-asset changes are test helpers.
They prove neither production persistence nor an actual agent launch.

This V2 refines the V1 design below. ND-2 / [#237](https://github.com/KlausUllrich/numberdroid/issues/237)
owns shared Review implementation. The demonstrated navigation and Activity
patterns also inform ND-6 / [#243](https://github.com/KlausUllrich/numberdroid/issues/243)
and ND-7 / [#244](https://github.com/KlausUllrich/numberdroid/issues/244); their
application-wide implementation and production acceptance remain separate.

## Goal and shared entry points

The subsequently approved [Library navigation design](LIBRARY_NAVIGATION_DESIGN.md)
records the Library queue and entry/return behavior, including retained filters,
whole review dependencies, partial groups and completed reviews in Activity.
Klaus's 2026-09-10 Library mockup PASS confirms that design connection; it does
not accept a production shared-review implementation.

Help the owner understand an agent's concrete changes, accept useful independent
results, or return actionable feedback without a separate proposal ceremony.
Sources → Needs review, Library → Pending changes and Agent tasks open the same
review and saved decisions. Completed reviews leave the active queue and remain
available in history. Human edits do not acquire a redundant agent review step.

Use a large central preview with **Current / Proposed** selection and a compact
change list. Show what is new, what changes, and what remains unchanged. The
example adds a Coffee-ready indicator asset and updates a Coffee machine assembly
to reference it and move the display; blocking remains unchanged. The asset can
be accepted independently; the assembly update needs that asset.

Presentation-state selection and change highlighting are inspection controls.
They do not change saved content or execute game behavior. Proposed preview must
reflect the selected changes, with a clear consequence before acceptance.
Details expose the affected asset/component versions and source relationships.
Back retains the review, selected changes, presentation, feedback drafts and
compatible focus/scroll context. Opening the updated assembly after acceptance
retains the presentation the owner just reviewed.

## Selection and acceptance

**Accept selected changes** applies the selected valid changes once. Selection
alone changes no project content. Dependencies are visible; a missing dependency
or empty selection disables acceptance with an explanation in a reserved-height
area above the scrolling change list. Messages must not move the preview.

Independent changes may be accepted while other work stays pending. Accepting the
indicator first must leave the assembly update available for later review; that
remaining update can then use the accepted version. A full acceptance produces
one coherent content revision. Retrying the same acceptance must not apply it
again. Show a receipt identifying what changed and what remains pending.

Acceptance refers to the exact proposal and current target versions. If the
assembly changed since the proposal was prepared, show that conflict and block
stale acceptance while allowing inspection and feedback. Never overwrite newer
work or silently change which content the owner approved. Saved Room and assembly
references remain pinned until an explicit validated update changes them.

## Feedback, history and discard

**Request changes** requires a feedback summary and permits per-item comments on
pending changes. Returning from details retains the draft and opened feedback
sections. The action records feedback and accepts no content. Previously accepted
items remain accepted and must not receive misleading pending-item feedback.
Show the saved summary/item comments, decision and remaining work in history.

A subsequent authorized agent must be able to read that durable information
through Studio's semantic interface. Permission to continue is distinct from
starting or delivering work to an agent; the UI must state the actual outcome.
No automatic agent launch was implemented or proven by the mockup.

**Discard proposal** is secondary, under the additional-actions menu. It abandons
remaining proposed work, preserves changes already accepted, and leaves a receipt
and decision history. It is not a second everyday negative-review action beside
Request changes. Abandoning work must not delete source material or Library
content that already exists.

## V2 feedback and reconsideration rules

**Pending changes** remains the queue name. Cards and review views show
**Needs review** when the owner's decision is needed and **Awaiting agent** after
feedback is saved for agent-authored work. The displayed saved Asset does not
change when feedback is submitted. A returned agent revision needs owner review
again. Use the actual next actor; do not imply a running background job or invent
an agent recipient for human-authored work.

After Request changes, display the saved summary and applicable item comments
with **Edit feedback**. Saving an edit appends an attributable feedback revision;
it must not erase the original message or earlier decisions. Cancelling an edit
keeps the last saved feedback. Unsaved drafts must be visibly distinct from saved
instructions and survive supported Details/Back excursions.

The owner may reconsider and **Accept selected changes** from the same unchanged,
valid proposal after requesting changes. Preserve the earlier feedback/history.
Acceptance must never silently save a feedback draft: require the owner to save
or cancel that edit first. Completed acceptance is still immutable; this is not
permission to rewrite an already accepted decision.

If a newer proposal arrives while an older one is open, keep the viewed proposal
pinned and block acceptance and feedback submission against that stale view.
Offer **Review latest version**. Preserve unsent older feedback separately; do not
silently attach it to changed content. An explicit **Use as a new feedback draft**
may copy it for editing against the latest version, limited to remaining items.
A changed saved target still blocks stale acceptance while allowing inspection
and actionable feedback to request a refreshed proposal.

After partial acceptance, feedback and subsequent decisions cover only remaining
work. Accepted dependencies remain available and visible. Revised proposals must
not reopen or overwrite accepted items. Every mutation needs exact-version,
permission, idempotency and concurrency checks in the production implementation.

## V2 navigation and Activity presentation

Place **Back/up on the left**, labelled with its actual destination, and deeper
Details/Open/Edit actions on the right. Breadcrumbs may clarify longer paths.
Restore the originating view, selected changes, presentation, feedback draft,
open disclosures, focus and both page/panel scroll positions. Reopen disclosures
before restoring scroll so collapsed content cannot clamp the retained position.
Status/error messages must not move the preview, and an obsolete status toast
must not remain visible after the user navigates to a newer decision/result.

Activity uses **one readable event card per row**, newest first. Lead with a
human-readable action and content name, followed by compact actor/time/outcome
metadata and useful saved feedback. Preserve technical failure history and explain
its effect; do not turn a rejected agent command into an owner approval task.
Raw commands, status codes, identifiers and multi-line diagnostic details remain
secondary. Keep exact historical references rather than resolving an old event
against whichever content happens to be current.

**Inspect event** opens the recorded event read-only, with an optional distinct
**Open current review** link for outstanding work. Historical decisions and
feedback are not editable from that event view. Completed work leaves the active
queue, remains available in Activity, and preserves all previously accepted assets.

## Verification and implementation boundaries

The standalone mockup passed 23 focused native-browser workflow checks, seven
checks after a dependency-message/feedback-history refinement, and three full
acceptance/return-state checks. Klaus then passed the six-scenario batch. Demo
Reset and Ready to review / Assembly changed controls were scenario helpers;
they are not production authoring controls or persistence evidence.

The current [2C contract](CHECKPOINT_2C_CONTRACT.md) uses complete item decisions,
required rejection reasons and separate decision/application commands. The
[task feedback candidate](TASK_REVIEW_FEEDBACK.md) supplies existing durable
feedback foundations. Implementing this design requires explicit, compatible
command/state evolution for partial pending work, dependency validation and a
single clear acceptance action. Do not imitate the design by bypassing owner
permissions, exact-version checks or existing atomic application boundaries.
Technical validation must produce actionable findings for the agent before
owner review; user acceptance does not waive technical invalidity.

Prove persistence, concurrency, duplicate requests, version preservation,
permission boundaries and recovery for the actual implementation. Then exercise
the complete workflow with a real agent through supported semantic tools,
including correction and reading saved feedback/decisions, before requesting
Klaus's product verification. Use focused development checks and the actual-diff
risk gates. When Klaus requests multiple tests together, provide a batch with
independent scenarios and clear starting states; repeat only affected checks
after a finding. Design approval, automated green, integration and product
acceptance remain distinct. VT-001 / CP4.5 and A1.7 remain REVISE.
