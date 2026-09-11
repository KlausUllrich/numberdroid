# Shared Review V2 — production UI block

Status: implemented candidate under integration verification, 2026-09-11. ND-2, with the approved ND-6/ND-7
navigation and Activity patterns. The [Review V2 design](REVIEW_CHANGES_DESIGN.md)
is approved; production acceptance remains separate. The
[foundation](SHARED_REVIEW_IMPLEMENTATION_CONTRACT.md) is integrated through PR247
at `1b4cbf1`, with green pre/post-merge CI and a real semantic-agent proof.

## Bounded promise and exclusions

Connect the approved Review screen to durable related Image/Animation/Assembly
groups. Preserve explicit selection/dependencies, feedback revisions, reconsidered
acceptance, exact viewed versus latest content, retained drafts/Details returns,
read-only historical events and exact retry of unknown outcomes. Show the actual
next actor on Library cards. Apply Back-left/deeper-action-right consistently to
the directly affected detail/editor/review headers and use readable Activity rows.

No source/cutter redesign, new media, nested Assemblies, automatic agent launch,
task-branch review replacement, portable Review bundle exchange, materialization,
runtime behavior or publication. Existing data is preserved; testing uses fresh
schema18 fixtures. Existing saved workspaces are never fixture preparation targets.

## Existing proposals: read-only inspection, one explicit first decision

An unconverted valid Image PENDING or Clip/Assembly PENDING/CHANGES_REQUESTED
proposal may use the common Review presentation through a labelled legacy read
projection. Reading/opening it changes no revision or stored proposal. Do not
fabricate persisted Review versions or group independent proposals by task ID.

On the first explicit owner feedback/accept/discard action, extend the existing
Review owner command with an initial form: expectedReviewVersion0 plus exact
legacySource {contentKind, proposalId, expectedProposalVersion}. Derive the stable
Review identity, title, proposer/task and ordered items from immutable source
history; callers cannot replace that content. Create Review v1 and perform the
requested action in the same semantic revision and SQLite transaction. This is
one logical decision, not an extra migration/approval ceremony in the UI.

Retain immutable legacySource provenance on the new Review, including source
revision/fingerprint. Permit only one link per project/kind/proposal across all
Review statuses. Preserve every old row and prior decision. Subsequent old typed
writes must fail with a conflict pointing to the authoritative Review; exact old
reads and already committed idempotent receipts remain available. Concurrent old
writes versus adoption use the existing project-head/version transaction boundary.

Build the candidate from the original content-bearing proposal revision, including
exact historical cuts and targets; never reconstruct it from whichever saved head
is current. A changed target blocks acceptance while feedback/discard remain
possible. A converted agent keeps its proposer/task identity, but revision requires
an explicit Review profile and scope; old grants gain no new authority.

Native Image DECIDED retains its existing recorded-decision/application path.
APPLIED/ACCEPTED/DISCARDED records remain read-only history. Technically invalid
legacy Image proposals remain inspectable through their protected existing path;
never weaken shared Review's ERROR rejection just to import them. Explain the
actual required correction. Preserve existing unknown pending writes during any
route change. No old content or acceptance is silently reinterpreted.

## Controller, preview and navigation

Separate pure Review UI state, request/controller lifetimes and DOM rendering.
The host owns project context and existing editor controllers. Review state owns
viewed Review/content versions, latest information, selection, presentation,
saved feedback versus draft, retained older drafts, and one exact serialized intent.

Use the service selectionOutcome for acceptance consequence and per-item exact
current/proposed records for inspection. Empty/unselected creations contribute
nothing. Do not make a new Assembly appear saved because its dependencies can be
resolved prospectively. Reuse existing image/Animation/Assembly rendering and
playback; the preview does not execute game behavior.

A newer agent content version requires explicit Review latest version. Retain
older unsent feedback separately; copying it to a new draft is explicit. A changed
feedback/decision version must not be labelled as new pixels, but still needs
current version reconciliation before writes. Closed outcomes become read-only.
Acceptance never silently saves an open feedback draft.

Details/Back preserves selection, presentation, raw draft text, disclosures,
initiating focus and page/panel scroll. Reopen disclosures before restoring scroll.
Late async responses cannot replace a newer route/project. Pending/uncertain writes
retain the exact body and idempotency key until the receipt is reconciled; a
refresh does not infer success or permit a different write. Keep the responsible
controller reachable even if another read reports completion.

Back/up controls live on the left with their actual destination; deeper actions
live on the right. Messages occupy reserved space and do not move the preview.
The primary actions remain usable at the approved desktop widths.

## Library, Sources, Tasks and Activity

Library groups come from authoritative Review data or one exact legacy proposal.
Filter shared groups by their affected content/use kinds. Pending badges on saved
assets reflect their own remaining changes, not already accepted dependencies.
The queue counts groups and shows the remaining/accepted item context. Sources
and applicable Agent-task entries route to the same supported Review identities.

Activity is a single column, newest first, with readable action/content names,
compact actor/time/outcome metadata and useful saved feedback. Resolve display
facts and links from the exact semantic event/revision, not current renamed heads.
Keep raw commands/IDs and multi-line diagnostics secondary. Missing legacy display
facts use an honest fallback, never guessed object names or fabricated recovery.
Failures remain visible and do not become owner approval tasks.

Inspect event is read-only and pins the recorded Review version. An Open current
review link is distinct. Preserve the existing Activity API where compatibility
requires it; an explicit owner read projection may enrich the new UI without
rewriting immutable events or broadening agent/private responses.

## Verification and finish

Risk **L3**: visible UI plus compatible owner-command/legacy authority evolution.
One owner each for legacy adoption, Review state/controller, Review view, and host
integration/Activity/navigation. Stage only task paths and publish coherent checks.

First falsifiers: no-write legacy reads; first feedback/accept/discard adoption;
old history/pins unchanged; stale/concurrent/duplicate adoption; feedback after a
target conflict; invalid/decided/terminal legacy boundaries; restart/integrity;
selection-specific preview; stale content versus feedback; exact request retry;
Details and editor return retaining draft/focus/disclosures/scroll.

Use fresh native Chrome 1440/1060 workflows, including all affected legacy capture
lanes before CI. Adapt obsolete UI selectors to the real production workflow,
never hidden test-only routes or fake semantic aliases. Run the actual-diff core,
build, Linux browser and Windows gates; independent reviews cover the triggered
state, authority, persistence, compatibility, navigation and presentation risks.

Exercise a real semantic agent with feedback and owner decisions through the new
UI before Klaus's production batch. Merge only the exact unchanged green head,
observe post-merge CI, start clean current-main Studio with fresh fixtures, and
record Klaus's explicit PASS/REVISE for the implemented block. Mockup approval and
backend proof do not substitute for that production decision.


## Candidate evidence and live gate

The implemented candidate is queued for [VT-024](VACATION_TEST_BACKLOG.md#vt-024--shared-review-feedback-and-activity).
Full relevant Studio core passed 1,149 tests with five existing skips; affected
recovery checks and native Chrome workflows passed after their final fixes.
Independent reviews cover state/recovery, legacy provenance, owner authority and
persistence, host navigation/history, and presentation. The real semantic-agent
round trip used actual owner browser controls for partial acceptance, feedback
amendment and final acceptance; accepted pins and earlier history stayed exact.
CI and immutable merge identities belong in the source PR record. Production
acceptance remains pending until Klaus explicitly reports the VT-024 result.
