# Numberdroid Studio — Product Vision

Status: **binding product direction — updated 2026-08-31**

This document defines the intended product. Accepted checkpoint contracts remain
binding compatibility and regression records for the slices they accepted, but
they do not limit the final product to those historical slices.

## Product thesis

Numberdroid Studio is an **agent-first authoring and production system** that
turns visual source material and level requirements into inspectable, validated,
versioned game-content candidates.

The first complete customer is Numberdroid. The first two concrete problems are:

1. turn a generated or uploaded image into a reusable semantic game asset without
   losing provenance, editability, exact pixels, or validation evidence; and
2. turn versioned level requirements into a playable Numberdroid level candidate,
   including layout, assets, actors, routes, pickups, variables, triggers, actions,
   dialogue/text, and adapter validation.

Studio is not valuable merely because it displays these objects. It is valuable
when an authorized agent can perform the complete ordinary authoring workflow
through MCP, while a person can understand, constrain, review, correct, accept,
and release the result through a simple visual application.

## What Studio is — and is not

Studio is:

- a local-first semantic authoring and compilation layer;
- a non-destructive image-to-asset production workflow;
- an asset catalogue with lineage, typed metadata, validation, and revision history;
- a requirements-driven level-authoring system;
- a safe concurrent workspace for multiple task-scoped agents;
- a source of immutable, reviewable candidates for a game project or engine adapter.

Studio is not:

- a general-purpose image editor that replaces Adobe products;
- a game runtime, renderer, physics engine, combat engine, or complete AI system;
- a replacement for the Godot, Unreal, or Numberdroid runtime/editor toolchain;
- an excuse to invent a universal game ontology before Numberdroid works end to end;
- an agent that clicks the human UI;
- an implicit Git, materialization, deployment, or publication authority.

## Agent-first operating model

Every ordinary authoring action MUST have a semantic application command and be
available through a versioned MCP capability when the project adapter advertises
it. The human UI and MCP call the same application commands and receive the same
validation, conflicts, revisions, and activity records. A workflow that exists
only as a UI gesture is incomplete.

Human-exclusive controls are limited to root authority and release boundaries:

- create a root task and mint, widen, renew, revoke, or replace its root grant;
- make an owner review decision;
- merge accepted task work;
- activate or cut over a recovered workspace;
- materialize an export candidate into a repository;
- publish or deploy production content.

Finalization and candidate creation MAY be delegated only by an explicit narrow
capability. They never imply merge, materialization, or publication.

Every authority chain starts at a human-created root task and root grant. Under
the separately approved A4c contract, an agent may request that the trusted
service derive an isolated child task and immutable attenuated child grant from
its exact active parent. The service reserves parent budget and keeps project,
actor, capability, object, branch-head, expiry, and ancestor-state constraints;
the agent never mints, selects, widens, renews, or reinterprets authority. The
first slice does not pass child-creation authority to the child.

Multiple agents may work concurrently, but there remains one authoritative
writer. Each agent task uses an isolated semantic branch with explicit object
scope, budget, dependencies, base revision, and review state. Immutable CAS
artifacts may be shared safely; semantic conflicts are detected and resolved at
review/merge rather than hidden by last-write-wins behavior.

## Product architecture

Studio grows through three layers:

1. **Universal core** — projects, immutable artifacts/CAS, processing recipes,
   assets, jobs, revisions, findings, task branches, reviews, candidate manifests,
   backup and recovery.
2. **Reusable authoring modules** — bounded 2D image processing, atlas and sprite
   sheets, grid/room/level layout, actors and routes, typed variables, triggers,
   conditions/actions, animation, dialogue/text, and other modules justified by a
   real project.
3. **Project and engine adapters** — Numberdroid first; later narrowly scoped Godot,
   Unreal, or other project profiles. Adapters declare capabilities and translate
   generic semantic candidates into project-specific inputs and validation.

The core MUST NOT import Numberdroid, Godot, or Unreal concepts. A reusable module
MUST NOT become mandatory for projects whose capability profile does not use it.
An adapter MUST NOT weaken core provenance, authority, revision, or path-safety
invariants.

## Four stable interfaces

### 1. `ProjectCapabilityManifest`

A versioned, fail-closed declaration of supported asset kinds, coordinate model,
authoring modules, actor/logic features, validators, compiler operations, output
formats, limits, and adapter extensions. UI and agents use it to discover what is
possible rather than guessing from the game name.

### 2. Semantic authoring commands and queries

Typed application operations for source processing, asset definition, level
requirements, layout, actors, routes, variables, logic, validation, and candidate
creation. They are independent of UI controls and transport. Unknown fields and
unsupported capabilities fail visibly.

### 3. Immutable `CandidateManifest`

A complete content-addressed description of the exact sources, derived artifacts,
semantic revisions, requirement traceability, adapter/compiler versions, logical
outputs, validation findings, and hashes that make up a candidate. Candidate
creation changes neither the repository nor production.

### 4. `EngineBridge`

