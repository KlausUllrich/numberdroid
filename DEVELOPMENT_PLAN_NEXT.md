# Numberdroid — Next Development Plan

This plan reflects the current integrated framework on `agent/integrate-metagame-architecture` and is designed to minimize repeated manual testing.

Read these binding documents together:
- `CODEX_HANDOFF.md`
- `ENCOUNTER_ARCHETYPES.md`
- `CAMPAIGN_PROGRESSION.md`
- `LEARNING_PROFILES.md`
- `MENU_HUB_FLOW.md`

## Working principle

Routine regressions belong in CI/automated tests. Klaus should be asked to playtest only when feel, comprehension, progression or family-learning behavior requires human judgment.

Do not restart completed packages. Do not broadly rewrite the established runtime.

## Completed package 0 — Remote preview

Status: **complete**.

Hosted target:

```text
https://klausullrich.github.io/numberdroid/
```

Established:
- agent branch deploys to GitHub Pages,
- tests/build and Pages use the same build pipeline,
- Vite asset paths are deployment-safe,
- redundant current-branch PR build is avoided,
- draft PR #1 remains unmerged unless Klaus explicitly requests otherwise.

## Completed package 1 — Campaign/profile foundation

Status: **complete**.

Implemented:
- count-agnostic campaign/deck catalog with approximately 25 internal planning slots,
- B2 integrated as first campaign mission,
- persistent multiple family profiles,
- profile-specific campaign progress,
- per-profile running mission saves,
- zero-profile first-install support,
- child/adult profile distinction,
- profile mathematics starting baseline,
- separate tactical preference.

## Completed package 2 — Progression / C3 / math roles

Status: **complete**.

Implemented:
- B2 success → story → successor unlock,
- small playable C3 proof deck,
- robot mathematical role independent from tactical behavior,
- profile/deck/robot-derived arithmetic envelope,
- stronger profiles fan out more on later content while comfort robots remain easy,
- tactical challenge affects duel AI and deck pursuit separately from mathematics,
- campaign mechanic metadata supports staged future systems.

Important limitation:
- real duel protocols currently cover addition/subtraction only,
- multiplication/division remain future systems and must not be represented as already-playable modes.

## Completed package 3 — Robot perception

Status: **complete**.

Implemented:
- authored range plus line of sight,
- walls/non-walkable geometry/obstacles block sight,
- closed doors block sight,
- view cone support,
- visible chase state,
- lost-sight investigation at last known position,
- return/give-up behavior,
- guard leash remains intact,
- physical collision always opens scan regardless of sight.

## Completed package 4 — Framework hardening

Status: **complete for the current framework milestone**.

Implemented/tested:
- campaign catalog ordering/progression,
- B2 → C3 unlock,
- family profile isolation,
- profile-specific resume state,
- robot math role parsing,
- deterministic math-envelope resolution,
- tactical-pressure resolution,
- LOS/door/obstacle geometry,
- floor-goal completion,
- CI `Test → Build → Pages`.

## Completed package 5 — Title / Profile Wizard / Personal Hub

Status: **implemented; awaiting integrated human playtest**.

The previous all-in-one `CampaignScreen` is no longer the canonical product UX.

Implemented flow:

```text
INTRO
→ TITLE SCREEN
→ CONTINUE PROFILE / NEW PROFILE / SETTINGS
→ PERSONAL HUB
→ START / RESUME MISSION
→ DECK
→ SUCCESS STORY → HUB
   or
→ 0 HP / FAILURE → HUB
```

Implemented details:
- compact profile cycling from title when several profiles exist,
- child/adult selection during profile creation,
- name step,
- child-only supported +/- starting estimate,
- adult streamlined default,
- viewport-contained landscape menu screens (no root document scrolling),
- title-level persisted master-volume settings shell and honest German-only language state,
- Act-1 ship hub structural prototype,
- current-act progress only; no total-act/25-deck reveal,
- dominant next mission / `MISSION FORTSETZEN`,
- collection/achievements/logbook/statistics hub entry points,
- voluntary mission exit preserves resumable run,
- campaign 0 HP clears run and returns to hub for a fresh retry,
- success screen returns to hub rather than jumping directly into the next deck,
- direct developer floor previews retain the debug destroyed/restart flow.

