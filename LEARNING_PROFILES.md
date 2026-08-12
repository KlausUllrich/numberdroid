# Numberdroid — Learning Profiles

This document defines the educational progression layer for Numberdroid. It is binding design context together with `CODEX_HANDOFF.md`, `ENCOUNTER_ARCHETYPES.md`, and `DEVELOPMENT_PLAN_NEXT.md` until consolidated into a later handoff.

## Product principle

Numberdroid is a family game that should make arithmetic practice feel like playing a real game rather than completing worksheets.

Children should be able to learn through repeated play without being pushed into arithmetic that is so difficult that the tactical game stops being fun. Adults should also be able to notice improvement through repeated playtesting and practice.

The game therefore has two independent difficulty axes:

1. **Learning profile / mathematics level** — what mathematical skills the player is expected to know, what the game is currently practising, and what the next learning step is.
2. **Gameplay challenge** — how threatening the robot AI, pursuit, reaction windows and tactical systems are.

Never use one axis as a hidden proxy for the other.

## Player-facing promise

Before entering a deck/campaign segment, a family should be able to answer three questions without educational jargon:

- **DAS SOLLTEST DU SCHON KÖNNEN** — prerequisite skills needed to have fun rather than struggle.
- **DAS ÜBST DU HIER** — the primary skill that repeated play will strengthen.
- **DAS KOMMT DANACH** — the next logical learning step.

A school-year/grade recommendation may also be shown, but it is secondary guidance rather than the canonical definition of the profile.

## Canonical skill model

The underlying learning profile must be curriculum-neutral. It should describe mathematical competence directly instead of storing a German class year as the source of truth.

A profile can contain data such as:

- allowed operations: addition / subtraction / multiplication / division,
- number range,
- target/result range,
- whether crossing a ten boundary is expected,
- whether negative intermediate/results are allowed,
- multiplication-table families expected,
- division constraints such as exact division only,
- typical chain length / cognitive load,
- optional prerequisite profile ids,
- examples suitable for the player-facing card.

Exact TypeScript names can change during implementation, but the architecture must preserve this separation.

## Initial learning-profile ladder

These are working content bands, not final curriculum claims. Names and exact boundaries should be tuned during implementation and playtesting.

### Profile A — Zahlenstart

Player-facing intent:
- recognise and compare small numbers confidently,
- simple addition/subtraction in a very small range,
- short chains and highly readable targets.

Typical content direction:
- numbers roughly within 0–10,
- addition first,
- very simple subtraction once introduced,
- no multiplication/division.

### Profile B — Plus & Minus bis 20

Player-facing intent:
- build fluency with addition and subtraction to 20,
- gradually practise combinations that cross 10,
- encourage mental strategies rather than time pressure.

Typical content direction:
- addition/subtraction within 20,
- controlled introduction of crossing-ten tasks,
- several valid chain solutions where possible.

### Profile C — Sicher bis 100

Player-facing intent:
- extend addition/subtraction fluency beyond 20,
- work with larger targets and place-value structure,
- maintain manageable chain complexity.

Typical content direction:
- addition/subtraction within 100,
- difficulty driven by number composition rather than reaction speed.

### Profile D — Malnehmen entdecken

Player-facing intent:
- introduce multiplication as repeated/grouped arithmetic,
- begin with familiar table families before broadening.

Typical content direction:
- selected multiplication tables,
- addition/subtraction may remain available as supporting operations,
- no assumption that all tables are already fluent.

### Profile E — Malnehmen & Teilen

Player-facing intent:
- strengthen multiplication and introduce inverse division relationships,
- keep division exact at first,
- build toward confident mixed-operation play.

Typical content direction:
- multiplication/division within a controlled result range up to about 100,
- exact division initially,
- later mixed-operation decks can require stronger fluency.

These bands are deliberately skill-based. A later content pass may split or merge them once real family playtests show where frustration or boredom occurs.

## School-year / grade recommendations and internationalisation

Do not hard-code a single school system into the learning profile.

The canonical profile describes skills. A separate localisation/curriculum mapping layer may provide recommendations such as:

- Germany: `1. Klasse`, `2. Klasse`, etc.,
- United States: `Grade 1`, `Grade 2`, etc.,
- England/Wales: `Year 2`, `Year 3`, etc.,
- other languages/regions using their own familiar labels.

Recommended implementation direction:

```text
LearningProfile
  -> canonical mathematical skills

CurriculumRecommendation
  -> locale / country / optional region
  -> local school-stage label
  -> approximate recommended range
  -> optional curriculum/source/version metadata
```

