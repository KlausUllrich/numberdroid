# AGENTS.md

## Purpose

This file is the universal entry point for every Numberdroid agent. It is a **router**, not an encyclopedia: every agent reads the small common bootstrap, then follows a role/task-specific reading route from `docs/agents/ROLE_ENTRYPOINTS.md`.

The goal is to avoid two opposite failure modes:

- an Artist wasting context by reading the entire campaign/story/gameplay corpus before touching one prop;
- a specialist changing a cross-domain contract without reading the domain that owns it.

## Universal bootstrap — mandatory for every agent

Before changing anything in the repository, read completely in this order:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
6. `docs/README.md`

Then classify the task by **primary role and triggers** and read the required bundle in `ROLE_ENTRYPOINTS.md`.

If the user/current task explicitly names a handoff, read that handoff **after** the current binding documents for the relevant role. Handoffs are task snapshots, not higher authority than current contracts. Handoff format and cross-role rules are defined in `docs/agents/HANDOFF_PROTOCOL.md`.

## Role routing is task-based, not identity-based

A session may change roles while work progresses. An agent that starts as Artist becomes a Technical Artist/Engineer for the part of the task that changes runtime integration or reusable tooling. A Game Designer becomes Narrative-aware when a mechanic changes a story beat. Follow the trigger rules; do not rely on a permanent self-label.

If a task crosses domains, read the additional domain bundle **before** making the cross-domain decision.

## Source-of-truth model

Use these authorities:

- repository organization and file ownership: `REPOSITORY_STRUCTURE.md`
- role/task reading routes: `docs/agents/ROLE_ENTRYPOINTS.md`
- repository/GitHub workflow: `docs/agents/REPOSITORY_WORKFLOW.md`
- change-risk, superagent, bounded execution/polling, and verification tiers: `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`
- binary repository assets / safe transport: `docs/agents/BINARY_ASSET_TRANSPORT.md`
- durable gameplay/engineering invariants: `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`
- current production code: `src/`
- runtime/deploy assets: `public/` — outputs, not automatically authoring sources
- art direction and category contracts: `docs/art/`
- art-production method selection: `docs/art-production-methods/`
- reusable art-processing capabilities: `docs/art-production-toolkit/` + `scripts/art/toolkit/`
- reproducible asset-specific art source: `art-source/recipes/`
- architecture/map contracts: `docs/architecture/`
- game design: `docs/game-design/`
- declarative level-authoring/compiler contract: `docs/level-generation/` + `src/levelgen/`
- story/world: `docs/story/`
- current forward plan: `docs/planning/DEVELOPMENT_PLAN_NEXT.md`
- historical handoffs/experiments: `docs/history/` — evidence/context only, never current authority by default

If two current authorities conflict, report the conflict rather than silently inventing a resolution.

For Level Compiler / procedural level-authoring tasks, read `docs/game-design/LEVEL_DESIGN_RULES.md`, `docs/level-generation/README.md`, `docs/level-generation/LEVEL_SPEC.md`, relevant architecture/map contracts, and the actual `src/levelgen/` implementation before changing the compiler/spec semantics.

## Repository workflow — hard rules

- `main` is canonical and should remain stable.
- Verify current `main` HEAD and relevant GitHub Actions state before significant work.
- Before planning reviews or tests, classify the change under
  `docs/agents/CHANGE_RISK_AND_VERIFICATION.md`. Use only trigger-relevant
  superagents and gates; ambiguity or scope growth escalates rather than being
  optimized away.
- Use focused branches/PRs for changes.
- Treat every local/scratch workspace as disposable. As soon as a task has a
  coherent non-trivial diff, create a focused task-branch commit at the first
  reproducible checkpoint. After a focused check turns green, publish that
  exact state to the remote task branch through the GitHub connector
  immediately; never wait for final review, full CI, or merge readiness before
  creating the only durable copy.
- Before context compaction, a tool/session handoff, a potentially long or
  risky operation, or the ten-minute active-work checkpoint, commit and publish
  the current coherent task state. If it is knowingly incomplete or red but
  valuable, prefix the commit message with `checkpoint:`, record every missing
  or failing gate, and never present it as merge-ready.
- Checkpoint commits and remote task branches are recovery history, not user
  acceptance, review approval, CI evidence, merge authority, or a reason to
  weaken final gates. Prefer recoverability over a cosmetically minimal commit
  history; squash only later when useful and safe.
- Stage and checkpoint only task-owned paths. Never absorb, reset, delete, or
  publish unrelated user changes merely to make a checkpoint clean.
