# Future Harness Architecture Discussion

Status: **deferred architecture discussion — not implemented, authorized, exposed, or accepted**

Date: 2026-09-01

## Purpose

Numberdroid Studio already persists task-local work, review decisions, authority
state, and audit history. The current A1.7 visual fixture proves that a human can
inspect a task-local processed-asset draft, request changes, and keep that draft
out of the project. It does **not** run a continuously connected agent or deliver
the review decision to an agent harness.

A future integration with Context Studio should close that loop. This document
records the intended direction so the current UI and task model do not pretend
that changing a Studio status alone wakes an agent.

This is a discussion document, not a protocol contract. It adds no MCP tool,
server route, scheduler, remote authority, pairing behavior, HostBinding,
repository authority, or product capability.

## Product direction

The preferred future workflow is:

1. an authorized agent or harness reads a task and its exact current state;
2. the agent creates or updates task-local candidate work through the narrow
   authority already granted to that task;
3. Numberdroid Studio persists the result, immutable evidence, and review state;
4. the human reviews in Studio or discusses the result with the agent in the
   Context Studio conversation;
5. human feedback is persisted against the exact candidate/review version;
6. the harness observes that agent action is required and starts or resumes a
   bounded agent run;
7. the next result is submitted as a new immutable version for human review.

The agent need not remain alive while the human reviews. Durable task state is
the synchronization boundary; the future harness decides when to poll, subscribe,
or start another run.

## Conversation and Studio are two views of one task

A human should be able to act from either surface without creating competing
truths:

- **Numberdroid Studio UI:** inspect visual and technical evidence, decide review
  items, add feedback, pause/resume/cancel within owner authority.
- **Context Studio conversation:** tell the agent what is wrong in natural
  language, inspect the proposed interpretation, and authorize the harness to
  record the corresponding task feedback or state transition.
- **Harness cards:** show every relevant MCP read, command, result, denial,
  retry, review response, and state transition in the conversation.

Both surfaces must use the same persisted task/review state and optimistic
revision coordinates. Conversation text by itself is not task state. Before a
conversation request changes a task, the harness must show what it intends to
write and execute an authorized Studio operation whose result is durably
recorded.

## Proposed harness responsibilities

Context Studio or another trusted harness would own:

- binding a conversation and agent run to the exact Studio project, task, actor,
  grant, branch, base revision, and current head;
- discovering actionable tasks or reading a known task on a bounded schedule;
- starting a new agent run when the persisted state requires agent action;
- passing the exact candidate version, review decisions, human feedback,
  findings, remaining budget, and authority expiry into that run;
- presenting human-readable visual cards for every MCP tool call and response;
- preserving correlation IDs, idempotency keys, timestamps, retries, and final
  outcomes;
- distinguishing a still-running operation from a lost response;
- never translating conversation intent directly into broader authority;
- stopping clearly when authority, task state, ancestry, budget, or evidence is
  no longer valid.

The harness is orchestration infrastructure. Numberdroid Studio remains the
authority for its task state, application rules, persistence, and validation.

## Proposed Studio task access

A future private, authenticated task surface may allow an authorized agent to
read and change task state. Exact names and schemas remain open, but the
capability families would be:

### Read

- read the exact task, effective state, actor, project, branch, base, and head;
- read current grant/capability/object scope, expiry, pause/revocation state, and
  remaining budget;
- read candidate versions, previews, diffs, findings, review items, decisions,
  human feedback, and activity history;
- list only tasks actionable by the bound actor, or resolve one already-known
  task ID.

### Change

- create or update task-local work when explicitly authorized;
- submit an immutable candidate version for review;
- acknowledge and act on requested changes;
- attach structured or prose feedback to the exact review/candidate version;
- pause, resume, or cancel only where the caller's effective authority permits;
- record a review decision only when the caller represents the authorized human
  principal or an explicitly authorized human-directed action.

An agent may therefore update a task when the human tells it directly in the
conversation what is wrong. The harness must still translate that request into
an explicit, visible, authorized Studio command. It may not impersonate the
human merely because the statement appeared in chat.

## Feedback model

A bare `CHANGES_REQUESTED` status is insufficient. Feedback should support:

- a required human-readable summary;
- optional comments per review item;
- references to the exact candidate version and evidence being discussed;
- optional spatial or asset references when the UI can identify them;
- author principal, origin surface, correlation ID, and timestamp;
- immutable history with a new amendment rather than silent replacement.

