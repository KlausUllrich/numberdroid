# Numberdroid

Cooperative math game for 1–4 children with a Paradroid-inspired robot takeover metagame.

## Current status

The repository contains two deliberately different artifacts:

- `zahlenkern-prototyp-meta-v7.html` — frozen, self-contained behavioral reference from the rapid prototype phase.
- `src/` — clean React/TypeScript architecture that integrates deck, encounter, number duel and body transfer without DOM bridges.

The clean architecture was extracted from v7. The prototype should remain unchanged as a regression/reference artifact.

## Architecture

The top-level app owns one explicit screen state:

```text
Deck → Encounter → NumberDuel → Transfer → Deck
                  ↘ loss ─────────→ Deck
```

Important boundaries:

- `MetaGame` owns movement and deck interaction.
- `NumberDuel` receives an `EncounterConfig` and returns a `BattleResult`.
- `TransferScreen` receives the old/new bodies and owns only the transfer presentation.
- `App` owns cross-screen state, body ownership, defeated enemies, meta-energy and save state.
- Fullscreen/orientation belongs to the app shell, not to the duel.

See `docs/ARCHITECTURE.md`.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Reference behavior

Read `CODEX_HANDOFF.md` before changing gameplay rules. Confirmed game-design decisions should not be silently changed during refactors.

## Current deliberate open question

A lost duel costs one life/integrity point. The exact maximum life count and the consequence at zero are not decided yet. The clean save model therefore records `damageTaken` rather than inventing a maximum.
