# Numberdroid Studio — Room Editor Preview Handoff

DATE: 2026-09-01
REPOSITORY: `KlausUllrich/numberdroid`
STATUS: **Room Editor live findings recorded; functional repairs and zoom/pan integrated; direct manipulation, action visibility and engine-neutral Studio Preview authorized next**
BASELINE MAIN HEAD AT CREATION: `d33afa61a8c66a9245401efb0f677c426ed3b086`, tree `42d9f61ae396eb4bd1961dfbb705d68e1bacc4eb` (pre-handoff-document baseline; receiver must re-resolve current `main`)
BASELINE CI / PAGES STATE: PR #192 exact head `326c9509322a69e5f6f4717e1b3118a764a2ebbf`, Build #2303 / run `33495245029`, green; merge `d33afa61a8c66a9245401efb0f677c426ed3b086`; post-merge Build #2304 / run `33496734765`, green
PRIMARY RECEIVING ROLE: Engineer / Runtime Developer
SECONDARY / TRIGGER ROLES: QA / Integrator / Release; Coordinator / cross-domain; Product/Designer for live usability; Numberdroid adapter/compiler reviewer only when engine-specific preview or A4c resumes
NEXT MILESTONE / TASK: complete the bounded Room Editor usability continuation, then resume the private A4c Level Candidate path

## 1. Universal bootstrap and required reading

The receiver MUST first verify remote `main`, its tree, open PRs/branches and
current Actions through the GitHub connector. Remote GitHub reads and writes use
the connector only.

Read `AGENTS.md` completely and execute its Universal Bootstrap. Then read the
universal sequence completely:

1. `REPOSITORY_STRUCTURE.md`
2. `docs/agents/ROLE_ENTRYPOINTS.md`
3. `docs/agents/REPOSITORY_WORKFLOW.md`
4. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
5. `docs/README.md`

Use these role routes:

- Engineer / Runtime Developer for implementation;
- QA / Integrator / Release for actual-diff verification and integration;
- Coordinator / cross-domain for sequencing.

Then read completely:

1. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
2. `docs/architecture/ARCHITECTURE.md`
3. `tools/numberdroid-studio/README.md`
4. `tools/numberdroid-studio/docs/VISION.md`
5. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
6. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
7. `tools/numberdroid-studio/docs/ROADMAP.md`
8. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
9. `tools/numberdroid-studio/docs/LIVE_VERIFICATION_2026_09_01.md`
10. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
11. this handoff, last.

A4a/A4b/A4c authority documents are not mandatory for the first UI-only Room
Editor slice. They become mandatory before any Candidate, compiler,
EngineBridge, child-task or task-authority change. O1/O2 operational documents
are not mandatory unless backup, remote, service, pairing or MCP scope changes.

## 2. Verified repository state at handoff creation

- PR #188 integrated the future harness architecture discussion.
- PR #189 recorded VT-012 acceptance.
- PR #190 integrated the 2026-09-01 live-verification documentation.
- PR #191 integrated Surface-under-Prop click-through, corrected rotated prop
  preview geometry and responsive Room intent layout.
- PR #191 post-merge Build #2302 / run `33491619241` is green.
- PR #192 integrated 100–1000% zoom, Fit, scaled canvas text and middle-mouse
  panning as merge `d33afa61a8c66a9245401efb0f677c426ed3b086`.
- PR #192 exact-head Build #2303 / run `33495245029` is green. Its independent
  final review was GO after earlier review blockers for retained stale canvas,
  false Fit math and missing pointer-capture cleanup were repaired.
- PR #192 post-merge Build #2304 / run `33496734765` is green on merge
  `d33afa61a8c66a9245401efb0f677c426ed3b086`.

## 3. Accepted / frozen

- VT-000 Studio baseline passed.
- VT-012 O1b Backups UI and its bounded Create, Verify, Recovery-test and
  Restore-as-copy safety boundary were accepted by Klaus on 2026-09-01.
- The accepted Checkpoints 1–4 contracts and their authority boundaries remain
  frozen unless a concrete defect requires a scoped repair.
- Human owner review remains the acceptance authority. CI, screenshots,
  compiler output and source integration never imply product acceptance.
- Product `main` is not modified by Studio authoring candidates.

## 4. Implemented but not user accepted

- CP4.5 / VT-001 remains REVISE after the 2026-09-01 live walkthrough.
- A1.7 / VT-011 remains REVISE; the correction loop works but is unclear
  without an agent harness.
- PR #191 Room Editor repairs are implemented but require later live regression.
- PR #192 zoom/pan is implemented but requires later Klaus live regression.
- A4a/A4b and the A4c Domain foundation are source-integrated; the complete
  task-scoped A4c Application candidate path is not complete or accepted.

## 5. Planned / not implemented

Implement as separate bounded L3 slices:

