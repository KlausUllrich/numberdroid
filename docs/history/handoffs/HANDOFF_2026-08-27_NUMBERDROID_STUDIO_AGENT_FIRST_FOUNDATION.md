# Handoff — Numberdroid Studio Agent-first Foundation

**DATE:** 2026-08-27

**REPOSITORY:** `KlausUllrich/numberdroid`

**STATUS:** Product direction documented locally; implementation of the new A0 interface foundation has not started

**BASELINE MAIN HEAD AT CREATION:** Last chat-confirmed remote `main` is `aaf15c5ac0fac798407d139f972af5a5aca3a9df` (PR #138 merge). This workspace's stale local `origin/main` is `0136dfb700e8314df62e4620f9d9de8df39830ec`; the receiver MUST verify GitHub rather than treating the local tracking ref as remote authority.

**BASELINE CI / PAGES STATE:** PR #138 was chat-confirmed green for Root, Windows Studio, and Linux/Chromium at exact head `212548fc…` before merge. Pages state after `aaf15c5…` was not independently verified in this workspace.

**PRIMARY RECEIVING ROLE:** Coordinator / Numberdroid Studio product-architecture engineer

**SECONDARY / TRIGGER ROLES:** Technical Artist for processing operations; Level Designer/Game Designer for requirement and logic vocabulary; Runtime Engineer for Numberdroid compiler/behavior mapping; Security/QA for capability and authority boundaries; UI/UX only after command/workflow states stabilize

**NEXT MILESTONE / TASK:** A0 — freeze and prove the project capability interface with the Numberdroid profile, without broad UI, database, MCP-discovery, engine-output, or release changes

## Why this handoff exists

The product direction was at risk of splitting into two bad extremes: a
Numberdroid-only UI that agents cannot operate, or a speculative universal game
editor built before the real Numberdroid workflow works. The resolved direction
is:

- Numberdroid first and end to end;
- agent-first semantic authoring through MCP;
- a simple visual UI over the same commands for human control/review/correction;
- reusable core and optional authoring modules;
- project/engine adapters only at proven boundaries;
- a thin Godot 2D/Tower Defense portability proof only after the Numberdroid
  vertical path is complete.

The two complete paths are:

```text
generated/uploaded image → reproducible processing → semantic asset
level requirements → layout + actors + routes + pickups + variables + logic
                   → validated immutable Numberdroid candidate
```

## Required reading

Read in this order before proposing or changing code:

1. `AGENTS.md` — universal bootstrap and repository authority.
2. `docs/agents/ROLE_ENTRYPOINTS.md` — use the Coordinator/Engineering route;
   load the Runtime route only when inspecting compiler/LevelSpec integration.
3. `docs/agents/REPOSITORY_WORKFLOW.md` and
   `docs/agents/HANDOFF_PROTOCOL.md`.
4. `tools/numberdroid-studio/docs/VISION.md` — binding product direction.
5. `tools/numberdroid-studio/docs/REQUIREMENTS.md` — especially `IMG-*`,
   `LVL-*`, `LOG-*`, `AGT-*`, and `ARC-*`.
6. `tools/numberdroid-studio/docs/ARCHITECTURE.md` — three layers, four
   interfaces, one-writer/task-branch invariants.
7. `tools/numberdroid-studio/docs/MCP_CONTRACT.md` — accepted compatibility
   surfaces versus planned Authoring v2.
8. `tools/numberdroid-studio/docs/ROADMAP.md` — A0 through A6 order.
9. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_CONTRACT.md`,
   `CHECKPOINT_4_5_STATUS.md`, `CHECKPOINT_5_CONTRACT.md`, and
   `CHECKPOINT_5_STATUS.md` — implemented candidate facts and boundaries.
10. `docs/level-generation/LEVEL_SPEC.md`, `src/levelgen/types.ts`,
    `tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js`, and
    `tools/numberdroid-studio/tests/checkpoint-5-adapter.node-test.js`.

Do **not** initially load the complete story/narrative corpus, all art-production
recipes, campaign planning, metagame UI, or general runtime gameplay sources.
Load them only when a proposed capability needs a canonical rule they own:

- Technical Artist becomes mandatory before choosing the authoritative
  background/alpha-cleanup or sprite-processing operation set.
- Level Designer/Game Designer becomes mandatory before freezing the minimal
  cross-project actor/logic vocabulary or requirement schema.
- Runtime Engineer becomes mandatory when changing `LevelSpec`, compiler input,
  behavior/archetype mappings, or emitted runtime data.
- UI/UX becomes primary only when low-fidelity workflow/state maps are ready to
  become a visual implementation checkpoint.

## State at handoff

### Accepted / frozen

- Checkpoints 1–4 are user-accepted foundations. Do not casually rebuild them.
- One authoritative writer, SQLite WAL ledger, SHA-256 CAS, immutable activity/
  revision attribution, optimistic concurrency, idempotency, isolated task
  branches, semantic review/conflicts, atomic merge, and compensating revert.
- UI, MCP, CLI, and future remote adapters use the same application commands.
- Agents operate only through human-created immutable grants and trusted host
  context. They cannot mint/widen authority, self-approve, decide owner review,
  merge, choose arbitrary paths, materialize, commit, or publish.
- Accepted MCP compatibility is exact: 19 tools/four templates normally and 30
  tools/five templates for a matching live task binding.
- Historical checkpoint contracts are truthful regression records. Do not edit
  them to make old scopes look like the new final vision.

### Implemented but not accepted

- Checkpoint 4.5 candidate: list/create/detail task flow, useful prop preview,
  persistent room canvas, explicit `VOID`/`BLOCKED`, schema v12. The later
  composer-refresh blocker was repaired and chat-confirmed merged in PR #138,
  but CP4.5 still needs the user's resumed live gate.
- Checkpoint 5 candidate: pure Numberdroid snapshot/candidate mapping and fixed
  canonical compiler bridge. It has no candidate persistence/approval UI,
  materialization, commit, or publication authority.
- The 2026-08-27 product-direction document edits are present in this working
  tree and have not been independently committed/pushed/CI-verified here.

### Planned / not implemented

- `ProjectCapabilityManifest`, generic Authoring Command/Query contract,
  generic immutable `CandidateManifest`, and `EngineBridge` as explicit stable
  interfaces.
- Reproducible non-destructive image-processing recipes beyond the accepted PNG
  crop slice.
- Complete MCP parity for ordinary Artist and Level Designer work under an
  explicit Authoring v2 discovery gate.
- Versioned typed level requirements, full level graph, actor instances/routes,
  pickups/drops, typed variables, trigger/condition/action logic, dialogue/text,
  and capability-advertised waves/spawners.
- Complete Numberdroid reference scenario: a routed actor is defeated, drops a
  key, and collecting it changes state and displays text.
- Thin Godot 2D/Tower Defense portability proof after the Numberdroid vertical.
- Detailed responsive UI mockups and implementation after command/workflow
  contracts stabilize.

### Open decisions and owners

| Decision | Current default | Decision owner / trigger |
| --- | --- | --- |
| Minimal cross-project logic vocabulary | Prove Numberdroid needs first; keep adapter-namespaced extensions typed/fail-closed | User + Game Designer + Runtime Engineer before A3 schema freeze |
| Exact first image-processing operations | Crop/trim/padding/normalize/resize plus safely specified alpha cleanup and atlas/sprite operations | User + Technical Artist before A1 implementation |
| Agent finalization semantics | Agent may build an immutable candidate and submit it; owner acceptance/merge/release remain human | User + Security when Authoring v2 capabilities are frozen |
| First external portability proof | Thin Godot 2D/Tower Defense after Numberdroid A4 | User after A4 acceptance |
| Round-trip engine synchronization | No; one-way candidate import first | User + Engine integrator only with a concrete round-trip need |
| Detailed UI mockups | Not now; low-fidelity workflow/state maps first | User + UI/UX after A0 and before visual A1/A3/A6 gates |

## Technical context

Important current paths:

- Studio root: `tools/numberdroid-studio/`
- Current domain: `tools/numberdroid-studio/packages/domain/src/`
- Shared application core: `tools/numberdroid-studio/packages/application/src/`
- MCP adapter: `tools/numberdroid-studio/packages/mcp-server/src/`
- Numberdroid adapter: `tools/numberdroid-studio/packages/numberdroid-adapter/src/index.js`
- CP5 adapter tests: `tools/numberdroid-studio/tests/checkpoint-5-adapter.node-test.js`
- Numberdroid LevelSpec types: `src/levelgen/types.ts`
- Numberdroid LevelSpec contract: `docs/level-generation/LEVEL_SPEC.md`

Current `LevelSpec` already contains spaces/connections/props, Numberdroid-specific
`EncounterIntentSpec`, staged actors, routes, access-key pickups, trigger zones,
triggers, events, flags via `set-flag`, actor spawn/despawn/move/pass-by, and story
beats. Do not delete these. The forward work must preserve them through the
Numberdroid adapter while adding only missing typed semantics such as actor
defeated/drop/show-text and generic variable/condition needs. Do not move
`EncounterIntentSpec`, `EnemyId`, `MathMode`, or other Numberdroid concepts into
the Studio universal core.

Useful commands after verifying the actual checkout/dependencies:

```bash
cd tools/numberdroid-studio
npm ci
npm run check
npm test
npm run evidence:verify
```

For a focused A0 slice, add contract and dependency tests first. Run the complete
Studio suite before handoff. Run root `npm test` and `npm run build` if the slice
touches root compiler/types or root integration; A0 should avoid that initially.

The accepted local Studio service is loopback-only. Remote service, backup UI,
and mobile work are separate O0–O4 gates in
`tools/numberdroid-studio/docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`; they are not
part of A0.

## Reusable process decisions

- Solve the Numberdroid problem completely before generalizing from it.
- Generalize at versioned ports and manifests, not by weakening types into
  arbitrary JSON blobs.
- A project capability manifest is discovery and validation input, not authority.
- Candidate build is non-destructive and grants no destination/release right.
- Agents author through semantic commands, never UI automation.
- UI and MCP parity means equivalent commands/results, not identical interaction.
- Share immutable artifacts across agents; isolate mutable semantic work by task.
- Treat engine editors as downstream runtime/playtest authorities, not databases
  that Studio edits behind their backs.

## Exact next action — A0 capability-contract slice

### First inspection

1. Verify remote `main`, PR #138 merge, current Actions, and the complete dirty
   worktree. Do not overwrite or squash unrelated CP4.5/CP5/Operations work.
2. Compare the 2026-08-27 document changes with the current remote versions and
   report any authority conflict before implementing.
3. Inspect the existing domain package exports, Numberdroid adapter input shape,
   CP5 fixtures/tests, package-boundary tests, and accepted MCP feature gates.

### First bounded implementation block

Propose, then implement only if no authority conflict exists:

- a versioned, fail-closed `ProjectCapabilityManifest` domain/port contract;
- a minimal Numberdroid capability fixture/profile that truthfully describes the
  capabilities already present in current `LevelSpec`/CP5 without claiming the
  missing actor-defeat/drop/text path;
- pure validation and compatibility tests for known/unknown versions, duplicate
  IDs, unsupported modules/vocabulary, bounded limits/extensions, canonical
  serialization/fingerprint, and adapter/core dependency direction;
- a read-only application query/port shape if needed for later UI/MCP parity,
  but **do not advertise a new MCP resource/tool yet**.

Prefer adding this to an existing real package over creating empty
`authoring-modules` or `adapter-contracts` directories. Do not design the complete
actor/logic DSL in A0.

### May change

- current vision/requirements/architecture/MCP/roadmap docs when implementation
  evidence finds a concrete correction;
- existing domain/application contract code and focused fixtures/tests needed for
  the capability manifest;
- Numberdroid-adapter fixture data needed to expose a truthful profile without
  changing compiler output.

### Must not change in A0

- accepted Checkpoint 1–4 behavior, schemas, historical contracts, evidence, or
  exact 19/4 and 30/5 discovery surfaces;
- CP4.5 acceptance state or its live user gate;
- SQLite schema, persisted projects, UI layout/CSS, mobile/remote service, backup
  state machine, or host/pairing security;
- Numberdroid `LevelSpec`, runtime behavior, compiler output, or repository files;
- concrete Godot/Unreal adapters, direct engine files, materialization, Git/GitHub,
  publish, or release;
- a universal actor/logic schema based only on speculation.

### Definition of done

- manifest schema/version and fail-closed behavior are documented and tested;
- the universal contract imports no Numberdroid/runtime/UI/MCP/SQLite code;
- the Numberdroid profile is adapter-owned and matches only currently proven
  features/limits;
- unknown version/module/vocabulary/extension and invalid limits fail with stable
  structured findings/errors;
- canonical representation/fingerprint is deterministic;
- accepted MCP discovery counts and UI behavior are byte/behavior unchanged;
- focused tests, full Studio tests/check, and applicable boundary tests pass on
  Linux and Windows CI;
- no database migration or new empty package facade was introduced;
- status/docs record exactly what is implemented versus still planned;
- the receiver creates the next stranger-friendly handoff for A1 or A3 planning.

### User / live QA gate

A0 is non-visual and may be automated/test-reviewed without detailed UI mockups.
Do not claim CP4.5 acceptance. Before broad Artist or Level Designer UI changes,
show the user low-fidelity workflow/state maps. Detailed responsive mockups are a
separate approval artifact once semantic commands, capability discovery, normal/
empty/error/conflict states, and information hierarchy are stable.

## Cross-role transition

Product architecture is primary now because the risk is incorrect boundaries,
not missing pixels or screens. Technical Art and Game/Level Design have not been
asked to freeze operation or logic vocabularies yet. Bring them in at A1 and A3
respectively. Runtime Engineering must review any later mapping that changes
Numberdroid `LevelSpec` or compiler behavior. UI/UX should receive stable semantic
workflows rather than invent architecture from polished mockups.

## Receiver launch protocol

1. Verify current remote `main`, PR #138, Actions, and local worktree state.
2. Read the universal bootstrap and the exact bundle above.
3. Inspect actual current source, tests, adapter fixture, and LevelSpec.
4. Summarize the product direction, accepted/candidate boundaries, and any
   conflict with newer repository authority.
5. Propose the smallest A0 capability-contract implementation and its tests.
6. Implement only after resolving any authority conflict; preserve accepted MCP,
   persistence, UI, and release boundaries.
7. Stop before actor/logic schema freeze, UI mockups, database migration,
   Godot/Unreal output, materialization, or publication unless the user explicitly
   opens that later gate.
