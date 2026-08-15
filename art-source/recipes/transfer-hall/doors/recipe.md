# Asset Recipe — TS-01 Doors

Status: `INTEGRATED / LIVE_QA_PENDING`

## Runtime contract

- strict orthographic top-down;
- TS-01 door object: **64 × 128 px**, vertical, large, automatic;
- moving leaves remain separate from Architecture;
- moving leaf thickness: **5 px**;
- accepted wall fascia around the door: **30 px visual / 10 px collision core**;
- leaves retract into the north/south wall pockets;
- the moving leaves are clipped to the exact 64 × 128 px door aperture, so no retracting leaf pixels may remain visible inside the surrounding wall area;
- open state must leave a visually clean aperture;
- TS-01 door carries no visible `ZUTEILUNG` / `OPEN` status text;
- map topology, GIDs, collision and automatic-door behavior remain unchanged.

## Production method

Primary: **M4 Procedural 2D Compositor** for the deterministic leaf/pocket surface.

Runtime motion remains the existing `DoorLayer` CSS/React system. This is deliberately a hybrid responsibility split:

```text
geometry.svg / recipe      -> exact closed/open dimensions
Art Production Toolkit     -> deterministic leaf + pocket materialization
DoorLayer runtime          -> open/closed state and movement
leaf-clip container        -> authoritative visual pocket/occlusion boundary
Architecture layer         -> surrounding wall presentation
CSS presentation           -> placement, key marker, clean aperture
```

No image generation is used for the baseline Door pass.

## Geometry and motion

Source: `geometry.svg`.

Closed state:

- center axis x = 32 px;
- leaf x = 29.5…34.5 px;
- north half y = 0…64 px;
- south half y = 64…128 px;
- pocket collar = 18 × 10 px centered on the same axis at the north/south wall terminations.

Open state:

- each half translates **104%** along its long axis;
- transform duration: **520 ms**;
- both leaves live inside a dedicated `leaf-clip` container exactly matching the 64 × 128 px Door object;
- `leaf-clip` uses `overflow: hidden` in Transfer Hall, so a leaf disappears precisely when it crosses the aperture boundary into the wall pocket;
- pocket collars remain outside that clip and stay visible;
- no continuous rail/guide line is drawn through the 128 px aperture.

### Why clipping is authoritative

The first revised Gold candidate attempted to solve wall overdraw only by putting the Door stacking context below Architecture. Live screenshot QA showed that this was insufficient: the moved leaf still painted visibly over the wall region.

Therefore z-index ordering is only secondary protection. The production guarantee is geometric clipping at the Door aperture itself.

## Runtime outputs

Generated during `predev` / `prebuild`:

- `public/assets/deck/transfer-hall-door-leaf.png` — 5 × 64 px;
- `public/assets/deck/transfer-hall-door-pocket.png` — 18 × 10 px.

Renderer: `scripts/render-transfer-hall-door-art.mjs`.

Settings: `render-recipe.json`.

## Material

See `material-reference.md`.

The moving leaf is deliberately darker than the accepted wall mass so the mechanism reads separately while remaining visually subordinate.

M4 owns the visible exposed-side depth; connectors at the two leaf ends do not receive fake cap treatment.

## Coloured-key variant

Locked doors with a `keyId` use a keyed visual variant. The existing semantic door `label` selects the key colour (`BLUE`, `RED`, `GREEN`, `AMBER/YELLOW/COMMAND`, `VIOLET/PURPLE`; amber fallback).

The graphite door body stays neutral. A narrow colour marker communicates the required key. Denied state must **not** repaint the entire door generic red, because that would destroy the actual key-colour information.

The variant is reusable by later maps without changing door geometry or runtime access logic.

## Live QA history — 2026-08-15

Accepted observations so far:

1. wall/door mass relationship: **good**;
2. darker door colour: **good**;
3. 520 ms opening/closing speed: **good**;
4. open aperture itself: **clean**;
5. pocket collars: **not visually intrusive**;
6. status text removal: implemented;
7. coloured-key variant: implemented.

Remaining defect found by screenshot QA:

- retracting leaves still remained visible over the wall despite lower z-index.

Corrective implementation:

- moving leaves wrapped in `leaf-clip`;
- Transfer Hall `leaf-clip` = exact Door bounds + `overflow: hidden`;
- regression test verifies clip wrapper and CSS clipping contract.

Do not mark `LIVE_ACCEPTED` until this clipping revision is reviewed in the public Transfer Hall.

## QA gates

Automated/build:

- `npm run art:toolkit-test`;
- `npm test`;
- `npm run build`;
- existing `npm run validate-art-seams` must remain unchanged for accepted Walls;
- `DoorLayer.test.tsx` verifies the leaf clip wrapper, no TS-01 status text, and the Transfer Hall clipping CSS contract.

Live visual QA:

1. closed door reads darker and clearly separate from the wall;
2. 520 ms motion feels deliberate rather than abrupt;
3. while opening, leaves are visible only inside the doorway aperture and disappear exactly at the wall boundary;
4. fully open leaves are completely invisible;
5. open aperture has no guide rails or status text;
6. pocket collars remain unobtrusive;
7. future keyed doors show the required key colour without generic full-door red styling;
8. automatic opening and collision behavior are unchanged.
