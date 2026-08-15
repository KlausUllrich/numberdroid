# Asset Recipe — TS-01 Doors

Status: `INTEGRATED / LIVE_QA_PENDING`

## Runtime contract

- strict orthographic top-down;
- TS-01 door object: **64 × 128 px**, vertical, large, automatic;
- moving leaves remain separate from Architecture and render below walls;
- moving leaf thickness: **5 px**;
- accepted wall fascia around the door: **30 px visual / 10 px collision core**;
- leaves retract into the north/south wall pockets;
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
Architecture layer         -> occlusion while leaves retract into walls
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
- transform duration: **520 ms**, exactly twice the first Gold candidate duration after live QA found 260 ms too fast;
- the whole Door stacking context is below Architecture, so leaves cannot paint over the wall while retracting;
- no continuous rail/guide line is drawn through the 128 px aperture.

## Runtime outputs

Generated during `predev` / `prebuild`:

- `public/assets/deck/transfer-hall-door-leaf.png` — 5 × 64 px;
- `public/assets/deck/transfer-hall-door-pocket.png` — 18 × 10 px.

Renderer: `scripts/render-transfer-hall-door-art.mjs`.

Settings: `render-recipe.json`.

## Material

See `material-reference.md`.

The moving leaf is deliberately darker than the accepted wall mass. This was requested in live QA so the door reads as a separate moving mechanism while remaining visually subordinate.

M4 owns the visible exposed-side depth; connectors at the two leaf ends do not receive fake cap treatment.

## Coloured-key variant

Locked doors with a `keyId` use a keyed visual variant. The existing semantic door `label` selects the key colour (`BLUE`, `RED`, `GREEN`, `AMBER/YELLOW/COMMAND`, `VIOLET/PURPLE`; amber fallback).

The graphite door body stays neutral. A narrow colour marker communicates the required key. Denied state must **not** repaint the entire door generic red, because that would destroy the actual key-colour information.

The variant is reusable by later maps without changing door geometry or runtime access logic.

## Live QA feedback incorporated — 2026-08-15

First Gold candidate feedback:

1. wall/door mass relationship: **good**;
2. door should be darker for clearer separation: **changed**;
3. opening/closing was too fast: **260 ms → 520 ms**;
4. leaves painted over the wall while retracting: **fixed with a Door stacking context below Architecture**;
5. open aperture was clean: **keep**;
6. pocket collars were not visually intrusive: **keep**;
7. remove `ZUTEILUNG` / open-state text: **removed for TS-01**;
8. add coloured-key door variant: **implemented as semantic colour marker**.

Do not mark `LIVE_ACCEPTED` until this revised public Transfer Hall is reviewed.

## QA gates

Automated/build:

- `npm run art:toolkit-test`;
- `npm test`;
- `npm run build`;
- existing `npm run validate-art-seams` must remain unchanged for accepted Walls.

Live visual QA:

1. closed door reads darker and clearly separate from the wall;
2. 520 ms motion feels deliberate rather than abrupt;
3. leaves disappear fully below the wall with no overdraw;
4. open aperture has no guide rails or status text;
5. pocket collars remain unobtrusive;
6. future keyed doors show the required key colour without generic full-door red styling;
7. automatic opening and collision behavior are unchanged.
