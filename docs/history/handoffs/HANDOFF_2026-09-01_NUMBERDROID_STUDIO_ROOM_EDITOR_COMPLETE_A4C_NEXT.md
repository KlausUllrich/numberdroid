# Numberdroid Studio — Room Editor complete, A4c next handoff

DATE: 2026-09-01
REPOSITORY: `KlausUllrich/numberdroid`
STATUS: **Room Editor L3 source sequence integrated and green, not user accepted; A4c task-scoped Application candidate authorized next**
BASELINE MAIN HEAD AT CREATION: `fc0969452ec6e22e2e3bddab399a2c56f5e6f63d`, tree `46afd8f915a17a2143363424a2eb057d9b5902a7` (pre-handoff-document baseline; receiver must re-resolve current `main`)
BASELINE CI / PAGES STATE: PR #196 exact head `81c9c3979e8e5217fb84717a537ddb425634ec75`, Build #2340 / run `33540448651`, green; merge `fc0969452ec6e22e2e3bddab399a2c56f5e6f63d`; post-merge Build #2341 / run `33541276661`, green; Root build and Pages correctly skipped by the Studio-only classifier
PRIMARY RECEIVING ROLE: Engineer / Runtime Developer, with the Numberdroid adapter/compiler reviewer required for engine-specific candidate fidelity
SECONDARY / TRIGGER ROLES: QA / Integrator / Release; Coordinator / cross-domain; Security/Authority and Persistence/Idempotency for every new task, review or mutation boundary; Product/Designer only for later live Room Editor acceptance
NEXT MILESTONE / TASK: implement the first bounded A4c task-scoped Application Level Candidate slice, stopping at **Waiting for your review**

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

Use Engineer / Runtime Developer as primary author, QA / Integrator / Release
for actual-diff verification and integration, and Coordinator / cross-domain
for sequencing. Because A4c uses the Numberdroid projection/compiler closure,
the Numberdroid adapter/compiler reviewer is mandatory for the implementation
diff.

Then read completely, in this order:

1. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
2. `docs/architecture/ARCHITECTURE.md`
3. `tools/numberdroid-studio/README.md`
4. `tools/numberdroid-studio/docs/VISION.md`
5. `tools/numberdroid-studio/docs/REQUIREMENTS.md`
6. `tools/numberdroid-studio/docs/ARCHITECTURE.md`
7. `tools/numberdroid-studio/docs/ROADMAP.md`
8. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
9. `tools/numberdroid-studio/docs/A3A_LEVEL_LOGIC_KERNEL_STATUS.md`
10. `tools/numberdroid-studio/docs/A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md`
11. `tools/numberdroid-studio/docs/A4B_REFERENCE_BEHAVIOR_STATUS.md`
12. `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md`
13. `tools/numberdroid-studio/docs/CHECKPOINT_5_CONTRACT.md`
14. `tools/numberdroid-studio/docs/CHECKPOINT_5_STATUS.md`
15. `tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md`
16. `tools/numberdroid-studio/docs/VACATION_TEST_BACKLOG.md`
17. this handoff, last.

Follow every additional binding reference and exact implementation/test route
required by the A4c authority document before changing Candidate, task, review,
compiler, EngineBridge or persistence code.

O1/O2 operational documents are not initially mandatory because this task may
not change backup, remote service, pairing, HostBinding, MCP transport or
deployment. They become mandatory only if Klaus separately authorizes such a
scope. O3/O4/A5/A6, product materialization, repository publication and release
remain excluded rather than deferred reading.

## 2. Verified repository state at creation

- The connector resolved `main` to
  `fc0969452ec6e22e2e3bddab399a2c56f5e6f63d`, tree
  `46afd8f915a17a2143363424a2eb057d9b5902a7`.
- PR #191 functional repairs: exact head
  `d23cd760e0b03257d8eeb137aae28a1c0fec89cc`, merge
  `e0cfb9fb48505c863c2fe52504d378ad6c03708e`, Build #2301 / run
  `33490816313` and post-merge Build #2302 / run `33491619241`, green.
