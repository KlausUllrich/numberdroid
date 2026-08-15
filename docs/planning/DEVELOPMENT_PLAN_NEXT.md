# Numberdroid — Next Development Plan

This plan reflects the completed framework phase plus the newly consolidated **Story/World + 25-beat Level Progression v0.1** on `agent/integrate-metagame-architecture`.

Read first:
- `HANDOFF_2026-08-12.md`
- `STORY_WORLD_FOUNDATION.md`
- `CAMPAIGN_STORY_LEVEL_PROGRESSION.md`
- `CODEX_HANDOFF.md`
- `ENCOUNTER_ARCHETYPES.md`
- `CAMPAIGN_PROGRESSION.md`
- `LEARNING_PROFILES.md`
- `MENU_HUB_FLOW.md`

## Working principle

Do not reopen solved runtime architecture. Routine regressions belong in automated tests; human playtests are for feel, comprehension, progression and family-learning behavior.

## Completed framework packages

The following are established and should be extended rather than restarted:
- GitHub Pages preview/CI,
- count-agnostic campaign catalog with ~25 internal planning slots,
- B2 vertical slice and C3 campaign proof,
- multiple isolated family profiles,
- child/adult onboarding,
- profile-specific progress/save/resume,
- profile/deck/robot arithmetic envelopes,
- separate tactical challenge,
- robot neutral/guard/patrol/aggressive behavior,
- collision→scan,
- LOS/view cone/investigation/return behavior,
- intro/title/settings/profile wizard/personal hub,
- dedicated collection/achievement/logbook/statistics screens,
- success/story→hub,
- corrected single-duel retreat preserving current deck progress,
- final-HP mission failure→hub + fresh future attempt,
- player initiative on every ordinary new duel/boss phase.

Current real arithmetic protocols remain addition/subtraction only.

## Corrected duel-loss behavior — complete

The earlier “single duel loss resets the entire deck” design was a misunderstanding and has now been corrected in runtime code.

Implemented rule:
- lose 1 HP,
- keep active robot body and body size,
- move that body to level start,
- preserve defeated robots, keys/access, stations/pickups, completed actions, remaining meta-energy and other current deck progress,
- boss encounter itself restarts at Phase 1 on re-entry,
- only final HP loss causes true mission failure and a fresh future attempt.

Implementation is isolated in `src/game/duelLoss.ts` and used by `App.finishBattle()`. Focused tests verify preserved run state.

Do not reintroduce the old whole-floor reset for ordinary duel losses.

## Story/world milestone — v0.1 complete for art exploration

`STORY_WORLD_FOUNDATION.md` now establishes:
- Transfer from biological child to machine adulthood,
- body transfer as the core empowerment/travel fantasy,
- ordinary loving but time-starved parents with individual viewpoints,
- PRIMUS as optimisation/assignment antagonist,
- Kayo as highly competent assigner who matures into an enabler,
- player's inability to be assigned as the trigger for Kayo's collapse,
- learning theme: downloaded capability versus personally practised competence/meaning,
- nature/self-organisation as the key to PRIMUS's transformation,
- passion as something that cannot be optimally assigned,
- self-determination with responsibility rather than rejection of work.

`CAMPAIGN_STORY_LEVEL_PROGRESSION.md` now establishes Intro + 25 beats + Outro across:
1. Transfer Ship,
2. Deep Ocean,
3. Volcanic / Extreme Industry,
4. Moon / Vacuum,
5. Bio-Ark / PRIMUS.

This is deliberately a **level-function/story-beat skeleton**, not final level design.

## Next major milestone — first Art Direction / Graphic Push

This is now the preferred next major creative milestone.

Scope only **Intro + Beats 1–5 / Transfer Ship** first.

Goals:
- define a recognisable Numberdroid visual language rather than generic sci-fi,
- determine the Transfer's visual identity,
- establish architecture, forms, materials and lighting,
- establish PRIMUS's order/signage/UI language,
- establish how biological/family/human traces contrast with machine society,
- define first-body and Kayo/status-robot visual principles,
- identify a deliberately small asset/room/robot set for a first graphical vertical slice.

Do **not** yet produce final art for all 25 beats.

Recommended sequence after the first visual slice:
1. evaluate whether the visual identity feels uniquely Numberdroid,
2. refine detailed story/character/level beats using what the visual world teaches us,
3. derive additional level mechanics/content from those story needs,
4. then perform the larger production graphics pass.

## Deliberately open gameplay concepts from the story progression

Do not silently freeze these before design/playtest:
- Beat 12 requires intelligent enemy/body encounter ordering; an RPS-style relationship is only one candidate implementation.
- Beat 17 requires optional bonus core-conversion/strengthening; exact resource/economy/persistence is open.
- Beat 16 is a strong candidate for the first optional Treasure Golem/Beutedroide, but that system is still unimplemented.
- Bio-Ark ecology mechanics for Beats 21–25 require later design after the first art/story pass.

## Deferred production work

Still not the next task:
- authoring all ~25 final production decks,
- final campaign-wide art,
- final dialogue/cinematics,
- persistent collectible/achievement production content,
- multiplication/division protocols,
- sophisticated adaptive-learning evidence engine,
- broad enemy/body ability catalog,
- production localisation,
- final sound/music/VFX/accessibility,
- Capacitor packaging.

## Handoff rule

A new agent must verify branch HEAD, latest Actions state, Pages and Draft PR #1 before changing code. PR #1 stays draft and must never be merged without Klaus's explicit request.

Before producing or changing assets/code for the art milestone, the next agent should first summarize the creative/runtime constraints and propose a bounded Transfer-Ship art-direction slice.
