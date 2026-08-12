# Numberdroid — Player Mathematics & Learning Model

This document defines the educational layer for Numberdroid. Read it together with `CAMPAIGN_PROGRESSION.md`. Both are binding design context alongside `CODEX_HANDOFF.md`, `ENCOUNTER_ARCHETYPES.md`, and `DEVELOPMENT_PLAN_NEXT.md`.

## Product principle

Numberdroid is a family game first. Arithmetic practice should emerge from playing a real adventure.

The player should feel that:
- weak robots are pleasant and increasingly fluent to defeat,
- stronger robot types demand more thought,
- a deck builds toward a meaningful boss,
- repeated play improves arithmetic naturally,
- the game never turns success into an immediate wall of harder worksheets.

**Easy arithmetic remains legitimate game content for the whole campaign.** Mastery is useful and enjoyable; it is not content that must disappear as soon as a player succeeds.

## Player profile owns the mathematics baseline

Each human player has a persistent profile containing a mathematics capability estimate.

A profile should eventually store information such as:
- comfortable addition/subtraction span,
- ten-boundary confidence,
- known multiplication families,
- division availability/confidence,
- useful chain complexity,
- evidence/confidence gathered through play,
- optional approximate curriculum/school-stage recommendation,
- preferred tactical gameplay challenge separately.

The profile allows different children to play the **same complete campaign** with arithmetic appropriate to them.

## Starting / self-assessment

A family may choose an initial mathematics ability when creating or editing a profile. The purpose is only to pick a sensible starting baseline.

The choice should use recognizable examples/capabilities rather than educational jargon, for example:

```text
4 + 3
Small plus/minus tasks feel right

8 + 7
Plus/minus to about 20 already works

34 + 28
Larger addition/subtraction is familiar

6 × 4
Multiplication is already in play

24 ÷ 6
Multiplication and division are familiar
```

Rules:
- no mandatory test,
- no shame or score,
- the player can always choose a safe/easy start,
- `just start` must remain possible with a safe default,
- the estimate can be changed later,
- demonstrated play may fine-tune it gradually.

So onboarding may offer self-assessment, but it must never become a barrier to simply starting the game.

## Mathematics difficulty is not a global scalar

Concrete arithmetic is derived from multiple authored/personal dimensions:

1. **player mathematics baseline**,
2. **robot mathematical role/type**,
3. **campaign/deck position**,
4. **position inside the current deck**,
5. **encounter-specific operation/rule constraints**,
6. **conservative adaptation from demonstrated play**.

See `CAMPAIGN_PROGRESSION.md` for the full campaign curve.

This means adaptation must not flatten all encounters toward one average difficulty.

## Robot types carry mathematical identity

Recognizable robots should imply approximate arithmetic pressure.

Working mathematical roles:
- **comfort/basic** — quick and highly achievable,
- **practice/core** — current working level,
- **stretch/security** — more demanding,
- **specialist** — emphasizes a specific operation/mechanic,
- **boss** — staged/complex challenge; not simply bigger numbers.

The exact mapping from visual body (`SENTRY`, `MAGNETAR`, future bodies) to mathematical role may vary by authored variant, but it must remain understandable and consistent enough that children can learn robot identities.

Important: tactical behavior and math role are separate. `neutral/guard/patrol/aggressive` does not by itself determine mathematics difficulty.

## Easy robots stay useful

Do not progressively remove easy encounters.

Even an advanced child/adult can enjoy addition to 10 because it provides:
- fluency/automaticity practice,
- fast successful encounters,
- pacing between harder fights,
- visible mastery,
- contrast that makes specialists/bosses feel stronger.

Therefore `mastered` does **not** mean `never show again`.

Later decks should change the mixture: more advanced/specialist robots and a higher upper bound, while still retaining some easy encounters.

## Canonical skill model

The underlying profile state must be curriculum-neutral and skill-based rather than storing `German school class` as truth.

Relevant dimensions include:
- allowed operations: addition / subtraction / multiplication / division,
- operand range,
- target/result range,
- ten-boundary crossing,
- negative intermediate/results if ever supported,
- multiplication-table families,
- exact-division constraints,
- chain/cognitive complexity,
- confidence/evidence per skill family,
- recent comfort/struggle.

Exact TypeScript names may change; the separation is binding.

## Working competence landmarks

These are useful for initial self-assessment, explanation and curriculum mapping. They are **not campaign levels** and they do not determine which decks the player is allowed to play.

### A — Zahlenstart
- small numbers around 0–10,
- addition first,
- simple subtraction,
- short readable chains.

### B — Plus & Minus bis 20
- addition/subtraction within 20,
- controlled ten-boundary crossing,
- multiple solution combinations.

### C — Sicher bis 100
- larger addition/subtraction,
- place-value structure,
- broader target composition.

