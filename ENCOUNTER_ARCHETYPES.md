# Numberdroid — Encounter Archetypes

This document extends `CODEX_HANDOFF.md` with the current deck-robot encounter design. Treat it as binding design context together with the handoff until these rules are folded back into a later consolidated handover.

## Core principle

Not every robot on a deck is an enemy. Robot behavior should make the ship feel like a functioning place: some machines work, some guard, some patrol, some actively hunt the player, and some rare targets create small environmental puzzles.

Physical robot bodies matter on the deck. The player should not simply drive through another robot. Encounter scans for hostile robots are triggered by actual physical contact, not by an invisible long-range scan radius.

## Neutral work robots

Neutral robots simply perform their assigned work.

Binding behavior:
- no aggression,
- no automatic scan,
- no pursuit,
- may stand or follow a small authored work route,
- remain physical collision bodies,
- player may voluntarily scan them from interaction range,
- player may voluntarily attempt a normal takeover duel,
- ignoring them must always be a valid choice.

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
1. guard waits at its post,
2. player enters guard trigger range,
3. guard visibly leaves its post and drives toward the player,
4. encounter scan opens only when the physical robot bodies make contact,
5. if the player escapes beyond the guard's leash/protection radius, the guard stops pursuit,
6. guard visibly returns to its authored post,
7. after returning it resumes guard duty.

The trigger radius is therefore **not** the encounter radius. It only starts the chase.

If the scan allows retreat and the player closes it, the guard may continue pursuing until the player actually escapes the leash area.

## Patrol robots

Patrol robots follow authored Floor/Tiled routes.

Binding behavior:
- route data belongs in floor content, not JSX,
- movement stays in the local RAF runtime,
- they remain physical bodies,
- merely entering an old proximity radius must not teleport the player into a scan,
- encounter begins on physical contact,
- future patrol variants may investigate or chase, but that is not implicit in the base patrol type.

## Aggressive / hunter robots

Aggressive robots actively detect and pursue the player.

Binding behavior:
- detection visibly changes their state,
- they chase in local RAF runtime,
- scan/combat begins on physical contact,
- they can lose the player according to authored behavior/range,
- `forcedEngagement` may remove the retreat option once contact has occurred.

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
