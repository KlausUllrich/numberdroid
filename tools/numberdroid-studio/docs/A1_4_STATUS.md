# A1.4 processing-result adoption planning status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.4 is a non-visual L3 Domain/Application candidate based on verified `main`
head `1482a4ae1df450900e37209d0fc09c1ddfc831c3`. It freezes one strict private
command and task-authority planning policy for adopting the exact A1.3
Recipe → Result → Selection closure into a branch-local DRAFT Asset. The
candidate is deliberately commitless: it produces a deterministic plan but
never authorizes, persists, commits, replays, reviews, merges, or accepts that
plan. Automated tests, source integration, and CI do not constitute Klaus's
contract acceptance.

## Implemented scope

- `packages/domain/src/processing-result-adoption.js` defines the authority-free
  schema-v1 command type and scope `asset.processing-result.adopt`, a trusted
  task-authority binding, a processing-specific Asset binding, a deterministic
  plan, and a planning result. Canonical JSON is LF-terminated and all command,
  semantic, lineage, receipt, authority-binding, and plan identities use
  SHA-256.
- The complete command graph is snapshotted before nested A1 validators run.
  Proxies, accessors, custom prototypes, symbols, hidden fields, sparse arrays,
  cycles, inherited serialization hooks, unknown fields, authority fields, and
  unbounded graphs fail closed. The command carries the complete A1.3 request;
  it cannot carry a prior receipt, actor, task, grant, branch, review, lifecycle,
  persistence, destination, or publication authority.
- The application service is agent-task-only and requires a trusted ACTIVE
  task, active unrevoked grant, exact actor/task/grant/project/non-main branch,
  exact branch revision, the private scope, exact project plus target-Asset
  object scopes, unexpired task/grant, one remaining task and grant command
  budget, and no auto-accept entry for this command type.
- Authority is read and checked before the preflight dependency is called. A
  second read-only port then runs a fresh branch-bound A1.3 preflight for the
  complete embedded request at that exact project, branch, and revision. A
  stale, forged, cross-request, cross-project, cross-branch, or cross-revision
  response fails as sanitized dependency evidence. Each `prepare` call repeats
  both reads; no receipt cache or time-of-check lease exists.
- A passing receipt creates a plan whose fixed state is `effect: NONE`,
  `authorization: NOT_GRANTED`, `persistence: NOT_PERFORMED`,
  `commitState: NOT_ATTEMPTED`, and
  `revalidation: REQUIRED_IN_ATOMIC_UNIT_OF_WORK`. A blocked receipt produces a
  frozen `BLOCKED` planning result with no plan. A `ProcessingResult` `ERROR`
  therefore blocks and a `ProcessingResult` `WARNING` remains
  fingerprint-bound and `UNRESOLVED`. Separately, the eight deterministic
  missing-metadata `ERROR` findings in a successful create plan describe its
  deliberately incomplete DRAFT Asset: they block later `VALIDATED` promotion,
  not planning or DRAFT creation. Asset warning dispositions are a distinct
  version-bound list and start empty.
- The plan freezes, but does not execute, the A1.5 idempotency boundary: a
  repeated key with the same task-bound semantic fingerprint must return the
  original result, while the same key with different semantics must fail as an
  idempotency conflict; reusing a command ID with another key must fail as a
  command-ID conflict. Every listed effect is all-or-none; an unknown outcome
  is resolved only by retrying the same key. A1.4 reports both idempotency and
  replay as unchecked/not performed and never reads or writes a ledger.
- `create` plans one explicit branch-local DRAFT name, output-derived pixel
  size, null pivot, validator-normalized explicit-empty DRAFT metadata, its
  deterministic fingerprint and findings, empty warning dispositions, and
  predicted Asset/metadata versions `1/1`. `update` plans imagery lineage only:
  it resets the new immutable version to DRAFT, preserves the existing name and
  authored metadata, and requires A1.5 to recompute the derived pixel-size/pivot
  metadata, fingerprint, findings, and empty warning dispositions. The
  predicted Asset version is exact; the metadata version remains `M` only when
  the revalidated fingerprint is unchanged and otherwise becomes `M+1`.
- The processing binding pins the full recipe, result, selection, operation,
  recipe-input descriptor, selected-output descriptor, role, kind, pixel size,
  and null pivot. It is intentionally not CP2C `ExactSliceBinding`: A1 has no
  committed atlas slice, rectangle, pivot, or replacement-remap authority.
