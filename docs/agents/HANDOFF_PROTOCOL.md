# Numberdroid — Handoff Protocol

Status: **binding handoff format and cross-role transition contract**

## Purpose

A handoff lets a new agent/session continue efficiently without relying on invisible chat history. It must be self-explanatory, role-aware and precise, while remaining subordinate to current repository authority.

Handoffs live under:

`docs/history/handoffs/`

They are historical/task snapshots by repository taxonomy. A handoff becomes actionable when the user/current task explicitly points a receiver to it.

## Core rule: self-contained snapshot, not source of truth

A handoff records:

- what was true when it was written;
- what was completed/accepted;
- why important choices were made;
- what the next task is;
- which current files own the durable rules.

A receiving agent must still verify current `main`, Actions and current binding contracts. If the handoff conflicts with newer current code/docs, the newer current source wins and the conflict must be reported.

## Naming

Preferred dated form:

`HANDOFF_YYYY-MM-DD_<MILESTONE_OR_NEXT_TASK>.md`

Do not overwrite older handoffs to pretend history did not happen.

## Required header

Every substantial handoff starts with:

```text
DATE
REPOSITORY
STATUS
BASELINE MAIN HEAD AT CREATION
BASELINE CI / PAGES STATE
PRIMARY RECEIVING ROLE
SECONDARY / TRIGGER ROLES
NEXT MILESTONE / TASK
```

If the handoff itself is merged later, make clear that the recorded HEAD is the pre-handoff baseline and the receiver must resolve the new current `main`.

## Required reading block

Every handoff must explicitly state:

1. universal bootstrap from `AGENTS.md`;
2. primary role route from `ROLE_ENTRYPOINTS.md`;
3. exact domain documents needed for this task;
4. which large domains are **not** mandatory initially;
5. trigger conditions that would make them mandatory later.

This prevents both context starvation and context flooding.

## Required state block

Record separately:

### Accepted / frozen

Items that must not be casually reopened. Include visual/user acceptance where relevant, not merely merged code.

### Implemented but not accepted

Items that exist technically but still require visual/gameplay/user QA.

### Planned / not implemented

Do not blur roadmap into implementation.

### Open decisions

State the decision and its owner: User/Art Director, Artist, Game Designer, Narrative, Engineer, etc.

## Required technical block

For relevant work include exact:

- runtime paths;
- recipe/source paths;
- atlas/grid/frame dimensions;
- map/GID/layer usage;
- collision/interaction constraints;
- build/materialization scripts;
- test/validator commands;
- live preview URL;
- important current numerical constants;
- known technical debt that must not be mistaken for the next task.

## Required process-learning block

Record only reusable lessons that materially affect the next task. Prefer links to durable method/tool/research docs; summarize the important consequences.

Examples for art:

- image-generation turn boundary;
- QA is no-generation;
- model vs deterministic authority split;
- known failed method classes that should not be repeated without new evidence;
- alpha/seam/topology validation requirements.

Do not dump every conversation detail into the handoff.

## Required next-action block

The receiver should not have to infer what “continue” means.

Specify:

- first inspection step;
- first bounded production/design block;
- what must be proposed before implementation/generation;
- what may be changed;
- what must not be changed;
- exact definition of done;
- when user/live QA is required.

When appropriate, include a recommended sequence rather than one enormous task.

## Cross-role handoff block

When one role hands to another, state:

- why the receiving role is now primary;
- what the previous role already resolved;
- what information the receiver needs from the previous domain;
- which decisions remain owned by another role;
- exact triggers for bringing that role back in.

Example:

> Artist produces a generic family table without reading the whole story. If a child drawing must depict a canonical event/person, Narrative becomes a trigger role before that drawing is authored.

## Handoff freshness and lifecycle

A handoff should be written at a clean milestone boundary, especially after a category/feature has been accepted and frozen or before the primary role changes.

An ordinary candidate PR or merge is not by itself a full-handoff trigger. Use
compact current status/decision/backlog updates between milestones. Create a
new full handoff only for a clean milestone, a real session or primary-role
transition, or when all useful authorized lanes are stopped.

After a receiver completes the next milestone:

- update current durable contracts/recipes;
- write a new handoff if another session/role transition is useful;
- leave the old handoff in history;
- do not keep editing an old handoff into a pseudo-current roadmap.

Current forward planning belongs in `docs/planning/`, not in the growing handoff history.

## Required final receiver instruction

End a substantial handoff with a concrete launch protocol, normally:

1. verify `main` + Actions;
2. read universal bootstrap;
3. read the listed role/task bundle;
4. inspect actual current source/code/runtime context;
5. summarize understanding and identify any authority conflict;
6. propose the first bounded block;
7. do not cross a user/art-direction/design gate until that gate is satisfied.

For an already-approved implementation task, the handoff may authorize direct implementation after steps 1–5. For new visual generation or unresolved design, proposal/QA gates remain mandatory.
