# Shared Review — production implementation contract

Status: scoped for implementation, 2026-09-11. ND-2 / GitHub #237.
The [approved Review V2 design](REVIEW_CHANGES_DESIGN.md) owns the experience;
its mockup PASS does not accept this production implementation.

## First coherent block: durable shared Review foundation

Provide one authoritative related-content review for existing Image, Animation
and Assembly authoring payloads. The owner can save/amend feedback, reconsider
acceptance of unchanged valid content, accept a dependency-valid subset once,
and discard remaining work. An authorized agent can submit/revise a group and
read exact versions, feedback and receipts. Accepting a new leaf and an Assembly
that uses it is one semantic revision and one SQLite transaction.

This first block includes service/domain, additive persistence and integrity,
compatible exchange/backup preservation, owner HTTP and a positively negotiated
agent profile. The new Review UI is the next dependent block, after this block's
verified integration is reported. No new VT entry is created for a non-visual
foundation alone. Existing per-type reviews and controllers remain operational.

Exclusions: task-branch review replacement, automatic conversion of old proposals,
new media, nested Assembly support, task Resume/agent launch, provider work,
source/cutter redesign, materialization, game runtime or publication. Existing
legacy/default/task/private MCP catalogs and grant meanings stay unchanged.

## Identity, commands and bounded payloads

Use `reviewLibrary: { schemaVersion: 1, groups: [...] }` only once Review data exists.
Each group has `reviewId`, monotonic `reviewVersion`, separate `contentVersion`,
title, trusted proposer identity/task, status, stable ordered items, last feedback
and last decision/receipt. History is immutable Review versions, not editable log
text. Content version advances only for an agent content submission; feedback and
owner decisions advance Review version without pretending the proposal pixels changed.

New commands use the existing authority-free common envelope:

- `review.proposal.submit`: `reviewId`, `expectedReviewVersion`, `title`,
  `items[{ itemId, contentKind, payload, dependsOn }]`.
- `review.feedback.save`: `reviewId`, `expectedReviewVersion`, nonblank `summary`,
  `itemComments[{ itemId, text }]`, `confirmed: true`.
- `review.accept`: `reviewId`, `expectedReviewVersion`, `selectedItemIds`,
  `confirmed: true`.
- `review.discard`: `reviewId`, `expectedReviewVersion`, `confirmed: true`.

Content kinds are `image`, `animation`, `assembly`; each item's payload reuses its
existing owner authoring DTO, including exact target versions and committed cut
or component pins. No raw artifacts, machine paths, authority or arbitrary patch
operations are accepted. Initial groups contain 1–64 items, unique IDs and target
Asset identities; total encoded input is bounded to 1 MiB. Existing narrower
per-type validation bounds still apply. Feedback summary is at most 4,000
characters; item comments at most 2,000 each and only for remaining items.

Explicit dependency IDs form an acyclic graph. Every reference to a version
produced by another group item must have that dependency; declared dependencies
must name group items. Derive prospective output pins through the existing typed
validation/version builders; never trust caller-invented artifact/lineage facts.
Validate all submitted content before owner review. Shared Image submissions
reject technical ERROR findings; old Image draft/proposal rules are unchanged.

Keep statuses `PENDING`, `CHANGES_REQUESTED`, `ACCEPTED`, `DISCARDED` as persisted
review dispositions. Items are pending, accepted or discarded and retain exact
acceptance pins. UI labels later derive the actual next actor; no job/running state
is implied. Agent revision is permitted only for the exact changes-requested
Review version, by the original proposer and task, and changes only the remainder.
Accepted item payloads, pins and receipts cannot be reopened or rewritten.

Feedback may be amended from either open disposition and remains available after
acceptance. A changed saved target blocks acceptance while leaving feedback
available. An obsolete Review version cannot receive feedback or a decision.
Every command uses exact project revision, Review version, idempotency and trusted
owner/agent checks. A repeated exact request returns the original receipt; changed
replay fails. Dry-run and failed checks publish no versions, refs, events or budget.

## Prospective validation and one atomic application

