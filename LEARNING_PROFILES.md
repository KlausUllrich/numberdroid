# Numberdroid — Player Mathematics & Learning Model

This document defines the binding educational layer for Numberdroid. Read it together with `CAMPAIGN_PROGRESSION.md` and `MENU_HUB_FLOW.md`.

## Product principle

Numberdroid is a family game first. Arithmetic practice should emerge from playing a real adventure.

The player should feel that:
- weak robots are pleasant and increasingly fluent to defeat,
- stronger robot types demand more thought,
- a mission builds toward meaningful pressure and a boss/objective,
- repeated play improves arithmetic naturally,
- success does not immediately turn the next encounter into a harder worksheet.

**Easy arithmetic remains legitimate game content for the entire campaign.** Mastery is useful and enjoyable; it is not content that disappears as soon as the player succeeds.

## One learning model per player profile

Each human player profile owns its own mathematics baseline/evidence state.

The same family device may therefore contain several children/adults with completely independent:
- campaign progress,
- running mission state,
- mathematics starting baseline,
- future demonstrated-skill evidence,
- tactical preference,
- future achievements/collection/statistics.

Different profiles still play the **same story campaign**.

## Child/adult onboarding

Profile creation first asks whether the profile is for a `KIND` or `ERWACHSENER`, then asks for the profile name.

This is not a difficulty classification. It controls onboarding and leaves room for later differences in explanation/parental presentation.

### Child profiles

Children receive a friendly starting self-assessment using recognizable arithmetic examples rather than curriculum jargon.

The currently implemented choices intentionally match mathematics the existing duel genuinely supports:

```text
4 + 3
small plus/minus tasks

8 + 7
plus/minus to about 20

34 + 28
larger plus/minus
```

Rules:
- this is not a test,
- no score or shame language,
- no mandatory school-grade question,
- an easy start is always safe,
- the estimate can later be refined,
- easy arithmetic remains part of the campaign even after mastery.

Do not expose multiplication/division as playable starting options until true duel protocols/mechanics support those operations.

### Adult profiles

Adults currently skip the child arithmetic question to keep onboarding fast and receive a sensible higher addition/subtraction default.

Later profile/statistics UI may allow adults to adjust their baseline explicitly. This must not require a second campaign or different story path.

## Mathematics difficulty is not a single scalar

Concrete arithmetic is derived from multiple independent dimensions:

1. **player mathematics baseline/evidence**,
2. **robot mathematical role/type**,
3. **campaign/mission position**,
4. **position inside the current mission**,
5. **encounter-specific operation/rule constraints**,
6. **conservative adaptation from demonstrated play**.

Adaptation must not flatten all encounters toward one average difficulty.

## Robot types carry mathematical identity

Recognizable robot variants should communicate approximate arithmetic pressure.

Working mathematical roles:
- **comfort/basic** — quick and highly achievable,
- **practice/core** — current working level,
- **stretch/security** — more demanding,
- **specialist** — emphasizes a specific operation/mechanic,
- **boss** — staged/complex challenge, not merely larger numbers.

Tactical behavior and mathematical role are separate. `neutral/guard/patrol/aggressive` does not determine math difficulty.

A neutral specialist may be mathematically demanding. An aggressive small bot can still use easy arithmetic.

## Easy robots stay useful

Do not progressively remove easy encounters.

Even an advanced child/adult can enjoy addition to 10 because it provides:
- fluency/automaticity practice,
- fast successful encounters,
- pacing between harder fights,
- visible mastery,
- contrast that makes specialists/bosses feel stronger.

Therefore `mastered` does **not** mean `never show again`.

Later missions should change the mixture and upper ceiling rather than replacing every easy bot.

## Canonical curriculum-neutral skill model

The future evidence model should be skill-based rather than storing `German school class` as truth.

Relevant dimensions include:
- allowed operations,
- operand range,
- target/result range,
- ten-boundary crossing,
- multiplication fact families when implemented,
- exact-division constraints when implemented,
- chain/cognitive complexity,
- confidence/evidence per skill family,
- recent comfort/struggle.

