# Numberdroid Studio

**Continuing Studio work:** use [Start here](docs/START_HERE.md) for the current
direction, bounded task reading routes and deferred live checks. As of
2026-09-06, VT-001 remains **REVISE**; its remaining live checks are deferred
and nonblocking for authorized development.

Numberdroid Studio is the local-first, agent-first authoring and production system for turning visual sources and level requirements into inspectable, validated game-content candidates. Numberdroid is the first complete target; reusable core and authoring modules may later feed other project or engine adapters. The visual application and MCP server execute the same semantic commands through one application core.

The product lives in this self-contained folder so it can be moved into a standalone repository without moving Numberdroid runtime code with it. Numberdroid-specific imports and exports belong only in `packages/numberdroid-adapter`. The binding product direction is [Product Vision](docs/VISION.md); historical checkpoint contracts remain compatibility and regression records, not the final scope ceiling.

## Status

Checkpoint 1 is the accepted foundation, Checkpoint 2A was user-accepted on 2026-08-21, and **Checkpoint 2B was explicitly user-accepted on 2026-08-22 after the live walkthrough at head `309c24961f89389047db837471b2e434dd13e149`.** The earlier native-file-input and five-second cutter-scroll blockers remain part of the rejection history. Product repair `dd2a4ff2ebdb856af32d5339b996fed9dd69ad2d` preserves unchanged cutter DOM/focus/scroll, bounds one poll owner, restores compatible necessary renders, and defers external replacement during a captured drag; selector-only repair `04d876da750f348e24de9420be1ff59c349bc092` keeps the evidence independent of regenerated rectangle IDs. GitHub Actions run `32568108922` and artifact `9474639509` remain the pinned repaired browser evidence; final closure run `32572870510` and artifact `9475808319` are the post-acceptance evidence, and closure-head run `32573543172` passed at `c27fee7004ddc7d6a6f357e9dacab2d663e6ae82`. In the live acceptance pass, a 12+ second passive refresh preserved both cutter axes, focused `Top margin = 5`, and page position; definition save, 4/4 preview, 4/4 atomic apply, explicit recut mapping, close/reopen discard of unsaved edits, and a full service restart all behaved as required without duplication.

**Checkpoints 1–4 are user-accepted, and PR #135 was separately merged on 2026-08-24. The latest CP4.5 plus CP5 candidate source was integrated into `main` through PR #137 on 2026-08-25; Checkpoint 4.5 still awaits its live user gate and CP5 remains candidate-only, so the source merge accepts neither checkpoint.** The 4.5 candidate makes delegated tasks list-first with focused creation and one truthful detail flow, adds a useful exact-slice prop preview before approval/placement, replaces the rejected six-page room flow with a persistent canvas/toolbox/dock editor, and adds explicit sparse `VOID`/`BLOCKED` room semantics. Schema v12 persists immutable shape cells; rectangular room bundles stay schema v2 and only masked rooms require schema v3. The first 5 slice freezes exact FINAL closures, builds deterministic virtual Numberdroid files/CAS copy descriptors, and runs the canonical compiler through a fixed bridge. Candidate materialization, candidate-created Git commits, release, publication, and all related agent authority remain blocked; ordinary human-authorized source integration is a separate repository-maintenance action. See the [Checkpoint 4.5 candidate record](docs/CHECKPOINT_4_5_STATUS.md), [Checkpoint 5 contract](docs/CHECKPOINT_5_CONTRACT.md), [Checkpoint 5 candidate status](docs/CHECKPOINT_5_STATUS.md), and [roadmap](docs/ROADMAP.md).

The agent-first A0.1–A0.4 contracts are integrated but not user-accepted.
A1.0, A1.1, and A1.2 were explicitly user-accepted on 2026-08-27 and merged in
that order through PRs #144–#146. The separate acceptance record was committed
as `bbb7ace8f47ceed8534f34fad90136931f1f68e1`, merged through PR #147 as
`0592d90f7bcfd23c3c01df490ef92cb2ed212a37`, and verified by green main run
`33109124192`. Their bounded contracts cover the accepted
exact-PNG crop operation only: a pure recipe, a pure result record with
recipe/processor/input/output evidence and structured findings, and immutable
selection intent for one exact result output as a `surface`, `prop`, or `item`
primary visual. No slice adds a persisted processing workflow, semantic
adoption command, or new pixel operation. See the [A1.0 status](docs/A1_0_STATUS.md),
[A1.1 status](docs/A1_1_STATUS.md), and [A1.2 status](docs/A1_2_STATUS.md).

