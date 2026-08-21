# Checkpoint 1A — Accepted Visual Baseline

Status: **visually accepted by the user on 2026-08-21** and protected during Checkpoint 1B.

This record distinguishes what was accepted from what remains development-only. The visual shell, information hierarchy, observable command flow, and authority presentation are accepted. The JSON project store is not production persistence, the transport-neutral agent catalog is not a complete MCP server, and full Checkpoint 1 is not complete until 1B is accepted.

## Protected experience

Checkpoint 1B MUST preserve these baseline characteristics:

- the Numberdroid Studio top bar with active-project selection and explicit demo/status actions;
- the ordered workspaces `Overview`, `Sources`, `Asset library`, `Rooms`, `Levels`, and `Activity`;
- the project hero with description, lifecycle state, and current revision;
- the persistent right-hand `Activity feed` and visible actor/task/revision attribution;
- overview visibility for counts, agent task authority, validation summary, and job state;
- the loopback/local-first status presentation;
- keyboard-reachable navigation and textual state independent of color;
- shared command behavior for human and host-injected agent calls.

Checkpoint 1B may add the explicitly approved Header Agent mode selector and the Asset Library card preview/fallback. It MUST NOT use these additions to restructure navigation, remove the persistent activity context, change the accepted visual language broadly, or conceal revision/authority state. A broader redesign requires its own user verification.

## Protected behavior fixture

The accepted demo flow is the regression scenario:

1. **Create / load demo** produces the expected project at revision 5 with five attributed activity entries, the narrow Atlas Agent task grant, validation summary, and empty 1A jobs state.
2. **Retry idempotently** returns the original revision 3 result without advancing the project head or activity count.
3. **Submit stale write** returns `REVISION_CONFLICT` while the project remains at revision 5.
4. **Revoke agent grant** creates one human-attributed revision 6 and exposes the revocation time.
5. **Try agent after revoke** returns `GRANT_REVOKED` without creating a source, revision, or activity entry.
6. Restarting against the same copied data directory preserves revision 6 and its audit history.

The immutable source-baseline record is commit `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`, which published this document before 1B implementation commits. The release/checkpoint record MUST retain that SHA together with fixture file digests and representative screenshots; a mutable branch name is not sufficient evidence.

## Required regression evidence before 1B cutover

The 1B implementation must produce one review bundle containing:

- immutable 1A source commit SHA;
- hashes of the protected JSON data/fixture files;
- project and aggregate IDs, head revision, event/activity ordering and counts;
- grant issuance/revocation projection and validation summary;
- semantic projection hash before migration and after SQLite import;
- screenshots of each baseline workspace at the agreed viewport plus the two approved additions;
- automated results for the six protected behavior steps;
- dependency-boundary and UI/MCP command-equivalence results;
- migration ID, destination schema version, database integrity result, and CAS manifest.

Missing evidence blocks 1B cutover; it does not invalidate the 1A acceptance.

## Migration and rollback protection

1. Stop the 1A writer before capture. Copy its entire JSON data directory to a dated protected location and write a digest manifest.
2. Import from that copy into a new SQLite/CAS destination. Migration never edits, deletes, or merges the source directory.
3. Verify IDs, ordering, revisions, activity, grants, validation, semantic projection hashes, and artifact references before switching the active-store pointer.
4. Keep the pointer on JSON when migration or parity verification fails. The staged destination and report remain available for diagnosis or safe retry.
5. After successful verification, stop the writer and switch one explicit active-store pointer. JSON and SQLite never serve as concurrent authoritative writers.
6. Retain the protected JSON baseline, SQLite database, CAS, logs, and migration report through 1B user acceptance and the documented retention window.
7. If 1B receives writes after cutover, create and verify a recovery bundle/down-export before any software rollback. Returning to the frozen JSON baseline must state the revision boundary and cannot silently discard newer work.

## Additive 1B visual contract

### Header Agent mode

The header gains one compact, persistent control with these options:

- `Off` — no active agent mutation posture;
- `Read only` — project/task-scoped inspection only;
- `Propose in draft` — dry-run and draft-branch proposal capabilities only;
- `Execute scoped task` — only the task/branch/object/capability/budget/expiry returned by the service;
- `Custom…` — opens the human-only detailed task/grant editor.

The control renders `REQUESTING`, active mode, `EXPIRED`, `REVOKED`, `DENIED`, and `SERVICE_UNAVAILABLE` states textually. It exposes a concise effective-policy summary and warns before authority broadens. No `Full access` or `Publish` option exists. Client state never authorizes an MCP call; the trusted host/service independently validates the concrete grant each time.

### Asset Library preview

Every card reserves a small stable preview region. It shows an authorized artifact preview with transparency and aspect ratio preserved, or a distinct accessible fallback for `PROCESSING`, `MISSING`, `UNSUPPORTED`, or `LOAD_FAILED`. A fallback includes asset kind and textual state, never a local path, and leaves all semantic card actions usable.

## Open visual decisions for the 1B checkpoint

- Final compact label/icon treatment for the Header Agent mode control.
- Whether the effective-policy detail opens as an anchored popover or a side panel. The recommended default is a popover for the summary with `Custom…` opening the existing detailed workspace/panel pattern.
- Exact preview-region size and checkerboard treatment. The recommended default is a square region large enough to distinguish a floor surface from a prop while keeping current card density, using `contain` rather than cropping.

The options, security semantics, inactive/error states, warnings, and existence of a preview/fallback are already binding; only these presentation details remain for user verification.