1. **Placement ghost and direct manipulation**
   - show exact rotated footprint before placement;
   - distinguish valid/invalid without color alone;
   - select, move, rotate and delete placements directly on the canvas;
   - middle-mouse remains camera pan;
   - commit at most one existing semantic command on pointer release;
   - retain inspector/keyboard parity;
   - never persist pixels or infer authority from DOM gestures.
2. **Action and error visibility**
   - task overview exposes conflict/action-required state;
   - Waiting for your review is visually distinct (amber/yellow) from completed;
   - saved rooms with persisted ERROR findings show that state prominently;
   - finding selection preserves the findings/dock scroll position;
   - improve plain-language remediation and readable text;
   - Auto-fix remains low priority.
3. **Engine-neutral Studio Preview**
   - read-only exact room/project revision projection;
   - first renderer is top-down and positionally faithful;
   - ordered Surfaces below transparent Props;
   - exact asset versions, position, rotation, anchor, connectors and optional
     validation overlay;
   - clearly labelled approximate; no runtime-fidelity claim;
   - no Numberdroid runtime or validate-only EngineBridge invocation;
   - no authoring mutation, acceptance, materialization or publication effect.
4. **Later 2.5D renderer — planned, not current completion gate**
   - consume the same engine-neutral preview scene;
   - logical footprint is separate from ground anchor, visual bounds/offset,
     elevation and overhang;
   - side-facing/billboard sprites may extend across cells they do not occupy;
   - transparency reveals lower layers;
   - deterministic layer plus ground-anchor depth ordering;
   - optional bounded background/body/foreground segments for complex
     occlusion;
   - presentation metadata never changes collision, navigation, triggers or
     gameplay authority.
5. Resume A4c only after the bounded Room Editor sequence and its post-merge
   gates are complete or explicitly resequenced by Klaus.

## 5A. Open decisions and owners

- The portable preview, top-down-first order, footprint/visual-bounds split and
  later optional 2.5D projection are decided by Klaus and are not open.
- Klaus owns later live acceptance of PR #191/#192 and the future priority and
  visual style of the 2.5D renderer.
- Engineer owns the bounded engine-neutral scene-model/API design within the
  frozen semantic and authority boundaries.
- Engine-specific preview adapters require separate authorization and their
  project adapter/compiler reviewer.
- Deferred Klaus live acceptance does **not** block integration of the remaining
  Room Editor source slices or later A4c source work. Those items must remain
  truthfully REVISE/implemented-not-accepted until Klaus tests them.

## 6. Binding preview decision

The ordinary Preview button is **Studio Preview**, not Numberdroid Preview.
Numberdroid is the first customer but Studio must remain useful across engines.

The durable flow is:

`immutable room revision -> engine-neutral preview scene -> top-down renderer / later 2.5D renderer`

An optional higher-fidelity Numberdroid, Godot or Unreal preview may be added
later through an explicit adapter. The existing validate-only EngineBridge
cannot render and must not be widened for generic preview.

For every asset keep these concepts independent:

- logical footprint: occupancy/collision/navigation authority;
- ground anchor: floor contact and primary depth-sort coordinate;
- visual bounds and offset: pixels that may overhang other cells;
- elevation / preview height: presentation only;
- projection/facing/occlusion hints: presentation only;
- optional visual segments: rare overlap repair, never semantic occupancy.

## 7. Current implementation paths

Primary UI and browser state:

- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/tests/checkpoint-3-ui.node-test.js`
- `tools/numberdroid-studio/tests/checkpoint-4-5-ui.node-test.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`

Existing semantic placement paths to reuse:

- HTTP routes in
  `tools/numberdroid-studio/apps/studio-server/src/server.js`
- application commands in
  `tools/numberdroid-studio/packages/application/src/studio-service.js`
- room invariants in
  `tools/numberdroid-studio/packages/domain/src/room-definition.js`

Existing commands are placements-add, placements-move and placements-remove.
Do not add pixel-coordinate commands. Every mutation must retain project
revision, exact room-version head, exact asset/version identity, CSRF/human
owner context, stable idempotency and fail-closed stale-head behavior.

Preview architecture belongs in the reusable preview boundary, not the
Numberdroid adapter. Keep package-boundary tests explicit.

Live preview URL: `http://127.0.0.1:4317`

Exact initial commands from `tools/numberdroid-studio/`:

```bash
timeout 60s node --check apps/studio-server/public/app.js
timeout 120s node --test tests/checkpoint-3-ui.node-test.js tests/checkpoint-4-5-ui.node-test.js
timeout 300s npm run build
timeout 900s npm test
# Manual smoke server: it is expected to keep running; timeout 124 is not a product failure.
timeout 120s npm run dev
```

Documentation gates from the repository root:

```bash
timeout 120s npm run repo:docs-check
timeout 120s npm run repo:docs-check-test
```

## 8. Verification and integration requirements

