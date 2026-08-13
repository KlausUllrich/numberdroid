# Numberdroid — Prompt for the next agent — Gold Slice

You are continuing **Numberdroid** in:

`KlausUllrich/numberdroid`

Canonical branch is **`main`**. Do not continue old PR/architecture branches.

## First: read these completely, in this order

1. `AGENT_REPOSITORY_WORKFLOW.md`
2. `HANDOFF_2026-08-13_GOLD_SLICE.md`
3. `TRANSFER_HALL_LAYER_RULES.md`
4. `TRANSFER_HALL_ART_SLICE.md`
5. `ART_DIRECTION_TRANSFER_SHIP.md`
6. `ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
7. `STORY_WORLD_FOUNDATION.md`
8. `CAMPAIGN_STORY_LEVEL_PROGRESSION.md`

Then inspect the actual current code/assets relevant to Transfer Hall before changing anything.

## Repository workflow is binding

Use the connected **GitHub connector directly** for repository reads/writes/branches/PRs/Actions.

Never use container-network `git clone`, `git fetch`, `curl`, `wget`, or similar as a GitHub fallback. A container network failure does not mean GitHub is unavailable.

Offline tools may be used for asset generation, but repository transport stays on the GitHub connector.

## Verify current baseline

Before changing anything:

- verify current `main` HEAD;
- verify latest GitHub Actions tests/build/Pages;
- inspect the public preview:
  `https://klausullrich.github.io/numberdroid/?floor=transfer-hall`

At handoff creation, the accepted Slice 0 baseline was main commit `d8cfc376de784cdfbbbf53f999c7b46427b1e90b`, PR #8 merged, main tests/build/Pages green. Treat newer `main` as authoritative if it has moved.

## Slice 0 is DONE

Do not start another architecture/foundation pass.

Preserve the implemented contracts:

- orthographic top-down environment;
- characters alone may use front/side/back/diagonal views;
- eight-direction PICO runtime;
- landscape-only mobile gameplay;
- separate Ground / FloorFX / Architecture / WallProps / FloorProps / Characters / LightOverlay / UI;
- no baked floor pixels inside props;
- visual footprint separate from collision footprint;
- visible openings match traversal;
- 10 px wall / 5 px moving door-leaf foundation;
- moving door leaves retract below Architecture into wall pockets;
- room-clipped LightOverlay illuminates PICO, not walls, and does not bleed into the next room;
- global GID for global tile-state effects;
- direct `?floor=transfer-hall` art preview without changing normal menu/campaign flow;
- floating room labels in the preview are debug/art annotations, not final campaign UI.

Two small visual defects are intentionally deferred into Gold art:

1. a thin cyan/teal line remains at one wall corner/junction;
2. an open door can still show two thin guide/pocket lines.

Fix their presentation during the Gold Slice. Do not redesign the underlying wall/door/collision systems.

## Your next task: the actual visual Gold Slice

The current art is still technical placeholder art and is **not** the target look.

The central lesson from previous attempts is:

**PNG is not a style.** Flat programmatic/vector-like source art still looks like SVG even when exported to PNG.

The Gold Slice must finally move toward the stronger **second mockup** direction:

- richer, authored materiality;
- recognizable real objects rather than abstract sci-fi symbols;
- civic/optimistic Transfer technology rather than generic military sci-fi;
- strict top-down environment;
- characterful front/side/back robot sprites;
- CORE & SLOT visual grammar;
- warm personal family traces;
- calm early-game lighting with Transfer as the restrained warm focus.

### Highest priority: PICO

PICO must become a genuine hero character:

- sympathetic immediately;
- compact, capable, versatile, not babyish;
- neutral body material; allegiance remains runtime color treatment;
- eight genuinely authored directions:
  `N(back) | NE(rear 3/4) | E(profile) | SE(front 3/4) | S(front) | SW(front 3/4) | W(profile) | NW(rear 3/4)`;
- clear face/personality at the front;
- unmistakable rear/service detail;
- true profiles and meaningful diagonals;
- no rotated single image and no duplicated/mirrored four-direction cheat.

## Bounded Gold Slice deliverable

Do not attempt all Transfer Ship art.

Create one small coherent target-quality area containing:

1. polished PICO 8-way turnaround;
2. polished Transfer apparatus/cradle;
3. one final-ish wall + door assembly, including cleanup of the cyan corner seam and open-door guide lines;
4. one strict top-down PRIMUS console/wall object;
5. one small family/personal prop set;
6. one convincing floor/material patch;
7. the existing LightOverlay integrated with the new art.

Prefer one truly convincing crop over replacing the whole room with another intermediate visual style.

## Production approach

First establish the Gold visual target before mass-producing runtime replacements.

If image generation is available, use it for high-quality concept/hero source art. Do not fall back to simple geometric SVG/CSS construction as the final visible aesthetic.

After the target is established, derive exact transparent runtime PNGs/sprite sheets/atlas fragments while preserving stable IDs and collision data.

Do not ask Klaus broad questions that are already answered by the docs. Your first response should be short:

1. summarize what you understood;
2. state the exact Gold Slice block you will produce first;
3. identify any genuinely blocking ambiguity only if one exists.

The goal is to move quickly into visual production, not another long design discussion.

## Acceptance criteria

The Gold Slice is not done merely because tests pass. It must visibly achieve:

- PICO looks sympathetic;
- all eight directions are obvious at gameplay size;
- art no longer reads as SVG-minimalist/icon art;
- hero props are recognizable named things;
- materials have believable depth/texture/shadow;
- environment remains top-down-only;
- character-view exception feels deliberate;
- Transfer light reads as scene illumination;
- result is clearly closer to the good mockup than the Slice 0 placeholder.

## Implementation/merge workflow

Klaus is testing primarily on his phone and prefers the agent to do the repository work.

Use a short branch from current `main`, implement the bounded Gold Slice, run/verify GitHub Actions tests and production build, then merge the validated branch back to `main` and verify Pages. Give Klaus the live preview link afterward.

Do not require Klaus to run local commands.
