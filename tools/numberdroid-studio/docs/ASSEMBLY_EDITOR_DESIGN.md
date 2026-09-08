# Assembly Editor — Approved Design

Status: **DESIGN APPROVED; recorded 2026-09-08. Product implementation and real-agent workflow verification remain pending.**

Klaus approved component blocking reuse as the default, with an explicit custom
assembly override, then passed five Assembly mockup checks: component movement
with inherited blocking, variant/state preview, source inspection and return,
adding an independent component, and custom blocking that stays fixed when a
component moves. His response to the final check was “pass”.
The reviewed standalone artifact was `assembly-v1.html`, SHA-256
`1a402d759f03d854f8b4778b547fd1f517ea8a6703d5517b8ad09648daec3e5f`.

This approves the editor design, not implemented Studio behavior, engine output,
or VT-001 / CP4.5. It specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md)
and reuses the [Placement & Blocking editor](PLACEMENT_BLOCKING_EDITOR_DESIGN.md).
The [current task router](START_HERE.md) owns subsequent design/implementation scope.

## Goal and component references

Compose reusable assets into one asset without copying their source content or
forcing a game-engine behavior editor into Studio. The example coffee machine
uses a physical body, shadow, status display and cup appearance. Its component
versions and source relationships remain visible.

- Each component has its own identity and name, an explicit asset/version
  reference, position, rotation, scale and presentation-state use.
- Editing a component's placement changes the assembly, not the source asset.
- Moving one component leaves other independently positioned components fixed.
  Placing the whole assembly as one object is a separate operation.
- Later source-asset edits must not silently retarget an existing assembly.
  Selecting updated component versions requires an explicit, validated change.
- Component source inspection shows the reusable asset/version and its original
  source/cut relationship. Back restores assembly edits, selection, variant,
  state and compatible view context.

An assembly remains a Library asset. A kit organizes related choices rather than
implicitly making every member part of one placed object. Nesting, additional
media and optional project modules retain their separate supported-capability
boundaries; the mockup does not claim all of them are implemented.

## Workspace and editing

Use one central, stable canvas, a left tool rail and a contextual inspector.
The rail provides selection, component addition, rotation, ordering, removal,
grid, Undo/Redo and Save work. Inspector content can scroll without moving the
canvas. Validation uses a reserved-height area; popups do not reflow the scene.
Zoom retains the slider, Fit and 100% controls used by the approved editors.

The component list is ordered front to back. Forward/Back ordering changes
visual stacking without changing transforms or source references. Selection can
come from the canvas or the list. Position uses the component's authored anchor;
the sample exposes rotation and uniform scale. Component transforms apply to all
states unless an explicitly supported override is authored.

Adding a Library asset creates a distinct component referencing its selected
version. It can be positioned independently. Remove and Undo operate on that
component instance without deleting the reusable source asset.

The eye control hides a component for inspection only. It does not remove the
component from the assembly, change its state membership, or remove its blocking.
Source/version details and the inspection action must remain separately readable.
Unchanged component image nodes should remain mounted while another part moves,
so an unrelated preview does not restart on every pointer update.

## Variants and presentation states

Variant and State selectors preview the current assembly without committing
content changes. Switching Idle → Brewing → Coffee ready must retain the selected
Graphite/Copper body alternative and the authored component positions. The sample
display changes presentation, and the cup appears only in Coffee ready.

A component can be used in selected presentation states. This authored membership
is distinct from temporarily hiding it for inspection. An inherited blocking
component contributes in states where it is part of the assembly. Components
with no blocking contribution, such as the sample shadow/display/cup appearance,
must not gain blocking merely because they render pixels.

State preview does not detect player proximity, start a brewing process, grant an
item, or run a game transition. Runtime behavior and the supported interaction
contract remain separate. The sample's states/variants are examples, not mandatory
categories for every asset or a claim of complete state-catalog authoring.

## Inherited and custom blocking

**Use component blocking** is the default. Resolve the authored shapes from the
selected component versions and apply each component's position, rotation and
scale. The inspector identifies the contributing component, asset and version.
Moving the physical body moves its inherited blocking exactly; source geometry
and unrelated visual components remain unchanged.

**Custom assembly blocking** is an explicit alternative. It begins from the
current resolved shapes and lets the owner define geometry for the whole object.
Those shapes belong to the assembly and remain fixed when components subsequently
move. The editor must explain that difference rather than imply live inheritance.
The approved sample applies custom blocking across variants and states; more
specific overrides require an explicit supported design rather than inference.

Custom editing uses the approved geometry editor with the assembly's composed
artwork and correct title/context. Back retains edits without rewriting component
assets. An unfinished polygon must survive leaving/reopening the editor and be
reported as unfinished; it must not silently disappear or be presented as valid
usable geometry. The embedded editor must restore other asset-editor contexts
after returning. Switching back to component blocking resolves current component
transforms while retaining the deliberate distinction from custom geometry.

## Verification and implementation boundaries

The mockup passed focused native-browser checks for explicit version references,
composite imagery, preview-only variants/states, source inspection/return,
transformed inherited blocking, unchanged source assets, inspection visibility,
custom geometry isolation, embedded-editor context, unfinished-draft retention,
component addition/removal/Undo and narrower desktop layout. Final reload and
source-card readability checks passed after a packaging correction. Klaus then
passed the five focused design walkthrough checks.

Those results concern a standalone prototype with sample content and simulated
saves. They do not prove production persistence, concurrency, permissions,
recovery, new public tools or an agent performing the workflow. The current
single-slice asset/Room contracts must be explicitly evolved for composition and
the approved geometry model. Agent and UI operations must share the same supported
commands, version checks, validation and review boundaries. Preserve authored
shapes and exact references rather than silently flattening unsupported data.

Apply the actual-diff risk policy when implementing. Prove the real agent workflow
before asking Klaus for product verification; keep CI, integration, design approval
and product acceptance distinct. Assembly approval does not authorize engine
materialization, publication/release, image generation, provider use or additional
game/remote/2.5D scope.
