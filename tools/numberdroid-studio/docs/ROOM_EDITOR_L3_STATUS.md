# Numberdroid Studio — Room Editor L3 completion status

Status: **SOURCE-INTEGRATED / AUTOMATED, BROWSER AND WINDOWS GREEN — VT-001 REVISE; LIVE CHECKS DEFERRED, NONBLOCKING FOR AUTHORIZED DEVELOPMENT**

Date: 2026-09-06

Klaus requested unattended cleanup and Studio development on 2026-09-06.
This changes sequencing, not acceptance. Remaining live checks are recorded in
the [VT-001 backlog](VACATION_TEST_BACKLOG.md#vt-001--cp45-desktop-designer-gate).

Latest integration: PR [#206](https://github.com/KlausUllrich/numberdroid/pull/206)
was refreshed onto current main and merged unchanged from
`8d088a58bd21f318d9dc37a34686a5a8f1b8bd96` as
`034bc4604338e391a2455d42e03a12a5b27d0ed3`, tree
`6c9d09f9ec537303c15363f8cad86f8c403bfe1b`. Exact-head Build #2380 / run
[34053299822](https://github.com/KlausUllrich/numberdroid/actions/runs/34053299822)
and post-merge Build #2381 / run
[34053841215](https://github.com/KlausUllrich/numberdroid/actions/runs/34053841215)
passed. Its two-file change is copy-only; validation semantics are unchanged.

Klaus separately live-passed placement-preview disappearance on canvas exit,
stable scrollbar gutter, dynamic launcher readability and typed `q` shutdown,
plain Room macro guidance, and PR #210's conflict-first Task Review page.
These individual passes do not close VT-001. The September 2 ledger below
preserves the earlier source and verification baseline.

The bounded Room Editor response to Klaus's 2026-09-01 and 2026-09-02 live
findings is source-integrated on `main` at
`dbe37634ea13d076cd00647fffb0dde1b2bd0f69`, tree
`baa89c2548916826b822f59a1c162d6ace38321a`. Post-merge Build #2354 / run
`33630127953` passed its classifier, Linux Studio/browser, Windows Studio and
final CI-gate jobs. Root build and Pages were correctly skipped by the
changed-path classifier.

This status is source and verification truth only. CP4.5 / VT-001 remains
**REVISE**. In particular, PR #191 and PR #192 remain implemented but not
product-side accepted until Klaus performs the deferred live regression.
Nothing in CI, screenshots, compiler output, reviews or source integration
constitutes acceptance of those PRs or the later Room Editor slices.

## Integration ledger

| Slice | Exact PR head | Merge | Exact-head CI | Post-merge CI |
| --- | --- | --- | --- | --- |
| Functional repairs | PR #191 `d23cd760e0b03257d8eeb137aae28a1c0fec89cc` | `e0cfb9fb48505c863c2fe52504d378ad6c03708e` | Build #2301 / `33490816313` | Build #2302 / `33491619241` |
| Zoom, Fit and pan | PR #192 `326c9509322a69e5f6f4717e1b3118a764a2ebbf` | `d33afa61a8c66a9245401efb0f677c426ed3b086` | Build #2303 / `33495245029` | Build #2304 / `33496734765` |
| Preview architecture/handoff | PR #193 `fae8dccac54ddbe0506a72c227c6154e5e1d2e83` | `cc932dddf08476be4208ccf4b0b29b23edb0c9ee` | Build #2306 / `33497575137` | Build #2307 / `33497725456` |
| Placement ghost/direct manipulation | PR #194 `75221dd9653a7f03570f7c6a3b934df07db2921b` | `439a2cf0c92639f3fe8750a7ef68ce29ea442cc7` | Build #2317 / `33509448594` | Build #2318 / `33510213052` |
| Attention, persisted errors and findings | PR #195 `dd2592f677637ecb97e5013083a27c91e76d0887` | `5f1bf524300e8478573df7c27e15607ac4723f39` | Build #2323 / `33517235933` | Build #2324 / `33518106796` |
| Exact read-only Studio Preview | PR #196 `81c9c3979e8e5217fb84717a537ddb425634ec75` | `fc0969452ec6e22e2e3bddab399a2c56f5e6f63d` | Build #2340 / `33540448651` | Build #2341 / `33541276661` |
| 2026-09-02 live-workflow repairs | PR #201 `e26f3d707a790a4b4779c9267514a3b8de9f18d0` | `dbe37634ea13d076cd00647fffb0dde1b2bd0f69` | Build #2353 / `33629339599` | Build #2354 / `33630127953` |

Every listed Actions run completed successfully. The implementation PR heads
were rechecked unchanged before merge, and dependent work waited for each
post-merge gate.

## Implemented outcome

- Surface painting remains independent from Props; rotated exact-asset previews
  and narrow Room intent layout are repaired.
- The persistent canvas provides Fit, 100–1000% zoom, scaled text and non-
  mutating middle-mouse panning. Fit now measures the declared bordered viewport
  budget instead of collapsing to the seed board height, and reports the fitted
  percentage.
- Saved-shape resize is visible in **Purpose & settings** with explicit
  saved-versus-dirty guidance. A dirty shape draft cannot create a false pending
  placement.
- Choosing an exact READY Surface, Prop or Item arms it immediately. The exact
  version-pinned brush remains active across successful adds, while every copy
  receives a fresh placement ID and idempotency key.
- A confirmed **Clear** tool removes only an existing selected Prop or Surface
  through the existing exact placement-remove command. Placed imagery now
  visibly rotates for every cardinal orientation inside the authored logical
  footprint at that orientation; visual pixels and overhang never enlarge
  occupancy.
- An unknown add result retains its exact request body, placement ID,
  idempotency key and original-cell retry. Plain-language guidance replaces the
  primary technical pending code; a preview-image failure disables ordinary
  placement without making that pending retry unreachable.
- Exact rotated placement ghosts communicate valid and blocked states without
  color alone. Direct pointer and keyboard select/move/rotate/delete reuse the
  existing placement add/move/remove semantic commands. Gestures remain
  transient, revision-pinned and cancellable, and issue at most one semantic
  mutation on a valid release.
- Task summaries expose conflicts and action-required state. Room summaries
  expose persisted `ERROR` findings before detail. Finding selection provides
  readable remediation and stable sequential navigation without losing dock
  scroll context.
- Studio Preview projects the exact current saved Project head and current
  saved Room head into a portable, engine-neutral scene and renders it
  read-only in a deterministic top-down view. Stale Project or Room heads fail
  closed; exact historical placed-asset versions resolve only through the
  Room's creation revision. The view is explicitly approximate and does not
  claim Numberdroid runtime fidelity.

## Preview model boundary

Logical footprint alone controls occupancy, collision and navigation. Ground
anchor controls floor contact and primary depth ordering. Visual bounds,
offset, elevation and overhang are presentation metadata and may extend beyond
occupied cells. Alpha preserves lower layers. Optional background, body and
foreground segments support uncommon overlap cases without changing gameplay
semantics. The portable model is compatible with a later 2.5D/isometric or
dimetric renderer; that renderer is planned, not implemented, and is not a
completion gate.

The validate-only EngineBridge remains unchanged and is not used by ordinary
Studio Preview. Preview adds no authoring mutation, task/review/acceptance
transition, adapter materialization, repository write, publication or release
authority.

## Verification closure

The final preview tree passed the full local Studio suite with 703 tests: 699
passed, four expected platform skips and zero failures. The explicit Studio
build checked 229 JavaScript files. Protected production-adapter evidence was
verified. The CP4.5 export → verify → import → re-export proof preserved
byte-identical project and manifest JSON, identical CAS digests, integrity and
zero transferred grants, HostBindings, agent attempts, jobs, job events,
idempotency rows, source intakes or human-agent-access rows.

Build #2340 exercised the actual preview diff through protected 1440×900 and
1060×900 Chrome evidence, including exact transparent/opaque sampling,
responsive screenshot bounds and unchanged editor revision/scroll/shape state.
Linux Studio, Windows Studio and the final CI gate passed. Independent
interaction, security/authority, persistence/idempotency, preview architecture
and test/CI reviews were blocker-free on the final head.

The 2026-09-02 repair head passed 19 focused Room Editor UI tests and the full
Studio suite with 748 tests: 744 passed, four expected platform skips and zero
failed. The Studio build checked 239 JavaScript files; protected Checkpoint 1A
evidence was `VERIFIED`; `git diff --check` was clean. Build #2353 exercised the
actual PR #201 diff at 1440×900 and 1060×900 through the full Chrome evidence
suite, including resize projection/restore, repeated exact Surface and Prop
placement, pending retry, Clear, Fit containment and four distinct rotation
matrices. Linux, Windows and the final CI gate passed. Five independent
interaction/UX, security/authority, persistence/idempotency, preview/rendering
and actual test/CI-scope reviews were blocker-free on the unchanged final head.
Build #2354 repeated the selected gates successfully after merge.

## Room creation context candidate — 2026-09-07

Implemented candidate on `agent/studio-room-creation-context`; not user accepted.
The prior source could render the previous Room after creation, then change the
command target to the new Room without rendering again. This candidate aligns
the exact new saved Room across selector, header, canvas and command context,
clearing incompatible prior interaction state only after confirmed success.
Failures and unresolved edits retain their existing context. Empty-project
guidance uses **Room template** and opens the next required creation form.

Focused proof creates two differently sized Rooms, immediately edits the
second before passive refresh, and shows that the first is unchanged. Fresh
1440/1060 browser and restart evidence passed, including selector focus and
visible new-Room identity before capture scrolling. The full local Studio run
passed 801 tests with five expected skips; the subsequent landing repair passed
all 15 affected Room UI checks. The build checked 256 JavaScript files. Five
targeted independent reviews cleared their findings. Source/CI identities belong in the focused
PR; the deferred human check is VT-018 in the
[Vacation Test Backlog](VACATION_TEST_BACKLOG.md). This candidate does not
change the remaining VT-001 decision or Room validation semantics.

## Remaining gate and next work

Klaus owns later live acceptance of CP4.5 / VT-001, including PR #191 and PR
#192 regression, the 2026-09-02 workflow repairs and the direct-manipulation,
attention/error, findings and Studio Preview behavior. Klaus reported the first
12 steps of the prior walkthrough as passing, then found Fit, an initially
unavailable-seeming Resize with an unclear saved-shape prerequisite, single-use
placement, palette arming, removal and visible rotation defects;
steps 14 onward were not tested. PR #201 repairs those findings, but only a new
live retest can accept them. The gate remains `REVISE` until Klaus explicitly
changes it.

VT-014 was explicitly user accepted on 2026-09-02 under its bounded A4c
contract; that does not resolve VT-001 or accept A3a/A4a/A4b. Klaus's
2026-09-06 instruction now authorizes bounded Studio development while the
remaining live checks are deferred. Use [Start here](START_HERE.md) to select
the next task route. This instruction grants no automatic A5/A6,
2.5D renderer, Remote backup/MCP/Pairing/HostBinding/Funnel, browser-agent,
auto-accept, O3/O4, Numberdroid product materialization, repository publication
or release authority.
