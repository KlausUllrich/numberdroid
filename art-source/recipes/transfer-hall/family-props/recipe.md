# Asset Recipe — TS-01 Family Props

Status: `LIVE_CANDIDATE` — Family Table / Waiting Module is the accepted visual baseline for the first family micro-set; the wider Family / ordinary-props set remains in production.

## Visual purpose

Family props communicate human/personal traces inside a highly ordered machine society. They should feel warm, slightly irregular and meaningful without becoming rustic, sentimental clutter or visually noisy.

Candidate vocabulary from the approved Transfer Ship art direction:

- family table / waiting module;
- cups or mismatched drinking containers;
- bag / fabric item;
- plant(s);
- child drawing / keepsake / personal display item.

These are candidate functions, not a requirement to generate every item at once.

## Binding constraints

- environment remains near-top-down and orthographic; the Family Table establishes the current **ND Shallow Top-Down** working baseline for detailed civilian props;
- isolated transparent objects; **no baked floor or wall**;
- deliberate runtime footprint and separate collision only where needed;
- grounding/contact shadows belong to `FloorFX`, not baked into `FloorProps`, unless an explicit exception is approved;
- warm/personal accents are local, not global grading;
- no filler clutter;
- do not use the legacy placeholder prop atlas as authoritative source geometry;
- preserve layer ownership: wall-mounted objects → `WallProps`, free-standing objects → `FloorProps`, floor-projected markings/shadows → `FloorFX`.

## Method-selection gate

Do **not** invent `geometry.svg` merely because previous geometry-critical recipes used one.

For each prop/micro-set declare:

```text
Primary production method:
Material/source method:
Optional finishing method:
Geometry authority:
Material authority:
Alpha/background authority:
Packing authority:
Why this split fits the prop:
```

M4 is appropriate only if an object has genuinely fixed deterministic geometry that should own the final silhouette.

If the source needs generic background removal, evaluate the PLANNED toolkit capability at `docs/art-production-toolkit/tools/freistellen.md`; do not claim it exists until implemented/proven.

## Micro-set A — Family Table / Waiting Module

Visual baseline: **approved in the deployed Transfer Hall**.

### Runtime contract

```text
Target prop layer:      FloorProps
Family Table GIDs:      161–166
Map placement:          col 2,row 4; 3×2 block
Runtime envelope:       192×128 px = 3×2 cells at 64×64
Prop tileset:           /assets/deck/family-table-props.png
Prop tileset contract:  firstgid 161, columns 3, tilecount 6
Existing collision:     family-table-solid
Collision rect:         x 2.52, y 4.58, w 1.96, h 0.82 tiles
Shadow layer:           FloorFX
Shadow GIDs:            167–172
Shadow tileset:         /assets/deck/family-table-shadow.png
Shadow contract:        firstgid 167, columns 3, tilecount 6
Legacy prop atlas:      unchanged; GIDs 129–160 remain stable
Legacy FloorFX atlas:   unchanged; existing GIDs remain stable
```

Visual footprint and collision footprint remain deliberately separate. The table and its grounding shadow use appended dedicated tilesets rather than rewriting or reordering legacy atlases.

### Method / authority split

```text
Primary production method:  M1 Direct Generative Source
Material/source method:      ChatGPT Image Generation, single source pass
Optional finishing method:   deterministic alpha normalization + crop/downscale + palette optimization
Geometry authority:          model/Artist for visible prop silhouette
Placement authority:         deterministic 3×2 runtime envelope
Material authority:          generated source within Transfer Ship palette
Alpha/background authority:  generated alpha followed by deterministic cleanup
Packing authority:           dedicated 3×2 tileset, exact 64×64 cells
Collision authority:         existing map obstacle; unchanged
Shadow authority:            dedicated FloorFX asset; independently replaceable
```

Why: the family module benefits from expressive form, upholstery, asymmetry and personal traces; it has no modular connectors. Exact runtime placement and collision remain deterministic.

### Perspective — ND Shallow Top-Down

Working definition:

```text
Name:        ND Shallow Top-Down
Projection:  orthographic / no perspective convergence
Camera:      near-nadir, approximately 8–12° away from perfect vertical
Pitch read:  approximately 78–82° downward
Yaw:         fixed/consistent for future production
Side faces:  minimal reveal only; top faces remain dominant
```

