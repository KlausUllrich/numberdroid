# Transfer System Hero Production — Lessons Learned 2026-08-17

Status: **historical production record + reusable lessons**

This document records the reasoning and production discoveries from bringing the TS-01 Transfer Apparatus and Yellow Core from provisional blockout to live-accepted runtime art. Durable generalized rules are promoted into the binding `docs/art/production/LIVE_QA_ITERATION_CLASSIFICATION.md` addendum, which supplements `PROP_ASSET_WORKFLOW.md`; final asset authority lives in the corresponding recipes and approved-source manifests.

## 1. Outcome

The Transfer System now has two accepted static visual components:

- **Transfer Apparatus** — accepted 4×6 Hero Prop with separate deterministic FloorFX shadow and authored silhouette collision;
- **Yellow Core** — accepted 96×96 movable `transfer-fx` visual, centered on the Apparatus at rest and intentionally carrying no independent Prop collision.

The final static composition is accepted in deployed TS-01.

## 2. Source design and runtime scale are different problems

A major production correction was learning to distinguish:

```text
SOURCE DESIGN PROBLEM
vs.
RUNTIME PRESENTATION / SCALE PROBLEM
```

An early live-QA complaint was initially answered with a new source generation even though the immediate issue was the in-game scale. That was wasteful: another high-resolution source does not make a runtime object smaller when the same Crop/Fit policy is applied.

Binding lesson:

- if proportions/function/silhouette are good but the object is merely too large/small in world space, adjust the deterministic runtime materialization first;
- only regenerate/redesign the source when live QA shows the **source form itself** uses its world footprint badly or cannot deliver the intended hierarchy at a believable physical scale.

This distinction prevents unnecessary source rerolls and preserves approved art.

## 3. Physical scale and Hero prominence are also different

The Transfer Apparatus first became physically plausible at roughly 2×3 tiles, but live QA showed that it then felt too insignificant for the most important object in the room.

The correct response was not simply to make a human bed enormous again. The source was redesigned to use visual mass better:

- broader silhouette;
- stronger central Transfer Core focus;
- more substantial side modules;
- clearer Human intake and Body output logic;
- white/graphite material mass with concentrated amber Transfer energy and restrained cyan system accents.

After the redesigned source proved stronger, runtime scale was deliberately increased to 4×6 tiles to make the entire room visually center on it.

Binding lesson:

> Hero prominence should come from silhouette, hierarchy, visual density and room composition — not from blindly inflating the size of one functional sub-part.

## 4. Iterate by classifying the failure before acting

Every visual/live-QA issue should first be classified as one of:

```text
A. FUNCTION / SOURCE DESIGN
B. PERSPECTIVE / STYLE
C. RUNTIME CROP / SCALE / PADDING
D. PLACEMENT / ROOM COMPOSITION
E. COLLISION / USE-SPACE
F. SHADOW / GROUNDING
G. MOVABLE FX / CHOREOGRAPHY
```

Only A/B normally justify another source generation. C–G should first use deterministic production/runtime tools.

This became especially important because the hard image-generation gate deliberately makes source generation expensive and explicit.

## 5. Approved high-resolution source must be archived before production resizing

Both final components followed the approved-source archive workflow:

```text
SOURCE APPROVED
→ exact filename/path chosen
→ manual upload when necessary
→ raw size + Git blob verification
→ APPROVED_SOURCE_ARCHIVED
→ deterministic runtime derivative
```

This protects the large source for later animation, retouching and tool migration.

The Transfer Apparatus and Yellow Core remain in the same Asset Family because future animation/choreography will use both together.

## 6. Runtime derivatives are reproducible build products

The accepted runtime assets are not hand-edited copies. They are generated deterministically from archived source PNGs with source validation, alpha Crop/Fit and pinned output contracts.

This yielded two useful outcomes:

- changing world scale did not require mutating the approved source;
- CI catches source drift and production-transform drift independently.

## 7. Shadow belongs after runtime scale is settled

Creating the final shadow before the accepted world scale would have caused unnecessary rework.

The accepted Apparatus shadow is therefore derived after size/placement convergence from the final runtime silhouette and emitted separately in FloorFX.

