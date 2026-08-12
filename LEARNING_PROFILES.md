# Numberdroid — Adaptive Learning Model

This document defines the educational progression layer for Numberdroid. It is binding design context together with `CODEX_HANDOFF.md`, `ENCOUNTER_ARCHETYPES.md`, and `DEVELOPMENT_PLAN_NEXT.md` until consolidated into a later handoff.

## Product principle

Numberdroid is a family game first. Arithmetic practice should emerge from playing, not from completing a setup test or selecting a school-like difficulty before the fun starts.

**Starting should always be safe.** A player should be able to press `START` and play immediately. The game begins in a broadly accessible arithmetic band and then adapts the numerical span and learning progression from demonstrated play.

The educational goal is a productive challenge band:
- most tasks feel achievable,
- some require thought,
- repeated play produces noticeable fluency,
- overload is reduced before frustration dominates,
- boredom leads to gradual expansion rather than a sudden difficulty spike.

## Two independent axes

Numberdroid keeps two separate systems:

1. **Adaptive mathematics progression** — what operations, number ranges, target/result ranges and cognitive load are currently appropriate.
2. **Gameplay challenge** — how threatening robot AI, pursuit, reaction windows and tactical systems are.

Never use one as a hidden proxy for the other.

A child can therefore have a very modest arithmetic range while still playing exciting robot encounters, or practise advanced arithmetic with forgiving tactical pressure.

## Zero-friction start

There is no mandatory mathematics-profile chooser before the first game.

Default flow:

```text
START
→ story / deck entry
→ immediately playable arithmetic
→ observe confirmed play
→ adapt within a safe range
→ gradually expand or contract the learning span
```

Parents may later inspect or override the current learning band, but this is an optional family/settings feature rather than a gate before play.

A future `Finde mein Niveau` flow may exist as an optional convenience, never as a required exam.

## Canonical skill model

The underlying model is curriculum-neutral and skill-based. It should represent mathematical capability directly instead of storing a German school year as truth.

Relevant dimensions include:
- allowed operations: addition / subtraction / multiplication / division,
- operand range,
- target/result range,
- whether crossing a ten boundary is currently expected,
- whether negative intermediate/results are allowed,
- multiplication-table families currently active,
- exact-division constraints,
- typical useful chain length / cognitive load,
- evidence/confidence for each skill dimension,
- recently demonstrated comfort and struggle.

Exact TypeScript names may change during implementation, but the architecture must preserve these dimensions separately from tactical gameplay difficulty.

## Internal competence bands

The former player-selected learning profiles become **internal competence bands / milestones**, useful for progression, explanation and curriculum mapping. They are not mandatory startup choices.

Working bands:

### A — Zahlenstart
- small numbers around 0–10,
- addition first,
- very simple subtraction when appropriate,
- short, readable chains.

### B — Plus & Minus bis 20
- addition/subtraction within 20,
- gradual ten-boundary crossing,
- multiple valid solutions where possible.

### C — Sicher bis 100
- addition/subtraction with larger numbers,
- place-value structure,
- increasing numerical composition without time pressure.

### D — Malnehmen entdecken
- selected multiplication families,
- multiplication introduced gradually,
- addition/subtraction may remain supporting operations.

### E — Malnehmen & Teilen
- multiplication and inverse division relationships,
- exact division first,
- later mixed-operation fluency.

These bands are working milestones, not final curriculum claims. Real family playtesting should decide where they split, overlap or merge.

## Adaptation rule: span first, progression second

The first adaptive mechanism should remain deliberately conservative.

**Primary adaptation:** change the span and composition of tasks inside the player's current competence neighborhood.

Examples:
- more or fewer larger numbers,
- more or fewer ten-boundary crossings,
- easier/harder target composition,
- shorter/longer useful chains,
- more repetition of a weak fact family,
- more variety after sustained success.

**Secondary progression:** only after enough evidence, gradually introduce the next mathematical concept or competence band.

Do not jump from `+/- bis 20` straight into multiplication because of a short success streak. Progression should be earned from sustained evidence and introduced gently.

If the player struggles, contract the span first before removing an already-familiar concept entirely.

## What evidence may be used

Only observe gameplay after explicit actions; never reveal correctness before `REAKTOR AUSLÖSEN`.

