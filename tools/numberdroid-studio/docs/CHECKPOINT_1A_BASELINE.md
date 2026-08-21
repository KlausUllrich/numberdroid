# Checkpoint 1A — Accepted Visual Baseline

Status: **visually accepted by the user on 2026-08-21** and preserved as the permanent regression contract after Checkpoint 1B acceptance. Visual screenshot bytes have the separate retention limitation documented below.

This historical baseline record distinguishes what was accepted in 1A from what remained development-only at that time. The visual shell, information hierarchy, observable command flow, and authority presentation were accepted. The JSON project store was not production persistence and the transport-neutral agent catalog was not a complete MCP server. Checkpoint 1B subsequently replaced those operational paths with accepted SQLite/CAS persistence and the official MCP transport; full Checkpoint 1 is now complete.

## Protected experience

Checkpoint 1B preserved, and later checkpoints MUST continue to preserve, these baseline characteristics:

- the Numberdroid Studio top bar with active-project selection and explicit demo/status actions;
- the ordered workspaces `Overview`, `Sources`, `Asset library`, `Rooms`, `Levels`, and `Activity`;
- the project hero with description, lifecycle state, and current revision;
- the persistent right-hand `Activity feed` and visible actor/task/revision attribution;
- overview visibility for counts, agent task authority, validation summary, and job state;
- the loopback/local-first status presentation;
- keyboard-reachable navigation and textual state independent of color;
- shared command behavior for human and host-injected agent calls.

Checkpoint 1B was allowed to add the explicitly approved Header Agent access selector and the Asset Library card preview/fallback. It did not use these additions to restructure navigation, remove the persistent activity context, change the accepted visual language broadly, or conceal revision/authority state. A broader later redesign requires its own user verification.

## Protected behavior fixture

The accepted demo flow is the regression scenario:

1. **Create / load demo** produces the expected project at revision 5 with five attributed activity entries, the narrow Atlas Agent task grant, validation summary, and empty 1A jobs state.
2. **Retry idempotently** returns the original revision 3 result without advancing the project head or activity count.
3. **Submit stale write** returns `REVISION_CONFLICT` while the project remains at revision 5.
4. **Revoke agent grant** creates one human-attributed revision 6 and exposes the revocation time.
5. **Try agent after revoke** returns `GRANT_REVOKED` without creating a source, revision, or activity entry.
6. Restarting against the same copied data directory preserves revision 6 and its audit history.

The immutable source-baseline record is commit `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`, which published this document before 1B implementation commits. The release/checkpoint record MUST retain that SHA together with fixture file digests, capture instructions, and the visual evidence run/digest/viewport record; a mutable branch name is not sufficient evidence. The current screenshot bytes are retention-limited Actions output, not permanent repository goldens.

## Regression evidence delivered for 1B cutover

The accepted 1B implementation produced one review bundle containing:

- immutable 1A source commit SHA;
- hashes of the protected JSON data/fixture files;
- project and aggregate IDs, head revision, event/activity ordering and counts;
- grant issuance/revocation projection and validation summary;
- semantic projection hash before migration and after SQLite import;
- screenshots of each baseline workspace at the agreed viewport plus the two approved additions;
- automated results for the six protected behavior steps;
- dependency-boundary and UI/MCP command-equivalence results;
- migration ID, destination schema version, database integrity result, and CAS manifest.

The accepted evidence gate was satisfied. Any future missing or non-reproducible item is a regression; it does not invalidate the historical 1A acceptance.

The machine-verifiable fixture evidence lives in `fixtures/checkpoint-1a/`. Its protected revision-6 migration source manifest hash is `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`; `npm run evidence:verify` must reproduce the six-step control flow and verified parity report without changing either frozen JSON ledger. The accepted 1B browser run delivered 26 representative screenshots at `1440×900` and `1060×900`; its durable evidence identity and the temporary artifact retention limit are recorded in `CHECKPOINT_1B_STATUS.md`.

## Migration and rollback protection

1. Stop the 1A writer before capture. Copy its entire JSON data directory to a dated protected location and write a digest manifest.
2. Import from that copy into a new SQLite/CAS destination. Migration never edits, deletes, or merges the source directory.
3. Verify IDs, ordering, revisions, activity, grants, validation, semantic projection hashes, and artifact references before switching the active-store pointer.
4. Keep the pointer on JSON when migration or parity verification fails. The staged destination and report remain available for diagnosis or safe retry.
5. After successful verification, stop the writer and switch one explicit active-store pointer. JSON and SQLite never serve as concurrent authoritative writers.
6. Retain the protected JSON baseline and stable machine-readable migration/evidence records permanently after 1B user acceptance. Operational database/CAS copies, logs, and screenshot artifacts follow their documented backup/retention policies and must not be called permanent unless actually published as protected evidence.
7. If 1B receives writes after cutover, create and verify a recovery bundle/down-export before any software rollback. Returning to the frozen JSON baseline must state the revision boundary and cannot silently discard newer work.

## Additive 1B visual contract

### Header Agent access

The header gains one compact, persistent control with these options:

- `Off` — no active agent mutation posture;
- `Read only` — project/task-scoped inspection only;
- `Propose in draft` — reserved and visibly unavailable in 1B until dry-run plus isolated draft-branch heads are real;
- `Execute scoped task` — only the task/branch/object/capability/budget/expiry returned by the service;
- `Custom…` — reserved and visibly unavailable in 1B until the human-only detailed task/grant editor exists.

The control renders `REQUESTING`, active mode, `EXPIRED`, `REVOKED`, `DENIED`, and `SERVICE_UNAVAILABLE` states textually. It exposes a concise effective-policy summary and warns before authority broadens. No `Full access` or `Publish` option exists. Client state never authorizes an MCP call; the trusted host/service independently validates the concrete grant each time.

### Asset Library preview

Every card reserves a small stable preview region. It shows an authorized artifact preview with transparency and aspect ratio preserved, or a distinct accessible fallback for `PROCESSING`, `MISSING`, `UNSUPPORTED`, or `LOAD_FAILED`. A fallback includes asset kind and textual state, never a local path, and leaves all semantic card actions usable.

## Visual decisions resolved by the 1B checkpoint

- The Header control is labelled **Agent access**; semantic `Execute scoped task` is rendered compactly as **Scoped run**.
- Effective-policy detail uses the accepted viewport-bounded anchored popover. The later `Custom…` editor may use the existing detailed workspace/panel pattern.
- Asset cards use the accepted square preview/checkerboard treatment with `contain`, or a distinct accessible fallback.

These accepted decisions remain the regression baseline. A later checkpoint may revisit them for a concrete defect or a deliberate new user checkpoint, not incidentally.
