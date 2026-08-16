# Numberdroid — Playable Generated Preview

Status: **v0.7 integration contract**

v0.7 is the first stage where a Floor produced by the procedural Level Compiler is registered in the existing game and driven by the real `MetaGame` runtime.

```text
LevelSpec
→ compiler v0.1–v0.5
→ v0.6 Tiled/FloorDefinition emission
→ presentation-only compiler blockout overlays
→ normal FLOORS registry
→ existing MetaGame / DoorLayer / HostileLayer / save collision helpers
```

The accepted hand-authored Transfer Hall remains unchanged. The generated Floor is a separate QA target.

## Preview URL

```text
?floor=ts01-generated
```

The friendly preview alias resolves to the generated TS-01 Floor. The canonical `FloorDefinition.id` remains the semantic LevelSpec id, so save/runtime references continue to use the compiler identity rather than the URL alias.

## What is real runtime behavior

The following data comes directly from v0.6 emission and is consumed by the existing game systems without a generated-level-specific movement/runtime fork:

- solved player start;
- Walkable rectangles;
- Shared-Wall-derived obstacle collision;
- Prop footprint collision;
- embedded Door objects;
- locked-door / access-key behavior;
- generated Pickup position;
- generated Encounter home positions;
- generated Patrol path;
- normal PICO movement/camera/collision;
- normal DoorLayer animation and door collision;
- normal HostileLayer encounter/perception runtime.

`pointWalkable()` and the existing closed-door collision path remain authoritative. v0.7 does not add a second generated-level collision model.

## Presentation-only overlays

A generated Floor needs enough visible structure to make collision QA understandable before final art emission exists. `createPlayableCompilerPreview()` therefore adds two tile layers to the already emitted `FloorDefinition.visual`:

- `CompilerPreviewWalls`
- `CompilerPreviewProps`

These layers are **not** collision truth. They only visualize compiler output.

### Wall visualization

Wall overlays are derived from the canonical Shared Wall Graph. A wall segment is drawn exactly once on one adjacent walkable cell. Shared room boundaries are therefore not rendered twice.

The overlay uses a 4-bit edge mask:

```text
N = 1
E = 2
S = 4
W = 8
```

Door apertures remain gaps because no canonical wall segment exists through an aperture.

### Prop visualization

Placed Prop footprints receive generic role colors:

- Hero
- Support
- Furniture
- Dressing

These are temporary QA blockouts only. Their collision continues to come from the emitted `Obstacles` layer, not the color overlay.

## Asset resolution

The v0.6 interchange representation intentionally stores public asset paths without deployment-specific rewriting. The playable-preview adapter resolves those paths through the existing `publicAsset()` helper so GitHub Pages/base-path deployment works without contaminating compiler semantics with hosting details.

## Acceptance tests

v0.7 regression coverage verifies:

- the generated Floor is registered under canonical id and preview alias;
- PICO starts on a valid collision-safe position;
- the PRIMUS controlled door remains locked to `primus-access`;
- the generated PRIMUS access card survives into the runtime Floor;
- doorway centers remain physically walkable before DoorLayer collision is applied;
- SENTRY patrol geometry and neutral MAGNETAR behavior survive into runtime Encounter data;
- visible wall/Prop overlays are added without altering compiler obstacle output.

## Deliberate boundary

v0.7 does **not yet execute** compiler `Trigger` / `Event` programs. Existing runtime behavior such as collecting an access card still works because that capability already exists in `FloorDefinition`/`MetaGame`.

Trigger/Event execution requires explicit persistent runtime state for concepts such as:

- once-fired trigger IDs;
- world flags;
- scripted actor presence/movement;
- blocking Story Beat state.

That state must be added to the clean runtime/save architecture rather than hidden in component-local hacks. This is the next integration block after playable generated-floor QA.
