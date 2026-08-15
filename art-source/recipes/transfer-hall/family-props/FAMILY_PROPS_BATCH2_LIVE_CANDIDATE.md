# Family Props Batch 2 — LIVE_CANDIDATE

Status: **`LIVE_CANDIDATE` — source art promising; Layout v3 placement pending deployed Art-Director QA**.

This batch contains four isolated strict-top-down concepts: two plant types, a coffee machine and a hologram pedestal. Source art remains unchanged during level-design recomposition.

The assets follow `docs/game-design/LEVEL_DESIGN_RULES.md` and the current `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

## Binding visual rule

All four props use the established **ND Shallow Top-Down** language. Interesting information remains on horizontal/top surfaces; no asset depends on a readable frontal wall face. Every prop remains a transparent isolated runtime asset with a separate `FloorFX` grounding shadow.

No gameplay interaction, pickup, resource or story semantics are introduced by this batch.

## Layout v3 placement contract

### Coffee machine

Remains on the **upper living-room wall**, accessed from below and not obscured by plants.

```text
Prop layer:       WallProps
GIDs:             177–178
Placement:        col 5,row 1; 1×2
Shadow GIDs:      179–180
Shadow placement: col 5,row 1; 1×2
Runtime asset:    /assets/deck/family-coffee-machine.png
```

### Planter trough

Moves into the **west edge of the child-room/domestic pocket**. The purpose of this placement is to make it read as a wall-adjacent human furnishing element rather than a floating floor token.

```text
Prop layer:       FloorProps
GIDs:             181–182
Placement:        col 1,row 9; 1×2
Shadow GIDs:      183–184
Shadow placement: col 1,row 9; 1×2
Runtime asset:    /assets/deck/family-planter-trough.png
```

### Round plant

Sits at the **living-room lower-right edge/corner**, away from the Memory Console and Coffee Machine. It may terminate the domestic furnishing zone but must not sit in front of wall furniture.

```text
Prop layer:       FloorProps
GID:              185
Placement:        col 7,row 6
Shadow GID:       186
Shadow placement: col 7,row 6
Runtime asset:    /assets/deck/family-round-plant.png
```

### Hologram pedestal

Moves with Transfer into the **south Transfer room**. It is close enough to read as Transfer control/diagnostic support but deliberately away from the Hall→Transfer entrance and the PRIMUS controlled door.

```text
Prop layer:       FloorProps
GID:              187
Placement:        col 10,row 16
Shadow GID:       188
Shadow placement: col 10,row 16
Runtime asset:    /assets/deck/family-hologram-pedestal.png
```

## Layout v3 collision

```text
family-coffee-machine-solid   x 5.18,y 1.52,w 0.64,h 0.82
family-planter-trough-solid   x 1.18,y 9.55,w 0.64,h 0.90
family-round-plant-solid      x 7.20,y 6.28,w 0.60,h 0.55
family-hologram-solid         x 10.18,y 16.22,w 0.64,h 0.62
```

Collision remains smaller than visual foliage/effect envelopes. No interaction logic is attached.

## Source/material integrity

The accepted source chunks, byte counts, hashes and runtime PNG dimensions are unchanged. `npm run materialize-art` remains the integrity gate.

## Layout v3 live QA gate

- Coffee Machine remains clearly wall-backed and accessible from below.
- Long planter genuinely reads as wall-adjacent domestic furnishing.
- Neither plant obscures wall furniture or a doorway.
- Round plant supports the living-room edge rather than circulation.
- Hologram clearly belongs to Transfer and does not crowd either controlled threshold.
- all four shadows remain aligned after relocation;
- topology remains readable on desktop and phone.

Do not mark Batch 2 `LIVE_ACCEPTED` until the Layout v3 room-level composition is accepted.
