# Numberdroid — Level Design Rules

Status: **binding durable level-design principles**

This document defines reusable spatial-design rules for Numberdroid rooms and Floors. Milestone-specific layouts belong in planning documents such as `docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`.

The rules combine gameplay readability, interior-architecture heuristics, environmental psychology and selected feng-shui-derived composition heuristics. These are practical spatial tools, not mystical or absolute rules.

## 1. Level-design objective

A successful Numberdroid space must work simultaneously as:

1. **gameplay space** — movement, encounters and interaction remain clear;
2. **believable place** — architecture and furnishing appear to exist for reasons;
3. **visual composition** — hierarchy, density and negative space feel deliberate;
4. **story/world expression** — space communicates how this society works;
5. **production system** — reusable rules make later rooms efficient to build.

A perfectly functional rectangle with arbitrary objects is not successful level design.

---

# 2. Form follows function

Every substantial spatial intervention must have a plausible function.

This applies especially to wall returns, partitions, alcoves, thresholds, built-ins, machinery bays and floor-routing systems.

Before adding one, be able to complete:

> **This form exists because it helps the space to ________.**

Valid reasons include privacy, refuge, infrastructure, machine protection, waiting/queueing, storage, service access, circulation, supervision, body docking, threshold framing and gameplay gating.

Invalid default reason:

> “The room looked empty / too rectangular.”

Visual composition is a reason to look for a functional solution, not a reason to invent meaningless architecture.

## 2.1 Hard versus soft boundaries

Use the weakest boundary that communicates the required function:

1. orientation/alignment;
2. furniture grouping;
3. floor/light/material change;
4. low furnishing/equipment edge;
5. partial screen;
6. full wall;
7. wall + controlled door.

Hard boundaries are most justified by real changes in access, security, hazard, privacy, ownership, environmental condition or gameplay state.

---

# 3. Rationality gradient — do not over-optimize every room

**Efficiency is a worldbuilding variable, not a universal virtue.**

A believable Numberdroid Floor may contain inherited structure, historical adaptation, awkward corners, secondary passages and rooms that are larger or smaller than a purely optimized plan would choose.

## 3.1 Family / human-influenced space

Human/domestic areas may be:

- irregular;
- subdivided into small rooms/niches;
- adapted around older structure or neighboring spaces;
- slightly inefficient;
- asymmetric;
- connected through short halls or offsets rather than one perfect open plan.

This should feel **lived-in and evolved**, not randomly chaotic.

A family dwelling should not automatically collapse into one generic “family rectangle” merely because that is the most efficient game layout.

## 3.2 PRIMUS / system space

PRIMUS may be more rational:

- repeated modules;
- explicit docking positions;
- predictable service clearances;
- aligned wall banks;
- efficient routes;
- stronger standardization.

The contrast is useful worldbuilding:

```text
human/family   → adapted / layered / imperfectly efficient
Transfer       → focal / ritual / deliberately composed
PRIMUS         → optimized / assigned / repeatable
```

## 3.3 Avoid rectangular-outline default

Do not assume a Floor or room cluster should fill its rectangular map bounds.

Prefer a useful sequence of spaces when function supports it:

```text
room → small room/niche → hall → destination room → controlled room
```

Extra square meters are acceptable when they improve gameplay, staging or spatial plausibility. Compactness is not an acceptance criterion by itself.

---

# 4. Functional zoning and relationship graphs

Every important zone needs:

```text
FUNCTION
PRIMARY USERS / BODIES
ANCHOR OBJECT OR ACTIVITY
ACCESS / APPROACH
RELATION TO NEIGHBORS
DESIRED DENSITY
DESIRED EMOTIONAL READ
```

Zones do not need equal size or equal visual weight.

Before coordinates, sketch relationships. Objects and rooms that belong together should read together through proximity, alignment, orientation, shared floor treatment, visible connection or architecture.

If object A controls/services object B, proximity is the default. If gameplay forces separation, provide a visible connection.

---

# 5. Circulation first

Primary circulation should:

- be obvious;
- remain calmer than activity clusters;
- avoid unnecessary zig-zags;
- preserve camera comfort;
- accommodate relevant body sizes;
- avoid furniture protruding unpredictably into the route.

Secondary paths may be tighter when they lead to a niche, workstation, optional room or hero-support position.

## 5.1 Door breathing zone — hard rule

Doors and controlled thresholds need clean space on **both sides**.

Do not place ordinary props, plants, controls or decorative objects immediately beside a door merely because a tile is free.

A door must preserve:

- readable approach;
- readable opening direction/state;
- body clearance;
- visual distinction from nearby equipment;
- room-to-room transition legibility.

Default composition target: at least roughly **one tile of uncluttered visual breathing room** on each usable side when the room scale allows it. Runtime collision/body QA still decides the actual minimum.

## 5.2 Center-floor objects are exceptional

Ordinary storage, plants and side furniture move to edges. Center placement is mainly for hero objects, ritual machinery, explicit interactions or landmarks that require all-side access.

---

# 6. Edge-first furnishing and human plausibility

Ordinary furnishing usually belongs against a wall, in a corner, in an alcove, beside a larger cluster or beside the machine it supports.

## 6.1 Plant rules

Plants are especially strong **edge softeners**.

