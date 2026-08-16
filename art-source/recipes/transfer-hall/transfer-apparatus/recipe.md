# Asset Recipe — TS-01 Transfer Apparatus / Core Cradle

Status: **SOURCE PASS 1 READY — M1 unique Hero source; stop after one generation for source QA**

The Transfer Apparatus is the current next Gold-Slice production asset after the accepted v0.13.2 spatial/presentation stabilization.

## Visual purpose

The Transfer Apparatus is the primary environmental hero object in TS-01. It must make the first Transfer feel desirable, precise and empowering before the story reversal.

It is the clearest environmental expression of the Numberdroid visual thesis:

```text
CORE = persistent person/self
SLOT = prepared body/place/role
```

The object should read at gameplay scale as:

> **a precious warm CORE held by an elegant, open, precisely prepared SLOT / transfer cradle.**

Do not signal horror or villain machinery. The same attractive machine later gains disturbing meaning because of what the system does with people, not because the object initially looks evil.

## Runtime / spatial contract

Current semantic Prop:

```text
LevelSpec Prop ID:       transfer-core
Attachment:              FloorProps
Authored coarse footprint: 3 × 3 tiles
Runtime envelope:        192 × 192 px at 64 px/tile
Allowed rotation:        0°
Role:                    hero
Hero clearance:          1 tile around the coarse placement where the solver provides it
```

The coarse 3×3 footprint remains deterministic authoring/solver identity. It does **not** require the visible physical machine to be one solid 3×3 block.

### Intended physical read

The visible raised machine should remain compact and centered inside the 3×3 envelope. The surrounding Hero presence should come from:

- open SLOT/bracket silhouette;
- negative space;
- warm CORE focal light;
- later separate Flow/FloorFX support;
- room composition and lighting.

Do not solve visual importance by making a huge solid 3×3 object.

### Collision authority

Current generated `transfer-core` still falls back to conservative coarse collision because production art has not yet established reviewed true physical geometry.

The hand-authored Layout-v3 reference used a centered approximately **1.60 × 1.60 tile solid transfer-cradle core**. Treat that as a strong starting reference, not automatic final authority.

After Source QA, define reviewed source-local collision / Exact-Fit metadata from the accepted physical design. Preferred direction:

- central physical machine body roughly 1.6–2.0 tiles across;
- no collision inferred from PNG alpha;
- any larger visual glow/alignment language remains separate from physical mass;
- if the accepted silhouette contains physically raised separated arms, use explicit multipart collision rather than one inflated 3×3 AABB.

A spatial metadata change is a separate reviewed Engineering/Technical-Art step and must retain the v0.13.2 regression contract.

## Perspective

Use the established Numberdroid environment projection:

```text
Projection:  orthographic / no perspective convergence
Camera:      near-nadir
Pitch read:  approximately 80–82° downward / 8–10° from perfect vertical
Yaw:         fixed and neutral
Side faces:  narrow depth cues only
Top faces:   dominant
```

The machine may feel dimensional, but it must not depend on a readable frontal face or side-view furniture logic.

## Method-selection gate

Required answers:

1. Exact modular geometry required? **No.** Spatial envelope/collision are exact, but the visible Hero silhouette benefits from expressive authorship.
2. Modular connectors? **No.**
3. Hidden continuation edges? **No.**
4. One coherent material across many interchangeable pieces? **No.**
5. Seamless/periodic texture? **No.**
6. Primarily a unique expressive form? **Yes.**
7. Non-destructive local retouch likely? **Possible later, but no proven M3 requirement yet.**

### Authority split

```text
Primary production method:   M1 Direct Generative Source
Material/source method:      ChatGPT Image Generation, one isolated transparent source
Optional finishing method:   deterministic alpha cleanup / crop / resize / mild resample sharpening; bounded local retouch only if a concrete defect later justifies a proven method
Geometry authority:          M1/Artist owns visible Hero silhouette inside the approved 3×3 presentation envelope
Topology/edge authority:     none required; no modular connectors
Material authority:          generated source under Transfer Ship palette/art direction
Alpha/background authority:  generated transparent source followed by deterministic cleanup/validation
Packing authority:           deterministic 192×192 production canvas / 3×3 authored runtime size
Spatial/collision authority: `src/levelgen/propRegistry.ts`, `propCollisionRegistry.ts`, reviewed Exact-Fit metadata — never image alpha
Shadow authority:            separate FloorFX asset produced after the visible source is accepted
Lighting authority:          local emissive pixels may exist in the Prop; scene illumination belongs to LightOverlay
```

### Why M1

This is one unique environmental Hero with no runtime connector semantics. Its success depends on memorable form, desirable material treatment and a clear CORE/SLOT read. Those are M1 strengths.

