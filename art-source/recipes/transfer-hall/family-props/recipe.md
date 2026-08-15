# Asset Recipe — TS-01 Family Props

Status: `LIVE_CANDIDATE` — first Family Table / Waiting Module micro-set integrated as a bounded visual spike; not yet `LIVE_ACCEPTED`.

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

- environment remains near-top-down and orthographic; the first Family Table spike deliberately tests the bounded **ND Shallow Top-Down** exception below;
- isolated transparent objects; **no baked floor or wall**;
- deliberate runtime footprint and separate collision only where needed;
- contact shadow only in a small local envelope and owned explicitly;
- warm/personal accents are local, not global grading;
- no filler clutter;
- do not use the current placeholder prop atlas as authoritative source geometry;
- preserve current layer ownership: wall-mounted objects belong to WallProps, free-standing objects to FloorProps, floor-projected markings/shadows to FloorFX only when deliberately separated.

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

Status: `LIVE_CANDIDATE` / bounded runtime spike.

### Runtime contract

```text
Target layer:        FloorProps
Candidate GIDs:      161–166
Map placement:       col 2,row 4; 3×2 block
Runtime envelope:    192×128 px = 3×2 cells at 64×64
Candidate tileset:   /assets/deck/family-table-props.png
Tileset contract:    firstgid 161, columns 3, tilecount 6
Existing collision:  family-table-solid
Collision rect:      x 2.52, y 4.58, w 1.96, h 0.82 tiles
FloorFX:             existing GIDs 106–111 remain separate and unchanged
Legacy prop atlas:   unchanged; GIDs 129–160 remain stable
```

Visual footprint and collision footprint remain deliberately separate. The candidate is appended as a dedicated tileset rather than rewriting or reordering the existing prop atlas. This bounded Engineering integration changes only the six Family Table map cells to the appended GIDs; collision, FloorFX and layer order remain unchanged.

### Method / authority split

```text
Primary production method:  M1 Direct Generative Source
Material/source method:      ChatGPT Image Generation, single source pass
Optional finishing method:   deterministic alpha normalization + crop/downscale + palette optimization
Geometry authority:          model/Artist for visible prop silhouette
Placement authority:         existing deterministic 3×2 runtime envelope
Material authority:          generated source within Transfer Ship palette
Alpha/background authority:  generated alpha followed by deterministic cleanup
Packing authority:           dedicated 3×2 tileset, exact 64×64 cells
Collision authority:         existing map obstacle; unchanged
```

Why: the family module benefits from expressive form, upholstery, asymmetry and personal traces; it has no modular connectors. Exact runtime placement and collision remain deterministic.

### Perspective experiment — ND Shallow Top-Down

This micro-set deliberately tests an Art-Director-approved visual candidate rather than silently changing all environment perspective rules.

Working definition:

```text
Name:        ND Shallow Top-Down
Projection:  orthographic / no perspective convergence
Camera:      near-nadir, approximately 8–12° away from perfect vertical
Pitch read:  approximately 78–82° downward
Yaw:         fixed/consistent for future production if accepted
Side faces:  minimal reveal only; top faces remain dominant
```

The goal is to gain volume/materiality while retaining top-down gameplay readability. This is **not yet a global Transfer Ship rule**. Live QA of this micro-set decides whether the exception should be promoted to the durable art-direction contracts.

### Visible content

- integrated civilian-tech family waiting table/module;
- off-white/ceramic shell and graphite details;
- blue textile seating with restrained warm mustard/amber accents;
- two visibly different drinking vessels;
- one folded blue textile/personal item;
- one very small decorative plant-like personal trace produced by the source generation;
- no text, labels, characters, story-specific drawing/photo or gameplay affordance.

The plant-like detail is generic and carries no canonical story meaning; no Story trigger is required for this candidate.

### Reproducible source

The exact runtime candidate is stored text-safely under:

```text
source/family-table-runtime.b64.00
```

`npm run materialize-art` reconstructs:

```text
public/assets/deck/family-table-props.png
```

Validated candidate contract:

```text
PNG size:    192×128
bytes:       9460
SHA-256:     1eb0253d60df639678def53c4e25afd5fb52cac9a428d7098225729f41a3bfa3
```

The original high-resolution generation remains the visual authoring origin of this candidate; the recipe-local 192×128 source is the exact reproducible runtime authority for this live spike.

### Generation brief

The source was generated as one isolated Family Table / Waiting Module production source: clean civilian futuristic technology, near-top-down orthographic view, 3×2 footprint intent, personal traces through two different drinking vessels and a folded fabric item, no characters/text/walls/floor, transparent background, restrained local shadow only.

### Deterministic extraction used for this candidate

1. original generated RGBA source at 1536×1024;
2. source alpha normalized to suppress broad low-alpha halo:
   - alpha ≤ 50 → 0;
   - alpha ≥ 180 → 255;
   - values between 50 and 180 remapped linearly;
3. crop to the resulting non-zero alpha bounds;
4. resize with Lanczos to fit inside 192×128 with a small transparent margin;
5. final visual content size inside envelope: 186×120 at offset (3,5);
6. light unsharp mask after resample for runtime readability;
7. palette optimization to a compact indexed PNG after visual comparison at runtime scale;
8. materialization validates byte count, SHA-256 and exact dimensions before writing the runtime PNG.

No generic Freistellen capability is promoted to PROVEN from this spike alone.

### QA gates for live candidate

Before `LIVE_ACCEPTED`:

- inspect the deployed Transfer Hall at gameplay scale;
- verify the shallow side-face reveal feels coherent next to Floor/Walls/Doors/PICO;
- verify personal details remain readable but subordinate to Transfer/CORE focus;
- verify alpha/halo on the warm floor;
- verify existing FloorFX does not double-shadow the new source excessively;
- verify existing collision still visually matches the solid central mass;
- decide whether ND Shallow Top-Down becomes a durable prop/environment rule or remains a rejected experiment.

## Narrative trigger

Generic family traces can be authored from the approved art direction without reading the complete campaign story.

Before authoring **specific narrative content** — e.g. what a child drawing depicts, whose keepsake it is, a message, a specific family event or a canonical parent/child object — activate the STORY trigger in `docs/agents/ROLE_ENTRYPOINTS.md` and read the relevant Story/World contract.

## Gameplay / engineering trigger

Before changing collision, interaction, pickups, map/GID structure, atlas ordering, runtime layers or renderer behavior, activate the Game Design/Engineering trigger in `ROLE_ENTRYPOINTS.md`.

The Family Table candidate activates the Engineering trigger only for its appended tileset/materialization and six map GID references. It deliberately does not alter collision or gameplay behavior.

Do not change map/game logic merely to rescue unsuitable prop art.

## First-pass scope rule

Start with **one coherent family micro-set** and prove the complete source → alpha/extraction → packing → live QA path. Do not generate the full remaining Transfer Hall prop inventory in one call.
