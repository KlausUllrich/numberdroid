# Studio — Authoring Product Model

Status: **user-approved product direction, 2026-09-07; implementation and workflow acceptance remain separate**.

This document records Klaus's approved authoring model and redesign process. It
refines [Vision](VISION.md) and owns the target experience described below.
It is not an executable schema, a migration, a new capability grant, or evidence
that a described feature already works. Accepted checkpoint contracts continue
to protect existing data, authority and compatibility until a separately scoped
implementation explicitly evolves them. See [Implementation boundaries](#implementation-boundaries).

Numberdroid Studio remains the working name. A broader name is undecided;
renaming the application, repository or packages is not part of this decision.
Numberdroid remains the first complete production customer. Other games below
are design checks, not authorization to build additional games or integrations.

## Agent-first work and human review

The normal workflow is a conversation with an agent, agent authoring through
Studio's semantic tools, review of the resulting content in Studio, and a
further agent round based on the saved decision. Human editing remains available
through the same application commands and validation. Agent operation must not
depend on clicking the human UI or editing the database directly.

Studio should report actionable technical findings to the agent before asking
the user to review its result. The agent corrects what it can within its task;
repeated failure or an unresolved design choice produces a focused explanation,
not an endless retry loop. Automatic checks cannot establish artistic quality
or fulfillment of subjective intent. Expected unfinished work is distinct from
broken references, invalid geometry and other technical defects.

Human review concerns concrete proposed changes and their consequences. It does
not certify that an asset, kit or production stage is permanently finished.
Direction discussions and exploratory judgments belong in the user/agent
conversation; Studio does not impose separate direction-approval ceremonies.
Usable components and kits can keep evolving while the game uses saved versions.

Agent changes stay separate from current project content until the owner accepts
them. The normal review actions are **Accept changes** and **Request changes**
with feedback. Abandoning work remains an explicit **Discard proposal** action
in a secondary location. Acceptance of independent changes may leave other work
pending; dependencies must be checked before a partial application. Existing
owner-only decision and application boundaries cannot be bypassed to imitate
this target experience.

Own human edits should not require a second review of the same work. They still
require validation and a clear save/add consequence. Approval and application
refer to exact content versions. Saved decisions, feedback, dependencies and
remaining work must be readable by the next authorized agent, including a
different agent; continuation must not rely solely on conversation memory.
Permission to continue is distinct from actual delivery or a running agent.

## Sources, reusable content and composition

| Concept | Meaning |
| --- | --- |
| Source | Original input material: one image, a sheet to cherry-pick from, or a supported future media source. It remains available for reuse. |
| Asset | Reusable content with stable identity and versions. It can be simple or assembled; a single frame can be addressable without becoming a top-level card by default. |
| Component | A named use of content inside an assembly, with its local position, pivot or other supported settings. A component can reference another asset. |
| Assembly | An asset composed from components. It is edited and reused as one object; nesting uses exact references rather than copied content. |
| Variant set | Explicit compatible alternatives, optionally with weights. Gameplay identity and cosmetic alternatives must remain distinct. |
| Presentation state | The content shown or played for a named state such as idle or brewing. It is distinct from production status and does not execute game behavior. |
| Direction | The selected facing view, separate from state and cosmetic variant. |
| Upgrade stage | A progression alternative, potentially with different declared gameplay configuration; not an interchangeable cosmetic variant by implication. |
| Kit | Related assets organized for convenient selection, such as base tiles, edges, corners and markers. It is not automatically a single placed object. |

Surface, Prop, Item and a future UI role describe uses. Assembly describes
composition. Image, animation and future audio describe content capabilities.
These are not competing mandatory categories: a Prop remains a Prop when it
gains components; an audio clip does not acquire a Room footprint.

Sources may produce several assets; assemblies may reuse content from several
sources. The full link from assembly through component, clip/frame, cut and
original source must remain inspectable. An animation groups ordered frame
references, timing and alignment. Components are nested by default with an
explicit way to browse them individually.

Input sheets and generated runtime atlases have different purposes. Later
packing can combine required images/frames for a target runtime without
changing asset identities or animation meaning. Packing recipes and mappings
must preserve provenance. This decision does not begin materialization or
runtime atlas production.

## Sources and Library workspaces

Sources is the place to introduce and prepare material. Library is the place
to see, use and edit saved reusable content. A source is not consumed or removed
when one of its outputs enters the Library.

The Sources sub-navigation is **Images**, **Preparation**, and **Needs review**
for the image workflow. Preparation contains working copies, including idle
unfinished work. It does not mean a background job is running. A real job shows
its specific activity beside the affected work. Passing a check does not submit
unfinished work automatically; the agent deliberately submits a result for the
owner's decision after satisfying the applicable checks.

Library provides **Assets** and **Pending changes**, with search and relevant
filters. A saved asset may be useful for assembly, placement or another declared
operation without being final for every purpose. Required missing properties
block the affected use; optional future polish does not impose a completion
ceremony. Existing Room references remain pinned while revisions are prepared.

Sources, Library and Agent tasks can open the same review. They must not require
separate approvals of the same changes. A task may span new and existing content;
its review preserves that context and the dependencies of selected changes.

List cards use equal preview frames, show the whole image without cropping or
stretching, and default to name, useful size/content summary and status. Clicking
the picture opens the full image in a new browser tab. Name/Details opens the
in-app detail view. Returning restores section, filter, selection, compatible
drafts, focus and scroll. Completed reviews belong in history rather than
permanently occupying the browsing workspace.

## One contextual asset editor

The shared editor has a central preview, a compact output/component list and
properties for the selected item. Relevant tools include **Cut**, **Assemble**,
**Placement & blocking**, and **Properties**. They can be revisited and are not
mandatory production stages. Variant, state, direction and upgrade selectors
appear only for content using those features. UI assets use suitable dimensions
and resizing/hit-area settings instead of Room placement fields.

The cutter must support selecting two of four regions, regular grid proposals,
manual rectangles, inclusion/exclusion, drag/resize, exact numeric adjustment,
zoom and source-pixel coordinates. Preview and saved cutting instructions remain
non-destructive. A saved cut never silently retargets an existing asset version.
This carries forward the [accepted cutter requirements](REQUIREMENTS.md#53-atlas-cutter).
The user-approved [Cutter Editor Design](CUTTER_EDITOR_DESIGN.md) specifies cut
names, a stable canvas during errors, the tool rail, grid guides/snapping, zoom
slider with Fit/100%, and independent edge handles. Its mockup passed; product
implementation and real-agent verification remain separate.

Placement editing distinguishes logical footprint, ground anchor, visual extent
and movement blocking. The current collision implementation supports one or
several rectangles. The user-approved
[Placement & Blocking Editor Design](PLACEMENT_BLOCKING_EDITOR_DESIGN.md) adds a
target editor for concave polygons, multiple named regions, rectangles and ovals,
with Shift constraints for squares/circles. That requires matching geometry and
integration work; current code must not silently replace those shapes with boxes.
Pixels, transparency, shadows and visual overhang cannot silently author blocking
semantics. The same editor must support later Library revisions.

Assembly components need not share image dimensions: a 3 × 3 Prop can contain a
1 × 1 animation at a relative position and a separately sized shadow. Components
can have individual pivots and attachment points, such as a rotating turret on a
fixed base. An assembled object moves as a unit while retaining those local
relationships. Actual illumination remains a runtime capability; emissive artwork
does not by itself illuminate nearby actors.

The approved [Assembly Editor Design](ASSEMBLY_EDITOR_DESIGN.md) reuses explicit
component asset versions. Component blocking is inherited through their transforms
by default; custom assembly blocking is an explicit independent alternative.
Inspection-only visibility does not change authored state membership or blocking.
The sample editor and walkthrough are design evidence, not implemented agent tools.

Whole-assembly variants are appropriate when body, shadow and animation must
match. Individual components may use compatible variant sets where combinations
are valid. Weighted placement choices are resolved and saved, not rerolled by
refresh, reopen or repacking. State changes retain the selected cosmetic variant.
Studio checks the applicable placement, anchor, connector and blocking contract
before a choice is considered interchangeable. References cannot form cycles.
Updating a shared component shows affected consumers and preserves their pinned
versions until explicitly updated.

## Presentation and interaction boundary

Prefer one coffee-machine asset with shared components and idle, brewing and
coffee-ready presentations. Referencing separate assemblies for those states is
also valid. Studio does not prescribe destroying/recreating runtime objects to
change state or discard their instance identity and selected variant.

An optional interaction contract can declare actions, events, typed parameters
and interaction points/regions. An authored brewing duration is configuration;
the current brewing state belongs to each runtime instance. State presentation
may select animation, sound cues and component visibility. A UI button can have
normal/hover/pressed/disabled presentations and a separately combined focus
overlay. Optional reusable destruction effects can be referenced by many tiles.

The game executes input, proximity, navigation, timers, aiming, combat, inventory
and gameplay transitions. Asset preview can demonstrate presentation without
claiming those behaviors work. Project integrations must explicitly map supported
actions/events/parameters; names alone are not executable behavior. Arbitrary
untyped variable bags or code snippets cannot substitute for a validated contract.

Reusable asset interfaces and supported Level logic have separate editors. For
example, a machine's collected event can be exposed by the asset; connecting a
specific placed machine to a specific door belongs to project/Level authoring.
This refines the existing [typed logic boundary](REQUIREMENTS.md#56a-level-local-actors-and-logic)
without adding a general behavior editor to every asset.

## Optional project authoring modules

One Studio shares identity, versions, composition, agent work, review, validation
reporting and recovery. Projects load only their supported authoring modules;
these are kinds of work, not mandatory increasing complexity levels.

Rooms combine reusable composition with boundaries, entrances, walkable space
and other spatial rules. That module may still be called **Rooms** for
Numberdroid. A cluster of props can remain an ordinary assembly. Renaming the
existing Room editor to Assembly would not make its assumptions universal.

| Design check | Optional authoring content |
| --- | --- |
| Numberdroid | Rooms, corridors, Levels, actors/routes, encounters, objectives and supported events. |
| Match-3 | Boards, starting pieces/blockers, refill rules, move limits and objectives; matching identity is explicit, separate from cosmetic variants. |
| Tower defense | Maps/routes, placement areas, waves, resources and victory conditions; upgrades remain distinct from cosmetic alternatives. |
| Asset-only project | Sources, Library, agent/review and recovery tools; no mandatory Room or Level workspace. |

A Numberdroid enemy tests state × eight-direction clip organization. Required
combinations, anchor consistency and permitted explicit fallbacks must be checked;
the existing Numberdroid art rules continue to govern rotation and mirroring.
The same editor should handle this, a UI button, an animated match-3 tile and an
assembled tower without exposing every feature on a simple static tile.

Modules define appropriate typed authoring documents and rules. They need not
force every game into one universal Level gameplay schema. An integration maps
the managed content to the game's supported format; importing an entire engine
model or maintaining two automatically synchronized authoring authorities is not
the foundation. Runtime code and unmanaged features remain with the game.
Extensions require declared schemas and validation; unsupported features must
not be silently flattened or presented as validated. Engine independence does
not mean every game feature is already representable.

## Discussion, documentation and verification

For each screen, discuss its goal, requirements and behavior; agree on a mockup;
update the owning repository documentation; then implement and verify. Approved
product principles can be documented before every screen mockup is complete.
The initial browsing mockup received positive overall feedback, and Klaus
explicitly passed the complete cutter v3 mockup and the Placement & blocking
walkthrough, including the placement v2 Oval / Shift refinements. He then passed
the five Assembly walkthrough checks, including custom blocking independence.
The shared Review changes screen remains the next design block. Complete agent
workflows still need implementation and verification. Mockup actions and sample
content are not product evidence.

Before requesting user verification of an implemented workflow, exercise it with
a real agent through the supported semantic interface, including correction and
reading saved feedback/decisions. Scripts or browser automation alone do not
prove agent usability. Owner-only test decisions use clearly identified test
fixtures and do not substitute for the user's content or milestone acceptance.
Give the user one focused verification step at a time.

Use the [binding risk policy](../../../docs/agents/CHANGE_RISK_AND_VERIFICATION.md):
focused falsification during development, required integration checks for the
actual diff, one final independent behavior review, and reruns only when an
affected change or finding justifies them. No repeated broad green suites for
reassurance. This document does not reduce a mandated tier, platform, authority,
compatibility or acceptance gate. UI work remains subject to its actual L3 rules.

## Implementation boundaries

The current source has image intake/cutting, exact-slice assets, typed collision
geometry, Rooms, isolated tasks and owner review foundations. The current V2
asset contract is single-slice and supports Surface/Prop/Item; it does not already
implement the general assembly, audio, UI, presentation or interaction model.
See [Checkpoint 2C](CHECKPOINT_2C_CONTRACT.md), [human authoring](HUMAN_ASSET_AUTHORING.md),
[task feedback](TASK_REVIEW_FEEDBACK.md) and [current task routing](START_HERE.md).

Known evolution points include the native 2C complete per-item decision vector,
required rejection reasons, separate decision/apply commands and lifecycle; the
target direct human save and partial-pending review experience must not be
implemented by skipping those protections. General media/roles, assemblies and
interaction declarations likewise require scoped domain, persistence and
capability work before UI or MCP advertises them. Current typed Level/logic
foundations are bounded implementations, not complete cross-game support.

Checkpoints 1–4, A1.0–A1.2 and existing explicit individual acceptances remain
protected. VT-001 / CP4.5 and A1.7 remain **REVISE**; this design approval closes
neither. Real agent continuation, supported runtime execution and production
integration must be proven separately. Materialization, publication/release,
new image generation, provider use, remote/mobile, 2.5D and additional game
integrations retain their separate scope and authorization boundaries.

The [current task router](START_HERE.md) owns the next design block; individual
screen contracts own their design approvals and outstanding implementation proof.
Do not restart framework onboarding or implement all example game modules as a
prerequisite for making the Numberdroid authoring path usable.
