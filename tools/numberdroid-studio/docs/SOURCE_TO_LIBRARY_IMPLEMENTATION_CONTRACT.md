# Source to Library — live implementation contract

Status: **WORKFLOW USER-PASSED; CUTTER FOLLOW-UP OPEN; NOT MERGED — 2026-09-18**.

Klaus approved the [workflow design](SOURCE_TO_LIBRARY_WORKFLOW_DESIGN.md) and
requested the live version, explicitly retaining the original image and precise
cutting tools. This L3 block evolves the earlier
[Sources presentation contract](SOURCES_NAVIGATION_IMPLEMENTATION_CONTRACT.md).
Klaus reported “all pass.” for the production VT-025 batch on local `53885f5`
(remote `e89e459`, identical tree). The workflow pass is separate from green
Build2488 and from merge. His five bounded Cutter interaction/presentation
findings remain open in the [Backlog](VACATION_TEST_BACKLOG.md#vt-025--source-images-and-image-workbench).

## One coherent promise

Keep the accepted Cutter unchanged as the editing surface. Cut images is left;
View Output is right. Output images have visible Library destinations: Add new,
Update a named Image, or Skip. Show old/new previews only for a selected update.
The normal authoring path has no separate saved-cut inventory or second approval.
Internal exact cut records and accepted Animation/frame authoring remain intact.

The owner saves one recoverable batch into Library. New content is DRAFT, not
automatically validated/placeable. Updating an Image retains its kind and all
unexposed metadata, validates the new exact imagery and creates a new version.
Existing Room/Assembly/Animation pins do not change. A new immutable original
can target an existing Library Image explicitly; automatically copying an earlier
original's cut layout is excluded from this first block.

## Atomic application and recovery

SourceLibraryService is a transport-independent owner workflow over the existing
atlas.commit.slices and asset.save commands. It validates a bounded explicit
destination vector and simulates the commands against a shared-head document,
then atomically appends the semantic revision batch and one durable outer receipt.
Failure rolls back cuts, jobs, Asset versions, references, Activity and receipt.
No browser loop performs individually committed Asset saves.

Migration 0019 adds only the project-scoped workflow receipt store. Previous
migrations/checksums remain unchanged. Exact request fingerprint, owner identity,
input coordinates and resulting destinations support same-key replay even after
the head advances and after restart. Changed input with the same key fails closed.
An unchanged already-saved destination produces no extra Asset version.

Inputs identify the atlas version/fingerprint and either a generated job or exact
saved slice coordinates. The server resolves all digests, source lineage and
bindings; caller-supplied authority, paths or CAS descriptors are not accepted.
Targets are same-project leaf Images with exact expected Asset/metadata versions;
two outputs cannot update one target. Update preserves current metadata, while
new images receive explicit typed draft metadata. Skip affects only this batch's
Library destinations and never removes existing content.

A regenerated job whose results already have exact saved counterparts must not
be blindly committed, ignored, or falsely marked APPLIED. Explain the redundant
generation, offer explicit existing-job discard, then use verified saved inputs.
An unknown save result locks and retries the original immutable request/key.
Client recovery storage is untrusted convenience, never mutation authority.

HTTP uses the existing local-owner, Origin/CSRF, bounded-body and cancellation
boundary. Current MCP counts, grants, scopes and owner-only Save remain unchanged.
Agents retain their existing semantic cutting and proposal/review operations;
this block does not advertise a new batch MCP tool or solve isolated task cutting.
Known schema19 is admitted explicitly by existing optional profile handshakes;
unknown newer versions still fail closed.

## Source and Library independence — Klaus clarification

The source relationship is provenance, not a requirement to keep unwanted items
in Library. Show the named original and retained exact relationship. Deleting a
Library item must not implicitly delete its original; removing a source from
browsing must not cascade to existing Library images. Their exact bytes and
necessary history remain retained independently. Warnings should name actual
consumers such as Rooms or Assemblies, not merely the existence of the original.
When no content needs an original, offer source cleanup separately and optionally.
Reference closure includes retained history and jobs, not merely visible cards.
Archive, hard deletion and physical CAS cleanup are NOT implemented in this block.

## Selected gates and exclusions

Focused evidence first: typed destinations, duplicate/cross-project/stale denial,
every-stage rollback, same-key/changed-key replay, restart, repeated nine-cut input,
metadata/history pins and unchanged agent authority. Then one full Studio run,
build/evidence, native cutter+workflow browsers at1440/1060, actual-agent semantic
correction/review proof, Linux/Windows CI and independent actual-diff reviews.
Keep the reported live fixture intact; use freshly allocated test directories.

No new source-family schema, image generation/provider call, runtime output,
materialization, repository publication/release, remote authority or cleanup.
Source rollback must account for schema19 before any old reader is restarted;
do not downgrade SQLite or silently remove user-authored workflow receipts.

## Current implementation evidence — 2026-09-18

The production HTTP routes, controller and app integration now exist. Native
checks cover Add into Library, repeat without duplication, Library return,
Animation exact-frame use, lost-response/reload replay and named updates that
retain old versions and Assembly pins. Focused service, HTTP, integrity and
controller checks are green. Schema-compatibility regressions were corrected
without changing old migration checksums or frozen Checkpoint1A evidence.

Independent review found cancellation and receipt-intent integrity gaps; both
received focused repairs. Migration19 rollback/resume and true second/third
asset rollback evidence were added. Final independent reviews, complete selected
gates, CI and Klaus's new live decision remain separate requirements. Native
screenshots and automation do not accept VT-025. No live retained data was opened.

## Historical shutdown checkpoint — 2026-09-16

Resumed on 2026-09-18 at Klaus's explicit request. Remote main remains
`d7c1d2a7978c5624baacf243ea9c21d530a9ec6c`; the preserved workspace below
remains untouched. Backend service/integrity/HTTP focused repairs now pass;
production UI integration, full gates, independent reviews and acceptance are
still pending. The shutdown facts below are historical continuity, not a renewed
instruction to pause.

Klaus requested a pause before further implementation and planned to return in
two days. Work stopped until his explicit resumption above. The following records
what existed at shutdown, not the current candidate's implementation state.

Canonical remote main was reverified through the connector as
`d7c1d2a7978c5624baacf243ea9c21d530a9ec6c`, tree
`f82e41cf2e0e52e6f3c18f81bafd7e0c1c0fce31`.
The unfinished block is checkpointed on `agent/source-library-live-20260916`.
The local branch is `agent/source-library-live-local` in
`/home/klaus/.bb/thread-storage/numberdroid-review-proposed-addition`.
Resolve both heads again on return; local and connector commit IDs may differ
while their trees match. The checkpoint includes the preceding Sources UI
candidate, not just the new backend scaffold.

Existing PR #255 remains open and unmerged at
`3e42460b36cdecf1cf99d39382e4feec3b736c31`. Build #2483 / run `35112923249`
failed the outdated button-order assertion in `saved-slice-labels.node-test.js`.
That failure has not been repaired or reverified. The separate approved design
prototype is also durable on `agent/image-library-workflow-design-20260916` at
`bd29b9d5b25740146a8d6a522f4cbbee8db29477`.

### What exists, and what does not

- SourceLibraryService, atomic receipt store/migration19, integrity integration,
  schema19 MCP compatibility assertions and focused tests have been started.
- `source-library-controller.js` is an **unconnected UI scaffold**. HTTP routes,
  app integration, static-file wiring and styles are not implemented.
- The production cutter has not been removed or changed by this new block.
  No new code was installed into the retained running Studio process.
- Do not restart this checkpoint against the retained workspace: merely opening
  its writer may apply unfinished migration19. Use fresh disposable fixtures
  for development; keep the preserved original immutable.
- No deletion, archive, automatic source-layout reuse, agent authority expansion,
  runtime activation or release is authorized by this checkpoint.

### Last evidence and known unfinished work

The service tests completed before the pause: 4 passed, 1 failed. Updating an
Image incorrectly passes normalized metadata (including derived `pixelSize`,
and potentially `slicePivot`) into the authored-input validator. Convert through
the existing metadata-to-input helper while preserving hidden authored metadata;
old-pin/new-original update behavior is not yet proven.

Schema19 MCP compatibility assertions: 4 passed. Integrity tests: 1 passed,
1 failed; the portable assertion reads `portable.assetLibrary` instead of
`portable.project.assetLibrary`. The backup/restore portion passed, but that is
not full recovery acceptance. The checker still rejects a valid generated
all-skipped receipt and needs reverse command-receipt closure checks. Convert
manual receipt fixtures into actual service operations before claiming proof.

The unconnected controller also needs review of unknown-result recovery,
session-storage failure/malformed state, confirmed-save versus refresh failure,
and async lifecycle/source identity guards. No full suite, browser integration,
actual-diff review, new CI gate or user acceptance has passed for this block.
All delegated workers and their disposable test handles were stopped at pause.

### Retained test data and servers

Both owned BB terminals exited with code 0 after Ctrl-C:
`term_vw52252qpg` (Studio, port4317) and `term_hvmn5jt2rb` (prototype, port4327).
Both ports then refused connections. The public links are intentionally offline.

After shutdown, the entire retained workspace was copied without opening a
migrating writer from `/tmp/numberdroid-vt025-live.gQkRn2/data` to:

`/home/klaus/.bb/thread-storage/numberdroid-pause-20260916.p3Pj7e/workspace`

Recursive byte comparison passed, the destination was synced, and SQLite
read-only `quick_check` returned `ok`. This is an offline preservation copy,
not an activated restore or a canonical O0 backup bundle. SQLite sidecars and
the writer-lock file were retained as found; inspect the normal stale-lock
recovery rules before restarting a working copy. Do not delete the retained
lock blindly or modify this preserved copy. No user data was deleted.

On return, reverify main, checkpoint and PR status, read the current bootstrap
and the binding design/implementation documents, then finish one coherent
production block on fresh fixtures. Preserve the precise live cutter. Complete
selected L3 gates and independent reviews before one bundled user test; do not
ask Klaus to test this scaffold or infer acceptance from earlier mockup passes.
