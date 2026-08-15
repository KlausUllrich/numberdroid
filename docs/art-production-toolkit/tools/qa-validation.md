# Toolkit QA / validation capabilities

Status: **PARTIALLY PROVEN**

## Proven now

### Semantic connector boundary metric

`meanConnectorDifference()` compares actual RGBA boundary strips for equal-length connector segments.

Production rule remains stronger than the primitive itself: report required SAME-TYPE connector error together with an appropriate DIFF-TYPE negative control. A raw low number without a control is not interpretable enough.

### Deterministic self-test

`npm run art:toolkit-test` verifies:

- a declared connector is not misclassified as an exposed object end;
- materialized connector strips can start different;
- median canonicalization makes required connector boundaries pixel-identical;
- exact RGBA PNG output has the expected signature.

## Planned QA modules

- periodic/seamless opposite-edge metrics;
- wrapped/repetition preview generation;
- alpha outside-mask contamination;
- matte/halo detection;
- exact atlas cell/order/dimension validation;
- duplicate/near-duplicate frame diagnostics;
- palette and semantic-color constraints;
- controlled downscale comparison.

## Principle

Automated QA proves structural/pixel properties. It does not decide whether an image is attractive, readable or in the correct art direction. Live visual QA remains a separate gate.
