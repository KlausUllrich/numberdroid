# Task review feedback and continuation

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**. Date: 2026-09-06.
Focused checks, native Chrome evidence and the full local Studio regression
have passed. Final CI/source integration are recorded in the focused PR; this
record does not claim user acceptance.

## Product promise

The existing human-owner review can record useful correction instructions for
one exact task result. Request Changes requires a nonblank summary of at most
4,000 characters. Optional comments per review item use the existing `reason`
field, at most 2,000 characters. Accept and Reject remain explicit dispositions;
feedback alone accepts nothing and changes no project content.

An OPEN, non-conflicting editable review follows **Current step** and any
**Processed asset draft** preview, before task facts and progress history.
Conflict reviews retain their conflict-first placement. The summary and comments
remain visible in the saved review. Superseded reviews are read-only history,
including after continuation is allowed, paused, or blocked by an ancestor;
terminal and expired-task explanations keep their own meaning.

**Let agent continue** permits further work under the existing task authority.
It does not start an agent or prove that an agent received the feedback. ACTIVE
is presented as **Agent work allowed**; its timeline records **Agent continuation
authorized**. A new result must be submitted for a new current review.

## Exact review and compatibility

The existing owner-only review-decision POST accepts `decisions`, `confirm: true`,
`expectedReviewVersion`, and `feedbackSummary`. The route identifies the project,
task and review. The browser always sends the rendered review version and omits
an empty summary for ordinary Accept/Reject decisions.

- Request Changes requires both a nonblank summary and an expected review
  version. Supplying new feedback also requires an expected version.
- Legacy Accept/Reject submissions without feedback retain their compatible
  optional-field behavior. If an expected version is supplied, it must match.
- The SQLite transaction compares the expected version before appending the
  next immutable review version, feedback, task transition and timeline event.
  A stale review cannot overwrite newer decisions or feedback.
- `review.feedback` contains `schemaVersion: 1`, `summary`,
  `basisReviewVersion`, `authorId`, and `createdAt`. The basis identifies the
  reviewed version; author and time come from trusted service context.
- Per-item reasons remain associated with their exact immutable review items.
  Historical reviews without feedback remain valid. Existing review JSON
  version storage is used; no SQL migration or historical rewrite is added.
- Unknown delivery is not an idempotent-replay promise. Reload the current
  review and inspect the saved result before another write. Do not assume a
  failed browser response means that no decision was committed.

Unfinished summary, comments, choices, focus, selection and scroll are retained
only while the exact rendered task/review version remains compatible. A newer
review version shows current server state instead of transplanting a stale
feedback draft onto another result.

## Authority and proof

The existing human-owner, confirmation and same-origin/CSRF boundaries remain.
Policy dispositions remain immutable. A4c Candidate and derived-child decisions
remain restricted; this change adds no agent review authority. The A1.7
processing-adoption panel remains read-only and gains no compatible Main merge,
metadata correction, warning acceptance or processing operation.

No MCP catalog, grant scope, capability profile, public route, provider,
scheduler, network integration, agent harness, materialization or publishing
capability is added. Existing MCP counts remain 19/four, task 30/five and
explicit Authoring-v2 31/six. The future harness discussion remains a separate,
unimplemented direction.

The initial 41 focused checks, subsequent edge-case/UI checks, and native Chrome
capture at 1440×900 and 1060×900 passed. Browser evidence includes required
feedback, exact-version draft retention and stale-draft rejection, persisted
summary/comments, continuation and paused-history truth, and a filled-form
screenshot plus the final history screenshot. Full local Studio regression
passed with 778 tests, four expected platform skips and no failures. Final
source/PR/Actions identities belong in the focused PR record.
The deferred human test is [VT-016](VACATION_TEST_BACKLOG.md#vt-016--task-review-feedback-and-truthful-continuation).
VT-001 and VT-011 acceptance remain open.
