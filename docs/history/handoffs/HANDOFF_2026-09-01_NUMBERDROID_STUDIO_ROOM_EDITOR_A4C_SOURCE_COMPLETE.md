# Numberdroid Studio — Room Editor and A4c source-complete handoff

DATE: 2026-09-01
REPOSITORY: `KlausUllrich/numberdroid`
STATUS: **Room Editor L3 and the complete authorized A4c Candidate/derived-child source sequence integrated and green; neither gate user accepted; no further A-track source slice authorized**
BASELINE MAIN HEAD AT CREATION: `122a2533a12abe5e51e6458fa80f2047825240b4`, tree `c14f39c687214434ab7b8850dfc4411bf2fe1a60` (pre-handoff-document baseline; receiver must re-resolve current `main`)
BASELINE CI / PAGES STATE: PR #199 exact head `6f7c6bfee89fec2e22200fe66002b3d3c73fb968`, Build #2347 / run `33562709548`, green including actual Linux/browser, Windows, root and final gates; merge `122a2533a12abe5e51e6458fa80f2047825240b4`; post-merge Build #2348 / run `33563416584`, failed-only rerun attempt 2 green for Windows, Checkpoint 1A and the final gate; Pages had already passed attempt 1; attempt 1 hit the exact Windows ten-minute job limit and is not hidden
PRIMARY RECEIVING ROLE: QA / Integrator / Release for the consolidated Klaus review/live gates and truthful integration state
SECONDARY / TRIGGER ROLES: Coordinator / cross-domain for sequence and new-scope decisions; Product / Designer for VT-001 and VT-014; Engineer / Runtime Developer only for an accepted defect or separately authorized source slice; Security/Authority and Persistence/Idempotency for any A4c revision
NEXT MILESTONE / TASK: obtain or prepare Klaus decisions for Room Editor VT-001 and A4c VT-014, or wait for a new explicit scope decision; do not infer A5 authority

## 1. Universal bootstrap and required reading

The receiver MUST first verify remote `main`, its tree, open PRs, relevant Room
Editor/A4c branches and current Actions through the GitHub connector. Remote
GitHub reads and writes use the connector only.

Read `AGENTS.md` completely and execute its Universal Bootstrap. Then read the
universal sequence completely:

1. `REPOSITORY_STRUCTURE.md`
2. `docs/agents/ROLE_ENTRYPOINTS.md`
3. `docs/agents/REPOSITORY_WORKFLOW.md`
4. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
5. `docs/README.md`

Use QA / Integrator / Release as the primary route for current verification,
Klaus-gate preparation and integration truth. Use Coordinator / cross-domain
before sequencing any new work. Engineer / Runtime Developer becomes the author
route only after a named defect or new bounded implementation scope exists.

Then read completely, in this order:

1. `docs/agents/HANDOFF_PROTOCOL.md`
2. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
3. `docs/architecture/ARCHITECTURE.md`
4. `tools/numberdroid-studio/README.md`
5. `tools/numberdroid-studio/docs/VISION.md`
6. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
7. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
8. `tools/numberdroid-studio/docs/ROADMAP.md`
9. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
10. `tools/numberdroid-studio/docs/LIVE_VERIFICATION_2026_09_01.md`
11. `tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md`
12. `tools/numberdroid-studio/docs/A3A_LEVEL_LOGIC_KERNEL_STATUS.md`
13. `tools/numberdroid-studio/docs/A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md`
14. `tools/numberdroid-studio/docs/A4B_REFERENCE_BEHAVIOR_STATUS.md`
15. `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md`
16. `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md`
17. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
18. this handoff, last.

If VT-001 is the immediate session, also read the full CP4.5 contract/status and
the Room Editor source/test paths listed in section 6 below. If VT-014 is immediate,
follow every binding A3a/A4a/A4b/A4c and Checkpoint 5 reference required by the
A4c authority/status documents. Operational O1/O2 documents become mandatory
only for an explicitly authorized O2 deployment/review task. O3/O4/A5/A6,
product materialization, repository publication and release are excluded, not
implicit next reading or work.

## 2. Verified repository state at creation

- Connector-resolved `main` after PR #199 is
  `122a2533a12abe5e51e6458fa80f2047825240b4`, tree
  `c14f39c687214434ab7b8850dfc4411bf2fe1a60`.
- The complete Room Editor ledger for PRs #191–#196 is pinned in
  `ROOM_EDITOR_L3_STATUS.md`. All exact-head and post-merge runs there are
  green. PR #191 and #192 remain explicitly live-unaccepted.
