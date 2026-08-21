# Checkpoint 1B status — 2026-08-21

This record preserves the current implementation and review state before the user visual checkpoint. The protected 1A baseline is commit `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`.

## Implemented candidate

- SQLite WAL ledger with migrations, restart-safe Header-operation idempotency, backup/restore, integrity checks, and resumable copy-and-verify JSON migration.
- SHA-256 CAS with upload limits, digest/metadata validation, project references, corruption/missing detection, backup/restore, and retention-delayed GC.
- Official MCP 2026-07-28 stdio adapter with private loopback host pairing; raw HostBinding tokens never enter browser responses or persistent storage.
- Header pull-down separates effective grant posture from pending/authorized host state. Off revokes every active grant and HostBinding; grant rotation never rebinds an old token.
- Asset Library cards always show a bounded small preview or an accessible fallback. A crop never displays the whole source atlas as if it were the tile; it remains `PROCESSING` until a real crop preview exists.
- Local UI mutations, including demo actions, require loopback same-origin plus the current CSRF token. The service refuses non-loopback listeners.
- The protected 1A ledger, digest/source manifest, and normalized JSON-to-SQLite parity report are committed under `fixtures/checkpoint-1a/`; `npm run evidence:verify` recreates the migration in a fresh destination and compares the complete stable evidence projection.
- PNG ingestion validates chunk structure, CRCs, image parameters, bounded decompression, row filters, and terminal chunks before CAS publication; WebP validates the complete RIFF/chunk envelope. Header-shaped or truncated files are rejected without residue.

## Explicitly deferred and fail-closed

- `Propose in draft` remains visible but unavailable until isolated revision branch heads exist. It does not mint write authority in 1B.
- `Custom…` remains visible but unavailable until the detailed human-only grant editor exists.
- Animation, atlas cutting, semantic asset batch editing, room design, level composition, NPC/enemy design, and publish remain later checkpoints.

## Review fixes incorporated

- concrete capability/time/budget comparison replaces coarse mode-rank broadening;
- multiple-active-grant fallback on Off is removed;
- pairing disconnects compensate and revoke any undelivered binding;
- pairing shutdown closes waiting sockets instead of waiting for TTL;
- MCP source registration requires an already uploaded live project-scoped CAS object with matching verified metadata;
- agent reads redact legacy external/file artifact locations;
- popover overflow, keyboard dismissal/focus return, host-count visibility, list labels/empty states, long labels, and stacking are covered.
- official MCP coverage now exercises malformed input, oversized payloads, cancellation propagation to the local HTTP request, structured service-unavailable errors, revocation, unbound tokens, and secret redaction; dependency-backed execution remains a CI gate.
- the terminal adapter independently redacts application errors and emits only a stable generic diagnostic for malformed stdio frames; a cancellation-aware wrapper around the official stdio transport aborts the same request-scoped signal even if cancellation delivery races SDK dispatch.
- parity evidence derives its CAS manifest from verified digest-addressed files rather than only database rows, so unreferenced live blobs cannot disappear from the evidence projection.

## Verification gate

The candidate is not user-accepted and the draft PR must not merge. The protected fixture/parity and locally executable persistence/UI suites are verified. Before asking for approval: run official-dependency CI, deterministic browser screenshots at representative viewports, independent security/architecture rereview, and root diff verification.

The browser evidence is a review input, not a decorative artifact. CI must capture every protected 1A workspace and every 1B candidate workspace at both 1440×900 and the supported minimum 1060×900 viewport, plus the open Header policy popover at both widths. The candidate page publishes a test-only readiness projection after API data, previews, and two animation frames settle. Chrome DevTools then checks readiness, console/network errors, overflow, Header overlap, preview/card geometry, image load, fallback association, and popover containment in the same page session before taking its screenshot and DOM record. CI independently compares the protected baseline and candidate live project/activity/access APIs with their fixtures and binds READY/PROCESSING to the exact expected Asset IDs. Fixed fixture bytes, fixed Studio time, UTC locale settings, a pinned Node runtime, and the recorded browser/protocol version keep the evidence explainable and repeatable; the user remains the visual acceptance authority.
