# Numberdroid — Next Development Plan

This plan follows the current B2 vertical-slice state and is designed to reduce the number of manual playtests Klaus needs to perform.

Read `LEARNING_PROFILES.md` together with this plan. Numberdroid is a family learning game, so the campaign framework must treat adaptive mathematical progression as a first-class system rather than a startup difficulty menu.

## Working principle

Development proceeds in larger coherent packages. CI/build checks and automated smoke tests should absorb routine regressions. Klaus should only be asked to playtest when a package changes game feel, campaign flow, learning behavior, or player-facing comprehension in a way automated checks cannot judge.

The current agent continues through the **campaign/framework/adaptive-learning milestone** described below. Handoff happens only after the framework is integrated, a second-deck skeleton proves progression end-to-end, adaptive math state/presentation exists, automated smoke coverage exists, and final integrated playtest feedback has been addressed.

Do not hand off merely because an individual feature is complete.

## Package 0 — Remote preview and deployment

Status: in progress.

Goal:
- publish the current `agent/integrate-metagame-architecture` build as a GitHub Pages preview,
- keep local and hosted asset paths working,
- reuse the normal CI build output instead of a second application build,
- avoid redundant push + PR builds for the current branch,
- keep draft PR #1 unmerged unless Klaus explicitly requests otherwise.

Manual playtest required: **no**, except one quick hosted-URL smoke check once Pages is available.

## Package 1 — Campaign shell + zero-friction learning entry

Build the game around the existing deck runtime rather than treating B2 as a standalone prototype.

Target flow:

```text
START
→ optional STORY
→ DECK GAMEPLAY
→ DECK SUCCESS STORY
→ progression / next deck / deck selection
```

Do **not** require a mathematics-level selection before first play.

Required campaign structure:
- authored deck catalog rather than hard-coded screen logic,
- deck title/subtitle/order,
- locked/unlocked/completed state,
- prerequisite/unlock metadata,
- optional intro/outro story copy,
- mathematical support/variant metadata,
- independent tactical gameplay challenge setting,
- direct development-preview query remains available,
- B2 remains a valid playable deck inside the shell.

Required adaptive-learning structure:
- safe default arithmetic band on first start,
- persistent adaptive math state separate from tactical difficulty,
- canonical skill/range model rather than `easy/medium/hard math`,
- no mandatory placement test/profile chooser,
- optional family-facing explanation such as `DU ÜBST GERADE`, `KLAPPT SCHON GUT`, `ALS NÄCHSTES`,
- school-year/grade recommendation represented as separate localized curriculum metadata.

The first presentation can remain clean/technical, but the information hierarchy should already feel like a family game rather than an admin/debug screen.

Manual playtest required: **one integrated test after Packages 1 and 2 together**, not after Package 1 alone.

## Package 2 — Campaign progression + adaptive span + gameplay difficulty + C3 proof

### Campaign progression

Extend persistence cleanly (likely save schema v4) with campaign-level information such as:
- unlocked deck ids,
- completed deck ids,
- selected/current deck,
- tactical gameplay difficulty,
- adaptive mathematics state,
- existing body/meta/deck state where appropriate.

Completing a deck goal must:
1. show a proper success/story screen,
2. mark the deck completed,
3. unlock authored successor(s),
4. offer `NEXT DECK` and/or `DECKAUSWAHL` rather than leaving the player in a dead-end deck state.

### Adaptive mathematics progression

Follow `LEARNING_PROFILES.md`.

The first implementation should favor **span adaptation before concept progression**:
- adjust operand/target range,
- adjust ten-boundary frequency,
- adjust useful chain complexity,
- repeat weak fact families,
- increase variety after sustained ease,
- contract span after sustained struggle,
- introduce new operations/concepts only after stronger evidence.

Important rules:
- starting should always be safe,
- no math menu required before play,
- no reaction-time scoring,
- correctness remains hidden until explicit submit,
- no abrupt band jumps after one result,
- no tactical-difficulty setting may alter the declared math progression.

The first framework may use deterministic rules/hysteresis rather than a sophisticated adaptive algorithm. Architecture and predictable behavior matter more than cleverness.

### Localized school-stage guidance

For this milestone:
- create a separate curriculum/localization mapping shape,
- include a first-pass German display mapping to test UX,
- do not treat it as canonical truth,
- keep US `Grade`, UK `Year`, and other regional labels addable without changing skill ids,
- present mappings as approximate guidance.

### Gameplay challenge profiles

Prototype three reusable tactical profiles:
- **ENTDECKER** — forgiving AI/chase tuning,
- **STANDARD** — current intended baseline,
- **HERAUSFORDERUNG** — stronger opponent behavior.

