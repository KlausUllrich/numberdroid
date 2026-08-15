# TS-01 Walls — Retired M2 Whole-Object Edit Prompt

Status: **retired as primary wall production approach; preserved as a learned method artifact**

This prompt was used when the Controlled Art Pass asked an image editor/generator to materialize the complete separated wall shapes.

It remains useful for understanding M2, but it is no longer the preferred TS-01 wall production prompt because the model still had to infer which isolated silhouette edges were true architectural edges versus runtime connectors.

## Historical prompt

Transform only the visible wall shapes of the provided deterministic top-down wall atlas into finished Numberdroid Transfer Ship architecture.

Keep the supplied geometry, cell layout, connector positions, thickness and transparency exactly unchanged. Do not invent or move any wall segment.

Visual target:

- calm, substantial civilian sci-fi architecture;
- dark neutral graphite / charcoal structural body;
- broad homogeneous material fields rather than busy panelization;
- restrained neutral metallic edge definition;
- subtle construction joints and controlled wear only where they survive 64 px gameplay scale;
- soft local depth/contact shading that helps the wall feel massive without becoming visually loud;
- maintained, premium public-infrastructure quality rather than military bulkhead styling;
- ordinary walls should recede behind characters, doors and hero machinery.

Avoid:

- cyan or teal strips on ordinary wall seams;
- orange hazard trim;
- vents, pipes, labels, UI, symbols or bonus props;
- high-frequency panel noise;
- bright chrome outlines around every edge;
- perspective or visible vertical wall faces;
- rounded/tapered connector ends;
- black holes, missing fragments or gaps at corners/T-junctions;
- a presentation board, diagram, captions or documentation text.

The result is material source only. Deterministic mask restore and semantic connector canonicalization will follow.

## Why retired

The separated Generation Layout correctly stopped atlas cells from visually merging. However, the generated result still framed each isolated piece as an individual object. That treatment was internally inside the valid geometry mask, so mask restoration could not remove the incorrect per-piece framing without also destroying desirable material.

This exposed the topology-information boundary documented in `docs/art-production-methods/02-controlled-art-pass/README.md`.