Prefer:

- near walls;
- in corners;
- beside seating;
- at the end of a furniture run;
- at a soft zone boundary.

Avoid:

- primary circulation;
- isolated open-floor placement without a reason;
- placement directly **in front of wall furniture, consoles or storage**;
- placement that blocks the visual read or access side of another object.

A plant may flank wall furniture; it should not obscure it.

## 6.2 Furniture relationships

Benches normally have a backed/supported edge. Coffee/service equipment sits against infrastructure. Storage aligns with walls. Personal clutter belongs to a surface, seat, storage cluster or habitual use area rather than a random tile.

---

# 7. Symmetry and asymmetry

Symmetry is semantic, not a default layout generator.

Use symmetry for ritual, centrality, authority, machine precision and hero focus.

Use asymmetry for domestic life, adaptation, optional activity, inherited structure and secondary functions.

Avoid room-wide accidental symmetry. Break regularity through function, not random offsets.

---

# 8. Interior-architecture / environmental heuristics

## 8.1 Anchor and focal point

Every important room or zone benefits from a clear anchor with enough negative space to organize supporting elements.

## 8.2 Prospect and refuge

Waiting, resting and personal areas often feel better with a protected/backed edge plus a view toward the room or approach.

## 8.3 Compression and release

A short tighter passage leading into a broader destination can communicate progression without signage. Do not turn every transition into a choke point.

## 8.4 Thresholds should mean something

Doors and thresholds are strongest when they correspond to a real change in access, role, activity, privacy, material/light or story state.

## 8.5 Command-position heuristic

Important seats, workstations and controls often feel better when users can perceive the approach without sitting directly in the traffic stream.

## 8.6 Balance open and occupied space

Seek rhythm rather than uniform density:

```text
cluster → breathing space → anchor → circulation → cluster
```

---

# 9. Sightlines and information staging

On entry, prioritize:

1. safe/walkable space;
2. main destination / hero anchor;
3. route or threshold;
4. support clusters;
5. decorative/personal detail.

Story spaces may reveal information sequentially. A bend or hall is useful when it creates a meaningful reveal, not merely extra travel distance.

---

# 10. Visual hierarchy and density

Suggested hierarchy:

1. hero gameplay/story object;
2. player and relevant robots;
3. major functional cluster;
4. architectural framing;
5. support props;
6. personal clutter/wear.

Density is not object count. It may come from room subdivision, wall articulation, grouped furniture, floor treatment, service banks, route markings, lighting and activity.

Do not solve every empty region with a standalone sprite.

---

# 11. Top-down readability

Gameplay view is authoritative.

For environment props:

> **If the function or personality depends primarily on seeing the front/side face, the object is a poor default fit.**

Prefer footprint, top surface, silhouette, orientation, value/color grouping and nearby functional relationships.

---

# 12. Architecture and furniture must cooperate

When a structural change is proposed, classify it:

```text
A. function genuinely needs architecture;
B. function only needs furniture/edge definition;
C. function only needs floor/light/signage definition.
```

Choose the least invasive solution that works.

Do not use architecture to rescue bad furniture placement, and do not use furniture to hide an implausible wall.

---

# 13. Placeholder / blockout rules

Blockouts answer questions; they are not accidental production assets.

Each placeholder must have a named function and test at least one of:

- mass;
- placement;
- adjacency;
- approach clearance;
- hierarchy;
- density;
- room function.

Useful blockouts may include entire **room functions** (bed, hygiene module, storage) when topology is being tested before final art production.

---

# 14. Level-design review questions

## Function
- Why does each wall/room/alcove/major object exist?
- Is anything present only to make the silhouette less boring?

## Rationality
- Should this specific area be optimized, or should history/human use make it more layered?
- Is the plan suspiciously rectangular or efficient without a world reason?

## Circulation
- Is the primary route clear?
- Do doors have breathing space on both sides?
- Are clearances comfortable in runtime?

## Adjacency
- Are related objects actually grouped?
- Is a control visibly connected to the machine it controls?

## Human plausibility
- Would a person plausibly put this plant/furniture/object here?
- Is any plant blocking wall furniture?
- Does seating have a plausible wall/view/approach relationship?

## Hierarchy
- What is seen first?
- Is negative space intentional?
- Does the hero remain dominant?

## Numberdroid identity
- Does Family feel personal and adapted?
- Does Transfer feel focal/empowering?
- Does PRIMUS feel optimized without generic villain styling?

---

# 15. Implementation discipline until a level-design tool exists

Until a dedicated level-design tool owns this work, agents editing maps must:

1. read this document plus the current level/milestone plan;
2. inspect actual map, movement and collision definitions;
3. state the functional reason for structural changes;
4. prefer relationship/topology blockout before final asset production when layout is unresolved;
5. keep visual and collision footprints separate;
6. preserve accepted art unless a concrete layout need requires a bounded extension;
7. add/update regression tests for topology, door clearance and collision;
8. verify the deployed room on desktop and phone;
9. treat `CI green`, `merged`, `layout accepted` and `Gold Slice accepted` as different states.

A future level-design tool may automate placement, adjacency checks, clearance overlays and relationship visualization, but it must preserve these principles rather than replacing them with unconstrained tile painting.
