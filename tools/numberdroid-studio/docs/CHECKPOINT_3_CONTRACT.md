# Numberdroid Studio — Checkpoint 3 Frozen Implementation Contract

- **Date:** 2026-08-22
- **Status:** explicitly authorized for planning and implementation; not implemented, verified, or user-accepted
- **Combined user gate:** Checkpoint 2C remains unaccepted and will be reviewed together with Checkpoint 3
- **Development branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135` remains open, draft, unmerged, and unreleased
- **Verified starting head:** `ebefb0071322cb02b4bc9b00bb599dd2d76b8cdc`

This contract freezes the bounded Checkpoint 3 implementation slice. It records no user acceptance and grants no merge, release, provider, image-generation, Numberdroid adapter/export, repository materialization, publication, level-composition, enemy/NPC/route, or general multi-branch authority.

## 1. Outcome

Checkpoint 3 lets a human author and finalize one standalone room or hallway from the visible V2 asset vocabulary while an agent may submit a bounded, durable set-dressing proposal for explicit owner review.

The candidate must prove:

1. reusable room/hallway intent is distinct from a concrete variant;
2. structural surfaces are distinct from set dressing;
3. every placement pins one exact immutable asset version and its existing slice/artifact lineage;
4. placement, bounds, overlap, collision/navigation, connector, surface-fit, intent, and finalization findings are deterministic and explainable;
5. agent placement proposals remain inspectable after restart and cannot finalize a room;
6. finalization creates one immutable final room version, while later edits begin a new draft lineage without modifying the final version;
7. the portable Studio bundle round-trips the new room semantics without carrying live authority or operational state;
8. accepted Checkpoints 1, 2A, and 2B remain unchanged, and the unaccepted 2C candidate remains reproducible for the combined user gate.

## 2. Generic domain boundary

Studio remains independent of `src/levelgen`, `FloorDefinition`, Tiled, repository paths, GIDs, and runtime filenames. Checkpoint 3 represents generic semantic inputs that a later Numberdroid adapter may translate and validate.

The binding Numberdroid contracts nevertheless constrain the generic model:

- function-before-form and explicit game-design → level-design → room-design intent;
- room and corridor/hallway are distinct semantic kinds;
- doors/connectors are real bounded edge apertures with clear approach space;
- asset identity and explicit spatial metadata, never pixels, own placement semantics;
- coarse footprint is a deterministic reservation, not inferred visual/collision geometry;
- exact-fit/collision/placement envelopes remain explicit metadata and are never measured from PNG alpha or the DOM;
- structural bands are removed before macro-surface tiling and clipped partial macros are invalid;
- final room semantics contain no enemies, NPCs, encounters, patrol routes, triggers, or level graph.

## 3. Bounds and identity

All identifiers are opaque, bounded, stable, and independent of display names, paths, coordinates, or revisions.

Checkpoint 3 bounds:

| Value | Bound |
| --- | --- |
| archetypes per project | 128 |
| variants per project | 512 |
| cells per axis | 3–64 |
| cells per variant | 4,096 |
| connectors per variant | 32 |
| placements per variant/proposal | 256 / 64 |
| intent references per variant | 32 |
| tags per object | 32 |
| warning dispositions per version | 128 |
| string / identifier length | 256 / 128 UTF-8 code points |
| nested extension depth | existing bounded V2 extension contract |

Stable coordinates are:

```text
roomArchetypeId + archetypeVersion
roomVariantId + variantVersion
placementId
connectorId
proposalId + proposalVersion + itemId
```

## 4. Room archetype

A `RoomArchetype` is a reusable immutable intent version:

```text
roomArchetypeId
version
kind: room | hallway
displayName
tags[]
dimensionPolicy
structuralBands { left, right, top, bottom }
connectorPolicy
allowedAssetKinds: surface | prop | item
allowedTags[] / requiredTags[]
rationality: domestic | neutral | ritual | system
governingRuleRefs[]
createdRevision / actor
```

Provisional creation defaults:

| Kind | Width × height | Structural bands | Orientation |
| --- | --- | --- | --- |
| room | 10 × 8 | 0 on every edge | any |
| hallway | 12 × 3 | 0 on every edge | horizontal |

These are creation conveniences, not universal Numberdroid geometry. The human may choose any bounded dimensions allowed by the archetype policy. Checkpoint 3 does not automatically solve topology or resize a room to make an invalid macro fit.

## 5. Room variant and intent trace

A `RoomVariant` is one concrete authored arrangement. Its immutable versions contain:

```text
roomVariantId, version, roomArchetypeId, archetypeVersion
displayName, lifecycle, width, height, origin { x: 0, y: 0 }
intentTrace[]
connectors[]
placements[]
findings[] and warningDispositions[]
parentVariantVersion / parentFinalVersion
proposal and actor/revision lineage
contentFingerprint
```

Lifecycle:

```text
DRAFT → VALIDATED → FINAL
FINAL → explicit fork → new DRAFT version
```

Finalization never mutates an existing final version. An edit to a final variant requires `room.variant.fork`; the new draft records the immutable parent final version.

Intent trace entries use exact keys:

```text
layer: game_design | level_design | room_design
ruleId
summary
disposition: governing | proposed
```

A final variant requires at least one entry for every layer. Agent-authored intent is `proposed` unless it cites a governing rule already present on the archetype. Checkpoint 3 stores semantic references and summaries, not repository paths or executable instructions.

## 6. Connectors

Each connector is an edge aperture:

```text
connectorId
side: north | east | south | west
offset
width
kind: opening | standard-door | controlled-door
clearanceInside / clearanceOutside
required
tags[]
compatibilityProfile
```

The aperture must lie wholly on one edge and connectors on the same edge may not overlap. Inside clearance must lie within the room and remain free of blocking placement geometry. Outside clearance is retained as semantic intent for later level composition; Checkpoint 3 does not pretend to validate a neighboring room.

A finalized hallway requires at least two nonoverlapping connectors on different ends of its primary orientation. A finalized room requires at least one connector. Door breathing-space findings remain visible even when the connector is otherwise geometrically valid.

## 7. Placements and layers

Logical layers are fixed:

```text
STRUCTURAL_SURFACE
SET_DRESSING
```

Rules:

- `surface` assets belong only to `STRUCTURAL_SURFACE`;
- `prop` and `item` assets belong only to `SET_DRESSING`;
- every placement pins `assetId`, `assetVersion`, and `metadataVersion` resolved from the current project store;
- placement input never accepts a digest, artifact URI, local path, source/atlas/slice coordinate, or authority field;
- transforms are explicit `anchor {x,y}`, cardinal `rotation` (`0|90|180|270`), and optional authored variant tag; no free scale, skew, pixel offset, or implicit image-derived size exists;
- rotated footprint is resolved from the pinned metadata before mutation;
- legacy `asset.define` entries cannot be placed as V2 assets;
- later asset-head changes never retarget an existing room version.

Surface macro placement uses the asset `spanTiles`, room structural bands, usable-domain origin, connector/threshold exclusions, and the accepted complete-macro rules. A DRAFT may have incomplete coverage; `VALIDATED`/`FINAL` may not.

Set dressing validates pinned attachment/rotation policy, footprint, placement tags, wall safety, collision parts/bounds, navigation effect, required/compatibility tags, bounds, overlap, connector clearance, and remaining passable access. A conservative coarse footprint owns Checkpoint 3 placement when no narrower generic exact-fit envelope is authored; no geometry is inferred from pixels.

## 8. Deterministic findings

Room findings use the existing exact finding envelope and stable `studio.room.*` rule IDs. Ordering is deterministic by severity, rule, target, and path.

Required rule families include:

- dimensions/origin/layer/asset-version integrity;
- placement bounds, rotated footprint, overlap, collision and navigation;
- attachment, wall safety, compatibility and required tags;
- connector edge containment, same-edge overlap and inside clearance;
- structural-band subtraction, macro alignment, divisibility and full coverage;
- intent-trace completeness and unresolved proposed intent;
- missing required room/hallway connectors;
- non-final/non-validated referenced assets as stable warnings;
- unresolved proposal and stale pinned-version conflicts;
- finalization prerequisites and warning disposition.

Errors block `VALIDATED` and `FINAL`. Warnings require explicit owner disposition before `FINAL`. Informational findings never block.

## 9. Human commands

Human same-origin HTTP routes may invoke exact-key commands for:

```text
room.archetype.create
room.variant.create
room.variant.intent.set
room.variant.resize
room.variant.connectors.set
room.variant.placements.add
room.variant.placements.move
room.variant.placements.remove
room.placement.proposal.decide
room.placement.proposal.apply
room.variant.warning.disposition.set
room.variant.validate
room.variant.finalize
room.variant.fork
```

Every mutation carries the existing project revision, target version, command ID, and idempotency key. Resize and removal never silently clip or delete content: the command fails with findings/conflict unless the explicit request identifies every affected placement/connector.

## 10. Agent proposal boundary

Checkpoint 3 introduces one narrow agent mutation:

```text
room.placement.proposal.submit
```

and a read-only room query. Submission requires a new `room.proposal.submit` scope, project/room object scope, exact task and HostBinding authority, and complete per-item command-budget charging.

The proposal:

- targets one exact DRAFT room variant version;
- contains at most 64 ordered add/move/remove items;
- resolves each asset/version and computes every diff/finding before persistence;
- records trusted actor/task/branch attribution, but is not a general mutable branch head;
- requires one owner accept/reject decision for every item and a reason for every rejection;
- applies the accepted subset in one semantic revision or nothing;
- remains inspectable after rejection/apply and restart;
- cannot resize, change connectors/intent, disposition warnings, validate, finalize, export, materialize, publish, or mint authority.

This is the bounded Checkpoint 3 interpretation of “agent set-dressing proposal on a task branch.” General isolated branch heads, proposal comparison/merge, concurrent agents, and `Propose in draft` activation remain Checkpoint 4.

With schema v10 room storage live, official MCP discovery adds exactly:

```text
studio_room_placement_proposal_submit
studio_room_query
studio://projects/{projectId}/rooms/{roomVariantId}
```

The complete v10 surface is therefore exactly 19 tools and four resource templates. Human placement/edit/finalize commands remain absent from MCP.

## 11. Persistence and integrity

Add immutable migration `0010_room_designer.sql` without modifying migrations `0001`–`0009`.

Normalized STRICT storage must cover:

- archetype versions/heads and governing-rule references;
- room variant versions/heads, intent trace, connectors, placements, findings, and warning dispositions;
- room placement proposals/items/decisions/applications;
- exact asset-version references owned by unambiguous room-version coordinates;
- final-version lineage and current draft heads;
- sanitized imported final/applied room processing history where required.

One semantic transaction must atomically commit the room version, normalized records, exact asset references, findings, proposal/application state, grant charge, Activity, project revision/head snapshot, and idempotency record. Fault injection covers every material stage.

Integrity re-resolves every pinned asset version and its permanent artifact lineage, compares normalized records to the semantic snapshot, verifies head/version/final lineage, and rejects missing, stale, duplicated, or drifted connector/placement/finding/proposal data.

## 12. Portable Studio bundle

The existing project bundle is extended, not renamed or replaced. It round-trips:

- room archetype versions/heads and governing rules;
- room variant versions/heads, intent, connectors, placements, findings, dispositions, and final lineage;
- terminal room proposals with all decisions/rejection reasons/application state;
- the exact asset and CAS closure already required by those room versions.

It still excludes grants, HostBindings, attempts, idempotency, live jobs, staged intake, machine paths, credentials, and active/nonterminal proposals. This remains an offline Studio project bundle, not a Numberdroid export.

## 13. Human UI and refresh ownership

The Rooms workspace provides:

- room/hallway creation and variant selector;
- Fit, 100%, and 200% zoom with visible cell coordinates/origin;
- separate surface/set-dressing visibility and selection;
- filterable asset palette with READY/fallback previews;
- pointer placement/move plus keyboard alternatives;
- selected-placement/connector inspector and complete structured placement list;
- connector controls and clearance visualization;
- live deterministic findings linked to their target/cell;
- durable proposal review, rejection reason, and accepted-subset apply;
- validate/finalize/fork actions with explicit warning disposition;
- useful responsive composition at 1440×900 and 1060×900.

Canvas-only meaning is forbidden: every placement and connector is readable/selectable/editable through the structured list and inspector. Errors are not color-only.

The accepted one-poll ownership rules continue. Passive refresh may not replace a focused/dirty inspector, pointer capture, selection, zoom, local canvas scroll, palette scroll, structured-list scroll, or page scroll. Changed authoritative room/proposal versions produce an explicit conflict instead of silently dropping local work.

## 14. Acceptance fixture

The deterministic candidate fixture contains:

1. the exact Checkpoint 2C Family Hygiene source, four slices, four-item proposal, one rejection, and three applied V2 surfaces;
2. one 10×8 Family Hygiene room archetype/variant using pinned exact surface versions;
3. one 12×3 hallway archetype/variant proving different defaults and end connectors;
4. at least two real existing Numberdroid prop visuals reconstructed by their existing repository recipes into temporary Studio CAS for the fixture only, with explicit generic metadata and no repository binary write;
5. one bounded agent set-dressing proposal submitted through the real official MCP/HostBinding path;
6. one rejected invalid/undesired placement with a human reason and an atomically applied accepted subset;
7. visible invalid-placement explanations for connector clearance, bounds/overlap, and an incompatible placement;
8. a finalized room version plus a forked DRAFT edit proving the final version is byte/semantically unchanged;
9. restart and portable-bundle round-trip proof with exact room/asset/CAS closure and zero live authority.

The combined user walkthrough reviews the deferred 2C asset proposal/library/bundle decisions and the Checkpoint 3 room/hallway canvas, placement validation, agent proposal, finalization, and fork behavior in one gate.

## 15. Verification gate

Before returning to the user:

- pure domain tests cover room/hallway defaults, intent, connectors, rotation, surface macro fit, set-dressing bounds/overlap/navigation, findings, warning disposition, and final/fork lineage;
- application tests cover owner-only edits/finalization and durable bounded agent proposal authority, budget, atomicity, stale versions, and idempotency;
- v9→v10 migration, restart, rebuild, integrity, fault injection, semantic tamper, backup, and project-bundle round trip pass;
- HTTP/MCP exact-key, CSRF/origin, redaction, cross-project, feature-gating, and exact 19-tool/four-template discovery pass;
- browser evidence proves the room and hallway at 1440×900 and 1060×900, structured alternatives, invalid placement explanations, proposal review/apply, final/fork lineage, and 12+ second interaction retention;
- every accepted checkpoint regression and the complete Studio/root suites pass locally and in published CI;
- all evidence screenshots/observations/manifests are independently inspected;
- PR #135 remains open, draft, and unmerged;
- documentation states that 2C and 3 remain candidates until the combined explicit user decision.

## 16. Definition of acceptance

Automated verification and a green candidate do not accept either checkpoint. Only Klaus's explicit result after the combined walkthrough may accept Checkpoint 2C and Checkpoint 3. Rejection of a Checkpoint 3 behavior does not silently rewrite the already-verified 2C technical candidate; the resulting disposition must identify which contract remains disputed.
