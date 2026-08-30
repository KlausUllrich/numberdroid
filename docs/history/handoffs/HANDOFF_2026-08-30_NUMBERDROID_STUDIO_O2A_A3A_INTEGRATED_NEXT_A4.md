# Handoff — Numberdroid Studio O2a/A3a integrated, next A4

```text
DATE                         2026-08-30
REPOSITORY                   KlausUllrich/numberdroid
STATUS                       SESSION-TRANSITION HANDOFF
VALIDATED PRODUCT BASELINE   7322542b07907710bbba16e3ffd7d1b2fc6aa5a3
BASELINE POST-MERGE CI       Build #2265 / run 33313888975 — SUCCESS
PRIMARY RECEIVING ROLE       QA / Integrator / Coordinator + Studio Engineer
NEXT AUTONOMOUS MILESTONE    A4 complete Numberdroid vertical candidate
DEFERRED KLAUS LIVE GATES    VT-012 O1b; VT-013 O2a deployment; later O3/O4
```

This file is a dated task snapshot. The receiving agent must verify the actual
remote `main`, open pull requests, Actions, and current binding documents before
acting. Newer remote truth wins over this handoff.

## Executive state

- PR #176 integrated the O1b Backups UI. It is automated green but remains
  **not user accepted**; VT-012 still belongs to Klaus.
- PR #177 updated the forward plan so UI-independent engineering could continue
  while VT-012 remains pending.
- PR #178 integrated O2a, the separate authenticated private read-only service
  adapter. It is source-integrated and automated green, but it is **not
  deployed and not user accepted**. It exposes neither remote backups nor MCP
  authority.
- PR #179 integrated A3a, the immutable typed level-intent and logic-validation
  kernel. It is source-integrated and automated green, but it is **not user
  accepted** and adds no playable behavior.
- At the validated product baseline there were no open pull requests.
- The next useful autonomous product block is A4. O2 live deployment, O3 phone
  completion, O4 remote MCP/onboarding, VT-012, and VT-013 remain separate
  human/configuration gates and must not be smuggled into A4.

## Exact integration evidence

### O1b and plan

- PR #176 final head:
  `589a7adaa0cb60b608fbc6ad1aec4df441731d94`
- PR #176 CI: Build #2252 / run `33300488531` — success
- PR #176 merge:
  `ac660f0edab39b7ae8b905cd4193f87f3bf87251`
- PR #176 post-merge: Build #2253 / run `33303411344` — success
- PR #177 plan head:
  `4a89ebd8b3c9486aad6262081a71c3b3c25c8b69`
- PR #177 merge:
  `aeb35c3610d309fc5d67168cd11d0b174ae6789a`
- PR #177 PR/post-merge CI: Builds #2254/#2255, runs
  `33304095637` / `33304145635` — success

### O2a

- PR #178 final head:
  `89141c079c1d96a4aa4c45d8b8c4b88dc464484c`
- PR #178 CI: Build #2261 / run `33308845444` — success
- PR #178 merge:
  `b2b3768867321cd60e55ff84b7dee45b5d14f93b`
- PR #178 post-merge: Build #2263 / run `33313162805` — success
- The prior Windows timeout was traced to FIFO `node:test` cleanup: the test
  attempted to remove an open SQLite/server fixture before closing the server,
  then skipped the later close hook after the Windows deletion error. The
  bounded repair used the existing LIFO cleanup helper and consumed the HTTP
  response body. No product or writer-lock fallback was added.

### A3a

- Initial A3a implementation head:
  `8da392473a883d98f79d48b218e1fbe3dd17a1ce`
- Initial CI: Build #2262 / run `33308934589` — success
- Updated head after non-destructive merge of O2a `main`:
  `dbc6dabf6d821032c90ef31e87dfa0737fe20f48`
- Final PR CI: Build #2264 / run `33313560001` — success
- PR #179 merge / validated product baseline:
  `7322542b07907710bbba16e3ffd7d1b2fc6aa5a3`
- Post-merge CI: Build #2265 / run `33313888975` — success

## Mandatory reading order

