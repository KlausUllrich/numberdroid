# Numberdroid Studio — Checkpoint 2C Acceptance Record

- **Date:** 2026-08-22
- **Status:** explicitly user-accepted on 2026-08-24 through the combined Checkpoint 2C + 3 + 4 walkthrough
- **Branch:** `agent/numberdroid-studio-foundation`
- **Merged PR:** `#135` — merged to `main` on 2026-08-24 as `bcc284684ea4d2e30158d3a20ebda57da77df93d`
- **Accepted prerequisites:** Checkpoint 2A and Checkpoint 2B
- **Published candidate commit:** `0382ad1827db56c07be3a32b59dc43dff78500ba`
- **Published CI/evidence:** run `32580111158` — root job `97048089489` and Studio job `97048089540` passed
- **Dedicated evidence artifact:** `9477603132` (`numberdroid-studio-checkpoint-2c-evidence`), 2,060,358 bytes, `sha256:4dccfa1fbcdae7ae19c5bcafc3fed122c2225ce11e9857ee85a4db2bc715b204`
- **Independent verifier:** GO after reproducing and clearing all four initial NO-GO findings
- **Continuation decision:** on 2026-08-22 the user deferred the standalone 2C walkthrough and authorized continuation; the combined walkthrough was completed and accepted on 2026-08-24

This record includes explicit user acceptance of the bounded Checkpoint 2C asset-library workflow. Acceptance does not grant merge, release, provider, room, Numberdroid/runtime/repository export, materialization, publication, or downstream-checkpoint authority. The only import/export operation accepted here is the offline, project-scoped portable Studio bundle round trip.

## Implemented outcome

Checkpoint 2C turns exact committed atlas slices into inspectable semantic assets:

1. a strict V2 asset definition pins one exact `sliceId` and version plus its immutable digest, dimensions, and source/atlas lineage;
2. typed `surface`, `prop`, and `item` metadata remains explicit, bounded, and free of inferred author decisions;
3. deterministic ordered findings separate errors, warnings, and missing decisions;
4. agents may submit a bounded durable proposal only through a narrow capability and are charged for every proposed item;
5. the owner sees every item diff, records an explicit accept/reject decision and rejection reason, and atomically applies only the accepted subset;
6. lifecycle changes remain owner-only and cannot bypass validation or warning disposition;
7. the inventory displays ordinal `Slice 1–64` labels first while retaining stable canonical IDs as secondary copyable identifiers;
8. a canonical offline bundle exports one project semantic document and its exact CAS closure, verifies fail-closed, and imports only into a new empty workspace.

The accepted legacy `asset.define` behavior is unchanged. Existing schema-v8 workspaces migrate transactionally to schema v9, and the accepted pre-v9 MCP surface remains exactly 15 tools and two resource templates.

## Authority and protocol boundaries

With the durable schema-v9 stores live, official MCP 2026-07-28 discovery exposes exactly 17 tools and three resource templates. The two additive tools are:

- `studio_asset_proposal_submit`
- `studio_asset_query`

The additive resource is `studio://projects/{projectId}/assets/{assetId}`. Owner proposal decision, proposal apply, lifecycle, bundle export/import, finalization, and publication are absent from agent discovery. A private asset query resolves authority from a HostBinding at the bridge and never accepts opaque binding authority inside a command DTO.

Human proposal decision, accepted-subset apply, lifecycle changes, and asset reads use same-origin HTTP routes with exact-key bodies and CSRF enforcement. A nonexistent asset returns a stable not-found result; redacted projections contain no local path, credential, raw HostBinding, grant ID, stack trace, or embedded image bytes.

## Schema v9 and integrity

Migration `0009_asset_library.sql` is pinned to:

```text
sha256:e387c3e56fb0bb03bd14743c6a7c7a6baad230c02dde8f158e485e25776e7175
```

Normalized STRICT tables hold immutable asset versions, heads, bindings, metadata, findings, proposals, proposal items/decisions, and sanitized imported APPLIED job history. Integrity re-resolves exact historical lineage, verifies every permanent asset reference and bundle-import invariant, and fails closed on mismatches. Applying a proposal or changing lifecycle shares the semantic revision transaction; a lineage-changing recut after proposal preparation conflicts without partial asset creation.

## Portable bundle boundary

The bundle is a bounded canonical directory containing:

```text
manifest.json
manifest.sha256
project.json
artifacts/sha256/<first-two>/<second-two>/<digest>
```

Export requires a quiescent, integrity-clean source and a new destination. Verification rejects noncanonical JSON, digest/size/media/dimension mismatches, missing or extra files, symlinks, traversal, semantic closure drift, authority state, machine locations, and nonterminal work. Import verifies and stages before atomically publishing a new schema-v9 workspace. It preserves sanitized APPLIED processing history only; live grants, HostBindings, attempts, jobs/events, idempotency, intakes, access operations, local paths, and credentials do not cross the boundary.

The local Family Hygiene export → import → export proof produced byte-identical canonical documents and five exact CAS digests:

- project document SHA-256: `3eee4b54f54737a88992fce2fbeb59b567b82bc65dff178868d0cae8be5b9312`
- manifest SHA-256: `ed1edcdec16d08aa3fb4aa75fc85a935c7d6395ca56b86f22162d77222710666`
- imported live authority/work queues: zero
- imported sanitized APPLIED histories: one

