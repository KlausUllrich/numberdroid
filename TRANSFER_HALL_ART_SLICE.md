# TS-01 Transfer Hall — Slice 0 complete / Gold Slice next

Status: **Slice 0 technical foundation accepted on 2026-08-13.**  
Current canonical runtime: `main` after PR #8.  
Public preview: `https://klausullrich.github.io/numberdroid/?floor=transfer-hall`

## What Slice 0 proved

The Transfer Hall is now the technical base for the visual Gold Slice. The following systems are working and should be preserved rather than rebuilt:

- fixed orthographic top-down environment;
- eight visually distinct character directions for PICO;
- landscape-only mobile gameplay;
- separate Ground / FloorFX / Architecture / WallProps / FloorProps / Characters / LightOverlay / UI layers;
- props on transparent backgrounds with no baked floor cells;
- visual footprint separated from collision footprint;
- thin semantic walls with matching collision and reliable traversal;
- moving door leaves below Architecture, retracting into wall pockets;
- room-clipped LightOverlay that illuminates PICO but not walls or the neighboring room;
- global-GID-only tile-state effects, avoiding accidental prop glow;
- explicit direct art-preview route without changing the normal campaign/menu flow.

The final Slice 0 review was positive: the foundation now reads as coherent and playable. Do not spend another phase redesigning these systems before attempting target-quality art.

## Important: current art is not the target look

The present floor, props and PICO are still **production placeholders / technical art**. Earlier iterations showed that simply converting vector-like construction to PNG does not solve the visual problem: raster files can still look like SVG icons if their forms, materials and shading remain flat and geometric.

The Gold Slice must therefore be **art-first**, not another system-first pass.

Target direction is the stronger second visual mockup discussed with Klaus:

- environment and architecture remain strict top-down / orthographic;
- characters are the deliberate exception and use readable front/side/back/diagonal views;
- PICO must be immediately sympathetic and characterful rather than a neutral appliance icon;
- materials need depth, controlled texture, contact shadow and believable object construction;
- focal objects must read as real named things, not abstract technology symbols;
- the room should feel like a designed civic Transfer facility, not a generic sci-fi tile editor;
- CORE & SLOT remains the core visual grammar;
- family traces are warm/personal/non-optimized without becoming a wood-versus-metal cliché;
- PRIMUS is orderly, precise and attractive rather than evil-looking;
- lighting stays calm in TS-01, with the Transfer apparatus as the primary restrained warm emissive focus.

## Gold Slice scope

Do **not** try to finish every Transfer Ship room or all campaign art.

Build one polished, coherent target-quality slice that proves the final direction. It should contain at minimum:

1. **PICO hero character** — genuinely appealing, eight authored directions, strong front/back distinction, readable profiles and diagonals.
2. **Transfer apparatus / cradle** — a believable hero machine with clear function, material depth and controlled warm emissive light.
3. **One finished wall + door assembly** — final-ish wall material, clean junction, thin moving door leaves, door pockets integrated into the architecture.
4. **One PRIMUS wall object / console** — strict top-down, precise and restrained, not a side-view cabinet.
5. **One family micro-set** — a few personal traces that communicate humanity without looking like random clutter.
6. **One coherent floor/material sample** — enough variation and shading to establish the target material language without returning to noisy generic sci-fi panels.

Prefer a small area at convincing final quality over replacing the entire room with another intermediate style.

## Gold Slice acceptance criteria

The slice is successful only if Klaus can look at the live build and say, without explanation:

- “PICO is sympathetic.”
- “I can clearly read front, back, profile and diagonal directions.”
- “These objects look like real things rather than SVG-style symbols.”
- “The room feels materially richer and much closer to the good mockup.”
- “The top-down environment and character-view exception feel intentional rather than inconsistent.”
- “The light feels like illumination of the scene, not a colored decal on the floor.”
- “This finally shows where Numberdroid can visually go.”

## Known cosmetic debt carried into the Gold Slice

Two small Slice 0 seams are intentionally deferred and should be fixed as part of final wall/door art rather than by reopening the foundation:

- a thin cyan/teal highlight remains visible at one outer/junction corner;
- an open doorway can still show two thin guide/pocket lines after the moving leaves retract.

The underlying wall, collision, LightOverlay and door-pocket systems are accepted. Fix presentation, not architecture.

## Preview labels

`FAMILIENBEREICH`, `TRANSFER`, `PRIMUS-ZUTEILUNG` and their explanatory subtitles are art/debug preview annotations. They are useful while evaluating the Gold Slice but are not normal final-game floating UI. Robot name plates are a separate system.

## Binding technical companion

Read and preserve `TRANSFER_HALL_LAYER_RULES.md` before modifying runtime art.