- For structured/textual remote repository operations use the connected GitHub connector and the discovery/recovery rules in `docs/agents/REPOSITORY_WORKFLOW.md`.
- **Before any binary repository write**, read `docs/agents/BINARY_ASSET_TRANSPORT.md` and run the executable binary preflight before constructing a transport payload.
- **Never inline Base64 for repository binary files, regardless of file size.** Do not route PNG/JPG/WEBP/ZIP/audio bytes through model-visible reasoning or string-based tool arguments.
- If a binary cannot be published through a direct connector file/path action or an already-authenticated local checkout, stop that write as `BINARY_TRANSPORT_BLOCKED`; do not use Base64/data-URI/SVG/chunking/CI-reconstruction workarounds.
- Local Git/`gh` is allowed only for the specific binary transport gap when an authenticated checkout actually exists; it is not a diagnostic fallback for connector availability.
- If GitHub actions are not currently surfaced, **rediscover the GitHub connector/actions first** as defined in `docs/agents/REPOSITORY_WORKFLOW.md`; absence from the active tool schema is not evidence that repository access is unavailable.
- Do not mix broad repository reorganization with gameplay changes.
- Preserve `zahlenkern-prototyp-meta-v7.html` as the frozen behavioral reference; do not refactor it into production code.
- Before merging behavior/runtime changes, run the relevant tests and any
  production build selected by the risk tier and actual path triggers. Full
  suites, browser evidence, and additional platforms require an L3
  classification or a concrete trigger. Art changes must still run their
  relevant art QA scripts. D0 documentation-only changes do not trigger product
  suites unless they affect generated output, CI, configuration, fixtures, or
  executable examples.
- `CI green`, `merged`, and `visually accepted` are different states.
- Update the relevant current contract/recipe when a durable decision or accepted asset changes.

## Bounded execution and responsiveness — hard rules

- Do not leave the user without a concise progress update for more than **120
  seconds** while commands, delegated work, CI, or another external operation
  are still active. State the current phase, the last observed result, and the
  next bounded wait or takeover action. Technical polls never reset this
  deadline; during 30–60-second external polling, at most one poll may occur
  between user-visible updates.
- Any operation that may outlive the current tool response MUST use a yieldable,
  resumable path whose first yield is bounded to at most 30 seconds. Preserve
  its complete control metadata — including session/cell/job/run/operation ID,
  deadline, and last output — before doing other work. Discarding the handle by
  projecting only payload output is prohibited. If a handle is lost, stop blind
  waiting, resolve the real process/job state, then take over or rerun only the
  smallest safe idempotent check.
- Every locally started command, test, build, or diagnostic MUST have an
  explicit risk-scaled wall-clock timeout. Do not start unbounded shell
  commands or use a blocking sleep longer than 60 seconds. A legitimately long
  process must run in a resumable session and be polled at intervals of at most
  60 seconds.
- Every delegated review or investigation MUST receive a deadline in its task.
  The default maximum for a bounded review or diagnosis is **five minutes**.
  When that deadline expires, interrupt it and take over or rescope the work;
  do not keep waiting silently. A longer deadline is allowed only when the task
  intrinsically requires it, and the reason and new bound are communicated
  before the original deadline.
- Poll GitHub Actions and comparable external jobs at **30–60 second
  intervals**, not with an unbounded wait or a tight busy loop. Give the watch
  an overall deadline based on the established workflow duration; when no
  repository-specific duration is known, use **20 minutes**. Crossing the
  deadline triggers log/heartbeat inspection and an explicit stalled/running
  decision, never an inferred pass, an automatic merge, or silent abandonment.
- Two consecutive polls with no observable state or heartbeat change trigger
  diagnosis and a user-visible stalled/healthy decision before any third poll.
  Never keep repeating an unchanged status query without inspecting the job,
  logs, process inventory, or a narrower source of truth.
- Keep tool output bounded and structured. Preserve control metadata, but emit
  only fields needed for the decision. If output is truncated, re-query a
  smaller exact slice before relying on omitted facts; truncation is never
  evidence of success, failure, or unchanged state.
- After every meaningful local or remote mutation, record a compact continuity
  checkpoint containing canonical remote `main`, local branch/HEAD/worktree,
  active branch/head, PR, workflow run/deadline, last verified result, next
  bounded action, and blocker. After context compaction or another boundary
  that may discard control state, re-verify that checkpoint before any further
  mutation and send a recovered-state update.
- A timeout is neither success nor failure evidence. Preserve partial output,
  determine whether the cause is product code, test infrastructure, platform,
  or an external runner, then run a narrower safe check, repair/retry, take
  over, or report a genuine stop gate.
- These time bounds scale execution and communication only. They never weaken
  authority, safety, compatibility, recovery, acceptance, review, or green-CI
  requirements.

## Efficient block execution without quality loss — hard rules

- After the mandatory reading route, lock one coherent block's promise,
  exclusions, risk tier, finish condition, and selected gates before broad
  investigation. Target this scope lock within **two minutes**; if uncertainty
  prevents it, state the exact ambiguity instead of expanding silently.
- Complete and report one coherent block before implementing the next dependent
  block. Autonomous continuation is allowed only after the prior block's result,
  remaining boundary, and next scope have been made user-visible.
