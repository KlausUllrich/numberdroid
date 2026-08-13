# TS-01 Transfer Hall — playable art slice

Status: first larger implementation pass on top of the approved Transfer Ship art direction.

## What is now testable

Open the public build with:

`?floor=transfer-hall`

The room deliberately places three visual ideas next to each other:

1. **Family niche** — warm personal traces, mismatched objects, drawing, keepsake and two distinct parent silhouettes.
2. **Transfer** — CORE & SLOT cradle, body dock, route guidance and PICO as a compact open-purpose body.
3. **PRIMUS allocation** — black system presence, ordered terminals, an orange Kayo status body, blue work robot and red security robot.

## Directional character rule

Gameplay robots no longer rotate a single overhead image. Each body has eight authored turnaround views:

`N · NE · E · SE · S · SW · W · NW`

The environment remains orthographic. Characters may use front/side/back views for personality and readability.

Affiliation remains semantic rather than body-specific:

- green = player
- red = opponent
- blue = NPC / neutral worker
- orange = Kayo
- black = PRIMUS

A captured red body therefore becomes the same body rendered in the player layer and reads green.

## Atlas contract

`public/assets/deck/vs2-tech-tiles.svg` is now 4 columns × 8 rows = 32 stable 64 px tiles.

Tiles 1–4 retain their previous IDs. New content only appends; IDs are never reordered.

5–12 boundaries/corners, 13–16 functional/system tiles, 17–32 Transfer Hall story props and character markers.
