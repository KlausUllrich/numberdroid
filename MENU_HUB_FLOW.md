# Numberdroid — Title, Profile & Hub Flow

This document defines the binding player-facing navigation and campaign presentation for Numberdroid. Read it together with `CAMPAIGN_PROGRESSION.md`, `LEARNING_PROFILES.md`, `ENCOUNTER_ARCHETYPES.md`, `CODEX_HANDOFF.md`, and the latest dedicated handoff document.

## Core product rule

The campaign data model may know about approximately 25 decks and multiple acts. The player-facing UI must **not** expose the whole campaign as a level-select spreadsheet.

Numberdroid should feel like an adventure with a current place, current objective and gradually revealed world.

Canonical flow:

```text
FULLSCREEN / DISPLAY SETUP (browser build only)
→ INTRO
→ TITLE SCREEN
→ CONTINUE EXISTING PROFILE
   or CREATE NEW PROFILE
→ PERSONAL HUB
→ NEXT / RUNNING MISSION
→ DECK GAMEPLAY
→ SUCCESS STORY or MISSION FAILURE
→ PERSONAL HUB
```

Settings live at title-screen level. Collection, achievements, story archive and player statistics belong to the player profile and are accessed from the hub.

## Browser fullscreen / future Capacitor boundary

For the current browser/PWA prototype, fullscreen is requested **before the intro** on devices where fullscreen is useful. This avoids asking for a display-mode transition after the player has already entered the menu or mission flow.

Binding current behavior:
- mobile/coarse-pointer browser builds may show the fullscreen setup immediately on startup,
- the user may enter fullscreen or explicitly continue without it,
- the small manual fullscreen toggle remains available throughout the browser prototype,
- fullscreen/orientation remains owned by the app shell; individual screens do not compete for it.

Likely production direction: package the game with Capacitor/native-shell behavior. If that removes the browser fullscreen problem, the temporary fullscreen startup prompt and manual toggle may be removed. Do not make the browser workaround part of permanent game design.

## Intro

The intro is a short branded entry into the game.

Rules:
- no profile or campaign configuration here,
- short and skippable/advanceable,
- it leads to the title screen,
- in the browser prototype, display/fullscreen setup has already happened before this point.

## Title screen

The title screen is global, outside the personal campaign world.

Primary actions:
- `FORTSETZEN · <PROFILNAME>` when at least one profile exists,
- compact profile switch control when multiple profiles exist,
- `NEUES PROFIL`,
- `EINSTELLUNGEN`.

The title screen must not show the 25-deck planning target, all acts, a campaign spreadsheet, or run-specific math configuration.

Profile switching belongs primarily here. The hub returns here through `HAUPTMENÜ`.

## First install / no profiles

A true first-time installation may contain zero profiles. Do not create a fake visible `SPIELER 1` merely to satisfy runtime assumptions. Legacy development/player profiles may be migrated and remain usable.

## New profile wizard

Profile creation is a short wizard, not a settings page.

### Step 1 — Child or adult

Ask `KIND` or `ERWACHSENER`. This is not a difficulty selection; it defines onboarding behavior and leaves room for later presentation/parental differences.

### Step 2 — Name

The profile owns campaign progress, running mission state, mathematics baseline/evidence, tactical preference, and later collection/achievement/story data.

### Step 3 — Mathematics starting estimate for children

Children receive a friendly self-assessment using recognizable examples. Current implemented start points are limited to math the duel genuinely supports:
- small plus/minus,
- plus/minus to about 20,
- larger plus/minus.

Do not pretend multiplication/division are playable until real duel protocols exist.

No test, no score, no school-grade requirement. Choosing an easy start is safe, and easy arithmetic remains useful later.

### Adults

Adults currently skip the child knowledge question and receive a sensible higher addition/subtraction default. Later profile/statistics UI can expose adjustment without adding onboarding friction.

## Personal hub

Choosing `FORTSETZEN` enters the selected profile's **hub**, never directly into a deck.

The hub is the stable resting place for that player's campaign. Each active act should eventually have its own thematic presentation while sharing reusable hub infrastructure.

Illustrative themes remain TBD: early controlled/infiltrated ship, later planet/operation, late enemy mothership, etc. Do not expose how many future acts exist before the story reveals them.

### What the hub reveals

The hub may show:
- current thematic location,
- progress **inside the current active act/area**,
- next available mission,
- running mission that can be resumed,
- collection,
- achievements,
- story/logbook,
- player statistics,
- return to main menu.

The internal approximately-25-deck structure remains an authoring/production model only.

## Hub archive sections are dedicated screens

`SAMMLUNG`, `ERFOLGE`, `LOGBUCH`, and `STATISTIK` are not small widgets inside the mission console. Each opens as its **own full-screen hub sub-screen** with a clear `← HUB` return action.

