# Checkpoint 1A protected evidence

This directory freezes the accepted Checkpoint 1A demo ledger before the 1B persistence and MCP cutover.

- `json-ledger/` freezes the accepted revision-5 visual demo flow.
- `rev6-json/` freezes the same ledger after idempotent retry, rejected stale write, grant revocation, rejected post-revocation write, and restart; it is the immutable migration input.
- `expected-behavior.json` makes those protected control outcomes executable.
- `source-manifest.json` records byte digests, aggregate IDs, revision/activity order, and projection hashes.
- `parity-report.json` is the stable subset of a verified copy-and-verify JSON-to-SQLite migration.
- `acceptance-manifest.json` binds the fixture to the accepted commit and expected visible counts.

Run `npm run evidence:verify` from the Studio root. The verifier migrates the protected ledger into a fresh temporary SQLite destination and compares every stable evidence field. It never writes into this directory and never performs cutover.

Representative browser screenshots are produced reproducibly by the visual CI job. The user accepted the 1B result, and `acceptance-manifest.json` records its exact implementation commit, workflow run, artifact identity/digest, viewports, and retention limit. The 26 screenshot bytes remain in a retention-limited Actions artifact and were not committed as permanent goldens. Publishing permanent screenshot binaries is a separate task subject to the repository binary transport rules.
