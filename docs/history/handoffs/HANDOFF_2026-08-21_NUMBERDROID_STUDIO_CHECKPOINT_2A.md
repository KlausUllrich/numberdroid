# Handoff — Numberdroid Studio Checkpoint 2A Candidate

- **Date:** 2026-08-21
- **Status:** candidate awaiting explicit user acceptance
- **Branch:** `agent/numberdroid-studio-foundation`
- **Draft PR:** `#135`
- **Next allowed work:** verification fixes and documentation reconciliation only; Checkpoint 2B remains blocked
- **Authoritative candidate record:** `tools/numberdroid-studio/docs/CHECKPOINT_2A_STATUS.md`

## Receiving instruction

Do not infer acceptance from green tests, CI, elapsed time, or silence. Do not merge, mark the PR ready, invoke a provider, add atlas cutting, or start 2B until the user explicitly accepts this major gate.

Before changing the candidate, read the root repository instructions and all current Studio contracts in the order recorded by the original Checkpoint 2 handoff. Re-verify current `main`, PR head, Actions state, migration checksum, protected manifest, and fixture identity. Current code and contracts outrank this handoff.

## Frozen candidate boundary

Implemented:

- 16 MiB / 4096×4096 loopback PNG/WebP source intake into project-scoped CAS;
- durable staged intake with idempotent claim, Resume, and Discard;
- V2 human-upload/imported-generation provenance, bounded parameters, parent/source-lineage validation;
- atomic source revision/reference/intake/grant-byte transaction;
- original CAS preview and explicit owner review lifecycle;
- schema v6 migration, integrity, backup, restore, and recovery coverage;
- audit-ready MCP intake commit and review proposal with seven-tool discovery;
- final-only redacted denied/failed bound-agent Activity audit;
- real Family Hygiene binary E2E and dedicated eight-screenshot real-Chrome CI evidence.

Not implemented or authorized:

- provider calls, credentials, egress, cost, or generation jobs;
- derivative thumbnails, image-processing jobs, atlas analysis/cutting, slices, recut remapping;
- asset metadata/batches/bundles, rooms, levels, adapter/export/materialize/publish;
- isolated task branches, proposal merge, or agent owner decisions.

## Stable identities

- baseline branch head before 2A: `a3231aeb6b93ee29455f5037824cd419d257b1d4`;
- accepted Studio implementation: `41fad464cd2f904666f7dfecc8437f2286c3254c`;
- protected Checkpoint 1A: `2a7ca9cdde0179c8605163ea1f96ba1e6bce1e7d`;
- protected manifest: `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- Family Hygiene source: SHA-256 `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`, 2,720,519 bytes, 1254×1254;
- migration 0006: SHA-256 `f7b785a60bf02cd0d03944d4bd5983a4845bd715bf2a8a88f9c3ddf8c5a419f5`.

## Gate protocol

1. Implementation/verifier/adversary/root checks must all pass against the same frozen diff.
2. Publish only to the existing draft branch with a non-forced update after checking remote-head drift.
3. Wait for GitHub Actions, including the dedicated eight-screenshot Checkpoint 2A Chrome artifact.
4. Give the user exact launch steps, scenario, evidence identities, known limits, and the four decisions in the candidate status record.
5. On rejection, turn findings into another 2A plan/implement/adversary/verify loop.
6. On acceptance, update the status to record the user's words, exact candidate/CI/evidence identities, then plan 2B through a fresh adversarial loop.
