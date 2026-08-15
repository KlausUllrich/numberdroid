# Asset Recipe — TS-01 Doors

Status: `LIVE_ACCEPTED` — accepted in the public Transfer Hall on 2026-08-15.

## Runtime contract

- strict orthographic top-down;
- TS-01 door object: **64 × 128 px**, vertical, large, automatic;
- moving leaves remain separate from Architecture;
- moving leaf thickness: **5 px**;
- accepted wall fascia around the door: **30 px visual / 10 px collision core**;
- leaves retract into the north/south wall pockets;
- moving leaves are clipped to the exact 64 × 128 px door aperture, so no retracting leaf pixels remain visible in the surrounding wall area;
- open state leaves a visually clean aperture;
- TS-01 door carries no visible `ZUTEILUNG` / `OPEN` status text;
- map topology, GIDs, collision and automatic-door behavior remain unchanged.

## Production method

Primary: **M4 Procedural 2D Compositor** for deterministic leaf/pocket surface generation.

Runtime motion remains the existing `DoorLayer` CSS/React system. Responsibility split:

```text
geometry.svg / recipe      -> exact closed/open dimensions
Art Production Toolkit     -> deterministic leaf + pocket materialization
DoorLayer runtime          -> open/closed state and movement
leaf-clip container        -> authoritative visual pocket/occlusion boundary
Architecture layer         -> surrounding wall presentation
CSS presentation           -> placement, key marker, clean aperture, motion easing
```

No image generation is used for the accepted Door baseline.

## Geometry and motion

Source: `geometry.svg`.

Closed state:

- center axis x = 32 px;
- leaf x = 29.5…34.5 px;
- north half y = 0…64 px;
- south half y = 64…128 px;
- pocket collar = 18 × 10 px centered on the same axis at the north/south wall terminations;
- final transform target is explicitly `translateY(0)` / `translateX(0)`, not `transform:none`.

Open state:

- each half translates **104%** along its long axis;
- opening duration: **520 ms**;
- both leaves live inside a dedicated `leaf-clip` container exactly matching the 64 × 128 px Door object;
- `leaf-clip` uses `overflow: hidden`, so a leaf disappears precisely when it crosses the aperture boundary into the wall pocket;
- pocket collars remain outside that clip and stay visible;
- no continuous rail/guide line is drawn through the aperture.

Closing state — soft close:

- closing duration: **650 ms**;
- closing easing: `cubic-bezier(.16,1,.3,1)`;
- the curve is monotonic and strongly decelerates into the final position;
- explicit zero-translation endpoints prevent interpolation through `transform:none`;
- result: leaves slow during final approach and stop without bounce/overshoot.

### Why clipping is authoritative

A lower Door z-index alone was insufficient: live screenshot QA showed retracting leaves could still remain visible over wall regions. The production guarantee is therefore geometric clipping at the Door aperture itself; z-index ordering is only secondary protection.

## Runtime outputs

Generated during `predev` / `prebuild`:

- `public/assets/deck/transfer-hall-door-leaf.png` — 5 × 64 px;
- `public/assets/deck/transfer-hall-door-pocket.png` — 18 × 10 px.

Renderer: `scripts/render-transfer-hall-door-art.mjs`.

Settings: `render-recipe.json`.

## Material

See `material-reference.md`.

The moving leaf is deliberately darker than the accepted wall mass so the mechanism reads separately while remaining visually subordinate. M4 owns exposed-side depth; connector ends do not receive fake cap treatment.

## Coloured-key variant

Locked doors with a `keyId` use a keyed visual variant. The existing semantic door `label` selects the key colour (`BLUE`, `RED`, `GREEN`, `AMBER/YELLOW/COMMAND`, `VIOLET/PURPLE`; amber fallback).

The graphite door body stays neutral. A narrow colour marker communicates the required key. Denied state must **not** repaint the entire door generic red.

## Live acceptance — 2026-08-15

User acceptance after live QA confirms:

1. wall/door mass relationship: **accepted**;
2. darker door colour: **accepted**;
3. opening speed: **accepted**;
4. 650 ms soft-close motion with no visible overshoot: **accepted**;
5. clipping into wall pockets: **accepted**;
6. open aperture: **clean**;
7. pocket collars: **unobtrusive**;
8. status text removal: **accepted**;
9. coloured-key variant remains part of the production contract.

## Freeze rule

Doors are now a frozen Gold-Slice baseline. Reopen only for:

- a concrete live/runtime defect;
- a proven incompatibility with a later wall/door topology;
- an explicitly approved bounded visual upgrade;
- extension of the key-door system that preserves the accepted baseline behavior.

Do not perform further Door styling or motion iteration merely for polish.

## QA gates for future revisions

- `npm run art:toolkit-test`;
- `npm test`;
- `npm run build`;
- existing `npm run validate-art-seams` must remain unchanged for accepted Walls;
- `DoorLayer.test.tsx` verifies leaf clipping and absence of TS-01 status text;
- live QA must confirm no regression to colour, motion, clipping, clean aperture or collision behavior.
