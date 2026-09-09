# Assembly editor — implementation contract

Status: implementation contract, 2026-09-09; approved mockup, product acceptance pending.
The [Assembly design](ASSEMBLY_EDITOR_DESIGN.md) owns the screen and interaction.
[VT-020](ASSET_EDITOR_IMPLEMENTATION_CONTRACT.md) remains accepted.

## Bounded promise

Create and revise an Assembly as a Library Asset made from exact saved PNG-backed
Assets. Add independent named components, move/rotate/scale/order/remove them,
preview authored variants and presentation states, inspect exact source lineage
and edit inherited or custom blocking. Save and restart preserve the declaration.
Agents submit isolated proposals, correct technical errors and read owner feedback.

This first capability accepts native single-slice Asset versions as components.
Nested Assemblies, animation timelines, audio, interactions and runtime execution
are explicit unsupported capabilities. Room placement is a separate operation:
the current Room FK and preview require a leaf Asset. Keep Assemblies out of that
palette and reject attempts with an actionable unsupported finding. Do not invent
a first-component slice or flatten the assembly into a PNG. Numberdroid export,
materialization, image generation and publication are not introduced.

## Identity and declaration

Composition is separate from the surface/prop/item use kind. A new Assembly record
has stable assetId, assetVersion, metadataVersion, name, kind, lifecycle DRAFT,
typed metadata (nullable role and bounded tags), assembly declaration, fingerprints, findings and optional proposal
provenance. It has no ExactSliceBinding or fictitious pixel digest. Browser Library
projects leaf and assembly records with an explicit content-kind discriminator;
existing native Asset records and existing asset.query results stay unchanged.

The versioned assembly declaration uses:
- schemaVersion 1 and coordinateSpace "assembly-pixels";
- a fixed positive scalar unitsPerPixel (default 1/64), independently authored
  placementBounds and anchor in assembly pixels;
- one to 32 ordered named components, front to back;
- one to 16 named state IDs and one to 16 named variant IDs, with declared default IDs;
- components with stable componentId and name, base asset pin `asset`,
  position, rotationDegrees, positive uniform scale, `stateIds` membership and
  `variantOverrides` entries carrying variantId plus an exact `asset` pin;
- blocking mode "components" or "custom", with retained owned custom regions
  `{regionId,name,shape,transform}`. Transform is a six-number affine matrix;
  custom primitives use a proper rotation/translation after uniform scale is
  absorbed into their assembly-pixel dimensions. Polygon transforms can be baked
  into their exact points. The editor retains oriented primitive transforms.

Empty state membership explicitly makes a component unused in every state;
null membership means all states. Preview selection and inspection-eye visibility
are transient UI state. They never rewrite membership, declared defaults, geometry
or project history. State preview retains its selected variant. There is no random
selection or gameplay transition. Variant overrides fall back to the exact base
pin only when no override was authored; missing referenced choices fail closed.

Use strict keys and bounded values: IDs use the repository ID grammar, names
1–160 characters, coordinates +/-65535, positive shape extents <=65535,
positive scale 0.001–1000, finite rotation -360000–360000 normalized modulo360.
Physical placement dimensions remain within64 project units. Resolved preview
coordinates and spans are additionally bounded to1,000,000 assembly pixels. Bound the canonical
command/declaration bytes to256KiB; reject excessive component/choice/point counts.
These are implementation resource bounds, not claims about all games.

All component pins resolve in the same project to immutable native Asset history
available at the command's base revision. Validate metadataVersion, full slice/CAS
lineage and supported content kind. Existing head updates and source recuts do not
retarget an assembly. Deliberate replacement selects a new exact pin.

Keep a single collision-free Asset-ID namespace for new Assemblies. A create must
reject IDs already used by native/legacy Assets or processing-result aggregates;
native creation/adoption must reject reserved Assembly identities. Do not relabel
or invalidate any pre-existing legacy/native identity overlap. An additive
assembly identity reservation can protect new identities without rewriting old
records. Implicit leaf-to-assembly or assembly-to-leaf conversion is unsupported.

## Exact geometry and preview

First resolve leaf image/placement/blocking and anchor into its physical project
units using the accepted spatial/legacy resolver. Component mapping is:

assemblyPoint = position + R(rotationDegrees) * scale / assembly.unitsPerPixel
                * (leafPoint - leafAnchor)

Thus position is at the leaf's exact authored anchor. The image additionally uses
its leaf pixel-to-project mapping. Mixed source sizes/scales stay meaningful.
The numeric rotation control supports arbitrary degrees as approved; the toolbar
adds90 degrees. Uniform component scaling does not erase unequal legacy image
scales. Bounds/anchor edits do not move artwork or blocking.

Resolved regions retain analytic shapes plus exact affine transforms. Bounds are
candidate/fit extents only. Rectangles/ovals must not become blocking bounding
boxes; ovals must not be polygonized. Polygon coordinates may be transformed
losslessly into the assembly plane. All active inherited blocking is checked
against the declared placement bounds for every bounded variant/state combination.
Do not use a Room navigation or collision result where oriented geometry is not
supported.

Custom blocking snapshots currently resolved regions into assembly ownership,
including orientation. Moving components then updates artwork while custom shapes
remain fixed. Custom geometry applies across all states/variants. Switching modes
retains the draft but makes the selected mode's consequence explicit. The shared
geometry editor gains an additive embedded mode with transformed regions and
composed artwork; normal leaf editing and asset.save stay unchanged.

Embedded Back retains the full geometry session: unfinished polygon, raw numeric
fields, history, selection, transform, zoom and scroll. Reopening restores it.
Assembly Save rejects incomplete/invalid custom drafts instead of silently dropping
them or claiming usable geometry. Missing optional descriptive polish can remain
DRAFT work. Technical errors, broken pins and invalid geometry require correction.

