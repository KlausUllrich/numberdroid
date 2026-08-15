# TS-01 Door Material Reference

Status: **current deterministic Gold-Slice reference**

The Transfer Hall door belongs to the same maintained civilian-machine construction family as the accepted graphite walls, but the moving leaf must remain distinguishable at gameplay scale.

Use:

- dark graphite / mineral-composite body;
- **darker average value than the surrounding wall mass** so the moving mechanism reads separately;
- restrained side depth on the 5 px leaf;
- small, quiet graphite pocket collars at the two real wall terminations;
- no status text on the TS-01 door itself;
- no cyan stitching, hazard stripes, bright silver frame, bolts or military detailing.

## Coloured-key variant

A locked door that requires a coloured key keeps the normal graphite body. Only a narrow semantic marker carries the required key colour.

Current label-to-colour contract:

- `BLUE` → blue;
- `RED` → red;
- `GREEN` → green;
- `AMBER` / `YELLOW` / `COMMAND` → amber;
- `VIOLET` / `PURPLE` → violet;
- unknown keyed label → amber fallback until explicitly art-directed.

Do not repaint the entire denied door red: the key colour itself is the access information.

The current pass uses a deterministic procedural material from `scripts/render-transfer-hall-door-art.mjs`; no generative material source is required for this baseline.

A later material upgrade may replace the procedural surface only if it preserves the exact leaf/pocket geometry, key marker semantics and clean-open-aperture behavior.
