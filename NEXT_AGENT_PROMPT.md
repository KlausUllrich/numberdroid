# Numberdroid — Prompt for the next agent

You are continuing development of **Numberdroid** in repository `KlausUllrich/numberdroid` on branch:

```text
agent/integrate-metagame-architecture
```

Do **not** merge draft PR #1 unless Klaus explicitly asks you to.

## Read first

Before changing code, read these files completely in this order:

1. `HANDOFF_2026-08-12.md`
2. `CODEX_HANDOFF.md`
3. `ENCOUNTER_ARCHETYPES.md`
4. `CAMPAIGN_PROGRESSION.md`
5. `LEARNING_PROFILES.md`
6. `MENU_HUB_FLOW.md`
7. `DEVELOPMENT_PLAN_NEXT.md`

`HANDOFF_2026-08-12.md` is the newest status/handoff checkpoint. It supersedes outdated roadmap/status statements in older documents while preserving their binding architecture/gameplay rules.

## Architecture boundary

Do not perform another broad migration/rewrite.

Preserve:
- local RAF movement/camera,
- physical body size and body-specific drive feel,
- Floor/Tiled authoring,
- hidden arithmetic correctness until explicit `REAKTOR AUSLÖSEN`,
- physical collision → scan,
- neutral/guard/patrol/aggressive distinctions,
- line-of-sight perception and lost-sight investigation,
- profile-specific campaign/save/math state,
- shared campaign for every math profile,
- separate tactical challenge,
- title/profile/hub navigation.

No hidden DOM clicks, MutationObservers, reload bridges, DOM patching or localStorage message buses.

## Current product flow

Browser prototype:

```text
FULLSCREEN SETUP (when needed)
→ INTRO
→ TITLE
→ CONTINUE / NEW PROFILE / SETTINGS
→ PERSONAL HUB
→ MISSION
→ DECK
→ SUCCESS → HUB
or
→ duel loss → same deck restarts from beginning with -1 HP
→ final HP loss → mission failure → HUB
```

The browser fullscreen prompt currently happens before intro. The small manual fullscreen toggle remains for now. Future Capacitor/native packaging may make both temporary browser workarounds removable.

The hub shows only the current thematic area/act and does not reveal total act count or all ~25 internal deck slots.

`SAMMLUNG`, `ERFOLGE`, `LOGBUCH`, and `STATISTIK` are dedicated full-screen hub views, not small side-panel widgets.

## Player profiles / math

A first install may have zero profiles.

Profile creation:
1. child/adult,
2. name,
3. child gets supported arithmetic starting estimate,
4. adult currently gets streamlined higher +/- default.

Current real duel math protocols are addition/subtraction. Do not present multiplication/division as playable until actual mechanics exist.

Difficulty is multidimensional:
- player math baseline/evidence,
- robot math role (`comfort/core/stretch/specialist/boss`),
- deck curve,
- campaign mechanic complexity,
- independent tactical challenge.

Latest human playtest confirmed child/adult balancing works very well.

## Duel / initiative rules

Preserve existing duel rules in the handoff documents.

New binding initiative rule:
- player starts the duel by default,
- player starts **every new boss phase** by default,
- KRONOS Firewall 1 → player starts,
- Firewall 2 after first break → player starts,
- exposed core after second break → player starts.

Future authored enemy ability `REAKTIONSSCHNELL` / Quick Reaction may explicitly override this and give a special opponent first move. It is not implemented yet.

## Duel loss rule

One lost duel:
- loses 1 HP,
- resets the entire current deck run,
- restarts the **same deck** from its authored beginning,
- resets deck-local encounter/key/action/resource progress,
- keeps accumulated HP damage.

At 0 remaining HP in campaign mode:
- mission fails,
- running mission clears,
- return to hub,
- next attempt starts fresh with restored HP.

Direct developer previews may retain the debug destroyed/restart loop.

## Completed framework — do not restart

- Pages preview/CI pipeline,
- campaign catalog,
- B2 integration,
- C3 proof deck,
- B2→C3 progression,
- family profiles and per-profile saves,
- child/adult onboarding,
- math roles and personalized envelopes,
- tactical challenge separation,
- hostile behavior and collision scan,
- LOS/view cone/investigation,
- intro/title/settings/profile wizard,
- thematic personal hub,
- mission resume,
- full-screen collection/achievement/logbook/statistics views,
- success/failure hub loop,
- deck-restart-on-duel-loss,
- player initiative on every KRONOS phase.

## First task in a new session

1. Verify current branch HEAD.
2. Verify latest Actions test/build/Pages state.
3. Summarize the established architecture/product rules from the documents.
4. Propose the next **single coherent content/system milestone** with Klaus.
5. Do not start a broad list of deferred systems simultaneously.

Potential future milestones are listed in `DEVELOPMENT_PLAN_NEXT.md`; they are options, not an instruction to implement them all.

Current public preview target:

```text
https://klausullrich.github.io/numberdroid/
```

Never merge PR #1 without explicit Klaus approval.