- PR #197 integrated only the prior Room completion documents; it did not
  accept Room Editor behavior or grant A4c authority.
- PR #198 immutable Candidate: exact head
  `6ea743ff5570677c24a58fae2c5cad210af19d3d`, tree
  `ea989ef04d7fe83f05606c039b818648705b62ce`, Build #2344 / run
  `33553937139`, merge `053f9c407f5ecd7c93c1775249aa0630c88b6460`,
  post-merge Build #2345 / run `33554781224`, failed-only rerun green.
- PR #199 derived child: exact final head
  `6f7c6bfee89fec2e22200fe66002b3d3c73fb968`, tree
  `c14f39c687214434ab7b8850dfc4411bf2fe1a60`, Build #2347 / run
  `33562709548`, merge
  `122a2533a12abe5e51e6458fa80f2047825240b4`, post-merge Build #2348 /
  run `33563416584` attempt 2 green.
- Build #2346 / run `33561494607` belongs to the superseded initial PR #199
  head. Its real browser failure exposed an irrelevant processing-adoption
  request on a derived child; the final head fixed and retested that behavior.
- No open PR remained after PR #199 merged at the last connector check. The
  receiver must re-query this and all branch/run state rather than assuming it.

## 3. Accepted / frozen

- VT-000 remains the protected `AUTOMATED GREEN` baseline; Checkpoints 1–4
  remain accepted foundations.
- VT-012 O1b Backups UI remains user accepted as recorded on 2026-09-01.
- A1.0–A1.2 remain the accepted image-path contract; later A1 candidates do not
  inherit acceptance from integration.
- Klaus's explicit disposition remains the product-acceptance authority. The
  A4c slice exposes no owner review-decision operation. CI,
  screenshots, compiler output, independent review, PR merge and source
  integration never imply acceptance.
- Product `main` remains untouched by Studio Candidates. A4c owns no review
  decision, merge, destination, materialization, repository publication or
  release transition.

## 4. Implemented but not accepted

- CP4.5 / VT-001 remains **REVISE**. PR #191 and #192 are implemented and green
  but still require Klaus's deferred live regression. PRs #194–#196 complete
  placement interaction, attention/errors/findings and exact read-only Studio
  Preview in source; those behaviors also await explicit live acceptance.
- VT-011 remains **REVISE**. No browser evidence proves that a real agent
  received or acted on feedback.
- A3a, A4a and A4b are source-integrated and automated green, not user accepted.
- A4c's Domain foundation, immutable Candidate Application and restricted
  derived child are source-integrated and green, not user accepted. VT-014 is
  `NEEDS KLAUS REVIEW`.
- O2a is source-integrated but undeployed and remains VT-013 `NEEDS KLAUS LIVE`.

## 5. Planned / not implemented or not authorized

- The 2.5D/isometric or dimetric renderer over the portable Room Preview scene
  remains planned. It is not a Room L3 completion gate and has no current source
  authorization.
- A5 and A6 are not authorized by A4c completion. A5's small portability proof
  requires its own explicit gate; no one should begin it from this handoff.
- No Candidate materialization, owner decision, merge, `main` append,
  filesystem/repository write, publication or release path is implemented or
  authorized.
- No A4c create/derive HTTP or MCP surface, agent browser authority, Remote
  backup, Pairing, HostBinding, public/Funnel, O3 or O4 extension is authorized.
- Cross-actor delegation, deeper child chains, wider/replenished budgets,
  renewal and auto-accept remain outside the child contract.

## 6. Technical result and fixed boundaries

### Room Editor and ordinary Studio Preview

The Room Editor owns placement ghosts and direct select/move/rotate/delete via
existing semantic commands, overview attention and persisted errors, stable
findings navigation, and a read-only top-down projection of the exact current
saved Project and Room heads.

Logical footprint alone controls occupancy, collision and navigation. Ground
anchor controls floor contact and primary depth. Visual bounds/offset,
elevation, overhang, transparency and optional background/body/foreground
segments are presentation metadata. They may overlap logical cells without
occupying them and never change gameplay authority. The portable scene is
projection-neutral and prepared for a later renderer.

Ordinary Studio Preview is approximate and engine-neutral. It does not invoke
Numberdroid or EngineBridge. EngineBridge remains validate-only.

Principal Room Preview implementation/evidence paths:

