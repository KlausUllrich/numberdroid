# Numberdroid — Prompt for the next agent

You are continuing development of **Numberdroid** in repository `KlausUllrich/numberdroid` on branch:

```text
agent/integrate-metagame-architecture
```

Do **not** merge draft PR #1 unless Klaus explicitly asks you to.

Before making changes, read **`CODEX_HANDOFF.md` completely**. Treat it as the authoritative handover for architecture, binding gameplay rules, validated behavior, current B2 state, prohibitions and the newly requested post-VS2 work.

Important context boundary:
- A7 parity and the first complete B2/VS2 gameplay loop are already established.
- Do not perform another broad migration or rewrite.
- Preserve the smooth local RAF movement/camera architecture and physical body-size/drive behavior.
- Preserve hidden arithmetic correctness until explicit submit.
- Extend current Floor/Tiled/runtime systems rather than adding per-map DOM hacks.

The next development phase is **gameplay enrichment**, especially:
1. small duel/transfer UI regressions and firewall presentation cleanup,
2. KRONOS boss: two thin visible firewalls followed by a distinct exposed-core final fight,
3. automatic proximity encounters plus patrol/guard/aggressive pursuit behavior,
4. visible staged enemy ability usage and a funnier/longer AI think-and-fail moment,
5. improved player-change animation in the duel,
6. replace the textual chain-reward legend with a visual energy/progress bar without revealing arithmetic correctness,
7. prototype simple child-friendly new board mechanics such as identical-number bonuses or dual-value tiles,
8. generalize Security cards so every key on a deck has its own authored color consistently across enemy cue, scan, transfer and matching door,
9. later strengthen deck/room/robot personality and art direction.

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

Start by summarizing what you understand from `CODEX_HANDOFF.md` and propose the **first small implementation block only** before changing code.
