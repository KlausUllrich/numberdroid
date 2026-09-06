# Numberdroid — Codex Context Retention

Status: **binding Codex session-continuity procedure**

## Purpose

Numberdroid onboarding is task-routed. The repository therefore does not keep
one static list of every document that every agent should carry. Each Codex
session records the exact role, domain, planning, and handoff documents selected
for its current task. After automatic compaction, a trusted, enabled repository hook restores
those files in full before the model continues.

This mechanism supplements compaction summaries; it does not replace the
authority or reading routes in `AGENTS.md` and
`docs/agents/ROLE_ENTRYPOINTS.md`.

## Session procedure

After the universal bootstrap and task classification are complete, replace the
session manifest with the minimum complete task-specific route that was read.
Register required current contracts and only explicitly named handoffs; do not
add unrelated domain documents or old handoffs for reassurance:

```bash
node scripts/repo/codex-context-retention.mjs register --replace \
  docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md \
  docs/architecture/ARCHITECTURE.md
```

The command always adds the universal bootstrap automatically. When the task
gains a trigger role, domain, or named handoff, append the newly read documents:

```bash
node scripts/repo/codex-context-retention.mjs register \
  docs/story/STORY_WORLD_FOUNDATION.md
```

Inspect the active selection with:

```bash
node scripts/repo/codex-context-retention.mjs show
```

The manifest is keyed by `CODEX_SESSION_ID` and stored below the ignored
`.agent-context/` directory. Separate Codex sessions therefore keep separate
task bundles. Files are resolved again from the current worktree during reload,
so current repository content wins over an older chat summary.

## Integrity and safety

- Only repository-relative, regular, non-symlinked UTF-8 Markdown files are
  accepted.
- Reload preserves every byte of every selected file; boundary labels are added
  around files so their authority and path stay clear.
- The hook uses `additionalContextLimit = 0` so Codex does not spill a large
  bundle to disk and substitute a preview.
- The reload script itself enforces a hard 1,500,000-byte aggregate output cap.
  If the selected bundle exceeds it, continuation stops without injecting a
  partial bundle. The agent or user must then deliberately reduce the selected
  set.
- Manifests contain paths only, never document copies or secrets, and are not
  committed.

## Scope

The settings and hook in `.codex/` apply only when a trusted Codex client loads
this Numberdroid repository layer. They do not change global Codex defaults and
do not govern non-Codex providers.

This repository sets no model context window, compaction threshold, or
compaction-counting override. Those choices follow the active client/model
configuration and are independent of task-document retention.

## Hook activation

The presence of `.codex/hooks.json` does not prove that recovery is active.
Codex must load the trusted project layer, have hooks enabled, and trust the
exact hook definition. In an interactive Codex client, review the hook through
`/hooks` before trusting it. An agent must not claim automatic recovery is
active merely because registration or the standalone self-test passed.

If the client does not support or activate this hook, keep the selected path
list in the session checkpoint and reread that route manually after compaction.
The same current-authority and named-handoff rules still apply.
