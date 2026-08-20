# Numberdroid — Role / Task Entry Points

Status: **binding role-aware reading router**

## Why this exists

Numberdroid now contains enough gameplay, story, architecture and art-production material that forcing every agent to read everything is counterproductive. At the same time, isolated specialist work can accidentally cross domain boundaries.

The rule is therefore:

> **Read a small universal bootstrap, then the minimum complete domain bundle required by the actual task. Expand context when a trigger crosses a domain boundary.**

Roles below are task classifications, not permanent identities. A single session may move between roles.

---

## 1. Universal bootstrap — everyone

Every agent reads these before repository changes:

1. `AGENTS.md`
2. `REPOSITORY_STRUCTURE.md`
3. `docs/agents/ROLE_ENTRYPOINTS.md`
4. `docs/agents/REPOSITORY_WORKFLOW.md`
5. `docs/README.md`

Also verify:

- current `main` HEAD;
- relevant open PR/current branch state;
- latest relevant Actions run before significant integration work.

### Handoffs

If the user/task explicitly points to a handoff, read it after the universal bootstrap and after the binding domain documents listed below. The handoff supplies **task state**, not durable authority.

Do not browse old handoffs merely because they exist. `docs/history/` is historical by default.

---

## 2. Artist — visual asset production

Use this route when the task primarily asks for a gameplay visual asset, material, character, prop, setpiece, tile, wall, door, animation source or visual polish.

### Mandatory Artist bundle

Read:

1. `docs/art/README.md` — current art status/authority router;
2. `docs/art/production/ARTIST_AGENT_WORKFLOW.md`;
3. `docs/art/production/ART_ASSET_VALIDATION_RULES.md`;
4. `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`;
5. the relevant art-direction document under `docs/art/direction/`;
6. the relevant category/world contract under `docs/art/`;
7. `docs/art-production-methods/README.md`;
8. `docs/art-production-methods/METHOD_SELECTION_GATE.md`;
9. the selected method README(s);
10. the relevant `art-source/recipes/.../recipe.md`;
11. the actual runtime/map context that consumes the asset.

Read `docs/art-production-toolkit/CAPABILITY_INDEX.md` whenever deterministic extraction, masking, alpha, compositing, seams, packing, resampling or validation may be involved.

The long Transfer Ship art-direction/production documents preserve some dated implementation-phase/status passages. `docs/art/README.md`, the current plan, recipe index and category recipes own current milestone status; the durable visual/perspective/material rules in the long documents remain relevant.

### Artist does NOT automatically read

An Artist does **not** need the full campaign story, all learning/gameplay rules, every level-design document or old handoffs just because the game has story/gameplay.

Use the triggers below.

### STORY trigger — Artist must additionally read Story/World when

- the asset depicts a named story character or a specific relationship;
- a prop contains specific narrative content rather than generic environmental storytelling;
- a child drawing, keepsake, family object, sign, message or visual beat would canonically imply what happened;
- the asset stages or changes a story beat;
- the meaning of PRIMUS, Kayo, parents, Core/Transfer or another narrative system cannot be resolved from the current art-direction/category contract;
- the user asks for narrative authenticity or continuity.

Then read the minimum relevant files in `docs/story/`, starting with `STORY_WORLD_FOUNDATION.md`; add `CAMPAIGN_STORY_LEVEL_PROGRESSION.md` when beat/level order matters.

### GAME DESIGN trigger — Artist must additionally read Game Design when

- the prop is interactive, collectible, usable or grants a resource;
- the visual implies a gameplay affordance such as blocked/drivable/usable/dangerous;
- collision footprint, interaction clearance, encounter readability or tactical semantics change;
- the asset introduces/changes a body ability, reward, key/access rule, learning role or objective;
- the visual must encode ownership/faction/turn/resource meaning beyond an existing binding art rule.

Then read the relevant `docs/game-design/` documents and durable rule section(s) in `GAMEPLAY_AND_ENGINEERING_RULES.md`.

### FLOOR / TILE METADATA trigger — Artist must additionally read semantic tile contract when

- producing a cuttable floor/tile atlas;
- tiles contain straight routes/seams/channels;
- corners, T-junctions, crossings or terminals exist;
- thresholds, wall-edge variants, arrows or directional marks exist;
- rotation changes tile meaning;
- tiles must connect across cell boundaries;
- generated alternatives may have incompatible connector geometry;
- automatic runtime placement will choose cells from room/corridor/Level semantics.

