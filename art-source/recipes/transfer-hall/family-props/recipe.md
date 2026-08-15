# Asset Recipe — TS-01 Family Props

Status: `PLANNED` — complete the first deliberate micro-set before production generation.

## Visual purpose

Family props communicate human/personal traces inside a highly ordered machine society. They should feel warm, slightly irregular and meaningful without becoming rustic, sentimental clutter or visually noisy.

Candidate vocabulary from the approved Transfer Ship art direction:

- family table / waiting module;
- cups or mismatched drinking containers;
- bag / fabric item;
- plant(s);
- child drawing / keepsake / personal display item.

These are candidate functions, not a requirement to generate every item at once.

## Binding constraints

- strict orthographic top-down environment perspective;
- isolated transparent objects; **no baked floor or wall**;
- deliberate runtime footprint and separate collision only where needed;
- contact shadow only in a small local envelope and owned explicitly;
- warm/personal accents are local, not global grading;
- no filler clutter;
- do not use the current placeholder prop atlas as authoritative source geometry;
- preserve current layer ownership: wall-mounted objects belong to WallProps, free-standing objects to FloorProps, floor-projected markings/shadows to FloorFX only when deliberately separated.

## Method-selection gate — required before generation

Do **not** invent `geometry.svg` merely because previous geometry-critical recipes used one.

For each prop/micro-set first declare:

```text
Primary production method:
Material/source method:
Optional finishing method:
Geometry authority:
Material authority:
Alpha/background authority:
Packing authority:
Why this split fits the prop:
```

Likely first hypothesis for expressive isolated family props is **M1 Direct Generative Source + deterministic extraction/alpha/packing**. M4 is appropriate only if an object has genuinely fixed deterministic geometry that should own the final silhouette.

If the source needs generic background removal, evaluate the PLANNED toolkit capability at `docs/art-production-toolkit/tools/freistellen.md`; do not claim it exists until implemented/proven.

## Task Card — complete for each deliberate micro-set

Before production generation/editing record:

- exact target runtime footprint/cell envelope;
- perspective;
- background/alpha requirement;
- allowed objects/content;
- forbidden content;
- palette/material references;
- contact-shadow ownership/envelope;
- source layout (single object vs deliberately grouped micro-set);
- extraction/crop/downscale/packing plan;
- target GID/runtime integration context;
- production QA;
- map-context/live QA.

A footprint guide may be deterministic even when the **visual silhouette is model-authored**. Do not confuse placement envelope with geometry authority.

## Narrative trigger

Generic family traces can be authored from the approved art direction without reading the complete campaign story.

Before authoring **specific narrative content** — e.g. what a child drawing depicts, whose keepsake it is, a message, a specific family event or a canonical parent/child object — activate the STORY trigger in `docs/agents/ROLE_ENTRYPOINTS.md` and read the relevant Story/World contract.

## Gameplay / engineering trigger

Before changing collision, interaction, pickups, map/GID structure, atlas ordering, runtime layers or renderer behavior, activate the Game Design/Engineering trigger in `ROLE_ENTRYPOINTS.md`.

Do not change map/game logic merely to rescue unsuitable prop art.

## First-pass scope rule

Start with **one coherent family micro-set** and prove the complete source → alpha/extraction → packing → live QA path. Do not generate the full remaining Transfer Hall prop inventory in one call.

The first agent should inspect the current live room, placeholder atlas usage and actual map GIDs before proposing the micro-set.
