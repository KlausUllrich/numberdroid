# Numberdroid — Workbench Mobile Interaction Contract

Status: **v0.12.1 mobile hardening**

This document records the binding pointer/inspector behavior for the semantic Level Compiler Workbench.

## Why v0.12.1 exists

The first v0.12 interactive Workbench attached semantic selection directly to Space/Prop `pointerdown` handlers and stopped propagation there.

That broke the shared SVG gesture controller on touch devices: when the first finger started on a selectable room or Prop, the root controller never saw that pointer. Pinch therefore could not establish a valid two-pointer gesture. The desktop inspector also became merely a stacked panel on narrow screens, making a successful selection appear to do nothing until the user scrolled below the map.

v0.12.1 fixes both defects and establishes the rules below.

## Pointer arbitration — binding

All pointers start at the **single SVG gesture controller**. Selectable elements must not stop pointer propagation or own independent pan/zoom state.

The controller classifies the completed interaction:

```text
single pointer + below tap slop
→ semantic selection

single pointer + movement beyond tap slop
→ pan
→ NEVER selection

any interaction that reaches two active pointers
→ pinch / two-pointer pan
→ NEVER selection
```

Selection is therefore committed on pointer-up, not pointer-down.

The current tap slop is 8 CSS pixels. Its purpose is to tolerate ordinary finger jitter without converting real panning into accidental selection.

`pointercancel` never commits a selection.

## Pinch behavior

Two active pointers:

- preserve the previous midpoint as the pan reference;
- use the distance ratio to change the SVG viewBox;
- zoom around the gesture focus rather than around the map origin;
- retain the existing min/max Workbench zoom limits;
- mark the entire interaction as multi-pointer so neither finger can select an element when released.

This logic remains Workbench-only and does not affect gameplay camera controls.

## Semantic hit testing

Only semantic Space and Prop geometry owns edit hit targets in v0.12.1.

They expose stable attributes:

```text
data-workbench-kind="space|prop"
data-workbench-id="<stable semantic/generated id>"
```

Pure QA overlays remain visible but pointer-transparent, including:

- grid;
- primary path;
- Door Clearance;
- Trigger Zones;
- Prop use-space;
- Pickups;
- Actor Routes;
- Shared Walls and portals;
- Wall Slots;
- Actors;
- Trigger markers.

The final foreground Labels layer remains `pointer-events: none` as before.

This prevents a visible debug overlay from stealing a tap that should select the semantic Space/Prop underneath it.

## Mobile inspector

At phone widths (`<= 760px`) the semantic inspector is not part of the normal below-map document flow.

When a semantic element is selected, it appears as a fixed **bottom sheet**:

- anchored above the safe-area inset;
- maximum height roughly half the dynamic viewport;
- internally scrollable;
- high z-index above the Workbench canvas;
- larger touch targets for edit controls;
- explicit close button.

With no selection/error the mobile inspector is hidden, leaving the map unobstructed.

Desktop/tablet layout keeps the normal side/stacked inspector behavior.

## Mobile toolbar

On narrow screens the layer/control toolbar is horizontally scrollable rather than wrapping into a tall block. This preserves more vertical area for the map while keeping every QA toggle available.

## Regression requirements

The automated pointer-arbitration tests must continue to prove:

1. a stationary single pointer remains a selectable tap;
2. movement beyond tap slop is not a selection;
3. a multi-pointer gesture can never end as a selection.

Manual mobile QA remains required for the actual browser gesture/render path:

- one-finger pan;
- two-finger pinch in/out;
- tap a room and see the bottom sheet immediately;
- tap a Prop and see the Prop inspector;
- close the sheet;
- use edit buttons without accidental map gestures;
- confirm foreground labels remain readable.

## Architectural rule

Do not fix future touch issues by introducing per-element gesture controllers, DOM mutation bridges, or browser-specific coordinate state.

The Workbench interaction model remains:

```text
one SVG viewport controller
+
semantic hit metadata
+
one declarative Override editor
```

This keeps touch, mouse and future pen input on the same interaction contract.
