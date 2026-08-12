# Numberdroid — Prompt for the next agent

You are continuing development of **Numberdroid** in repository `KlausUllrich/numberdroid` on branch:

```text
agent/integrate-metagame-architecture
```

Do **not** merge draft PR #1 unless Klaus explicitly asks you to.

Before making changes, read these files completely, in this order:

1. `CODEX_HANDOFF.md`
2. `ENCOUNTER_ARCHETYPES.md`
3. `LEARNING_PROFILES.md`
4. `DEVELOPMENT_PLAN_NEXT.md`

Treat them together as the authoritative handover for architecture, binding gameplay rules, educational model, validated behavior, current B2 state, prohibitions, current development packages, test cadence and handoff boundary.

Important context boundary:
- A7 parity and the first complete B2/VS2 gameplay loop are already established.
- Do not perform another broad migration or rewrite.
- Preserve the smooth local RAF movement/camera architecture and physical body-size/drive behavior.
- Preserve hidden arithmetic correctness until explicit submit.
- Extend current Floor/Tiled/runtime systems rather than adding per-map DOM hacks.
- Robot bodies are physical on the deck; physical robot collision always opens the scan screen.
- Neutral work robots are non-aggressive but can be voluntarily scanned or scanned by physical collision.
- Guards leave their post when triggered, accelerate into pursuit, chase only inside a limited leash area, scan on contact, and return to their post when the player escapes.
- The future Treasure Golem / Beutedroide archetype requires an authored trap/environment interaction before it can be reached.
- Future robot perception must use direct line of sight rather than detecting through walls/closed doors.

## Family-learning product rule

Numberdroid is a family game and arithmetic learning is a first-class part of the design.

Keep two independent axes:

1. **Learning profile / mathematics level** — what skills the player should already have, what is being practised, and what comes next.
2. **Gameplay challenge** — AI competence, pursuit pressure, reaction windows and tactical threat.

Do not collapse them into one easy/medium/hard setting.

The canonical learning model must be skill-based and curriculum-neutral. School-year/grade labels are localised recommendations layered on top so Germany `Klasse`, US `Grade`, UK `Year`, etc. can differ without changing profile ids.

Family-facing presentation should clearly communicate:
- `DAS SOLLTEST DU SCHON KÖNNEN`
- `DAS ÜBST DU HIER`
- `DAS KOMMT DANACH`
- recognizable example problems
- optional localised school-year recommendation
- separate gameplay challenge selection

## Current development phase

Follow `DEVELOPMENT_PLAN_NEXT.md`. The current agent/session is responsible for the complete campaign/framework/learning-profile milestone before deliberate handoff:

0. hosted GitHub Pages preview,
1. campaign shell + deck catalog + family learning-profile entry,
2. progression/save + learning-profile application + independent gameplay challenge + small C3 proof deck,
3. reusable line-of-sight/perception foundation,
4. automated smoke coverage and framework hardening,
5. fix concrete feedback from Playtest Gates A and B,
6. only then prepare the deliberate next-agent handoff.

Klaus should not be asked to playtest routine intermediate commits. Use CI/automated tests and ask for the manual gates defined in the plan.

Do not spend this milestone on final art, many additional production decks, a full international curriculum database, Treasure Golem implementation, neutral-worker reward economy or broad new board mechanics unless required to support the framework.

Current local B2 preview after startup:

```text
http://localhost:5173/?floor=deck-vs2
```

Local workflow:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

If this is a genuine handoff/new session, start by summarizing the four authoritative documents and the current branch/CI/deployment state before changing code. Then continue the first incomplete package in `DEVELOPMENT_PLAN_NEXT.md`; do not restart completed work.