A1.3, A1.4, A1.5, A1.6a, A1.6b1, A1.6b2a, A1.6b2b, and the A1.7 read
projection are now
**implemented candidates and are not user-accepted**.
A1.3's read-only project-bound receipt closes Recipe → Result → Selection, an
exact dedicated capability operation, registered-plus-physical CAS
revalidation, findings policy, and exact Asset create/update plus
metadata-version coordinates without mutating an Asset. The current Numberdroid
profile v1 deliberately remains unsupported. A1.4 adds the strict private
`asset.processing-result.adopt` command and agent-task planning policy, then
repeats a fresh branch-bound A1.3 preflight and produces only a deterministic
nonauthorizing, nonpersisted plan. A1.5 adds one private atomic-store port and
schema-v13 branch-native persistence seam. It repeats every mutation-time check,
holds exact CAS byte evidence through one SQLite transaction, and persists a
DRAFT processing Asset projection, immutable Aggregate/replay result, two
role-bearing retention references, Activity, and one branch command charge with
fault/restart/integrity/backup evidence.
The new type remains absent from the accepted 33-command catalog and 30-scope
grant vocabulary. A1.6a adds one separately typed Authoring-v2 command feature,
the exact additive 31-scope vocabulary, Numberdroid profile v2, trusted
task/grant provisioning support, and real effect-free SQLite/CAS planning
ports. No server, launcher, HostBinding, MCP, HTTP, or UI composition selects
them at the A1.6a boundary, so no current client could receive or execute the new path. A1.6b1 closes
current Grant liveness in HostBinding resolution and adds a separately composed
host-bound A1.5 port whose Binding/Grant guard runs before replay and again
inside the mutation transaction. Existing audited generic and specialized MCP
bridges now use only the strict live resolution for dispatch identity after
nonauthorizing audit attribution, with one correlation across both phases. It
still adds no callable surface. A1.6b2a composes a private one-shot session: a
full server-validated v2 admission and real A1.4 path for capabilities/dry-run,
plus a direct, separately typed host-bound A1.5 commit path that preserves
ledger-first lost-response replay at exhausted budget. The SQLite production
server keeps this runtime in a module-private `WeakMap`; it adds no route,
launcher selector, MCP tool/resource, UI, or returned runtime field. None of
the six adds a new pixel operation, Main/CP2C mutation, or owner/release authority.
A1.6b2b adds the separately selected local transport over that runtime. Only
the exact process setting `NUMBERDROID_STUDIO_MCP_PROFILE=authoring-v2` requests
it; an absent setting preserves legacy startup unchanged and every other set
value fails closed. A positive private loopback/Bearer server negotiation is
required before the stdio server is built. It returns `AVAILABLE` or
`REPLAY_ONLY` and pins a static surface of exactly 31 tools and six resource
templates: the existing task-bound 30/five surface plus only
`studio_processing_result_adopt` and
`studio://projects/{projectId}/capabilities`. Capability reads and dry-runs
repeat fresh full admission and remain budget-strict. Commit instead enters a
fresh HostBinding-bound A1.5 store directly so a same-key lost-response replay
remains recoverable after the one-command budget was charged. Discovery stays
static for that running process, while revocation or other authority drift is
freshly denied on the next operation. There is no fallback to 30/five and no
launcher auto-opt-in, public HTTP/UI selection, scope-catalog exposure, or
owner/release operation.
See the
[A1.3 candidate status](docs/A1_3_STATUS.md) and
[A1.4 candidate status](docs/A1_4_STATUS.md), plus the
[A1.5 persistence candidate status](docs/A1_5_STATUS.md) and
[A1.6a prerequisite candidate status](docs/A1_6A_STATUS.md), plus the
[A1.6b1 admission candidate status](docs/A1_6B1_STATUS.md), plus the
[A1.6b2a private-session candidate status](docs/A1_6B2A_STATUS.md), and the
[A1.6b2b transport candidate status](docs/A1_6B2B_STATUS.md). The
[A1.7 implementation-grounded state contract](docs/A1_7_STATE_CONTRACT.md) is
frozen at D0, and its separate
[human-safe read projection](docs/A1_7_READ_PROJECTION_STATUS.md) is now an
implemented candidate. The bounded visual review/correction surface remains
the next L3 implementation block; A1 remains incomplete. The operations O0/O1
lane is independent and retains its own gates.

