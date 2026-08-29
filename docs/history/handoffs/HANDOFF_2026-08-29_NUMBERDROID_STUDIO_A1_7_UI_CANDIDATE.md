# Handoff — Numberdroid Studio A1.7 Visual Review and Correction Candidate

**DATE:** 2026-08-29

**REPOSITORY:** `KlausUllrich/numberdroid`

**STATUS:** Ready for A1.7. Checkpoints 1–4 and A1.0–A1.2 are explicitly
user-accepted. Checkpoint 4.5 and A1.3–A1.6b2b are implemented,
source-integrated candidates but are not user-accepted. Klaus cannot currently
perform live testing; A1.7 may proceed autonomously as a truthfully labelled,
bounded candidate, but no automated evidence may be called human acceptance.

**BASELINE MAIN HEAD AT CREATION:**
`2c4b6459199b019e0005153f95065fced74a5313` (PR #165 merge; tree
`d29ef29ec37193519e60d2342d986bd1bf96b073`). This is the pre-handoff
baseline. The handoff will move `main`; the receiver must resolve the new
current head instead of using this SHA as a branch target.

**BASELINE CI / PAGES STATE:** Build run
[`33211612595`](https://github.com/KlausUllrich/numberdroid/actions/runs/33211612595)
(#2210) passed on the baseline head. The change classifier and CI gate ran; the
product, Studio/browser, Windows, and Pages lanes were correctly skipped for
that documentation-only policy change. The last A1.6b2b product source run was
`33209352949` (#2203), followed by green post-merge run `33209824883` (#2204).
The receiver must verify the actual latest Actions state before changing code.

**PRIMARY RECEIVING ROLE:** Coordinator / Numberdroid Studio UI/UX engineering

**SECONDARY / TRIGGER ROLES:** Engineer/Runtime Developer and QA/Integrator are
required for visible implementation; Accessibility is required for every
visible state; Security/Authority and Compatibility/MCP become mandatory if
the UI needs a new projection, route, command, or discovery change;
Persistence/Recovery becomes mandatory if state or schema changes; Technical
Artist becomes mandatory for a new pixel operation; Game/Level Design becomes
mandatory if asset placement or gameplay meaning changes; Klaus owns live
visual acceptance and all owner-only decisions.

**NEXT MILESTONE / TASK:** A1.7 — first freeze low-fidelity Artist
review/correction workflow states from actual current commands and projections,
then implement one bounded visual candidate with real-browser evidence. The
ordinary authorized image-to-semantic-asset path must end at **Waiting for your
review**. It must not acquire owner review, task merge, finalization,
materialization, publication, or release authority.

## Freshness and authority

This file is a session-transition snapshot, not a competing current contract.
Current code and binding documents win. Verify `main`, Actions, open PRs, and
the listed current authorities; report a real conflict rather than forcing new
work back to this snapshot.

The earlier
`HANDOFF_2026-08-28_NUMBERDROID_STUDIO_AUTONOMOUS_A1_EXECUTION.md` remains
useful history but its A1.3 next step and baseline are superseded by the
integrated A1.3–A1.6b2b sequence and this handoff.

### Discarded local A1.4 draft

A stale, uncommitted pre-review A1.4 draft in the old `main` worktree was
explicitly discarded on 2026-08-29. Both local worktrees were clean afterward.
This cleanup did **not** revert the reviewed and evolved A1.4 implementation on
current `main`; A1.5–A1.6b2b depend on that integrated contract. Do not recreate
or recover the discarded draft, and do not interpret “discard A1.4” as
authorization to revert the current A1 chain.

## Product outcome and authority boundary

Numberdroid Studio is a local-first, agent-first production system. The visual
UI and MCP are equal clients of one semantic application core:

```text
authorized immutable image input
→ reproducible processing result
→ branch-local semantic DRAFT asset
→ Waiting for your review
```

For A1.7 the UI is the human visual control, review, correction, conflict, and
decision surface. Agents use versioned semantic commands; they do not automate
UI gestures. The candidate must show what happened, what exact visual result is
being proposed, why it is or is not ready, who acts next, and the consequence
of the next action.

A1.7 is not authority expansion. In particular:

- agent adoption remains branch-local and DRAFT-only;
- opening a preview does not approve anything;
- an agent cannot owner-review, merge, finalize, materialize, publish, or
  release;
- a browser field, URL, DOM value, or visual selection is not MCP authority;
- raw HostBinding credentials, grants, or other secrets never enter browser
  responses, storage, logs, URLs, clipboard setup, or resources;
- the accepted legacy MCP surfaces remain unchanged unless a separately
  classified and reviewed compatibility block explicitly changes them.

## Required reading order

Read every item in this block completely before changing product code.

### 1. Universal bootstrap

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`
7. `docs/agents/HANDOFF_PROTOCOL.md`

Use the Coordinator/cross-domain route plus Engineer and QA/Integrator. The
repository has no separate binding UI-role bundle, so use the exact Studio UI
contracts and visible-workflow triggers below.

### 2. Current Studio product and authority contracts

1. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
2. `tools/numberdroid-studio/README.md`
3. `tools/numberdroid-studio/docs/VISION.md`
4. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
5. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
6. `tools/numberdroid-studio/docs/MCP_CONTRACT.md`
7. `tools/numberdroid-studio/docs/ROADMAP.md`
8. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`

### 3. Protected visible-workflow contracts

Read these before proposing A1.7 states or layout:

1. `tools/numberdroid-studio/docs/CHECKPOINT_1A_BASELINE.md`
2. `tools/numberdroid-studio/docs/CHECKPOINT_1B_STATUS.md`
3. `tools/numberdroid-studio/docs/CHECKPOINT_2A_STATUS.md`
4. `tools/numberdroid-studio/docs/CHECKPOINT_2B_STATUS.md`
5. `tools/numberdroid-studio/docs/CHECKPOINT_2C_STATUS.md`
6. `tools/numberdroid-studio/docs/CHECKPOINT_3_STATUS.md`
7. `tools/numberdroid-studio/docs/CHECKPOINT_4_STATUS.md`
8. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_CONTRACT.md`
9. `tools/numberdroid-studio/docs/CHECKPOINT_4_5_STATUS.md`

Checkpoint 4.5 is implemented and browser-verified, but it is not
user-accepted. Its persistent editor supersedes the rejected six-page canvas
wizard: preserve the stable canvas and contextual docks; do not resurrect the
wizard as the A1.7 flow.

### 4. Current A1 contracts and status records

Read in sequence:

1. `tools/numberdroid-studio/docs/A1_0_STATUS.md`
2. `tools/numberdroid-studio/docs/A1_1_STATUS.md`
3. `tools/numberdroid-studio/docs/A1_2_STATUS.md`
4. `tools/numberdroid-studio/docs/A1_3_STATUS.md`
5. `tools/numberdroid-studio/docs/A1_4_STATUS.md`
6. `tools/numberdroid-studio/docs/A1_5_STATUS.md`
7. `tools/numberdroid-studio/docs/A1_6A_STATUS.md`
8. `tools/numberdroid-studio/docs/A1_6B1_STATUS.md`
9. `tools/numberdroid-studio/docs/A1_6B2A_STATUS.md`
10. `tools/numberdroid-studio/docs/A1_6B2B_STATUS.md`

### 5. Actual current implementation and tests

Inspect, do not infer from status prose:

- `tools/numberdroid-studio/packages/domain/src/processing-recipe.js`
- `tools/numberdroid-studio/packages/domain/src/processing-result.js`
- `tools/numberdroid-studio/packages/domain/src/processing-adoption-preflight.js`
- `tools/numberdroid-studio/packages/domain/src/processing-result-adoption.js`
- `tools/numberdroid-studio/packages/domain/src/processing-result-adoption-commit.js`
- `tools/numberdroid-studio/packages/domain/src/authoring-v2-registry.js`
- matching files under
  `tools/numberdroid-studio/packages/application/src/`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-processing-result-adoption-store.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-authoring-v2-admission-reader.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/0013_processing_result_adoptions.sql`
- `tools/numberdroid-studio/packages/mcp-server/src/authoring-v2.js`
- `tools/numberdroid-studio/apps/studio-server/src/server.js`
- `tools/numberdroid-studio/apps/studio-server/src/http-projections.js`
- `tools/numberdroid-studio/apps/studio-server/public/index.html`
- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- processing-adoption, Authoring-v2, HTTP, UI, and evidence tests under
  `tools/numberdroid-studio/tests/`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`
- `tools/numberdroid-studio/scripts/assert-studio-live-visual-state.js`
- the relevant checkpoint evidence preparation/assertion scripts

Read this handoff last, after current contracts and actual code.

### Not mandatory initially

Do not initially load the full story/campaign corpus, all art recipes, runtime
gameplay, every LevelSpec/compiler file, Godot/Unreal, remote/mobile operations,
or unrelated historical handoffs. Add them only on these triggers:

- **new pixel operation or visual-quality rule:** Technical Artist, the selected
  production method, recipe, validation rules, and binary transport rules;
- **asset placement/collision/navigation/gameplay meaning:** Game/Level Design,
  current art semantics, LevelSpec, and exact runtime consumers;
- **new aggregate, migration, retention, backup, or recovery behavior:**
  Persistence/Recovery and Security;
- **new HTTP/MCP resource/tool/profile/discovery count:** Security/Authority and
  Compatibility/MCP, with a separately versioned fail-closed surface;
- **canonical narrative content:** Story/Narrative before authoring that content;
- **candidate/compiler/materialization mapping:** Numberdroid Runtime Engineering
  and exact LevelSpec/compiler contracts.

## State at handoff

### Accepted / frozen

- Checkpoints 1–4 are explicitly user-accepted. Preserve the one-writer
  SQLite/CAS model, immutable revisions/activity, scoped grants, isolated task
  branches, owner review, semantic conflicts, atomic merge, and compensating
  revert.
- The accepted Header/agent-access shell, responsive information hierarchy,
  exact preview/fallback behavior, source intake/cutter, Asset Library,
  room/canvas, task review/conflict language, and CP2C/3/4 authority boundaries
  are protected regression inputs.
- A1.0 `ProcessingRecipe` v1, A1.1 `ProcessingResult` v1, and A1.2
  `AssetInputSelection` v1 are explicitly user-accepted. Their exact immutable
  PNG lineage must not be weakened or silently reinterpreted.
- The accepted legacy MCP surfaces remain exactly 19 tools/four templates
  normally and 30 tools/five templates with a matching task binding.
- Owner review, task merge, recovered-workspace activation, repository/engine
  materialization, publication, and release remain human-exclusive.

### Implemented but not accepted

- Checkpoint 4.5: list-first tasks, focused task creation, useful exact prop
  preview, persistent canvas/toolbox/options/dock room editor, and normalized
  `VOID`/`BLOCKED` semantics. Its live Klaus gate remains open.
- A0.1–A0.4 and the Checkpoint 5 foundation remain implemented candidates, not
  accepted product contracts.
- A1.3–A1.6b2b implement the project-bound preflight, strict branch-local plan,
  ledger-first atomic SQLite/CAS adoption, Authoring-v2 admission/session, and
  explicit private MCP transport. They remain non-visual, non-accepted
  candidates.
- A1.6b2b has green focused, full-Studio, syntax, evidence, Windows, and browser
  evidence from its source and post-merge runs. This proves implementation and
  regression status, not A1.7 UI quality or user acceptance.

### Planned / not implemented

- A1.7 low-fidelity workflow/state contract and its one bounded visual
  review/correction candidate.
- A public human-facing read projection of processing-result adoption is not
  currently exposed by the Studio UI. The server composes the private adoption
  store and private Authoring-v2 routes, but the browser application contains no
  processing-adoption UI. Verify this against current code before designing.
- Additional required deterministic processing operations remain separate
  one-operation blocks. A1 is not complete merely because the current exact-PNG
  crop path and A1.7 candidate exist.
- Complete Artist/Level Designer MCP parity, A2 concurrent production, broad
  provider support, materialization, publication, and release remain later work.

### Open decisions and owners

1. **Exact A1.7 state inventory and information hierarchy — receiving UI/UX
   engineering role.** Derive it from current command outcomes, persisted facts,
   and trusted projections; do not invent lifecycle states for visual neatness.
2. **Correction gesture — receiving role proposes; Klaus ultimately accepts.**
   The candidate may explain a safe next step or start an already-authorized
   semantic retry/edit path. It must not invent a browser mutation that bypasses
   task/branch/grant/owner boundaries.
3. **Read projection boundary — Engineering/Security/Compatibility.** If the
   existing project snapshot cannot truthfully supply A1.7, split a minimal
   read-only projection block from the visual block. A new public route, schema,
   or projection is not a styling detail and must receive its own L3 review.
4. **Live visual/product acceptance — Klaus.** Browser screenshots and agents
   may find defects but cannot close this gate while Klaus is unavailable.
5. **Remaining processing-operation coverage — Product/Technical Art, later.**
   A1.7 must not conceal the remaining gap or bundle new pixel operations into
   the UI block.

## Binding UI philosophy for A1.7

Treat Studio as a professional visual production tool, not an admin console.

- Put the task, current state, next actor, decision, and consequence first.
- Use professional plain language. Keep branch, grant, revision, CAS,
  provenance, raw IDs, fingerprints, and rule codes under optional **Technical
  details** unless they are the actionable problem.
- Healthy provenance, integrity, validation, and authority should be quiet.
  Surface warnings only when something is missing, inconsistent, unsafe, stale,
  blocked, or waiting for a person.
- Preserve the hierarchy: summary → list → selected detail → contextual action
  → optional technical detail.
- Preserve a stable workspace and central visual canvas. Put **Purpose** and
  **Check** in contextual docks; do not replace the canvas with a page wizard.
- Exact previews use authorized pixels with contain/no crop/no stretch.
  Missing, processing, unsupported, and failed states are explicit and never
  blank.
- Passive refresh preserves DOM where possible, focus, selection, dirty drafts,
  scroll, canvas zoom/position, layers, disclosure state, and active pointer
  work. Conflicts are explicit; background polling must not steal the task.
- Every state and action works with keyboard navigation, visible focus,
  non-color cues, useful accessible names, and responsive layouts.
- Low-fidelity state maps precede polished mockups. A screenshot is evidence,
  not acceptance.

## Current technical anchors

- Studio currently exposes seven workspaces: Overview, Sources, Asset library,
  Rooms, Agent tasks, Levels, and Activity.
- A1.6b2b is selected only with
  `NUMBERDROID_STUDIO_MCP_PROFILE=authoring-v2`.
- Its private endpoints are:
  - `/internal/mcp/authoring-v2/handshake`
  - `/internal/mcp/authoring-v2/capabilities`
  - `/internal/mcp/authoring-v2/processing-result-adopt`
- Authoring-v2 fingerprint:
  `5488df72...`; legacy v1 fingerprint: `826a8b79...`. Resolve and retain the
  full current values from code/status files rather than copying abbreviated
  values into executable contracts.
- Discovery remains 19/four normally, 30/five for a matching legacy task, and
  31/six only under explicit Authoring-v2 opt-in. V2 adds only
  `studio_processing_result_adopt` and
  `studio://projects/{projectId}/capabilities`.
- SQLite schema is v13; portable bundle compatibility remains v1–v3; legacy
  command definitions/scopes remain 33/30.
- Current UI source is deliberately dependency-light static HTML/CSS/JS. Do not
  introduce a framework or broad shell rewrite for A1.7.
- Start the local UI with `npm run dev` from `tools/numberdroid-studio/` and open
  `http://127.0.0.1:4317`. The default workspace is
  `.numberdroid-studio/`; use a task-specific `NUMBERDROID_STUDIO_DATA` path for
  disposable evidence so the real workspace is never mutated by a test.
- The browser evidence harness uses real Chrome/Chromium at 1440×900 and
  1060×900 and records DOM/observation data. Extend the smallest relevant
  capture lane; do not regenerate unrelated evidence merely for reassurance.

## First bounded A1.7 block

### Promise

Freeze a low-fidelity, implementation-grounded state contract for one ordinary
authorized processing-result adoption journey, from available task/input
through exact proposed DRAFT visual and findings to **Waiting for your review**,
including unavailable, blocked, failed, replay/recovery, and correction-needed
outcomes that actually exist in current code.

### Inspection before proposal

1. Trace one successful dry-run/commit/replay and the decisive denials through
   Domain → Application → SQLite/Activity → Authoring-v2 → server composition.
2. Inventory which facts already reach the current project snapshot and UI.
3. Map each proposed human-facing state to an exact source fact and next actor.
4. Identify any missing read projection separately from presentation work.

### Deliverable

Add one current A1.7 contract/status document under
`tools/numberdroid-studio/docs/` with low-fidelity state maps, human copy,
source-of-truth mappings, progressive-disclosure fields, accessibility states,
authority exclusions, and acceptance criteria. Update `ROADMAP.md`,
`REQUIREMENTS.md`, and `VACATION_TEST_BACKLOG.md` only where the contract creates
a durable current fact.

This first block is D0 while it changes documentation only. If executable
examples, generated output, CI/configuration, fixtures, or product files enter
the diff, reclassify immediately.

### After the state contract

Implement one bounded A1.7 visual candidate in the existing workspace. Prefer
the smallest surface that preserves the accepted list/detail/canvas hierarchy.
Do not combine a shell redesign, new processing operation, new agent mutation,
MCP discovery expansion, schema migration, or materialization path.

If a new read projection is required, split and finish that coherent L3 block
first, then implement the UI against it. If the proposed correction action
requires a new semantic command or expands authority, stop that action at the
decision boundary and ship an honest read/review candidate instead of faking a
button.

## Verification and definition of done

### Documentation/state-contract block

Run only D0 checks unless a trigger escalates:

```bash
git diff --check
npm run repo:docs-check
npm run repo:docs-check-test
npm run repo:ci-classifier-test
```

Every command receives an explicit timeout. No product suite or browser capture
is required for a documentation-only diff.

The first block is done when:

- every visible state maps to an existing trusted fact or is explicitly marked
  as a missing projection;
- the successful journey ends at **Waiting for your review**;
- correction, failure, replay/recovery, and unavailable states do not imply
  extra authority;
- low-fi hierarchy, exact preview behavior, plain-language copy, technical
  disclosure, accessibility, responsive behavior, and passive-refresh
  requirements are testable;
- implementation scope and exclusions are narrow enough for one candidate PR;
- the document says **candidate — not user accepted**.

### Visible implementation block

Classify as L3 because it changes a protected visible workflow. Select exact
tests from the changed paths and current risk policy. At minimum expect:

- focused UI/server/projection tests for every new state and denial;
- full Numberdroid Studio tests once after code freeze;
- `npm run check` in `tools/numberdroid-studio`;
- real-browser evidence at 1440×900 and 1060×900, with screenshots and
  machine-readable observations inspected;
- keyboard/focus, non-color state, exact preview/fallback, narrow-layout, and
  passive-refresh preservation proof;
- Linux/Windows or other platform lanes only as selected by actual path/risk
  triggers and the classifier;
- one trigger-relevant independent actual-diff review after code freeze.

From `tools/numberdroid-studio/`, the expected bounded command sequence is:

```bash
timeout 120s node --test tests/a1-7-ui.node-test.js tests/http-server.node-test.js
timeout 300s npm test
timeout 60s npm run check
timeout 180s npm run evidence:verify
```

The first command names the dedicated UI contract test the implementation block
must add; adjust only if the frozen state contract establishes a clearer exact
name. Extend the existing capture harness with one dedicated `a1-7` mode and a
matching assertion before calling it. With a disposable fixture server already
running at `http://127.0.0.1:4317`, `$CHROME` resolved, and `$A17_EVIDENCE`
created, the exact two viewport captures are:

```bash
timeout 180s node scripts/capture-studio-browser-evidence.js "$CHROME" 1440 "$A17_EVIDENCE/a1-7-review-1440.png" "http://127.0.0.1:4317/#assets" a1-7 "$A17_EVIDENCE/a1-7-review-1440.dom.json"
timeout 180s node scripts/capture-studio-browser-evidence.js "$CHROME" 1060 "$A17_EVIDENCE/a1-7-review-1060.png" "http://127.0.0.1:4317/#assets" a1-7 "$A17_EVIDENCE/a1-7-review-1060.dom.json"
timeout 60s node scripts/assert-a1-7-visual-evidence.js "$A17_EVIDENCE"
```

The implementation may choose a different existing workspace only if the
low-fidelity contract proves that hierarchy is more truthful; update these
commands and the dedicated test together. Run the same commands in CI through
the existing Studio/browser lane rather than inventing a separate workflow.

Do not rerun unchanged broad green lanes for reassurance. Repair the first
decisive failure and rerun only affected lanes unless the fix changes another
risk axis.

The A1.7 candidate is done when the bounded flow is implemented, tests and
selected CI are green, browser evidence has been inspected, current docs and
the return backlog are updated, the PR is merged, remote tree/merge state is
verified, and the result remains labelled **implemented candidate — not user
accepted**. Klaus's live review remains open.

## Process learnings that remain binding

- Progress updates occur at intervals of at most 60 seconds during active
  commands, delegated work, or CI.
- Every command/test/build has a risk-scaled wall-clock timeout. Long work runs
  in a resumable session and is polled at most every 60 seconds.
- Delegated review defaults to a five-minute deadline; take over or rescope on
  expiry.
- Poll CI every 30–60 seconds with a default overall 20-minute bound, then
  inspect heartbeat/logs and decide explicitly whether it is running or stalled.
- Lock one coherent block's promise, exclusions, risk tier, and finish condition
  within about two minutes; checkpoint after ten minutes of active local work if
  it is not merge-ready.
- Use the smallest falsifying test first, one actual-diff review after freeze,
  and one source PR per coherent block unless immutable post-merge evidence
  truly requires a separate record.
- A timeout is not pass/fail evidence. Preserve partial output and classify the
  responsible layer before retrying.
- SQLite/server/browser fixtures must close workers, sockets, database writers,
  and other handles before removing temporary directories. The A1.6b2b Windows
  `EBUSY` failure was fixed by closing the session before cleanup; retain that
  order.
- CI green, merged, source-integrated, browser-verified, live-tested,
  user-accepted, materialized, published, and released are different facts.

## Cross-role transition

UI/UX engineering is now primary because A1.3–A1.6b2b already supply the
non-visual semantic and transport candidate, while A1.7 must make its result
understandable and reviewable by a person. Domain/Application/Persistence and
Security already resolved the current branch-local DRAFT adoption, ledger,
idempotency, recovery, binding, and compatibility boundaries; the receiving
role consumes those facts and must not redesign them through presentation.

Bring Engineering/Security/Compatibility back in before adding a read route or
surface. Bring Technical Art back only for a new processor or pixel-quality
choice. Bring Game/Level Design back before changing semantic placement or
gameplay meaning. Klaus remains the owner of visual acceptance, review/merge,
finalization, materialization, publication, and release decisions.

## Final receiver launch protocol

1. Resolve and verify current `main`, latest Actions, open PRs, and clean working
   state; confirm this handoff's merge is present.
2. Read the universal bootstrap, task bundle, actual source/tests, and this
   handoff in the order above.
3. Trace the current adoption flow and UI projection; do not trust copied counts
   or prose if current code differs.
4. Summarize the current product, acceptance, authority, compatibility, and UI
   state; report only genuine conflicts with newer current authority.
5. Lock the D0 low-fidelity state-contract block with its promise, exclusions,
   tests, and finish condition, then implement it directly if no real boundary
   remains.
6. Review, verify, document, create a focused PR, observe tier-selected CI with
   bounded polling, merge only when green, and verify the remote merge/tree.
7. Continue with the separately classified bounded UI candidate. Do not cross a
   new command/authority/schema/design gate silently, and do not claim Klaus's
   deferred live acceptance.
