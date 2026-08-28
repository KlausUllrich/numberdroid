# A1.6b2b Authoring-v2 MCP transport status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.6b2b is a non-visual L3 MCP/HTTP/Authority/Persistence compatibility
candidate. The frozen source head
`5e2d5d96b6c7860290eaa9d07f87626de1634b1c` exposes only the A1.6b2a
processing-result adoption boundary through an explicit, private Authoring-v2
transport. It does not make the candidate the default MCP profile and does not
grant any new product, owner, lifecycle, materialization, publication, or
release authority. All five final actual-diff reviews are **GO** with no open
findings. PR [#162](https://github.com/KlausUllrich/numberdroid/pull/162), its
final `[ci-full]` Actions, squash merge, and post-merge `main` Actions are
complete and green. Implementation, integration, review, and automated
evidence do not constitute Klaus's contract acceptance.

## Explicit selection and positive private handshake

- The launcher selects this candidate only when
  `NUMBERDROID_STUDIO_MCP_PROFILE=authoring-v2` is set exactly. An absent
  selector preserves the legacy launcher and discovery behavior. Every other
  set value, including an empty, padded, or legacy-looking value, fails closed
  with no MCP protocol output, stack, path, token, or fallback surface.
- Before constructing an Authoring-v2 MCP server, the launcher sends one
  Bearer-authenticated request to the loopback-only private route
  `/internal/mcp/authoring-v2/handshake`. The request pins schema v2, feature
  `studio.authoring-v2`, the launcher-selected project, and the Numberdroid-v2
  profile fingerprint
  `5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106`.
- A positive response always reports `status: READY`. Its `budgetState` is
  `AVAILABLE` while a new command can be admitted, or `REPLAY_ONLY` when
  task/grant usage coherently equals the command budget. `REPLAY_ONLY` is an
  intentionally nonauthorizing startup state: it keeps lost-response replay
  reachable after a restart, but does not make a fresh semantic command or the
  full-admission capabilities resource budget-valid.
- The server produces that response only after fresh HostBinding, Grant, Task,
  non-main task branch, branch head, private scope/object scope, profile, and
  complete durable-stack checks. A negative, malformed, cross-project,
  mismatched-profile, revoked, expired, drifted, or unavailable handshake
  terminates startup. A client or environment claim cannot create authority.
- The gateway accepts only private loopback HTTP service URLs, disables
  redirects before sending the HostBinding credential, validates the exact
  response coordinates, and exposes only the three narrow DTOs for
  `/internal/mcp/authoring-v2/handshake`,
  `/internal/mcp/authoring-v2/capabilities`, and
  `/internal/mcp/authoring-v2/processing-result-adopt`.

## Static MCP surface and fresh authority

- Existing discovery is unchanged at exactly **19 tools/four resource
  templates** without a task and **30 tools/five resource templates** for a
  matching legacy task.
- Only after the positive Authoring-v2 handshake, the MCP process freezes one
  static **31-tool/six-resource-template** surface. Relative to the unchanged
  matching-task 30/5 surface, its complete delta is exactly:

  - tool `studio_processing_result_adopt`;
  - resource template `studio://projects/{projectId}/capabilities`.
- The new tool's strict schema requires `dryRun` and the complete bounded A1.4
  command input. Transport-fixed schema, feature, tool, command-type, and
  operation coordinates cannot be selected or replaced by the caller.
- Discovery stays static for the lifetime of that MCP process. It is not a
  cached authorization decision: every capabilities read and tool call creates
  a fresh HostBinding-resolved one-shot A1.6b2a session. Revocation therefore
  leaves an already negotiated process at 31/6 while its next operation fails
  closed; a newly started process cannot pass the handshake and never falls
  back to 30/5.

## Admission, replay, audit, and lifecycle behavior

- The capabilities resource is redacted discovery, never authority. Every read
  repeats full current admission around the profile read. `dryRun: true`
  likewise repeats full admission around the real A1.4 plan and remains
  effect-free: it creates no revision, Asset, adoption/replay row, Activity,
  retention reference, usage charge, or CAS object.
- `dryRun: false` preserves the A1.6b2a ledger-first exception. After strict
  envelope and current HostBinding/Grant checks, commit enters a fresh
  host-bound A1.5 store without a budget-blocking full pre-admission. A
  successful new command remains one atomic DRAFT adoption with one command
  charge and the existing retention effects.
- After a `maxCommands: 1` commit and a complete MCP/Studio/SQLite restart, the
  handshake reports `READY`/`REPLAY_ONLY`. The same idempotency key and
  semantics, including an unused command-ID alias, returns the original result
  without another mutation, retention effect, or charge. A genuinely new
  semantic command is budget-denied. Current Binding/Grant revocation remains
  earlier than replay and prevents result disclosure.
- Successful handshake, capabilities, and dry-run operations create no generic
  `AUTHORIZED` attempt row. Successful commit uses only the atomic semantic
  branch/timeline evidence owned by A1.5, and replay adds no second semantic
  effect. Each attributable denial or failure creates exactly one redacted
  `DENIED` or `FAILED` attempt; traffic that cannot be attributed to a binding
  creates none. Tokens, Binding/Grant IDs, local paths, stacks, and internal
  runtime details are not disclosed.
- MCP cancellation propagates through the gateway fetch and HTTP request abort
  signal into the one-shot session. Cancellation does not make a consumed
  session reusable. Once an atomic commit has begun, recovery remains the
  existing same-idempotency-key retry rule rather than an interruptible partial
  transaction.
- Private JSON bodies are bounded to **1 KiB** for handshake, **1 KiB** for
  capabilities, and **1 MiB** for adoption. The server rejects excess or
  smuggled fields before domain execution.
- Server shutdown first closes the private runtime to new work, drains an
  in-flight Authoring-v2 operation, and only then closes the SQLite writer. The
  behavioral drain probe confirms that the database remains readable while the
  operation is pending and is closed after the drain completes.

## Preserved compatibility and exclusions

- Legacy command definitions/scopes remain exactly **33/30**. Numberdroid
  profile v1 and its fingerprint
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`
  remain unchanged; the v2 overlay remains separately selected and pinned.
- There is no migration: SQLite remains schema v13 and portable bundles remain
  v1-v3. The restart/recovery fixture reopens the same schema-v13 SQLite/CAS
  state; no startup semantic write, downgrade, or repair is required.
- This block adds no UI or browser control, launcher auto-opt-in, public
  Authoring-v2 HTTP API, owner review or decision, proposal apply/finalize,
  merge/revert, lifecycle promotion, Main/CP2C mutation, materialization,
  repository write, publication, or release operation. The capabilities
  resource cannot grant any of those actions.
- A1 remains incomplete. This integrated candidate is **NOT USER ACCEPTED**;
  A1.7 is the next bounded development block.

## Verification

Frozen local candidate evidence on 2026-08-28:

- focused Authoring-v2, HostBinding, gateway, HTTP/MCP, audit, adoption,
  compatibility, and package-boundary suite: **208 passed, 0 failed**;
- full Studio suite under Node 24.19.0: **513 passed, 0 failed**;
- `npm run check`: **149 JavaScript files passed**;
- `npm run check:selftest`: passed;
- production-adapter evidence: `VERIFIED`, with protected source-manifest hash
  unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.

The additive transport coverage includes exact selector failure, positive and
replay-only handshake, loopback/redirect/token redaction, exact 31/6 delta,
strict tool/resource schemas, fresh capabilities/dry-run admission, effect-free
dry-run, atomic commit, full process/database restart replay, exhausted-budget
denial, post-start revocation with static discovery, attributable audit,
bounded bodies, cancellation, and active-operation shutdown drain.

Five independent final actual-diff reviews for Security/Authority,
Compatibility/MCP, Domain/Application, Persistence/Recovery, and QA/Docs are
**GO** with no open findings.

The first PR Actions run
[#2202 / 33208418002](https://github.com/KlausUllrich/numberdroid/actions/runs/33208418002)
correctly exposed a Windows-only fixture teardown defect: the test attempted to
remove an open SQLite file before closing the Studio runtime, produced `EBUSY`,
and the leaked handle reached the job timeout. Source head
`5e2d5d96b6c7860290eaa9d07f87626de1634b1c` sequences runtime/SQLite close
before removal. Final PR Actions run
[#2203 / 33209352949](https://github.com/KlausUllrich/numberdroid/actions/runs/33209352949)
passed the classifier, forced Root build, Linux Studio including browser
evidence, Windows Studio, and CI gate; Pages was correctly skipped. PR #162 was
then source-integrated into `main` as squash commit
`0c5f6e5845b277716fd788375ade52905a9bf391`. Post-merge `main` Actions run
[#2204 / 33209824883](https://github.com/KlausUllrich/numberdroid/actions/runs/33209824883)
passed classifier, Linux Studio/browser, Windows Studio, and CI gate while Root
build and Pages were correctly skipped by the actual 23-path classification.
This conservative CI evidence is regression evidence, not UI, visual, or
product-contract acceptance.

## Safe fixture and recovery

Automated transport and restart evidence allocates a unique temporary
SQLite/CAS directory, provisions only a synthetic private task/Grant/
HostBinding and test PNG artifacts there, starts the loopback Studio/MCP
processes, closes MCP, HTTP, and SQLite handles, and then removes only that
exact temporary directory. Never point these tests or exploratory launchers at
`.numberdroid-studio`, an active personal workspace, a backup, or a Numberdroid
checkout. No manual data reset or migration rollback is required.

Source rollback is a focused revert of squash commit
`0c5f6e5845b277716fd788375ade52905a9bf391`. Existing schema-v13 databases,
portable bundles, A1.5 adoption rows, retained CAS objects, task ledgers,
HostBindings, Grants, and audit rows require no downgrade or repair.