Checkpoint 2B acceptance was recorded in `52eb9d32cab4fcbf20559455bc141215e7fb8998`. Later commits `f116f25aed2f0a9d935de9061cf6492d3a56bef4` and `b9ce37e44fe3679b52b50dac6daf4e1a46024c1d` change only the `visualFixture`/test evidence harness; they do not change product behavior or reopen acceptance. Failed run `32571622269` (both Studio attempts failed; artifact `9475480760`, 846 bytes) and failed run `32572344465` (Studio job `97029542069`, isolating Chrome/CDP post-move pointer-capture bookkeeping) are invalid diagnostic evidence only. Final post-acceptance closure run `32572870510` passed Studio job `97030836851` and root job `97030836927`; Pages was intentionally skipped. Its valid 16-file artifact `9475808319` is 2,839,931 bytes, `sha256:1ec032b0516dab09ea8dd33f4347714ed90caaca86dfabea883db57821d8fc2f`, and expires `2026-09-05T12:26:26Z`. Under Chrome `151.0.7922.137` at 1440×900 and 1060×900, it records zero runtime and visual errors and proves captured press, a same-pointer held move, deferred rendering, matching release/settlement/replacement, exact scroll/context retention, and telemetry cleanup. Run `32568108922` / artifact `9474639509` remain the product-repair evidence; run `32572870510` / artifact `9475808319` are the final post-acceptance closure evidence.

| Area | Current status |
| --- | --- |
| Product contract | Checkpoints 1–4 and bounded A1.0–A1.2 contracts user-accepted; A1.3–A1.6b2b, the A1.7 read projection, Checkpoint 4.5, Checkpoint 5, and A0.1–A0.4 remain implemented candidates without user acceptance |
| Standalone boundary | Accepted package/dependency boundary; extraction remains a later packaging task |
| Human UI | Accepted source/asset/room/task foundations plus candidate list-first tasks, useful prop previews, and persistent-canvas rectangle/irregular-room authoring |
| Agent access | Absent profile selection preserves 19 tools/four templates without a task and 30 tools/five templates for a matching legacy task. Exact `authoring-v2` selection plus a positive private server negotiation exposes static 31/six only for the matching v2 task; every other set selector, failed negotiation, later authority check, and fallback attempt fails closed. Owner review, merge, materialization, and publication remain human-only. |
| Persistence | SQLite schema v13 WAL ledger with normalized immutable shape cells plus private branch-local processing-adoption lineage/retention; sanitized portable bundles remain v1/v2 and v3 only for masked rooms |
| Numberdroid export | Dependent CP5 candidate-only snapshot/adapter/compiler foundation; no persistence/approval UI, materialization, commit, or publishing authority yet |

## Run the accepted Checkpoints 1–4 and the Checkpoint 4.5 candidate locally

Requirements: Node.js 22 or newer. Dependencies and the official MCP client/server versions are pinned by `package-lock.json`.
The Studio regression suite runs in CI on Ubuntu and on Windows with Node.js 22.17.0. Test resources are released in reverse acquisition order so Windows can close SQLite WAL files before temporary workspaces are removed.

```bash
cd tools/numberdroid-studio
npm ci
npm test
npm run evidence:verify
npm run dev
```

Open `http://127.0.0.1:4317`, choose **Create / load demo**, then use **Sources** for intake/cutting and **Assets** for exact-slice V2 review. In **Rooms**, create an archetype and DRAFT room or hallway, edit intent/connectors, select an exact-version asset, and place it on the coordinate grid. In **Agent tasks**, compose a scoped isolated branch, inspect its scope/budget/timeline, pause/resume/cancel it, and perform semantic review/merge/revert. Validation, warning disposition, finalization, proposal decision/apply, merge, and revert remain explicit owner controls in the currently accepted surface. `Propose in draft` activates only for an actual matching task branch. The default workspace is `.numberdroid-studio/`: `studio.sqlite` is authoritative, `artifacts/` is the CAS, and the private MCP pairing listener is loopback-only. Set `NUMBERDROID_STUDIO_DATA` to select another workspace.