Then read:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

This trigger activates **before generation**, not only at integration time. The Artist must define the tile inventory and semantic contract first; the pixels are not allowed to invent topology implicitly.

If the task also changes runtime placement code/materializers/tests, the ENGINEERING / Technical Artist trigger below activates as well.

### ENGINEERING trigger — Artist becomes Artist + Engineer/Technical Artist when

- changing `src/`;
- changing Tiled/map GIDs, layer structure, collision, object properties or asset loading;
- adding/changing runtime animation behavior;
- changing atlas dimensions/order referenced by maps;
- adding build/materialization scripts;
- changing runtime asset paths;
- adding a reusable deterministic tool;
- changing rendering/layer/clip/light behavior.

Then also follow the Engineering or Technical Artist route below **before making the runtime decision**.

---

## 3. Technical Artist / Art Tools

Use this route when art work requires reusable processing code, deterministic compositing, extraction/packing, alpha tools, validators, render scripts or runtime-facing art infrastructure.

### Mandatory bundle

Read:

1. Artist bundle above;
2. `docs/art-production-toolkit/README.md`;
3. `docs/art-production-toolkit/CAPABILITY_INDEX.md`;
4. the relevant tool document under `docs/art-production-toolkit/tools/`;
5. relevant code under `scripts/art/toolkit/`;
6. the consuming asset recipe;
7. relevant build scripts/package scripts.

For semantic floor/tile atlas work, the FLOOR / TILE METADATA trigger in the Artist route is also mandatory.

If the tool changes app/runtime rendering or map semantics, also read the Engineering bundle.

### Toolkit classification rule

Before adding functionality, decide whether it is:

- a reusable deterministic **tool**;
- a production **method** with a distinct authority model;
- or an asset-specific **recipe step**.

Do not create a new method merely because a new image operation exists.

A PLANNED toolkit capability is not implemented merely because it has documentation. To promote a capability to PROVEN, provide actual implementation + Numberdroid production/regression evidence + documented limitations.

---

## 4. Engineer / Runtime Developer

Use this route for TypeScript/React runtime, state, rendering, collision, saves, input, build behavior, game screens, Tiled parsing or runtime asset integration.

### Mandatory Engineering bundle

Read:

1. `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`;
2. relevant files in `docs/architecture/`;
3. actual current implementation and tests in `src/`;
4. relevant current planning/decision document if the change is milestone-driven.

Read `docs/architecture/TILED_MAPS.md` for map/Tiled/GID/layer/object changes and `ROBOT_BODY_SIZE.md` for body footprint/size changes.

### GAME DESIGN trigger

Read relevant `docs/game-design/` before changing observable gameplay rules, difficulty, rewards, progression, encounter behavior, math behavior, objectives, HP, resources or player choices.

### STORY trigger

Read relevant `docs/story/` when runtime behavior exists specifically to stage/sequence a story beat, character decision or campaign transition.

### ART trigger

Read `docs/art/README.md` plus relevant art contracts/recipe before changing visual layer ownership, sprite/frame contracts, semantic colors, lighting, wall/door/prop presentation or accepted runtime art behavior.

When engineering automatic modular floor/tile placement, also read `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`; route topology must come from semantic data + tile metadata rather than pixel inference.

Do not refactor a LIVE_ACCEPTED art/runtime contract solely for code neatness without proving output equivalence and having a reason to reopen it.

---

## 5. Game Designer / Systems Designer

Use this route for mechanics, progression, encounter rules, learning design, difficulty, rewards, objectives, robot abilities, resource loops and level-function design.

### Mandatory bundle

Read:

1. `docs/game-design/GAME_DESIGN.md`;
2. the relevant specialized design documents (`CAMPAIGN_PROGRESSION.md`, `ENCOUNTER_ARCHETYPES.md`, `LEARNING_PROFILES.md`, `MENU_HUB_FLOW.md` as applicable);
3. the relevant sections of `GAMEPLAY_AND_ENGINEERING_RULES.md` for already confirmed invariants;
4. current implementation when the question depends on what is actually playable now.

### STORY trigger

Read `docs/story/` when the mechanic changes why/when a story beat happens, character motivation, campaign order or world logic.

### ENGINEERING trigger

Read architecture/current code before declaring an implementation-level contract, data model, save migration, map representation or rendering behavior.

### ART trigger

