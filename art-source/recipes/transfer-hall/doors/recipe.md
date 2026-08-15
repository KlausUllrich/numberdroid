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
- map topology, GIDs, collision and automatic-door behavior remain unchanged.

## Production method

Primary: **M4 Procedural 2D Compositor** for the deterministic leaf/pocket surface.

Runtime motion remains the existing `DoorLayer` CSS/React system. This is deliberately a hybrid responsibility split:

```text
geometry.svg / recipe      -> exact closed/open dimensions
Art Production Toolkit     -> deterministic leaf + pocket materialization
DoorLayer runtime          -> open/closed state and movement
Architecture layer         -> occlusion while leaves retract into walls
CSS presentation           -> placement, status label, clean aperture
```

No image generation is used for the baseline Door pass.

## Geometry

Source: `geometry.svg`.

Closed state:

- center axis x = 32 px;
- leaf x = 29.5…34.5 px;
- north half y = 0…64 px;
- south half y = 64…128 px;
- pocket collar = 18 × 10 px centered on the same axis at the north/south wall terminations.

Open state:

- each half translates **104%** along its long axis;
- the leaf disappears into the neighboring wall pocket and remains below Architecture;
- no continuous rail/guide line is drawn through the 128 px aperture.

## Runtime outputs

Generated during `predev` / `prebuild`:

- `public/assets/deck/transfer-hall-door-leaf.png` — 5 × 64 px;
- `public/assets/deck/transfer-hall-door-pocket.png` — 18 × 10 px.

Renderer: `scripts/render-transfer-hall-door-art.mjs`.

Settings: `render-recipe.json`.

## Material

See `material-reference.md`.

The material is a quiet graphite family, slightly lighter than the accepted walls. M4 owns the visible exposed-side depth; connectors at the two leaf ends do not receive fake cap treatment.

## Cosmetic debt resolved by this candidate

The old Transfer Hall `.frame` drew two full-length vertical guide/pocket lines through the doorway. The Gold candidate replaces those lines with compact pocket collars only at the real wall terminations.

The open-state status label is hidden so the aperture itself reads cleanly.

## QA gates

Automated/build:

- `npm run art:toolkit-test`;
- `npm test`;
- `npm run build`;
- existing `npm run validate-art-seams` must remain unchanged for accepted Walls.

Live visual QA:

1. closed door reads as one thin manufactured moving element inside the substantial wall;
2. open leaves disappear fully into the wall pockets;
3. no two guide lines remain through the aperture;
4. pocket collars do not look like bright framed props;
5. door remains subordinate to PICO/Transfer hero focus;
6. automatic opening and collision behavior are unchanged.

Do not mark `LIVE_ACCEPTED` until the public Transfer Hall is reviewed by the user.