### 1. Universal bootstrap — read completely

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`

Run the complete Universal Bootstrap from `AGENTS.md`, including remote truth,
worktree safety, timeout, heartbeat, CI-handle, and checkpoint requirements.

### 2. Current Studio authority — read completely

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
14. this handoff last as the task snapshot

### 3. A4 implementation source — inspect before editing

- A0 universal and adapter seams:
  - `tools/numberdroid-studio/packages/domain/src/project-capability-manifest.js`
  - `tools/numberdroid-studio/packages/domain/src/candidate-manifest.js`
  - `tools/numberdroid-studio/packages/application/src/engine-bridge.js`
  - `tools/numberdroid-studio/packages/numberdroid-adapter/src/`
- A3a contracts and validator:
  - `tools/numberdroid-studio/packages/domain/src/level-authoring-kernel.js`
  - `tools/numberdroid-studio/packages/application/src/level-authoring-validation.js`
  - `tools/numberdroid-studio/tests/a3a-level-authoring-contracts.portable.node-test.js`
  - `tools/numberdroid-studio/tests/a3a-level-authoring-validation.portable.node-test.js`
- Existing Numberdroid compiler/runtime truth:
  - `src/levelgen/`
  - `docs/level-generation/README.md`
  - `docs/level-generation/LEVEL_SPEC.md`
  - `docs/level-generation/RUNTIME_TILED_EMISSION.md`
  - current TS-01 fixtures and their regression tests

Read additional Level Compiler documents only when their specific invariant is
touched. Do not load historical A1 visual handoffs as A4 authority.

## Acceptance and authority states

### Frozen / accepted boundaries

- O0 backup architecture and the four operations remain frozen.
- Restore-as-copy remains quarantined and inactive.
- Human-only review, merge, recovery activation, materialization, repository
  publication, and release authority remain separate.
- A3a contracts are pure Domain/Application values. The synthetic capability
  profile is test-only.
- The current Numberdroid capability profile intentionally blocks the complete
  A3a reference chain until A4 proves real adapter/compiler/runtime support.

### Source-integrated but not user accepted

- O1b Backups UI: VT-012 pending.
- O2a private remote service: not deployed; VT-013 pending after deliberate
  host configuration.
- A3a typed kernel: automated contract evidence only, no playable candidate.

### Explicitly not authorized by this handoff

- remote backup metadata or backup operations;
- remote MCP, pairing, HostBinding, or agent authority;
- public internet/Funnel exposure;
- deletion, retention, cleanup automation, or restored-copy activation;
- O3 mobile completion, O4 remote MCP transport, A5 Godot proof, A6 UI polish;
- production materialization, publication, or release.

## Next autonomous milestone — A4

A4 must preserve existing Numberdroid semantics and produce one complete,
immutable, reviewable level candidate through a scoped agent task. It must not
be implemented as one unreviewable cross-layer patch. Use these coherent
slices, preserving the order unless current source proves a better dependency:

### A4a — lossless Numberdroid projection and capability delta

- create an adapter-owned projection from current Numberdroid `LevelSpec` and
  compiler semantics into the A3a requirement/level/logic contracts;
- preserve rooms, connections, props, actors, staged actors, routes, pickups,
  zones, triggers, events, and flags without loss;
- add pinned TS-01/gold-slice fixtures and deterministic hashes;
- identify the exact missing typed semantics without mutating core contracts
  to contain Numberdroid concepts;
- keep the production capability profile blocked for anything not yet proven.

### A4b — complete the bounded reference behavior

- implement only the missing Numberdroid semantics for routed actor defeated →
  key drop → pickup → boolean state change → visible text;
- update the Numberdroid capability profile only when compiler/runtime tests
  prove each advertised module and vocabulary member;
- retain existing `FloorDefinition`/Tiled runtime boundaries and avoid a second
  game runtime.

### A4c — task-scoped candidate path

- create, validate, compile, preview, diff, and submit one immutable candidate
  using semantic commands on an isolated scoped task;
- reuse existing CandidateManifest/EngineBridge and human-review authority;
- stop at **Waiting for your review** with no materialization, repository write,
  publication, merge, or release authority.

Use subagents for independent contract-gap, compiler/runtime, security/
authority, and test-scope reviews. The main agent must read all binding
instructions itself, own integration decisions, and verify the combined diff.

## Required verification discipline

- Every shell command and test receives an explicit timeout.
- User-visible heartbeat at most every 120 seconds.
- Poll CI every 30–60 seconds for at most 20 minutes; retain run/job IDs.
- Diagnose after two unchanged polls instead of restarting blindly.
- Use the repository classifier; do not force full CI for docs-only changes.
- For behavior changes, run the smallest falsifying tests first, then all gates
  triggered by the actual diff. Unknown paths continue to fail closed.
- After every remote mutation or context compaction, checkpoint `main`, open
  PRs, exact heads, mergeability, Actions runs, and acceptance state.
- CI green, source integration, deployment, live observation, and user
  acceptance are distinct states.

## Deferred Klaus workflows

### VT-012 — O1b Backups UI

Run exactly from `VACATION_TEST_BACKLOG.md` when Klaus is at the PC. Do not
infer acceptance from CI or screenshots.

### VT-013 — O2a private service

Run only after a deliberate private Linux host configuration using
`O2A_PRIVATE_REMOTE_SERVICE_RUNBOOK.md`. It validates authenticated read-only
access, restart persistence, session invalidation, and hard-denied routes. It
does not test remote backups, responsive phone completion, or remote MCP.

## Local worktree warning

The handing-off environment contains stale dirty scratch worktrees for the
already integrated O1b-plan, O2a, and A3a changes. They are not remote truth.
Do not delete, reset, commit, or publish them blindly. Use a clean worktree from
the verified current remote `main`, preserving any unknown local user changes.

## Definition of done for the next session

The next session should either:

1. integrate one or more bounded A4 slices through fully green CI while
   preserving every authority boundary; or
2. stop at a concrete reviewed blocker with exact reproduction and a truthful
   plan update.

It must leave remote state, current docs, exact CI evidence, and a new handoff
ready for another agent. Do not wait for VT-012/VT-013 if UI-independent A4
work can proceed safely.