Read `docs/art/README.md` plus relevant art direction/category contracts when a design decision relies on visual semantics, space/footprint/readability, faction colors, interaction affordances or setpiece staging.

A Game Designer should describe the required function/experience; do not silently prescribe a rendering method that conflicts with the Artist/Technical Artist authority model.

---

## 6. Narrative / World / Character Designer

Use this route for story beats, world logic, character motivation, dialogue intent, thematic progression or narrative object meaning.

### Mandatory bundle

Read:

1. `docs/story/STORY_WORLD_FOUNDATION.md`;
2. `docs/story/CAMPAIGN_STORY_LEVEL_PROGRESSION.md` when campaign/beat sequencing matters;
3. relevant current game-design documents for mechanics that carry the story.

### GAME DESIGN trigger

Read Game Design when a story proposal changes gameplay progression, objective structure, rewards, failure state, enemy order or learning function.

### ART trigger

Read `docs/art/README.md` plus relevant art direction/category contract when specifying visible staging, props, character look, environment symbolism, signage or palette semantics.

### ENGINEERING trigger

Read runtime/architecture only when the narrative requirement depends on a concrete implemented state machine, screen flow or data contract.

Narrative should not force every Artist to ingest the whole campaign. Put durable visual implications into the appropriate current art-direction/category contract when they become approved.

---

## 7. QA / Integrator / Release

Use this route when the task is to verify an existing candidate, integration or release rather than author new design.

Read:

- universal bootstrap;
- the contract/recipe for the thing being tested;
- the actual code/runtime asset;
- the relevant validation rules and tests;
- any explicit acceptance criteria from the current handoff/task.

For art QA, `QA` means inspect only; it must not trigger image generation.

For integration/release, verify actual Actions/Pages state rather than assuming a PR merge means deployment success.

QA does not own design changes. Report concrete failures against current criteria; route a proposed contract change back to the owning role.

---

## 8. Coordinator / cross-domain task

Use this route when the main job is to combine multiple role outputs or decide sequencing between roles.

A Coordinator reads the universal bootstrap plus the **entry documents** for each domain involved, then drills into only the files required to resolve the dependency.

Examples:

- Artist discovers a family keepsake needs canonical content → Story trigger, then return to Artist.
- Game Designer wants a door to require a key → Game Design + Engineering + Art triggers because logic, data and semantic presentation all change.
- Artist wants a reusable background remover → Technical Artist trigger; Game Design/Story are unnecessary unless the prop content itself needs them.
- Artist creates a directional floor atlas → Floor/Tile Metadata trigger; if it is auto-placed at runtime, add Technical Artist/Engineering.
- Engineer changes robot sprite frame order → Art + Engineering trigger; no need to read unrelated campaign story.

---

## 9. Cross-role decision ownership

A specialist may identify a cross-domain problem without automatically owning the unresolved design decision.

When a decision crosses roles:

1. state the concrete dependency;
2. read the triggered domain bundle;
3. distinguish **already binding contract** from **open design choice**;
4. if still open, present the choice to the user or hand it to the appropriate role;
5. after approval, update the durable domain contract so future agents do not need chat history.

Do not solve an unanswered narrative/gameplay decision indirectly through asset geometry or code defaults.

---

## 10. Handoff between roles

Use `docs/agents/HANDOFF_PROTOCOL.md`.

Every handoff must declare:

```text
PRIMARY RECEIVING ROLE
SECONDARY/TRIGGER ROLES
WHY THIS ROLE IS NEXT
UNIVERSAL BOOTSTRAP
MANDATORY ROLE BUNDLE
CONDITIONAL TRIGGERS
CURRENT CANONICAL STATE
ACCEPTED/FROZEN WORK
OPEN DECISIONS + OWNER
EXACT NEXT ACTION
QA / ACCEPTANCE GATES
```

A receiving Artist should be able to begin without reading the entire story. If the Artist later chooses a narrative-specific child drawing, the STORY trigger activates at that point.

Conversely, a receiving Game Designer must be able to understand which visual/runtime contracts are frozen without learning the implementation history of every art pass.

---

## 11. Minimum-complete-context principle

Use **minimum complete context**, not minimum possible context.

Too little context is dangerous when it omits a binding dependency. Too much context degrades focus and makes stale historical statements compete with current authority.

The preferred pattern is:

```text
universal bootstrap
→ primary role bundle
→ actual current source/code
→ current handoff/task snapshot
→ trigger additional domain only when the task crosses it
```