The recommendation must always be presented as guidance, not as a claim that every child in a particular class should already master exactly the same content.

Before shipping region-specific grade labels, mappings should be checked against the relevant current curricula/standards rather than guessed from another country's school system.

## Family setup / choosing a profile

The first version should not ask parents to understand abstract curriculum terminology.

Prefer a short selector based on recognizable capabilities, for example:

```text
Welche Aufgaben passen gerade gut?

[ 4 + 3 ]
Ich übe Plus und Minus mit kleinen Zahlen

[ 8 + 7 ]
Plus und Minus bis 20 klappt schon ganz gut

[ 34 + 28 ]
Ich rechne schon mit Zahlen bis 100

[ 6 × 4 ]
Ich übe das Einmaleins

[ 24 ÷ 6 ]
Ich kann schon Malnehmen und Teilen
```

The exact examples must be localized and tuned, but selection should feel like choosing an appropriate game level, not taking an exam.

A later optional **Finde mein Niveau** calibration can offer a short low-pressure sequence and recommend a profile. It should never shame the player or present a school-grade judgment as a score.

## Adaptive learning without hidden difficulty spikes

Repeated play should help the player improve. The game may therefore observe post-submit performance such as:

- success/failure after explicit submit,
- repeated attempts,
- typical chain length,
- solution time at a coarse level,
- use of hints/energy/abilities,
- sustained streaks of ease or struggle.

However:

- correctness remains hidden until explicit `REAKTOR AUSLÖSEN`,
- do not add reaction-time pressure to arithmetic,
- do not silently jump a child into a new declared learning profile mid-deck,
- adapt first within the selected profile (board composition, target mix, easier/harder examples),
- recommend a profile change between decks/sessions when evidence is strong,
- allow families to override recommendations at any time.

The goal is a productive challenge band: frequent success, occasional meaningful stretch, and visible improvement over repeated sessions. Exact balancing thresholds must be established through playtesting rather than assumed as universal constants.

## Deck relationship

Decks and learning profiles should be related but not identical.

A deck has an authored theme/story/goal and declares which learning profiles it supports or targets. This allows the same story/deck structure to be used at different appropriate math levels where practical, instead of forcing every child through exactly one arithmetic curriculum path.

Initial framework direction:

- each deck declares a primary learning objective,
- deck selection shows the prerequisite/practice/next-step summary,
- supported learning profiles determine encounter math generation/variants,
- campaign progression and learning progression may overlap but should not be permanently welded together,
- a player can revisit completed decks at a different suitable learning profile.

For the first C3 proof, it is acceptable to author a small number of variants rather than creating a fully procedural curriculum engine.

## Gameplay challenge remains independent

The separate gameplay profiles remain:

- `ENTDECKER`
- `STANDARD`
- `HERAUSFORDERUNG`

They may tune:
- enemy AI competence,
- detection/chase pressure,
- acceleration/reaction windows,
- search persistence,
- tactical forgiveness.

They must not silently change the stated mathematical learning objective.

A child may therefore play `Plus & Minus bis 20` on `HERAUSFORDERUNG`, while another family member plays the same learning profile on `ENTDECKER`.

## Presentation requirements

Learning information must be prominent but not school-like.

Preferred hierarchy on deck/profile selection:

1. deck fantasy/story,
2. clear learning badge,
3. `DAS SOLLTEST DU SCHON KÖNNEN`,
4. `DAS ÜBST DU HIER`,
5. optional localized school-year recommendation,
6. gameplay challenge selector separately.

Avoid labels such as simply `MATHE: LEICHT/MITTEL/SCHWER`; they do not tell families what the child actually needs to know.

## Playtest questions

At Playtest Gate A, evaluate not only whether the campaign shell works but whether a parent/child can correctly predict the arithmetic experience before entering a deck.

Questions to answer:
- Was it obvious what skills were expected?
- Did the chosen profile feel mostly achievable while still producing some learning moments?
- Could the player notice improvement after repeated rounds?
- Did school-year guidance help without feeling like a judgment?
- Could gameplay challenge be changed without confusing it with math level?
- Did the next recommended learning step feel understandable?

## Handoff requirement

The current agent must establish the learning-profile data model and first player-facing presentation as part of the campaign/framework milestone before handoff.

The next agent may expand curriculum content and regional mappings, but should not have to redesign the separation between canonical math skills, local school recommendations, deck content and gameplay challenge.