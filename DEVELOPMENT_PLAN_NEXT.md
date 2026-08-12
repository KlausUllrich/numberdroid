# Numberdroid — Next Development Plan

This plan follows the current B2 vertical-slice state and is designed to reduce the number of manual playtests Klaus needs to perform.

## Working principle

Development proceeds in larger coherent packages. CI/build checks and automated smoke tests should absorb routine regressions. Klaus should only be asked to playtest when a package changes game feel, campaign flow, or player-facing comprehension in a way automated checks cannot judge.

The current agent continues through the **campaign/framework milestone** described below. Handoff to the next agent happens only after the framework is integrated, one second-deck skeleton proves progression end-to-end, automated smoke coverage exists for the new state transitions, and the final integrated playtest has been addressed.

Do not hand off merely because an individual feature is complete.

## Package 0 — Remote preview and deployment

Status: in progress.

Goal:
- automatically publish the current `agent/integrate-metagame-architecture` build as a GitHub Pages preview,
- keep local and hosted asset paths working,
- reuse the normal CI build output instead of running a second application build,
- keep draft PR #1 unmerged unless Klaus explicitly requests otherwise.

Manual playtest required: **no**, except one quick hosted-URL smoke check once Pages is available.

## Package 1 — Campaign shell / game structure

Build the game around the already-working deck runtime instead of treating B2 as a standalone prototype.

Introduce a campaign-level shell with explicit screens/states such as:

```text
START / CAMPAIGN
→ DECK SELECT
→ optional pre-deck STORY
→ DECK GAMEPLAY
→ DECK SUCCESS STORY
→ unlock/progression
→ NEXT DECK / DECK SELECT
```

Required structure:
- authored deck catalog rather than hard-coded screen logic,
- deck title/subtitle/order,
- locked/unlocked/completed state,
- prerequisite/unlock metadata,
- optional intro/outro story copy,
- difficulty choices supported by data,
- direct development-preview query remains available for fast testing,
- B2 remains a valid playable deck inside the shell.

The first presentation can remain clean/technical; architecture matters more than final art.

Manual playtest required: **one integrated test after Packages 1 and 2 together**, not after Package 1 alone.

## Package 2 — Progression, difficulty profiles and a second-deck proof

### Campaign progression

Extend persistence cleanly (likely save schema v4) with campaign-level information such as:
- unlocked deck ids,
- completed deck ids,
- selected/current deck,
- selected difficulty,
- existing body/meta/deck state where appropriate.

Completing a deck goal must:
1. show a proper success/story screen,
2. mark the deck completed,
3. unlock its authored successor(s),
4. offer `NEXT DECK` and/or `DECKAUSWAHL` rather than leaving the player in a dead-end deck state.

### Difficulty profiles

Prototype three readable profiles for playtesting:
- **ENTDECKER** — forgiving AI/chase tuning,
- **STANDARD** — current intended baseline,
- **HERAUSFORDERUNG** — stronger opponent behavior.

Difficulty must be a reusable profile rather than per-screen conditionals. Initial modifiers may include:
- duel AI competence / chance to miss or pass,
- hostile detection and chase pressure,
- reaction windows / acceleration,
- optionally deck-authored math-mode variants.

Do not change hidden arithmetic correctness or the core submit rules.

### Second-deck proof

Add one deliberately small **C3-style placeholder deck** whose purpose is to prove the framework, not to become final content.

It should have:
- distinct deck metadata/story,
- at least one neutral robot,
- at least one hostile/security encounter,
- a simple goal,
- progression from B2 into C3 and back to deck selection,
- difficulty profile application.

Avoid spending time on final tiles/art here.

Manual playtest required: **yes — Playtest Gate A**.

Klaus should be able to test in one session:
1. deck selection,
2. difficulty selection,
3. enter B2,
4. complete/force-complete B2 through development conveniences if needed,
5. see success/story flow,
6. unlock/open C3,
7. verify that the three difficulty profiles feel meaningfully different.

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
- difficulty-profile selection/application,
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
- guard LOS/chase feels fair,
- difficulty differences are useful rather than arbitrary,
- phone landscape remains smooth.

## Current-agent stopping point / handoff boundary

The current agent should continue through **Packages 0–4** and fix concrete feedback from Playtest Gates A and B.

Then perform a deliberate handoff.

The handoff should contain:
- final branch HEAD and CI state,
- hosted preview URL and deployment notes,
- current save schema and migration rules,
- campaign/deck catalog structure,
- difficulty-profile structure,
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
- final balancing across a long campaign,
- production-quality sound/music/VFX.

This boundary keeps the current agent responsible for the **game framework and systemic continuity**, while the next agent can expand content on a stable structure instead of re-architecting the game again.

## Test cadence summary

Klaus should normally only need to manually test three times from this point:

1. **Hosted preview smoke check** — very short, once Pages is live.
2. **Gate A** — campaign shell + progression + difficulty + second-deck proof.
3. **Gate B** — final framework/LOS/integration acceptance before handoff.

Routine commits between those gates should be validated by CI and automated smoke coverage rather than repeated user playtests.
