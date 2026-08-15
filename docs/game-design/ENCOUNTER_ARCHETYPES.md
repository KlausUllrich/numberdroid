# Numberdroid — Encounter Archetypes

This document extends `CODEX_HANDOFF.md` with the current deck-robot encounter design. Treat it as binding design context together with `CAMPAIGN_PROGRESSION.md`, `LEARNING_PROFILES.md`, and the development plan until these rules are folded into a later consolidated handover.

## Core principle

Not every robot on a deck is an enemy. Robot behavior should make the ship feel like a functioning place: some machines work, some guard, some patrol, some actively hunt the player, and some rare targets create small environmental puzzles.

Physical robot bodies matter on the deck. The player should not simply drive through another robot.

## Binding collision rule

**Physical robot collision always opens the scan screen.** This applies to neutral workers, guards, patrols, hunters and legacy/static robots alike.

Detection/trigger ranges are never encounter ranges. They only govern whether and how another robot reacts before contact. The actual scan starts when the physical robot bodies collide.

A neutral robot still does not initiate aggression: the player can simply drive around it. Deliberately or accidentally bumping into it opens the normal neutral scan and still allows `IN RUHE LASSEN`.

## Implemented perception / line of sight

Direct line of sight is now part of the reusable deck runtime for guards and aggressive/hunter robots.

Detection requires:
- the player to be inside the authored/scaled detection range,
- the player to be inside the authored field of view when a restricted `viewAngle` is used,
- an unobstructed line through walkable deck space.

Current sight blockers:
- leaving authored walkable geometry / crossing wall gaps,
- authored obstacles / opaque machinery geometry,
- closed doors.

An open door restores sight through that doorway.

Perception properties are Floor/Tiled-authorable:
- `facing` on the encounter for its idle/home orientation,
- `viewAngle` on behavior (`360` default for compatibility),
- `searchDurationMs`,
- existing `detectionRadius`, `loseRadius`, `chaseSpeed`, and `chaseAcceleration`.

This means old B2 content remains behavior-compatible by default while future authored robots can receive narrower view cones.

### Lost sight / investigation

Guards and hunters remember the player's last visible position.

When visual contact is lost:
1. the robot enters a visible investigation/search state (`?`),
2. it moves toward the last seen position for its authored `searchDurationMs`,
3. reacquiring sight immediately resumes normal pursuit,
4. after search timeout a guard returns to its post and a hunter gives up,
5. a guard still gives up immediately if the player leaves its authored leash/protection radius.

Runtime visual states are therefore roughly:

```text
!  player detected / pursuit
?  sight lost / investigating last seen position
↩  guard returning to home post
```

Sight is deliberately independent from the collision rule: even a robot that did not see the player will open the scan if the physical bodies collide.

Sight tests live in reusable geometry code (`src/game/perception.ts`), not per-room JSX.

## Tactical challenge interaction

`ENTDECKER`, `STANDARD`, and `HERAUSFORDERUNG` may scale guard/hunter pressure without changing the collision rule or robot archetype.

Current direction:
- `STANDARD` preserves authored behavior exactly,
- `ENTDECKER` reduces detection/chase pressure and acceleration,
- `HERAUSFORDERUNG` increases detection/leash/chase pressure,
- neutral workers and base patrols are not converted into hunters by tactical difficulty.

Line of sight still applies in every tactical profile.

## Neutral work robots

Neutral robots simply perform their assigned work.

Binding behavior:
- no aggression,
- no pursuit,
- no reaction merely because the player enters a proximity radius,
- may stand or follow a small authored work route,
- remain physical collision bodies,
- physical collision opens the scan screen like every robot,
- player may also voluntarily scan them from interaction range,
- player may voluntarily attempt a normal takeover duel,
- ignoring them must always be a valid choice by simply not colliding/interacting.

### Future neutral risk/reward direction

