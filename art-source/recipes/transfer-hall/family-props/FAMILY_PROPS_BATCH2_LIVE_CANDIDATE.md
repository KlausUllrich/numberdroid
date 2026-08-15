# Family Props Batch 2 — LIVE_CANDIDATE

Status: **`LIVE_CANDIDATE` — source art promising; Layout v3 placement pending deployed Art-Director QA**.

This batch contains four isolated strict-top-down concepts: two plant types, a coffee machine and a hologram pedestal. Source art remains unchanged during level-design recomposition.

The assets follow `docs/game-design/LEVEL_DESIGN_RULES.md` and the current `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

## Binding visual rule

All four props use the established **ND Shallow Top-Down** language. Interesting information remains on horizontal/top surfaces; no asset depends on a readable frontal wall face. Every prop remains a transparent isolated runtime asset with a separate `FloorFX` grounding shadow.

No gameplay interaction, pickup, resource or story semantics are introduced by this batch.

## Layout v3 placement contract

### Coffee machine

Upper living-room wall; access from below; no plant may obscure it.

```text
Prop GIDs:        177–178 on WallProps
Placement:        col 5,row 1; 1×2
Shadow GIDs:      179–180 on FloorFX, same placement
Runtime asset:    /assets/deck/family-coffee-machine.png
```

### Planter trough

West edge of the child-room/domestic pocket, genuinely wall-adjacent rather than floating in open floor.

```text
Prop GIDs:        181–182 on FloorProps
Placement:        col 1,row 9; 1×2
Shadow GIDs:      183–184 on FloorFX, same placement
Runtime asset:    /assets/deck/family-planter-trough.png
```

### Round plant

Living-room lower wall edge at **col 6,row 6**. It was moved one tile left during CI because col 7 interfered with the natural approach to the hygiene-room doorway. It still softens the domestic edge but now respects circulation.

```text
Prop GID:         185 on FloorProps
Placement:        col 6,row 6
Shadow GID:       186 on FloorFX, same placement
Runtime asset:    /assets/deck/family-round-plant.png
```

### Hologram pedestal

South Transfer room, close to the hero/support cluster but away from Hall→Transfer and Hall→PRIMUS thresholds.

```text
Prop GID:         187 on FloorProps
Placement:        col 10,row 16
Shadow GID:       188 on FloorFX, same placement
Runtime asset:    /assets/deck/family-hologram-pedestal.png
```

## Layout v3 collision

```text
family-coffee-machine-solid   x 5.18,y 1.52,w 0.64,h 0.82
family-planter-trough-solid   x 1.18,y 9.55,w 0.64,h 0.90
family-round-plant-solid      x 6.20,y 6.28,w 0.60,h 0.55
family-hologram-solid         x 10.18,y 16.22,w 0.64,h 0.62
```

Collision remains smaller than visual foliage/effect envelopes. No interaction logic is attached.

## Source/material integrity

Accepted source chunks, byte counts, hashes and runtime PNG dimensions are unchanged. `npm run materialize-art` remains the integrity gate.

## Layout v3 live QA gate

- Coffee Machine remains wall-backed and accessible from below.
- Long planter reads as wall-adjacent domestic furnishing.
- Neither plant obscures wall furniture, a doorway or the approach to a doorway.
- Round plant supports the living-room edge rather than circulation.
- Hologram clearly belongs to Transfer and does not crowd either threshold.
- all four shadows remain aligned;
- topology remains readable on desktop and phone.

Do not mark Batch 2 `LIVE_ACCEPTED` until the Layout v3 room-level composition is accepted.
