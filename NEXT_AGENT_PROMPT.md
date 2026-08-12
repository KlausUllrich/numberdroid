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

Treat them together as the authoritative handover for architecture, binding gameplay rules, educational model, validated behavior, current B2 state, current development packages, test cadence and handoff boundary.

Important context boundary:
- A7 parity and the first complete B2/VS2 gameplay loop are already established.
- Do not perform another broad migration or rewrite.
- Preserve the smooth local RAF movement/camera architecture and physical body-size/drive behavior.
- Preserve hidden arithmetic correctness until explicit submit.
- Extend current Floor/Tiled/runtime systems rather than adding per-map DOM hacks.
- Robot bodies are physical on the deck; physical robot collision always opens the scan screen.
- Neutral work robots are non-aggressive but can be voluntarily scanned or scanned by physical collision.
- Guards leave their post when triggered, accelerate into pursuit, chase only inside a limited leash area, scan on contact, and return to their post when the player escapes.
- Future robot perception must use direct line of sight rather than detecting through walls/closed doors.
- The future Treasure Golem / Beutedroide archetype requires an authored trap/environment interaction before it can be reached.

## Family-learning product rule

Numberdroid is a family game and arithmetic learning is a first-class system.

**Do not require a mathematics level/profile selection before first play. Starting should always be safe and immediate.**

Use two independent axes:

1. **Adaptive mathematics progression** — begin in an accessible arithmetic band, observe explicit submitted play, then gradually adapt operand/target span, task composition and later concept progression.
2. **Gameplay challenge** — AI competence, pursuit pressure, reaction windows and tactical threat.

Never let gameplay challenge silently change mathematical progression.

Adaptation rules from `LEARNING_PROFILES.md` are binding:
- span/composition adapts before new concepts,
- use sustained evidence/hysteresis rather than one result,
- no reaction-time pressure,
- no abrupt success punishment,
- correctness remains hidden until submit,
- family overrides may exist later,
- school-year/grade labels are localized approximate guidance layered on canonical skills, never the source of truth.

Family-facing presentation should communicate the current state rather than demand an up-front choice, e.g.:
- `DU ÜBST GERADE`
- `KLAPPT SCHON GUT`
- `ALS NÄCHSTES`
- recognizable arithmetic examples
- optional localized school-stage recommendation
- separate tactical gameplay challenge control.

## Current development phase

Follow `DEVELOPMENT_PLAN_NEXT.md`. The current agent/session is responsible for the complete campaign/framework/adaptive-learning milestone before deliberate handoff:

0. hosted GitHub Pages preview,
1. campaign shell + deck catalog + zero-friction learning entry,
2. progression/save + adaptive span/progression + independent tactical challenge + small C3 proof deck,
3. reusable line-of-sight/perception foundation,
4. automated smoke coverage and framework hardening,
5. fix concrete feedback from Playtest Gates A and B,
6. only then prepare the deliberate next-agent handoff.

Klaus should not be asked to playtest routine intermediate commits. Use CI/automated tests and ask for the manual gates defined in the plan.

Do not spend this milestone on final art, many production decks, a full international curriculum database, sophisticated ML-style adaptation, Treasure Golem implementation, neutral-worker reward economy or broad new board mechanics unless required to support the framework.

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

If this is a genuine handoff/new session, summarize the four authoritative documents and the current branch/CI/deployment state before changing code. Then continue the first incomplete package in `DEVELOPMENT_PLAN_NEXT.md`; do not restart completed work.