Neutral robots are often weaker bodies. Taking one should therefore be a meaningful voluntary risk rather than an obvious upgrade.

Potential loop:

```text
Take over weak neutral worker
→ gain a special resource / access / opportunity
→ continue the deck in the weak body
→ later defeat and take over a stronger robot again
```

The reward is intentionally not defined yet. Do not add a generic bonus without playtesting/design discussion.

## Guard robots

A guard owns an authored home/post position and a limited protection area.

Binding behavior:
1. guard waits at its post/home orientation,
2. player enters detection range **and is actually visible**,
3. guard visibly leaves its post and accelerates toward the player,
4. encounter scan opens only when the physical robot bodies make contact,
5. if visual contact is lost, the guard briefly investigates the last seen position,
6. if the player is not reacquired, or leaves the leash/protection radius, pursuit ends,
7. guard visibly returns to its authored post,
8. after returning it resumes guard duty and its authored idle facing.

The trigger radius is therefore **not** the encounter radius. It only allows visual detection to start the chase.

Guards should not jump immediately to maximum pursuit velocity. They use authored acceleration so the player has a readable reaction window and can make an actual escape decision.

If the scan allows retreat and the player closes it, the guard may continue pursuing until the player escapes sight/search/leash conditions.

## Patrol robots

Patrol robots follow authored Floor/Tiled routes.

Binding behavior:
- route data belongs in floor content, not JSX,
- movement stays in the local RAF runtime,
- they remain physical bodies,
- merely entering an old proximity radius must not open a scan,
- encounter begins on physical contact,
- base patrol does not automatically become a hunter,
- later authored patrol variants may gain investigation/chase behavior, but that is a separate capability rather than implicit in `patrol`.

## Aggressive / hunter robots

Aggressive robots actively detect and pursue the player.

Binding behavior:
- detection requires direct line of sight plus authored/scaled range,
- detection visibly changes their state,
- they chase in the local RAF runtime,
- pursuit accelerates rather than instantly snapping to maximum speed,
- scan/combat begins on physical contact,
- loss of sight starts a short last-seen investigation when configured,
- they give up according to authored search/range behavior,
- `forcedEngagement` may remove the retreat option once physical contact has occurred.

## Treasure Golem / Beutedroide

Future archetype inspired by a "treasure golem": a rare high-value robot that cannot simply be driven up to and challenged normally.

### Intended fantasy

The robot carries something unusually valuable, but its primary behavior is escape rather than combat. Seeing it should create a small hunt/puzzle moment rather than another ordinary duel.

### Binding design direction

- rare and visually recognizable,
- not a normal hostile guard,
- avoids/flees from the player when approached,
- normal driving speed/contact should not be sufficient to catch it reliably,
- player must prepare or activate a **trap** before the target becomes reachable,
- trap is an environmental/floor mechanic, not an invisible random proc,
- successful trap should visibly immobilize, contain, reroute or otherwise expose the target,
- only then does the normal scan/duel/reward interaction become available,
- failure should be understandable: the player sees why the target escaped.

Possible future trap forms include:
- closing two doors to create a containment pocket,
- activating an electromagnetic field,
- placing/charging a floor trap,
- rerouting the robot via a console,
- luring it toward a prepared capture zone.

These are examples, not finalized mechanics.

### Data/runtime direction

When implemented, prefer authored Floor/Tiled data such as:
- escape/home route,
- detection/flee radius,
- trap/capture zone id,
- required floor action or trap state,
- caught/exposed state,
- reward metadata.

Do not hard-code one specific treasure robot's coordinates or puzzle in React.

### Reward direction

The treasure reward should be meaningfully above a normal encounter: resource, rare access, special board modifier, body upgrade opportunity, or another progression item. Exact rewards remain undecided.

The archetype may later combine especially well with the neutral-body risk/reward system: a weak utility body might be useful or required for preparing a trap, creating a deliberate temporary downgrade for a valuable payoff.
