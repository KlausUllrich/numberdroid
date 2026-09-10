# Review Changes — Approved Design

Status: **DESIGN APPROVED; recorded 2026-09-08. Product implementation and real-agent workflow verification remain pending.**

Klaus approved the shared Review mockup with “pass” after requesting a batch of
checks. The batch covered comparison and detail return, dependencies and full
acceptance, partial acceptance, feedback/history, discard, and an outdated
proposal. The reviewed artifact was `review-v1.html`, SHA-256
`7537b42f30f5d9fd7ae3d144d03781c7465720e7b5515aa314740953453e39df`.

This approves the design under the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md).
It does not accept implemented Studio behavior, the real-agent loop or VT-001 /
CP4.5. The [current task router](START_HERE.md) owns implementation sequencing.

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
