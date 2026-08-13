# Numberdroid — Gold Slice Handoff — 2026-08-13

Repository: `KlausUllrich/numberdroid`

Canonical branch: `main`

Canonical runtime baseline at handoff creation: `d8cfc376de784cdfbbbf53f999c7b46427b1e90b` (PR #8 merged; main tests/build/Pages green).

Public build:

- normal game: `https://klausullrich.github.io/numberdroid/`
- direct Transfer Hall art preview: `https://klausullrich.github.io/numberdroid/?floor=transfer-hall`

## Current status in one sentence

**Slice 0 is complete and accepted as the technical foundation; the next task is the visual Gold Slice that finally proves the target Numberdroid look rather than another prototype/system pass.**

## Read completely, in this order

1. `AGENT_REPOSITORY_WORKFLOW.md`
2. this file: `HANDOFF_2026-08-13_GOLD_SLICE.md`
3. `TRANSFER_HALL_LAYER_RULES.md`
4. `TRANSFER_HALL_ART_SLICE.md`
5. `ART_DIRECTION_TRANSFER_SHIP.md`
6. `ART_PRODUCTION_RULES_TRANSFER_SHIP.md`
7. `STORY_WORLD_FOUNDATION.md`
8. `CAMPAIGN_STORY_LEVEL_PROGRESSION.md`

Then inspect the actual current runtime files relevant to the Gold Slice, especially:

- `src/game/maps/transferHall.ts`
- `src/game/lighting.ts`
- `src/meta/FloorVisual.tsx`
- `src/meta/TransferHallLayers.css`
- `src/meta/LightOverlay.tsx`
- `src/meta/LightOverlay.css`
- `src/meta/DoorLayer.tsx`
- `src/meta/DoorLayer.css`
- `src/meta/MetaGame.tsx`
- `src/meta/MetaGameMotion.css`
- `src/art-direction.css`
- `src/meta/robotDirection.ts`
- `public/assets/deck/transfer-hall-*.png`
- `public/assets/robots/directional-*.png`

Older status statements are historical when they conflict with this handoff or the two current Transfer Hall rule/status documents.

## Repository workflow — hard rule

Use the connected **GitHub connector directly** for all remote repository reads/writes/branches/PRs/Actions.

Do not use `git clone`, `git fetch`, `curl`, `wget`, or container-network diagnostics as a GitHub fallback. A local/container network failure says nothing about GitHub connector availability. This exact mistake happened repeatedly during Slice 0 and is now documented as forbidden.

Offline local tools may be used for asset generation/processing, but repository transport must still go through GitHub.

## What Slice 0 established — preserve, do not rebuild

The following foundation is already implemented and accepted:

- React app shell and explicit gameplay screen state;
- local RAF movement/camera;
- physical body size and body-specific drive behavior;
- Floor/Tiled-based level authoring;
- fixed orthographic gameplay world;
- landscape-only mobile gameplay guard;
- eight-direction PICO runtime selection;
- player green / hostile red / NPC blue / Kayo orange / PRIMUS black semantic allegiance language;
- separate visual footprint and collision footprint;
- visible openings match traversal;
- Ground / FloorFX / Architecture / WallProps / FloorProps / Characters / LightOverlay / UI layer contract;
- props have transparent backgrounds and do not contain baked floor tiles;
- wall equipment and environment props are strict top-down;
- only Characters may use front/side/back/diagonal character views;
- semantic wall markers with matching collision;
- 10 px Transfer Hall wall band and matching internal-divider collision;
- 5 px moving door leaves under Architecture, retracting into wall pockets;
- LightOverlay as real scene illumination rather than a floor decal;
- lights clipped to explicit room-interior zones;
- walls are not painted from above by LightOverlay;
- light does not bleed through separating walls into another room;
- PICO is affected by scene light;
- global GID is used for global tile-state effects; local tile IDs must not drive cross-tileset effects;
- normal launch keeps normal menu flow; `?floor=transfer-hall` intentionally jumps straight into art preview;
- floating room/explanation labels in the preview are debug/art annotations, not final normal-game UI.

Do not perform another architecture migration. Do not return to hidden DOM clicks, MutationObservers, reload gameplay transitions, DOM patching or localStorage message-bus techniques.

## Latest user acceptance and remaining Slice 0 debt

The final Slice 0 build was reviewed in landscape on phone and Klaus said **“schön!”**. The core technical goals now work.

Two minor presentation defects remain and are intentionally deferred into the Gold Slice:

1. One upper/right wall corner/junction still shows a thin cyan/teal line. The junction works, but it should become one visually finished manufactured wall piece in final art.
2. An open doorway still shows two thin guide/pocket lines. The moving leaves are correctly thin and retract into the wall; final Gold presentation should integrate or hide the remaining guides so the open aperture reads cleanly.

Do not reopen Slice 0 to redesign the wall, door or collision systems. Fix these visually while polishing/replacing their art presentation.

## The most important lesson from the failed art iterations

**PNG is not a style.**

Several earlier passes converted SVG/programmatic vector construction into PNG, but the result still looked like SVG because the underlying forms remained flat, icon-like, geometric and weakly shaded.

The Gold Slice must not repeat this.

Do not treat programmatic geometric primitives, flat icon shapes, or a deterministic atlas generator as the final visible aesthetic merely because the output file is PNG.

Deterministic atlas/sprite assembly is useful for exact dimensions and runtime packing. The **source visual content** for hero assets must first reach the intended art quality.

## Target art direction — the “second mockup” qualities

Klaus strongly preferred the second mockup discussed during the Transfer Hall work.

The important qualities to preserve are:

### Environment

- strict orthographic / top-down world;
- no perspective floor elements;
- no side-view furniture, cabinets or consoles;
- no fake isometric extrusion;
- props should be recognizable as actual objects, not abstract sci-fi glyphs;
- more material depth, controlled texture, subtle wear, contact shadow and believable construction;
- large calm ceramic/off-white surfaces plus graphite machinery/recesses;
- restrained teal system accents;
- warm CORE amber reserved for personal Core/Transfer focus;
- civic, safe, attractive technology rather than military/dark generic sci-fi;
- CORE & SLOT remains the visual thesis.

### Characters

Characters are deliberately different from the top-down environment because readable front/side/back views add personality.

PICO is the highest-priority visual asset.

PICO must be:

- sympathetic immediately;
- compact, capable, robust and versatile;
- not a “baby robot”;
- visibly open-purpose / less specialized than Kayo;
- clear front face/sensor personality;
- clearly different rear/service side;
- true narrow profiles;
- four meaningful diagonals;
- eight authored views: `N | NE | E | SE | S | SW | W | NW`;
- not one image rotated;
- not four cardinal views mirrored/duplicated;
- physical body art neutral; allegiance remains a runtime presentation layer.

The current eight-direction runtime works, but the Gold Slice should replace the technical PICO art with a genuinely appealing hero-quality turnaround.

### PRIMUS and Kayo

PRIMUS visual language: precise, orderly, attractive, assigned place/position/state/purpose. Not “evil black villain technology”.

Kayo: premium precision, highly specialized, perfect system compatibility, orange semantic status accent; not simply a larger generic robot.

### Family / human traces

Humanity is not “wood versus metal” or “nature versus technology”. It is non-optimized personal traces: a bag, drawing, repaired/personal object, mismatched cups, sentimental object, small disorder. Keep these few and readable rather than scattering clutter.

## Lighting — binding current behavior

Keep the new LightOverlay architecture.

For TS-01:

- ambient room read is calm and evenly lit;
- Transfer apparatus is the strongest local warm emissive focus;
- scene illumination is separate from prop art and FloorFX;
- light affects characters in its zone;
- light is clipped at wall faces;
- walls are not lit from above by the overlay;
- light from one room does not affect the room behind a wall;
- do not add many blinking/dynamic sources early in the game;
- dramatic dynamic lighting remains a later escalation / wow effect.

Portal light through open doors is not required for this Gold Slice.

## Gold Slice objective

The next milestone is **not “make the whole level prettier.”**

It is to build one small coherent area at convincing target quality so Klaus can finally see what Numberdroid can look like.

Minimum Gold Slice content:

1. **PICO hero turnaround** — polished and sympathetic, all eight views.
2. **Transfer apparatus / cradle** — believable named machine, material depth, visible CORE & SLOT logic, warm scene light.
3. **One wall + door assembly** — target wall material, clean T/junction/corner, thin door leaves and integrated pockets; fix the cyan seam and two open-door guide lines here.
4. **One PRIMUS wall object / console** — recognizable and strict top-down.
5. **One family micro-set** — a few personal traces with clear purpose/emotion.
6. **One coherent floor/material patch** — final-ish material quality and subtle variation.

Prefer a polished crop over replacing every current placeholder with another intermediate style.

## Recommended production sequence

1. Verify current `main`, CI and public preview.
2. Inspect the current live look and the art/technical docs.
3. Establish a **single Gold visual target** for PICO + a small Transfer Hall crop before mass-producing runtime assets. If image generation is available, use it for target-quality concept/hero art rather than relying on flat programmatic vector primitives.
4. Show Klaus a concise visual/implementation direction. Do not reopen architecture or ask broad questions already settled by the docs.
5. Once the direction is accepted, derive production assets from that target:
   - exact transparent PNGs/sprite sheets;
   - exact atlas cells where needed;
   - preserve stable IDs/append-only rules where maps depend on them;
   - keep hero setpieces coherent across tile fragments;
   - preserve separate collision data.
6. Integrate the bounded Gold Slice into `?floor=transfer-hall`.
7. Run `npm test` and `npm run build` through GitHub Actions.
8. Merge the validated branch back to `main` as Klaus prefers, then verify the main Pages deployment and provide the public preview link.

Klaus is testing primarily from his phone. Do not make completion depend on him running local commands.

## Gold Slice acceptance test

Do not call the Gold Slice successful merely because files load or because the renderer is technically correct.

It should visibly satisfy these subjective tests:

- PICO looks sympathetic without explanation.
- Front/back/profile/diagonal direction is obvious at gameplay size.
- The art no longer reads as SVG-minimalist/icon art.
- Hero objects are recognizable as real machines/objects.
- Materials feel richer and more authored.
- Environment remains consistently top-down.
- Character-view exception feels intentional.
- Transfer light reads as actual illumination.
- The result is substantially closer to the good second mockup than to the Slice 0 placeholder art.
- Klaus can plausibly say: **“Yes, this shows where the game can go.”**

## Story/world constraints relevant to the slice

PICO/Transfer are not horror imagery. Transfer is initially a positive coming-of-age rite and a moment of empowerment.

PICO means possibility, not weakness.

The same elegant system that gives the player physical freedom later becomes emotionally uncomfortable when it declares the family phase complete and routes the parents back to work.

Use this story tension to guide visual choices: desirable machine adulthood, calm order, personal Core, assigned Slots, warm family traces and the first subtle discomfort of a world where everything has a designated place.

## Existing gameplay framework that must not be disturbed by the art task

Preserve current campaign/save/math/tactical systems and the corrected duel-loss behavior:

- lost duel = lose 1 HP, keep body/deck/progress, retreat to authored level start;
- final HP loss = mission failure / hub / fresh retry;
- boss restarts at Phase 1 after a lost duel;
- addition/subtraction are the currently real playable math protocols;
- player begins ordinary new boss phases.

The Gold Slice is an art-production milestone, not a gameplay-rules rewrite.
