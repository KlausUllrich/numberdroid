# Numberdroid — Next Development Plan

This plan follows the established B2 vertical slice and is designed to reduce the number of manual playtests Klaus needs to perform.

Read `CAMPAIGN_PROGRESSION.md` and `LEARNING_PROFILES.md` together with this plan. Numberdroid is a family learning game with one shared story campaign and player-specific mathematics.

## Working principle

Development proceeds in larger coherent packages. CI/build checks and automated smoke tests should absorb routine regressions. Klaus should only be asked to playtest when a package changes game feel, campaign flow, learning behavior, or player-facing comprehension in a way automated checks cannot judge.

The current agent continues through the **campaign/framework/player-profile milestone** described below. Handoff happens only after the framework is integrated, a second-deck skeleton proves progression end-to-end, the player-math/robot-tier model exists, automated smoke coverage exists, and final integrated playtest feedback has been addressed.

Do not hand off merely because an individual feature is complete.

## Package 0 — Remote preview and deployment

Status: **complete**.

Current GitHub Pages preview target:

```text
https://klausullrich.github.io/numberdroid/
```

Established:
- agent branch is allowed to deploy to the `github-pages` environment,
- normal build and Pages artifact reuse the same application build,
- hosted paths are Vite-base safe,
- redundant PR build for the current agent branch is avoided,
- draft PR #1 remains unmerged unless Klaus explicitly requests otherwise.

Manual playtest: only a short hosted smoke check when useful; do not stop development for routine hosted checks.

## Package 1 — Campaign shell + player profile foundation

Build the game around the current deck runtime rather than treating B2 as a standalone prototype.

Target player flow:

```text
PLAYER PROFILE
→ START / CONTINUE
→ SHIP / DECK SELECT
→ optional DECK STORY
→ DECK GAMEPLAY
→ DECK SUCCESS STORY
→ unlock/progression
→ NEXT DECK / SHIP
```

### Campaign catalog

Create authored campaign/deck metadata rather than hard-coded screen transitions.

Required data direction:
- deck id,
- act/order,
- title/subtitle,
- locked/unlocked/completed state derived from progression,
- prerequisite/unlock metadata,
- intro/outro story copy,
- boss/goal metadata,
- campaign intensity/progression metadata,
- mechanics introduced / mechanics expected,
- supported math capabilities/variants,
- room for authored encounter population/robot mathematical roles.

The architecture must be count-agnostic but use **about 25 decks** as the current campaign planning target, likely grouped into larger acts. Do not implement 25 production decks in this milestone.

### Player profile

Introduce a player/family profile boundary that can eventually hold:
- profile identity/name,
- initial mathematics self-assessment/baseline,
- demonstrated capability/evidence state,
- preferred tactical challenge separately,
- campaign progression/completed decks,
- current deck/session state as appropriate.

Starting math choice should be friendly and skippable:
- recognizable example tasks/capabilities,
- safe default if the family simply starts,
- no mandatory placement test,
- not a school score.

### Same story rule

This must be structurally true from the beginning:
- every mathematics profile can play the same full deck/story sequence,
- advanced profiles do not skip early decks,
- lower profiles are not locked out of later story decks because of curriculum level.

Manual playtest required: **no** after Package 1 alone. Continue into Package 2 before Gate A.

## Package 2 — Progression + robot math roles + difficulty curves + C3 proof

### Campaign persistence / progression

Extend persistence cleanly (likely a new save schema) with campaign/player-profile information such as:
- unlocked deck ids,
- completed deck ids,
- selected/current deck,
- mathematics baseline/capability state,
- preferred tactical challenge,
- existing body/meta/deck state where appropriate.

Completing a deck goal must:
1. show a proper success/story screen,
2. mark the deck completed,
3. unlock authored successor(s),
4. return the player to a meaningful `NEXT DECK` / `SHIP` choice rather than a dead end.

### Robot mathematical roles

Represent mathematical challenge independently from tactical behavior.

Working roles from `LEARNING_PROFILES.md` / `CAMPAIGN_PROGRESSION.md`:
- comfort/basic,
- practice/core,
- stretch/security,
- specialist,
- boss.

`neutral/guard/patrol/aggressive` is tactical behavior and must not automatically determine math role.

The same recognizable robot role should remain relatively predictable for children while concrete arithmetic scales to the player profile and campaign position.

### Deck-local and campaign-wide curve

Support the authored saw-tooth progression:

```text
Deck N: easier arrival → core → stretch/specialist → boss
Deck N+1: some breathing room again → overall somewhat higher ceiling → boss
```

Later decks should contain more advanced/specialist encounters and stronger combinations while still retaining some comfortable robots.

Do not implement a global `each duel gets harder` rule.

### Mathematics calibration

Adaptive/profile logic is a calibration layer, not the primary difficulty engine.

Initial implementation may use deterministic conservative rules:
- adjust span/composition inside supported encounter ranges,
- preserve robot mathematical identity,
- preserve authored deck pacing,
- never remove all mastered easy arithmetic,
- no reaction-time scoring,
- correctness remains hidden until explicit submit,
- new operations/concepts require profile + authored encounter/deck support.

