# Numberdroid — Prompt for the next agent

You are continuing development of **Numberdroid** in repository `KlausUllrich/numberdroid` on branch:

```text
agent/integrate-metagame-architecture
```

Do **not** merge draft PR #1 unless Klaus explicitly asks you to.

Before making changes, read **`CODEX_HANDOFF.md` completely** and then **`ENCOUNTER_ARCHETYPES.md` completely**. Treat both as the authoritative handover for architecture, binding gameplay rules, validated behavior, current B2 state, encounter behavior design, prohibitions and the requested post-VS2 work.

Important context boundary:
- A7 parity and the first complete B2/VS2 gameplay loop are already established.
- Do not perform another broad migration or rewrite.
- Preserve the smooth local RAF movement/camera architecture and physical body-size/drive behavior.
- Preserve hidden arithmetic correctness until explicit submit.
- Extend current Floor/Tiled/runtime systems rather than adding per-map DOM hacks.
- Robot bodies are physical on the deck; hostile scans should occur on actual contact rather than an invisible long-range scan boundary.
- Neutral work robots are non-aggressive and voluntarily scannable.
- Guards leave their post when triggered, chase only inside a limited leash area, scan on contact, and return to their post when the player escapes.
- The future Treasure Golem / Beutedroide archetype requires an authored trap/environment interaction before it can be reached.

The next development phase is **gameplay enrichment**, especially:
1. finish and playtest neutral/guard/patrol/aggressive deck behavior,
2. visible staged enemy ability usage and a funnier/longer AI think-and-fail moment,
3. generalize Security cards so every key on a deck has its own authored color consistently across enemy cue, scan, transfer and matching door,
4. prototype simple child-friendly new board mechanics such as identical-number bonuses or dual-value tiles,
5. design the neutral-body risk/reward loop without inventing an arbitrary reward,
6. later prototype the Treasure Golem / trap encounter as an authored floor mechanic,
7. strengthen deck/room/robot personality and art direction.

Do not try to implement the entire list in one unreviewed batch. Follow the recommended order in `CODEX_HANDOFF.md`, build after coherent increments, and keep the game continuously testable on desktop and physical phone landscape.

Current preview URL after local startup:

```text
http://localhost:5173/?floor=deck-vs2
```

Normal A7:

```text
http://localhost:5173/
```

Local workflow:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

Start by summarizing what you understand from `CODEX_HANDOFF.md` and `ENCOUNTER_ARCHETYPES.md` and propose the **first small implementation block only** before changing code.