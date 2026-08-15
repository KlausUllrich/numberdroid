# Family Props Batch 2 — LIVE_CANDIDATE

Status: **`LIVE_CANDIDATE` — visual assets approved as promising; final room placement/density pending deployed Gold Slice composition QA**.

This batch integrates four isolated strict-top-down concepts explicitly approved for live testing: two plant types, a coffee machine and a hologram pedestal. The rejected carpet and earlier non-top-down concept-sheet props are not part of this batch.

The assets are now inputs to `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`; their placement may be recomposed during PASS 1 without reopening the source art.

## Binding visual rule

All four props use the established **ND Shallow Top-Down** language, but the interesting information must remain on horizontal/top surfaces. No asset is allowed to depend on a readable frontal wall face. Each prop remains a transparent isolated runtime asset and owns no baked floor/background plate.

The four grounding shadows are separate `FloorFX` assets. No gameplay interaction, pickup, resource or story semantics are introduced by this batch.

## Current Composition Preview placement / runtime contract

### Coffee machine

The coffee machine must be approached/read from its lower side, therefore it remains at the **upper wall** with its service/access face pointing into the room.

```text
Prop layer:       WallProps
Prop GIDs:        177–178
Placement:        col 5,row 1; 1×2
Runtime asset:    /assets/deck/family-coffee-machine.png
Runtime size:     64×128
Source chunks:    source/coffee-machine-runtime.b64.00–03
Bytes:            6901
SHA-256:          3d1d960b3aaa4a3549a43fb0dc9363a0d148f3f11ef90c5318593313cce7be4d

Shadow layer:     FloorFX
Shadow GIDs:      179–180
Shadow placement: col 5,row 1; 1×2
Shadow asset:     /assets/deck/family-coffee-machine-shadow.png
Shadow source:    source/coffee-machine-shadow-runtime.b64.00
Shadow bytes:     1964
Shadow SHA-256:   d37a914b2ba711eaaf46127d9cc73364b436931f3a63475668c7624935df5aaf
```

The 64×128 runtime source deliberately carries transparent space above the visible machine so the first visible pixels enter the room below the accepted upper-wall fascia.

### Planter trough

The approved horizontal source was deterministically rotated 90°. Gold Slice PASS 1 moves it upward along the **left Family edge**, directly below the table cluster rather than leaving it isolated in the lower open field.

```text
Prop layer:       FloorProps
Prop GIDs:        181–182
Placement:        col 2,row 6; 1×2
Runtime asset:    /assets/deck/family-planter-trough.png
Runtime size:     64×128
Source chunks:    source/planter-trough-runtime.b64.00–05
Bytes:            10825
SHA-256:          0aacbd2921e0a02426be9bc7c90686f20a7911468e58b57fd6475176043a8c1e

Shadow layer:     FloorFX
Shadow GIDs:      183–184
Shadow placement: col 2,row 6; 1×2
Shadow asset:     /assets/deck/family-planter-trough-shadow.png
Shadow chunks:    source/planter-trough-shadow-runtime.b64.00–01
Shadow bytes:     2218
Shadow SHA-256:   2daf5d771d3034d86b102c63e07c79adb13881ab4fc620c3b1e8b4f991755634
```

### Round plant

PASS 1 moves the round plant into the **upper-left Family edge/corner composition**, below the room label and above the Family Table.

```text
Prop layer:       FloorProps
Prop GID:         185
Placement:        col 2,row 2; 1×1
Runtime asset:    /assets/deck/family-round-plant.png
Runtime size:     64×64
Source chunks:    source/round-plant-runtime.b64.00–03
Bytes:            7200
SHA-256:          aeba57e8df23e23f55409a661098e929d4f0b89ee8ecaf0dbac8cbf484cc3f7a

Shadow layer:     FloorFX
Shadow GID:       186
Shadow placement: col 2,row 2; 1×1
Shadow asset:     /assets/deck/family-round-plant-shadow.png
Shadow source:    source/round-plant-shadow-runtime.b64.00
Shadow bytes:     1617
Shadow SHA-256:   a53f9db3d94ad34ed58b03b1652dadf16335ee2cd192e6cfaee0c2df37e1db15
```

### Hologram pedestal

The hologram proved visually useful but read as unmotivated Family clutter. PASS 1 moves it into the **upper Transfer support edge**, where it can read as diagnostic/support dressing around the Transfer hero system without becoming an interaction.

```text
Prop layer:       FloorProps
Prop GID:         187
Placement:        col 10,row 2; 1×1
Runtime asset:    /assets/deck/family-hologram-pedestal.png
Runtime size:     64×64
Source chunks:    source/hologram-pedestal-runtime.b64.00–03
Bytes:            7873
SHA-256:          c31af1083ddeb469f0ff138189fb6d33f1378967e2e2635c7d047c02d5df5387

Shadow layer:     FloorFX
Shadow GID:       188
Shadow placement: col 10,row 2; 1×1
Shadow asset:     /assets/deck/family-hologram-pedestal-shadow.png
Shadow source:    source/hologram-pedestal-shadow-runtime.b64.00
Shadow bytes:     1574
Shadow SHA-256:   7e4b80e5ba332cffb8fa24c9f7e0092dd7dc2fc2c9d448b4d00bc4c8e4b52ec3
```

## Current collision

Collision follows the Composition Preview placement while remaining smaller than the foliage/effect envelopes:

```text
family-coffee-machine-solid   x 5.18,y 1.52,w 0.64,h 0.82
family-planter-trough-solid   x 2.18,y 6.55,w 0.64,h 0.90
family-round-plant-solid      x 2.20,y 2.28,w 0.60,h 0.55
family-hologram-solid         x 10.18,y 2.22,w 0.64,h 0.62
```

No interaction logic is attached to these obstacles.

## Materialization / integrity

`npm run materialize-art` reconstructs all eight runtime PNGs from the recipe-local text-safe sources and verifies PNG signature, exact byte count, SHA-256 and dimensions before writing into `public/assets/deck/`.

This follows the hardened text-safe asset path established after the earlier invisible/corrupted Memory Console PNG incident.

## Composition Preview live QA gate

Before acceptance, inspect the deployed Transfer Hall on PC and mobile:

- coffee machine remains visibly attached to the upper-wall area and clearly accessed from below;
- neither coffee art nor its shadow paints over the wall fascia;
- planter reads as left-edge Family dressing rather than a floating lower-floor token;
- round plant contributes to an upper-left Family corner composition;
- hologram reads as Transfer-support dressing rather than arbitrary Family decoration;
- all four shadows remain aligned after relocation;
- top-down perspective remains coherent with the accepted Family Table and Memory Console;
- new PASS 1 wall returns / PASS 2 blockout props do not make these assets feel cramped or redundant.

Do not mark the batch `LIVE_ACCEPTED` until deployed Art-Director QA passes the room-level composition, not merely the isolated asset appearance.
