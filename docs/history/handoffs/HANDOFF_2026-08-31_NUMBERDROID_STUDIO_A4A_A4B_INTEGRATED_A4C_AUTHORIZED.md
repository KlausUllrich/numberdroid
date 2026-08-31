# Handoff — Numberdroid Studio A4a/A4b integrated, A4c authorized

```text
DATE                         2026-08-31
REPOSITORY                   KlausUllrich/numberdroid
STATUS                       SESSION-TRANSITION HANDOFF — A4c Domain foundation integrated; Application Level Candidate authorized and next
BASELINE MAIN HEAD AT CREATION
                             93187bfd039e00147ce930a937ff0801c09c9784
BASELINE MAIN TREE           bb95ef32b44f93eee48f756b333b5ad048b83789
BASELINE CI / PAGES STATE    Build #2280 / run 33368143760 — SUCCESS; root build and Pages correctly skipped by actual-path classification
PRIMARY RECEIVING ROLE       Studio Application/Persistence Engineer + QA/Integrator/Coordinator
SECONDARY / TRIGGER ROLES    Contract; Numberdroid compiler/runtime; security/authority; persistence/fault; test-scope reviewers
NEXT MILESTONE / TASK        A4c private task-bound Level Candidate path ending at Waiting for your review
LATER AUTHORIZED A4c AXIS    Strictly parent-derived child tasks, only after the candidate path and as a separate L3 slice
DEFERRED KLAUS LIVE GATES    VT-012 O1b; VT-013 O2a deployment; later distinct implemented A4c UI/live gate if one exists
```

This is a dated task snapshot. The handoff itself is expected to merge after the
baseline above, so the receiver must replace the recorded baseline with actual
remote `main`, open-PR, and Actions truth before acting. Current source and
binding documents always outrank this file.

## Executive state

- Remote `main` at handoff creation is
  `93187bfd039e00147ce930a937ff0801c09c9784`, tree
  `bb95ef32b44f93eee48f756b333b5ad048b83789`; there are no open PRs.
- A3a, A4a, and A4b are source-integrated and automated green but are not user
  accepted. A4b supplies the bounded Actor-defeated → Key-drop → Pickup →
  Boolean-state → Visible-text reference behavior and profile-v3 proof.
- PR #186 integrated the authority-neutral A4c Domain foundation. It provides
  portable payload, preview, diff, and submission contracts, but performs no
  I/O and implements no command route, actual candidate construction,
  EngineBridge invocation, task/review transition, MCP surface, or child task.
- Klaus explicitly approved implementation of both narrow A4c mechanisms:
  private `level.candidate.create`, and trusted-service-derived child tasks that
  strictly attenuate an active human-rooted parent. This is implementation
  authority, not user acceptance.
- The immediate autonomous goal is the Level Candidate path. It may be built
  and integrated while Klaus is absent if every actual-diff gate and independent
  review is green. Derived-child support is authorized afterward but is neither
  a prerequisite nor permission to combine two L3 authority axes in one PR.
- VT-012 and VT-013 remain later Klaus live gates. Do not wait for them, and do
  not infer their acceptance from CI or screenshots.

## Exact integration evidence

### Prior operations and A3a baseline

| PR | Scope | Final head | Merge | PR CI | State |
| --- | --- | --- | --- | --- | --- |
| #176 | O1b Backups UI | `589a7adaa0cb60b608fbc6ad1aec4df441731d94` | `ac660f0edab39b7ae8b905cd4193f87f3bf87251` | Build #2252 / `33300488531` — success; post #2253 / `33303411344` — success | integrated, VT-012 pending |
| #178 | O2a private read-only service | `89141c079c1d96a4aa4c45d8b8c4b88dc464484c` | `b2b3768867321cd60e55ff84b7dee45b5d14f93b` | Build #2261 / `33308845444` — success; post #2263 / `33313162805` — success | integrated, undeployed, VT-013 pending |
| #179 | A3a typed level/logic kernel | `dbc6dabf6d821032c90ef31e87dfa0737fe20f48` | `7322542b07907710bbba16e3ffd7d1b2fc6aa5a3` | Build #2264 / `33313560001` — success; post #2265 / `33313888975` — success | integrated, not accepted |
| #180 | O2a/A3a status and prior handoff | `c87416e36dfb00d4b03df022cf94a32bb5199b6c` | `52d0634d353c2d45a793b75072210a219a2cf6d4` | Build #2266 / `33314478838` — success; post #2267 / `33314522743` — success | integrated documentation |

