# Transfer Hall visual-weight live QA — 2026-08-14

PC live-preview QA found two concrete Gold-Slice regressions after the first real wall deployment:

1. PICO label/ground marker rendered but the robot body was invisible. Root cause: the tracked `directional-pico.png` was a corrupt PNG stream.
2. The new dark wall material worked, but the 10 px visible wall band read too thin against the approved Transfer Hall reference.

Fix:

- PICO is reconstructed from the previously approved eight-direction turnaround into a validated 768×96 runtime strip (`N, NE, E, SE, S, SW, W, NW`).
- The Transfer Hall Architecture atlas keeps the existing 10 px structural/collision contract but uses a 16 px visible graphite fascia. No map GIDs, collision geometry, layer order or door topology change.
- Both generated runtime PNGs are materialized from text-safe source and validated before build by PNG signature, exact dimensions, exact byte count and SHA-256.

Live approval remains required after Pages deployment.