CI regenerated and verified this proof at candidate commit `0382ad1827db56c07be3a32b59dc43dff78500ba`. The dedicated artifact contains exactly 24 files: one evidence manifest plus 23 declared evidence files. Independent download verification matched every declared file byte size and SHA-256, and matched the artifact ZIP digest reported by GitHub. The retention-limited artifact was created on 2026-08-22 and expires on 2026-09-05.

## Family Hygiene user fixture

The evidence fixture uses the accepted 1254×1254 Family Hygiene PNG and the four accepted 622×622 exact rectangles/digests from Checkpoint 2B. It submits one four-item proposal through the real pinned official MCP stdio server over a HostBinding. The owner rejects item 4 with an explicit reason, applies items 1–3, and leaves exactly three `READY` `DRAFT` assets with the expected preview digests. A final over-budget MCP proposal is denied and audited without a semantic revision.

The browser-evidence harness captures both 1440px and 1060px layouts for:

- a pending proposal with a dirty focused rejection reason, selection, local scroll, and page scroll retained through two passive refreshes;
- the three applied asset cards with exact READY previews, ordinal labels, stable canonical IDs, typed metadata, findings, and provenance;
- the applied proposal with all four item decisions and the rejected fourth item still inspectable.

No bitmap evidence is committed to the repository. CI publishes screenshots, DOM/observation records, fixture/server records, the bundle proof, and one SHA-256 evidence manifest as a retention-limited artifact.

## Verification ledger

- complete local Studio Node suite: **219/219 passed**;
- domain asset-definition/proposal cases: **11/11 passed**;
- imagery-only/typed metadata version regressions: **2/2 passed**;
- focused human HTTP/MCP contract group: **29/29 passed**;
- focused UI/protected-HTTP group: **10/10 passed**;
- administration CLI group: **3/3 passed**;
- every-material-stage atomic fault matrix: **49/49 passed**, with rollback, reopen/retry, and exact idempotent replay;
- schema-valid semantic tamper matrix: **10/10 passed**;
- strict nested portable-schema matrix: **41/41 typed envelopes plus one re-signed verifier proof passed**;
- protected Checkpoint 1A parity: **passed** after projecting only additive v9 sections out of the frozen historical comparison;
- Family Hygiene pending/applied fixture preparation: **passed** locally;
- SQLite Family Hygiene bundle export/import/re-export: **passed** locally with byte-identical canonical project/manifest documents;
- root repository tests/build: **passed** in published CI job `97048089489`;
- complete Studio verification and evidence workflow: **passed** in published CI job `97048089540`;
- Chrome `151.0.7922.137` 1440/1060 screenshot and observation review: **passed** across six independently inspected captures, with zero recorded visual/runtime errors, no horizontal overflow, no header collision, exact READY previews, legible proposal diffs, and the dirty focused rejection draft/selection/local scroll/page scroll preserved through passive refresh;
- published evidence artifact manifest: **23/23 entries independently matched** by byte size and SHA-256; artifact ZIP SHA-256 matched GitHub's `4dccfa1fbcdae7ae19c5bcafc3fed122c2225ce11e9857ee85a4db2bc715b204` pin;
- independent adversarial disposition: **GO** — all four initial blocker reproductions now fail closed or preserve the required version/closure semantics.

## Short user walkthrough after green published CI

1. Open **Assets** and confirm exactly three READY DRAFT cards, with `Slice 1`, `Slice 2`, and `Slice 3` primary labels and stable canonical IDs secondary/copyable.
2. Inspect each card's exact preview, source/atlas/slice provenance, typed metadata, and deterministic findings; confirm no authored connectivity/collision decision was silently invented.
3. Open the applied proposal and confirm all four submitted items remain visible, item 4 shows its rejection reason, and only the three accepted items became assets.
4. Filter the inventory by kind/lifecycle/readiness and inspect an asset detail view.
5. Review the portable-bundle verification record and confirm it contains semantic project data plus exact CAS only—not live authority, machine state, or pending work.

## Combined-gate acceptance — 2026-08-24

The user completed the combined walkthrough and accepted Checkpoint 2C. The accepted result includes the exact-slice Family Hygiene asset workflow, the Calm Grid and Sterile Grid families, ordinal human-facing slice labels, typed asset semantics/findings, the retained rejected proposal item and reason, and the sanitized portable-bundle boundary.

One usability requirement is deliberately carried forward rather than misreported as complete: props need a human-usable preview build before a designer is asked to place or approve them. That follow-up belongs to Checkpoint 4.5 and does not reopen the accepted Checkpoint 2C persistence, integrity, authority, or proposal semantics.

Final acceptance-head run `32673522709` passed the complete 266-test Studio suite and published Checkpoint 2C artifact `9502074531` (2,063,224 bytes, `sha256:1fbc1ffe4c519060976e0aa889c60fc860eb02620338d563a407f9251086ebd9`).

## Gate disposition

Checkpoint 2C is explicitly user-accepted as of 2026-08-24. After the documentation closure and green CI, the user separately authorized PR #135 to merge; merge commit `bcc284684ea4d2e30158d3a20ebda57da77df93d` is now the canonical `main` baseline.