PR #181 then made early durable checkpoints binding: head
`23f48538cff93d35bcdb38eee9901ca4f452fb43`, Build #2268 / run
`33333345443`, merge `ef9feca6aa37275d9def4d38340291c6fd8509da`,
post-merge Build #2269 / run `33333399333`; all successful.

### A4a and A4b

- A4a PR #182 final head
  `4b2d61ebfb37e280e7819c6c5db7b63ddcb7b6ff`; Build #2271 / run
  `33337454662`; merge `e0b2396c31f7f58d500591dbc5c6f9a431d9ef45`;
  post-merge Build #2272 / run `33337734484`; all successful.
- A4b PR #184 final head
  `475280def81cee3371c0a62606a496e846f010bc`, tree
  `35cef8d7dc12fd8ed3a9e5cdf5f01ba43e373a66`; Build #2275 / run
  `33341970255`; merge `8238d05a29ee6524f6457bfccc315179ee3896b5`;
  post-merge Build #2276 / run `33342294000`; all successful.
- Documentation PR #185 final head
  `1dfa98d891702f24b47641e664ba9001b3b3f64b`; Build #2277 / run
  `33343101186`; merge `8e66a773292ab9b4a6757be9175d8a5cd15232a7`;
  post-merge Build #2278 / run `33343133574`; all successful.

### A4c Domain foundation and authority decision

- The obsolete recovery branch `codex/a4c-candidate-path` remains at
  `e16ce729f4237ca6eaf27233f550dbf204aa30f8`, tree
  `640efa3d866535443759cfea85c4900c67491f8e`. It had no PR or Actions run and
  is **INCOMPLETE / UNVERIFIED** provenance, not merge-ready work.
- Replacement PR #186 final head
  `c70019e5d510dcc06d2593b0258bd1970a0e2a6d`, tree
  `bb95ef32b44f93eee48f756b333b5ad048b83789`.
- PR Build #2279 / run `33365246228` passed Classify, Studio Linux/browser,
  Studio Windows, and the final CI gate. Root build and Pages were correctly
  skipped because the actual diff contained no root deployable input.
- Independent contract and combined-diff reviews returned GO with no blocker.
- Merge `93187bfd039e00147ce930a937ff0801c09c9784` passed post-merge Build
  #2280 / run `33368143760` with the same selected gates.
- This proves source integration and automated gates only. It does not prove an
  executable Level Candidate and is not user acceptance.

## Mandatory reading order