M4 would over-constrain an expressive unique object. M2 would make sense only if we first decided that an exact deterministic silhouette must be preserved; there is currently no evidence that the placeholder silhouette deserves that authority.

The generated source therefore owns the **visible design**, while the Level Compiler continues to own placement, reservations and physical gameplay truth.

## Hero design concept — Source Pass 1

### Core composition

- centered warm amber/gold CORE as the unmistakable focal point;
- open paired SLOT/bracket/cradle structure around the CORE;
- precise alignment/docking recess language;
- soft rounded ceramic masses combined with controlled inset graphite mechanics;
- compact physical center with useful negative space;
- obvious manufactured quality and maintenance.

The object should suggest transfer/docking without becoming:

- a chair;
- throne;
- altar;
- weapon;
- reactor turbine;
- engine;
- surgical/horror device.

### Material hierarchy

Primary:
- warm off-white / ceramic grey.

Secondary:
- graphite / dark mineral mechanical recesses.

System accent:
- restrained mint/teal normal-status indicators only.

Hero focal accent:
- warm amber/gold CORE, clearly stronger than teal.

Avoid continuous neon, excessive vents, pipes, hazard graphics or generic greeble density.

## Source generation contract

Canonical first-pass prompt:

`prompt.md`

Source-pass rules:

- exactly **one** generation;
- isolated object;
- transparent background;
- square high-resolution source;
- no baked floor/wall/environment;
- no broad cast shadow;
- no scene light painted outside the object;
- no text/labels;
- no robot body inside the asset;
- centered with sufficient transparent margin for deterministic crop/downscale.

After generation: **STOP**. Do not automatically regenerate, extract or integrate until the source candidate is visually reviewed.

## Source QA gate

Review the single generated source for:

### Identity
- does it immediately read as CORE + SLOT / transfer cradle?
- does it feel empowering and desirable rather than sinister?
- does it avoid generic sci-fi reactor/altar/throne reads?

### Projection
- near-top-down / orthographic read is consistent;
- top surfaces dominate;
- no perspective convergence;
- no important frontal face.

### Silhouette / physical plausibility
- coherent environmental Hero silhouette at 192×192 target scale;
- central raised mass remains compact enough that reviewed collision need not become the full 3×3 envelope;
- negative spaces remain legible;
- no thin decorative features that will disappear completely after downscale unless intentionally expendable.

### Material / hierarchy
- warm ceramic + graphite language fits Transfer Ship;
- amber CORE is the focal point;
- teal is subordinate;
- detail is restrained enough to survive gameplay-scale reduction.

### Production cleanliness
- transparent isolated source;
- no floor/background plate;
- no broad baked shadow/glow;
- no readable text;
- no unrelated character/body.

If the source fails a fundamental identity/projection/silhouette criterion, revise the prompt/design and make a **new explicitly numbered source pass**. Do not silently regenerate during QA.

## Production conversion — only after Source acceptance

Planned deterministic path:

1. preserve accepted high-resolution source in recipe-local reproducible form;
2. inspect/clean alpha without clipping thin meaningful features;
3. crop to non-zero meaningful subject bounds;
4. fit into a transparent 192×192 production canvas with documented margin/offset;
5. downscale with controlled high-quality resampling;
6. mild post-resample sharpening only if gameplay-scale comparison benefits;
7. validate exact dimensions and source/runtime hashes;
8. create separate grounding/contact shadow in FloorFX;
9. author/review true-space visual/collision metadata;
10. register `transfer-core` in `src/levelgen/propArtRegistry.ts` as `candidate`;
11. test/build/deploy;
12. live QA in Generated TS-01;
13. promote to accepted only after explicit Art-Director acceptance.

Do not invent a generic Freistellen tool during this asset unless the accepted source actually proves one is needed. The toolkit capability remains PLANNED.

## Runtime layer ownership

```text
FloorFX      → later grounding/contact shadow and justified Flow markings
Architecture → unchanged accepted walls
FloorProps   → Transfer Apparatus visible production sprite
LightOverlay → illumination cast onto floor/player/nearby scene
```

No floor plate, scene lighting or collision is baked into the visible FloorProps PNG.

## Final live QA

After production integration, verify:

- Hero scale dominates appropriately without making the Transfer room cramped;
- collision follows believable physical mass;
- PICO cannot visibly drive through raised machinery;
- 1-tile Hero breathing reservation still reads comfortably;
- Hologram/Flow/support objects clearly belong to the same Transfer system;
- room entrance remains clean;
- amber local focal hierarchy survives on desktop and phone;
- accepted Walls/Doors/Family assets remain unchanged;
- runtime performance remains consistent.