They may tune:
- duel AI competence / pass/fail tendencies,
- hostile detection/chase pressure,
- reaction windows / acceleration,
- search/investigation persistence once perception exists.

They must not widen the arithmetic span or unlock a new operation.

### Second-deck proof

Add one deliberately small **C3-style placeholder deck** to prove the framework rather than final content.

It should have:
- distinct metadata/story,
- at least one neutral robot,
- at least one hostile/security encounter,
- a simple goal,
- progression from B2 into C3 and back to deck selection,
- tactical-difficulty application,
- at least one different authored math variant/support range,
- success/progress presentation that can show `what you are practising now / what comes next`.

Avoid final art investment here.

Manual playtest required: **yes — Playtest Gate A**.

Gate A should test in one session:
1. press start without choosing a math level,
2. confirm opening arithmetic feels approachable,
3. play enough encounters to see whether numerical span begins to fit the player,
4. verify tactical difficulty is independently selectable,
5. enter/complete B2,
6. see success/story flow,
7. unlock/open C3,
8. inspect `DU ÜBST GERADE / ALS NÄCHSTES` presentation,
9. judge whether repeated rounds visibly build fluency rather than only gate progress.

## Package 3 — Robot perception realism

After the campaign shell is stable, implement reusable line-of-sight/perception logic:
- range alone does not detect the player,
- walls and closed doors block sight,
- large opaque geometry can block sight,
- authored field-of-view/view angle support,
- visible detection state,
- short investigation/search state after losing sight where useful,
- guard leash/return behavior remains intact,
- physical collision always opens scan.

Keep this in reusable floor/runtime geometry code, not room-specific JSX.

Treasure Golem remains documented future content unless a reusable capture-state primitive naturally belongs here. Do not build a one-off puzzle yet.

Manual playtest required: folded into Gate B.

## Package 4 — Automated smoke coverage + framework hardening

Before asking Klaus to test again, add automated coverage for:
- Floor/Tiled encounter parsing,
- campaign unlock progression,
- success → next-deck transition,
- adaptive-math state initialization,
- span expansion/contraction rules and hysteresis,
- separation from tactical gameplay challenge,
- curriculum/localization mapping fallback behavior,
- tactical-difficulty selection/application,
- save migration/new schema behavior,
- collision-triggered encounter rules,
- guard detection/leash state transitions where testable as pure logic,
- boss completion still finishes/unlocks correctly,
- direct B2 preview still works without corrupting campaign persistence.

Prefer pure state-transition helpers over DOM/browser hacks.

Manual playtest required: **yes — Playtest Gate B**, only after CI is green.

Gate B focuses on feel and comprehension:
- campaign/deck flow understandable without explanation,
- hosted preview reliable after duel/transfer transitions,
- first-start math feels safe,
- adaptation is gradual and useful rather than jumpy,
- improvement becomes noticeable over repeated play,
- family-facing learning status is understandable without educational jargon,
- school-year guidance helps without feeling like judgment,
- tactical difficulty is clearly independent from arithmetic progression,
- guard LOS/chase feels fair,
- phone landscape remains smooth.

## Current-agent stopping point / handoff boundary

The current agent should continue through **Packages 0–4** and fix concrete feedback from Playtest Gates A and B.

Then perform a deliberate handoff containing:
- final branch HEAD and CI state,
- hosted preview URL and deployment notes,
- current save schema and migration rules,
- campaign/deck catalog structure,
- adaptive mathematics state/data model,
- current adaptation rules and balancing observations,
- curriculum/localization recommendation structure,
- family-facing learning UX,
- tactical gameplay-difficulty structure,
- current B2 and C3 content status,
- perception/LOS behavior,
- binding duel rules,
- deferred archetypes including neutral risk/reward and Treasure Golem,
- explicit deferred features.

### Features intentionally deferred unless required by Packages 0–4

- final room/deck art and full Tiled authoring pass,
- multiple additional production decks,
- large-scale story/content writing,
- full Treasure Golem trap implementation,
- neutral-worker reward economy,
- broad board-mechanic expansion,
- extensive enemy body-ability catalog,
- complete international curriculum database,
- sophisticated long-term adaptive-learning algorithm,
- final long-campaign balancing,
- production-quality sound/music/VFX.

This boundary keeps the current agent responsible for the **game framework, educational foundation and systemic continuity**, while the next agent can expand content on stable systems.

## Test cadence summary

Klaus should normally only need to manually test three times from this point:

1. **Hosted preview smoke check** — very short, once Pages is live.
2. **Gate A** — campaign shell + zero-friction adaptive math + progression + tactical difficulty + C3 proof.
3. **Gate B** — final framework/adaptation/LOS/integration acceptance before handoff.

Routine commits between those gates should be validated by CI and automated smoke coverage rather than repeated user playtests.