### Launch one or more worktrees for safe comparison

Use the dependency-free worktree launcher when testing one candidate or comparing
several checked-out branches. It discovers Git worktrees, supports comma/range
multi-selection, assigns a different free loopback port and fresh data directory
to each selection, prepares an optional VT-001 fixture, and verifies the served
HTML before reporting an instance as ready:

```bash
# From a Numberdroid repository worktree root:
npm run studio

# Equivalent compatibility alias (including the command suggested by npm):
npm run dev:worktrees

# From an extracted/standalone tools/numberdroid-studio checkout:
cd tools/numberdroid-studio && npm run dev:worktrees
```

The normal menu is generated from the worktrees that exist now. It puts the
current folder first and uses it when Enter is pressed without a number. Every
entry shows the actual branch name (or detached snapshot), the final five commit
characters, plain local-file counts, and whether that same branch is current on
GitHub, has unpulled commits, has local-only commits, differs, or exists only
locally. Broken/prunable worktrees are hidden. Type `d` in the prompt or pass
`--verbose` only when full paths, SHAs, trees, and `main` comparisons are useful.
After version selection, choose **Create a working project**, **Open a working
project**, or **Start a test fixture**. A working project uses one selected
worktree; fixture comparisons may use several. Test profiles remain `empty`,
`vt001-room`, `vt001-task`, and `review-feedback`.
For a reproducible non-interactive launch:

```bash
npm run studio -- --list
npm run studio -- --select 1,3-4 --fixture vt001-room
npm run studio -- --all --fixture empty --base-port 4317
```

For ongoing authoring, create a named project in a new absolute directory
outside temporary storage and every repository worktree. Its parent directory
must already exist. Studio creates an empty project with that name, ready for
your own sources and rooms. Reopen the same directory to continue saved work:

```bash
npm run studio -- --select 1 --new-project "Transfer Hall" --project-directory /absolute/new-project
npm run studio -- --select 1 --open-project /absolute/new-project
```

Create refuses every existing destination, including an empty directory. Open
requires the working-project identity written by this launcher, a matching
saved Studio project, supported schema and safe SQLite/CAS paths. It checks a
private copy of the database and any WAL before opening the original; that
inspection is bounded to 512 MiB of database/WAL data and 100,000 filesystem
entries. Unknown, incomplete, shared/hardlinked, redirected, backup and
quarantined directories are refused. This mode does not adopt an older unmarked
workspace or activate a restored copy. Reopening issues no project command.

The saved-project directory and temporary launch logs are reported separately.
Type `q` and press Enter to stop; your project remains at its selected location.
Launcher-created current Studio children first drain through private process
IPC, with bounded termination fallback when shutdown cannot finish. No browser
or MCP shutdown operation is added. This is an automated implementation
candidate; its live user check is deferred under VT-015.

Each ready block retains the exact worktree, branch, full HEAD, committed Studio
tree, effective source fingerprint, fixture profile, HTTP health result, PID,
URL, data directory, and log path needed to verify a test. Missing Studio
dependencies and prunable worktrees are available only in technical details;
Git-locked worktrees remain usable. The launcher never runs
`npm install` and never opens a browser automatically. Fixture mode always
creates fresh data; only explicit **Open a working project** reuses a verified
saved directory. It performs one bounded,
read-only check of GitHub branch heads; technical mode includes exact
relationship details. Use `--offline` to rely on cached `origin/*` references. It never
switches, pulls, fetches, stashes, or overwrites a worktree: the selected local
files always start as-is.
Type `q` and press Enter to gracefully stop all children; Ctrl+C remains a
secondary shortcut. Fresh fixtures and logs are deliberately retained at the printed data
root until the test result has been recorded; remove only that exact launch root
through normal OS temporary-file cleanup afterwards.

Checkpoint 2A source intake remains synchronous and bounded to 16 MiB and 4096×4096. It calls no provider and serves the verified original CAS bytes. Checkpoint 2B adds local, deterministic PNG cutting only; WebP remains valid for intake/original preview but cannot be cut by the 2B processor. Provider selection, egress, credentials, cost policy, and reproducibility expectations require a later explicit decision.