### 1. Universal bootstrap — read completely and execute

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`

Run the complete Universal Bootstrap, including connector-only remote truth,
clean-worktree protection, explicit timeouts, 120-second heartbeats, CI handles,
30–60-second polling, two-unchanged-poll diagnosis, and durable checkpoints.

### 2. Mandatory role routes — read completely and apply

Use these explicit routes from `docs/agents/ROLE_ENTRYPOINTS.md`:

1. **Engineer / Runtime Developer (section 4) is the primary authoring
   route.** Read `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`,
   `docs/architecture/ARCHITECTURE.md`, the actual implementation/tests listed
   below, and the current planning documents in the next block. The first A4c
   slice is Studio Application/persistence work; `TILED_MAPS.md` and
   `ROBOT_BODY_SIZE.md` are not mandatory unless the actual diff triggers their
   map/GID/layer/object or body-footprint domains.
2. **QA / Integrator / Release (section 7) is the verification and integration
   route.** Read the A4c authority/contract, actual code and tests, explicit
   definition of done in this handoff, and verify actual GitHub Actions state.
   QA may report failures but does not own product or authority redesign.
3. **Coordinator / cross-domain task (section 8) is the sequencing route.** Use
   it to combine Contract, Numberdroid compiler/runtime, security/authority,
   persistence/fault, and test-scope evidence without silently transferring
   decision ownership between those roles.

### 3. Current Studio authority — read completely in this order

1. `tools/numberdroid-studio/README.md`
2. `tools/numberdroid-studio/docs/VISION.md`
3. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
4. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
5. `tools/numberdroid-studio/docs/ROADMAP.md`
6. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
7. `tools/numberdroid-studio/docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`
8. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
9. `tools/numberdroid-studio/docs/O0_BACKUP_RECOVERY_CONTRACT.md`
10. `tools/numberdroid-studio/docs/O1A_BACKUP_CORE_STATUS.md`
11. `tools/numberdroid-studio/docs/O1B_BACKUPS_UI_STATUS.md`
12. `tools/numberdroid-studio/docs/O2A_PRIVATE_REMOTE_SERVICE_STATUS.md`
13. `tools/numberdroid-studio/docs/A3A_LEVEL_LOGIC_KERNEL_STATUS.md`
14. `tools/numberdroid-studio/docs/A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md`
15. `tools/numberdroid-studio/docs/A4B_REFERENCE_BEHAVIOR_STATUS.md`
16. `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md`
17. this handoff last as the task snapshot

Do not modify `CHECKPOINT_4_CONTRACT.md`, `CHECKPOINT_4_STATUS.md`, or
`MCP_CONTRACT.md` to retrofit A4c. They preserve accepted historical surfaces.

### 4. A4c source — inspect before editing

- New portable foundation:
  - `tools/numberdroid-studio/packages/domain/src/task-candidate.js`
  - `tools/numberdroid-studio/packages/domain/src/index.js`
  - `tools/numberdroid-studio/tests/task-candidate.portable.node-test.js`
- Existing candidate and bridge contracts:
  - `tools/numberdroid-studio/packages/domain/src/candidate-manifest.js`
  - `tools/numberdroid-studio/packages/application/src/engine-bridge.js`
  - `tools/numberdroid-studio/tests/candidate-manifest.node-test.js`
  - `tools/numberdroid-studio/tests/engine-bridge.node-test.js`
- Task/review/authority/persistence implementation selected by the actual design:
  - `tools/numberdroid-studio/packages/domain/src/agent-task.js`
  - `tools/numberdroid-studio/packages/application/src/agent-task-service.js`
  - current command catalog, storage port, SQLite schema/migrations, task tests,
    and review projections reached from those files
- A3a/A4a contracts and Numberdroid boundary:
  - `tools/numberdroid-studio/packages/domain/src/level-authoring-kernel.js`
  - `tools/numberdroid-studio/packages/application/src/level-authoring-validation.js`
  - `tools/numberdroid-studio/packages/numberdroid-adapter/src/level-authoring-projection.js`
  - `tools/numberdroid-studio/tests/a3a-level-authoring-contracts.portable.node-test.js`
  - `tools/numberdroid-studio/tests/a3a-level-authoring-validation.portable.node-test.js`
  - `tools/numberdroid-studio/tests/a4a-numberdroid-level-projection.node-test.js`
- Actual Numberdroid/compiler/runtime truth:
  - `src/levelgen/specs/a4bReference.ts`
  - `src/levelgen/a4bReference.test.ts`
  - `src/levelgen/studioAuthoringProjection.test.ts`
  - `docs/level-generation/README.md`
  - `docs/level-generation/LEVEL_SPEC.md`
  - `docs/level-generation/RUNTIME_TILED_EMISSION.md`

Read additional Level Compiler, persistence, security, browser, or Windows
documents only when the actual design touches their triggers. Art, story,
A1 visual history, backup runbooks, O3/O4, A5, and A6 are not mandatory for the
first A4c Application block.

## Acceptance and authority state

### Accepted / frozen

- Checkpoints 1–4 remain user-accepted compatibility baselines.
- Checkpoint 4's numbered owner-created task workflow remains historical truth;
  A4c is a separately versioned additive extension.
- O0 backup architecture and Restore-as-copy quarantine remain frozen.
- Root authority, owner review decision, merge, recovered-workspace activation,
  materialization, repository publication, and release remain human-owned.
- Existing MCP discovery counts 19/4, task-bound 30/5, and selected A1.6b2b
  31/6 remain unchanged.

### Source-integrated / automated green, not user accepted

- O1b Backups UI — VT-012 pending.
- O2a private read-only service — undeployed, VT-013 pending.
- A3a typed level/logic kernel.
- A4a lossless Numberdroid projection and profile gap proof.
- A4b bounded reference behavior and profile-v3 capability delta.
- A4c authority-neutral Domain DTO foundation.

### Planned / not implemented

- actual `level.candidate.create` Application command and scope admission;
- actual A4b candidate construction through A4a/A3a and canonical compilers;
- configured EngineBridge port/selection trust validation;
- durable task-bound candidate persistence, preview, ADD-only diff, idempotent
  atomic review submission, and visible **Waiting for your review**;
- strictly derived child-task persistence and authority attenuation.

### Open decisions

- No user/product decision blocks the bounded Level Candidate implementation.
- Klaus owns later live/user acceptance and any future cross-actor delegation.
- The first derived-child slice must keep the same actor and must not pass
  child-creation authority onward. A broader delegation graph is not approved.
- If current source exposes an unavoidable package-direction, schema, or
  compatibility conflict, stop at that exact evidence; do not invent a new
  public protocol or weaken the closure.

## Approved A4c authority decisions

### Private Level Candidate

`level.candidate.create` may be provisioned by trusted owner-side task setup or
inherited only from a parent that already contains it. It authorizes exactly one
task-bound immutable:

`Create → Validate → Compile → Preview → Diff → Submit`

Successful submission must atomically produce task/effective `IN_REVIEW`, one
`OPEN` review with the complete item set `PENDING`, exact branch head,
`REVIEW_SUBMITTED`, and **Waiting for your review**. It grants no auto-accept,
review decision, merge, main append, destination selection, filesystem or
repository write, materialization, publication, or release. It is private
Application authority and remains absent from MCP discovery.

### Strictly derived child task

An agent may request a child only from its current active task/grant. The trusted
service atomically derives the child task, non-main branch, immutable grant, and
parent budget reservation. Project and actor remain unchanged; the branch starts
at the exact parent head; capability/object scope is a subset; command/job/
artifact/cost budget is reserved from the parent; expiry is no later; auto-accept
and further child creation are disabled. Every child operation rechecks all
ancestors. Parent pause/review denies mutation, and cancellation/rejection/
merge/expiry/revocation makes descendants non-executable. No `grant.issue`,
`grant.manage`, root-task creation, `main` target, or authority widening exists.

Implement this only after the Level Candidate path as its own L3 PR/slice.

## Cross-role handoff

Studio Application/Persistence Engineering is now primary because the prior
Domain/Contract work froze the restart-portable payload, preview, diff, and
submission closure, while no executable task-bound command, persistence, or
review transition exists yet. QA/Integrator remains co-primary for the L3
evidence and GitHub integration loop; Coordinator owns sequencing, not a new
product decision.

The previous domains already resolved the information the receiver must carry
forward:

- Domain/Contract fixed the authority-neutral A4c DTO closure, deterministic
  hashes/bytes, create-only ADD/null diff meaning, safe-path/value bounds, and
  the fact that the Domain layer performs no I/O or lifecycle transition.
- Numberdroid compiler/runtime work fixed the real `A4B_REFERENCE_LEVEL_SPEC`,
  lossless A4a projection, A3a validation boundary, profile-v3 fingerprint, and
  canonical compiler pin recorded below.
- Security/authority work fixed private `level.candidate.create`, exact
  task/grant/actor/branch/head closure, atomic idempotent submit-to-review, no
  MCP discovery, and the separate later parent-derived child-task authority.

Ownership and exact re-engagement triggers are:

- re-engage Domain/Contract before changing any candidate DTO, canonicalization,
  hash/byte closure, diff semantics, or package dependency direction;
- re-engage Numberdroid compiler/runtime before changing root `src/`, the A4a
  projection, A3a semantics, compiler selection/pins, emitted runtime content,
  or EngineBridge validation behavior;
- re-engage Security/Authority before changing scopes, actors, grants, task or
  review lifecycle, ancestry, branch/head checks, command discovery, transport,
  or any public/remote surface;
- re-engage Persistence/Fault whenever schema, migration, transaction,
  idempotency, restart, or lost-response behavior changes, and keep that review
  independent of the writer;
- QA/Integrator owns falsification and integration evidence, but routes a
  requested contract change back to the owning role rather than redesigning it;
- Klaus alone owns user/live acceptance, review decisions, production
  materialization, repository publication, release, and any authority beyond
  the two approved A4c mechanisms. Stop and return to Klaus at those gates.

## Next autonomous milestone — A4c Level Candidate

The receiver is authorized to implement and integrate bounded A4c PRs without
waiting for Klaus when the exact head is unchanged, every actual-diff gate is
green, and independent triggered reviews report no blockers.

Recommended sequence:

1. **Application candidate construction:** connect the actual A4b LevelSpec to
   the existing A4a projection, A3a validation, Numberdroid adapter/compiler,
   validate-only EngineBridge, and the new Domain closure. Preserve package
   dependency direction and add no persistence or transport shortcut.
2. **Task-bound submit path:** add private scope admission, exact current
   task/grant/actor/branch/base/head checks, durable candidate storage, preview,
   ADD-only semantic/output diff, and one atomic idempotent review transition.
3. **Only after the complete Level Candidate post-merge gate:** implement the
   separately approved derived-child L3 slice if enough session capacity remains.

Do not split the Level Candidate into ceremonial micro-PRs that never produce
an executable vertical result. One or two cohesive PRs are appropriate; each
must still have one clear promise and full triggered evidence.

## Exact Level Candidate definition of done

Use the real `A4B_REFERENCE_LEVEL_SPEC`, profile-v3 fingerprint
`6079209041cb71a3e7c8b36ea41796c2e38ea6ef828bf78829e8f0dc4ea3f074`, and
compiler pin
`numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1`.

The implementation must prove:

1. real A4a projection, A3a validation, semantic/runtime compiler, and
   validate-only EngineBridge execution rather than fixture-shaped DTO claims;
2. immutable LevelSpec-derived branch source, complete text-output byte/hash
   closure, CandidateManifest, compiler pins, deterministic preview, and
   create-only semantic/output diff;
3. one closure over project, task, actor, grant, branch, base, exact current
   branch head, profile, compilers, candidate, bridge receipt, and submission;
4. fresh authority and head validation immediately before atomic commit;
5. idempotent/restart/lost-response-safe submission with no partial candidate,
   review, timeline, budget, or task transition on failure;
6. exact success state `IN_REVIEW` / `OPEN` / every item `PENDING` /
   `REVIEW_SUBMITTED` / **Waiting for your review**, while `main` stays unchanged;
7. tamper, blocked compiler/profile/bridge, cross-task, stale-head,
   paused/expired/revoked, replay/collision, restart, and injected-fault denials;
8. no MCP discovery change and no materialization/repository/publication/release
   surface.

## Required review and verification discipline

This is L3 once task authority, lifecycle, or persistence changes. Use only the
triggered independent reviewers, normally:

- Contract-gap / package-direction;
- Numberdroid compiler/runtime fidelity;
- Security/authority and cross-principal abuse;
- persistence/idempotency/fault/restart;
- actual-diff test-scope and CI classification.

The main agent must read every binding instruction itself, own integration, and
inspect the combined diff. Run the smallest falsifying checks first, then the
complete package/root/platform/browser/migration/fault gates selected by actual
paths and L3 risk. Retain the existing foundation regression at minimum:

```text
timeout 120s node --test \
  tools/numberdroid-studio/tests/task-candidate.portable.node-test.js \
  tools/numberdroid-studio/tests/candidate-manifest.node-test.js \
  tools/numberdroid-studio/tests/engine-bridge.node-test.js \
  tools/numberdroid-studio/tests/package-boundaries.node-test.js
