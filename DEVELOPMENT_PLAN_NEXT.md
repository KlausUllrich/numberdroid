# Numberdroid — Next Development Plan

This plan reflects the completed campaign/framework milestone on `agent/integrate-metagame-architecture`.

Read first:
- `HANDOFF_2026-08-12.md`
- `CODEX_HANDOFF.md`
- `ENCOUNTER_ARCHETYPES.md`
- `CAMPAIGN_PROGRESSION.md`
- `LEARNING_PROFILES.md`
- `MENU_HUB_FLOW.md`

## Working principle

Routine regressions belong in CI/automated tests. Human playtests are for feel, comprehension, progression and family-learning behavior. Do not broadly rewrite the established runtime or restart completed packages.

## Package 0 — Remote preview

Status: **complete**.

Hosted target:

```text
https://klausullrich.github.io/numberdroid/
```

Agent branch builds/tests and deploys to GitHub Pages. Draft PR #1 remains unmerged unless Klaus explicitly requests otherwise.

## Package 1 — Campaign/profile foundation

Status: **complete**.

Implemented:
- count-agnostic campaign catalog with ~25 internal planning slots,
- B2 integrated as first campaign mission,
- multiple isolated family profiles,
- zero-profile first install,
- child/adult onboarding,
- profile math baseline,
- independent tactical preference,
- profile-specific campaign progress and running mission saves.

## Package 2 — Progression / C3 / math roles

Status: **complete**.

Implemented:
- B2 success → story → C3 unlock,
- small playable C3 proof,
- robot math role independent from tactical behavior,
- profile/deck/robot-derived arithmetic envelopes,
- stronger profiles fan out more on later content while comfort encounters remain easy,
- tactical challenge affects duel AI and deck pursuit, not mathematics,
- campaign mechanic metadata supports staged future systems.

Current real arithmetic protocols are addition/subtraction only. Multiplication/division remain future systems.

## Package 3 — Robot perception

Status: **complete**.

Implemented:
- line of sight + authored range,
- walls/non-walkable geometry/obstacles/closed doors block sight,
- view cone support,
- visible chase state,
- lost-sight investigation at last known position,
- guard return / hunter give-up,
- guard leash retained,
- physical collision always opens scan.

## Package 4 — Framework hardening

Status: **complete for this milestone**.

Automated coverage includes campaign ordering/progression, B2→C3 unlock, profile isolation, resume state, math-role parsing, math-envelope resolution, tactical pressure, LOS geometry and floor-goal completion. CI runs `Test → Build → Pages`.

## Package 5 — Title / Profile Wizard / Personal Hub

Status: **complete and human-tested**.

Canonical player flow:

```text
FULLSCREEN SETUP (browser prototype where needed)
→ INTRO
→ TITLE
→ CONTINUE PROFILE / NEW PROFILE / SETTINGS
→ PERSONAL HUB
→ START / RESUME MISSION
→ DECK
→ SUCCESS STORY → HUB
or
→ duel loss → same deck restarts with -1 HP
→ 0 HP → mission failure → HUB
```

Implemented:
- fullscreen request before intro on relevant browser/mobile devices,
- temporary manual fullscreen toggle retained for browser prototype,
- compact profile cycling,
- child/adult wizard,
- child supported +/- estimate,
- adult streamlined default,
- landscape viewport-contained menu screens,
- settings shell,
- Act-1 thematic ship hub prototype,
- current-act progress only; no future-act/25-deck reveal,
- mission start/resume,
- profile-specific running mission save,
- collection/achievements/logbook/statistics as dedicated full-screen hub views,
- voluntary exit → resumable mission,
- duel loss → entire same deck restarts at authored start with one HP lost,
- final HP loss → hub + fresh future attempt,
- success/story → hub.

## Integrated human playtest — completed

Klaus tested both a **child profile** and an **adult profile** on the hosted build.

Result:
- arithmetic balancing was explicitly reported as working very well,
- profile differentiation works without splitting the campaign,
- only a small final refinement list remained.

Final requested refinements have been implemented:
1. fullscreen request moved to startup before intro,
2. four hub archive items promoted to full-screen views,
3. duel loss now restarts the same deck from its beginning and removes 1 HP,
4. player now starts each new KRONOS phase.

Future initiative exception is explicitly deferred as an authored ability: `REAKTIONSSCHNELL` / Quick Reaction may allow a special opponent to start first.

## Handoff status

The campaign/framework milestone is now **ready for deliberate handoff** once the final branch CI/Pages run is verified green/current.

The next agent must not reopen solved work in:
- title/profile/hub navigation,
- profile/save separation,
- B2/C3 campaign integration,
- math role/envelope architecture,
- tactical challenge separation,
- LOS/investigation runtime,
- browser preview pipeline.

The next phase should be chosen as a new **content/system milestone on top of this framework**.

## Likely next milestone candidates — choose with Klaus, do not assume

Examples:
- design/author first additional production decks after C3,
- first new number-board mechanic introduced through campaign pacing,
- Treasure Golem/capture system,
- real collection/achievement persistence and rewards,
- multiplication/division protocol design,
- story/act/hub content pass,
- adaptive evidence/statistics layer,
- Capacitor/native packaging.

Do not start all of these at once.

## Deferred production work

- full ~25 production decks,
- final act/story writing,
- final hub themes/art,
- final intro/title art/audio,
- persistent collectible schema/content,
- broad achievement catalog,
- character/lore database,
- Treasure Golem implementation,
- neutral-worker reward economy,
- broad number-board mechanic catalog,
- multiplication/division duel protocols,
- Quick Reaction and broader enemy ability catalog,
- sophisticated adaptive-learning evidence engine,
- international curriculum mappings,
- production localization,
- long-campaign balancing,
- production sound/music/VFX/accessibility,
- Capacitor packaging and later removal of browser fullscreen workaround.
