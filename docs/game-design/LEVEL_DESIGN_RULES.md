# Numberdroid — Level Design Rules

Status: **binding durable level-design principles**

This document defines reusable spatial-design rules for Numberdroid rooms and Floors. It is intentionally independent of one specific TS-01 layout. Milestone-specific layout decisions belong in current planning documents such as `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

The rules combine game-level readability with practical interior-architecture heuristics. Selected ideas commonly associated with interior design, environmental psychology and feng-shui practice are used only as **spatial heuristics**: clear circulation, supported/anchored activity areas, controlled sightlines, balance between open and occupied space, and meaningful thresholds. They are not treated as mystical or absolute rules.

## 1. Level-design objective

A successful Numberdroid space must work simultaneously as:

1. **a gameplay space** — movement, encounters and interaction remain clear;
2. **a believable place** — architecture and furnishing appear to exist for reasons;
3. **a visual composition** — hierarchy, density and negative space feel deliberate;
4. **a story/world expression** — the space communicates how this society works;
5. **a production system** — repeated rules make future rooms efficient to build.

A visually attractive room that fails movement or world logic is not successful level design. A perfectly functional rectangle with arbitrary objects is also not successful level design.

---

# 2. Form follows function

Every substantial spatial intervention must have a plausible function.

This applies especially to:

- wall returns;
- partial dividers;
- alcoves;
- raised or marked zones;
- thresholds;
- built-in furniture;
- machinery bays;
- floor-routing systems.

Before adding such an element, be able to complete this sentence:

> **This form exists because it helps the space to ________.**

Valid answers can include:

- create privacy or refuge;
- frame a ritual or important transition;
- carry infrastructure;
- support or protect a machine;
- organize waiting/queueing;
- define a workstation;
- separate public from controlled space;
- provide storage/service access;
- guide circulation;
- improve supervision or sightlines;
- create a safe docking/parking position for a body;
- anchor furniture or wall-mounted equipment.

Invalid default answer:

> “The room looked empty / too rectangular.”

Visual composition is a reason to **look for a functional solution**, not a reason to invent meaningless architecture.

## 2.1 Hard versus soft boundaries

Use the weakest boundary that communicates the required function.

From soft to hard:

1. orientation/alignment;
2. furniture grouping;
3. floor material / FloorFX / lighting change;
4. low furnishing or equipment edge;
5. partial screen / structural return;
6. full wall;
7. wall + controlled door.

A full wall should not be used where furniture, orientation or floor treatment can communicate the zone equally well.

Hard boundaries are most justified by real changes in:

- access;
- security;
- hazard;
- privacy;
- ownership;
- environmental condition;
- gameplay gating.

---

# 3. Functional zoning

Every important room should have explicit functions, even when those functions share one open volume.

For each zone define:

```text
FUNCTION
PRIMARY USERS / BODIES
ANCHOR OBJECT OR ACTIVITY
ACCESS / APPROACH
RELATION TO NEIGHBORING ZONES
DESIRED DENSITY
DESIRED EMOTIONAL READ
```

A zone should normally have at least one **anchor**: a hero machine, table, workstation, body dock, seating group, storage wall or other clear reason for the zone to exist.

## 3.1 Zones do not need equal size or equal visual weight

Avoid dividing a room into a set of equally sized, equally furnished rectangles merely because the underlying tile grid makes that easy.

Difference is useful:

- public circulation can be broad and calm;
- a family niche can be denser and more personal;
- a Transfer ritual area can be open and focal;
- a PRIMUS allocation area can be aligned and controlled.

The spatial hierarchy should reinforce the functional hierarchy.

---

# 4. Circulation first

Movement is the first hard constraint.

## 4.1 Primary circulation

A primary route should:

- be obvious without requiring a minimap;
- remain visually calmer than adjacent activity clusters;
- avoid unnecessary zig-zags;
- avoid furniture protruding unpredictably into the path;
- preserve comfortable camera framing;
- accommodate the body sizes relevant to the current Floor.

For TS-01-like public spaces, prefer generous multi-tile movement lanes rather than designing to the smallest technically passable gap.

Exact minimum widths remain level/body specific and must be validated in runtime rather than frozen from aesthetics alone.

## 4.2 Secondary circulation

Secondary paths may be narrower or more intimate when they:

- lead into a niche;
- access a workstation;
- pass behind/around a hero object;
- create optional exploration.

They must still be legible and must not produce accidental traps.

## 4.3 Avoid meaningless central clutter

The center of a public room is valuable circulation and visual breathing space.

Center-floor objects should therefore be comparatively rare and usually belong to one of these classes:

- hero / ritual object;
- explicit interaction focus;
- body dock / machine requiring all-side access;
- intentional spatial landmark.

Ordinary storage, plants, side tables and service furniture should usually move toward edges.

---

# 5. Adjacency and grouping

Objects that function together should **read together**.

A relationship can be communicated by:

- physical proximity;
- shared alignment;
- shared orientation;
- common platform or floor treatment;
- a visible cable/path/conduit;
- matching architecture;
- shared lighting or shadow grouping;
- facing one another across a short functional gap.

## 5.1 Proximity rule

If the player must infer that object A controls, services, stores, charges or belongs to object B, then A and B should normally be close enough to form one visual cluster.

If they must be separated for gameplay reasons, create a visible connection.

Do not rely on explanatory text to repair an otherwise invisible functional relationship.

## 5.2 Cluster before scatter

Increase room density by creating clusters, not by distributing unrelated props evenly over empty tiles.

A good cluster usually contains:

- one anchor;
- one or more support objects;
- a clear approach side;
- intentional negative space around the group.

---

# 6. Edge-first furnishing

Ordinary furnishing usually belongs to the perimeter or to a functional edge.

Preferred placements:

- against a wall;
- in a corner;
- beside a larger furniture group;
- inside an alcove;
- along a zone boundary;
- beside the machine it supports.

Examples:

- plants soften corners, flank seating or live near walls;
- storage aligns with walls;
- coffee/service equipment sits against infrastructure;
- benches normally have a supported/backed edge rather than floating in circulation;
- wall consoles should visibly belong to the wall or machine system they serve.

Edge-first does **not** mean every wall must be full. Deliberate empty wall length is useful for rhythm, sightlines and movement.

---

# 7. Human placement logic versus system placement logic

Numberdroid benefits from spatial contrast between personal life and PRIMUS optimization.

## 7.1 Family / personal spaces

Prefer:

- small asymmetries;
- objects slightly off an ideal grid;
- plants and personal items grouped around use areas;
- seating/table relationships;
- traces of convenience and habit;
- warm local density;
- objects with emotional value but no assigned system purpose.

The result should feel **used and cared for**, not messy for its own sake.

## 7.2 PRIMUS / system spaces

Prefer:

- repeated modules;
- strong alignment;
- explicit docking positions;
- consistent clearances;
- assigned wall banks;
- visible service logic;
- predictable routes and work positions.

The result should feel **competent and optimized**, not automatically hostile.

## 7.3 Transfer / CORE spaces

Transfer is allowed to be the most deliberately composed and symmetrical function when symmetry reinforces ritual, focus and machine precision.

This makes a useful hierarchy:

```text
Family      → asymmetric / lived-in
Transfer    → focal / ritual / partially symmetrical
PRIMUS      → modular / aligned / controlled
```

Do not turn this into three identical rectangular columns with different labels.

---

# 8. Symmetry and asymmetry

Symmetry is a semantic tool, not a default layout generator.

Use symmetry when it supports:

- ritual;
- centrality;
- authority;
- machine precision;
- ceremonial approach;
- a hero object that should dominate attention.

Use asymmetry when it supports:

- domestic life;
- adaptation;
- optional activity;
- organic accumulation;
- secondary support functions.

## 8.1 Avoid room-wide accidental symmetry

If every zone has equal width, equal edge treatment and equal object count, the space can feel diagrammatic.

Break that regularity through **function**, not random offsets:

- one zone may use a hard boundary while another remains open;
- one wall may carry a service bank while the opposite wall stays clear;
- one corner may be a seating niche while another is circulation.

---

# 9. Interior-architecture heuristics

The following practical principles are borrowed from interior architecture and environmental-design thinking.

## 9.1 Anchor and focal point

Every important room/zone benefits from an obvious anchor.

The anchor should:

- be identifiable quickly;
- have sufficient negative space around it;
- organize nearby supporting elements.

## 9.2 Prospect and refuge

Areas where characters wait, rest or perform personal activity often feel more plausible when they have:

- a protected/backed edge;
- a view into the room or toward the approach;
- some separation from the main circulation stream.

This is especially useful for family/waiting areas.

## 9.3 Compression and release

A change from tighter threshold to broader room, or from broad public space to smaller niche, can make spatial transitions legible without signage.

Do not overuse narrow choke points; use scale change deliberately.

## 9.4 Thresholds should mean something

A threshold is stronger when it corresponds to a real change in:

- access;
- role;
- activity;
- privacy;
- material/light;
- story state.

A door in the middle of an otherwise identical space is weaker than a door that genuinely separates two systems.

## 9.5 Supported seating / furniture

Furniture used by people usually benefits from a plausible relationship to walls, views, tables and approach paths.

Do not float a bench simply because an empty floor tile exists.

---

# 10. Feng-shui-derived practical heuristics

Use these only as composition aids.

## 10.1 Clear approach

Important destinations should have a clear approach and should not be hidden behind arbitrary clutter.

## 10.2 Command-position heuristic

A key seat, workstation or control point often feels better when its user can perceive the main approach while not being placed directly in the middle of the traffic stream.

In gameplay terms: important human/support positions should have a readable relationship to entrances and activity, not face a dead wall without reason.

## 10.3 Balance open and occupied space

Avoid both extremes:

- every edge and tile filled;
- huge undifferentiated empty fields.

The goal is a rhythm of:

```text
cluster → breathing space → anchor → circulation → cluster
```

## 10.4 Do not create “arrows of furniture” into paths

Sharp protrusions or narrow object ends aimed into primary circulation tend to feel awkward even when technically passable. Prefer shapes that terminate cleanly against walls or align with the route.

---

# 11. Sightlines and information staging

A player should understand a room in layers.

On entry, prioritize:

1. immediate safe/walkable space;
2. main destination / hero anchor;
3. major route or threshold;
4. secondary support clusters;
5. decorative/personal detail.

Avoid presenting every detail at equal visual importance.

For story spaces, sightlines can stage information deliberately: first the desirable Transfer hero, then the controlled PRIMUS threshold, for example.

---

# 12. Visual hierarchy and density

Suggested hierarchy:

1. hero gameplay/story object;
2. player and relevant robots;
3. major functional cluster;
4. architectural framing / threshold;
5. support props;
6. minor personal clutter / wear.

A support prop that competes visually with the hero object is too strong, too central or too saturated.

## 12.1 Density is not object count

Density can come from:

- wall articulation;
- grouped furniture;
- floor treatment;
- service banks;
- route markings;
- lighting hierarchy;
- meaningful clutter;
- robot activity.

Do not solve every empty area with another standalone sprite.

---

# 13. Top-down readability

Numberdroid level design is evaluated from gameplay view first.

For environment props:

> **If the function or personality depends primarily on seeing the front/side face, the object is a poor default fit.**

Prefer readability through:

- footprint;
- top surface;
- silhouette;
- orientation;
- color/value grouping;
- nearby functional relationships.

This rule applies to both final art and blockout placeholders.

---

# 14. Architecture and furniture must cooperate

Architecture should create places for functions rather than fighting furniture placement.

When a wall change is proposed, decide which of these is true:

```text
A. The function genuinely needs architectural support.
B. The function only needs furniture/edge definition.
C. The function only needs floor/light/signage definition.
```

Choose the least invasive solution that works.

Do not introduce a wall return merely to create visual variety when a wall-backed furnishing cluster would solve the composition more plausibly.

---

# 15. Placeholder / blockout rules

Blockouts exist to answer questions, not to become accidental production assets.

Each placeholder must have a named function such as:

- waiting bench;
- personal storage;
- Transfer diagnostic console;
- body-service bank.

A placeholder must test at least one of:

- required mass;
- placement;
- adjacency;
- approach clearance;
- visual hierarchy;
- density.

If its function cannot be named, remove it.

Placeholders should follow all spatial rules even when their art is crude.

---

# 16. Level-design relationship graph

Before detailed dressing, sketch the room as relationships rather than coordinates.

Example:

```text
ENTRY
  ↓