- PR #192 zoom/pan: exact head
  `326c9509322a69e5f6f4717e1b3118a764a2ebbf`, merge
  `d33afa61a8c66a9245401efb0f677c426ed3b086`, Build #2303 / run
  `33495245029` and post-merge Build #2304 / run `33496734765`, green.
- PR #193 preview architecture/handoff: exact head
  `fae8dccac54ddbe0506a72c227c6154e5e1d2e83`, merge
  `cc932dddf08476be4208ccf4b0b29b23edb0c9ee`, Build #2306 / run
  `33497575137` and post-merge Build #2307 / run `33497725456`, green.
- PR #194 direct manipulation: exact head
  `75221dd9653a7f03570f7c6a3b934df07db2921b`, merge
  `439a2cf0c92639f3fe8750a7ef68ce29ea442cc7`, Build #2317 / run
  `33509448594` and post-merge Build #2318 / run `33510213052`, green.
- PR #195 attention/errors/findings: exact head
  `dd2592f677637ecb97e5013083a27c91e76d0887`, merge
  `5f1bf524300e8478573df7c27e15607ac4723f39`, Build #2323 / run
  `33517235933` and post-merge Build #2324 / run `33518106796`, green.
- PR #196 exact read-only Studio Preview: exact head
  `81c9c3979e8e5217fb84717a537ddb425634ec75`, merge
  `fc0969452ec6e22e2e3bddab399a2c56f5e6f63d`, Build #2340 / run
  `33540448651` and post-merge Build #2341 / run `33541276661`, green.
- There were no open pull requests before the Room Editor continuation started;
  the receiver must re-query rather than assuming that remains true.

## 3. Accepted / frozen

- VT-000 Studio baseline passed.
- Checkpoints 1–4 remain accepted foundations.
- VT-012 O1b Backups UI remains user accepted as recorded on 2026-09-01.
- Human owner review remains the only product-acceptance authority. CI,
  screenshots, compiler output, independent review, PR merge and source
  integration never imply acceptance.
- Product `main` remains untouched by Studio authoring candidates unless a
  later separately authorized materialization/publication path is invoked;
  A4c has no such authority.

## 4. Implemented but not accepted

- CP4.5 / VT-001 remains **REVISE** after Klaus's live walkthrough.
- PR #191 and PR #192 are implemented and green but explicitly require later
  Klaus live regression. Their deferred acceptance does not block safe A4c
  source work.
- PRs #194–#196 complete the authorized Room Editor L3 source sequence, but
  placement interaction, overview/error visibility, findings navigation and
  Studio Preview also remain not user accepted.
- A3a, A4a and A4b are source-integrated and automated green, not user accepted.
- The A4c authority-neutral Domain DTO foundation is source-integrated. The
  task-scoped Application candidate path is not implemented.
- VT-011 remains **REVISE**. A4c must not imply that a real agent harness
  received or acted on browser feedback.

## 5. Planned / not implemented

The next bounded L3 slice is one private Application closure for the already
authorized `level.candidate.create` scope:

```text
active human-rooted Task/Grant + exact non-main branch head
→ exact A4a projection and A4b-supported semantics
→ validate
→ compile
→ portable preview artifact
→ deterministic diff
→ atomic candidate/review submission
→ task/effective IN_REVIEW
→ review OPEN, every item PENDING
→ REVIEW_SUBMITTED / Waiting for your review
```

The Candidate Application slice comes first. Trusted-service child-task
derivation and its persistence/budget/ancestor rules are a separate later L3
axis and must not be mixed into the Candidate PR.

The 2.5D/isometric or dimetric Studio renderer is still planned, not
implemented, and not an A4c prerequisite. Engine-specific runtime preview,
product materialization, repository publication and release remain separately
gated future work.

## 6. Room Editor and preview boundary now available to A4c

The portable preview flow is:

`current saved Project head + current saved Room head → engine-neutral preview scene → top-down renderer / later 2.5D renderer`