The accepted 2A slice remains deliberately single-user and refuses a non-loopback HTTP listener. A future remote/team deployment requires authenticated HTTP/TLS and is a separate adapter, not an environment-variable widening of this local service.

The server enforces one authoritative SQLite writer. `NUMBERDROID_STUDIO_STORE=json npm run dev` launches the protected JSON regression adapter explicitly; never run JSON and SQLite as simultaneous writers for the same logical workspace.

## Human Asset authoring candidate

[Human Asset authoring](docs/HUMAN_ASSET_AUTHORING.md) fills the missing UI step
from a saved image slice to an Asset proposal. Its bounded form makes name,
purpose, footprint, anchor and manual placement choices explicit, then uses
the existing owner review and Apply flow. A DRAFT Asset can be placed in a
DRAFT Room; finalization remains separate. Local regression, native browser
authoring/placement/restart and independent reviews passed. Final CI and source
integration are recorded in its focused PR; the live decision is deferred as VT-017.

## Human task review feedback candidate

[Task review feedback](docs/TASK_REVIEW_FEEDBACK.md) adds a required summary for
Request Changes, optional item comments and exact-review version checking.
The current editable review appears before task facts and progress; saved prior
reviews remain history. **Let agent continue** permits work but starts no agent.
The fresh `review-feedback` launcher profile is the bounded VT-016 walkthrough.
Focused/native-browser proof and the full local Studio regression passed.
Final CI and source integration are recorded in the focused PR; user acceptance
remains deferred. The processing-adoption panel and separate agent-harness gates
remain unchanged.

## Connect a local MCP host

1. In the Header **Agent access** pull-down, choose the narrowest suitable posture and confirm any broadening.
2. Open the effective-policy badge and choose **Show host setup**. Copy this secret-free MCP server entry into the local agent host.
3. Start/restart that host. Its stdio server starts immediately while its private loopback pairing request appears in the Header panel with a six-digit verification code.
4. Compare the code with the host diagnostic on stderr, then choose **Authorize**. The opaque credential travels only over the non-browser pairing channel and is held by the host process; it is never returned to the DOM, clipboard configuration, URL, logs, or browser storage.
5. The panel now lists the redacted authorized binding. **Revoke** stops it immediately. Changing posture revokes existing bindings; create and authorize a new host request for the new immutable grant. `Off` revokes all active bindings and they never reactivate later.

MCP stdout is protocol-only. Pairing state and protocol diagnostics go to stderr. The Header distinguishes an active policy from an authorized host: a `SCOPED` policy alone does not mean that an agent is connected.

Legacy MCP startup requires no profile setting and remains the default. The
A1.6b2b candidate is deliberately manual and non-UI: set exactly
`NUMBERDROID_STUDIO_MCP_PROFILE=authoring-v2` only for a host already bound to a
trusted v2 task/grant. Startup then requires a positive private server
negotiation; unavailable, malformed, mismatched, revoked, or unsupported state
terminates that host without falling back to legacy discovery. A successful
host exposes its fixed 31/six catalog for its lifetime, but every capability
read, dry-run, and commit resolves current authority again. Cancellation
propagates from MCP through the gateway to the server session; an atomic commit
is not interrupted, and an uncertain result is recovered with the same
idempotency key. Graceful shutdown drains active v2 operations before closing
the writer. Successful capability/dry-run reads create no authorization row,
successful commits use their atomic semantic Activity, and attributable
denials/failures add one redacted final attempt; pre-binding failures remain
unattributed. Restart reconstructs the surface through a new positive
negotiation and may return `REPLAY_ONLY` so an exhausted-budget replay remains
possible without authorizing new work.

## Private remote read-only candidate

O2a now has a separate Linux/systemd deployment adapter for an authenticated
private HTTPS read-only Studio. It preserves the local loopback service and
does not expose Backups, MCP, pairing, Agent-access authority, demo creation,
or any mutation remotely. It is an implemented candidate, not an activated or
user-accepted deployment. See the
[O2a status](docs/O2A_PRIVATE_REMOTE_SERVICE_STATUS.md) and the
[operator runbook](docs/O2A_PRIVATE_REMOTE_SERVICE_RUNBOOK.md).

