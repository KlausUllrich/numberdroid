# Family Props Batch 2 — LIVE_CANDIDATE

Status: **`LIVE_CANDIDATE` — visual assets approved as promising; Composition Preview v2 placement pending deployed Art-Director QA**.

This batch contains four isolated strict-top-down concepts: two plant types, a coffee machine and a hologram pedestal. Their source art remains unchanged during level-design recomposition.

The assets are inputs to `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md` and follow the durable adjacency / edge-first rules in `docs/game-design/LEVEL_DESIGN_RULES.md`.

## Binding visual rule

All four props use the established **ND Shallow Top-Down** language. Interesting information remains on horizontal/top surfaces; no asset depends on a readable frontal wall face. Every prop remains a transparent isolated runtime asset with a separate `FloorFX` grounding shadow.

No gameplay interaction, pickup, resource or story semantics are introduced by this batch.

## Composition Preview v2 placement / runtime contract

### Coffee machine

The coffee machine stays at the **upper Family wall**, with service/access from below.

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
Shadow bytes:     1964
Shadow SHA-256:   d37a914b2ba711eaaf46127d9cc73364b436931f3a63475668c7624935df5aaf
```

### Planter trough

The long planter now terminates the **lower-left Family edge cluster**, beside the wall-backed bench/storage composition rather than floating independently in open floor space.

```text
Prop layer:       FloorProps
Prop GIDs:        181–182
Placement:        col 2,row 8; 1×2
Runtime asset:    /assets/deck/family-planter-trough.png
Runtime size:     64×128
Source chunks:    source/planter-trough-runtime.b64.00–05
Bytes:            10825
SHA-256:          0aacbd2921e0a02426be9bc7c90686f20a7911468e58b57fd6475176043a8c1e

Shadow layer:     FloorFX
Shadow GIDs:      183–184
Shadow placement: col 2,row 8; 1×2
Shadow asset:     /assets/deck/family-planter-trough-shadow.png
Shadow bytes:     2218
Shadow SHA-256:   2daf5d771d3034d86b102c63e07c79adb13881ab4fc620c3b1e8b4f991755634
```

### Round plant

The round plant moves into the **lower Family wall-backed cluster**, beside low storage and personal traces. It is deliberately not used as a free-floating zone marker.

```text
Prop layer:       FloorProps
Prop GID:         185
Placement:        col 6,row 9; 1×1
Runtime asset:    /assets/deck/family-round-plant.png
Runtime size:     64×64
Source chunks:    source/round-plant-runtime.b64.00–03
Bytes:            7200
SHA-256:          aeba57e8df23e23f55409a661098e929d4f0b89ee8ecaf0dbac8cbf484cc3f7a

Shadow layer:     FloorFX
Shadow GID:       186
Shadow placement: col 6,row 9; 1×1
Shadow asset:     /assets/deck/family-round-plant-shadow.png
Shadow bytes:     1617
Shadow SHA-256:   a53f9db3d94ad34ed58b03b1652dadf16335ee2cd192e6cfaee0c2df37e1db15
```

### Hologram pedestal

The hologram is now placed **directly beside the Transfer apparatus** so its intended control/diagnostic relationship is visible through proximity rather than explanation.

```text
Prop layer:       FloorProps
Prop GID:         187
Placement:        col 11,row 4; 1×1
Runtime asset:    /assets/deck/family-hologram-pedestal.png
Runtime size:     64×64
Source chunks:    source/hologram-pedestal-runtime.b64.00–03
Bytes:            7873
SHA-256:          c31af1083ddeb469f0ff138189fb6d33f1378967e2e2635c7d047c02d5df5387

Shadow layer:     FloorFX
Shadow GID:       188
Shadow placement: col 11,row 4; 1×1
Shadow asset:     /assets/deck/family-hologram-pedestal-shadow.png
Shadow bytes:     1574
Shadow SHA-256:   7e4b80e5ba332cffb8fa24c9f7e0092dd7dc2fc2c9d448b4d00bc4c8e4b52ec3
```

## Current collision

Collision remains deliberately smaller than foliage/effect envelopes and follows the Composition Preview v2 positions:

```text
family-coffee-machine-solid   x 5.18,y 1.52,w 0.64,h 0.82
family-planter-trough-solid   x 2.18,y 8.55,w 0.64,h 0.90
family-round-plant-solid      x 6.20,y 9.28,w 0.60,h 0.55
family-hologram-solid         x 11.18,y 4.22,w 0.64,h 0.62
```

No interaction logic is attached to these obstacles.

## Materialization / integrity

`npm run materialize-art` reconstructs all eight runtime PNGs from recipe-local text-safe sources and verifies PNG signature, exact byte count, SHA-256 and dimensions before writing into `public/assets/deck/`.

## Composition Preview v2 live QA gate

Before acceptance, inspect the deployed Transfer Hall on desktop and mobile:

- coffee machine remains wall-backed and accessible from below;
- planter visibly belongs to the lower-left Family furniture/plant cluster;
- round plant reads as wall/furniture-adjacent rather than as a floor token;
- hologram clearly reads as part of the Transfer apparatus cluster;
- all four shadows remain aligned after relocation;
- no prop blocks the primary Family → Transfer route;
- top-down perspective remains coherent with the accepted Family Table and Memory Console.

Do not mark the batch `LIVE_ACCEPTED` until deployed Art-Director QA passes the room-level composition.