The source query fails closed unless the requested Project revision is the live
Project head and the requested Room version is the current saved Room head.
Exact historical placed-asset versions resolve only through the Room's creation
revision. Preview performs no writes.

Logical footprint is the only occupancy/collision/navigation authority. Ground
anchor, visual bounds/offset, elevation, overhang, transparency, projection
neutral geometry and optional background/body/foreground segments are
presentation only. Projection policy remains renderer-owned; the portable
scene does not author a view, projection or final draw order. Presentation may
never change gameplay semantics or authority.

The ordinary Studio Preview is read-only and approximate. It does not invoke
Numberdroid or widen the validate-only EngineBridge. Its
`studio.room-preview-scene` contract is distinct from A4c's
`studio.task-candidate-preview` DTO. A4c must follow its own binding Candidate
contract and may not infer composition or authority from the Room Editor scene.
It must not turn either preview into runtime fidelity, authoring, acceptance,
materialization or publication authority.

Current Room Editor implementation and verification paths include:

- `tools/numberdroid-studio/apps/studio-server/public/app.js`
- `tools/numberdroid-studio/apps/studio-server/public/styles.css`
- `tools/numberdroid-studio/apps/studio-server/public/room-preview-state.js`
- `tools/numberdroid-studio/packages/preview/src/room-preview-scene.js`
- `tools/numberdroid-studio/packages/application/src/studio-service.js`
- `tools/numberdroid-studio/packages/domain/src/room-definition.js`
- `tools/numberdroid-studio/apps/studio-server/src/server.js`
- `tools/numberdroid-studio/tests/room-preview-scene.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-state.portable.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-source-application.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-http-security.node-test.js`
- `tools/numberdroid-studio/tests/room-preview-ui.node-test.js`
- `tools/numberdroid-studio/tests/checkpoint-4-5-ui.node-test.js`
- `tools/numberdroid-studio/scripts/capture-studio-browser-evidence.js`

Resolve the exact A4c implementation paths only after reading its full binding
package and inspecting current source. Do not infer Candidate authority from
the generic preview paths above.

## 7. Verification and integration discipline

For the A4c slice:

1. re-resolve exact `main`, tree, PRs, A4c branches and Actions through the
   connector;
2. freeze one Candidate Application promise and classify every actual risk
   axis before writing;
3. use independent planning for compiler fidelity, authority/security,
   persistence/idempotency, application composition and real test/CI scope;
4. test exact immutable replay, stale heads, revoked/expired authority,
   task/grant/branch mismatch, idempotent lost-response replay, transaction
   faults, compile/preview/diff failures and restart integrity;
5. prove no Main mutation, owner review, auto-accept, child task, EngineBridge
   widening, materialization, repository write, publication or release effect;
6. run all actual-diff local, Linux, Windows, browser/evidence and root gates
   selected by binding policy;
7. require blocker-free independent actual-diff reviews, including
   Numberdroid adapter/compiler, Security/Authority and
   Persistence/Idempotency;
8. re-check the exact unchanged PR head immediately before merge;
9. merge only with every triggered gate green; and
10. observe post-merge `main` CI before dependent work.

Every command/test uses an explicit timeout. Heartbeat is at most 120 seconds.
Poll CI every 30–60 seconds for at most 20 minutes and diagnose after two
unchanged polls. Save valuable work early as a commit and remote checkpoint.

Initial Studio commands remain, subject to the A4c document's more specific
test matrix:

```bash
timeout 300s npm --prefix tools/numberdroid-studio run build
timeout 900s npm --prefix tools/numberdroid-studio test
timeout 120s npm --prefix tools/numberdroid-studio run evidence:verify
```

Repository documentation gates:

```bash
timeout 120s npm run repo:docs-check
timeout 120s npm run repo:docs-check-test
```

Live Studio URL: `http://127.0.0.1:4317`

## 8. Authority and exclusions

Do not add or activate:

- Remote backup metadata or operations;
- Remote MCP, Pairing, HostBinding or browser-agent authority;
- public/Funnel exposure;
- deletion, retention/cleanup or restore activation;
- automatic review acceptance;
- O3, O4, A5 or A6;
- child-task derivation in the Candidate Application slice;
- Candidate-created product commits, Main append, Numberdroid materialization,
  repository publication or release;
- EngineBridge rendering or generic preview authority.

The Candidate must stop before owner decision. **Waiting for your review** is a
successful bounded result, not acceptance.

## 9. Cross-role handoff and open decisions

Engineer / Runtime Developer is primary because the portable Room Editor scene
and A4a/A4b compiler foundations are already integrated; the next work is
bounded Application composition and transactional persistence. The
Numberdroid adapter/compiler reviewer protects projection and compilation
fidelity. QA / Integrator / Release owns actual-diff gate classification and
integration evidence. Coordinator / cross-domain prevents child-task,
operational and product-release scope from entering the Candidate slice.

Security/Authority and Persistence/Idempotency are mandatory because A4c adds
a private mutation and task/review persistence. Product/Designer returns for
the deferred VT-001/VT-011 live gates, not to infer acceptance from A4c CI.

Klaus already decided the private Candidate scope and the later strictly
attenuated child-task direction. The exact Application/persistence design must
stay within the binding A4c contract. Klaus retains any future decision to
accept the Candidate workflow, choose or accept a 2.5D style, deploy O2, widen
agent connectivity, materialize into Numberdroid, publish or release.

## 10. Reusable process learning

- Connector workflow-run helpers may omit `push` runs; when verifying
  post-merge CI, query the GitHub Actions run collection for the exact merge SHA
  through the connector and then inspect its jobs.
- Source-pattern tests did not detect all preview rendering defects. Real
  browser evidence caught transform-space clipping, responsive viewport and
  saved-scroll failures. Keep behavioral pixels, geometry and unchanged-state
  oracles for visible projection work.
- Portable bundle limits must admit all valid domain data. The preview slice
  raised only the aggregate JSON depth limit from 12 to 14, retained a failing
  depth-15 case and kept domain extension depth and authority exclusions
  unchanged.
- A visual overhang is never a logical footprint. Preserve that split in any
  Candidate preview/diff presentation.
- `Merged`, green CI and screenshots are evidence, never product acceptance.

## 11. First receiver actions

1. Verify exact remote `main`, tree, open PRs/A4c branches and Actions.
2. Execute the Universal Bootstrap and complete the full reading bundle above.
3. Inspect the actual A4c Domain foundation, A4a/A4b projection/compiler path,
   private task/grant/branch services and persistence schema.
4. Summarize the exact Candidate state machine, atomic boundary, failure
   matrix, authority exclusions and any conflict with current source.
5. Freeze one bounded Candidate Application slice and its actual-diff test
   matrix.
6. Implement directly only after steps 1–5; do not mix child-task persistence.

## 12. Definition of done for the next milestone

The first A4c Application slice is complete only when one exact task-scoped
Level Candidate is deterministically created, validated, compiled, previewed
and diffed as one immutable fail-closed closure, then durably and idempotently
submitted in one atomic Candidate/task/review/timeline persistence transaction.
Every resulting state stops at `IN_REVIEW`, `OPEN`, all `PENDING`,
`REVIEW_SUBMITTED` and **Waiting for your review**; exact replay and failure
recovery are proven; no excluded authority or product effect exists; all
triggered local, CI, browser, Windows and independent-review gates are green on
an unchanged head; post-merge CI is observed; current docs/backlog are
truthful; and no automation claims user acceptance.

## 13. Final receiver instruction

Verify `main` and Actions through the connector; execute the Universal
Bootstrap; read the complete A4c role/domain package; inspect actual current
source; summarize the Candidate/authority boundary and identify any conflict;
then implement the one bounded Application slice. Stop at **Waiting for your
review**. Do not add child-task, operational, materialization, publication or
release scope, and never infer acceptance from source integration or evidence.