A narrow adapter boundary for importing/materializing a reviewed candidate into an
engine or project and invoking its canonical validation/compiler. Initial bridges
are one-way from Studio candidate to engine project. Full round-trip editing is a
later decision and must not be assumed.

For Godot, a future bridge may generate/import ordinary image resources, TileSet/
TileMapLayer data and scenes through a plugin or documented text/resource formats.
For Unreal, integration requires an editor plugin or supported import API; Studio
MUST NOT write `.uasset` files directly. The engine editor remains authoritative
for runtime rendering, scripting, debugging, and playtesting.

## Requirements-driven levels

Natural-language intent is input, not the authoritative level format. An agent
translates it into a versioned typed `LevelRequirementSet`, records ambiguities and
assumptions, and builds a semantic level candidate. Deterministic validators and
the project compiler then verify the result and explain failures. Every generated
element SHOULD trace to one or more requirement IDs.

Studio owns level-local declarative content such as:

- rooms, corridors, paths, zones, placements, and navigation intent;
- actor archetype references, actor instances, routes and spawn positions;
- items, keys, pickups, drops, and local inventory/state effects;
- typed level variables/flags;
- triggers, conditions, ordered actions, dialogue and visible text;
- waves and spawners when the project capability manifest supports them.

The game runtime owns reusable gameplay systems: movement execution, combat,
damage, navigation, economy, rendering, audio, and full AI behavior. Studio may
instantiate and configure those systems but does not reimplement them.

The Numberdroid vertical proof MUST express and validate at least this scenario:
an actor follows a route, is defeated through an existing runtime behavior, drops
a key, and collecting that key changes level state and displays text. The format
must also be capable of expressing Numberdroid's existing rooms, routes, pickups,
staged actors, triggers, events, and flags without loss.

## Portability policy

Numberdroid defines the first complete vertical slice. Generalization happens only
at interfaces proven by that slice. After it works end to end, a deliberately thin
Godot 2D/Tower Defense proof tests whether the separation is real. That proof may
use paths, enemy spawners, waves, tower slots, currency/base-health variables,
`defeated`/`reached_goal` events, and victory conditions. It is an adapter/module
portability test, not a commitment to build a second complete game product.

Unreal support follows only after a concrete Unreal project identifies a valuable
workflow that the core and modules can serve safely.

## Human UI direction

The UI is a visual control, review, and correction surface over the command core.
Its inspiration may come from Adobe tools, game-engine editors, Sorceress, and the
Universal LPC generator, but their layouts are references rather than contracts.

Useful patterns are a stable workspace, central visual canvas, contextual tools,
filterable asset palette, inspector, layers, visible lineage, live preview, and
guided progressive steps. The UI should reveal the next meaningful decision and
hide implementation vocabulary unless requested.

Detailed polished mockups are **not** the next dependency. Before broad UI work,
create low-fidelity workflow/state maps for the Artist, Level Designer, review, and
conflict flows. Produce detailed responsive mockups only after the semantic command
surface, capability manifest, workspace information architecture, and error states
are stable enough that a mockup will not freeze accidental architecture.

## Near-term success

### Engine-neutral Studio preview

The ordinary authoring preview is a Studio responsibility, not a dependency on
the Numberdroid runtime or any other engine. Studio MUST project the exact
immutable room revision into an engine-neutral, read-only preview scene and MAY
render that scene through multiple presentation projections.

The first renderer is a fast top-down composition that preserves room shape,
positions, rotations, anchors, ordered layers, transparency, footprints,
connectors and validation overlays. It is an approximate authoring preview and
MUST say that engine lighting, animation, shaders, physics and runtime behavior
may differ. It grants no validation, acceptance, materialization or publication
authority.

The preview scene MUST separate logical occupancy from visual presentation. An
asset's collision/navigation footprint is independent from its ground anchor,
visual bounds, visual offset, elevation and optional overhang. A side-facing or
2.5D sprite may therefore extend across cells behind its logical footprint
without occupying those cells. Transparency continues to reveal lower layers.
Selection and diagnostics expose both the footprint and visible bounds.

A later Studio renderer MAY provide a 2.5D/isometric or dimetric projection of
the same preview scene, including simple height classes, billboard/side-facing
sprites, depth ordering by ground anchor, and optional segmented foreground or
background parts for complex occlusion. This is deliberately separate from
engine-specific preview adapters. Numberdroid remains top-down; optional
Numberdroid, Godot or Unreal runtime previews are higher-fidelity adapter
features, never the foundation of the portable Studio preview.

Studio has reached the intended first product milestone when an authorized agent,
starting only from project guidance and MCP discovery, can:

1. import or select a Numberdroid image source;
2. apply reproducible non-destructive processing and create validated assets;
3. read versioned level requirements;
4. build and revise layout, actors, routes, pickups, variables, and trigger/action
   logic on an isolated task branch;
5. run Studio and Numberdroid validation/compilation;
6. create an immutable candidate and submit it for human review;
7. receive and address requested changes without gaining merge, materialization,
   or publication authority.

The user can inspect the exact pixels, semantic result, requirement coverage,
validation, activity, differences, and consequences before accepting anything.