This is binding because these systems will grow substantially:
- collection may contain robots, rare objects, discoveries and completion data,
- achievements need space for categories/progress/rewards,
- logbook may contain story fragments, locations, characters and recovered data,
- statistics may expose mathematics evidence, difficulty calibration and parent/adult detail.

The current implementations are structural placeholders. Do not collapse them back into one crowded right-hand panel.

## Mission start, resume and failure

### Starting a mission

From the hub, the dominant action is the next not-yet-completed playable deck/mission.

### Leaving a live mission voluntarily

If a player returns to the hub while the run is viable:
- preserve the profile-specific floor/run save,
- keep the mission marked as running,
- hub presents `MISSION FORTSETZEN`.

### Losing one duel — deck restart penalty

A lost duel is now a meaningful but child-friendly campaign penalty:

```text
DUEL LOST
→ lose 1 robot HP
→ reset the current deck to its authored starting state
→ restart at the beginning of the SAME deck
```

Important consequences:
- defeated encounters on that run reset,
- acquired deck-local keys/resources/actions reset,
- position/body return to the deck's authored start state,
- accumulated `damageTaken` remains, so the player has one fewer HP,
- the mission/deck itself remains the active mission.

This is deliberately stronger than merely retreating a few meters from the opponent, but weaker than returning to the hub after every lost duel.

### Mission failure / 0 HP

When accumulated damage reaches 0 remaining HP:
- mission is not completed,
- return to hub,
- clear the running-mission flag,
- next attempt starts the mission fresh with restored HP,
- do not strand campaign players on a separate destroyed-screen loop.

Direct developer floor previews may retain the legacy destroyed/restart screen.

## Mission success

Completing the deck goal:
1. marks the deck completed for that profile,
2. unlocks the authored successor where applicable,
3. shows a short success/story screen,
4. returns to the hub.

Do not jump directly from success into the next deck by default. The hub should reflect the changed campaign state and present the next mission in context.

## Collection and achievements

Numberdroid should deliberately support collector and achiever motivations in addition to campaign completion and arithmetic improvement.

Potential persistent content:
- unusual finds,
- discovered robot/body entries,
- rare items/resources,
- hidden or visible collectibles,
- achievements/milestones,
- completion challenges,
- story/data fragments.

Do not add arbitrary collectible currencies without a design purpose.

## Story/logbook

Completed story beats should be reviewable. Potential contents include mission outcomes, recovered logs, character descriptions, robot entries, location lore and story fragments.

## Player statistics and learning transparency

The statistics screen should eventually make the adaptive mathematics model understandable rather than a hidden black box.

Useful presentation:
- current approximate math baseline,
- `KLAPPT SCHON GUT`,
- `WIRD GERADE GEÜBT`,
- likely next capability,
- evidence/confidence over sustained play,
- optional localized school-stage guidance,
- separate tactical preference.

A child view remains friendly/non-evaluative; a parent/adult detail view may expose more explicit evidence and calibration state.

## Settings

Global settings are accessed from the title screen. Expected categories: audio, language, later accessibility/control/display options. Language support must eventually use proper localization resources.

## Layout rule

Primary navigation screens target landscape/mobile and should fit the viewport without document scrolling:
- startup/fullscreen prompt,
- intro,
- title,
- profile wizard,
- hub,
- each hub archive screen,
- settings,
- success/failure transitions.

If content grows, use contained internal scrolling/pagination inside the dedicated screen rather than turning the root document into a long website.

## Current implementation status

Implemented on `agent/integrate-metagame-architecture`:
- browser fullscreen setup before intro plus temporary manual fullscreen toggle,
- intro/title flow,
- zero-profile first install,
- active-profile continue and multiple-profile cycling,
- child/adult wizard and child math baseline selection,
- persisted settings shell,
- thematic Act-1 ship hub prototype,
- current-act progress only,
- mission start/resume,
- profile-specific running mission saves,
- dedicated full-screen collection/achievement/logbook/statistics views,
- success → story → hub,
- single duel loss → same deck restart + 1 HP damage,
- 0 HP → hub + fresh mission retry,
- developer direct-floor preview behavior retained.

The current art/content is structural prototype work, not final story/art direction.

## Deferred hub/content work

- final intro cinematic/title art/audio,
- final per-act hub art/themes,
- persistent collectible schema/content,
- broad achievement catalog,
- final story archive/character database,
- detailed adaptive-learning evidence dashboard,
- parental detail view,
- production localization pipeline/additional languages,
- final audio/accessibility settings,
- removal of browser fullscreen workaround if Capacitor/native shell makes it unnecessary.
