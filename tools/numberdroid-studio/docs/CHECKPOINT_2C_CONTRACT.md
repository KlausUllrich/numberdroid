# Numberdroid Studio — Checkpoint 2C Frozen Contract

Status: **accepted core contract**; see the [acceptance record](CHECKPOINT_2C_STATUS.md).

This contract freezes the Checkpoint 2C internal choices permitted by the
authorization handoff. The accepted Checkpoint 1, 2A, and 2B contracts remain
unchanged. Checkpoint 2C was accepted and PR #135 merged on 2026-08-24.
The later [human Asset authoring UI candidate](HUMAN_ASSET_AUTHORING.md) reuses
this core and has its own verification and live decision.

## 1. Capability surface

| Area | Frozen Checkpoint 2C contract |
| --- | --- |
| Legacy assets | Preserve `asset.define`, its schema, reducer, MCP tool, demo behavior, and card fallback. Legacy entries are never backfilled or claimed as V2-valid. |
| V2 asset | Stable `assetId`; immutable `assetVersion`; `metadataVersion` changes only with typed metadata. Every version copies the exact committed slice version and full imagery lineage. |
| Proposal | One durable project-scoped proposal with 1–64 ordered unique items. An item is `create` or `update` and carries exact expected project, asset, metadata, and slice versions. |
| Decision | One owner-only batch decision covers every item exactly once. Rejection requires a nonblank reason of at most 2,000 characters. |
| Apply | A later owner-only command applies the accepted subset as one semantic revision or nothing. Rejected items remain inspectable and create no asset version or reference. |
| Lifecycle | `DRAFT -> METADATA_COMPLETE -> VALIDATED -> FINAL`. Content or imagery updates create a new `DRAFT` version. Promotion/finalization is owner-only and separate from export or publication. |
| Agent authority | Submission requires the new `asset.proposal.submit` scope. Existing `asset.write` gains no V2 authority. Submission charges the grant by `items.length`, not by one outer envelope. |
| MCP | With the durable v9 gate live: accepted 15 tools plus `studio_asset_proposal_submit` and read-only `studio_asset_query`; accepted two templates plus `studio://projects/{projectId}/assets/{assetId}`. Owner decision/apply/lifecycle and bundles are absent. Before the gate, discovery remains exactly 15 tools and two templates. |

## 2. Exact imagery binding

A native V2 proposal may name only a currently committed slice head and its
exact expected version. Inside the SQLite transaction, Studio resolves and
materializes an immutable `asset_slice_bindings` record from:

- the persisted atlas and historical `atlas.commit.slices` revision;
- the exact same-project `atlas_slice` reference;
- the exact LIVE artifact metadata;
- the pinned source, atlas definition, rectangle, pivot, media, dimensions,
  byte length, digest, and artifact URI.

Caller-supplied digests, paths, artifact URIs, or authority fields are never
trusted. Proposal apply rechecks the current slice and asset heads. A recut or
asset update after proposal preparation conflicts atomically. After an asset
version exists, later recuts cannot retarget it.

Multiple assets may share one immutable slice binding.

## 3. Typed metadata and findings

Metadata is strict and discriminated by `surface | prop | item`. Unknown
ordinary fields fail closed. Common bounded concepts include:

- tags, variant group, and compatibility groups;
- `spanTiles`, anchor, attachment, and cardinal rotation policy;
- placement modes/tags and `wallSafe`;
- explicit collision mode/bounds/parts and navigation effect;
- `runtimeEligible`;
- at most four unique cardinal connectors, continuity profile/tags, and
  selection priority;
- visual weight;
- recursively bounded namespaced extensions.

Pixel dimensions and slice pivot are copied by the server from the immutable
slice binding. Extensions reject secret-like keys, raw authority fields,
machine paths, traversal, and URI-shaped values.

