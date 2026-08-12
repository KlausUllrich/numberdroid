# Numberdroid — Campaign & Progression Model

This document defines the current campaign structure and difficulty architecture for Numberdroid. It is binding design context together with `CODEX_HANDOFF.md`, `ENCOUNTER_ARCHETYPES.md`, `LEARNING_PROFILES.md`, and `DEVELOPMENT_PLAN_NEXT.md` until a later consolidated handoff replaces them.

## Product promise

Every player profile should be able to play the **same complete story campaign**.

A child with modest mathematics knowledge and an older child or adult with much stronger mathematics knowledge should:
- see the same ship,
- visit the same decks in the same story order,
- meet the same recognizable robot classes and bosses,
- unlock the same campaign mechanics,
- experience the same story beats,
- but receive arithmetic tuned to the capability stored in that player profile.

The campaign must therefore never split into a `young child story` and an `advanced math story`.

## Campaign target size

Current content target: **approximately 25 decks**.

This is a production/content target, not a hard runtime limit. The architecture must support any number of decks.

A useful planning structure is **5 acts × about 5 decks**:

1. **Act I — Infiltration / takeover foundation**
   - movement, scan, duel, transfer,
   - simple robot identities,
   - first body differences,
   - first basic access mechanics.
2. **Act II — Security systems**
   - guards, patrols, keys/access levels,
   - stronger body roles,
   - more deliberate pursuit and route planning.
3. **Act III — Ship systems**
   - more robot abilities/Jokers,
   - richer number-board mechanics,
   - environmental interactions,
   - stronger combinations of known systems.
4. **Act IV — Hunt / exploitation**
   - Treasure Golem / Beutedroide capture logic,
   - traps, containment, rerouting,
   - more advanced security/AI interactions,
   - higher systemic density.
5. **Act V — Command / mastery**
   - combinations of the campaign's established systems,
   - strong deck identities,
   - more demanding bosses,
   - final command/story escalation.

The exact act names and deck count remain content decisions. The important rule is that campaign progression introduces **new mechanics and combinations**, not only larger arithmetic numbers.

## Four independent progression dimensions

Difficulty/progression is deliberately not one scalar.

### 1. Player mathematics profile — personal baseline

Each player profile stores a mathematics capability estimate.

The player/family may choose an initial self-assessment when creating or editing the profile. This is a starting estimate, not an exam result and not a permanent label.

The profile may later be fine-tuned from demonstrated play, but adaptation is conservative and must not erase authored encounter identity.

Examples of profile information:
- comfortable addition/subtraction span,
- ten-boundary confidence,
- multiplication families currently known,
- division availability,
- useful chain complexity,
- evidence/confidence for these capabilities.

This baseline lets two children play the same campaign at different appropriate arithmetic levels.

### 2. Robot mathematics role — encounter identity

Arithmetic difficulty is strongly associated with recognizable robot types/roles.

A simple robot should remain a comparatively easy encounter even late in the campaign. Easy arithmetic is not disposable tutorial content: fluent, satisfying encounters provide repetition, confidence and pacing.

Robot classes should have authored mathematical roles such as:
- **comfort/basic** — quick, highly achievable arithmetic,
- **practice/core** — current working level,
- **stretch/security** — noticeably more demanding,
- **specialist** — introduces or emphasizes a particular operation/mechanic,
- **boss** — combines pressure, endurance and special rules without necessarily being `just bigger numbers`.

Visual/body identity should let players learn that some robots are mathematically more threatening than others.

Do not make every robot on a later deck uniformly difficult.

### 3. Deck curve — local and global escalation

Every deck should have its own arc:

```text
arrival / easier encounters
→ core deck pressure
→ stronger/specialized enemies
→ pre-boss escalation
→ boss
```

Then the next deck begins with some breathing room again, but at a somewhat higher overall campaign baseline.

So the progression is a saw-tooth curve rather than a straight line:

```text
Deck 1: low → medium → high
Deck 2: low+ → medium+ → high+
Deck 3: low++ → medium++ → high++
...
```

Later decks should contain a larger share of advanced/specialist robots, while still including some simple robots for rhythm and fluency.

The exact robot mix is authored/balanced per deck, not globally hard-coded percentages.

### 4. Campaign system complexity — new mechanics

New decks also increase **game-system complexity** independently of arithmetic difficulty.

Examples:
- more body/Joker skills,
- access keys and layered security,
- new robot behaviors,
- Treasure Golem capture/trap mechanics,
- new environmental actions,
- new number-board elements,
- additional resource trade-offs,
- combinations of mechanics introduced earlier.

This dimension is crucial. Deck 18 must not feel like Deck 4 with only larger numbers.

## Tactical gameplay challenge

A separate tactical challenge setting may still exist (working profiles: `ENTDECKER`, `STANDARD`, `HERAUSFORDERUNG`). It controls systems such as:
- AI competence,
- pursuit/detection pressure,
- acceleration/reaction windows,
- tactical forgiveness,
- search persistence.

It does **not** define the player's mathematics knowledge.

The player profile may store both:
- mathematics capability/self-assessment,
- preferred tactical challenge.