- The plan enumerates the observations A1.5 must repeat and the effects it must
  close together: Task/Grant authority and budget, task-branch head, project
  capability, Asset identity/head, current authored metadata and fingerprint,
  deterministic metadata validation/findings, warning-disposition reset, both
  registered-LIVE and physical CAS proofs, idempotency/command ledger, branch
  revision, DRAFT Asset version, lineage, permanent artifact references,
  Activity, idempotency result, and one command-budget charge.

The pinned synthetic generic-profile v2 create fixture identities are:

- command: `fcecd066ab4b886271947d4198d1b872fbd2b91f0af0f731a8369ba79dc61e40`;
- task-bound command semantics: `80d1ea00d417e2c83227293226da89338f86bb92ee9e0095e132d6c4de30f0cd`;
- processing-specific Asset binding: `8f0e0230b8a1aba25dfc9b62d13e6d9290bbd8f2973b5494cc2e66b8df899d5b`;
- fresh A1.3 receipt: `fe6e897d4eec5a770fc6b79a25dd812d31f183de69a518f932c4926ca83b66fb`;
- complete create plan: `d206798f78bac57ef47741cdc7b71b6deeb93e0702b8cb110549ffb9e4273d9b`;
- complete conditional update plan: `b1537be4f73c282d4edb87a0a0192ee6fd38ce75f0c14b1388f2a401d39a205c`.

These are synthetic contract fixtures, not Numberdroid capability, live
authority, persistence, workflow, or product acceptance evidence.

## Preserved compatibility

- `asset.processing-result.adopt` is intentionally absent from both the 33
  registered command definitions and the 30 accepted grant scopes. Existing
  tasks therefore cannot receive or execute it. Successful authority evidence
  is available only through the unwired test port in A1.4.
- Current Numberdroid capability profile v1 remains byte-identical at
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049` and
  still fails A1.3 capability preflight closed.
- SQLite migrations remain 12; the only job kind remains `ATLAS_PREVIEW`; MCP
  discovery remains 19 tools/four templates without a task and 30/five for a
  matching task; Numberdroid adapter exports remain 11.
- CandidateManifest v1, EngineBridge v1, CP2C Asset proposal/apply semantics and
  fingerprints, `ExactSliceBinding`, StudioService, AgentTaskService,
  persistence, production CAS, HTTP, MCP, UI, profile data, compiler goldens,
  and accepted visual evidence remain unchanged. The accepted Asset validator
  now exposes the same normalization over explicit visual facts so the private
  processing binding does not masquerade as an `ExactSliceBinding`.

## Explicitly not implemented or authorized

- no command registration, grant issuance, production task/preflight adapter,
  StudioService dispatch, AgentTaskService integration, SQLite transaction,
  migration, Asset write, metadata write, reference write, Activity write,
  idempotency result, command charge, lock, lease, race resolution, or replay;
- no owner fallback, owner decision, auto-accept, review item, merge, lifecycle
  promotion, finalization, warning disposition, candidate creation,
  materialization, repository write, publication, or release;
- no durable job, MCP resource/tool, HTTP endpoint, UI state, visual evidence,
  Numberdroid profile v2, CandidateManifest/adapter mapping, new pixel
  operation, or end-to-end satisfaction of `IMG-006`.

A1.5 must not execute this plan directly. It must repeat every authority,
revision, capability, Asset, metadata normalization/fingerprint/findings,
warning-disposition, CAS, idempotency, and budget check and commit all listed
writes in one durable atomic unit of work, with fault, restart, concurrency,
integrity, backup, and bundle compatibility evidence.

## Verification

Local verification on 2026-08-28:

- new A1.4 contract/planning/adversarial suite: **13 passed, 0 failed**;
- broad focused A1/Capability/CP2C/CP4/persistence/package-compatibility
  suite: **136 passed, 0 failed**;
- full Studio suite under Node 22.17.0: **359 passed, 0 failed**;
- `npm run check`: **129 JavaScript files passed**;
- production-adapter evidence verification: `VERIFIED`, with protected source
  manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- repository Markdown link check, classifier self-test, link-checker self-test,
  and `git diff --check`: passed;
- exact changed-path classification: docs and Studio true; Studio visual and
  Windows true; root, root visual, Pages, and full false.

Independent actual-diff review, PR Actions, source integration, and post-merge
Actions are pending final candidate closure and will be appended without
changing this candidate-only acceptance state.

Because the new private module path is not in a narrow classifier allowlist,
the feature PR is expected to fail closed to Linux Studio, browser-evidence,
Windows Studio, and CI-gate checks. That conservative CI selection is risk
coverage, not evidence of a new UI or of visual acceptance.
