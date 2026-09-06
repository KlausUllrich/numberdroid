# Human Asset authoring from a saved slice

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**. Date: 2026-09-07.
This candidate fills a missing human UI step in the accepted Checkpoint 2C
proposal workflow. Source integration and verification belong in its focused PR.

## Promise

A designer can choose one exact saved image slice, describe its purpose and
placement, and prepare a proposal through the existing human-owner endpoint.
The existing review, explicit decision and separate Apply action then create
one editable DRAFT Asset. It can be placed in a DRAFT Room without automatic
validation, finalization, runtime eligibility, materialization or publication.

The prior human-local readiness statement described available foundations.
It overstated the complete UI path: the cutter saved slices, but neither those
cards nor the Asset Library provided a human proposal composer. This candidate
adds that missing action; it does not replace the accepted proposal semantics.

## Bounded form

**Create asset from this slice** opens **Prepare asset for review** in Assets.
The exact saved preview, slice ordinal and version remain visible, with stable
identifiers secondary. The designer supplies a name and purpose, selects
Surface, Prop or Item, and reviews the editable placement settings:

- footprint width/height in cells and an anchor cell inside that footprint;
- fixed orientation or four cardinal rotations;
- attachment and suitability at room boundaries;
- passable with no collision, or blocked across the complete footprint;
- visual prominence and intended game use versus Studio-only use.

These are proposed form choices, not semantics inferred from image pixels.
Surface attachment stays ground-only. The initial candidate covers manual
placement and simple collision. Connector families, collision parts, navigation
costs, custom extensions, bulk creation and updates to existing Assets remain
outside this form. The saved slice's pixel pivot and imagery are unchanged.

## Exact context and recovery

The draft pins project revision, saved slice ID/version and generated proposal,
item and Asset IDs. Submission carries one `create` item with expected Asset
and metadata versions zero. The server resolves the immutable image binding;
the form supplies no image bytes, digest, path, artifact URI or binding record.

Compatible refresh preserves entered choices and editing context. A changed
project or saved slice blocks automatic submission and keeps the draft visible
until the designer deliberately rechecks or reselects. A submitted request and
its idempotency key remain fixed during uncertain delivery. Reconciliation
checks whether that exact proposal already exists before creating another request.
Outcome reads abort after eight seconds, and late or superseded results cannot
replace the active draft. A later rejected retry does not erase uncertainty
about an earlier submission.

Preparing a proposal adds no Asset. Review findings remain visible; Accept or
Reject and Apply keep their existing owner-only confirmation. Applied Assets
start as DRAFT. Later lifecycle and warning decisions remain separate.

## Verification and live decision

Completed local automated proof covers all three metadata kinds against the accepted
validators, invalid and stale contexts, immutable request retries, and native
Chrome at 1440 and 1060 pixels. The final Studio suite passed 797 tests with
five expected platform/Chrome skips; the build checked 254 JavaScript files.
Seven dedicated runner checks also passed, including real Chrome cancellation.
The browser sequence starts with fresh saved
slices, prepares and applies a human proposal, places its Asset in a Room, then
restarts and verifies the same saved semantic content. Physical keyboard
rotation retains focus and pressed state. Independent metadata, authority,
recovery, usability and evidence reviews cleared their findings. Existing protected
Studio checks, platform gates and independent actual-diff review still apply.

The live decision remains deferred under Klaus's unattended-development
steering. It is recorded separately as VT-017 in the
[Vacation Test Backlog](VACATION_TEST_BACKLOG.md). No automated result is user
acceptance or a production source selection.
