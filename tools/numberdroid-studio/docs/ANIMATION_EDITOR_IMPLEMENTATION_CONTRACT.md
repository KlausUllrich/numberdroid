# Animation editor — compatible implementation contract

Status: authorized implementation, 2026-09-10; product acceptance pending.
The [approved design](ANIMATION_EDITOR_DESIGN.md) owns the experience. This
contract defines the bounded production block before its source implementation.

## Promise and exclusions

Create/edit a Library Animation asset from exact saved PNG cuts, preserve timing,
alignment and named frame occurrences, play once/loop/ping-pong, revise a source
cut without losing the parent draft, and use exact saved clip versions in Assembly
presentation states. Own human saves are direct; agents submit reviewable changes
and read owner feedback through Studio's semantic interface.

No animation timeline beyond ordered image frames, audio, nested Assemblies,
gameplay state machine, Numberdroid export/materialization, new provider work or
production art is included. Clips supply visual content, not inferred blocking.
Native Asset/Cutter behavior, old Assembly v1 data and existing owner/agent
boundaries remain protected. Room placement of clips/Assemblies remains unsupported.

This is one L3 block with domain, persistence/recovery, command/authority,
deterministic crop integration and UI seams. Publish coherent checkpoints while
working; merge only the exact selected green head, then observe post-merge CI.

## Clip identity and exact frames

Use optional `clipLibrary:{schemaVersion:1,assets,proposals}` only when clip
history first exists. A clip record has contentKind `animation`, stable assetId,
assetVersion/metadataVersion, name, kind (surface/prop/item), lifecycle DRAFT,
metadata `{role:null|string,tags:string[]}`, a `clip` declaration, fingerprints,
findings and creation/proposal provenance. It has no synthetic first-frame
ExactSliceBinding and does not enter native-only Asset or Room inventories.

The strict declaration is:

```text
schemaVersion: 1
coordinateSpace: clip-pixels
fps: positive finite number
playbackMode: once | loop | pingpong
unitsPerPixel: positive scalar (default 1/64)
canvas: {width,height}
anchor: {x,y}
frames: [{frameId,name,slice:{sliceId,sliceVersion},durationMs:null|number,
          offset:{x,y}}]
```

Frame IDs are unique occurrences within a clip; repeated cut references are
allowed. Resolve each exact historical cut at the command base revision,
including cuts never adopted as native Assets. Preserve the current-head-only
resolver used by existing native Asset saves; add a separate historical resolver.
Validate the complete immutable source/rectangle/processor/CAS lineage, not only
a matching image digest. Never substitute current cut heads for pinned versions.

Initial explicit resource bounds: 1–256 frames, FPS 0.1–120, duration override
1–60,000 ms, canvas dimensions 1–65,535 pixels, finite anchor/offset coordinates
within +/-65,535, and at most 256 KiB canonical declaration. Physical canvas size
must remain within 64 project units per axis. Reuse existing PNG/source/job byte
bounds. Bound unique frame pixels to 256 × 1024 × 1024 and resolved geometry
coordinates/spans to 1,000,000 pixels; bound response bytes independently of input.
These are resource limits for this implementation, not a universal game model.

Timing is pure and shared by editor, Assembly playback and tests. Default duration
is 1000/fps. Ping-pong visits 0..N-1..1 repeatedly, without extra endpoint visits;
each visit uses the frame's own duration. One-frame/two-frame cases are explicit.
Playback, selection, eye toggles and clocks are transient and never append project
revisions. Pause retains phase; explicit frame selection seeks its forward visit.

Metadata fingerprints cover kind/metadata/declaration; name-only edits do not
increment metadataVersion. Every committed content save creates a DRAFT version.

## Commands and cut-revision jobs

Add owner-only `clip.save`, scoped `clip.proposal.submit`, and owner-only
`clip.proposal.resolve`, following the proven Assembly exact-version pattern.
Create uses expected Asset/metadata versions 0/0; update uses exact current values.
Pending proposals are immutable; only the same proposer/task may revise the exact
CHANGES_REQUESTED version. REQUEST_CHANGES requires feedback. ACCEPT revalidates
dependencies and atomically saves the version with its owner decision. DISCARD
saves no clip. Failed validation and exact replay do not double-charge budgets.

