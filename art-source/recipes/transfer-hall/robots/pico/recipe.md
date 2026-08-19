# Asset Recipe — PICO-3 Directional Character

Status: `LIVE_ACCEPTED` — source + runtime physical grounding

## Identity

- Slice/world: TS-01 Transfer Hall / Transfer Ship
- Character: PICO-3
- Runtime output: `public/assets/robots/directional-pico.png`
- Runtime strip: **768 × 96 px**
- Frames: **8 × 96 × 96 px**
- Frame order: `N | NE | E | SE | S | SW | W | NW`
- Perspective rule: character turnaround is the deliberate perspective exception to strict top-down environment art

## Production authority

PICO is an accepted authored/generated character turnaround. It is not reconstructed from deterministic SVG geometry.

Current source authority is the accepted PNG payload preserved text-safely under:

`source/directional-pico-gold.b64.00` … `.03`

The source decodes to:

- exact bytes: **14,617**
- SHA-256: `cb392e02da021ee2e33031021c6e7f01051f98edc4a01d0e9386a320f31494c9`
- dimensions: **768 × 96**

`scripts/materialize-art-assets.mjs` validates those invariants and writes the runtime PNG during `predev` / `prebuild`.

## Runtime source sanitation

The approved source remains unchanged, but the accepted runtime derivative applies deterministic directional-actor sanitation through:

- `scripts/art/toolkit/directional-actor-source.mjs`
- `scripts/sanitize-materialized-actor-assets.mjs`
- `scripts/assert-directional-actor-source-integrity.mjs`

Reason: the NW source frame contains a tiny detached below-body structural fragment. It is not treated as physical support. The runtime sanitation removes that detached artefact deterministically while preserving the approved source payload as authority.

The connected runtime foot planes are:

```text
N  86
NE 86
E  87
SE 87
S  89
SW 92
W  92
NW 92
```

Do not restore the rejected NW fragment as a grounding/contact anchor.

## Physical grounding authority

Binding reusable workflow:

`docs/art/production/ACTOR_GROUNDING_WORKFLOW.md`

Grounding profile authority:

`src/meta/characterGroundingProfiles.json`

Generated CSS:

`src/meta/CharacterGrounding.generated.css`

PICO physical grounding is **LIVE_ACCEPTED after PR #121 on 2026-08-19**.

Accepted actor-level grounding values:

- ambient: **92 × 23 source px**;
- ambient offset from connected foot plane: **-5 source px**;
- contact defaults: radiusX **6.325**, radiusY **3.45**, opacity **0.9**;
- side-view explicit radiusX: **8.05** for E/W.

Accepted whole-shadow human QA deltas:

```text
N   0
NE  0
E  -3
SE -2
S  -2
SW -3
W  -3
NW +2
```

Accepted additional local calibration:

- NE left contact x = **37.5** source px;
- NW uses one connected support only;
- prior pose/contact `presentationOffsetY` calibration remains separate from the explicit whole-shadow `shadowOffsetY` data.

These values are PICO regression authority, not universal defaults for other robot bodies.

## Freeze rule

PICO source and physical grounding are visually accepted. Do not regenerate, redraw, recolor, repack or mathematically normalize the accepted grounding profile merely to make the implementation look cleaner.

A future deliberate PICO revision must create a bounded character-art task and preserve/replace this recipe with the newly accepted source, grounding profile/process and QA.

A demonstrated separate player-model/presentation defect may reopen only the affected layer; it does not automatically reopen PICO source or accepted grounding.

## QA

Source:

- exact PNG signature;
- exact byte count and SHA-256 before materialization;
- exact 768 × 96 dimensions;
- eight stable directional frames in documented order.

Grounding:

- connected-component/source-integrity gate passes;
- runtime sanitation removes the known NW detached artefact;
- grounding contacts remain attached to connected body geometry;
- generated grounding CSS matches the profile;
- `?groundingFixture=1` renders all eight directions;
- browser grounding QA passes;
- real-scene grounding QA passes;
- explicit Human Live QA is required for any deliberate future revision.