The Family Table demonstrated that this shallow side-face reveal can add volume/materiality while retaining top-down gameplay readability on both PC and mobile. Future detailed props should use this as the current reference unless a concrete asset type requires a different treatment.

### Visible content

- integrated civilian-tech family waiting table/module;
- off-white/ceramic shell and graphite details;
- blue textile seating with restrained warm mustard/amber accents;
- two visibly different drinking vessels;
- one folded blue textile/personal item;
- one very small decorative plant-like personal trace;
- no text, labels, characters, story-specific drawing/photo or gameplay affordance.

The plant-like detail is generic and carries no canonical story meaning; no Story trigger is required for this baseline.

### Reproducible table source

The exact runtime table candidate is stored text-safely under:

```text
source/family-table-runtime.b64.00
```

`npm run materialize-art` reconstructs:

```text
public/assets/deck/family-table-props.png
```

Validated table contract:

```text
PNG size:    192×128
bytes:       9460
SHA-256:     1eb0253d60df639678def53c4e25afd5fb52cac9a428d7098225729f41a3bfa3
```

### Deterministic table extraction

1. original generated RGBA source at 1536×1024;
2. source alpha normalized to suppress broad low-alpha halo;
3. crop to non-zero alpha bounds;
4. resize with Lanczos to fit inside 192×128 with a small transparent margin;
5. final visual content size inside envelope: 186×120 at offset (3,5);
6. light unsharp mask after resample for runtime readability;
7. palette optimization after gameplay-scale visual comparison;
8. materialization validates byte count, SHA-256 and exact dimensions before writing the runtime PNG.

No generic Freistellen capability is promoted to PROVEN from this work alone.

## Family Table grounding shadow — LIVE_ACCEPTED

Status: **`LIVE_ACCEPTED` — 2026-08-15** after deployed gameplay-scale QA.

The shadow is a dedicated 3×2 `FloorFX` asset beneath the table and is now the accepted grounding treatment for this prop.

```text
Runtime asset:  /assets/deck/family-table-shadow.png
GIDs:           167–172
Runtime size:   192×128
Source:         source/family-table-shadow-runtime.b64.00
Bytes:          3699
SHA-256:        c4cce1f8daebba9d3f96b5f0e064513c7eac874ffedc6ffe00cdba4941398d81
```

Accepted visual intent:

- neutral-charcoal grounding only;
- compact shape-following contact weight plus a softer ambient footprint;
- no colored glow, floor texture, lighting state or gameplay semantics;
- shadow remains separate from the table art;
- no further tuning is required unless a concrete live defect appears.

The runtime source is a compact deterministic representation of the generated shadow concept; alpha is quantized to a small number of levels to keep the reproducible repository source small while preserving the gameplay-scale read.

## Wall-display follow-up

The first generated Family Wall Display attempt is **rejected as a production candidate**. Keep only its palette/material cues.

Reason:

- mixed spatial logic: housing reads partly as a top-down object while pinned pictures and the plant read as frontal/side-view elements;
- silhouette can be mistaken for another table/furniture object;
- plant orientation and object proportions are inconsistent with the wall-mounted role.

The next WallProps iteration must make the wall-plane relationship unambiguous while preserving the accepted off-white / graphite / slate-blue / mustard-amber family palette.

## Narrative trigger

Generic family traces can be authored from the approved art direction without reading the complete campaign story.

Before authoring **specific narrative content** — e.g. what a child drawing depicts, whose keepsake it is, a message, a specific family event or a canonical parent/child object — activate the STORY trigger in `docs/agents/ROLE_ENTRYPOINTS.md` and read the relevant Story/World contract.

## Gameplay / engineering trigger

Before changing collision, interaction, pickups, map/GID structure, atlas ordering, runtime layers or renderer behavior, activate the Game Design/Engineering trigger in `ROLE_ENTRYPOINTS.md`.

The Family Table integration deliberately does not alter collision or gameplay behavior.

Do not change map/game logic merely to rescue unsuitable prop art.

## Scope rule

Proceed in coherent micro-sets and prove source → alpha/extraction → packing → live QA before expanding the inventory. Do not generate the full remaining Transfer Hall prop inventory in one call.
