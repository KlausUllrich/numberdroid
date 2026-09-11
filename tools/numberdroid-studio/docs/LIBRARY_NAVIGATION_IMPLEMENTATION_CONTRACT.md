# Library navigation — implementation block ND-1

Status: **USER ACCEPTED — PASS, 2026-09-11**. Klaus explicitly reported “all pass.”
on clean main `1c5c587` (PR #242); see VT-023 for the bounded acceptance and follow-ups.
The [approved Library design](LIBRARY_NAVIGATION_DESIGN.md) owns the experience.
This is its first bounded implementation block and BB Tasks ND-1 / GitHub #236.

## Promise and exclusions

Provide Assets/Pending changes navigation, compact saved Image/Animation/Assembly
cards, Content/Use/search filters, whole-content full-size inspection, in-app
details, existing editor entrances, retained return context and review/history
entry points. Sources keeps its saved cuts; Create Assembly remains in Library.

Every current proposal is one typed review group. Native PENDING/DECIDED proposals
remain outstanding; Animation/Assembly PENDING/CHANGES_REQUESTED remain outstanding.
An unresolved saving/uncertain controller remains reachable even if refresh shows
that its proposal completed. Completed records are inspectable from Activity.
The queue does not synthesize atomic mixed-content groups or unsupported partial
acceptance. ND-2 owns that later command/state evolution. Existing review decisions,
application steps, lifecycle transitions and exact retry behavior are preserved.

No schema, command, MCP discovery, grant, backend review, Room placement, Sources
redesign, new media/provider, task Resume or runtime export change is included.
Pure navigation and inspection never append project revisions. The removed
Taskboard plugin is not a development dependency; Tasks and GitHub #236 track work.

## Transient navigation and data

Use a separate Library UI state with a project identity, current list/detail/review
route, independent Assets/Pending filter state, return stack and per-route DOM
snapshots. A detail identity includes content kind and exact Asset/metadata versions;
a review identity includes content kind and proposal identity/version. No controller
or mutable authoring draft is serialized into this navigation state.

Keep existing Asset, Assembly/embedded geometry, Animation/contextual Cut controllers
as the owners of their drafts and writes. Preserve their precedence in the workspace
renderer. A harmless Details/Back excursion retains the controller instance; a real
project/workspace/editor replacement still invokes its existing leave guard. Pending
or uncertain saves/decisions retain identical serialized requests and keys. Review
feedback and Current/Proposed selection survive a supported Details return.

Capture page and marked inner scroll positions, the initiating focus key and input
selection. Editor rendering must not overwrite a retained Library list/review return
snapshot with unrelated editor DOM. Restore only a matching project/route. Same-project
refresh keeps context; project switching invalidates reads and transient navigation.
Existing Sources/Cutter entry and return behaviors remain intact.

Use explicit image/animation/assembly discriminators in the combined Library only;
keep native-only Room and legacy readers unchanged. Search current names/tags and
resolved source names where available. Each card shows a saved version; pending
badges open the complete existing proposal independently of Library filters.

## Detail and preview boundaries

Reuse the existing exact Animation/Assembly reads, their eight-second bounded
requests, project/revision/pin checks and stale-response protection. Native saved
image records retain their exact slice binding. Detail routes must not substitute
a new head for a pinned record. An external change may leave the older detail
inspectable with an explanation; editing requires an exact current target match.
Proposed detail is explicitly read-only and labelled with its proposal identity.

Images use their exact project-scoped artifact. Animation inspection includes
its canvas and frame overhang, preserving offsets. Assembly inspection uses the
resolved scene and shared framing. Do not claim that its first component/frame
artifact represents the whole composition or invent a persistent composite PNG.

A full-size composite inspection may use a transient read-only browser document
containing the exact paused SVG composition with absolute project-scoped image
URLs. It has no script or mutation controls; escaped names and validated URLs never
become executable markup. It is inspection, not export/materialization. Anchor links
use noopener; bounded preview caches own and release transient object URLs. Missing
or failed artwork is explained, never replaced by unrelated/current content.

Native lifecycle/warning controls move into detail, retaining their current
validation and owner semantics. Source/metadata/frame/component summaries are
contextual; the accepted editing tools open in the same application and return
to their originating Library route. Existing per-type review controllers remain
responsible for decisions. Activity links resolve durable proposal identities,
not guesses from free-text event summaries.

## Ownership and verification

This is L3 visible UI with navigation, recovery and read-only boundaries. Root owns
app glue, the contract, static routes and integration. Separate owners implement
Library state/view/detail helpers, review-detail callbacks, and focused/native proof.
No owner edits another owner's files without coordinating a handoff.

Start with focused state/navigation and existing editor integration checks. Add
native 1440/1060 coverage for compact whole previews, full-size target decoding,
filters, exact detail/return, all editor entrances, pending/history routes, feedback
and unknown-outcome retention. Use fresh fixtures and compare saved state before
and after navigation. A real semantic agent creates/corrects work and reads a
recorded owner decision through the changed review entry path before Klaus's batch.

At code freeze perform the tier-required independent review pass and actual-diff
selected Studio suites/build, Linux browser evidence and Windows compatibility.
Do not rerun unaffected broad green suites after a local finding. Reuse a selected
native runner for a distinct Library evidence lane without modifying CI routing
merely to add duplicate workflows. Drain browser/server/worker/database handles
before fixture cleanup. Publish coherent checkpoints and merge only an unchanged
exact green head, then observe post-merge CI. Source integration is not user
acceptance; record a new VT item only after implementation exists.

## Implementation verification — 2026-09-11

The bounded Library implementation now exists: current-content cards, independent
tab filters, exact details/full-size inspection, retained editor/review return,
current per-type proposal queues and Activity history. Native lifecycle/validation
information stays inspectable in read-only details; writes retain existing gates.

Focused state/review/race tests cover delayed editor opens, external terminal
review decisions, exact ordered Animation bindings, viewport retry, live preview
URL ownership and repeated/external return-context cleanup. Native Library and
adapted Asset/Assembly/Animation lanes pass at 1440/1060, including actual image
containment and full-size framing, all references/transforms, decoded pixels,
unknown decision retry and cleanup. The focused PR owns final source/CI identities.

[VT-023](VACATION_TEST_BACKLOG.md#vt-023--library-navigation-and-contextual-details)
records the separate production live gate. This block does not implement ND-2's
shared mixed-content acceptance; existing review semantics remain visible.
