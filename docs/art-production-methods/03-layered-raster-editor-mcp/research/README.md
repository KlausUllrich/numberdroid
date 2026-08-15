# M3 Research Checklist

No layered raster editor integration is currently production-authoritative.

When evaluating Photoshop or a comparable editor/API/MCP, test the interface against the requirements in the parent README rather than evaluating only whether it can launch the application or execute a generic prompt.

## Minimal benchmark

Use one geometry-critical wall sample:

- one deterministic H_TOP mask;
- one material texture;
- one explicit connector side;
- one explicit exposed side.

The agent must be able to reproduce, without hidden manual steps:

1. create/import named layers;
2. apply material through the geometry mask;
3. apply an exposed-edge treatment while excluding the connector;
4. modify one local region without flattening unrelated layers;
5. export exact dimensions with alpha;
6. inspect enough state to prove the requested operations occurred.

Record exact tool versions, plugin/MCP schema, commands, limitations, screenshots/outputs and whether the result is deterministic enough for production use.

## Decision outcomes

Classify an integration as one of:

- `PRODUCTION_AUTHORITY` — safe for deterministic scripted edits and export;
- `FINISHING_ONLY` — useful for paint-over but not reliable enough to own source geometry;
- `EXPERIMENTAL` — interesting but not yet reproducible;
- `REJECTED` — missing critical capabilities or too opaque.
