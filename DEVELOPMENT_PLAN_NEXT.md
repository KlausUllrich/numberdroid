# Numberdroid — Next Development Plan

This plan follows the current B2 vertical-slice state and is designed to reduce the number of manual playtests Klaus needs to perform.

Read `LEARNING_PROFILES.md` together with this plan. Numberdroid is a family learning game, so the campaign framework must treat mathematical progression as a first-class system rather than a cosmetic difficulty label.

## Working principle

Development proceeds in larger coherent packages. CI/build checks and automated smoke tests should absorb routine regressions. Klaus should only be asked to playtest when a package changes game feel, campaign flow, learning comprehension, or player-facing presentation in a way automated checks cannot judge.

The current agent continues through the **campaign/framework/learning-profile milestone** described below. Handoff to the next agent happens only after the framework is integrated, one second-deck skeleton proves progression end-to-end, the learning-profile model and first presentation exist, automated smoke coverage exists for the new state transitions, and the final integrated playtest has been addressed.

Do not hand off merely because an individual feature is complete.

## Package 0 — Remote preview and deployment

Status: in progress.

Goal:
- automatically publish the current `agent/integrate-metagame-architecture` build as a GitHub Pages preview,
- keep local and hosted asset paths working,
- reuse the normal CI build output instead of running a second application build,
- avoid redundant push + PR builds for the current agent branch,
- keep draft PR #1 unmerged unless Klaus explicitly requests otherwise.

Manual playtest required: **no**, except one quick hosted-URL smoke check once Pages is available.

## Package 1 — Campaign shell, deck structure and learning-profile entry

Build the game around the already-working deck runtime instead of treating B2 as a standalone prototype.

Introduce a campaign-level shell with explicit screens/states such as:

```text
START / FAMILY PROFILE
→ LEARNING PROFILE
→ DECK SELECT
→ optional pre-deck STORY
→ DECK GAMEPLAY
→ DECK SUCCESS STORY
→ unlock/progression
→ NEXT DECK / DECK SELECT
```

Required campaign structure:
- authored deck catalog rather than hard-coded screen logic,
- deck title/subtitle/order,
- locked/unlocked/completed state,
- prerequisite/unlock metadata,
- optional intro/outro story copy,
- supported/target learning-profile metadata,
- independent gameplay challenge choices supported by data,
- direct development-preview query remains available for fast testing,
- B2 remains a valid playable deck inside the shell.

Required learning-profile structure from `LEARNING_PROFILES.md`:
- canonical skill-based learning profiles rather than `easy/medium/hard math`,
- player-facing `DAS SOLLTEST DU SCHON KÖNNEN`, `DAS ÜBST DU HIER`, and `DAS KOMMT DANACH`,
- recognizable example problems when choosing a profile,
- school-year/grade recommendation represented as separate localised curriculum metadata, not the canonical profile id,
- profile selection understandable to parents and children without curriculum jargon,
- learning profile and gameplay challenge shown as visibly separate choices.

The first presentation can remain clean/technical, but the information hierarchy must already feel like a family game rather than an admin/debug screen.

Manual playtest required: **one integrated test after Packages 1 and 2 together**, not after Package 1 alone.

## Package 2 — Progression, learning application, gameplay difficulty and a second-deck proof

### Campaign progression

Extend persistence cleanly (likely save schema v4) with campaign-level information such as:
- unlocked deck ids,
- completed deck ids,
- selected/current deck,
- selected learning profile,
- selected gameplay difficulty,
- existing body/meta/deck state where appropriate.

Completing a deck goal must:
1. show a proper success/story screen,
2. mark the deck completed,
3. unlock its authored successor(s),
4. offer `NEXT DECK` and/or `DECKAUSWAHL` rather than leaving the player in a dead-end deck state.

### Learning progression is a first-class system

Do **not** collapse arithmetic curriculum and tactical game pressure into one difficulty setting.

- **Learning profile / math progression** describes the mathematical competence: operation, number range, result range, prerequisite concepts and cognitive load.
- **Gameplay difficulty** controls how threatening the game systems are: enemy AI competence, detection pressure, chase acceleration, reaction windows and similar tactical parameters.

The campaign UI must make that separation obvious.

A deck declares which learning profiles it supports/targets. Where practical, the same deck can provide multiple arithmetic variants instead of forcing story progression and school progression to be exactly the same thing.

The first framework implementation should support at least the initial skill bands described in `LEARNING_PROFILES.md`, even if B2/C3 only author a subset of variants initially.

### Localised school-year recommendations

For the framework milestone:
- create a separate curriculum/localisation mapping shape,
- include at least one first-pass German display mapping for testing the UX,
- do not treat that mapping as universal truth,
- structure the data so US `Grade`, UK `Year`, and other regional labels can be added without changing the learning-profile ids,
- mark mappings as approximate recommendations and later verify them against relevant curricula before production release.

The current agent does not need to author a complete international curriculum database before handoff. The architecture and presentation pattern must exist.

### Adaptive learning direction

The first framework should record enough post-submit information to support later adaptation where this can be done cleanly without violating privacy or overcomplicating the save.

Potential evidence:
- correct/incorrect explicit submissions,
- repeated attempts,
- coarse solution time,
- chain length,
- sustained ease/struggle patterns.

Do not silently change the declared learning profile mid-deck. First adapt examples within the selected profile; recommend a profile change between decks/sessions only when evidence is meaningful. Exact thresholds remain a playtest/balancing task.

### Gameplay difficulty profiles