Useful evidence can include:
- correct/incorrect explicit submissions,
- repeated attempts on similar patterns,
- solution time at a coarse, non-pressuring level,
- typical selected chain length,
- use of hints/meta-energy/abilities,
- sustained ease or struggle over multiple encounters,
- success after an earlier failure on the same skill family.

Do not turn this into reaction-time scoring. The arithmetic itself remains untimed.

## Adaptation behavior

The system should behave smoothly rather than visibly changing a difficulty setting every round.

Principles:
- small changes,
- hysteresis / confidence before changing bands,
- no oscillation after one bad or one excellent round,
- prefer a mixture containing comfortable, practising and stretch tasks,
- never punish success with an immediate wall of harder tasks,
- allow temporary easier recovery after repeated struggle,
- preserve family override controls.

A useful first balancing target is qualitative rather than numeric: the player should feel competent most of the time while still encountering tasks that require thought. Exact percentages must come from playtests.

## Player-facing learning presentation

Although selection is not mandatory, families should be able to understand what the game is currently doing.

Useful presentation around deck selection, progress or family settings:

- **DU ÜBST GERADE** — current arithmetic focus,
- **KLAPPT SCHON GUT** — recently demonstrated strengths,
- **ALS NÄCHSTES** — likely next learning step,
- optional examples such as `8 + 7`, `34 + 28`, `6 × 4`,
- optional local school-stage guidance.

Avoid presenting the child with a score like `MATHE: 63 %` or an irreversible label such as `schwach`.

The game may celebrate progression explicitly: e.g. `Zehnerübergänge klappen jetzt richtig gut` or `Neue Rechenmuster freigeschaltet`, while remaining a game rather than a report card.

## Deck relationship

Deck story progression and mathematical progression overlap but are not welded together.

A deck declares:
- mathematical skill families it can support,
- safe min/max ranges or variants,
- primary learning focus,
- optional advanced variants.

The runtime chooses an appropriate variant from the player's current adaptive state.

This allows the same story deck to remain fun for siblings or adults with different arithmetic ability, where the authored encounter structure supports it.

For the first B2/C3 framework proof, a small number of explicit variants is enough; do not build a fully procedural curriculum engine yet.

## School-year / grade recommendations and internationalisation

School stage is secondary metadata, never the canonical learning state.

A separate mapping layer may translate competence bands into familiar approximate guidance:
- Germany: `1. Klasse`, `2. Klasse`, ...
- United States: `Grade 1`, `Grade 2`, ...
- England/Wales: `Year 2`, `Year 3`, ...
- other locales with their own labels.

Recommended shape:

```text
AdaptiveMathState
  -> canonical demonstrated skills / ranges / confidence

CompetenceBand
  -> human-friendly internal milestone

CurriculumRecommendation
  -> locale / country / optional region
  -> approximate school-stage label/range
  -> optional curriculum/source/version metadata
```

School recommendations must be phrased as guidance, not judgment. Before production release, region-specific mappings should be checked against current curricula/standards rather than inferred from another country.

## Gameplay challenge remains independent

The separate tactical profiles remain:
- `ENTDECKER`
- `STANDARD`
- `HERAUSFORDERUNG`

They may tune:
- enemy AI competence,
- detection/chase pressure,
- acceleration/reaction windows,
- search persistence,
- tactical forgiveness.

They must not silently widen the mathematical span or unlock a new operation.

## Playtest questions

At Playtest Gate A/B evaluate:
- Could a new player simply start without understanding a math menu?
- Did the opening arithmetic feel safe enough to continue playing?
- Did the task span become more appropriate after several encounters?
- Was improvement noticeable over repeated play?
- Did progression feel gradual rather than punitive?
- Could a parent understand `what is being practised now` without educational jargon?
- Did tactical difficulty remain independent from arithmetic progression?
- Did school-year guidance help without feeling like a grade or judgment?

## Handoff requirement

The current agent must establish:
- an adaptive-math state/data model,
- a safe default starting band,
- first span-adjustment logic or a clean deterministic prototype of it,
- first player-facing `Du übst gerade / Als Nächstes` presentation,
- separation from tactical gameplay challenge,
- curriculum/localisation mapping shape.

The next agent may deepen curriculum content, adaptation algorithms and regional mappings, but should not need to redesign the zero-friction start or the separation of math progression from gameplay challenge.