### D — Malnehmen entdecken
- selected multiplication families,
- multiplication introduced gradually,
- +/- may remain supporting operations.

### E — Malnehmen & Teilen
- multiplication plus inverse division,
- exact division first,
- later mixed-operation fluency.

These bands may overlap/split after real family testing.

## Adaptation: calibration, not the main campaign difficulty engine

The authored campaign/robot curve is primary. Adaptation only keeps the player's arithmetic envelope appropriately calibrated.

Good adaptation examples:
- move from very small to somewhat larger operands inside the supported encounter role,
- vary ten-boundary frequency,
- adjust target composition,
- repeat weaker fact families,
- increase/decrease useful chain complexity,
- widen the range slowly after sustained ease,
- contract after sustained struggle.

Bad adaptation examples:
- every correct duel makes the next duel harder,
- a basic robot silently becomes a specialist,
- multiplication suddenly appears because of one good streak,
- mastered small addition disappears from the campaign,
- adaptation overrides the authored deck/boss pacing.

Use hysteresis and sustained evidence. The arithmetic itself remains untimed.

## New concepts and operations

New mathematics concepts should be introduced cautiously and only where the player's profile and authored deck/robot support them.

The campaign also introduces **game mechanics** over time (Jokers, keys, Treasure Golem, number-board mechanics). Do not confuse new game-system complexity with new arithmetic concepts. A deck can become strategically richer while still using familiar arithmetic.

## Same campaign for every mathematics profile

This is a binding product rule.

Different profiles:
- play the same ship/story,
- see the same deck order,
- see the same recognizable encounter population/boss identity,
- unlock the same game mechanics,
- receive different concrete arithmetic envelopes.

Advanced players must not skip early story decks.

Lower-skill players must not be prevented from reaching later story decks simply because those decks are later in the campaign. Later decks become harder **relative to their profile** and add more systems, while keeping an achievable lower part of the encounter mix.

## Player-facing presentation

The game should expose helpful information without becoming a report card.

Useful family/profile UI:
- **MATHE-STARTPUNKT** — chosen/current approximate baseline,
- **KLAPPT SCHON GUT** — demonstrated strengths,
- **WIRD GERADE GEÜBT** — current working area,
- **ALS NÄCHSTES** — likely next mathematical development,
- recognizable examples,
- optional localized school-stage guidance.

Avoid:
- `Mathe 63%`,
- `weak/poor`,
- treating school year as a score,
- requiring a child to pass a placement test before seeing the game.

## School-year / grade recommendations and internationalization

School stage is secondary localized metadata.

Canonical structure direction:

```text
PlayerMathProfile
  -> skill capabilities / ranges / confidence

CompetenceLandmark
  -> human-readable educational milestone

CurriculumRecommendation
  -> locale / country / optional region
  -> approximate school-stage label/range
  -> source/version metadata
```

Examples of display systems:
- Germany: `1. Klasse`, `2. Klasse`, ...
- US: `Grade 1`, `Grade 2`, ...
- England/Wales: `Year 2`, `Year 3`, ...

Mappings must be verified against current regional curricula before production use. They are guidance, not claims about what every child must know.

## Tactical challenge remains independent

Working tactical profiles remain:
- `ENTDECKER`,
- `STANDARD`,
- `HERAUSFORDERUNG`.

These can tune AI/pursuit/reaction/tactical forgiveness but must not directly change the player's mathematics profile.

A player profile can persist both mathematics baseline and tactical preference.

## Evidence that may update the profile

Only confirmed post-submit gameplay may be used. Correctness remains hidden until `REAKTOR AUSLÖSEN`.

Potential evidence:
- correct/incorrect explicit submissions,
- repeated attempts,
- coarse solution time as confidence evidence (never time pressure),
- selected chain complexity,
- use of abilities/hints/resources,
- sustained comfort/struggle,
- later success on previously weak patterns.

Do not overfit from isolated outcomes.

## Framework milestone

The current agent must establish enough of this model to support the campaign framework:
- persistent player-profile mathematics baseline/estimate,
- safe default plus optional friendly self-assessment,
- robot mathematical role/tier representation,
- deck/encounter math envelope data direction,
- conservative adjustment/calibration hook or deterministic prototype,
- family-facing profile summary shape,
- clear separation from tactical challenge,
- curriculum/localization mapping shape.

A sophisticated adaptive learning engine and final curriculum balancing are later work.

## Playtest questions

At future gates ask:
- Can a family pick a sensible starting ability without feeling tested?
- Can they skip setup and still start safely?
- Are easy robots still fun for stronger players?
- Do robot types communicate relative mathematical threat?
- Does each deck escalate toward its boss but reset to some easier encounters afterward?
- Do stronger profiles receive meaningfully richer later-deck arithmetic without losing early story content?
- Does profile calibration feel subtle rather than punitive?
- Is the mathematics improving through repeated play?