Binding lesson:

- source art owns object appearance;
- shadow owns grounding;
- scene illumination stays separate;
- finalize the useful runtime scale before freezing the grounding shadow.

## 8. Collision must represent physical mass, not the rectangular canvas

The first enlarged Apparatus collision was too coarse. It either allowed movement across visible machine portions or blocked transparent outer corners.

The final solution is an **authored quarter-tile silhouette mask**:

- 16×24 occupancy mask across the 4×6 tile canvas;
- compiled deterministically into nine runtime collision rectangles;
- visible physical machine is blocked for normal Human and Robot movement;
- transparent outer corner whitespace remains traversable;
- future Transfer choreography explicitly moves actors onto/through the machine by script rather than leaving permanent holes in normal movement collision.

Important distinction:

> PNG alpha may inform an artist/engineer when authoring geometry, but image pixels are not runtime collision authority.

This gives visual-shaped collision without coupling gameplay correctness to raster changes.

## 9. A transferable Core is not a normal environmental Prop

The Yellow Core began conceptually as a separate sphere/component rather than baked Apparatus pixels. Live production confirmed that this needs an architectural distinction too.

It is therefore emitted on its own `transfer-fx` sprite layer:

- 96×96 accepted resting scale;
- centered over the Apparatus platform in the static state;
- no independent Prop collision;
- not registered as `transfer-core` or another normal environmental Prop;
- ready for later movement from Apparatus → body and body → body.

Binding lesson:

> If a visual component must move between environmental machinery and actors, do not freeze it into the environmental Prop lifecycle merely because its initial state is stationary.

Use a movable visual/FX/actor representation whose ownership and position can change under script control.

## 10. Color semantics emerged through iterative QA

The accepted Transfer System palette now has clearer semantic separation:

- **white / ceramic** — maintained civilian high-tech shell;
- **graphite** — structure / technical depth;
- **amber / yellow** — Transfer, Core identity, primary energy focus;
- **cyan / blue** — system status, scanning, stabilization, interface support.

Too much amber made the Apparatus read like a generic reactor. Restrained cyan accents improved the sense of precise controlled technology while preserving amber as the semantic Core color.

## 11. Compact transferability should be visible in the Core form

The first Core candidate had long protruding arms/spikes. It looked attractive but contradicted the gameplay idea that the Core is routinely transferable between bodies.

The accepted redesign uses:

- compact circular outer envelope;
- close-fitting white/graphite frame;
- thin orbital bands;
- small integrated docking/contact features rather than long spikes.

The lesson is function-to-form in its simplest form: transferability should be physically plausible in the silhouette.

## 12. Live QA is the final authority for scale and hierarchy

Source QA and CI could not answer whether the Hero dominated the room appropriately or whether the Core read correctly against PICO.

The accepted sequence was:

```text
source QA
→ runtime materialization
→ tests/build
→ deployed TS-01
→ live comparison against PICO / room hierarchy
→ explicit acceptance
```

The multiple scale passes were productive evidence, not failed automation: they separated technical correctness from actual art-direction quality.

## 13. Final accepted static contracts

### Transfer Apparatus

```text
runtime canvas:          256 × 384 px
world footprint:         4 × 6 tiles @ 64 px/tile
runtime content:         240 × 326 px
shadow:                  separate deterministic FloorFX
collision:               authored 16×24 quarter-tile silhouette → 9 rects
normal movement:         cannot cross visible machine body
outer transparent corners: navigable
art registry:            accepted
```

### Yellow Core

```text
runtime canvas:          96 × 96 px
runtime content:         86 × 88 px
render representation:   separate `transfer-fx` sprite
resting state:            centered on Apparatus platform
independent collision:   none
runtime status:          accepted / LIVE QA PASS
```

## 14. What remains deliberately separate

The following are **not** part of static asset acceptance and should not be conflated with it:

- Core movement animation;
- Human → Core → PICO choreography;
- body → body Transfer choreography;
- synchronization/beam/energy FX;
- temporary scripted collision/placement overrides during Transfer;
- later layered animation authoring sources.

These can build on the accepted static visual authorities after the TS-01 Gold Slice art hierarchy reaches its intended quality bar.
