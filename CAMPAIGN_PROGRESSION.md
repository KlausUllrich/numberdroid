# Numberdroid — Campaign & Progression Model

This document defines the binding campaign structure and progression architecture for Numberdroid. Read it together with `MENU_HUB_FLOW.md`, `LEARNING_PROFILES.md`, `ENCOUNTER_ARCHETYPES.md`, and `CODEX_HANDOFF.md`.

## Product promise

Every player profile plays the **same complete story campaign**.

A child with modest mathematics knowledge and an older child/adult with stronger mathematics knowledge should:
- visit the same story locations and missions,
- meet the same recognizable robot classes and bosses,
- unlock the same campaign mechanics,
- experience the same major story beats,
- receive concrete arithmetic tuned to that profile.

Do not create separate young/easy and advanced campaigns. Mathematically advanced players do not skip early story content; lower-skill players are not prevented from reaching later story content.

## Internal campaign target versus player-facing presentation

Current production/content planning target: **approximately 25 decks**, currently represented as roughly 5 acts × about 5 decks.

This is an internal authoring target, not a promise or level count shown to the player. Runtime/data architecture remains count-agnostic.

Binding UI rule from `MENU_HUB_FLOW.md`:
- never present all 25 decks as a global level-select grid,
- never reveal the total number of acts from the personal hub,
- the player sees only the current thematic campaign area/act and progress inside it,
- future areas are revealed by story progression.

The exact final number of decks and acts may change after real production content and playtime data exist.

## Campaign arc direction

The current internal planning structure is:

1. **Infiltration / takeover foundation**
   - movement, scan, duel, transfer,
   - simple robot identities,
   - first body differences,
   - basic access/security mechanics.
2. **Security systems**
   - guards, patrols, keys/access levels,
   - stronger body roles,
   - pursuit and route planning.
3. **Systems / wider operation**
   - more body/Joker skills,
   - richer number-board mechanics,
   - environmental interactions,
   - stronger combinations of known systems.
4. **Hunt / exploitation**
   - Treasure Golem / Beutedroide capture logic,
   - traps, containment, rerouting,
   - higher systemic density.
5. **Command / mastery**
   - combinations of established systems,
   - strong mission identities,
   - more demanding bosses,
   - final story escalation.

Names, locations and themes are story/art TBD. Hubs may change theme dramatically between areas (ship, planet, enemy mothership, etc.) while using the same reusable campaign/hub data model.

## Independent progression dimensions

Difficulty is deliberately not one scalar.

### 1. Player mathematics profile

Each profile owns a mathematics baseline/evidence model. It determines what concrete arithmetic is appropriate without changing story progression.

Initial onboarding differs by audience:
- child profiles receive a friendly arithmetic starting estimate,
- adult profiles currently receive a higher +/- default without extra onboarding friction,
- later profile/statistics UI may allow adjustment and explain calibration.

See `LEARNING_PROFILES.md`.

### 2. Robot mathematics role

Recognizable robot variants have authored mathematical roles independent of tactical behavior:
- **comfort/basic** — quick, highly achievable arithmetic,
- **practice/core** — current working level,
- **stretch/security** — noticeably more demanding,
- **specialist** — emphasizes a particular operation/mechanic,
- **boss** — staged/complex challenge, not simply larger numbers.

A neutral specialist may be mathematically demanding. An aggressive small bot may still use comfort arithmetic. `neutral/guard/patrol/aggressive` must never implicitly define math difficulty.

Easy arithmetic remains valid throughout the campaign. A player who has mastered +/- to 10 can still enjoy those encounters as fluency, pacing and visible mastery.

### 3. Mission/deck curve

Each deck has its own authored arc:

```text
arrival / easier encounters
→ core pressure
→ stronger/specialized encounters
→ pre-boss escalation
→ boss / mission objective
```

The next deck provides some breathing room again at a slightly higher overall ceiling:

```text
Deck N:   low  → medium  → high
Deck N+1: low+ → medium+ → high+
```

Later decks contain more advanced/specialist encounters and stronger combinations while retaining some comfortable robots.

Do not implement `every duel is harder than the previous duel`.

### 4. Campaign system complexity

New missions also increase **game-system complexity** independently from arithmetic difficulty.

Examples:
- more body/Joker skills,
- access keys and layered security,
- additional robot behaviors,
- Treasure Golem/trap mechanics,
- environmental actions,
- new number-board elements,
- resource trade-offs,
- combinations of previously learned mechanics.