## Administration, migration, and recovery

Stop the Studio process before administrative commands. Backup and restore destinations must be new. `migrate-json` creates a migration-intent identity file and may reopen only the same matching partial migration after a crash; it refuses unrelated directories, other migration IDs, changed source manifests, foreign projects, or non-migration data.

```bash
# Inspect and protect a C1A JSON source before cutover
npm run admin -- manifest-json /path/to/frozen-json
npm run admin -- migrate-json /path/to/frozen-json /path/to/new-1b-data migration-2026-08-21

# Verify and back up a SQLite/CAS workspace
npm run admin -- integrity /path/to/1b-data
npm run admin -- backup /path/to/1b-data /path/to/new-backup
npm run admin -- verify-backup /path/to/new-backup

# Export/verify/import a sanitized project bundle through new destinations
npm run admin -- bundle-export /path/to/1b-data PROJECT_ID /path/to/new-bundle
npm run admin -- bundle-verify /path/to/new-bundle
npm run admin -- bundle-import /path/to/new-bundle /path/to/new-data

# Restore only into a new destination
npm run admin -- restore /path/to/new-backup /path/to/new-restored-data
```

Migration writes a protected JSON copy, source manifest, parity report, and `cutoverPerformed: false`; selecting the new data directory remains an explicit operator step. If migration stops, rerun the exact same command with the same frozen source, destination, and migration ID. The destination identity and every already-copied project are verified before continuation; never rename or edit the intent file to force reuse of another store.

`admin integrity` checks SQLite integrity and foreign keys plus every distinct referenced CAS object. It verifies that referenced metadata is `LIVE`, the digest-addressed object exists, its SHA-256 digest matches, and its byte length agrees with SQLite. It prints an `artifacts.findings` array and exits with status `2` whenever SQLite or any referenced artifact fails. An empty findings array with exit status `0` is required before cutover, backup, or recovery acceptance.

Schema v12 also verifies staged/claimed/abandoned source-intake references, permanent source/atlas/asset lineage, jobs, immutable assets/rooms and sparse shape cells, proposals, task branch/review/merge/revert lineage, rebuilt heads, imported APPLIED history, and state-specific CAS references. Portable export refuses nonterminal tasks and transfers no task authority/history. Roomless bundles remain schema v1, rectangular room projects remain schema v2, and masked-room projects use strict schema v3. Migration 0011 remains pinned to `f6ed508f3098e6cdeb3dca2af0a9be7baca12c18fcd9d518f75f4f353242639d`; migration 0012 is pinned to `1e48171a0c70c4d015001287d254aad8359ea34970bddcb17168a8a368dd17e1`.

## Accepted Checkpoint 1 baseline

The accepted navigation, information hierarchy, revision/activity visibility, demo command outcomes, and host-injected authority behavior MUST remain reproducible after 1B. The protected source commit, read-only JSON fixtures, integrity manifest, expected counts/hashes, reproducible browser capture workflow, and accepted run/digest/viewport record remain regression evidence for later checkpoints. The 26 screenshot bytes are currently only in a retention-limited Actions artifact; permanent screenshot goldens have not been published. See [the 1A baseline record](docs/CHECKPOINT_1A_BASELINE.md) and [1B acceptance record](docs/CHECKPOINT_1B_STATUS.md).

Checkpoint 1B adds two approved visual requirements without authorizing a broader redesign:

- a persistent Header **Agent access** pull-down with implemented `Off`, `Read only`, and semantic `Execute scoped task` authority, rendered compactly as the user-accepted `Scoped run`; the visible `Propose in draft` and `Custom…` entries are marked for later and grant nothing until branch/editor workflows exist;
- a small preview region on every Asset Library card, using an authorized image resource or an accessible kind-aware fallback for processing, missing, unsupported, or failed media.

## Product principles

