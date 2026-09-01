# Numberdroid Studio — Room Editor L3 completion status

Status: **SOURCE-INTEGRATED / AUTOMATED, BROWSER AND WINDOWS GREEN — NOT USER ACCEPTED**

Date: 2026-09-01

The bounded Room Editor response to Klaus's 2026-09-01 live findings is
source-integrated on `main` at
`fc0969452ec6e22e2e3bddab399a2c56f5e6f63d`, tree
`46afd8f915a17a2143363424a2eb057d9b5902a7`. Post-merge Build #2341 / run
`33541276661` passed its classifier, Linux Studio/browser, Windows Studio and
final CI-gate jobs. Root build and Pages were correctly skipped by the changed-
path classifier.

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

Every listed Actions run completed successfully. The implementation PR heads
were rechecked unchanged before merge, and dependent work waited for each
post-merge gate.

## Implemented outcome

- Surface painting remains independent from Props; rotated exact-asset previews
  and narrow Room intent layout are repaired.
- The persistent canvas provides Fit, 100–1000% zoom, scaled text and non-
  mutating middle-mouse panning.
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

## Remaining gate and next work

Klaus owns later live acceptance of CP4.5 / VT-001, including PR #191 and PR
#192 regression and the new direct-manipulation, attention/error, findings and
Studio Preview behavior. The deferred live gate does not block safe source work
and must remain recorded as `REVISE` until Klaus explicitly changes it.

The next bounded engineering slice is the private A4c task-scoped Application
candidate path under its complete binding document package. It must stop at
**Waiting for your review** and may not add child-task persistence in the same
slice, Remote backup/MCP/Pairing/HostBinding/Funnel scope, browser agent
authority, auto-accept, O3/O4/A5/A6, Numberdroid product materialization,
repository publication or release authority.