This is essential: a late deck must not feel like an early deck with only larger numbers.

### 5. Tactical challenge

`ENTDECKER / STANDARD / HERAUSFORDERUNG` is a separate preference controlling systems such as:
- duel AI competence,
- pursuit/detection pressure,
- acceleration/reaction windows,
- tactical forgiveness,
- search persistence.

It does not define mathematics knowledge.

## Concrete arithmetic resolution

Conceptually one encounter resolves from:

```text
player mathematics baseline/evidence
+ campaign position
+ position inside the current mission
+ robot mathematics role
+ authored encounter operation/rule constraints
+ conservative calibration
= concrete arithmetic envelope
```

Consequences:
- the same robot population/story is recognizable across profiles,
- stronger profiles can receive wider/richer arithmetic,
- early comfort robots remain relatively easy for everyone,
- later missions may fan out more strongly for advanced profiles,
- adaptive math must not flatten authored robot identities.

## Mathematics protocols versus labels

Do not claim an operation is playable until the number-duel implementation genuinely supports it.

Current production prototype supports addition/subtraction envelopes. Multiplication/division remain planned curriculum capabilities and future duel protocols. A profile may eventually know them, but UI must not pretend they are active gameplay before implementation.

## Learning through repetition

Simple arithmetic remains useful throughout the campaign:
- automation/fluency improves through repetition,
- easy encounters create rhythm and confidence,
- players visibly feel mastery,
- stronger encounters gain contrast.

Therefore `mastered` never means `remove from the game`.

## Campaign mechanics are authored introductions

New systems must be introduced in stages, repeated, and later combined. Potential future systems include:
- current chain/reaction core,
- body/Joker abilities,
- keys/security,
- Treasure Golem/traps,
- operation-specific or modified tiles,
- other readable number-board rules.

Avoid stacking multiple unfamiliar systems merely to increase difficulty.

## Boss progression

Bosses should become memorable through staging and mechanics, not just raw arithmetic.

Possible sources of boss pressure:
- phases/firewalls,
- larger reactor requirements,
- unique board interactions,
- body ability use,
- environmental setup before contact,
- resource endurance,
- combinations of known systems.

KRONOS is the first established layered-protection example. Later bosses must not simply copy KRONOS.

## Hub and mission lifecycle

The personal hub is the stable campaign rest point.

Canonical lifecycle:

```text
HUB
→ START / RESUME MISSION
→ DECK
→ SUCCESS STORY → HUB
   or
→ 0 HP / MISSION FAILURE → HUB
```

A voluntarily exited viable run remains profile-specific and resumable. A failed run is cleared and the next attempt starts fresh. Full behavior is defined in `MENU_HUB_FLOW.md`.

## Collector / achiever / story progression

Campaign progression is broader than deck completion. The profile/hub architecture should support:
- collectibles and rare finds,
- discovered droids/body entries,
- achievements and completion challenges,
- story/data fragments,
- character/location descriptions,
- reviewable mission outcomes.

These systems should reward collector/achiever motivations without replacing the core mission loop.

## Current framework status

Implemented on the active agent branch:
- internal 25-slot count-agnostic campaign catalog,
- B2 campaign mission,
- C3 second-deck proof,
- success/unlock progression,
- multiple isolated family profiles,
- per-profile running mission save/resume,
- child/adult profile distinction,
- profile mathematics starting baseline,
- robot math roles independent from tactical behavior,
- profile/deck/robot-derived arithmetic envelopes,
- independent tactical challenge,
- title/profile/hub flow from `MENU_HUB_FLOW.md`,
- LOS/search/return robot perception foundation,
- automated smoke tests and Pages deployment.

The framework milestone does **not** mean the full ~25 production decks, final story, final hubs, final adaptive engine or final localization are implemented.

## Playtest questions

Campaign playtests should ask:
- Does title → profile → hub → mission feel like an adventure rather than a configuration screen?
- Does the hub reveal enough current progress without spoiling campaign size/future acts?
- Are easy robots still satisfying for stronger players?
- Can players predict relative mathematical threat from robot identity?
- Does each deck build toward its objective/boss?
- Does the next deck provide breathing room before escalating?
- Do later missions feel richer through mechanics rather than only larger numbers?
- Can two profiles with different mathematics knowledge play the same story comfortably?
- Does voluntary exit resume correctly and failure return cleanly to the hub?
- Does profile calibration remain explainable and non-punitive?