Application validation may project candidate typed records in memory, explicitly
marked proposed in read/preview DTOs. They are not saved Asset versions. Existing
Image and Clip builders resolve real immutable cut bindings; Assembly validation
receives the exact prospective leaf map in addition to historical saved records.
Never create fake historical project revisions to make a dependency visible.

Selected items must include every pending dependency or use its exact earlier
accepted receipt. Apply selected records in dependency order, preserve all other
libraries and older versions, and return explicit accepted pins plus remaining
item IDs. One outer `SqliteProjectStore.appendRevision` owns the commit, Activity,
CAS references, group version, typed records, receipt, idempotency, grant usage
and head CAS. Do not call three independent public commands to imitate atomicity.

Add an explicit Review materialization branch; do not weaken existing non-type
mutation guards. Typed proposal FK columns retain their old meanings. Shared
provenance uses immutable Review acceptance-to-typed-version links, never a Review
ID disguised as a native/Clip/Assembly proposal ID. Reads and integrity must be
able to trace each accepted saved version to its original Review item and decision.

## Persistence, integrity and exchange

Add migration 0018 with immutable Review versions/heads and ordered item,
dependency, feedback/decision and typed-acceptance projections. Migrations 1–17
and their checksums stay byte-identical. Materialize Images, Clips, then dependent
Assemblies while preserving all existing binding/pin/FK checks. JSON and isolated
task stores fail closed for this shared-head capability.

Integrity verifies SQL versus semantic history, exact source/CAS closure,
Review transitions, receipts, saved target provenance, typed replay, grant charges
and all rebuildable projections. Malformed data must fail even when foreign keys
alone would pass. Fault injection after each material write must roll back the
whole group result. Startup/rollback and old-binary rejection protect schema 18.

Backups and restore-as-copy must preserve Review data and remain subject to
canonical integrity. Existing portable bundles must neither drop Review data nor
silently represent it as legacy content. Unaffected projects keep their existing
canonical format. A conditional new bundle representation must preserve immutable
Review history and exact dependency/acceptance closure without importing authority;
otherwise export of Review-bearing projects must fail explicitly until that
representation is implemented. This compatibility work grants no game export.

## Service and capability seams

The service exposes a read-only `queryReviews` with exact optional Review version,
bounded list/history and selection-specific resolved preview. DTOs include current
and proposed typed records, current target conflicts, dependency eligibility,
content versus Review versions, trusted author/next actor, saved feedback and
immutable receipt/event identities. Query and preview change no project state.

Use a separate explicitly negotiated `review-v1` MCP profile on known schema 18,
with the supported Animation foundation plus shared Review submit/query/resource
operations. `review.proposal.submit` is a new independently granted scope, charged
per submitted remaining item; older scopes gain no mixed-content write authority.
Owner feedback/accept/discard commands never appear in agent discovery. Every
query and replay remains inside HostBinding/grant/project/branch/expiry admission.
Old Assembly/Animation profiles may admit schema 18 only as explicitly tested
compatibility, retaining their exact catalogs and failing on unsupported new types.
Owner HTTP uses the existing same-origin, CSRF and trusted-human context boundary.

## Ownership and verification

Risk: **L3**, migration + authority/lifecycle + public protocol + recovery.
Root owns this contract, StudioService/command-catalog integration, fixtures and
integration. Separate writers own the Review reducer/domain, persistence/integrity,
and HTTP/MCP boundary. UI work starts after the foundation result is reported.

Focused falsifiers first: mixed full/partial accept, missing/stale dependency,
feedback edit then accept, concurrent agent/owner version conflicts, accepted-item
immutability, exact/changed replay, per-item budget and owner-only decisions.
Then run selected Studio core/build, protocol/profile, migration, every-stage
rollback, restart/integrity and backup/exchange preservation checks. Add targeted
independent reviews for domain/commands, persistence, authority/MCP, recovery,
compatibility and integration before freeze. Use actual-diff CI; do not force
unrelated Numberdroid runtime suites or repeat unchanged green local lanes.

After exact-head green integration and post-merge CI, report the foundation and
its non-visual boundary. The subsequent UI block must retain the approved draft,
version, Details/Back and unknown-outcome rules, and exercise a real agent through
supported semantic tools before Klaus's production test. No automation can infer
his final acceptance.
