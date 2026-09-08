# Studio CI browser execution

Status: **bounded CI reliability repair, 2026-09-08**.

## Promise

Keep browser evidence and upload gates reliable without changing product
behavior, rendering flags, expected pixels, authority checks or acceptance.
Repeated Linux jobs missed the old ten-second Chrome DevTools startup deadline.
DBus warnings were present, but do not establish DBus as the cause. A separate
run completed tests and capture, then artifact finalization failed with an
intermediary HTTP 403; that does not establish a product or grant defect.

## Browser startup and teardown

Allow at most 30 seconds for a new isolated Chrome process to expose DevTools.
Resolve only an actual endpoint, reject spawn failure/early process exit promptly,
and propagate cancellation immediately. Every settlement removes owned readiness
listeners and timers. Bound WebSocket opening separately and preserve existing
outer capture deadlines. Record startup elapsed time for future diagnosis.

Disable unrelated Chrome background networking and extensions, matching the
successful local verification harness. Page requests and all product assertions
remain enabled. Keep pixel/render flags and source/artifact identity unchanged.
Do not add whole-capture retry loops, DBus overrides, GPU/shared-memory changes,
or fallback success when the browser failed to start.

Keep the existing close-before-profile-removal contract: stop intake, interrupt
requests, close/terminate the owned browser, await process closure, then remove
its exact profile. Retain an uncertain profile and preserve the original failure.

## Evidence uploads

When capture succeeds, each required evidence upload runs independently of an
earlier upload's outcome. A failed upload still fails the selected CI gate;
`if-no-files-found: error` remains required. Use the standard GitHub artifact
action; do not invent a custom transport or mark upload failure as success.
A completed ephemeral runner cannot retry an individual lost upload step.
Retry only the affected job when justified by an external failure, preserving
already successful lanes. Repeated failure requires diagnosis, not blind retries.

Artifact names may repeat across run attempts. Record exact run/attempt/job and
artifact IDs/digests rather than selecting the newest matching name: a failed
capture can leave a tiny diagnostic archive beside complete earlier evidence.

## Selected verification

Exercise split/delayed readiness, spawn error, early exit, pre-aborted and mid-
startup cancellation, timeout and listener cleanup; retain teardown/cancellation
coverage and one real Chrome capture. Workflow condition changes select the
repository's full CI matrix. Pre-merge and post-merge exact-head checks remain
required, and neither CI nor artifact presence implies human acceptance.