- Start with the smallest test or diagnostic that can falsify the current
  hypothesis. Run broader suites only when selected by the risk tier, an actual
  path/platform trigger, or a concrete finding. Do not repeat an unchanged
  green suite or broad review merely for reassurance.
- Use only trigger-relevant reviewers, run independent reads/checks in parallel,
  and perform one actual-diff review after code freeze. After a finding, repeat
  only the affected checks/reviews unless the fix changes another risk axis.
- If **ten minutes of active local work** have not produced a merge-ready result,
  issue a checkpoint with completed evidence, remaining work, and the next
  bounded action, then rescope or continue deliberately. External CI time is
  governed separately by the bounded polling rules above.
- On failure, inspect the first decisive error and repair the responsible layer
  before rerunning. Do not restart every successful lane. Filesystem/SQLite/
  server fixtures require an explicit cross-platform cleanup check: drain and
  close workers, network handles, and database writers before removing their
  temporary directory.
- Prefer one source PR per coherent block. Create a separate evidence-only PR
  only when immutable post-merge/CI identities must be preserved in a binding
  current document; otherwise keep those facts in the existing PR/CI record.
- Efficiency may remove duplicated work, idle polling, and unnecessary process
  breadth. It must not remove a tier-triggered test, independent review,
  compatibility/recovery proof, human gate, or exact remote-tree/merge check.

## Art-specific hard rules

Before producing/editing gameplay art, follow the Artist route in `ROLE_ENTRYPOINTS.md` and the binding `docs/art/production/ARTIST_AGENT_WORKFLOW.md`.

For Prop or Prop-like environmental Hero work, `docs/agents/PROP_ARTIST_BRIEF.md` is the specialized direct onboarding route. It provides concise game/story/current-phase orientation and routes to the current Prop workflow, Level/Editor requirements, Art contracts, method/toolkit authorities, recipe and runtime consumers.

For every ChatGPT `image_gen` call, also follow:

- `docs/art/production/HARD_GENERATION_COMMAND_GATE.md` — **hard authorization predicate**;
- `docs/art/production/IMAGE_GENERATION_TURN_CONTRACT.md` — tool-channel / turn-ending behavior.

The hard generation command gate has priority over any older/broader wording elsewhere that merely says the message “contains” the word `generieren`.

In particular:

- select a production method before generation;
- update/create the asset recipe before the first production generation/edit pass;
- for a new/materially revised Prop, first explain the **function-to-form design philosophy in text** and give the user a correction gate before image generation;
- **one Prop proposal per generated image**; do not put A/B/C alternatives or several versions on one canvas;
- if alternatives are wanted, generate them as separate turns with QA/user steering between candidates;
- for Prop work, `image_gen` is prohibited unless `trim(currentUserMessage).toLowerCase() === "generieren"`;
- the entire trimmed current user message must therefore be exactly the standalone command **`generieren`**; mentioning that word inside a sentence is not authorization;
- `Bitte generieren`, `noch einmal generieren`, `wir sollten eine Variante generieren`, questions/discussion containing the word, and all other mixed-content messages are **not** authorization;
- authorization is derived from the **current user message only**, never carried forward from a previous turn, and is consumed after exactly one `image_gen` call;
- invoke `image_gen` only in the channel declared by the current tool schema; in the current ChatGPT environment this is **commentary**, never `final`;
- after `image_gen` returns, emit **no additional assistant final response**; the tool return is the end of the generation turn;
- the literal trigger word **`QA`** means inspection only and is a hard no-generation mode;
- `ok`, `ja`, `weiter`, `mach das`, `ändern`, `verbessern`, `nächste Variante` or similar conversational wording do not substitute for the standalone `generieren` command;
- generated source is not automatically a production runtime asset;
- accepted/frozen categories are not reopened without a concrete defect or explicit approved revision.

## Handoff discipline

A handoff must be self-explanatory enough for a new session and role-aware enough not to require reading the whole repository. Use `docs/agents/HANDOFF_PROTOCOL.md`.

A handoff must never tell the receiver to trust the handoff instead of current code/contracts. The receiver verifies `main`, reads the common bootstrap, follows the role route, then uses the handoff as the current task snapshot.

Do not create a full handoff for an ordinary candidate PR or merge. Update the
directly affected current authority and compact decision/test backlog; create a
full handoff only at a clean milestone, genuine session or primary-role
transition, or a real stop gate.

When handing from one role to another, explicitly state:

- receiving role;
- why that role is needed;
- which additional domain triggers apply;
- what is already accepted/frozen;
- what decision remains open and who owns it.

## Documentation discipline

New documentation must be placed according to `REPOSITORY_STRUCTURE.md`; do not add new project documents to the repository root unless explicitly allowed there.

When a document becomes historical, move it to `docs/history/` instead of leaving multiple competing status documents beside current contracts.

Method-specific skills belong inside the corresponding method folder under `docs/art-production-methods/<method>/skill/`. Do not create a global skill that implies one art workflow is universal.