### Tactical challenge

Keep tactical challenge independent. Working options may remain:
- `ENTDECKER`,
- `STANDARD`,
- `HERAUSFORDERUNG`.

They tune AI/pursuit/reaction/tactical forgiveness, not math knowledge.

### Campaign mechanic progression

The campaign catalog must be able to record new mechanics introduced over later decks, for example:
- body/Joker skills,
- keys/security systems,
- additional robot behavior,
- Treasure Golem/traps,
- environmental interactions,
- new number-board mechanics.

Do not implement all of these now. The framework must make staged introduction possible.

### Second-deck proof

Add one deliberately small **C3-style placeholder deck** whose job is to prove the architecture, not final content.

It should demonstrate:
- distinct story/catalog metadata,
- progression B2 → success → C3 unlock,
- at least one easy/comfort encounter,
- at least one more demanding/specialist encounter,
- neutral + hostile behavior where useful,
- a simple boss/goal or final objective,
- different math envelopes for at least two player baselines if feasible without overbuilding,
- tactical challenge remaining independent,
- one campaign mechanic/progression metadata difference from B2.

Manual playtest required: **yes — Playtest Gate A**.

Gate A should test in one coherent session:
1. create/select a player profile or use the safe default,
2. choose/inspect a simple math starting self-assessment without taking a test,
3. enter the same campaign/deck structure regardless of that baseline,
4. verify easy robots remain easy/pleasant,
5. verify stronger robot types are recognizably more demanding,
6. experience B2's within-deck escalation,
7. see success/story flow,
8. unlock/open C3,
9. see the next deck begin with some breathing room but a somewhat higher ceiling,
10. verify tactical challenge is independent,
11. judge whether stronger/lower profiles both feel like the same game rather than different campaigns.

## Package 3 — Robot perception realism

After the campaign shell is stable, implement reusable line-of-sight/perception logic:
- range alone does not detect the player,
- walls and closed doors block sight,
- opaque geometry can block sight,
- authored field-of-view/view angle support,
- visible detection state,
- short investigation/search state after losing sight where useful,
- guard leash/return remains intact,
- physical collision always opens scan.

Keep this in reusable floor/runtime geometry code, not room-specific JSX.

Treasure Golem remains a later authored campaign mechanic unless a generic capture-state primitive naturally belongs here.

Manual playtest required: folded into Gate B.

## Package 4 — Automated smoke coverage + framework hardening

Before Gate B, add automated coverage for the new framework where practical:
- campaign/deck catalog ordering/unlocks,
- success → next-deck transition,
- player-profile initialization/defaults,
- math baseline/self-assessment persistence,
- robot math role separate from tactical behavior,
- math-envelope derivation preserving robot/deck role,
- save migration/new schema behavior,
- tactical challenge independence,
- curriculum/localization mapping fallback shape if implemented,
- Floor/Tiled encounter parsing,
- collision-triggered encounter rules,
- guard detection/leash state transitions where testable as pure logic,
- boss completion still finishes/unlocks correctly,
- direct B2 preview still works without corrupting campaign persistence.

Prefer pure state-transition helpers over DOM/browser hacks.

Manual playtest required: **yes — Playtest Gate B**, only after CI is green.

Gate B focuses on feel and comprehension:
- campaign/ship/deck flow understandable without explanation,
- hosted preview reliable after duel/transfer/progression transitions,
- different math baselines can play the same story comfortably,
- simple encounters remain satisfying,
- robot mathematical identities are readable,
- deck curves build toward bosses and reset partially on the next deck,
- later content feels richer through mechanics rather than only bigger numbers,
- profile calibration is subtle rather than punitive,
- tactical challenge remains separate,
- guard LOS/chase feels fair,
- phone landscape remains smooth.

## Current-agent stopping point / handoff boundary

The current agent continues through **Packages 0–4** and fixes concrete feedback from Gates A and B.

Then perform a deliberate handoff containing:
- final branch HEAD and CI state,
- hosted preview URL/deployment notes,
- save schema/migration rules,
- player-profile model,
- campaign/deck catalog structure,
- current campaign target/act model,
- robot mathematical role model,
- deck/global difficulty curve representation,
- math baseline/calibration behavior,
- tactical challenge separation,
- B2/C3 content status,
- perception/LOS behavior,
- binding duel rules,
- deferred campaign mechanics including Treasure Golem,
- explicit deferred features.

### Intentionally deferred unless needed by Packages 1–4

- building the full ~25 production decks,
- final act/story writing,
- final room/deck art and full Tiled authoring pass,
- full Treasure Golem trap implementation,
- neutral-worker reward economy,
- broad board-mechanic catalog,
- extensive enemy body-ability catalog,
- complete international curriculum database,
- sophisticated adaptive-learning algorithm,
- final long-campaign balancing,
- production-quality sound/music/VFX.

## Test cadence summary

From this point Klaus should normally only need:

1. optional very short hosted-preview smoke check,
2. **Gate A** after Campaign/Profile/Progression/C3 are integrated,
3. **Gate B** after LOS/tests/framework hardening before handoff.

Routine intermediate commits should be validated through CI and automated tests instead of repeated manual playtests.
