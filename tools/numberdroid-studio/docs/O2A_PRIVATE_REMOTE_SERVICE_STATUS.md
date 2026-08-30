# O2a private remote service candidate status

Status: **IMPLEMENTED CANDIDATE — NOT DEPLOYED / NOT USER ACCEPTED**

O2a adds a distinct authenticated deployment adapter for one private,
Klaus-controlled Linux Studio host. It does not widen the accepted local
listener. The candidate presents the existing Studio through an HTTPS ingress
as an explicitly labelled read-only UI and keeps the authoritative SQLite/CAS
workspace and O1 operations runtime in one supervised process.

The bounded operator guide is
[`O2A_PRIVATE_REMOTE_SERVICE_RUNBOOK.md`](O2A_PRIVATE_REMOTE_SERVICE_RUNBOOK.md).
The current product sequence and exclusions remain authoritative in
[`OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`](OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md).

## Implemented boundary

- `apps/studio-remote` starts the existing Studio on an unadvertised ephemeral
  loopback port and starts a separate loopback gateway only after configuration,
  persistent storage, credentials, workspace writer ownership, O1 operations
  ownership, and upstream startup all succeed.
- Remote configuration v1 requires one canonical HTTPS public origin, an exact
  loopback listener and trusted proxy address, owner-only no-follow files, and
  existing owner-only mount roots with fixed identity markers. The workspace,
  operations control, every backup destination, and every restored-copy
  destination must each map to exactly one marked root. Missing, extra,
  overlapping, replaced, permissive, or symlinked state fails startup.
- The owner credential is a 256-bit generated token whose fixed-cost scrypt
  verifier is stored in an owner-only file. The raw token is shown once through
  the controlling terminal and is never accepted through argv, environment,
  URL, browser storage, upstream headers, projections, or normal logs.
- Login uses bounded per-client and global rate limits. Remote sessions use
  digest-only 256-bit server-side tokens, a `__Host-` Secure/HttpOnly/
  SameSite-Strict cookie, per-session CSRF, 15-minute idle and eight-hour
  absolute expiry, explicit rotation, logout, revoke-all, and restart
  invalidation.
- The gateway trusts exactly one loopback HTTPS terminator and requires one
  canonical `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For`
  value before authentication. Duplicate, joined, contradictory, direct-port,
  insecure, or malformed proof fails before any Studio byte is returned.
- A raw-target positive allowlist admits only the exact static UI and bounded
  project, activity, task, source-intake, asset, room, job, artifact, and
  processing-adoption reads. It validates canonical encoding and known query
  shapes before proxying. Unknown future routes remain unavailable.
- The shared browser client detects the authenticated remote session and enters
  a visible **Private remote · read only** mode. It does not request the local
  UI CSRF or Agent-access projection, hides Backups, supplies no mutation CSRF,
  and renders no MCP/HostBinding authority.
- The proxy strips cookies, Authorization and forwarding/identity headers,
  forwards only bounded content negotiation, refuses redirects, normalizes
  upstream failures, streams approved responses, and forces no-store and
  security headers.
- The workspace PID sentinel is replaced by a persistent rollback-journal
  SQLite sidecar held with a process-lifetime `BEGIN EXCLUSIVE` operating-system
  lock. The lock is acquired before opening or migrating the workspace DB and
  survives clean close as an identity file while kernel ownership is released.
  An exact exited legacy PID record is migrated once; malformed or ambiguous
  legacy state remains untouched and blocks startup.
- Required remote composition no longer degrades silently when the O1
  operations configuration, bootstrap, runtime, or lock is unavailable.
  Listener failure and graceful shutdown close intake and release upstream,
  operations, and workspace ownership in order.
- Setup CLIs create exclusive credential and mount-marker files and validate
  the complete configuration before the writer is opened.

## Hard exclusions

Even after successful owner login, O2a exposes none of the following:

- `/api/backups/**`, backup metadata, backup authority, restore-as-copy
  authority, deletion, retention, or cleanup automation;
- `/internal/mcp/**`, pairing, HostBinding, Agent-access authority, remote MCP,
  or any remote mutation;
- `/api/demo/**`, publication, materialization, release, activation/cutover, or
  restored-copy activation;
- Tailscale Funnel, public-internet exposure, multi-user/team identity, mobile
  completion, O3, or O4.

Restore-as-copy remains quarantined and inactive. The private-network ingress
is a transport boundary, not application authority; the owner credential is
still required.

## Verification

The candidate adds adversarial tests for exact configuration and permissions,
mount identity, credential hashing and setup, rate limits, cookie and CSRF
behavior, rotation/revocation/expiry, ingress spoofing, raw-target encoding,
query smuggling, positive route policy, header stripping, redirect refusal,
generic failures, read-only UI detection, required O1 startup, competing
writers, crash recovery, restart persistence, session invalidation, occupied
listener cleanup, and the unchanged local service boundary.

The integration gate is the full Ubuntu and Windows Studio suite with the
native SQLite dependency installed. CI evidence belongs in this record only
after the candidate head is published and the exact run completes; local
focused results are not substituted for that gate.

## Suggested return test

After a private host is deliberately configured from the runbook:

1. prove that the direct loopback gateway returns only generic health without
   trusted ingress headers and returns no Studio data;
2. open the exact tailnet HTTPS URL and verify that a wrong owner credential is
   rejected generically;
3. sign in, observe the read-only badge, and inspect projects, sources, assets,
   rooms, tasks, activity, and approved previews;
4. verify that Backups is absent, Agent access is disabled, and direct backup,
   MCP, demo, and POST requests remain unavailable;
5. rotate the current session, then log out and prove the former cookie is no
   longer usable;
6. restart the supervised process, sign in again, and prove project state
   persisted while the pre-restart session did not.

Observed behavior may be recorded as product evidence, but CI, this document,
or a source merge does not imply user acceptance or deployment approval.
