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
5. `MENU_HUB_FLOW.md`
6. `DEVELOPMENT_PLAN_NEXT.md`

Treat them together as the authoritative handover.

## Runtime architecture boundary

- A7 parity and the complete B2 gameplay loop are established.
- Do not perform another broad migration/rewrite.
- Preserve local RAF movement/camera and physical body-size/drive behavior.
- Preserve hidden arithmetic correctness until explicit `REAKTOR AUSLÖSEN`.
- Extend Floor/Tiled/runtime systems rather than adding per-map DOM hacks.
- Robot bodies are physical; physical collision always opens scan.
- Neutral robots do not pursue.
- Guards/hunters use authored range + line of sight; walls/obstacles/closed doors block sight.
- Lost sight enters a visible investigation/search state before guard return or hunter give-up.
- Guard acceleration/leash/return remain authored behavior.
- Treasure Golem / Beutedroide remains future authored trap/capture content.

## Campaign product rule

Numberdroid has **one shared story campaign** for every mathematics profile.

Internal planning currently uses approximately 25 deck slots across several acts, but this is **not player-facing roadmap UI**.

Binding player flow is now:

```text
INTRO
→ TITLE
→ CONTINUE PROFILE / NEW PROFILE / SETTINGS
→ PERSONAL HUB
→ START / RESUME MISSION
→ DECK
→ SUCCESS STORY → HUB
   or
→ 0 HP / FAILURE → HUB
```

The old all-in-one `CampaignScreen` is no longer the canonical UX.

The personal hub:
- shows only the active thematic area/act,
- may show progress inside that current area,
- must not reveal total act count or all ~25 decks,
- owns access to collection, achievements, logbook/story and player statistics,
- provides next mission / running mission,
- returns to global title through `HAUPTMENÜ`.

## Profile onboarding

A true first install may contain zero profiles.

Profile creation:
1. child or adult,
2. name,
3. children receive a friendly supported arithmetic starting estimate,
4. adults currently skip the child math question and receive a higher +/- default.

Current real duel protocols are addition/subtraction. Do not present multiplication/division as playable modes before real mechanics exist.

Each profile independently owns:
- campaign progress,
- running floor/mission save,
- math baseline/evidence state,
- tactical preference,
- future collection/achievements/statistics.

## Difficulty architecture

Progression remains multidimensional:

1. **player mathematics baseline/evidence**,
2. **robot mathematics role** (`comfort`, `core`, `stretch`, `specialist`, `boss`),
3. **within-mission/deck curve**,
4. **campaign system complexity**,
5. **independent tactical challenge**.

Easy arithmetic remains useful throughout the campaign. Stronger profiles do not skip early story missions and comfort robots do not disappear.

Tactical behavior (`neutral/guard/patrol/aggressive`) is independent from mathematical role.

`ENTDECKER / STANDARD / HERAUSFORDERUNG` tunes duel AI and deck pursuit pressure, not mathematics knowledge.

## Current implementation status

Completed and should not be restarted:
- GitHub Pages remote preview,
- campaign/deck catalog,
- B2 campaign integration,
- playable C3 proof,
- B2 success → unlock C3,
- multiple isolated family profiles,
- per-profile mission save/resume,
- child/adult profile type,
- profile math baseline,
- robot math roles,
- profile/deck/robot arithmetic envelope,
- independent tactical challenge,
- neutral/guard/patrol/aggressive behavior,
- universal collision → scan,
- LOS/view cone/door/obstacle perception,
- lost-sight investigation + return/give-up,
- automated tests/build/Pages pipeline,
- intro/title/profile-wizard/settings/hub navigation,
- current-area-only hub progress,
- collection/achievement/logbook/statistics hub entry points,
- voluntary mission exit → `MISSION FORTSETZEN`,
- campaign 0 HP → hub + fresh retry,
- success story → hub.

Current hosted preview:

```text
https://klausullrich.github.io/numberdroid/
```

Current local direct B2 preview:

```text
http://localhost:5173/?floor=deck-vs2
```

## Current development phase

Follow `DEVELOPMENT_PLAN_NEXT.md`.

The next useful human step is the **integrated title/profile/hub/campaign playtest**. Do not ask Klaus to repeat routine micro-tests that automated CI can cover.

After Klaus provides integrated feedback:
1. fix concrete UX/gameplay regressions,
2. add focused tests for repeatable bugs,
3. keep docs synchronized,
4. verify tests/build/Pages,
5. perform deliberate handoff.

Do not spend this milestone building the full ~25 production decks, final story/art, final per-act hubs, full collectibles/achievements, full Treasure Golem content, multiplication/division, a sophisticated adaptive-learning engine or full localization unless required by a concrete blocker.

## Handoff rule

If this is a genuine new session:
- summarize all six authoritative documents,
- verify current branch HEAD,
- verify latest CI and Pages state,
- inspect the actual current code before changing it,
- continue the first incomplete item in `DEVELOPMENT_PLAN_NEXT.md`,
- do not restart completed campaign/profile/LOS/menu work,
- never merge PR #1 without explicit Klaus approval.
