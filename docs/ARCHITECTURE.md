# Numberdroid Architecture

## Why this migration exists

The v7 standalone prototype proved the game loop, but the metagame was attached around an already compiled React number duel through DOM manipulation. That allowed fast prototyping, but it also caused the regressions seen during development:

- battle startup depended on clicking hidden React controls,
- `MutationObserver` watched and modified the same UI tree,
- fullscreen ownership moved between layers,
- meta-energy had to be synchronized through localStorage,
- the active robot portrait was patched into the DOM outside React,
- stale `pendingBattle` state could lock the deck.

The clean architecture removes those mechanisms entirely.

## Top-level state machine

`App.tsx` owns the current surface:

```text
"deck"
"encounter"
"duel"
"transfer"
```

Transitions:

```text
Deck
  └─ scan enemy → Encounter
       ├─ cancel → Deck
       └─ start → NumberDuel
                    ├─ loss → Deck
                    └─ win → Transfer
                               └─ complete → Deck
```

There is no page reload and no hidden-button configuration step.

## Data contracts

### EncounterConfig

The deck sends all encounter parameters explicitly to the duel:

- opponent identity
- math mode / target
- AI difficulty
- rewarded robot body
- retreat position

The number duel does not inspect deck DOM, URL state or localStorage to determine difficulty.

### BattleResult

The duel returns:

- `outcome: "win" | "loss"`
- `remainingMetaEnergy`

The duel does not directly mutate the deck, body ownership or defeated-opponent list.

## Ownership responsibilities

### App

Owns persistent cross-screen state:

- current body
- deck position
- pilot
- player count
- meta-energy
- defeated robots
- energy-station state
- accumulated life-point damage

Also owns fullscreen/orientation through `useAppFullscreen`.

### MetaGame

Owns transient deck interaction:

- keyboard movement
- touch-relative movement
- camera follow
- collision tests
- proximity / interaction target
- encounter initiation

It receives and emits `MetaState`; it does not know how the number duel works.

### NumberDuel

Owns one battle:

- shared 6×5 number grid
- directed chain selection
- child-friendly AI
- reactor cores
- board animation state
- meta-energy spending during this battle
- current body ability use for this battle

It is configured entirely through props.

### TransferScreen

Owns only the body-transfer presentation:

- current body green from frame one
- defeated body red during transfer
- one central progress bar
- red → green ownership switch at 100%
- capability reveal

Body ownership is committed by `App` when the transfer completes.

## Fullscreen

Fullscreen is deliberately outside every gameplay surface.

The same fullscreen session surrounds:

```text
Deck → Encounter → Duel → Transfer → Deck
```

On touch/mobile, the app can show a legal user-gesture gate before starting fullscreen. Desktop can continue without forced fullscreen.

## Save schema

Production migration starts a versioned key:

`numberdroid-meta-v2`

Legacy v1 metagame data is migrated one-way where possible.

The save model validates old coordinates against the current walkable deck and repairs invalid positions.

### Life/integrity

Only one rule is currently final: a lost duel costs one life point.

Because max lives and the zero-life consequence are still undecided, the schema persists `damageTaken`. This preserves the confirmed consequence without encoding an unapproved maximum.

## Prototype policy

`zahlenkern-prototyp-meta-v7.html` is read-only reference behavior. New features should be implemented in `src/`, not patched into that HTML.