The hub art/theme and auxiliary collection/statistics content are structural prototypes, not final production content.

## Current human gate — Integrated Hub/Campaign Playtest

This is now the next useful manual test. Do **not** request separate micro-tests before it unless CI exposes a blocker.

Test one coherent session from the hosted root URL.

### A. Entry/navigation
1. Intro fits and advances cleanly.
2. Title screen fits without scrolling.
3. Existing profile shows `FORTSETZEN · <NAME>`.
4. Multiple profiles can be cycled without entering the campaign.
5. `NEUES PROFIL` and `EINSTELLUNGEN` are understandable.

### B. Profile creation
1. Child/adult choice is clear and non-judgmental.
2. Name step is obvious.
3. Child math estimate feels like guidance rather than a test.
4. Supported math examples are believable and fit the viewport.
5. Adult onboarding feels appropriately quick.

### C. Hub comprehension
1. Hub feels like a place in the story, not a level spreadsheet.
2. Current-area progress is understandable.
3. No total number of acts or 25-deck roadmap is exposed.
4. Next mission is obvious.
5. Collection/achievement/logbook/statistics affordances are readable without dominating the mission.
6. Returning to main menu feels structurally clear.

### D. Mission lifecycle
1. Start B2 from hub.
2. Voluntarily return to hub and verify `MISSION FORTSETZEN`.
3. Resume and verify position/body/progress remain appropriate.
4. If practical, verify 0 HP returns to hub and the next attempt starts fresh.
5. Complete B2 and verify success/story screen → hub → C3 as next mission.
6. Verify C3 still demonstrates comfort vs specialist math-role separation.

### E. Existing gameplay feel
1. Robot collision still opens scan.
2. Guards/hunters require line of sight.
3. Losing sight gives readable `?` investigation then return/give-up.
4. `ENTDECKER/STANDARD/HERAUSFORDERUNG` remains tactical rather than a math selector.
5. Higher/lower math profiles feel like the same game/story with different arithmetic envelopes.
6. Phone landscape performance remains smooth.

## After integrated playtest

The current agent should:
1. fix concrete regressions and UX misunderstandings from the integrated gate,
2. add focused automated tests for any bug that can reasonably recur,
3. keep documentation synchronized,
4. run final tests/build/Pages,
5. prepare deliberate handoff.

Do not begin the full production campaign before this feedback is absorbed.

## Current-agent stopping point / handoff boundary

Handoff occurs after:
- integrated hub/campaign feedback is addressed,
- CI is green,
- hosted preview is current,
- final docs describe actual behavior,
- no known blocker remains in title/profile/hub/B2/C3/LOS/profile-save flow.

The handoff must include:
- final branch HEAD and CI state,
- hosted preview/deployment notes,
- title/profile/hub navigation model,
- profile schema and migration behavior,
- per-profile save/resume/failure rules,
- campaign catalog/hidden-future-content rule,
- B2/C3 status,
- robot math-role / arithmetic-envelope model,
- tactical challenge model,
- LOS/investigation behavior,
- binding duel rules,
- known prototype limitations,
- deferred systems.

## Deferred production work

Unless needed to fix integrated feedback, defer:
- full ~25 production decks,
- final act/story writing,
- final hub themes/art per act,
- final intro/title art/audio,
- full persistent collectible schema/content,
- broad achievement catalog,
- character/lore database,
- full Treasure Golem implementation,
- neutral-worker reward economy,
- broad new number-board mechanic catalog,
- multiplication/division duel protocols,
- sophisticated adaptive-learning evidence engine,
- final international curriculum mappings,
- production localization pipeline,
- final long-campaign balancing,
- production-quality sound/music/VFX/accessibility pass.