- `tools/numberdroid-studio/packages/preview/src/room-preview-scene.js`
- `tools/numberdroid-studio/apps/studio-server/public/room-preview-state.js`
- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/tests/room-preview-scene.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-state.portable.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-source-application.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-http-security.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-ui.node-test.js`
- `tools/numberdroid-studio/scripts/prepare-checkpoint-4-5-visual-evidence.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`

### A4c immutable Candidate

The private `level.candidate.create` closure composes the real A4b LevelSpec,
A4a projection, A3a validation, Numberdroid adapter/compiler and configured
validate-only EngineBridge. It binds exact Project, Task, Grant, actor, branch
base/current head, profile/compiler pins, immutable source/output bytes and
hashes, preview, semantic/output diff, receipt and submission.

Atomic submit stops at task/effective `IN_REVIEW`, review `OPEN`, all items
`PENDING`, `REVIEW_SUBMITTED` and **Waiting for your review**. It is durable,
idempotent, lost-response-safe and leaves Project `main` unchanged. Persistence
is schema v14:
`tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/0014_level_candidate_submissions.sql`.

### A4c restricted child

The private trusted service derives at most one depth-one child from the exact
active human-rooted parent task/grant. Actor and Project are fixed; the child
origin is the exact parent branch head on a non-main branch; capability/object
scope only narrows; all four budget dimensions are reserved atomically; expiry
cannot exceed the parent; auto-accept is off; ancestor checks gate every child
operation. Parent review/pause blocks, and terminal/revoked/expired ancestry
denies execution.

Persistence is schema v15:
`tools/numberdroid-studio/packages/persistence/src/sqlite/migrations/0015_derived_candidate_child_tasks.sql`,
checksum
`12657571e580597ed6ab03459c3e1241c0c94642e32d0e86bef087e232998154`.
All fault points roll back without partial Task, branch, Grant or reservation.

The task UI is read-only for Candidate/child authority. A derived child never
loads unrelated processing-result adoption data, exposes no derive/create/
decision/merge controls, and presents lineage, reservation and ancestor block
truthfully.

Principal A4c paths:

- `tools/numberdroid-studio/packages/domain/src/level-candidate-authority.js`
- `tools/numberdroid-studio/packages/domain/src/derived-child-task.js`
- `tools/numberdroid-studio/packages/application/src/level-candidate-application.js`
- `tools/numberdroid-studio/packages/application/src/derived-child-task-service.js`
- `tools/numberdroid-studio/packages/numberdroid-adapter/src/a4c-level-candidate-composer.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-level-candidate-store.js`
- `tools/numberdroid-studio/packages/persistence/src/sqlite/sqlite-derived-child-task-store.js`
- `tools/numberdroid-studio/packages/persistence/src/integrity/workspace-integrity.js`
- `tools/numberdroid-studio/tests/level-candidate-persistence.node-test.js`
- `tools/numberdroid-studio/tests/derived-child-task-persistence.node-test.js`
- `src/studioIntegration/numberdroidA4cCandidateComposer.ts`
- `src/studioIntegration/numberdroidA4cCandidateComposer.test.ts`
- `tools/numberdroid-studio/scripts/prepare-checkpoint-4-visual-evidence.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`

## 7. Verification and CI truth

The final combined A4c tree passed locally:

- full Studio: 747 total, 743 passed, four expected platform skips, zero failed;
- focused Candidate/child closure: 30 of 30 passed;
- JavaScript syntax: 239 files;
- real A4c vertical composer: six of six passed;
- Checkpoint 1A evidence: `VERIFIED`;
- root before the final Studio-only browser fix: 46 files / 230 tests green;
  exact-head Build #2347 reran and passed root on the final tree.

Build #2347 exercised the actual PR #199 diff through Linux Studio and browser
evidence, Windows Studio, root and final gates. The Checkpoint 4 artifact
captured Candidate and child detail at 1440×900 and 1060×900. Build #2348
attempt 1 reached the exact Windows ten-minute job limit after green test
output. Only failed jobs were rerun against the unchanged merge commit; attempt
2 passed Windows, Checkpoint 1A and the final gate. Pages was green.

Six independent final-head reviews—interaction/UX, security/authority,
persistence/idempotency, runtime composition, actual test/CI scope and combined
cross-domain—were blocker-free. This is engineering evidence only.

For any future diff, classify and run exactly the gates selected by the binding
policy. Every command/test needs an explicit timeout. Heartbeat is at most 120
seconds. Poll Actions every 30–60 seconds for at most 20 minutes and diagnose
after two unchanged polls. Recheck an unchanged exact PR head immediately
before merge and observe post-merge CI before dependent work.

Current documentation gates:

```bash
timeout 120s npm run repo:docs-check
timeout 120s npm run repo:docs-check-test
timeout 120s node scripts/repo/ci-change-classifier.selftest.mjs
```

Live Studio URL: `http://127.0.0.1:4317`

