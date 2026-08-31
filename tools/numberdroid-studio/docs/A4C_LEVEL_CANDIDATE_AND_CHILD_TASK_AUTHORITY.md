# A4c Level Candidate and Derived Child-Task Authority

Status: **user-approved implementation boundary — 2026-08-31; Domain
foundation source-integrated and automated green, executable A4c workflow not
implemented and not user accepted**

This document records the two narrow A4c authority decisions Klaus approved on
2026-08-31. It is an additive forward contract. It does not rewrite the
user-accepted Checkpoint 4 compatibility surface and it is not acceptance of
A4c.

## 1. Human-rooted derived child tasks

Every authority chain begins with an active human-created root task and root
grant. An agent may request creation of an isolated child task only through the
trusted service and only from its current active parent task and grant. The
service, not the agent, derives the child task, non-main branch, and immutable
child grant atomically.

For the first bounded implementation slice:

- project and actor remain identical to the parent;
- the child branch starts at the exact parent-branch head;
- capabilities and object scopes are equal to or narrower than the parent;
- command, job, artifact-byte, and cost budgets are atomically reserved from
  the parent's remaining budget and cannot increase aggregate authority;
- expiry is no later than the parent, automatic acceptance is disabled, and the
  child does not receive child-creation authority;
- every child operation rechecks the complete ancestor chain;
- parent pause or review state denies further child mutation, while parent
  cancellation, rejection, merge, expiry, or grant revocation makes every
  descendant non-executable;
- creation is idempotent, durable, restart-safe, fully audited, and fails
  without a partial task, branch, grant, or budget reservation.

An agent cannot create a root task, select another actor/project/root grant,
target `main`, widen or renew authority, call `grant.issue` or `grant.manage`,
or acquire owner review, merge, recovery, materialization, repository-write,
publication, or release authority. A future cross-actor delegation design would
require a separate owner decision; it is not implied here.

## 2. Private `level.candidate.create`

A4c may add the separately typed private application command/scope
`level.candidate.create`. Trusted owner-side task setup may provision it, and a
derived child may receive it only when the parent already has it. It authorizes
exactly one task-bound immutable candidate through:

`Create → Validate → Compile → Preview → Diff → Submit`

Successful submission must atomically leave the task and effective state
`IN_REVIEW`, create an `OPEN` review whose complete item set remains `PENDING`,
append `REVIEW_SUBMITTED`, retain the exact branch head, and present
**Waiting for your review**. It grants no automatic acceptance, review
decision, merge, main-branch append, destination selection, filesystem or
repository write, materialization, publication, or release.

The scope remains absent from all current MCP tool/resource discovery and from
the accepted compatibility catalogs. It changes neither 19/4 nor 30/5 nor the
separately selected A1.6b2b 31/6 counts. This is private application authority,
not Remote MCP, Pairing, HostBinding, browser, public, or Funnel authority.

## 3. Current implementation truth

The remote recovery checkpoint `codex/a4c-candidate-path` at
`e16ce729f4237ca6eaf27233f550dbf204aa30f8` (tree
`640efa3d866535443759cfea85c4900c67491f8e`) is **INCOMPLETE / UNVERIFIED**:
it had no PR or Actions run and contained only an untested Domain draft plus
exports. It is provenance, not a merge-ready implementation.

The independently reviewed replacement foundation was integrated through PR
#186 at final head `c70019e5d510dcc06d2593b0258bd1970a0e2a6d` and tree
`bb95ef32b44f93eee48f756b333b5ad048b83789`. Build #2279 / run
`33365246228` passed the selected Studio Linux/browser and Windows gates plus
the final CI gate. Merge `93187bfd039e00147ce930a937ff0801c09c9784`
passed post-merge Build #2280 / run `33368143760` with the same selected gates.
The foundation defines deterministic, restart-portable candidate payload,
preview, semantic/output diff, and submission DTOs. It binds complete
text-output bytes and hashes, requires `artifacts=[]` in schema v1, rejects
unsafe paths and hostile/non-plain input, and fixes review/merge/materialize/
commit/publish/release authority at `NOT_AUTHORIZED`.

That foundation performs no I/O and creates no Task, Grant, Review, branch
revision, MCP surface, EngineBridge invocation, or candidate. It does not prove
the executable A4c path. Its portable EngineBridge receipt still has to be
checked by the Application layer against the actually configured bridge and
candidate selection.

## 4. Executable A4c definition of done

The next implementation must use the actual
`src/levelgen/specs/a4bReference.ts` `A4B_REFERENCE_LEVEL_SPEC`, Numberdroid
profile-v3 fingerprint
`6079209041cb71a3e7c8b36ea41796c2e38ea6ef828bf78829e8f0dc4ea3f074`, and
compiler pin
`numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1`.
It must:

1. run the real A4a projection, A3a validation, Numberdroid adapter/compiler,
   and validate-only EngineBridge path;
2. preserve one immutable LevelSpec-derived branch source and byte/hash-bound
   output closure with deterministic preview and semantic diff;
3. bind project, task, grant, actor, branch, base revision, exact current branch
   head, capability profile, compiler pins, candidate, receipt, and review
   submission as one fail-closed closure;
4. keep the A4c create-path semantic changes `ADD`-only;
5. make submit durable, idempotent, restart-safe, lost-response-safe, and
   atomic with task/review/timeline state while leaving `main` unchanged; and
6. prove tamper, blocked compiler/profile/bridge, stale head, cross-task,
   paused/expired/revoked authority, replay, fault, and no-partial-review cases.

Candidate implementation and derived-child implementation are separate risk
axes and should use separate L3 slices. The Level Candidate path comes first;
derived children are authorized but are not its prerequisite.

## 5. Unchanged exclusions

This decision adds or activates none of the following:

- remote backup metadata or operations;
- Remote MCP, Pairing, HostBinding, public/Funnel exposure, or agent onboarding;
- deletion, retention/cleanup, or restore activation/cutover;
- O3, O4, A5, or A6;
- production materialization, repository publication, or release.

Source-code PR integration separately authorized by Klaus is repository
maintenance; it is not product candidate repository-write authority. Compiler
success, CI, screenshots, and source integration never establish user
acceptance.