Contextual cuts use `slice.revision.prepare` and `slice.revision.commit`, each with
its own scoped agent permission. Both also admit the local owner. Requests carry
exact project revision, source slice/version, expected current cut and atlas
versions, stable job/idempotency identity, name and pixel rectangle; they never
accept caller-supplied output digests, paths or authority.

Prepare resolves the requested historical source, verifies the current target and
approved source, and preserves every unrelated atlas rectangle and cut head.
If a matching saved revision exists, return that exact binding with a replayable
semantic receipt and no new pixels or job. Match source identity, crop origin,
size, name, pivot/padding and processor; exclude replacement bookkeeping from the
image-equivalence comparison. Never match on digest alone.

Otherwise queue a single-cut revision job through the existing deterministic PNG
processor. Use a versioned ATLAS_PREVIEW input describing the exact original atlas
head and proposed one-cut change. Keep the existing full-atlas preview path and
its schema-v1 input/output unchanged. Preparing this job does not replace the
current atlas definition or its unrelated preview selection.

Commit requires a succeeded, unapplied job, exact source/target heads and original
creator/owner authority. Atomically apply its one output, append the new cut
version/binding, update the relevant atlas definition version with all other
rectangles retained, save references/receipt, and mark the job APPLIED. A pending
ordinary atlas preview must not be overwritten; stale source/atlas/cut versions
fail actionably. Cancel/retry/discard use existing job ownership and safe points.
Preserve pivot/padding semantics explicitly when revising a rectangle; reject an
unsupported or invalid change rather than silently discarding metadata.

Preparing charges only the actual job and predicted output-byte usage; matching
reuse creates neither. No background work is described as completed until its
exact receipt is read. Concurrent/uncertain outcomes retain the original intent
and idempotency key. Orphan output handling follows the existing job/CAS lifecycle.

The UI holds the entire Clip controller while a separate contextual cut controller
uses the same tab. Reuse accepted pure cutter geometry/validation; do not swap or
overwrite the global Cutter session. Back retains raw cut fields, view and history
without applying them. Use updates chosen occurrences in the Clip draft as one
Undo step, using each old pin's origin for offset compensation. It preserves
names/timing/shared canvas/anchor and does not retarget saved clip/Assembly versions.
Known own cut-command receipts advance the parent project context; unrelated
concurrent target changes remain conflicts. Clip Save never silently applies a
pending cut draft.

## Assembly v2 and playback

Keep v1 declarations and their normalized bytes/fingerprints unchanged. Upgrade
an editing draft only when it first needs the new content/state capability.
V2 retains shared bounds/anchor/units, named states/variants, component transforms,
order and membership. Replace the v1 asset field with typed content:

```text
content: {kind:image|animation,asset:{assetId,assetVersion,metadataVersion}}
       | {kind:none}
stateOverrides: [{stateId,content}]
variantOverrides: [{variantId,content}]
```

Explicit state content wins for that component; otherwise use its variant override
or base content. State membership still controls whether the component participates.
Explain this precedence in the UI. The body's cosmetic variant remains independent
of the display component's state clip. Same-state variant cross-products are not
implicitly invented by this first declaration.

Image content keeps the accepted native geometry mapping. Clip canvas/anchor and
frame offsets map from clip pixels through unitsPerPixel, then the Assembly's
component transform. Clip frames contribute no inherited blocking; native body
Assets or explicit Assembly custom geometry supply it. No first-frame collision
approximation is allowed. Validate/bound every declared state/variant and frame
extent, caching unique pins and enforcing bounded closure work.
V2 resolves at most 4,096 unique frames and 8 MiB of exact dependency records;
the complete exact-read response is capped at 16 MiB. V1 bounds stay unchanged.

Return typed scene elements: native image descriptors or exact saved clip/frame
descriptors with timing and image transforms. Do not attach a fictitious native
sliceBinding to a clip or rasterize the Assembly. A component's playback clock is
keyed by its identity and effective exact clip pin. An unrelated variant change
preserves phase; an effective content change resets only the affected clock.
Paused/review/Library previews are labelled and remain read-only.

