# Numberdroid — Prompt for the next agent

You are continuing development of **Numberdroid** in repository `KlausUllrich/numberdroid` on branch:

```text
agent/integrate-metagame-architecture
```

Do **not** merge draft PR #1 unless Klaus explicitly asks you to.

Before making changes, read these files completely, in this order:

1. `CODEX_HANDOFF.md`
2. `ENCOUNTER_ARCHETYPES.md`
3. `CAMPAIGN_PROGRESSION.md`
4. `LEARNING_PROFILES.md`
5. `DEVELOPMENT_PLAN_NEXT.md`

Treat them together as the authoritative handover. `CODEX_HANDOFF.md` is the established runtime/gameplay base; the later documents extend it with the current encounter, campaign, educational and development decisions.

## Architecture boundary

- A7 parity and the first complete B2/VS2 gameplay loop are established.
- Do not perform another broad migration/rewrite.
- Preserve local RAF movement/camera and physical body-size/drive behavior.
- Preserve hidden arithmetic correctness until explicit submit.
- Extend Floor/Tiled/runtime systems rather than adding per-map DOM hacks.
- Robot bodies are physical; physical collision always opens scan.
- Neutral robots do not pursue.
- Guards visibly trigger, accelerate, chase inside a leash, scan on collision, and return to post when escaped.
- Future robot perception must use line of sight rather than seeing through walls/closed doors.
- Treasure Golem / Beutedroide is a future authored trap/capture encounter.

## Campaign product rule

Numberdroid has **one shared story campaign**. Current planning target is about **25 decks**, likely grouped into larger acts, but runtime/data architecture must be count-agnostic.

Every player profile can play the entire same campaign:
- same ship/decks,
- same story order,
- same recognizable robots/bosses,
- same campaign-mechanic unlocks,
- personalized concrete arithmetic.

Do not create separate easy/advanced campaigns and do not skip early story decks for mathematically advanced players.

### Campaign progression has several independent dimensions

1. **Player mathematics baseline** stored in the player profile.
2. **Robot mathematical role/type** (`comfort/basic`, `practice/core`, `stretch/security`, `specialist`, `boss`).
3. **Deck curve**: easier arrival → stronger encounters → boss; next deck provides some breathing room but a higher ceiling.
4. **Campaign system complexity**: later decks introduce/compose more mechanics such as Joker/body skills, keys, new robot behaviors, Treasure Golem/traps and number-board elements.
5. **Tactical challenge** remains a separate setting for AI/pursuit/reaction pressure.

Easy arithmetic remains valid throughout the campaign. Mastering `+/- to 10` does not mean it should disappear; easy robots provide fluency, pacing and satisfying mastery.

Do not make adaptation the primary global difficulty engine. Profile adaptation only calibrates the arithmetic envelope while preserving robot identity and authored deck pacing.

## Player mathematics profile

A profile may have a friendly initial self-assessment using recognizable example tasks/capabilities. This is a starting estimate, not an exam.

Rules:
- safe default / simply starting must remain possible,
- no mandatory placement test,
- mathematics baseline can be changed/refined later,
- actual play may conservatively calibrate it,
- school-year labels are localized approximate guidance only,
- tactical challenge is stored/controlled separately.

## Current development phase

Follow `DEVELOPMENT_PLAN_NEXT.md`.

Package 0 — hosted Pages preview — is complete. Current preview target:

```text
https://klausullrich.github.io/numberdroid/
```

The current agent/session remains responsible for:

1. campaign shell + deck catalog + player-profile foundation,
2. campaign persistence/progression + robot math roles + authored deck difficulty curve + small C3 proof,
3. reusable LOS/perception foundation,
4. automated smoke coverage/framework hardening,
5. Playtest Gates A and B feedback,
6. only then deliberate handoff.

Klaus should not be asked to test routine intermediate commits.

Do not spend this milestone building all ~25 decks, final story/art, full Treasure Golem content, a sophisticated adaptive-learning algorithm, a full international curriculum database or a broad catalog of new board mechanics.

Current local B2 preview:

```text
http://localhost:5173/?floor=deck-vs2
```

Local workflow:

```bash
git pull --ff-only
npm run build
npm run dev -- --host 0.0.0.0
```

If this is a genuine new session/handoff, summarize all five authoritative documents and verify branch/CI/Pages state before changing code. Then continue the first incomplete package in `DEVELOPMENT_PLAN_NEXT.md`; do not restart completed work.