Prototype three readable profiles for playtesting:
- **ENTDECKER** — forgiving AI/chase tuning,
- **STANDARD** — current intended baseline,
- **HERAUSFORDERUNG** — stronger opponent behavior.

Difficulty must be a reusable profile rather than per-screen conditionals. Initial modifiers may include:
- duel AI competence / chance to miss or pass,
- hostile detection and chase pressure,
- reaction windows / acceleration,
- short search/investigation persistence once perception exists.

Do not change hidden arithmetic correctness, core submit rules, or the stated mathematical learning objective through these gameplay profiles.

### Second-deck proof

Add one deliberately small **C3-style placeholder deck** whose purpose is to prove the framework, not to become final content.

It should have:
- distinct deck metadata/story,
- at least one neutral robot,
- at least one hostile/security encounter,
- a simple goal,
- progression from B2 into C3 and back to deck selection,
- gameplay-difficulty profile application,
- learning-profile metadata and at least one deliberately different math/content variant,
- a clear success screen that can recommend what mathematical step comes next.

Avoid spending time on final tiles/art here.

Manual playtest required: **yes — Playtest Gate A**.

Klaus should be able to test in one session:
1. choose/inspect a learning profile from recognizable math examples,
2. understand prerequisite / practice / next-step copy,
3. see an approximate local school-year recommendation without it feeling like a judgment,
4. choose gameplay difficulty independently,
5. enter B2,
6. complete/force-complete B2 through development conveniences if needed,
7. see success/story flow,
8. unlock/open C3,
9. verify that math level and gameplay pressure can vary independently,
10. judge whether repeated rounds feel capable of producing real arithmetic fluency rather than just gating progress.

## Package 3 — Robot perception realism

After the campaign shell is stable, finish the next deck-AI foundation before handoff.

Implement reusable line-of-sight/perception logic:
- range alone does not detect the player,
- walls and closed doors block sight,
- large opaque geometry can block sight,
- authored field-of-view/view angle support,
- visible detection state,
- short investigation/search state after losing sight where useful,
- guard leash/return behavior remains intact,
- physical collision always opens scan.

Keep this in reusable floor/runtime geometry code, not room-specific JSX.

Treasure-golem behavior remains a documented future archetype unless a small reusable capture-state primitive naturally belongs in this package. Do not build a one-off puzzle yet.

Manual playtest required: folded into final integrated test below.

## Package 4 — Automated smoke coverage and framework hardening

Before asking Klaus to test again, add automated coverage for the new architecture.

Minimum targets:
- Floor/Tiled encounter parsing,
- campaign unlock progression,
- success → next-deck transition,
- learning-profile selection and deck-support validation,
- separation of learning profile from gameplay challenge,
- curriculum/localisation mapping fallback behavior,
- gameplay-difficulty profile selection/application,
- save migration/new schema behavior,
- collision-triggered encounter rules,
- guard detection/leash state transitions where they can be tested as pure logic,
- boss completion still unlocks/finishes correctly,
- direct B2 preview still works without corrupting normal campaign persistence.

Prefer extracting pure state-transition helpers that are easy to test over browser-DOM test hacks.

Manual playtest required: **yes — Playtest Gate B**, only after CI is green.

Gate B focuses on feel and comprehension:
- campaign/deck flow understandable without explanation,
- hosted preview reliable after duel/transfer transitions,
- parents/children can choose a suitable learning profile without educational jargon,
- chosen math profile feels mostly achievable but still creates useful learning moments,
- repeated play makes improvement noticeable,
- school-year guidance helps without feeling like a score or judgment,
- gameplay difficulty differences are useful and clearly independent from math level,
- guard LOS/chase feels fair,
- phone landscape remains smooth.

## Current-agent stopping point / handoff boundary

The current agent should continue through **Packages 0–4** and fix concrete feedback from Playtest Gates A and B.

Then perform a deliberate handoff.

The handoff should contain:
- final branch HEAD and CI state,
- hosted preview URL and deployment notes,
- current save schema and migration rules,
- campaign/deck catalog structure,
- canonical learning-profile data model,
- curriculum/localisation recommendation structure,
- current family-facing learning-profile UX and known balancing observations,
- gameplay-difficulty profile structure and separation from math progression,
- current B2 and C3 content status,
- perception/LOS runtime behavior,
- all binding duel rules,
- remaining design archetypes including neutral risk/reward and Treasure Golem,
- explicit list of deferred features.

### Features intentionally deferred to the next agent unless needed by Packages 0–4

- final room/deck art and full Tiled authoring pass,
- multiple additional production decks,
- large-scale story/content writing,
- full Treasure Golem trap encounter implementation,
- neutral-worker risk/reward reward economy,
- broad board-mechanic expansion,
- extensive enemy body-ability catalog,
- complete international curriculum mapping/database,
- final long-term adaptive-learning thresholds,
- final balancing across a long campaign,
- production-quality sound/music/VFX.

This boundary keeps the current agent responsible for the **game framework, educational model and systemic continuity**, while the next agent can expand content on a stable structure instead of re-architecting the game again.

## Test cadence summary

Klaus should normally only need to manually test three times from this point:

1. **Hosted preview smoke check** — very short, once Pages is live.
2. **Gate A** — campaign shell + learning profiles + progression + gameplay difficulty + second-deck proof.
3. **Gate B** — final framework/learning/LOS/integration acceptance before handoff.

Routine commits between those gates should be validated by CI and automated smoke coverage rather than repeated user playtests.