The corrected human Review layout remains common: report clip/state-content
changes in plain language, keep stable Current/Proposed framing and exact retries.
Use saved clip versions in Assembly drafts; uncommitted clip edits remain separate.

## SQLite, integrity and exchange

Add migration0017. Do not alter checksums001–016 or existing native slice FKs.
Add clip identity/version/head/tag/finding tables, frame pins to immutable
asset_slice_bindings, and proposal version/head/frame-pin tables. Clip identities
share the logical Asset namespace with native/legacy/Assembly/processing content;
use bidirectional collision guards without rewriting pre-existing overlaps.

Add separate v2 Assembly content-pin tables for saved versions and proposals,
with explicit image/clip target FKs and metadata-version validation. V1 uses its
unchanged native pin tables. Persist all state/variant/base slots and verify their
order/content against the immutable declaration.

All semantic writes participate in the existing revision, Activity, idempotency,
budget and reference transaction. Non-clip commands preserve clipLibrary; task
branch operations cannot replace clip history indirectly. Clip/extended Assembly
authoring is shared-head only in this block.

Integrity verifies declarations/fingerprints, exact frame/source lineage, rows and
head/tag/pin projections, native SQL+JSON creation commands and authority, semantic
replay, immutable histories and proposal transitions. Every accepted proposal must
have exactly one matching saved version, and every saved proposal-linked version
must match that decision. Imported provenance remains non-authorizing.

Portable v6 is conditional on clip history, Assembly v2 content or applied
slice-revision job history (including cut-only work before a clip exists). Unaffected
projects retain canonical v1–v5 output. Include complete historical cut/source/CAS
and clip closure, import clip histories before dependent Assemblies, and preserve
old source references, authority exclusion, absent-destination rules and backup
restore-as-copy guarantees. Snapshot shape stays unchanged without new content.

## HTTP and MCP boundary

Add clip list/exact version/draft reads, exact historical cut reads and local owner
save/proposal/resolution/cut-revision routes using existing origin/CSRF limits and
trusted actor construction. Saved-cut reads also return safe current editing
context without replacing the historical image being inspected.

Explicit MCP profile `animation-v1` positively negotiates a complete known schema17
shared-head workspace. It adds clip query/proposal and cut prepare/commit tools to
the Assembly surface: 25 tools/7 resource templates (clip and saved-cut resources).
Existing default19/4, matching-task30/5, private31/6 and Assembly21/5 surfaces retain
their prior authoring authority and schemas. V2 Assembly submission is restricted
to the new profile; old profiles fail clearly on unsupported extended content.

The internal catalog becomes42 commands/34 scopes; private overlay43/35. New scopes
are clip.proposal.submit, slice.revision.prepare and slice.revision.commit. Existing
scopes do not grant these writes. Assembly-v1 negotiation reports the actual store
version and admits only tested compatible versions16/17, not an open-ended range
or a false schema16 claim. Task-bound clip/cut/extended-Assembly admission fails
closed. Current HostBinding/Grant checks still surround every request and replay.

## Verification and completion

Start with strict clip/timing/history tests and the smallest transactional/profile
checks. Cover old-cut pins, origin compensation across mixed versions, unchanged
unrelated cuts/definitions, job replay/fault/cancel/restart, stale/foreign/future
references, namespace collisions, v1 canonical fingerprints and schema17/old
profile negotiation. Verify backup/restart, corruption detection and canonical
v6 round-trip after cut and clip updates while older Assemblies stay pinned.

At freeze run the tier/path-selected suites, production builds where triggered,
Linux native editor/review/Assembly playback and Windows compatibility. Review
each triggered domain independently; after findings rerun only affected checks.
A real agent must create/correct a clip, read owner feedback and its accepted saved
result, and submit an Assembly clip binding before Klaus's human batch. Fresh
fixtures only; preserve existing workspaces and drafts. Record a new VT item only
once implementation exists. Final acceptance belongs to Klaus, separately from
mockup approval, CI, merge and the unchanged VT-001/CP4.5/A1.7 gates.