## 8. Authority and recovery exclusions

Do not add, enable, delete or repurpose:

- Remote backup metadata or operations;
- Remote MCP, Pairing, HostBinding, browser-agent or public/Funnel access;
- deletion, retention cleanup, restore activation or cutover;
- automatic acceptance, owner review-decision/acceptance operation, merge or
  `main` append;
- O3, O4, A5 or A6;
- Numberdroid product materialization, repository publication or release;
- EngineBridge rendering or ordinary Studio Preview authority.

Schema v14/v15 upgrades are forward-only on a real workspace. Recover from a
verified pre-upgrade copy or by forward repair; do not downgrade or delete rows
ad hoc. Test/live reviews use newly allocated temporary directories only.

## 9. Cross-role handoff and open decisions

QA / Integrator / Release owns the current consolidated truth and preparation
of VT-001/VT-014. Product / Designer and Klaus own live/workflow/product
acceptance. Coordinator / cross-domain must prevent an open acceptance gate from
being reinterpreted as authorization for the next roadmap item.

Engineer / Runtime Developer returns only for a concrete accepted finding or a
new bounded source decision. Any A4c modification again requires
Security/Authority, Persistence/Idempotency, Numberdroid adapter/compiler,
browser/UX and actual test/CI review because those risk axes cross one atomic
closure.

Open decisions are exactly:

- VT-001: accept/revise the Room Editor repair, direct manipulation, attention,
  findings and read-only Studio Preview experience; PR #191/#192 remain pending;
- VT-014: accept/revise the immutable Candidate stop, strict child attenuation
  and truthful read-only authority presentation;
- VT-011: revised processed-asset UI remains open independently;
- VT-013: deliberate private deployment remains open independently; and
- any new 2.5D, A5/A6, operational, materialization, publication or release
  scope requires an explicit new decision.

## 10. Reusable process learning

- Real browser evidence caught a deterministic 503 that source-pattern and
  persistence tests did not: a trusted-service child was requesting unrelated
  processing-adoption data. Attenuated task types must gate irrelevant read
  projections as strictly as mutations.
- A historical derivation origin and current executability are separate facts.
  Preserve the immutable origin while failing stale ancestry closed.
- A bounded failed-only retry is valid only on the exact unchanged commit and
  only after diagnosing the failed job. Record the first attempt; do not turn a
  timeout into an undocumented green run.
- GitHub workflow helpers can omit some `push` runs. Query the Actions run
  collection for the exact merge SHA through the connector, then inspect jobs.
- Logical footprint and visual overhang are independent. Never let preview
  composition silently widen collision/navigation semantics.
- `Merged`, green CI, screenshots and independent GO reviews are evidence,
  never product acceptance.

## 11. First receiver actions

1. Resolve remote `main`, tree, open PRs, Room/A4c branches and exact Actions
   state through the GitHub connector.
2. Execute Universal Bootstrap and read the full current package above.
3. Confirm VT-001 remains `REVISE`, VT-014 remains `NEEDS KLAUS REVIEW`, and no
   later merge/document changed acceptance or authority.
4. If Klaus review is requested, allocate only the safe fresh fixtures and
   follow the exact bounded steps in `VACATION_TEST_BACKLOG.md`.
5. Record Klaus's explicit disposition separately from technical evidence.
6. If a defect is found, freeze one bounded source slice and route it through
   Engineer / Runtime Developer plus all affected independent reviews.
7. If no Klaus session or new scope exists, stop. Do not begin A5 by roadmap
   momentum.

## 12. Definition of done for the next gate

The next gate is complete only when the current remote/tree/run state is
reverified, the exact safe fixture is used, Klaus's explicit acceptance or
revision is recorded under the correct VT ID, no conclusion is inferred from
automation, and Roadmap/plan/status/backlog/handoff are updated consistently.
Any repair must have its own unchanged exact head, actual-diff local/CI/browser/
Windows gates, blocker-free reviews and observed post-merge CI. Acceptance never
expands authority; a new implementation milestone still requires a separate
scope decision.

## 13. Final receiver instruction

Verify remote truth through the connector, execute Universal Bootstrap, read
the complete current Room/A4c package, and preserve every acceptance and
authority boundary. Prepare VT-001 and/or VT-014 only when Klaus requests that
gate. Otherwise wait for an explicit bounded scope. Do not start A5, widen A4c,
materialize, publish or release from this handoff.
