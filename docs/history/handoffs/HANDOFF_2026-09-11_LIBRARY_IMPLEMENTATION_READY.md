# Studio handoff — approved Library design, implementation next

DATE: 2026-09-11 (shutdown and backups completed 2026-09-10)
REPOSITORY: KlausUllrich/numberdroid
STATUS: Library design approved; Library production implementation not started
BASELINE MAIN HEAD AT CREATION: `47abdf4760b38d8d0b3927c815a2673b3b55590c`
BASELINE CI / PAGES STATE: post-merge Build #2443 / run34499715871 green,
documentation-only; last full runtime Build #2439 / run34492910394 green,
including Linux, Windows, final gate and the existing Pages workflow
PRIMARY RECEIVING ROLE: Engineer / Studio UI implementation
SECONDARY / TRIGGER ROLES: QA / Integrator / Release; Coordinator; Product with
Klaus for design changes; domain/persistence/MCP specialists only if their seams change
NEXT MILESTONE / TASK: implement Library navigation and existing detail/editor integration

This is the requested session handover, completed after the server restart.
The recorded main is the **pre-handoff** baseline. Resolve current remote main
and Actions through the GitHub connector. Read current binding documents first;
this snapshot does not override them or newer user instructions.

## Start without repeating broad onboarding

Complete the six-file universal bootstrap in AGENTS.md once for the new session.
Follow Engineer plus QA/Coordinator routes from ROLE_ENTRYPOINTS.md. Then read:

1. `tools/numberdroid-studio/docs/START_HERE.md`.
2. `tools/numberdroid-studio/docs/LIBRARY_NAVIGATION_DESIGN.md` — exact approved next screen.
3. `tools/numberdroid-studio/docs/AUTHORING_PRODUCT_MODEL.md` — Sources/Library, flexible
   content and agent-review boundaries; dated implementation notes do not override
   later scoped contracts or current source.
4. `tools/numberdroid-studio/docs/REVIEW_CHANGES_DESIGN.md` — shared-review target and
   distinction between the first navigation block and later semantic evolution.
5. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md` and the relevant Studio UI/application
   boundaries in `tools/numberdroid-studio/docs/ARCHITECTURE.md` for the Engineer route.
6. The scoped editor contracts for the surfaces being connected:
   `ASSET_EDITOR_IMPLEMENTATION_CONTRACT.md`,
   `ANIMATION_EDITOR_IMPLEMENTATION_CONTRACT.md`,
   `ASSEMBLY_EDITOR_IMPLEMENTATION_CONTRACT.md` in the Studio docs directory.

Inspect the actual source below before implementation. Append newly triggered
reads to the task-specific manifest through `docs/agents/CODEX_CONTEXT_RETENTION.md`.
If changing exact reads, additionally read `ROOM_PINNED_ASSET_READ_CONTRACT.md`.
If changing commands, authority, persistence, bundles or recovery, add their owning
contracts and tests before deciding; those changes are not implied by a browsing layout.

Do not initially load the whole story, art corpus, campaign, Level Compiler,
remote/mobile or every historical handoff. Artist/Technical Artist routes start
only for separately chosen production art or runtime integration. Sources redesign,
shared-review state evolution and a real production pilot have later scopes below.

## Verified milestone state

Accepted/frozen:

- Checkpoints1–4, A1.0–A1.2 and the earlier explicit VT-012/VT-014 acceptances remain protected.
- Cutter production batch passed; named cuts carry into new Asset drafts.
- VT-020 Asset editor and Activity-sidebar removal: user accepted, PR #227.
- Assembly Review/Blocking clarity correction: PR #230, post-merge green and
  explicitly user passed. The broader VT-021 record remains separate.
- VT-022 Animation production batch: Klaus explicitly said **pass**, tested main
  `f5f8bc28a66bed34e913806d0c64a2e8dd2018ae`, source PR #233. Acceptance is recorded
  through PR #234, main `0f33d99336e535b966f8c038b9bb1122174e2423`.
- Library v1 **design**: Klaus explicitly said **pass** to the five-item mockup
  batch; approved design recorded through PR #235 at the baseline above.
  This does not mean Library navigation or shared Review is implemented or accepted.

Implemented with separate pending gates:

- Existing Assembly composition, per-type proposal review, Room/task/Preview foundations.
- Broader VT-021 stays at its documented candidate state; do not infer closure from
  the bounded clarity or Animation test batches.
- VT-001 / CP4.5 and A1.7 remain REVISE. Remaining VT-001 live checks were deferred
  and are nonblocking for the authorized Studio development sequence.
- A1.3–A1.6b2b remain implemented but not accepted. Task Resume starts no real agent.

Planned, not implemented:

1. Approved Library navigation/detail integration.
2. Shared Review command/state workflow for related content, dependencies and partial pending work.
3. Detailed Sources Images/Preparation/Needs-review redesign.
4. A persistent real authoring pilot after its remaining human gate and source/scope selection.

Klaus owns product/design departures, production live acceptance, pilot/source
selection and separately gated export/release work. Engineering owns compatible
implementation choices within the approved bounded block.

## Task tracking evaluation — 2026-09-11

Klaus requested BB **Tasks** as the working board and repository copies in
**Taskboard** for evaluation. He currently finds repository-backed tasks more
promising, but no permanent tracker migration has been decided. Both plugins are
installed. Tasks project **Numberdroid Studio**, prefix **ND**, is linked to BB
project `proj_m7fxp8qv76`. Read the working task and its repository copy before work;
keep meaningful milestone status, criteria and links aligned manually. No automatic
bidirectional synchronization is configured, and creating a task starts no agent.

| Working task | Repository copy | Initial state / order |
| --- | --- | --- |
| ND-1 — Library navigation and contextual details | [#236](https://github.com/KlausUllrich/numberdroid/issues/236) | High priority, Todo; next implementation block |
| ND-2 — Shared Review for related content | [#237](https://github.com/KlausUllrich/numberdroid/issues/237) | High priority, backlog; follows ND-1 |
| ND-3 — Sources navigation/preparation design | [#238](https://github.com/KlausUllrich/numberdroid/issues/238) | Medium priority, backlog; follows ND-2, design discussion first |
| ND-4 — Deferred VT-001 live checks | [#239](https://github.com/KlausUllrich/numberdroid/issues/239) | Low priority, backlog; human gate, nonblocking for ND-1/ND-2 |
| ND-5 — Choose persistent authoring pilot | [#240](https://github.com/KlausUllrich/numberdroid/issues/240) | Low priority, backlog; remaining ND-4 gate and Klaus's source/scope choice |

Use the installed Tasks skill/CLI; begin with `timeout 10s bb tasks show ND-1 --json`.
Tasks is the active board during the evaluation. GitHub issues remain open until
all their completion criteria, including required user verification, are met.
Repository contracts and explicit user decisions remain authoritative.

Taskboard is configured for GitHub repository KlausUllrich/numberdroid, but its
current source view reports a schema integration error: **Unrecognized key: ghState**.
This is not evidence that GitHub access is unavailable: the connected GitHub
connector successfully created the linked issues. Recheck plugin status before
claiming the Taskboard view is working; no credentials or third-party plugin source
were changed during this task. Creating the repository copies does not fix that
plugin error. Native task/mirror identities are retained in
`/home/klaus/.bb/thread-storage/numberdroid-taskboard-evaluation-20260911.json`.

## Exact next block

Write a bounded Library implementation contract based on the approved design,
actual readers and return-state code, then implement the first block. There is no
need to redesign or request another approval for the already-passed Library mockup.
Bring a material design departure back to Klaus before implementation.

Promise:

- Assets and Pending changes sub-navigation; one current inventory for supported
  Images, Animations and Assemblies, with separate Content/Use filters and search.
- Equal whole-image previews; picture opens full-size in a new tab; name/Details
  opens a contextual in-app detail view and the existing content-specific editor.
- Back retains the section, filters, focus, scroll and compatible drafts.
- Saved versions remain visible while proposals are pending. A discovery filter
  never removes dependency context from an opened review.
- Pending entries link to currently supported review records. Activity owns history.
- Add from Sources and Create Assembly entry points; saved cuts stay in Sources.

First-block exclusions:

- Do not pretend separate native/Clip/Assembly proposals already form an atomic
  mixed-content group. Do not fake unsupported partial acceptance in the UI.
- Preserve existing owner decisions, exact versions, idempotent retry and unknown-save
  recovery. Shared Review needs its own compatible command/state contract as block2.
- No Sources redesign, new media, kit/variant-set storage, task Resume repair,
  generation, export/materialization, runtime behavior or broad repo cleanup.

Finish condition: focused source PR, actual-diff risk gates and independent review,
real-agent workflow proof appropriate to the changed navigation/review entry points,
exact unchanged green merge, observed post-merge CI, and a fresh production test
batch for Klaus. Keep source/CI/user-acceptance states separate. Add a new VT item
only once this new production implementation exists. Complete/report one coherent
block before implementing the next dependent block.

## Current source and verification entry points

All paths below are relative to `tools/numberdroid-studio/`:

- `apps/studio-server/public/app.js`: `renderAssetLibrary`, `renderV2AssetCard`,
  `renderSliceVocabulary`, `renderSources`, per-type review rendering, exact read
  caches, active Asset/Assembly/Animation editors, `mayAbandonAssetAuthoring`,
  `renderWorkspace` and capture/restore helpers. This is the main integration seam.
- `public/asset-editor-*`, `assembly-editor-*`, `assembly-artwork-view.js`,
  `assembly-library-view.js`, `assembly-review-*`, `animation-editor-*`,
  `animation-cut-*`, `animation-library-view.js`, `animation-review-view.js`
  under the server app. Preserve the accepted tools and pending-operation guards.
- `apps/studio-server/src/server.js`, `assembly-http.js`, `clip-http.js` for
  existing exact reads, static module routes and local owner writes.
- `packages/application/src/studio-service.js`, `assembly-service.js`,
  `clip-service.js`, `exact-cut-history.js` if a reader/semantic contract changes.
- Tests: `assembly-app-integration.node-test.js`, `saved-slice-labels.node-test.js`,
  relevant Asset/Assembly/Animation controller and HTTP/MCP tests.
- Native scripts: `verify-human-asset-authoring-browser.js`,
  `verify-assembly-editor-browser.js`, `verify-animation-editor-browser.js`.

Current protected data/API facts: SQLite17; conditional portable v6 for new Clip,
cut-revision and Assembly-v2 history; default MCP19/4, matching-task30/5,
private31/6, Assembly21/5, explicit animation-v1 25/7. Old profiles must fail
clearly on unsupported new content. Existing historical cut reads verify persisted
lineage, and Clip query output is bounded. Navigation should reuse these contracts.

Start with the smallest relevant check, for example:

```bash
cd tools/numberdroid-studio
timeout 120s node --test tests/assembly-app-integration.node-test.js tests/saved-slice-labels.node-test.js
timeout 120s npm run build
```

These are entry checks, not a substitute for the actual UI risk tier. Do not run
unrelated broad suites during onboarding. At freeze use the binding risk policy
and actual changed paths; repeat only affected checks after findings.

## Saved work and shutdown

All five servers were stopped cleanly on 2026-09-10: four Studio supervisors via
q + Enter, and the static mockup server via interrupt. Ports4317/4318/4319/4321/4323
were verified closed and their BB shares removed. After the 2026-09-11 restart,
BB reports no terminal sessions or shared ports. Do not assume old terminal IDs
or URLs still work.

| Workspace | Project | Saved revision | Persistent data directory |
| --- | --- | --- | --- |
| Cutter | `project.cutter-live-test` | 9 | `/home/klaus/.bb/thread-storage/numberdroid-cutter-live-20260908/1-main` |
| Assembly | `project.assembly-editor` | 20 | `/home/klaus/.bb/thread-storage/numberdroid-assembly-agent-data-03ef4a4c-33ec-465a-a865-4af9c50b25ee` |
| Review/Blocking clarity | `project.assembly-editor` | 18 | `/home/klaus/.bb/thread-storage/numberdroid-clarity-agent-data-ed624c3b-a6d0-4e92-b0b1-8bee9602a91b` |
| Animation | `project.animation-editor` | 23 | `/home/klaus/.bb/thread-storage/numberdroid-animation-agent-data-3f204256-f062-40ef-981f-27fda5da388f` |

All four have verified schema17 workspace/CAS backups under:
`/home/klaus/.bb/thread-storage/numberdroid-session-backups-20260910-07145e7b-ee2b-4a68-aab3-542d3f6ca0cb/`
(subdirectories `cuts`, `assembly`, `clarity`, `animation`). Backup creation did not
change their project revisions. `numberdroid-session-backup-result-20260910.json`
in thread storage records the exact results. Earlier schema16 backups are also
retained; do not overwrite or silently restore any workspace.

Never seed a fixture into these directories, a backup, restored copy or an
existing directory. New verification uses fresh directories; reopening saved
work uses its existing data without fixture preparation.

## Worktrees and local recovery

- `/mnt/development/game-projects/numberdroid`: original dirty checkout,
  `agent/room-placement-ghost-exit`, `46bc2e7d2d276da81150d659ce3725509c511fe8`;
  five modified and seventeen untracked entries. Preserve exactly, including
  context work and untracked art PNGs. Not an acceptance baseline or accepted art source.
- `/mnt/development/game-projects/numberdroid-main`: clean main at the pre-handoff
  baseline, intended test anchor after a safe connector-verified fast-forward.
- `/home/klaus/.bb/thread-storage/numberdroid-cutter-worktree`: clean task workspace;
  this handoff uses `agent/studio-library-handoff-20260910`. Start a new focused
  implementation branch from freshly verified main, preserving recovery history.
- Clean historical worktrees: `numberdroid-design-worktree` at `2d1b691`,
  `numberdroid-pinned-assets-worktree` at `89ea071`, both below thread storage.
- `/mnt/development/game-projects/numberdroid-studio-1b-qa`: historical detached
  `41fad464`, with untracked `tools/numberdroid-studio/.numberdroid-studio-visual/`.
- Git also records several prunable `/tmp` worktree entries whose directories are
  already absent. They are not the next task; do not perform uncertain cleanup.

Structured remote operations use the GitHub connector, not local Git networking
or gh fallback. Text publication helpers and exact connector-commit reconstruction
are retained in thread storage. Local checkpoint and remote commit IDs can differ
while their trees match; verify exact trees and restore remote commit objects from
connector metadata for offline fast-forward, never reset a dirty workspace.

## Mockup and restart tools

Approved Library artifacts are under
`/home/klaus/.bb/thread-storage/numberdroid-design/`:
`library-v1.html`, `library-v1.mjs`, `library-v1.css`, `library-art/`.
The owning Library design document records all three exact hashes. Native evidence
is under `library-evidence-v1/`, `library-evidence-v1-side/` and
`library-evidence-v1-completion/`. The earlier approved editor mockups also remain
there. They are design evidence and sample content, not production sources.

The existing helper reopens the four saved Studio workspaces without seeding or
Git mutation:

```bash
timeout 90s node /home/klaus/.bb/thread-storage/numberdroid-resume-after-bb-restart.mjs
```

It is bound to BB thread `thr_a29kc92hua` on host `host_hca7p73pi5` / klausipc.
Check `bb status` first; if using another thread or machine, adapt a reviewed copy
to the actual context and existing paths. Its supervisors require clean local main
and print branch, full SHA, local changes, unpulled state and exact data paths.
The normal repository `npm run studio` launcher remains unchanged and never hides
branch mutation. Use `bb connect expose PORT` for the remote URL; unexpose on stop.

For the optional static mockup, start a visible BB terminal with a bounded command:

```bash
timeout --signal=TERM --kill-after=10s 21600s python3 -m http.server 4318 --bind 127.0.0.1 --directory /home/klaus/.bb/thread-storage/numberdroid-design
```

Do not restart servers merely for onboarding. Start the needed saved instance or
fresh test fixture when useful. Compact local state is in
`numberdroid-library-design-doc-continuity.json`,
`numberdroid-design/library-v1-continuity.json`, and
`numberdroid-animation-implementation-continuity.json` under thread storage.

## Reusable lessons and boundaries

Klaus is a designer and Git beginner. Explain product consequences first and
present clear batches of tests; return to focused steps for a defect. Do not
repeat passed nuisance tests or an entire green suite for reassurance. Linux
captures browser evidence; Windows verifies tests/build/evidence compatibility,
not a second screenshot walkthrough without a concrete Windows UI risk.

Keep user-visible updates within60seconds and every command/test explicitly
bounded. Poll CI every30–60seconds; two unchanged polls trigger step/log inspection.
Publish coherent focused checkpoints promptly. Do not edit a PR body during active
CI: this repository's PR-edited trigger cancels/restarts it. Prepare the body first.

Preserve active editor controllers across navigation; pending/uncertain writes
must retain their exact request and key. Image evidence must actually decode
images, not only observe changing URLs. Close browser, server, worker and SQLite
handles before fixture removal, including on Windows. Distinguish raw stored
revisions from derived HTTP projections when checking migration parity.

The source/editor foundations can support a human-local pilot, but selecting its
real source and persistent project remains Product/Klaus work after the remaining
VT-001 decision. Never assume the dirty checkout's PNGs are accepted. Engine-neutral
Preview is approximate. No CP5/A5 materialization, repository content publishing,
release, remote/mobile, 2.5D, provider work or image generation begins automatically.

## Receiver launch protocol

1. Verify remote main, open PRs/relevant branches and Actions through the connector.
2. Read universal bootstrap once, follow Engineer/QA/Coordinator routes and the exact
   Library bundle above; register the selected context when supported.
3. Read the actual current Library/editor/review source and inspect local/saved state.
4. Summarize the approved scope and report any current authority conflict.
5. Write the bounded first implementation contract and begin the approved Library
   navigation block. Reopen Product only for a material departure from the approved design.
6. Keep shared Review semantics as the second block, and production acceptance as
   Klaus's explicit later decision. Do not infer acceptance or cross separate gates.