FAMILY WAITING ── close ── FAMILY TABLE
  │                         │
  │ soft transition         └─ coffee / memory / plants
  ↓
TRANSFER HERO ── close ── TRANSFER CONTROL
  │
  │ hard controlled threshold
  ↓
PRIMUS ALLOCATION ── aligned ── body/service banks
```

Only after this graph makes sense should exact tile placement be decided.

---

# 17. Level-design review questions

For every substantial room revision ask:

## Function
- Why does each wall/alcove/major object exist?
- Can its role be understood without a text label?

## Circulation
- Where is the primary route?
- Is any ordinary prop stealing path space?
- Are clearances comfortable in runtime, not merely technically valid?

## Adjacency
- Are related objects actually grouped?
- If separated, is their connection visible?

## Human plausibility
- Would a person plausibly put this plant, chair, bag or coffee machine here?
- Does seating have a reason to face where it faces?

## Spatial hierarchy
- What is the first thing the eye sees?
- Is the hero object still the hero?
- Is negative space intentional?

## Numberdroid identity
- Does Family feel personal without becoming rustic?
- Does PRIMUS feel optimized without generic villain styling?
- Does Transfer feel focal/empowering?

## Top-down read
- Does every important function read at actual gameplay scale?

---

# 18. Implementation discipline until a level-design tool exists

Until a dedicated editor/tool owns this work, agents editing maps must:

1. read this document plus the current milestone/level plan;
2. inspect the actual runtime map and collision definitions;
3. state the functional reason for structural changes;
4. use blockout placeholders before producing expensive final art when placement/density is unresolved;
5. keep visual footprint and collision footprint separate;
6. preserve accepted art categories unless the change specifically requires reopening them;
7. add/update regression tests for structural/collision contracts where appropriate;
8. verify the live deployed room at desktop and phone scale;
9. treat CI green, merged and level-design accepted as different states.

A future level-design tool may automate placement, adjacency checks, clearance overlays and relationship visualization, but it must preserve these principles rather than replacing them with unconstrained tile painting.