Findings have deterministic ordering and stable identity derived from
validator version, rule ID, target, and path rather than message text. Rule IDs
use `studio.asset.*`. Blocking findings prevent `VALIDATED` and `FINAL`;
warnings require explicit disposition before `FINAL`. Drafts may retain
findings.

Generic surface-fit helpers subtract structural bands before tiling, require a
positive usable region divisible by `spanTiles`, use the usable-domain origin,
and reject clipped, partial, overlapping, or out-of-domain macros. Studio does
not import Numberdroid runtime modules.

## 4. Schema v9 and transaction boundaries

Only `0009_asset_library.sql` may be added. Migrations `0001`–`0008` and their
checksums remain immutable. V9 uses STRICT, project-scoped tables for:

- immutable exact slice bindings;
- proposals, ordered items, item findings, owner decisions, and applications;
- immutable asset versions and version findings;
- rebuildable asset heads and tag projections;
- sanitized bundle-import provenance and applied-job history.

Every proposal submission, decision, apply, and lifecycle promotion is a
normal semantic revision through `SqliteProjectStore.appendRevision()`.
Asset/proposal stores may query but may not own an independent write
transaction.

Permanent imagery ownership is:

```text
owner_kind = asset_version
owner_id   = ${assetId}.v${assetVersion}
```

All old asset-version references remain. Fault injection covers every material
lineage, proposal, decision, version, finding, reference, head/tag,
application, Activity, projection, idempotency, grant, and project-head stage.

## 5. Portable Studio project bundle

The bundle is a project-scoped offline exchange format, never a Numberdroid
export and never a workspace backup. Its bounded directory is:

```text
manifest.json
manifest.sha256
project.json
artifacts/sha256/<first-two>/<second-two>/<digest>
```

`manifest.sha256` hashes the exact canonical manifest bytes. The manifest pins
canonical `project.json` and every exact CAS artifact with digest, byte length,
media type, and dimensions. Artifact paths are derived from the digest; no
semantic field supplies a filesystem path.

Export reads one snapshot-consistent database snapshot, verifies the exact
semantic/CAS closure, writes a sibling staging directory, syncs it, and
atomically renames to an absent destination. It rejects pending or decided but
unapplied proposals, active/unapplied jobs, and inconsistent atlas/job links.

`project.json` uses exact-key canonical JSON and includes the sanitized project
head, sources, atlases/current slices, explicitly legacy assets, V2
bindings/versions/heads/findings, terminal proposals with every decision and
reason, redacted semantic Activity, and normalized APPLIED atlas-job history.
It excludes grants, HostBindings, token digests, access operations, attempts,
original idempotency keys, staged intakes, leases, temporary job outputs,
machine paths, raw failures, and secrets.

Import accepts only a new empty destination. It preflights the exact tree,
canonical JSON, counts, sizes, hashes, CAS closure, semantic consistency,
quiescence, and authority absence before publication. It builds a sibling
staging workspace, imports CAS and semantic state in one controlled operation,
runs full integrity, closes/checkpoints, then atomically renames. Imported
APPLIED history uses reserved, non-authorizing `bundle_import` provenance and
cannot be controlled as a live job.

## 6. Required gates

Implementation cannot advance to the user gate without:

- v8-to-v9 rollback/resume and checksum tests;
- every-stage atomic fault tests and exact per-item grant accounting;
- stale/cross-project/replay/idempotency tests;
- proposal, decision, finding, version, head, lineage, reference, artifact, and
  lifecycle tamper tests;
- bundle traversal/symlink/extra/missing/noncanonical/oversize/hash/authority
  and destination-conflict tests;
- export/import/export canonical semantic and CAS equivalence;
- backup/restart coverage for every old and new asset-version reference;
- exact 17-tool/three-template MCP contract tests with v9 gating;
- the complete Family Hygiene browser and interaction evidence at 1440x900 and
  1060x900;
- all protected 1A/1B/2A/2B regressions, full root tests/build, green published
  CI, screenshot inspection, and independent GO.
