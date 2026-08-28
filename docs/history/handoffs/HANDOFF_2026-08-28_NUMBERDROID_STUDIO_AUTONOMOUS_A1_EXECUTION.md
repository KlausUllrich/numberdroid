# Handoff — Numberdroid Studio Autonomous A1 Execution

**DATE:** 2026-08-28

**REPOSITORY:** `KlausUllrich/numberdroid`

**STATUS:** Checkpoints 1–4 and A1.0–A1.2 are explicitly user-accepted. A0.1–A0.4, Checkpoint 4.5, and the Checkpoint 5 foundation are implemented/source-integrated candidates but are not user-accepted. Klaus cannot currently run live tests; continue through bounded candidate blocks and collect one consolidated return-test backlog without inventing acceptance.

**BASELINE MAIN HEAD AT CREATION:** `0592d90f7bcfd23c3c01df490ef92cb2ed212a37` (PR #147 merge, A1.2 acceptance record; tree `b03e03852269be291a7bb65da504d7476603b152`). Required historical vision commit `5428d2a8a00a0ab8ac488530eeff0a2cd51b2184` is an ancestor. This handoff and its consistency fixes are intended for a later documentation PR and may move `main`; the receiver must resolve the new current head rather than treating `0592d90` as a branch target.

**BASELINE CI / PAGES STATE:** GitHub Actions run `33109124192` on `0592d90` passed root build (`98646939194`), Linux Studio tests/browser evidence (`98646939382`), Windows Studio tests (`98646939286`), and Pages (`98647305006`). Local verification at this baseline passed 336/336 Studio tests, 23/23 focused A1 tests, 33/33 A0/Capability/Candidate/CP5/EngineBridge/boundary tests, `npm run check`, and `npm run evidence:verify`. Root Vitest was not locally installed; the exact baseline root build/test result is the green Actions run.

**PRIMARY RECEIVING ROLE:** Coordinator / Numberdroid Studio engineering

**SECONDARY / TRIGGER ROLES:** Domain/Architecture, Security/Authority, Persistence/Recovery, Compatibility/MCP, QA/Integrator, Documentation/Product; UI/UX and Accessibility for visible work; Technical Artist for a new pixel operation; Numberdroid Runtime Engineering for Candidate/LevelSpec/compiler mapping; Game/Level Design when placement/collision/navigation semantics change; Story only for canonical narrative content

**NEXT MILESTONE / TASK:** Implement A1.3 as the smallest read-only, project-bound processing-result adoption preflight contract, then continue the autonomous candidate loop through equally sized safe blocks. Keep the independent Operations O0/O1 lane available when A1 reaches a gate. Do not ask Klaus to live-test during the vacation; append every candidate to `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`.

## Freshness and authority

This file is a detailed execution snapshot, not current authority. The receiving
agent MUST verify current `main`, Actions, open PRs, current binding docs, code,
and tests. Newer current source wins over this handoff. Report and resolve any
conflict instead of forcing newer work back to this baseline.

The 2026-08-27 handoffs are historical predecessor snapshots. In particular,
`HANDOFF_2026-08-27_NUMBERDROID_STUDIO_AGENT_FIRST_FOUNDATION.md` predates A0
implementation and `HANDOFF_2026-08-27_NUMBERDROID_STUDIO_A1_TECHNICAL_ART_FOUNDATION.md`
predates A1.0–A1.2 acceptance. Do not use their old next-step statements as
current status.

## Executive product direction

Numberdroid Studio is to become a local-first, agent-first authoring and
production system that completes two connected paths:

```text
generated or uploaded image
→ versioned reproducible processing
→ exact immutable derived artifact
→ semantic asset

versioned level requirements
→ layout + rooms + actors + routes + pickups + variables + typed logic
→ deterministic validation/compiler evidence
→ immutable Numberdroid candidate
```

The visual UI and MCP are equal clients of one semantic application core. The
UI is the human visual control, review, correction, conflict, and decision
surface. Agents discover resources and execute semantic commands; they never
automate UI gestures. Numberdroid is the first complete profile. Universal core
and reusable authoring-module abstractions are earned by that vertical proof;
Godot/Unreal complement it later and do not replace their runtime editors.

Studio does not implement game rendering, physics, navigation, combat, economy,
or general AI. It authors versioned semantic inputs and invokes project-advertised
validation/compiler boundaries.

## Required reading order

Read every item in this block completely before changing code.

### 1. Universal bootstrap

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`
6. `docs/agents/HANDOFF_PROTOCOL.md`

Use the Coordinator/cross-domain route in `ROLE_ENTRYPOINTS.md`, plus Engineering
and QA. Add only the trigger roles required by the chosen block.

### 2. Current project and Studio contracts

1. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
2. `tools/numberdroid-studio/README.md`
3. `tools/numberdroid-studio/docs/VISION.md`
4. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
5. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
6. `tools/numberdroid-studio/docs/MCP_CONTRACT.md`
7. `tools/numberdroid-studio/docs/ROADMAP.md`
8. `tools/numberdroid-studio/docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`
9. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`

### 3. Current status and compatibility records

1. `tools/numberdroid-studio/docs/A1_0_STATUS.md`
2. `tools/numberdroid-studio/docs/A1_1_STATUS.md`
3. `tools/numberdroid-studio/docs/A1_2_STATUS.md`
4. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_CONTRACT.md`
5. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_STATUS.md`
6. `tools/numberdroid-studio/docs/CHECKPOINT_5_CONTRACT.md`
7. `tools/numberdroid-studio/docs/CHECKPOINT_5_STATUS.md`

Read the accepted CP2C/3/4 status/contract records if A1.3 touches existing
Asset versioning, proposals, task branches, review, or merge semantics. Do not
infer those contracts only from the new A1 values.

### 4. Actual current A0/A1 code and tests

Paths below are relative to `tools/numberdroid-studio/`.

- `packages/domain/src/processing-recipe.js`
- `packages/domain/src/processing-result.js`
- `packages/domain/src/asset-input-selection.js`
- `packages/domain/src/project-capability-manifest.js`
- `packages/domain/src/candidate-manifest.js`
- `packages/domain/src/asset-definition.js`
- `packages/domain/src/command-catalog.js`
- `packages/domain/src/index.js`
- `packages/preview/src/index.js`
- `packages/application/src/project-capability-provider.js`
- `packages/application/src/engine-bridge.js`
- `packages/application/src/project-store.js`
- `packages/application/src/studio-service.js`
- `packages/application/src/agent-task-service.js`
- `packages/persistence/src/artifacts/content-addressed-artifact-store.js`
- `packages/persistence/src/sqlite/sqlite-artifact-metadata-store.js`
- `packages/persistence/src/sqlite/migration-runner.js`
- `packages/numberdroid-adapter/src/project-capabilities.js`
- `packages/numberdroid-adapter/src/index.js`
- A0/A1/CP2C/CP5/boundary tests under `tests/`
- migration catalog `packages/persistence/src/sqlite/migrations/`
- MCP registration/discovery tests before any public-surface proposal

Read this handoff last, after the current contracts and actual code.

### Not mandatory initially

Do not initially load the full story/campaign corpus, all art recipes, runtime
gameplay, every LevelSpec/compiler file, broad Gold Slice art work, Godot/Unreal,
remote deployment, or historical handoffs other than this one. They do not help
freeze a read-only A1.3 preflight.

Expand only on these triggers:

- **New pixel operation or pixel-quality decision:** Technical Artist and the
  current art method/validation bundle become mandatory. Image generation still
  requires a fresh explicit user request to generate.
- **Asset placement, collision, navigation, connectors, or gameplay meaning:**
  Game/Level Design plus accepted Asset/Room contracts become mandatory.
- **Persistent aggregate, migration, CAS retention, backup, or recovery:**
  Persistence/Recovery plus Security and fault/race review become mandatory.
- **MCP/HTTP registration or discovery count:** Compatibility/MCP and Security
  are mandatory; use a separately versioned feature gate.
- **Visible workflow:** UI/UX, Accessibility, current CP4.5 contract/status, and
  real-browser evidence are mandatory. Also read the protected CP1A/1B and
  accepted CP2B/2C/3/4 UI/status contracts plus the current UI/browser tests so
  preview/fallback, task language, structured canvas alternatives, and
  poll/focus/scroll retention do not regress. Human acceptance remains deferred.
- **Numberdroid candidate/compiler mapping:** Numberdroid Runtime Engineering and
  exact LevelSpec/compiler contracts become mandatory.
- **Canonical narrative content:** Story/Narrative becomes mandatory before the
  content is authored.

## State at handoff

### Accepted / frozen

- Checkpoints 1–4 are explicitly user-accepted. Preserve the one-writer
  SQLite/CAS model, immutable activity/revisions, scoped grants, isolated task
  branches, owner review, semantic conflicts, atomic merge, and compensating
  revert.
- A1.0 `ProcessingRecipe` v1 is accepted for exactly one immutable PNG input and
  one ordered `studio.image.exact-png-crop` operation using
  `numberdroid-studio.exact-png-crop.v1`.
- A1.1 `ProcessingResult` v1 is accepted as a pure immutable descriptor that
  pins the Recipe fingerprint, processor/operation, exact input and ordered
  output descriptors, dimensions, byte lengths/digests, and normalized
  findings.
- A1.2 `AssetInputSelection` v1 is accepted as inert intent that selects exactly
  one Result output as `primary-visual` for `surface`, `prop`, or `item`.
- A1.2 creates no Asset and grants no adoption, review, lifecycle, CAS,
  persistence, materialization, or publication authority.
- Accepted MCP compatibility remains exactly 19 tools/four templates normally
  and 30 tools/five templates for a real matching task binding. A1.0–A1.2
  register no processing tool or resource.
- SQLite migrations remain `0001`–`0012`; the only durable job kind is
  `ATLAS_PREVIEW` with the accepted seven states.
- The accepted CP2C Asset path remains slice-based:
  `asset.proposal.submit → owner decide → accepted-subset apply → lifecycle`.
  A1 must not reinterpret `ExactSliceBinding` as processing-result lineage.
- Owner review decision, task merge, recovered-workspace activation,
  repository/engine materialization, and publication remain human-exclusive.

### Implemented/source-integrated but not user-accepted

- **A0.1–A0.4:** fail-closed `ProjectCapabilityManifest`, injected read-only
  capability query, universal immutable `CandidateManifest`, and validate-only
  `EngineBridge`. These are candidates, not accepted product contracts.
- **Checkpoint 4.5:** list-first tasks, focused creation, useful exact-slice prop
  preview, persistent canvas/toolbox/options/dock room editor, and normalized
  `VOID`/`BLOCKED` schema-v12 semantics. Linux/Windows/browser evidence is green;
  Klaus's six-step live gate remains open.
- **Checkpoint 5 foundation:** pure Numberdroid snapshot/candidate builder and
  fixed canonical compiler bridge. There is no candidate persistence/approval
  UI, materialization, repository commit, publication, or runtime acceptance.

### Planned / not implemented

- A1.3 project-bound adoption preflight and every later adoption consumer.
- Persisted ProcessingRecipe/ProcessingResult aggregates.
- General durable processing jobs and branch-local bitmap job authority.
- Semantic Asset adoption from processing lineage, replacement/versioning, and
  its review/lifecycle workflow.
- Trim/padding, canvas normalization, deterministic resize, safe alpha/background
  cleanup, composition/packing, generation providers, and arbitrary other pixel
  operations.
- Authoring-v2 capability/discovery surface and complete Artist/Level Designer
  MCP parity.
- Requirements, LevelGraph, actors, routes, pickups, typed variables and logic,
  complete Numberdroid candidate, and later thin Godot proof.
- Operations O0/O1 implementation, remote O2, mobile/touch O3, and full MCP
  onboarding O4 beyond the existing masterplan.

### Open decisions and owners

| Decision | Current boundary | Owner / resolution path |
| --- | --- | --- |
| A1.3 schema/name and exact receipt shape | Must remain read-only and nonauthorizing | Engineering + Domain/Security superagent review |
| Numberdroid capability support for processing | Profile v1 has no processing module/operation and MUST NOT change in place | Split a parallel profile-v2 candidate if needed; Compatibility review decides block size |
| `create` versus `update` coordinates | Match accepted CP2C vocabulary: create expects absent Asset/metadata; update pins both exact current versions and later creates new versioned lineage | Domain + accepted Asset contract |
| Current Asset-state proof | Preflight must distinguish an unused create target from exact expected update heads without mutation | Project-scoped read-only Asset-state lookup port |
| CAS proof | URI/fingerprint never proves existence or `LIVE` | Application port plus Persistence/Security review |
| Findings policy | `ERROR` blocks preflight; `WARNING` is carried unresolved | Binding default for A1.3; no agent warning disposition |
| A1.4 persistence/mutation design | Not implied by A1.3 | Separate block with Persistence, Security, task-authority review |
| Visual/UX acceptance | Automation cannot decide it | Klaus in the consolidated return session |
| Repository PR merge during vacation | Only the explicit bounded launch prompt can authorize it | Human prompt; source integration is not product acceptance |

## Verified actual code and compatibility baseline

| Contract / surface | Actual baseline |
| --- | --- |
| Domain exports | 95 names |
| Semantic command definitions / implemented types | 33 / 33 |
| Owner-only / non-owner-only commands | 13 / 20 |
| Grant scopes | 30 |
| Durable job kinds | one: `ATLAS_PREVIEW` |
| Job states | `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `DISCARDED`, `APPLIED` |
| SQLite migrations | 12, `0001`–`0012` |
| MCP default | exactly 19 tools / 4 templates |
| MCP matching task | exactly 30 tools / 5 templates |
| Historical MCP gates | 15/2 before v9; 17/3 v9; 19/4 v10 |

Recent migration checksums:

- `0010`: `99d12a3a7ee7572dd9386bd183fb847631ceab0490b0190e3ba5f1b339cfd40e`
- `0011`: `f6ed508f3098e6cdeb3dca2af0a9be7baca12c18fcd9d518f75f4f353242639d`
- `0012`: `1e48171a0c70c4d015001287d254aad8359ea34970bddcb17168a8a368dd17e1`

### A0 and A1 integration ledger

| Block | Implementation head | Merge / closure |
| --- | --- | --- |
| A0.1 CapabilityManifest | `8353e31c7f7d4c5242643a79f7de1ff3ae058372` | `7877efa6940cebbd6a18ebadf239374f3d87ed8e` |
| A0.2 Capability Query | `eb255e771f275120635f3d6ef711f91f8dd70636` | `c40e1869e517aba9f546fcd96710c20a067e5aa7` |
| A0.3 CandidateManifest | `285bc9e6e8bca382efef9fc4199ac9d79d339a61` | `9788e5e7568a78744993f20b43a9532d44e60b04` |
| A0.4 EngineBridge | `bfdab45416b5da5116a4244c7d632096260452b2` | `7afb1895f60d47bf2ded413fb49b647d5b36f7e4` |
| A1.0 ProcessingRecipe | `1d10ee86c089ec85bd4a32bb7140e3f79da05afa` | PR #144 / `2c1f85e3f9d1a324a3de2b0f99bee41545a9b4fc` |
| A1.1 ProcessingResult | `4f555baf4bad41dc3599bde4aceff22e94fee261` | PR #145 / `a5323636941acdb98342e5d737e358919b8e5fe7` |
| A1.2 AssetInputSelection | `238af00065b5346a79c837632022d15d99b1cd59` | PR #146 / `9763170061e8c7dc918141f6869cbce3ddf944b6` |
| A1.2 acceptance record | `bbb7ace8f47ceed8534f34fad90136931f1f68e1` | PR #147 / `0592d90f7bcfd23c3c01df490ef92cb2ed212a37` |

### Protected fingerprints

- Checkpoint 1A evidence manifest:
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`
- Numberdroid capability profile v1:
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`
- Universal CandidateManifest fixture:
  `4c065dd883eac529129a594c30fe786cb5d9233701791df9e4500d845fa0212b`
- Existing CP5 adapter manifest:
  `1aadaedb311eb368819e8ce14a3625f2cdc8af352cbe69aea789d247a464a08e`
- Family Hygiene source:
  `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`
- A1.0 Recipe:
  `ca939dfd972a0aef6f70016fca20e6d45108e05795c4c705489a3b7decd63c46`
- A1.1 Result:
  `83e784f8e9303bb0832fe89d415cc05c93c56e2e9dd66b0ce04b6a1b79409378`
- A1.2 Selection:
  `d32d2c38315fe8cf2a2c8a7463e83c4815cd1e9156587041cf8cb563c0526ce0`

The four Family Hygiene 622×622 canonical PNG outputs remain 1,548,341 bytes
each with digests `ef83efbe…`, `3781086c…`, `9d4c8671…`, and `a63dceb5…` in
recipe order. Exact full hashes live in the accepted A1 status records.

## Authority and compatibility boundaries

- A capability manifest is discovery and fail-closed validation, not authority.
- Artist/Level Designer labels are workflow guidance, not capabilities.
- Only a human-created immutable grant scoped to project/task/branch/object/
  budget/expiry authorizes an agent mutation.
- Agents cannot mint, widen, renew, reinterpret, or self-select a grant.
- A CAS URI, Recipe/Result/Selection fingerprint, or CandidateManifest is not a
  storage receipt, `LIVE` proof, approval, or destination authorization.
- Human owner review, task merge, restore activation, engine/repository
  materialization, and publication remain unavailable to Studio agents.
- Repository-maintenance merging by the coordinating coding agent is distinct
  from Studio task merge and requires an explicit current human prompt.
- Accepted schema/checksum/golden values are never edited in place. Additive
  evolution gets a new version or named feature gate.
- A1 must not change MCP 19/4 or 30/5 silently. Authoring v2 must pin new exact
  counts and schemas.
- The universal core imports no Numberdroid, React, MCP, SQLite, filesystem,
  Git, or GitHub implementation. Only `packages/numberdroid-adapter` may know
  Numberdroid contracts/paths/compiler details.
- UI and MCP continue to use the same application command/query and policy
  paths; no UI-only authoring gesture and no MCP UI automation.
- Source integration, automated green, live-tested, user-accepted, materialized,
  and published are distinct states.

## Binding UI philosophy

Studio must feel like a professional visual production tool, not an
administration console.

- Put the task, current state, next actor, required decision, and consequence
  first. Put branch/grant/revision/CAS/provenance/raw IDs and rule codes under
  **Technical details**.
- Use professional plain language, not childish simplification and not internal
  implementation jargon as the normal workflow.
- Healthy provenance, integrity, validation, and authority are quiet
  confirmations. Raise visual warnings only for actionable missing,
  inconsistent, unsafe, stale, or waiting-for-decision state.
- The normal hierarchy is summary → list → selected detail → contextual next
  action → optional technical detail. Creation is a focused step, not a full
  form permanently competing with list, detail, review, and history.
- Preserve a stable workspace with central canvas, contextual tools/options,
  asset palette, layers, inspector/dock, lineage, findings, and live preview.
- The CP4.5 persistent editor contract supersedes the rejected six-page
  canvas-replacing wizard. `Purpose` and `Check` are dock panels; guidance does
  not mean replacing the canvas.
- Exact previews use authorized pixels with contain/no crop/no stretch and an
  accessible transparency treatment. Missing/processing/unsupported/failure
  states never collapse to a blank card. Opening a preview never approves it.
- Passive refresh must preserve compatible DOM, focus/selection, dirty draft,
  list selection, local/page scroll, canvas zoom/position, layers, disclosure,
  and active pointer work. Incompatible state produces an explicit conflict,
  never silent draft loss.
- Keyboard equivalence, text plus icon, non-color-only state, and accessibility
  are mandatory. Future mobile uses 44×44 targets, no hover-only meaning, and a
  real list/detail/action model rather than compressed desktop columns.
- Build low-fidelity Artist, Level Designer, review, conflict, and candidate
  workflow/state maps before polished responsive mockups. Detailed mockups are
  useful only after capability, command, state, conflict, and error contracts
  stabilize.
- Browser screenshots are evidence of rendering, not proof that Klaus
  understands or accepts the workflow.

## First bounded block — A1.3 adoption preflight

### Product promise

Given one validated A1 Recipe → Result → Selection closure, one exact project
capability pin, one explicit Asset create/update target, and project-scoped CAS
verification evidence, A1.3 returns one immutable deterministic preflight
receipt that says whether later semantic adoption may be attempted. It mutates
nothing and authorizes nothing.

### In scope

- One strict schema-v1 preflight input and receipt in the inward Domain/
  Application boundary chosen after superagent review.
- Complete relational closure of the accepted A1.0–A1.2 values.
- Explicit `create` or `update` target matching the accepted Asset proposal
  vocabulary. Create expects Asset and metadata version zero; update pins stable
  Asset ID plus exact expected current Asset and metadata versions.
- Exact capability-manifest schema/version/profile/fingerprint pin.
- A narrow project-scoped read-only Asset-state lookup that proves a `create`
  identity is unused or an `update` identity has the exact expected current
  Asset and metadata heads.
- A narrow project-scoped read-only CAS verification port/result for input and
  selected output digest, byte length, media type, dimensions, and `LIVE` state.
- Deterministic policy: any `ERROR` blocks; `WARNING` remains unresolved evidence
  and is never auto-dispositioned; successful preflight grants no authority.
- Canonical JSON/fingerprint and adversarial tests for unknown/hidden/inherited/
  accessor/proxy/sparse/toJSON/unsafe fields, relational drift, stale Asset or
  metadata version, cross-project artifact, missing/corrupt/not-live CAS,
  unsupported capability, errors, warnings, and deterministic replay.
- Package-boundary and compatibility tests proving no changed command/job/
  migration/MCP/golden surface.
- Current Requirements/Architecture/Roadmap/status documentation in the same PR.

### Explicitly out of scope

- Asset create/update, semantic revision, Activity, owner decision, review,
  lifecycle, warning disposition, finalization, merge, materialization, commit,
  or publication.
- SQLite migration, persisted Recipe/Result/Selection/receipt, durable job,
  command catalog registration, HTTP route, MCP tool/resource, or UI.
- New pixel operation or execution of the crop processor.
- CandidateManifest or Numberdroid adapter mapping.
- Reuse or reinterpretation of `ExactSliceBinding`/AssetProposal.
- In-place edits to Numberdroid capability profile v1. If real processing
  advertisement requires profile v2, split it when necessary to preserve one
  high-risk axis per block.

### Definition of done

1. The planning swarm agrees the package owner, schema, capability-versioning
   strategy, CAS proof boundary, findings policy, and nonauthority language.
2. The contract returns byte-identical canonical receipt data for identical
   validated inputs and fails closed for every enumerated attack/error class.
3. The current Numberdroid profile v1 remains byte/fingerprint-identical; any
   profile-v2 work is additive and separately bounded.
4. A1/Capability/Asset/CP5/package focused tests pass, then the complete Studio
   suite, `npm run check`, and `npm run evidence:verify` pass.
5. Exact command count 33, migrations 12, one job kind, MCP 19/4 and 30/5, and
   every protected fingerprint remain unchanged.
6. Independent Domain, Security, Compatibility, QA, and Documentation reviews
   inspect the actual diff and report GO; coordinator performs final verification.
7. PR and docs say `IMPLEMENTED CANDIDATE — NOT USER ACCEPTED`; every implemented
   candidate gets a complete return-backlog record. For a purely automated block,
   mark the record `NEEDS KLAUS REVIEW` and state explicitly when no live steps
   exist beyond reviewing the contract decision.

### Likely next equal blocks

These are sequence candidates, not pre-authorization to combine them:

1. **A1.4 application adoption plan/command seam:** freeze atomic/idempotent
   semantic intent and task-branch authority without persistence.
2. **A1.5 persistence/CAS seam:** one additive migration/aggregate boundary with
   fault, restart, integrity, backup/bundle, and stale-version evidence.
3. **A1.6 Authoring-v2 gate:** separately versioned MCP resource/tool exposure
   with newly pinned exact counts; no owner review/apply/finalize authority.
4. **A1.7 UI candidate:** low-fi states first, then one bounded visual review and
   correction surface with browser evidence and deferred Klaus live gate.

Re-plan each block from current truth. The list does not freeze unresolved
schemas or let a later block bypass a stop gate.

## Autonomous vacation development loop

Klaus cannot currently test and wants substantial progress before one larger
return session. Use superagents generously and keep executing rather than asking
for routine confirmations already answered by current contracts.

### Equal block rule

Each block has one testable product promise and at most one new high-risk axis:

- one pure versioned contract; or
- one application port/command/query seam; or
- one persistent aggregate/job seam with at most one migration; or
- one deterministic processor operation; or
- one small projection over frozen commands.

Schema/migration, public MCP/HTTP compatibility, authority/lifecycle, pixel
operation, substantial UX flow, and materialization/filesystem boundary are
separate risk axes. Split a block that introduces two. If reviewers cannot
explain promise, boundaries, and rollback in five short points, the block is too
large.

### Planning and review swarm

Use at least four, normally five or six parallel superagents:

| Role | Required attack/review |
| --- | --- |
| Coordinator/root | authority, exact scope, total diff, integration |
| Domain/Architecture | package ownership, inward dependencies, aggregate/port |
| Security/Authority | grants, actors, CAS/path/proxy/secret/escalation |
| Persistence/Compatibility | schema, migration, MCP counts, goldens, recovery |
| QA/Platform | failure matrix, fault/race/restart, Linux/Windows/browser |
| Docs/Product | status truth, requirements, roadmap, handoff/test backlog |
| UX/Accessibility | add for visible state flow, language, keyboard, viewport |

The implementer and final independent reviewers must not be the same. Give one
writer ownership of a shared file area; keep other agents read-only or on
strictly disjoint files. Superagents may spawn further bounded read-only probes.

### Exact loop

1. Verify current `main`, required ancestor, open PRs, Actions, worktree, current
   authority, and differences from this handoff.
2. Select the highest-priority unblocked block. Write promise, in/out, authority,
   compatibility, tests, docs, and rollback before edits.
3. Run the planning swarm. Resolve findings from binding authority, not reviewer
   majority.
4. Implement fail-closed on a focused branch. Avoid broad cleanup or package
   reorganization.
5. Run focused tests, complete Studio suite, check, evidence, package boundaries,
   and relevant root/migration/restart/fault/race/browser/platform gates.
6. Run the independent review swarm on the actual diff/results. Security and
   Compatibility must explicitly GO; coordinator still verifies everything.
7. Update Requirements/Architecture/MCP/Roadmap/status truth and
   `VACATION_TEST_BACKLOG.md` in the same block where affected.
8. Open a focused PR with base/head, promise, exclusions, authority, tests,
   migration/rollback, dependencies, and `IMPLEMENTED CANDIDATE — NOT USER ACCEPTED`.
9. Wait for complete CI. Retry only a demonstrated infrastructure flake; never
   retry until randomly green.
10. If the copied human prompt explicitly grants the limited integration
    authority below, and every gate is satisfied, merge the repository PR,
    verify new `main` and post-merge CI, then start the next block. Otherwise
    leave the PR open and continue only on a safe non-conflicting lane.
11. If a block reaches a real gate, switch to another authorized independent
    block such as Operations O0. Stop only when every useful lane is gated, and
    leave a precise decision/test queue rather than inventing progress.

### Limited repository-integration authority in the launch prompt

The copy-paste prompt below explicitly authorizes the receiving coding agent to
merge a focused repository PR after all of these are true:

- the change is additive/reversible and stays inside the frozen block;
- no hard stop below is crossed;
- independent Security and Compatibility reviewers plus coordinator return GO;
- all required local tests and full PR CI are green;
- docs and return-test status are truthful;
- the merge is ordinary repository source integration, not Studio task-merge,
  owner review, product acceptance, materialization, publication, or release.

That authority exists only when Klaus actually sends/copies that prompt. This
historical file by itself is not a credential or standing merge instruction.

### Hard stop gates

Stop, leave a reviewed proposal/draft PR where useful, and switch lanes or wait
for Klaus before:

- widening agent authority, enabling agent owner-review/task-merge, restore
  activation, repository/engine materialization, commit/publish inside Studio,
  or production release;
- silently changing accepted schemas, migration checksums, goldens, MCP 19/4 or
  30/5 surfaces, or protected visual behavior;
- destructive migration, delete/overwrite/cleanup, active restore cutover,
  caller-selected server paths, provider egress/cost/credentials, remote
  listener/authentication, or remote MCP;
- claiming CP4.5, backup UI, mobile/touch, art, gameplay, or another visual
  workflow is accepted without Klaus's live gate;
- generating new imagery without a fresh exact user request to generate;
- adopting an unresolved product choice that materially changes the contract
  and is not settled by current binding defaults.

Operations-specific allowance while Klaus is absent:

- O0 contract/threat-model work may be completed.
- After O0 is fully reviewed, only the non-visual fail-closed O1 application/job
  seam and its adversarial tests may proceed.
- Stop before final backup UI composition, O2 remote access/authentication,
  O3 phone/touch completion, and remote MCP.

## Consolidated return test session

The live backlog is `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`.
Every implemented candidate must add one record with ID/dependencies, PR/SHA,
state, safe fixture/start/reset, bounded steps and expected result,
device/viewport, Actions/evidence, known limits, open Klaus decision, and safe
recovery.

Current priority order is:

1. protected baseline/start/restart;
2. CP4.5 desktop tasks, useful prop preview, persistent room editor, and
   `VOID`/`BLOCKED` live gate;
3. new A1 image-to-asset candidates plus the A0 contract review;
4. agent/MCP scope, revoke, conflict, review, and **Waiting for your review**;
5. backup UI/restore-as-copy only when that candidate exists;
6. CP5 candidate review after prerequisites;
7. remote/Android only after their predecessor gates.

All recovery tests use new/copied workspaces. Active data and prior/source
backups are never overwritten or deleted for testing.

## Documentation consistency work completed with this handoff

At the pre-handoff baseline no A1 code/contract contradiction with newer `main`
was found. This documentation update corrects the known current inconsistencies:

- root bootstrap now lists all five mandatory files and routes Studio correctly;
- A1.2 now records PR #147, `0592d90`, and closure CI `33109124192`;
- root/Studio planning no longer calls A0 the next block;
- A1.3 and the autonomous cadence are current Roadmap/plan entries;
- MCP resources now state the accepted three → four → conditional five-template
  progression and explicitly say A1 registers no tools;
- Architecture now says four future moves and no longer calls accepted CP2C/CP4
  future candidates;
- CP2C/3/4 `bcc284…` is labelled the historical checkpoint integration
  baseline rather than current `main`;
- the CP2B acceptance paragraph in the Studio README is no longer visually
  attached to A1 acceptance;
- a current consolidated return-test backlog now exists.

If this docs PR moves `main`, that newer merged head and CI become the receiver's
baseline. No source code, schema, runtime behavior, MCP discovery, or accepted
fingerprint is intentionally changed by this documentation block.

## Reusable process lessons

- A pure descriptor is not storage, execution, semantic adoption, or authority.
- A selected output with an `ERROR` can exist as inert intent; the later
  preflight/adoption boundary must fail separately.
- CAS content addresses require project-scoped live metadata and exact byte/
  media/dimension revalidation before use.
- Never backfill A1 lineage by relabelling accepted CP2B job/slice rows.
- Do not use a general batch/MCP wrapper to bypass a missing semantic command or
  capability.
- One authoritative writer plus immutable branch coordinates remains the
  concurrency model; shared immutable artifacts do not authorize shared mutable
  state.
- CI green, PR merge, source integration, live QA, acceptance, materialization,
  and publication are different facts.
- Low-fidelity state maps precede polished UI when command/state semantics are
  moving.
- When Klaus is unavailable, useful progress is a series of bounded, reviewed,
  truthfully labelled candidates plus a runnable return-test plan—not a claim
  that human gates disappeared.

## Cross-role handoff

Coordinator/Studio Engineering is primary because A1.3 joins pure A1 contracts
to capability and CAS read boundaries without yet choosing persistence or UI.
Technical Art already resolved the first proven pixel operation and exact
fixture; do not reopen it. Security must review every CAS/capability/authority
claim. Persistence becomes primary only when a later block writes durable state.
UI/UX becomes primary only for a visible review/correction candidate. Runtime
Engineering becomes primary only when accepted semantic assets enter
CandidateManifest/LevelSpec/compiler mapping. Klaus retains every live/visual,
owner, materialization, publication, and release decision.

## Final receiver launch protocol

1. Verify current `main`, inclusion of `0592d90` and `5428d2a8…`, open PRs, and
   exact current Actions/Pages state through the repository workflow.
2. Read the universal bootstrap, Coordinator route, current Studio contracts,
   code/tests, and this handoff in the order above.
3. Inspect actual A1/A0/Asset/CAS/MCP code and rerun the focused/current baseline
   tests; do not trust counts copied from this snapshot if `main` moved.
4. Summarize product/status/authority/compatibility and report only genuine
   conflicts with newer current authority.
5. Spawn the A1.3 planning swarm, freeze one bounded preflight promise, and
   implement directly if no hard gate remains. Klaus has asked not to be held at
   routine checkpoints during the vacation.
6. Run the complete review/CI/docs/backlog loop and, only under the copied prompt's
   explicit limited authority, integrate a safe candidate and continue.
7. Never claim user acceptance or cross a live/security/release gate. Switch to
   an independent authorized lane when possible; otherwise leave a precise stop.

## Copy-paste prompt for the next agent

The following block is intentionally ready for Klaus to paste as the entire
next-agent brief. Its explicit repository-integration clause is the limited
human authorization described above.

```text
Chatname: Numberdroid Studio Urlaubsloop

Arbeite am GitHub-Repository `KlausUllrich/numberdroid` auf dem aktuellen
`main`. Nutze für GitHub-Reads/Writes, Branches, PRs und Actions den verbundenen
GitHub-Connector gemäß Repository-Workflow.

Verifiziere zuerst den aktuellen `main`, die offenen PRs und die vollständige
Actions-/Pages-Lage. Stelle sicher, dass
`0592d90f7bcfd23c3c01df490ef92cb2ed212a37` und
`5428d2a8a00a0ab8ac488530eeff0a2cd51b2184` enthalten sind. Neueres `main`
ist immer maßgeblich.

Lies anschließend vollständig und in dieser Reihenfolge:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`
6. `docs/agents/HANDOFF_PROTOCOL.md`
7. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
8. `tools/numberdroid-studio/README.md`
9. alle dort als aktuell maßgeblich verlinkten Vision-, Requirements-,
   Architektur-, MCP-, Roadmap-, Operations-, A1-, CP4.5-, CP5- und
   Return-Test-Dokumente
10. den tatsächlichen aktuellen A0/A1-/Asset-/CAS-/MCP-Code und die Tests
11. zuletzt
   `docs/history/handoffs/HANDOFF_2026-08-28_NUMBERDROID_STUDIO_AUTONOMOUS_A1_EXECUTION.md`

Nutze großzügig Superagenten. Setze pro gleich großem Entwicklungsblock
parallel mindestens Domain/Architektur, Security/Authority,
Persistence/Compatibility, QA/Plattformen und Dokumentation/Product ein; bei
sichtbarer Arbeit zusätzlich UI/UX/Accessibility. Implementer und finale
Reviewer dürfen nicht identisch sein. Der Root-/Coordinator-Agent prüft den
Gesamtdiff selbst.

Starte mit A1.3: einem read-only, projektgebundenen Adoption-Preflight für die
akzeptierte Recipe→Result→Selection-Kette. Er muss Capability-Pins,
projektgebundene CAS-LIVE-Revalidierung, einen read-only Asset-/Metadata-Head-
Lookup, ERROR/WARNING-Policy und explizite Asset-create/update-Koordinaten in
einem unveränderlichen, nicht
autorisierenden Receipt schließen. Noch keine Asset-Mutation, Migration,
Command-Registrierung, Jobs, MCP/HTTP/UI, neue Pixeloperation,
Candidate-/Adapter-Integration, Materialisierung oder Publication.

Arbeite danach selbstständig in einem Loop aus gleich großen Kandidatenblöcken:
Main/CI verifizieren → Scope und Stop-Gates einfrieren → Superagenten-Planung →
Implementierung → fokussierte und vollständige Tests → unabhängiger Security-/
Compatibility-/QA-Review → aktuelle Doku und
`tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md` aktualisieren →
fokussierter PR → vollständige CI → neues Main verifizieren → nächster sicherer
Block. Wenn A1 an einem echten Gate stoppt, wechsle auf einen unabhängigen,
autorisierten Block, insbesondere Operations O0 und danach höchstens die
nicht-visuelle fail-closed O1-Application-/Job-Naht.

Für diese Urlaubssession autorisiere ich ausdrücklich die gewöhnliche
Repository-Source-Integration eines fokussierten Kandidaten-PRs in `main`, wenn
der Block additiv/rückrollbar innerhalb des eingefrorenen Scopes bleibt, kein
Stop-Gate überschreitet, unabhängige Security- und Compatibility-Reviewer sowie
der Coordinator GO geben und alle lokalen Prüfungen sowie die vollständige
GitHub-CI grün sind. Verifiziere nach jedem Merge das neue `main` und dessen CI.
Diese Erlaubnis ist keine User-Akzeptanz, keine Studio-Task-Merge-Autorität,
keine Studio-Candidate-/Produktions-Materialisierung oder
Repository-Produktionscommits durch Studio und keine Publish-/Release-Erlaubnis.

Stoppe ohne neue ausdrückliche Entscheidung vor jeder Authority-Ausweitung,
Umdeutung akzeptierter Schemas/MCP-19/4-/30/5-Flächen/Goldens, destruktiver
Migration oder Cleanup, aktivem Restore-Cutover, Provider-Egress/Kosten/
Credentials, Remote-Exposure/Auth/MCP, Repository-/Engine-Materialisierung,
Publication sowie jeder behaupteten visuellen oder Live-Akzeptanz. Generiere
keine Bilder ohne einen neuen expliziten Generierungsauftrag.

Ich kann im Urlaub nicht testen. Bitte halte mich deshalb nicht an routinemäßigen
Zwischenfreigaben fest. Kennzeichne alles wahrheitsgemäß als accepted,
implemented candidate, automated green, merged oder needs Klaus live; sammle
für meine Rückkehr eine konsolidierte, sichere Testsession mit exakten Fixtures,
Schritten, erwarteten Ergebnissen, Evidence und Rückweg. Melde dich nur bei
einem echten Stop-Gate, einem Widerspruch zu neuerem `main` oder einem
substantiellen Meilenstein.
```