These remain independent.

## How arithmetic is resolved for one encounter

Conceptually, encounter math comes from several inputs:

```text
player mathematics baseline
+ deck campaign position
+ position within this deck
+ robot mathematics role
+ authored encounter/operation constraints
+ conservative profile adaptation
= concrete arithmetic envelope for this duel
```

Important consequences:
- the same SENTRY class is recognizable to every player,
- stronger player profiles can receive larger/more complex variants,
- early-deck SENTRY encounters can remain easy for everyone relative to their own profile,
- later decks can fan out more strongly for advanced profiles,
- robot type and deck composition remain meaningful even when arithmetic is personalized.

Do not let adaptive math flatten all encounter classes into the same average difficulty.

## Same story, different arithmetic

A player with a lower initial capability and a player with a higher initial capability should both start on the same first deck.

Illustrative example only:

```text
Player A profile: early addition/subtraction
Player B profile: fluent +/- and some multiplication

Deck 1 basic robot:
A → very small +/- combinations
B → still easy for B, but may use a wider +/- span

Deck 12 specialist robot:
A → harder +/- / carefully introduced next concepts
B → larger spans / multiplication / richer supported operations
```

The **relative encounter role stays the same** while the concrete arithmetic differs.

This also means stronger players do not skip early story content just because the mathematics is easy for them.

## Initial self-assessment

Profile creation may offer a quick, friendly self-assessment such as recognizable example tasks or capability descriptions.

Rules:
- no mandatory test,
- no school-report language,
- easy to change later,
- choose a safe starting point when uncertain,
- actual play may refine the estimate gradually.

The purpose is to avoid forcing every new profile to begin at the absolute lowest arithmetic band while keeping onboarding friction low.

## Learning through repetition

Simple arithmetic remains valuable throughout the campaign.

Reasons:
- automation/fluency improves through repetition,
- easy encounters create pacing and competence,
- fast mental recognition can improve without explicit timers,
- children can feel mastery against familiar weak robots,
- harder encounters become more meaningful when contrasted with easier ones.

Therefore adaptation must not interpret `player is good at addition to 10` as `never show addition to 10 again`.

## Deck authoring data direction

The future campaign/deck catalog should support metadata along these lines:

```text
CampaignDeck
  id
  act/order
  title/story
  unlock requirements
  intro/outro story
  progression intensity
  mechanics introduced / mechanics expected
  supported math capabilities/operations
  encounter population / robot roles
  boss
```

Robot/encounter data should be able to declare a mathematical role or tier independently from its tactical behavior (`neutral`, `guard`, `patrol`, `aggressive`).

Do not infer math difficulty solely from tactical behavior. A neutral specialist can be mathematically demanding; an aggressive small bot can still use easy arithmetic.

## Number-board mechanic progression

Additional arithmetic-game mechanics should be introduced over the campaign in authored stages rather than all being available immediately.

Examples may include:
- current chain/reaction core,
- body/Joker abilities,
- identical-number bonuses,
- dual-value or modified tiles,
- operation-specific tiles,
- other child-readable board mechanics discovered later.

New mechanics need explicit introduction, repetition and later combination. Avoid stacking several unfamiliar rules onto one deck merely to increase difficulty.

## Boss progression

Bosses should become memorable through mechanics, staging and identity, not only raw arithmetic.

Potential sources of boss difficulty:
- multiple phases/firewalls,
- larger reactor requirements,
- unique board interaction,
- body ability use,
- environmental setup before contact,
- resource endurance,
- combination of known campaign systems.

KRONOS remains the first established example of layered protection, but later bosses should not all copy KRONOS.

## Content pacing principle

A healthy deck should contain a rhythm of:
- comfortable wins,
- normal practice,
- occasional stretch,
- systemic novelty,
- payoff/boss.

The campaign should feel like an adventure that happens to train arithmetic, not a worksheet progression decorated with robots.

## Framework milestone versus final campaign

The current development milestone does **not** implement all 25 decks.

It must implement enough framework to prove this architecture:
- campaign/deck catalog,
- player profile mathematics baseline,
- robot mathematical role/tier representation,
- deck-local difficulty curve representation,
- persistent progression,
- B2 inside the campaign shell,
- one small second-deck proof,
- story success/unlock flow,
- room for mechanic-unlock metadata.

The 25-deck campaign and final act/content balancing are later production work on top of this framework.

## Playtest questions

Future campaign playtests should ask:
- Do easy robots remain satisfying rather than pointless?
- Can players predict which robot types are more mathematically dangerous?
- Does each deck build toward its boss?
- Does the next deck provide breathing room before escalating again?
- Do later decks feel richer because of mechanics, not only larger numbers?
- Can two profiles with different mathematics knowledge play the exact same story comfortably?
- Do advanced players still enjoy early decks rather than feeling forced through trivial worksheets?
- Does arithmetic adaptation preserve robot identity and authored pacing?

## Current campaign target

Use **25 decks as the current planning target**, preferably grouped into larger acts, but keep runtime/data architecture count-agnostic. Re-evaluate the exact final count after several real production decks exist and reliable playtime/content-density data is available.