Use a bounded read-only Assembly scene with ordered leaf draw records, exact
project-scoped artifact URLs and matrices. Browser image nodes are keyed by
component identity plus exact pin; moving another component does not remount them.
Source inspection is a read-only subview, never the editable leaf Inspect route.
Return restores assembly edits and preview selection, compatible focus and scroll.
No raster composition, CAS image output or new pixel-processing operation occurs.

## Commands, review and capability boundary

Add three semantic commands: owner-only assembly.save, scoped
assembly.proposal.submit, and owner-only assembly.proposal.resolve. Owner commands
have requiredScope null; submission adds only assembly.proposal.submit scope.
Internal catalogs become37 definitions/31 scopes; the private authoring overlay
becomes38/32. Existing commands/scopes do not acquire Assembly write authority.

Save accepts an exact create/update expectation (0/0 for absent, exact Asset and
metadata versions for update), name/kind/metadata and the complete declaration.
Every content save creates a DRAFT Asset version. metadataVersion changes when
typed metadata/declaration changes; name-only edits preserve it. Proposal pins,
transforms, state/variant membership and blocking are typed declaration metadata.

Submission contains one Assembly create/update proposal, expected project revision
and expectedProposalVersion (0 for new). It grants no current Library Asset.
A previously CHANGES_REQUESTED proposal can be revised by its authorized proposing
agent with its exact proposal version; a pending review is not editable in place.
Every proposal revision is immutable. Invalid references and geometry return
actionable errors before human review. Charge one bounded Assembly proposal per
successful semantic submission; failed validation and exact replay do not charge.

Owner resolve uses an exact proposal version and explicit confirmation:
- ACCEPT rechecks the current target and component closure, records acceptance and
  atomically creates the new Assembly version in the same semantic revision.
- REQUEST_CHANGES requires nonblank feedback, retains the proposed declaration
  and creates a versioned CHANGES_REQUESTED record readable by the next agent.
- DISCARD records the explicit abandoned result; it creates no Assembly version.

This is a deliberate new Assembly contract for the approved simple review model;
it does not bypass or change accepted native Asset decision/apply commands.
There is one proposed Assembly per proposal, so cross-proposal partial acceptance
and batch dependency application are not advertised in this block.

HTTP owner routes use existing local-owner, origin/CSRF, body bounds and trusted
actor construction. Accept no caller actor, grant, artifact URI, digest or path.
Semantic reads expose exact Assembly versions, resolved leaf closure and review
feedback under project.read; they never grant review authority.

The production MCP profile "assembly-v1" explicitly selects the new surface after
positive trusted gateway negotiation against a complete schema-v16 store and a
shared-head binding. It adds only studio_assembly_proposal_submit,
studio_assembly_query and an Assembly detail resource:21 tools/5 templates.
Default19/4, matching-task30/5 and private authoring-v2 discovery remain unchanged.
Task-branch Assembly authoring is unsupported in this first profile. Existing
HostBinding/Grant admission surrounds every request. UI and agents share the same
domain validation and command/replay core; no agent Resume repair is included.

## Persistence, integrity and exchange

Add migration0016 with assembly identity reservations, immutable Asset versions,
component pins/findings, heads/tags, and immutable proposal versions/history.
Existing migration checksums and native slice FKs remain unchanged.
Assembly writes participate in SqliteProjectStore.appendRevision, including
snapshot, Activity, idempotency, budget and references in one transaction.
Add assemblyLibrary to a snapshot only when Assembly content/history first exists.

Store typed assembly records separately from single-slice asset_versions and
asset_proposal_items. Historical component references use exact leaf-version FKs
and metadata-version checks. They retain the corresponding existing immutable
image/source closure. A direct save has null proposal provenance; accepted agent
work points to its exact immutable proposal and owner resolution.

Integrity rederives declarations, pins, transforms/findings and fingerprints,
proves native save/resolve provenance, validates proposal transitions and complete
head projections, and verifies every dependency remains readable and retained.
Imported provenance is sanitized and non-authorizing. Do not trust just matching
IDs or cached findings.

Portable schema v5 carries Assemblies and their complete historical leaf closure.
Projects without Assembly content/history retain exact v1–v4 canonical export.
Preserve schema-v4 spatial/owner-save behavior, old references, authority exclusion,
strict path/CAS bounds, absent-destination import and backup restore-as-copy safety.

## Verification and finish condition

This is L3: migration, public protocol, authority, recovery and visible UI.
Start with focused geometry/closure, stale/foreign/unsupported reference checks,
transaction faults/replay, namespace collisions, proposal feedback/resolution,
migration rollback and old checksum tests. Prove restart, integrity corruption
detection and export/import/export with old pinned Assets after recut/update.

At code freeze use the selected full package/core/build/Windows and native browser
gates, five to six relevant independent reviewers, and exact remote-tree checks.
Run only affected local checks after a finding. Include the accepted Cutter/Asset
native lane only for its changed embedding risk or the final selected CI gate.

A real agent must discover the selected MCP profile, correct an invalid component
reference or declaration, submit isolated work, read owner feedback, revise it,
and read the exact accepted saved Assembly before Klaus's batch.
Use fresh fixtures only and preserve his running saved test workspace.

Finish with an unchanged green PR head merged, post-merge CI observed, a clean main
test instance, and a concise human batch corresponding to the approved mockup.
Only Klaus can accept this Assembly implementation. VT-001/CP4.5, A1.7 and all
separate production/runtime gates remain unchanged.