1. **Agent-first.** Every ordinary authoring action is a semantic command available to an appropriately authorized agent; agents do not automate UI gestures.
2. **Visual and inspectable.** A user can see available material, every agent action, validation findings, requirement coverage, and the exact revision being changed.
3. **Semantic, not pixel-inferred.** Connectivity, collision, placement, role, and traversal semantics are explicit metadata. Image analysis may suggest values but cannot silently decide them.
4. **One command core.** UI, MCP, CLI, and future automation call identical commands and receive identical validation.
5. **Numberdroid first, interfaces reusable.** The complete Numberdroid path proves abstractions before another adapter is built.
6. **Local first.** Work-in-progress lives in a local database and content store. GitHub is an explicit, deterministic publish boundary, not an editing transport.
7. **Reversible by default.** Mutations are attributed, revisioned, idempotent where required, and recoverable through task branches and immutable history.
8. **Least authority for agents.** Every authority chain starts with a human-created root grant; trusted service-derived child tasks can only attenuate it. Authoring, review, merge, materialization, and publishing are distinct capabilities.
9. **Exportable product.** No core or reusable authoring module may depend on Numberdroid repository internals.

## Accepted Checkpoint 1 implementation layout

The accepted implementation uses these physical boundaries:

```text
tools/numberdroid-studio/
├── apps/
│   ├── studio-server/           # one-writer local service plus visual shell
│   ├── studio-mcp/              # official MCP stdio host and private bridge
│   └── studio-admin/            # migration, integrity, backup, and restore CLI
├── packages/domain/             # contracts, validation, errors, command catalog
├── packages/application/        # command/query core and storage port
├── packages/persistence/        # SQLite, CAS, migration, backup, JSON regression adapter
├── packages/preview/            # deterministic audited PNG decode/crop/encode
├── packages/mcp-server/         # secured semantic catalog and official MCP adapter
├── fixtures/                    # protected deterministic evidence
├── scripts/                     # verification/evidence preparation
└── docs/                        # product and architecture contracts
```

These are physical package boundaries, not facade names: domain has no outward dependency, application owns the storage port, persistence implements it, and the MCP adapter calls application commands through the running one-writer service. The combined UI/service host remains an accepted transitional packaging choice. No accepted core package imports Numberdroid internals. Empty reserved package directories do not count as implemented packages or capabilities.

## Target workspace layout as the product grows

```text
tools/numberdroid-studio/
├── apps/
│   ├── studio-ui/               # visual application
│   └── studio-service/          # one local writer and query service
├── packages/
│   ├── domain/                  # entities, invariants, value objects
│   ├── application/             # commands, queries, policies, jobs
│   ├── persistence/             # SQLite and content-addressed storage
│   ├── preview/                 # deterministic visual projections
│   ├── mcp-server/              # MCP tools/resources over application APIs
│   ├── authoring-modules/       # optional image/atlas/level/actor/logic modules
│   ├── adapter-contracts/       # capability, candidate, and engine-bridge ports
│   └── numberdroid-adapter/     # the only Numberdroid-aware package
├── fixtures/                    # shared deterministic test projects
└── docs/                        # product and architecture contract
```

This is a target topology, not a statement that every listed folder exists today. Folders are introduced only when a checkpoint needs them; empty scaffolding is avoided.

## Scope

The first complete product slice covers source provenance, reproducible non-destructive image processing, atlas/sprite extraction, visual asset cataloguing, semantic asset metadata, requirements-driven Numberdroid level authoring, layout, actors, routes, pickups, typed level variables, triggers/actions, validation, revision history, parallel agent tasks, and an immutable Numberdroid candidate.

Studio may configure level-local actors and logic by reference to runtime systems. It does not implement the game's renderer, physics, combat, navigation, economy, or general AI. Repository materialization and production publishing remain separate human-authorized operations. A thin Godot 2D/Tower Defense proof follows only after the Numberdroid vertical path works; Unreal support requires a concrete later project and supported editor integration.

## Documentation