Every command/test has an explicit timeout. During long work provide heartbeat
within 120 seconds. Poll CI every 30–60 seconds for at most 20 minutes and
diagnose after two unchanged polls.

For every L3 slice:

1. verify exact current `main`;
2. inspect the actual diff and triggered risk lanes;
3. run focused UI/application tests and syntax/build;
4. run real-browser evidence at protected 1440×900 and 1060×900 layouts;
5. retain Windows CI;
6. use independent actual-diff reviews, including interaction/security where
   relevant;
7. re-check unchanged PR head immediately before merge;
8. merge only when exact-head required CI and reviews are green;
9. observe post-merge CI before dependent work;
10. update status/roadmap/plan truthfully.

For direct manipulation prove: rotated ghost, invalid bounds/VOID/BLOCKED/
overlap, one mutation on release, Escape/cancel, keyboard parity, stale
revision, passive refresh, selection/scroll retention and no authority widening.

For Studio Preview prove: exact pinned revision, deterministic replay,
transparency/layer order, logical-footprint versus visual-overhang independence,
no project revision or room-version mutation, no task/review/acceptance change,
and truthful approximate labelling.

## 9. Authority and exclusions

Do not add or activate:

- Remote backup metadata or operations;
- Remote MCP, pairing, HostBinding or browser-agent authority;
- public/Funnel exposure;
- deletion, retention/cleanup or restore activation;
- automatic review acceptance;
- O3, O4, A5 or A6;
- Candidate-created repository commits, production materialization,
  publication or release;
- repository write/merge authority in the product;
- EngineBridge rendering or generic preview authority.

Child tasks remain a later separate A4c L3 slice and must not be mixed into
Room Editor or Level Candidate PRs.

## 9A. Cross-role handoff

Engineer / Runtime Developer is primary because Product/Designer has already
resolved the preview purpose and projection boundary; the next work is bounded
interaction, presentation-model and verification implementation. QA /
Integrator / Release independently reviews the actual diff and owns gate
classification and integration evidence. Coordinator / cross-domain keeps the
Room Editor slices separate from A4c and child-task authority.

Bring Product/Designer back for later live acceptance and before choosing a
concrete 2.5D visual style. Bring the Numberdroid adapter/compiler reviewer back
only if an engine-specific preview is proposed or when A4c resumes. Bring
Security/Authority review back for any new command, transport, persistence or
task scope; the generic read-only preview should add none.

## 9B. Reusable process learning

- Source integration, CI and screenshots are evidence, never user acceptance.
- Source-pattern tests can pass while a visual feature remains broken. PR #192's
  first review caught retained stale Canvas DOM, false Fit math and incomplete
  pointer cleanup. Require behavioral browser evidence and actual-diff review.
- Do not couple the portable authoring preview to the first customer's runtime.
- Do not infer occupancy from visible pixels. Logical footprint and visual
  bounds/overhang are separate in top-down and 2.5D views.
- Pixel gestures are presentation input. Persist exact semantic coordinates and
  submit one idempotent command on pointer release.

## 10. First receiver actions

1. Verify current remote `main`, tree, PRs, A4c branches and Actions.
2. Confirm PR #192 post-merge CI.
3. Execute the Universal Bootstrap and required reading above.
4. Inspect the exact current Room Editor source and combined diff.
5. Summarize the preview/authority decision and report any conflict.
6. Implement the first bounded remaining slice: Placement ghost and direct
   manipulation.
7. Do not wait for VT-013 or unrelated live gates.
8. After all bounded Room Editor slices are integrated and post-merge green,
   update durable docs; then resume A4c only under its complete binding bundle.

## 11. Definition of done for this handoff's milestone

The Room Editor source continuation is complete when:

- PR #191 and #192 remain implemented-not-accepted until later Klaus QA; that
  deferred live gate does not block source integration or A4c;
- zoom 100–1000%, Fit and middle-pan work;
- placement ghost and direct canvas manipulation work through existing semantic
  commands;
- task conflicts/action-required states and persisted room errors are visible
  before opening deep detail;
- a read-only engine-neutral top-down Studio Preview accurately preserves
  positions, rotations, layers, transparency, logical footprints and visual
  overhang while clearly remaining approximate;
- all exact-diff local/CI/browser/Windows gates and independent reviews are
  green;
- post-merge CI is observed after each dependent slice;
- no authority or product boundary above is crossed;
- roadmap, plan, status/backlog and a later completion handoff tell the truth.

The 2.5D renderer itself is not required for this milestone; its scene-model
compatibility and footprint/visual-bounds separation are required.

## 12. Final receiver instruction

Verify `main` and Actions; execute the Universal Bootstrap; read the listed
role/task bundle; inspect actual current source; summarize your understanding
and identify any authority conflict. The remaining Room Editor slices are
already authorized for direct bounded implementation after those checks.
Use independent reviewers and integrate only exact unchanged heads with all
triggered gates green. Never infer user acceptance from automation.
