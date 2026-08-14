# Repository Skills

This folder contains portable agent skill contracts for Numberdroid.

A repository `SKILL.md` is not automatically installed into every agent/harness. A compatible harness may discover it directly; otherwise the agent must explicitly read the file before performing the matching task.

Current skill:

- `numberdroid-artist/SKILL.md` — visual asset generation, deterministic geometry guides, controlled image edits, QA, extraction and integration.

When an agent environment supports project-level skills, configure it to expose this skill for Numberdroid art-production tasks. When it does not, add an explicit instruction to read the skill before beginning visual asset work.