- [Product vision](docs/VISION.md)
- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MCP contract](docs/MCP_CONTRACT.md)
- [Roadmap and user checkpoints](docs/ROADMAP.md)
- [Operations, Remote Access & Mobile masterplan](docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md)
- [O0 backup/recovery operations contract](docs/O0_BACKUP_RECOVERY_CONTRACT.md)
- [O1a backup core status](docs/O1A_BACKUP_CORE_STATUS.md)
- [O1b Backups UI status](docs/O1B_BACKUPS_UI_STATUS.md)
- [O2a private remote service status](docs/O2A_PRIVATE_REMOTE_SERVICE_STATUS.md)
- [A3a typed level/logic kernel status](docs/A3A_LEVEL_LOGIC_KERNEL_STATUS.md)
- [A4a Numberdroid level projection status](docs/A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md)
- [A4b bounded reference behavior status](docs/A4B_REFERENCE_BEHAVIOR_STATUS.md)
- [A4c Level Candidate and derived child-task authority](docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md)
- [Consolidated return test backlog](docs/VACATION_TEST_BACKLOG.md)
- [Accepted Checkpoint 1A baseline](docs/CHECKPOINT_1A_BASELINE.md)
- [Accepted Checkpoint 1B foundation](docs/CHECKPOINT_1B_STATUS.md)
- [Accepted Checkpoint 2A source workflow](docs/CHECKPOINT_2A_STATUS.md)
- [Checkpoint 2B acceptance record](docs/CHECKPOINT_2B_STATUS.md)
- [Accepted Checkpoint 2C record](docs/CHECKPOINT_2C_STATUS.md)
- [Accepted Checkpoint 3 record](docs/CHECKPOINT_3_STATUS.md)
- [Accepted Checkpoint 4 record](docs/CHECKPOINT_4_STATUS.md)
- [Checkpoint 4.5 candidate record](docs/CHECKPOINT_4_5_STATUS.md)
- [Checkpoint 4.5 frozen contract](docs/CHECKPOINT_4_5_CONTRACT.md)
- [Checkpoint 5 candidate contract](docs/CHECKPOINT_5_CONTRACT.md)
- [Checkpoint 5 candidate status](docs/CHECKPOINT_5_STATUS.md)
- [Accepted A1.0 ProcessingRecipe contract](docs/A1_0_STATUS.md)
- [Accepted A1.1 ProcessingResult contract](docs/A1_1_STATUS.md)
- [Accepted A1.2 AssetInputSelection contract](docs/A1_2_STATUS.md)
- [A1.3 project-bound adoption preflight candidate](docs/A1_3_STATUS.md)
- [A1.4 processing-result adoption planning candidate](docs/A1_4_STATUS.md)
- [A1.5 processing-result adoption persistence candidate](docs/A1_5_STATUS.md)
- [A1.6a Authoring-v2 prerequisites candidate](docs/A1_6A_STATUS.md)
- [A1.6b1 host-bound admission candidate](docs/A1_6B1_STATUS.md)
- [A1.6b2a private execution-session candidate](docs/A1_6B2A_STATUS.md)
- [A1.6b2b private transport candidate](docs/A1_6B2B_STATUS.md)
- [A1.7 visual review/correction state contract](docs/A1_7_STATE_CONTRACT.md)
- [A1.7 processing-adoption read projection candidate](docs/A1_7_READ_PROJECTION_STATUS.md)
- [Checkpoint 3 frozen implementation contract](docs/CHECKPOINT_3_CONTRACT.md)

These current product documents are normative for the Studio implementation. If
code and documentation disagree, the discrepancy must be resolved explicitly;
it must not become an accidental new contract.

Current task entrypoint: [Start here](docs/START_HERE.md). Read a historical
handoff when explicitly named or needed for evidence; current code and
contracts remain authoritative.

## Safe reset and recovery

Stop the Studio process before moving a data directory. Prefer the verified administration flow above for durable recovery.

Preserve the existing workspace. Reset experiments use a fresh workspace; they
do not replace or rename the active one. For recovery, verify a backup and
restore it only into a new destination using the administration flow above.
Inspect the copy and its integrity results without replacing or activating the
current workspace. Restore-as-copy does not authorize activation or cutover;
that requires its own explicit decision under the
[backup/recovery contract](docs/O0_BACKUP_RECOVERY_CONTRACT.md).

Never merge data directories, copy only a live SQLite main file, edit ledgers manually, or reuse a restore destination. C1A migration is copy-and-verify into a new SQLite/CAS destination; the original baseline remains untouched as accepted regression and migration evidence even after 1B acceptance. Cutover is explicit, JSON and SQLite are never concurrent authoritative writers, and rollback preserves the failed/new destination plus recovery evidence instead of silently discarding post-cutover work.