The next agent run should receive both the prose and the structured review
context. Prose remains important because humans explain intent and visual
problems naturally; structured fields provide deterministic coordinates.

## Suggested state/event shape

The exact state machine remains owned by current Studio contracts. A future
harness should consume durable events such as:

- candidate submitted for review;
- human review saved;
- changes requested;
- agent action authorized;
- agent work resumed or paused;
- new candidate revision submitted;
- task completed, ended, expired, revoked, or conflicted.

Events are wake-up hints, not authority. On every operation the Studio must
re-read and validate current task, actor, grant, branch, base, head, review
version, ancestry where applicable, and idempotency coordinates.

## Delivery options

The initial integration should prefer the simplest reliable mechanism:

1. **Known-task read or bounded polling:** easiest to implement and recover.
2. **Actionable-task query plus scheduler:** useful for unattended bounded runs.
3. **Event subscription/webhook:** lower latency, but only after authentication,
   delivery, replay, ordering, and operational ownership are explicit.

A webhook or notification must never carry enough trust to authorize the
operation by itself. The harness uses it to wake, then resolves fresh Studio
truth.

## Concurrency, replay, and recovery requirements

Any later implementation must define and prove:

- exact expected task/review/head revision on every mutation;
- optimistic rejection of stale conversation cards or stale agent runs;
- one durable result per idempotency key;
- same-key/same-payload replay returning the original result;
- same-key/different-payload collision failing closed;
- atomic state transition, activity record, budget charge, and candidate write;
- recovery after Studio restart, harness restart, timeout, and lost response;
- deterministic ordering or explicit conflict when UI and conversation act
  concurrently;
- no duplicate agent run after repeated event delivery.

## Security and authority boundaries

This future direction does not change current boundaries:

- task access is private and authenticated;
- every operation is task-, actor-, project-, capability-, and object-scoped;
- the Studio validates current authority rather than trusting harness claims;
- the harness receives no general repository, merge, materialization,
  publication, deployment, backup, restore, deletion, or release authority;
- review acceptance remains an explicit human-owner action unless a later,
  separately approved contract says otherwise;
- an agent cannot broaden its own grant, change principal, escape its branch, or
  manufacture a human decision;
- public MCP discovery, remote/browser-agent authority, and always-on remote
  mutation are not authorized by this document;
- credentials, raw secrets, and unrestricted tool payloads do not appear on
  user-facing cards or in audit prose.

The private A4c `level.candidate.create` boundary remains unchanged and must not
become publicly discoverable through this discussion.

## User-facing harness cards

Context Studio can make the loop understandable by rendering one chronological
card per meaningful operation. A card should show:

- plain-language intent;
- Studio project/task and candidate version;
- tool/capability name and bound actor;
- requested state transition or data change;
- success, denial, retry, conflict, or uncertain/lost-response status;
- concise input/output summary with expandable technical evidence;
- what happens next and who must act;
- links or navigation targets back to the relevant Studio review.

Cards are an observability and consent surface, not proof of acceptance. The
durable Studio record remains authoritative.

## Current A1.7 implication

The current A1.7 fixture should be understood as a state-machine and UI proof,
not a live orchestration proof. Until a harness exists:

- `Let agent continue` only records that continued work is permitted;
- no real agent is automatically started;
- `Request changes` cannot cause a corrected image by itself;
- the product should not imply that an agent has received or acted on feedback.

The UI should eventually distinguish clearly between:

- **Changes requested — agent blocked**
- **Agent continuation authorized — waiting for harness**
- **Agent run active**
- **New revision submitted — waiting for your review**

## Deferred decisions

Revisit with Context Studio integration:

- polling cadence versus event delivery;
- exact private MCP operations and schemas;
- how a conversation is bound to a Studio principal and task;
- human confirmation rules for conversation-originated mutations;
- card payload/redaction and retention policy;
- scheduler ownership and run admission;
- offline/remote topology and authentication;
- whether Studio or Context Studio owns notification delivery;
- UI treatment for feedback threads and multiple candidate revisions.

## Re-entry criteria

Implementation planning begins only when:

1. a concrete Context Studio harness integration is available;
2. the caller identity and authorization model are defined;
3. the current Studio task/review contracts have been re-read from the actual
   implementation state;
4. transport, persistence, idempotency, restart, and cross-principal abuse tests
   are scoped as an L3 change;
5. the user explicitly authorizes the private integration surface.

Until then, retain this as a future architecture discussion and continue to
describe current fixtures truthfully as simulated workflows.
