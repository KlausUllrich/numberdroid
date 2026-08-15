# TS-01 Door Material Reference

Status: **current deterministic Gold-Slice reference**

The Transfer Hall door belongs to the same maintained civilian-machine construction family as the accepted graphite walls, but the moving leaf should remain distinguishable at gameplay scale.

Use:

- dark graphite / mineral-composite body;
- slightly lighter average value than the surrounding wall mass;
- restrained side depth on the 5 px leaf;
- small, quiet graphite pocket collars at the two real wall terminations;
- warm amber only in the status label, not as a glowing perimeter;
- no cyan stitching, hazard stripes, bright silver frame, bolts or military detailing.

The current pass uses a deterministic procedural material from `scripts/render-transfer-hall-door-art.mjs`; no generative material source is required for this baseline.

A later material upgrade may replace the procedural surface only if it preserves the exact leaf/pocket geometry and the clean-open-aperture behavior.