```

For root compiler/runtime changes, run the affected Vitest files with an
explicit timeout, including `src/levelgen/a4bReference.test.ts` and
`src/levelgen/studioAuthoringProjection.test.ts`. Use the repository classifier
as a lower bound; authority/lifecycle/migration scope may require `[ci-full]`.

Every command/test has an explicit timeout. Publish an early coherent green
checkpoint immediately; valuable incomplete work uses `checkpoint:` and records
missing gates. Poll CI every 30–60 seconds for at most 20 minutes, retain run/job
IDs, diagnose after two unchanged polls, and checkpoint after every remote
mutation or compaction. `CI green`, source-integrated, deployed, live-tested,
and user-accepted remain distinct.

## Hard no-go boundaries

Do not add or activate:

- remote backup metadata or backup operations;
- Remote MCP, Pairing, HostBinding, remote/browser agent authority, or public/
  Funnel exposure;
- deletion, retention/cleanup automation, or Restore activation/cutover;
- O3, O4, A5, or A6;
- production materialization, candidate-created repository commits,
  repository publication, or release;
- automatic review acceptance or any inference of acceptance from CI,
  compiler output, screenshots, or source integration.

Klaus's authorization to integrate repository source PRs is maintenance
authority and is not product candidate repository-write authority.

## Deferred Klaus workflows

- VT-012: O1b Backups UI live review from
  `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`.
- VT-013: deliberate O2a private-host deployment/restart/authentication gate.
- No `VT-014` exists merely for the A4c Domain foundation or approved plan.
  Allocate the next ID only after an implemented distinct Klaus review/live
  surface exists.

## Worktree and recovery warning

Existing local checkouts may be stale or dirty. Do not delete, reset, or absorb
unknown changes. Use a clean worktree from verified remote `main`.

The old `codex/a4c-candidate-path` branch is recovery provenance only. Do not
merge or continue it blindly. The integrated replacement is on `main`. Preserve
all early commits and remote handles until the final merge/post-merge evidence is
recorded.

## Definition of done for the next session

The preferred result is a complete source-integrated A4c Level Candidate path,
automated green and still not user accepted, ending at **Waiting for your
review** with `main` otherwise unchanged. If a concrete blocker prevents that,
stop with exact reproduction, a durable recovery checkpoint, truthful current
docs, and no broadened authority. Derived-child support may follow only after
the candidate path's post-merge gate.

## Final receiver launch protocol

1. Verify actual remote `main`, all open PRs, current Actions, and any existing
   A4c work branch through the GitHub connector.
2. Read and execute the Universal Bootstrap.
3. Read the complete current Studio authority block and this handoff last.
4. Inspect the actual source paths and confirm the current pins/compatibility
   counts rather than trusting this snapshot.
5. Summarize accepted, source-integrated, planned, and prohibited states and
   identify any current-authority conflict.
6. Classify the first bounded A4c Application block and directly implement it
   with the triggered subagent reviews; no additional user decision is required
   inside the documented boundary.
7. Integrate only unchanged, independently reviewed heads with all actual-diff
   gates green, then observe post-merge CI before dependent work.
8. Never cross the human review, merge-as-product-operation, materialization,
   publication, release, Remote MCP, backup, or later-milestone boundaries.
