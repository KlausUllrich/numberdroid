# TS-01 Transfer Apparatus / Core — Production Contract

Status: `SOURCE_VARIANTS_PENDING_QA`

This contract specializes `docs/art/production/PROP_ASSET_WORKFLOW.md` for the first production proposal of the TS-01 Transfer Hero.

## Identity

```text
PROP ID:                 transfer-core
DESIGN NAME:             Transfer Apparatus / Core Cradle
SEMANTIC FUNCTION:       first body-transfer machine; empowering, desirable, precise
LEVEL / SPACE:           TS-01 / transfer-room
PLACEMENT ROLE:          Hero
```

## Spatial / Workbench contract

```text
attachment:              floor
allowedRotations:        [0]
coarse footprint:        3×3 tiles
placement:               room-center preferred
Door Clearance:          forbidden
Primary Path:            forbidden
clearanceAroundTiles:    1
hard wall relation:      none
approach/use-space:      provided by 1-tile hero clearance ring; no separate directional approach for first source
```

The 3×3 footprint is a deterministic coarse anchor/reservation. It is not permission to turn the complete 3×3 square into collision.

Visual footprint, collision, open SLOT space and later Flow/FloorFX remain separate.

## Art / authority contract

```text
Primary method:          M1 Direct Generative Source
Geometry authority:      model/Artist for visible Hero silhouette
Placement authority:     compiler 3×3 coarse Hero anchor
Collision authority:     explicit post-approval metadata; never PNG alpha
Material authority:      generated source within Transfer Ship art direction
Alpha/background:        transparent isolated source preferred; deterministic cleanup after approval
Packing/runtime:         individual registered PNG, not a mandatory atlas
Shadow:                  separate FloorFX asset after source approval
Scene illumination:      LightOverlay, never baked floor illumination
```

## Perspective

Strict orthographic top-down gameplay presentation with no perspective convergence. Top surfaces dominate. Small height/side-face cues are allowed only when they remain compatible with the established Transfer Ship top-down language and do not turn the object into isometric concept art.

The apparatus must read correctly in a 3×3 runtime envelope at 64 px per tile.

## Visual thesis

The Transfer Apparatus is the primary environmental Hero in TS-01.

It must communicate:

- `CORE` — warm amber personal/persistent energy identity;
- `SLOT` — precise machine accommodation for bodies/cores;
- maintained civilian technology rather than industrial danger;
- elegance, optimism and capability before the later story reversal;
- a recognizable open receiving/transfer structure rather than a generic pedestal or floor icon.

Material hierarchy:

```text
primary        warm off-white / ceramic shell
secondary      graphite / dark mineral mechanism
system         restrained teal status detail
CORE focus     warm amber emissive source
```

Avoid generic dark military sci-fi, hazard striping, pipes everywhere, weapon-like silhouettes, medical horror, threatening restraints, red warning language, or dominant cyan neon.

## First proposal: A / B / C

Generate exactly three separate visual alternatives of this same semantic asset in one first-look generation call.

```text
A — conservative
    calm symmetrical civilian cradle; closest to accepted Transfer Ship language

B — stronger silhouette
    more open petal/ring/receiving geometry; stronger readable SLOT structure and personality

C — bolder interpretation
    more distinctive asymmetry/segmentation while preserving civilian elegance, 3×3 compatibility and CORE/SLOT readability
```

All three must remain the same function, camera, palette family and approximate 3×3 footprint class.

No labels, no A/B/C text in pixels, no room mockup, no prop sheet, no UI, no floor background, no baked contact shadow, no surrounding consoles/robots/people.

## Approval gate

After generation:

1. assistant QA of all three variants;
2. Klaus selects one variant or rejects all;
3. no crop, shadow, collision finalization or integration before explicit selection/approval;
4. only the selected source proceeds to deterministic production preparation.
