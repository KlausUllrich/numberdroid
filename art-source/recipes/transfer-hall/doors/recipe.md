# Asset Recipe — TS-01 Doors

Status: `PLANNED` — must be completed before the Door image-generation pass.

## Known binding runtime contract

- strict orthographic top-down;
- moving door leaves remain separate from Architecture and render below walls;
- current moving leaf thickness remains 5 px unless deliberately re-approved;
- leaves retract into wall pockets;
- open state must leave a visually clean aperture;
- the two thin guide/pocket lines visible in the old fully-open state are cosmetic debt to remove;
- wall/collision topology remains unchanged;
- current TS-01 threshold is a vertical, two-tile-high large automatic door.

## To author before generation

- `geometry.svg`: exact closed/open/pocket geometry against the accepted current wall fascia;
- `material-reference.md`: wall-compatible material plus door-specific construction cues;
- `prompt.md`: material-only edit prompt;
- exact runtime extraction/animation state mapping;
- closed/open assembly QA.

Do not generate final Door art until these fields are filled. Do not invent door geometry from text.