School stage is secondary localized metadata.

## Competence landmarks

Useful curriculum-neutral landmarks may include:

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
- +/- remain supporting operations.

### E — Malnehmen & Teilen
- multiplication plus inverse division,
- exact division first,
- later mixed-operation fluency.

These are educational landmarks, **not campaign levels**. D/E remain future protocol/content work until the duel actually supports them.

## Adaptation is calibration, not the campaign difficulty engine

The authored campaign/robot curve is primary. Adaptation only keeps the concrete arithmetic envelope appropriately calibrated.

Good adaptation examples:
- widen/narrow operand span inside a supported robot role,
- vary ten-boundary frequency,
- adjust target composition,
- repeat weaker patterns,
- adjust useful chain complexity,
- widen after sustained ease,
- contract after sustained struggle.

Bad adaptation examples:
- every correct duel makes the next duel harder,
- a comfort robot silently becomes a specialist,
- multiplication suddenly appears after one good streak,
- mastered small addition disappears,
- adaptation overrides authored boss/deck pacing.

Use sustained evidence and hysteresis. Arithmetic remains untimed.

## Evidence may only come from explicit confirmed play

Correctness remains hidden until `REAKTOR AUSLÖSEN`.

Potential future evidence:
- correct/incorrect explicit submissions,
- repeated attempts,
- coarse solution time as confidence evidence, never time pressure,
- selected chain complexity,
- use of abilities/hints/resources,
- sustained comfort/struggle,
- later success on previously weak patterns.

Do not overfit isolated outcomes.

## Player-facing transparency in the hub

The hub/statistics area should gradually make the learning model understandable rather than hiding it as a black box.

Useful child/family language:
- **MATHE-STARTPUNKT**,
- **KLAPPT SCHON GUT**,
- **WIRD GERADE GEÜBT**,
- **ALS NÄCHSTES**,
- recognizable examples.

A deeper parent/adult view may later show more explicit evidence/confidence and explain why the game currently chooses a given range.

Avoid:
- `Mathe 63%`,
- `weak/poor`,
- school year as a score,
- mandatory placement tests.

## International school-stage guidance

School-stage recommendations are localized guidance only.

Canonical direction:

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

Examples:
- Germany: `1. Klasse`, `2. Klasse`, ...
- US: `Grade 1`, `Grade 2`, ...
- England/Wales: `Year 2`, `Year 3`, ...

Mappings must be verified against current regional curricula before production use. They are approximate recommendations, never claims about what every child must know.

## Tactical challenge remains independent

Working tactical profiles:
- `ENTDECKER`,
- `STANDARD`,
- `HERAUSFORDERUNG`.

They tune duel AI, pursuit, reaction windows and tactical forgiveness. They must not directly rewrite mathematics knowledge.

## Current implementation status

Implemented on the active branch:
- persistent per-player math starting baseline,
- child/adult profile type,
- child-only friendly supported +/- onboarding choice,
- adult higher +/- default,
- multiple isolated family profiles,
- robot math roles separate from tactical behavior,
- deterministic profile/deck/robot math-envelope resolution,
- easy arithmetic retained by comfort-role behavior,
- independent tactical challenge,
- hub statistics entry point showing current baseline/tactical profile.

Not yet implemented:
- sustained evidence collection/calibration,
- automatic skill-confidence updates,
- multiplication/division duel protocols,
- final curriculum mappings,
- parent detail dashboard,
- final internationalized learning presentation.

## Playtest questions

Ask:
- Can a child pick a sensible starting ability without feeling tested?
- Does adult profile creation feel appropriately quick?
- Are easy robots still fun for stronger players?
- Do robot types communicate relative mathematical threat?
- Does each mission escalate but retain comfortable encounters?
- Do stronger profiles receive meaningfully richer arithmetic without losing story content?
- Does the hub make the current learning setting understandable?
- When adaptation is added, does it feel subtle, explainable and non-punitive?
