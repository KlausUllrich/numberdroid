# Numberdroid — Title, Profile & Hub Flow

This document defines the binding player-facing navigation and campaign presentation for Numberdroid. Read it together with `CAMPAIGN_PROGRESSION.md`, `LEARNING_PROFILES.md`, `ENCOUNTER_ARCHETYPES.md`, and `CODEX_HANDOFF.md`.

## Core product rule

The campaign data model may know about approximately 25 decks and multiple acts. The **player-facing UI must not expose the whole campaign as a level-select spreadsheet**.

Numberdroid should feel like an adventure with a current place, current objective and gradually revealed world.

The canonical flow is:

```text
INTRO
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

## Intro

The intro is a short branded entry into the game.

Rules:
- do not put profile or campaign configuration here,
- keep it short and skippable/advanceable,
- it leads to the title screen,
- mobile fullscreen setup must not obscure the intro/title/profile flow; fullscreen becomes relevant when actual gameplay starts.

## Title screen

The title screen is global, outside the personal campaign world.

Primary actions:
- `FORTSETZEN · <PROFILNAME>` when at least one profile exists,
- a compact profile switch control when multiple profiles exist,
- `NEUES PROFIL`,
- `EINSTELLUNGEN`.

The title screen must not show:
- the 25-deck planning target,
- all acts,
- a campaign spreadsheet,
- math-difficulty configuration for the active run.

Profile switching belongs primarily here. The hub can return to the title screen through `HAUPTMENÜ`.

## First install / no profiles

A true first-time installation may contain zero profiles.

Do not create a fake visible `SPIELER 1` merely to satisfy runtime assumptions. The title screen should simply offer profile creation.

Legacy development/player profiles may be migrated and remain usable.

## New profile wizard

Profile creation is a short wizard, not a settings page.

### Step 1 — Child or adult

Ask whether the profile belongs to:
- `KIND`, or
- `ERWACHSENER`.

This is not a difficulty selection. It defines onboarding behavior and leaves room for later differences in explanations, parental information and presentation.

### Step 2 — Name

Ask for the player's name/profile name.

The profile owns:
- campaign progress,
- running mission state,
- mathematics baseline/evidence,
- tactical preference,
- collection/achievement/story data as those systems mature.

### Step 3 — Mathematics starting estimate for children

Children receive a friendly self-assessment using recognizable arithmetic examples.

Current implemented supported start points are deliberately limited to arithmetic the duel system genuinely supports:
- small plus/minus,
- plus/minus to about 20,
- larger plus/minus.

Do not pretend multiplication/division are playable until real duel protocols/mechanics exist for them.

Rules:
- this is not a test,
- no score,
- no school-grade requirement,
- choosing an easy start is always safe,
- easy arithmetic remains in later decks anyway,
- the profile can later be calibrated by sustained confirmed play evidence.

### Adults

Adults skip the child knowledge question in the current flow and receive a sensible higher addition/subtraction starting default. The profile/statistics system can later expose adjustment without adding onboarding friction.

## Personal hub

Choosing `FORTSETZEN` always enters the selected profile's **hub**, not directly into a deck.

The hub is the stable resting place for that player's campaign.

### The hub is thematic, not a generic level-select screen

Each active campaign act should eventually have its own thematic hub presentation.

Illustrative direction, not final story canon:
- an infiltrated/controlled ship for an early act,
- a planet or planetary operation for a later act,
- an enemy mothership for a late act.

Exact themes are TBD and belong to story/art direction.

Technically these should share a reusable hub/campaign structure rather than hard-coded one-off React pages.

### What the hub reveals

The hub may show:
- the current thematic location,
- progress **inside the current active act/area**,
- the next available mission,
- a running mission that can be resumed,
- collection,
- achievements,
- story/logbook,
- profile statistics,
- return to main menu.

The hub must **not** reveal how many total acts exist or show the complete campaign roadmap.

The internal approximately-25-deck structure remains useful for authoring and production planning only.

### Current-act progress

It is valid to show progress within the active act/area. This can be spatial/thematic rather than a numbered mission list.

The player should understand:
- what has been secured,
- where they currently are,
- what the next actionable mission is.

Future acts remain hidden until story progression reveals them.

## Mission start, resume and failure

### Starting a mission

From the hub, the dominant action is the next not-yet-completed playable deck/mission.

### Leaving a live mission voluntarily

If a player returns to the hub while their run is still viable:
- preserve the profile-specific floor/run save,
- keep the mission marked as running,
- hub presents `MISSION FORTSETZEN`.

### Mission failure

When the campaign run reaches destruction/0 HP:
- the mission is considered not completed,
- return to the hub,
- clear the running-mission flag,
- the next attempt starts the mission fresh,
- do not strand the campaign player on a separate destroyed-screen loop.

Direct developer floor previews may retain the legacy destroyed/restart screen because they are debugging tools rather than campaign navigation.

## Mission success

Completing the deck goal:
1. marks the deck completed for that profile,
2. unlocks the authored successor where applicable,
3. shows a short success/story screen,
4. returns to the hub.

Do not jump directly from the success screen into the next deck by default. The hub should be allowed to reflect visible progression/change and present the next mission in context.

## Collection and achievements

Numberdroid should deliberately support collector and achiever motivations in addition to campaign completion and arithmetic improvement.

Hub-level systems should eventually support:
- persistent unusual finds,
- discovered robot/body entries,
- rare resources/items,
- hidden or visible collectibles,
- achievements/milestones,
- completion challenges,
- story/data fragments.

Do not implement arbitrary collectible currencies without a design purpose. The important architectural rule is that these systems belong to the player profile and are surfaced through the hub.

## Story/logbook

Completed story beats should be reviewable from the hub.

Potential future contents:
- mission outcomes,
- recovered logs,
- character descriptions,
- robot entries,
- location lore,
- story fragments.

This lets players who care about narrative revisit information without interrupting mission pacing.

## Player statistics and learning transparency

The hub should eventually provide player-facing insight into the mathematics model.

This is especially important because Numberdroid adapts arithmetic ranges.

The system should be explainable rather than a hidden black box.

Useful eventual presentation:
- current approximate math baseline,
- `KLAPPT SCHON GUT`,
- `WIRD GERADE GEÜBT`,
- likely next capability,
- evidence/confidence over sustained play,
- optional localized school-stage guidance,
- separate tactical preference.

A child-facing view should remain friendly and non-evaluative. A deeper parent/adult view may expose more detail about why the game currently chooses a certain arithmetic envelope.

Do not expose private chain-of-thought-like internal reasoning; expose explicit game statistics and authored/adaptive model state only.

## Settings

Global settings are accessed from the title screen.

Expected categories include:
- master/audio volume,
- language,
- later accessibility/control/display options.

Language support must eventually use proper localization resources. Do not make an English selector appear functional while the game remains German-only.

## Layout rule

Primary navigation screens are designed for the game's landscape/mobile target and should fit into the viewport without requiring document scrolling.

Especially:
- title screen,
- profile wizard,
- hub,
- settings,
- success/failure transition screens.

If content grows, use contained panels/tabs/modals rather than turning the root page into a long vertical website.

## Current implementation status

Implemented on `agent/integrate-metagame-architecture`:
- intro screen,
- title screen,
- continue active profile,
- compact multiple-profile cycling,
- first-install zero-profile support,
- child/adult profile type,
- child name + supported math-start wizard,
- adult streamlined creation with higher +/- default,
- title-level settings shell with persisted master volume and German language state,
- thematic Act-1 ship hub prototype,
- current-act progress only,
- mission start/resume,
- profile-specific running mission save,
- collection/achievement/logbook/statistics hub entry points,
- success → story → hub,
- 0 HP campaign failure → hub + fresh retry,
- developer direct-floor preview behavior retained.

The current hub art/content is a structural prototype, not final story/art direction.

## Deferred hub/content work

Deferred for later content/product passes:
- final intro cinematic,
- final title art/audio,
- final per-act hub art/themes,
- persistent collectible schema/content,
- broad achievement catalog,
- final story archive/character database,
- detailed adaptive-learning evidence dashboard,
- parental detail view,
- production localization pipeline and additional languages,
- final audio/accessibility settings.
