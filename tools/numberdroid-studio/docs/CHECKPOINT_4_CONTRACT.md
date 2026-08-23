# Checkpoint 4 Contract — Delegated Task Branches and Human Review

Status: implementation candidate; not user-accepted, merged, released, exported, or published.

## Outcome

Checkpoint 4 lets a human owner delegate a bounded authoring task to an agent, follow its durable activity, interrupt it, review the isolated result, and explicitly merge or reject selected semantic changes. Agent work never mutates `branch.main` directly.

## Included

- A human-only task composer with project/object scope, capabilities, command/job/artifact/cost budgets, expiry, agent identity, branch identity, and an optional explicit low-risk auto-accept policy.
- One immutable base revision and one compare-and-swap branch head per task.
- Concurrent task branches with durable commands, progress events, pause, resume, cancel, authority revocation, and retry-safe idempotency.
- Review candidates made from branch revisions, semantic object conflict findings, per-change accept/reject/request-changes decisions, and truthful `AUTO_ACCEPTED_BY_POLICY` dispositions.
- A validated merge simulation followed by one atomic main-branch revision batch. A failed simulation or persistence fault leaves `branch.main` unchanged.
- Revert as a new compensating semantic operation. History is never deleted or rewritten.
- MCP and human UI access to task submission, branch reads, progress, controls, comparison, review, merge, and revert.
- Agent access to the already implemented V1 authoring path only while a matching task branch and active grant exist. Human-only lifecycle and release gates remain human-only.

## Excluded

- Numberdroid runtime materialization or export.
- Room, asset, or project publication.
- Provider-backed generation.
- Branch-local bitmap jobs or reuse of the main-revision-bound v8 job ledger as if it were isolated branch state.
- Level, enemy, NPC, route, quest, or gameplay-rule authoring.
- Automatic finalization, automatic publication, or treating policy decisions as human approval.
- Portable-bundle transfer of live grants, host bindings, task branches, reviews, jobs, or other operational authority.

## Authority invariants

1. A task is bound to exactly one project, agent, branch, base revision, capability set, object scope, budget, expiry, and issuer.
2. Agent commands require matching trusted project/task/branch/grant context. Authority fields in command payloads remain forbidden.
3. `PAUSED`, `CANCELLED`, `REJECTED`, `MERGED`, expired, or revoked tasks fail closed before a branch command is applied.
4. Finalization, export, materialization, and publish capabilities cannot be delegated in Checkpoint 4.
5. Auto-accept is disabled by default, uses a human-authored command-type allowlist, cannot include lifecycle/authority/release commands, and records `AUTO_ACCEPTED_BY_POLICY`, never `USER_ACCEPTED` or `USER_APPROVED`.

## Revision and merge invariants

1. Task branches are created from an immutable main revision and retain that base snapshot.
2. Branch appends use compare-and-swap against the branch head; command IDs and idempotency keys are unique per branch.
3. Review comparison uses semantic `(entityType, entityId)` change keys. A main change after the task base that touches the same key is an explicit conflict.
4. Merge replays accepted branch commands in order against the current main head in a disposable simulation before any authoritative write.
5. The accepted replay batch is committed atomically. The merge record identifies both the main parent and branch parent lineage.
6. Revert creates new compensating revisions and a durable revert record; it never deletes task, review, merge, event, or project history.

## Checkpoint scenario

1. Compose an atlas-to-DRAFT-room task without room finalization, export, or publish authority.
2. Pair an MCP host to the task grant and author on the isolated branch.
3. Follow the task timeline, pause between branch-safe command stages, observe fail-closed denial, resume, and retry safely. Existing main-bound atlas jobs retain their separate Checkpoint 2B cooperative controls.
4. Run a second branch concurrently and surface an explicit overlapping-object conflict.
5. Submit the first result, compare it with current main, accept selected changes, and atomically merge them.
6. Revert that merge through a new compensating operation and verify all original history remains inspectable.

## Exit gate

The candidate may be offered for the combined Checkpoint 2C + 3 + 4 user review only when domain, application, SQLite fault/race, HTTP/MCP, responsive UI, adversarial permission, and browser evidence are green at one exact remote commit. User acceptance remains separate from CI success and from merge/release authority.
