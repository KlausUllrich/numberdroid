# Numberdroid — Title, Profile & Hub Flow

This document defines the binding player-facing navigation and campaign presentation for Numberdroid. Read it together with `CAMPAIGN_PROGRESSION.md`, `LEARNING_PROFILES.md`, `ENCOUNTER_ARCHETYPES.md`, `STORY_WORLD_FOUNDATION.md`, and the latest dedicated handoff document.

## Core product rule

The campaign data model may know about approximately 25 decks and multiple areas/acts. The player-facing UI must **not** expose the whole campaign as a level-select spreadsheet.

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

Likely production direction: package the game with Capacitor/native-shell behavior. If that removes the browser fullscreen problem, the temporary fullscreen startup prompt and manual toggle may be removed.

## Intro

The intro is a short entry into the game and now also owns the start of the Transfer story defined in `CAMPAIGN_STORY_LEVEL_PROGRESSION.md`.

Rules:
- no profile/campaign spreadsheet here,
- short and advanceable,
- use the player's own profile/name where appropriate,
- in the browser prototype display/fullscreen setup has already happened.

## Title screen

The title screen is global, outside the personal campaign world.

Primary actions:
- `FORTSETZEN · <PROFILNAME>` when at least one profile exists,
- compact profile switch control when multiple profiles exist,
- `NEUES PROFIL`,
- `EINSTELLUNGEN`.

The title screen must not show the 25-deck planning target, all acts, a campaign spreadsheet or run-specific math configuration.

## First install / new profile wizard

A true first install may contain zero profiles. Do not create a fake visible `SPIELER 1` merely to satisfy runtime assumptions.

Profile creation remains a short wizard:
1. child or adult,
2. name,
3. child receives a friendly supported arithmetic starting estimate,
4. adult gets the streamlined higher addition/subtraction default.

Current supported visible mathematics remains addition/subtraction; do not expose multiplication/division as playable until actual protocols exist.

## Personal hub

Choosing `FORTSETZEN` enters the selected profile's **hub**, never directly into a deck.

The hub is the stable resting place for that player's campaign. It may show:
- current thematic location,
- progress inside the current active area,
- next mission,
- running mission that can be resumed,
- collection,
- achievements,
- story/logbook,
- player statistics,
- return to main menu.

The internal approximately-25-beat structure remains an authoring/production model only.

## Hub archive sections are dedicated screens

`SAMMLUNG`, `ERFOLGE`, `LOGBUCH`, and `STATISTIK` each open as their **own full-screen hub sub-screen** with a clear `← HUB` return action.

Do not collapse them back into a small side-console panel.

## Mission start, resume and failure

### Starting a mission

From the hub, the dominant action is the next not-yet-completed playable mission.

### Leaving a live mission voluntarily

If a player returns to the hub while the run is viable:
- preserve the profile-specific floor/run save,
- keep the mission marked as running,
- hub presents `MISSION FORTSETZEN`.

### Losing one duel — corrected binding rule

The earlier design that reset the whole deck after every lost duel was a misunderstanding.

Binding and implemented behavior:

```text
DUEL LOST
→ lose 1 robot HP
→ keep the active robot body
→ return that body to the authored level-start position
→ preserve existing deck progress
```

Preserve after a single duel loss:
- already defeated/eliminated robots,
- deck-local keys/access already earned,
- used stations and collected pickups,
- completed deck-local actions,
- remaining meta-energy,
- other persistent run progress.

The player is being pushed back, **not replaying the entire deck**.

For bosses, the surrounding deck progress remains, but the boss encounter itself restarts from **Phase 1** on the next attempt.

### Mission failure / 0 HP

When the final HP is lost:
- mission is not completed,
- return to hub,
- clear the running-mission flag,
- next attempt starts the mission as a fresh deck run with restored HP,
- do not strand campaign players on a separate destroyed-screen loop.

Direct developer floor previews may retain the legacy destroyed/restart screen where useful.

### Current implementation

The corrected single-duel retreat is implemented in `src/game/duelLoss.ts` and used by `App.finishBattle()`. Focused automated tests verify that deck progress survives the retreat.

## Mission success

Completing the mission goal:
1. marks it completed for that profile,
2. unlocks the authored successor where applicable,
3. shows a short success/story beat,
4. returns to the hub.

Do not jump directly from success into the next deck by default.

## Collection, achievements, story and learning transparency

Numberdroid should support collector/achiever motivations alongside campaign progression and arithmetic improvement.

Potential persistent content includes robot/body discoveries, rare finds, collectibles with purpose, achievements, story fragments and location/character logbook material.

Statistics should eventually make mathematics calibration understandable rather than a hidden black box. Child presentation remains friendly/non-evaluative; parent/adult detail may expose more evidence.

## Settings and layout

Global settings live at title level. Expected categories include audio, language and later accessibility/control/display options.

Primary navigation screens target landscape/mobile and should fit the viewport without root-document scrolling. If content grows, use contained internal scrolling/pagination inside the dedicated screen.

## Current implementation status

Implemented on `agent/integrate-metagame-architecture`:
- browser fullscreen setup before intro plus temporary manual fullscreen toggle,
- intro/title flow,
- zero-profile first install,
- active-profile continue and multiple-profile cycling,
- child/adult wizard and supported child math baseline selection,
- persisted settings shell,
- thematic Act-1/ship hub prototype,
- current-area progress only,
- mission start/resume,
- profile-specific running mission saves,
- dedicated full-screen collection/achievement/logbook/statistics views,
- success → story → hub,
- single-duel loss → -1 HP + level-start retreat while deck progress persists,
- boss re-entry → boss starts from Phase 1,
- final HP loss → hub + fresh mission retry,
- developer direct-floor preview behavior retained.

The current art/content remains structural prototype work, not final story/art direction.
