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
CSS presentation           -> placement, key marker, clean aperture, motion easing
```

No image generation is used for the baseline Door pass.

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
- opening duration: **520 ms** with the accepted current easing;
- both leaves live inside a dedicated `leaf-clip` container exactly matching the 64 × 128 px Door object;
- `leaf-clip` uses `overflow: hidden` in Transfer Hall, so a leaf disappears precisely when it crosses the aperture boundary into the wall pocket;
- pocket collars remain outside that clip and stay visible;
- no continuous rail/guide line is drawn through the 128 px aperture.

Closing state — soft close:

- closing duration: **650 ms**;
- closing easing: `cubic-bezier(.16,1,.3,1)`;
- the curve is monotonic and strongly decelerates into the final position;
- explicit zero-translation endpoints prevent interpolation through `transform:none`;
- intended result: the leaves visibly slow during the final approach and stop without bounce/overshoot.

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
3. basic opening/closing speed: **good**;
4. open aperture itself: **clean**;
5. pocket collars: **not visually intrusive**;
6. status text removal: implemented;
7. coloured-key variant: implemented;
8. leaf clipping into wall pockets: **fixed and live-confirmed**.

Latest small motion defect:

- while closing, the upper leaf appeared to pass the final position briefly and then settle back.

Corrective implementation:

- opening remains 520 ms;
- closing gets a separate 650 ms soft-close curve;
- closing target is explicit zero translation;
- easing remains inside the 0..1 output range and reaches zero velocity at the end, so no bounce/overshoot is authored.

Do not mark `LIVE_ACCEPTED` until the soft-close revision is reviewed in the public Transfer Hall.

## QA gates

Automated/build:

- `npm run art:toolkit-test`;
- `npm test`;
- `npm run build`;
- existing `npm run validate-art-seams` must remain unchanged for accepted Walls;
- `DoorLayer.test.tsx` verifies the leaf clip wrapper and no TS-01 status text.

Live visual QA:

1. closed door reads darker and clearly separate from the wall;
2. opening remains at the accepted speed;
3. closing visibly decelerates on the final approach and does not overshoot/bounce;
4. while opening, leaves are visible only inside the doorway aperture and disappear exactly at the wall boundary;
5. fully open leaves are completely invisible;
6. open aperture has no guide rails or status text;
7. pocket collars remain unobtrusive;
8. future keyed doors show the required key colour without generic full-door red styling;
9. automatic opening and collision behavior are unchanged.
