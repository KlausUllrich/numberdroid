# Numberdroid — Current Development Plan

## 2026-09-02 acceptance and repair adjustment

Klaus explicitly accepted VT-014 on 2026-09-02. The acceptance covers the bounded private immutable A4c Candidate, strict trusted-service child attenuation and truthful read-only authority presentation integrated through PRs #198 and #199; it does not accept A3a/A4a/A4b or authorize A5, materialization, publication or release. Room Editor VT-001 remains REVISE. Its reported live findings—Fit, discoverable saved-state resize, direct exact-asset selection, persistent placement brush, plain pending guidance, confirmed Clear behavior and correctly rotated asset imagery—are repaired and source-integrated through PR #201, final head `e26f3d707a790a4b4779c9267514a3b8de9f18d0`, merge `dbe37634ea13d076cd00647fffb0dde1b2bd0f69`, exact-head Build #2353 / run `33629339599` and green post-merge Build #2354 / run `33630127953`. This is engineering closure only; Klaus's live retest remains the acceptance gate. The engine-neutral Preview, logical footprint rules and validate-only EngineBridge boundary remain unchanged. Evidence: [`../../tools/numberdroid-studio/docs/LIVE_VERIFICATION_2026_09_01.md`](../../tools/numberdroid-studio/docs/LIVE_VERIFICATION_2026_09_01.md), [`../../tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md`](../../tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md), and [`../../tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md`](../../tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md).


Status: **current forward plan — VT-014 accepted; bounded Room Editor VT-001 repairs integrated and green with live retest pending; VT-011/O2a gates remain pending; no A5 source work is authorized**

This document stays at project/milestone level. Durable gameplay/story/art rules live in domain documents; historical production reasoning lives in `docs/history/`.

Detailed TS-01 Gold Slice execution:

`docs/planning/TS01_GOLD_SLICE_EXECUTION_PLAN.md`

Current Floor treatment brief:

`art-source/recipes/transfer-hall/floor-treatment/recipe.md`

Semantic Floor/Tile metadata contract:

`docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

Directional Actor grounding workflow:

`docs/art/production/ACTOR_GROUNDING_WORKFLOW.md`

Transfer Hero production lessons:

`docs/history/experiments/TRANSFER_SYSTEM_HERO_PRODUCTION_LEARNINGS_2026-08-17.md`

Declarative Level Compiler contracts:

`docs/level-generation/`

---

## Foundation status

The framework/runtime architecture phase is complete and must not be restarted as a prerequisite for content production.

Established systems include:

- React app/screen-state architecture;
- free top-down metagame movement and local RAF camera;
- Tiled/`FloorDefinition` runtime model;
- family profiles/saves and progression framework;
- Number Duel with Addition/Subtraction gameplay;
- robot body size/drive identity;
- neutral / guard / patrol / aggressive encounter behavior families;
- transfer/body ownership flow;
- HP/loss/restart behavior;
- GitHub Actions/Pages build path;
- persistent compiler-driven Trigger/Event runtime;
- Staged Actor/pass-by runtime;
- semantic Level Compiler Workbench with constraint-aware editing.

Do not reintroduce prototype bridges or another game-runtime architecture migration. See `docs/agents/GAMEPLAY_AND_ENGINEERING_RULES.md`.

---

## Parallel product track — Numberdroid Studio agent-first authoring

Numberdroid Studio is the production/authoring layer before the game runtime and
repository publish boundary. Its binding direction is:

`tools/numberdroid-studio/docs/VISION.md`

The first complete target is Numberdroid, not a speculative universal game
editor. Studio must solve two paths end to end:

```text
generated/uploaded image → reproducible non-destructive processing → semantic asset
level requirements → layout + actors + routes + pickups + variables + logic
                   → validated immutable Numberdroid candidate
```

Studio is agent-first: every ordinary authoring action must be a semantic
application command available through an appropriately authorized MCP task
surface. The human UI uses the same commands and focuses on visual understanding,
correction, review, conflicts, and release decisions. Agents never automate UI
clicks. Human-exclusive authority remains root-task/root-grant creation,
widening, renewal and revocation, owner review, merge, recovered-copy
activation, repository/engine materialization, and publish. The trusted service
may derive only a strictly attenuated child task/grant from an exact active
parent under the separately approved A4c contract; an agent request never mints
or widens authority.

Growth uses three layers:

1. universal core — projects, immutable artifacts/CAS, processing recipes, assets,
   jobs, revisions/findings, isolated tasks/reviews, candidate manifests, backup;
2. optional reusable authoring modules — image/atlas/sprite, grid/level,
   actors/routes, typed variables/trigger-action logic, animation/dialogue; and
3. project/engine adapters — Numberdroid first, then only concrete thin proofs.

Four versioned interfaces keep those layers honest:
`ProjectCapabilityManifest`, semantic Authoring Commands/Queries, immutable
`CandidateManifest`, and `EngineBridge`. The current Checkpoint 5 adapter/compiler
candidate is the first proof of the adapter direction, not the complete product.

A0.1–A0.4 now implement the bounded capability manifest/query,
`CandidateManifest`, and validate-only `EngineBridge` candidates on `main`; they
remain explicitly not user-accepted. A1.0–A1.2 are separately user-accepted and
cover the exact-PNG crop Recipe, Result, and inert primary-visual selection only.

A1.3–A1.6b2b are now source-integrated, non-accepted candidates. Together they
implement the read-only project-bound preflight, strict task-branch plan,
schema-v13 atomic DRAFT adoption, host-bound admission/session, and explicit
private Authoring-v2 transport. They do not change the accepted legacy 19/4 or
task-bound 30/5 MCP surfaces, Main/CP2C Assets, owner decisions, lifecycle,
materialization, or publication. The discarded local A1.4 draft was not this
integrated chain and must not be reconstructed or used to roll it back.

The current Artist-path block is A1.7. Its implementation-grounded D0 state
contract is frozen in
`tools/numberdroid-studio/docs/A1_7_STATE_CONTRACT.md`. The separately
classified minimal owner-safe task/adoption read projection and its dependent
bounded selected-task visual review/correction surface are now **implemented
candidates — not user accepted**, recorded in
`tools/numberdroid-studio/docs/A1_7_READ_PROJECTION_STATUS.md` and
`tools/numberdroid-studio/docs/A1_7_UI_CANDIDATE_STATUS.md`. The visible path
stops at **Waiting for your review** and adds no adoption, retry, owner review,
merge, finalization, materialization, publication, or release authority. Klaus's
visual return gate and the remaining required deterministic processing
operations keep A1 incomplete.

While Klaus cannot run live tests, safe candidate work follows the adaptive
D0/L1/L2/L3 policy in
`docs/agents/CHANGE_RISK_AND_VERIFICATION.md`: one bounded promise and at most
one high-risk axis, only trigger-relevant superagents, one planning pass, one
independent actual-diff review, and tier-required verification. Two to four
cohesive L1 microsteps may share one PR; routine blocks update only affected
current authority plus the compact return-test backlog. Read-only planning for
the next independent block may overlap post-merge CI, but dependent work waits
for the prior `main` gate. Repository source integration still requires the
explicit bounded authority in the current human launch prompt and never implies
user acceptance. The dated execution snapshot is
`docs/history/handoffs/HANDOFF_2026-08-28_NUMBERDROID_STUDIO_AUTONOMOUS_A1_EXECUTION.md`.

After the complete Numberdroid vertical proof, one thin Godot 2D/Tower Defense
fixture should test portability using paths, waves/spawners, actors, tower slots,
typed variables and victory logic. Godot/Unreal editors remain authoritative for
runtime/rendering/playtest; initial integration is one-way. Unreal `.uasset` files
must never be written directly.

Detailed polished UI mockups are not an A0 dependency. Use low-fidelity
workflow/state maps first; create detailed responsive mockups only after semantic
commands, capability discovery, information architecture, and failure/conflict
states stabilize.

Detailed Studio roadmap and contracts:

- `tools/numberdroid-studio/docs/ROADMAP.md`
- `tools/numberdroid-studio/docs/REQUIREMENTS.md`
- `tools/numberdroid-studio/docs/ARCHITECTURE.md`
- `tools/numberdroid-studio/docs/MCP_CONTRACT.md`

---

## Parallel product track — Studio operations, remote access, mobile, and agent onboarding

Numberdroid Studio has a separate cross-cutting product track alongside the
current Gold Slice work. It does not change the Gold Slice's current art/content
priority and does not accept the still-open Studio Checkpoint 4.5 or promote the
integrated Checkpoint 5 foundation beyond candidate-only status.

The four required outcomes are:

1. simple, trustworthy full-workspace backup and restore-as-copy in the human UI;
2. an always-on, authenticated private Studio service reachable from Klaus's phone;
3. practical MCP onboarding for scoped **Artist** and **Level Designer** roles; and
4. a responsive, touch-usable smartphone UI.

Required order:

```text
contract + threat model
→ durable verified backup core and human backup UI
→ source-integrated authenticated O2a private-service backend
→ later live deployment/private-access gate
→ complete phone/touch workflows and real-device acceptance
→ runtime MCP onboarding and final role playbooks
```

O0 freezes the external control-ledger, current schema-v13/no-workspace-
migration, human-authority, safe-path, atomic-publication, state-machine,
restored-copy quarantine, activation boundary, failure-code, adversarial-test,
and first-UI decisions in
`tools/numberdroid-studio/docs/O0_BACKUP_RECOVERY_CONTRACT.md`. The non-visual
O1a backup application/job seam is now a source-integrated implemented
candidate, recorded in
`tools/numberdroid-studio/docs/O1A_BACKUP_CORE_STATUS.md`. It reuses the
accepted SQLite/CAS integrity, backup, verification, and
restore-to-new-destination primitives and adds no overwrite, deletion,
active-workspace cutover, remote listener, or agent backup authority.

A post-freeze O1a platform seam review closed two implementation-proof gaps
before runtime code: Windows now requires fixed bounded-stdin Win32 root-
inspection plus identity-bound write-through publication, and one root-scoped
shared/exclusive barrier now binds Create to every destructive CAS mark/sweep
path. The CI classifier explicitly treats only the named pure O1a Domain/
Application modules as headless, so the behavior PR selects Studio Linux and
Windows without an unrelated browser lane; unknown paths still fail closed.

O1a passed its selected Linux and Windows gates and is integrated through PR
[#175](https://github.com/KlausUllrich/numberdroid/pull/175) at
`b40e3deb3af5ad501aadc43e1f980e35a2670962`. The separately classified O1b
**Backups** UI passed Build #2252 / run `33300488531` at final PR head
`589a7adaa0cb60b608fbc6ad1aec4df441731d94` and is source-integrated through PR
[#176](https://github.com/KlausUllrich/numberdroid/pull/176) by merge commit
`ac660f0edab39b7ae8b905cd4193f87f3bf87251`. Klaus live-tested and **accepted O1b through VT-012 on 2026-09-01**. Unlock,
Create, Verify, Recovery-test, Restore-as-copy, restart/session invalidation,
durable state, deliberate missing-backup failure/recovery, keyboard focus, and
responsive layouts passed. Low priority: open `Technical details` disclosures
close after `F5`. Acceptance does not grant remote backup metadata/operation
authority, activation, deletion, cleanup/retention, or deployment. O2a, A3a, A4a, A4b, and the bounded A4c sequence are now source-integrated and
automated green without widening those gates:

- O2a PR #178 head `89141c079c1d96a4aa4c45d8b8c4b88dc464484c`,
  Build #2261 / run `33308845444`, merge
  `b2b3768867321cd60e55ff84b7dee45b5d14f93b`, post-merge Build #2263 /
  run `33313162805`;
- A3a PR #179 final head `dbc6dabf6d821032c90ef31e87dfa0737fe20f48`,
  Build #2264 / run `33313560001`, merge
  `7322542b07907710bbba16e3ffd7d1b2fc6aa5a3`, post-merge Build #2265 /
  run `33313888975`;
- A4a PR #182 final head `4b2d61ebfb37e280e7819c6c5db7b63ddcb7b6ff`,
  Build #2271 / run `33337454662`, merge
  `e0b2396c31f7f58d500591dbc5c6f9a431d9ef45`, post-merge Build #2272 /
  run `33337734484`;
- A4b PR #184 final head `475280def81cee3371c0a62606a496e846f010bc`,
  Build #2275 / run `33341970255`, merge
  `8238d05a29ee6524f6457bfccc315179ee3896b5`, post-merge Build #2276 /
  run `33342294000`;
- A4c Candidate PR #198 final head
  `6ea743ff5570677c24a58fae2c5cad210af19d3d`, Build #2344 / run
  `33553937139`, merge `053f9c407f5ecd7c93c1775249aa0630c88b6460`,
  post-merge Build #2345 / run `33554781224`, failed-only rerun green;
- A4c derived child PR #199 final head
  `6f7c6bfee89fec2e22200fe66002b3d3c73fb968`, Build #2347 / run
  `33562709548`, merge `122a2533a12abe5e51e6458fa80f2047825240b4`,
  post-merge Build #2348 / run `33563416584`, failed-only rerun green.

Current autonomous engineering sequence:

```text
O1b source-integrated and user-accepted through VT-012
→ O2a source-integrated; deliberate deployment/VT-013 retained for Klaus
→ A3a typed kernel source-integrated
→ A4a lossless Numberdroid projection source-integrated
→ A4b bounded reference behavior source-integrated
→ A4c authority-neutral Domain foundation source-integrated
→ bounded Room Editor L3 continuation and live-workflow repair source-integrated through PRs #191, #192, #194, #195, #196 and #201; live acceptance pending
→ A4c task-scoped Application candidate source-integrated; stops at Waiting for your review
→ A4c trusted-service derived child source-integrated; human-rooted, strictly attenuated and depth one
→ VT-014 user accepted 2026-09-02; PR #201 repair integrated and post-merge green; Klaus live-retests VT-001
→ later deliberate O2 deployment, O3 phone, and O4 final onboarding gates with Klaus
```

A4a and A4b are source-integrated and automated green, with exact evidence in
`tools/numberdroid-studio/docs/A4A_NUMBERDROID_LEVEL_PROJECTION_STATUS.md`
and `tools/numberdroid-studio/docs/A4B_REFERENCE_BEHAVIOR_STATUS.md`. A4c is
also source-integrated and green through the separate Candidate and child
slices, with exact evidence in
`tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md`.
A3a, A4a and A4b remain not user accepted. A4c/VT-014 was explicitly user
accepted on 2026-09-02. No implied next slice may add remote backup/MCP
authority, deployment, O3/O4/A5/A6,
materialization, publication, or release.

Klaus's 2026-08-31 scope decision authorized two exact A4c mechanisms without
accepting them: private `level.candidate.create` for one task-bound immutable
Create/Validate/Compile/Preview/Diff/Submit closure, and a trusted-service
operation that derives a same-project/same-actor child task as a strict subset
of an active human-rooted parent with atomically reserved budget and cascading
ancestor denial. Those mechanisms were subsequently user accepted only as
VT-014 on 2026-09-02. The private candidate scope changes no MCP discovery
count and must stop at task/effective `IN_REVIEW`, review `OPEN`, every item `PENDING`,
`REVIEW_SUBMITTED`, and **Waiting for your review**. Candidate Application work
was integrated first; child-task persistence remained a separate L3 risk axis.
Current authority and implementation truth live in
`tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_AUTHORITY.md`
and `tools/numberdroid-studio/docs/A4C_LEVEL_CANDIDATE_AND_CHILD_TASK_STATUS.md`.

The detailed binding track plan and gate boundaries live in:

`tools/numberdroid-studio/docs/OPERATIONS_REMOTE_MOBILE_MCP_PLAN.md`

---

## Level Compiler — established authoring infrastructure

The approved direction remains a deterministic declarative Level Compiler:

```text
rough design intent
→ LevelSpec
→ semantic room/corridor graph
→ deterministic topology
→ Shared Wall Graph + apertures
→ navigation + Door Clearance
→ Props / use-space / Hero clearance
→ true-space Exact Fit / multipart collision
→ Actors / patrol routes
→ Triggers / Events / Pickups / Staged Actors
→ Tiled-compatible emission
→ FloorDefinition + typed script runtime
→ composite presentation mapping
→ existing MetaGame runtime
```

TS-01 is the reference/parity case.

Playable generated floor:

```text
?floor=ts01-generated
```

Workbench:

```text
?levelgen=ts01
```

v0.13.2 spatial/presentation stabilization remains **LIVE QA ACCEPTED** and should not be reopened to solve ordinary art problems.

PRIMUS v2 deliberately changes one room dimension inside the accepted semantic layout: the room is now fixed at 10×8 so a one-tile calm perimeter leaves an exact 8×6 domain for complete 2×2 floor macros. This is an intentional art/layout fit correction, not a return to architecture migration.

---

## Art-production infrastructure — established

Repository authority remains separated:

```text
METHOD  → docs/art-production-methods/
TOOL    → docs/art-production-toolkit/
RECIPE  → art-source/recipes/
SOURCE  → art-source/approved/
RUNTIME → public/assets/
```

Current proven method/tooling includes:

- M1 Direct Generative Source;
- M2 Controlled Art Pass;
- M4 Procedural 2D Compositor for topology/material-critical 2D work;
- deterministic approved-source validation;
- Crop/Fit/downscale with premultiplied-alpha Lanczos;
- deterministic shadow derivation;
- directional-actor connected-component/source-integrity analysis;
- deterministic runtime sanitation of proven detached actor-source artefacts;
- profile-driven directional actor grounding with generated CSS and browser QA;
- explicit human live-QA calibration stored as reproducible profile data;
- explicit manual approved-source upload/verification path;
- deterministic cuttable floor-atlas extraction from measured cell faces rather than naive image division;
- explicit semantic per-tile/surface metadata for automatic placement: role, connectors, continuity family, span, rotation, wall/runtime eligibility and direction meaning;
- exact multi-cell tiling-domain validation after structural bands are removed;
- categorical prohibition on inline repository Base64 transport.

Main Hall proved that **visual source pixels are not topology authority**. PRIMUS proved that **a valid multi-cell asset is still invalid when room geometry/perimeter treatment exposes only part of it**. Both reusable rules live in `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`.

M3 layered-editor infrastructure and broader generic Freistellen/atlas tooling remain deferred until a concrete need justifies them.

---

## TS-01 Gold Slice — accepted baseline

Frozen unless a concrete defect or deliberate revision appears:

- **PICO source/turnaround** — LIVE_ACCEPTED;
- **PICO physical grounding** — LIVE_ACCEPTED on 2026-08-19; PR #121 reference profile; reusable workflow in `docs/art/production/ACTOR_GROUNDING_WORKFLOW.md`;
- **Floor base material family** — accepted baseline;
- **Family Living floor v1** — LIVE_ACCEPTED; warm civilian/lived-in material treatment already integrated;
- **Main Hall floor v1** — LIVE_ACCEPTED on 2026-08-20; one calm circulation spine, room thresholds are not route branches, semantic tile metadata contract proven;
- **Transfer Room floor / Hero anchoring v1** — LIVE_ACCEPTED; approved 6×6 atlas integrated with installed Hero-zone relationship;
- **PRIMUS Allocation floor v2** — LIVE_ACCEPTED on 2026-08-20; systematic 2×2 macro interior, calm one-tile wall perimeter, exact 10×8 room fit, real threshold/service semantics only;
- **Walls / Architecture** — LIVE_ACCEPTED;
- **Doors** — LIVE_ACCEPTED;
- **Family Table + shadow** — LIVE_ACCEPTED;
- **Family Memory Console + shadow** — LIVE_ACCEPTED;
- **Transfer Apparatus + shadow + silhouette collision** — LIVE_ACCEPTED;
- **Yellow Core static resting state** — LIVE_ACCEPTED at 96×96 on separate `transfer-fx` layer.

Still visual/runtime candidates pending final room-context disposition:

- Round Plant + shadow;
- Planter Trough + shadow;
- Coffee Machine + shadow;
- Hologram Pedestal + shadow;
- Flow Regulator — approved/archived source, 128×128 runtime candidate visible in live TS-01; final scale/shadow/collision/use-space/bus acceptance still pending.

Remaining room-floor identities:

- **Child** — not yet differentiated from current domestic/family treatment;
- **Hygiene** — not yet differentiated from current domestic/family treatment.

---

## Directional Actor grounding — accepted production standard

PICO established the reusable grounding production pattern:

```text
approved directional source
→ connected-component/source-integrity analysis
→ deterministic runtime sanitation only for proven artefacts
→ connected foot/support geometry
→ profile-driven ambient + contact shadows
→ generated runtime CSS
→ automated 8-direction + real-scene QA
→ explicit human per-direction calibration deltas
→ live acceptance
→ freeze
```

Important boundary:

- automated geometry prevents impossible/detached grounding;
- final perceptual calibration remains Human Live QA authority;
- accepted per-direction deltas are stored in profile data rather than hidden CSS tweaks;
- approved source geometry and human presentation offsets remain separate;
- do not refactor accepted PICO offsets merely to impose a cleaner universal formula.

This block is complete. It is not the current Gold-Slice priority.

---

## Transfer System static Hero milestone — established

Accepted/proven:

- broad 4×6 Apparatus Hero;
- deterministic 256×384 runtime materialization;
- separate grounding shadow;
- authored silhouette collision preserving transparent playable corners;
- Yellow Core as a separate 96×96 movable `transfer-fx` visual;
- source/runtime scale split;
- movable components not forced into static Prop lifecycle;
- installed Transfer-room floor anchoring around the Hero.

Flow support now extends this system without reopening the accepted Apparatus/Core/floor-anchor baseline.

---

## CURRENT milestone — finish the remaining static Gold Slice floor/environment pass

The generated TS-01 is structurally sound and now has **four accepted floor identities**. **Current priority remains static Gold-Slice coherence before campaign expansion or full Transfer choreography.**

Completed floor-identity proof:

```text
Family Living   LIVE_ACCEPTED
Main Hall       LIVE_ACCEPTED
Transfer Room   LIVE_ACCEPTED
PRIMUS          LIVE_ACCEPTED
```

Still open in the current floor/environment milestone:

```text
Child identity          OPEN
Hygiene identity        OPEN
Wall AO                 OPEN
Usage/wear FloorFX      OPEN
Flow floor relationship PARTIAL / OPEN
```

### Planned sequence

1. **Complete TS-01 room-specific floor identities — one room at a time**
   - ~~Family Living~~ **DONE / LIVE_ACCEPTED**;
   - Child — next domestic material identity;
   - Hygiene — next functional/non-slip material identity;
   - ~~Main Hall~~ **DONE / LIVE_ACCEPTED**;
   - ~~Transfer Room + Hero floor anchoring~~ **DONE / LIVE_ACCEPTED**;
   - ~~PRIMUS systematic floor logic~~ **DONE / LIVE_ACCEPTED v2**.

   The Main Hall and PRIMUS passes jointly establish the reusable semantic-floor rule set: define semantics before generation, archive/extract deterministically, store explicit metadata, place from Level semantics, remove structural bands before repeated multi-cell placement, and require exact divisibility of the usable domain by the macro span. See `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`.

2. **Add static wall ambient occlusion / architectural grounding**
   - derive from actual architecture/Shared Wall Graph;
   - preserve apertures;
   - FloorFX only;
   - tune at gameplay scale.

3. **Add usage/wear treatment**
   - authored/semantic use evidence, not random Ground variation;
   - Family Living activity zones;
   - Main Hall center traffic band;
   - Transfer Human approach / Robot exit;
   - PRIMUS service-bank/patrol logic;
   - Child/Hygiene use evidence after those room identities are accepted.

4. **Complete Flow support integration**
   - finalize 128×128 candidate scale decision;
   - finalize Flow collision/use-space and grounding shadow;
   - add deterministic static Flow coupling bus as FloorFX;
   - keep later active synchronization on separate `transfer-fx`.

5. **PRIMUS hero/system wall object**
   - establish allocation/work-room identity above the now-accepted floor;
   - competent, ordered, attractive rather than villain-black;
   - preserve open patrol/work center.

6. **Useful domestic replacements**
   - Child Bed;
   - Toy / personal storage;
   - minimal Hygiene fixture/support;
   - only named functional objects that materially improve habitation.

7. **Full-room cohesion and candidate disposition**
   - accept/revise/remove Coffee/Plants/Hologram in context;
   - remove obsolete blockouts;
   - tune environmental grounding/AO without reopening accepted PICO grounding absent a concrete defect;
   - tune floor-treatment intensity rather than adding random texture;
   - converge lighting with Transfer as primary warm local focus.

8. **Desktop + phone Gold-Slice QA**
   - room identity;
   - hierarchy;
   - readability;
   - movement/collision;
   - visual density;
   - Numberdroid identity;
   - explicit final acceptance.

9. **Only after the static Gold Slice reaches the representative quality bar:**
   - Human → Core → PICO choreography;
   - body → body Transfer choreography;
   - Core motion;
   - synchronization/beam/energy FX;
   - broader Transfer Ship content production.

---

## Floor-treatment thesis now binding for TS-01

The Transfer Ship should feel:

> **clean, maintained, inhabited, used, not new, not sterile, not dirty.**

A well-kept family home is a better cleanliness reference than a hospital/showroom.

The Floor pass should not be one global dirt texture. It should combine:

```text
shared Transfer-Ship material family
+ room-specific Ground variation
+ wall/contact AO
+ room/use-specific wear
+ functional FloorFX
```

Production is expected to be predominantly deterministic/M4 after visual source approval:

- semantic room identity chooses the Ground family;
- semantic tile metadata controls connector/topology-safe placement;
- multi-cell spans and structural bands jointly define exact tiling domains;
- Shared Wall Graph/architecture can drive static wall AO;
- activity/traffic zones drive wear masks;
- Flow endpoints drive exact FloorFX bus geometry;
- `LightOverlay` remains actual scene illumination.

Detailed contracts:

- `art-source/recipes/transfer-hall/floor-treatment/recipe.md`
- `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`

---

## Durable production lessons

Before acting on live visual QA, classify the problem:

```text
FUNCTION / SOURCE DESIGN
PERSPECTIVE / STYLE
RUNTIME CROP / SCALE / PADDING
PLACEMENT / ROOM COMPOSITION
MULTI-CELL FIT / STRUCTURAL BAND ALIGNMENT
COLLISION / USE-SPACE
SHADOW / GROUNDING
MOVABLE FX / CHOREOGRAPHY
```

Only the first two normally justify another source generation.

Additional durable rules:

- source design and runtime scale are separate;
- physical scale and Hero prominence are separate;
- do not regenerate an approved source merely to resize it;
- for directional actors, validate connected source/body geometry before tuning shadows;
- use automation to prevent impossible states, then store Human Live QA calibration explicitly as data;
- shadow should be frozen after useful runtime scale and live acceptance converge;
- PNG alpha is not gameplay collision authority;
- shaped collision may preserve transparent whitespace;
- movable components need not use static Prop lifecycle;
- accidental generated iconography is not semantic authority;
- **generated tile pixels are not semantic/topology authority**;
- line-bearing tiles require explicit connectors/continuity metadata before automatic placement;
- room access is not automatically corridor route topology;
- cuttable generated atlases require deterministic full-bleed extraction; presentation gutters/rounded sample frames are not runtime floor art;
- repeated multi-cell surfaces require `spanTiles`, an explicit usable-domain origin and exact divisibility after structural bands are removed;
- never hide a partial macro under wall/perimeter FloorFX; change geometry or author a deliberate remainder treatment instead;
- a room-size change is valid when it is the intentional semantic/layout fix and all geometry regressions are updated explicitly;
- dirt/wear must communicate use/age rather than undirected noise;
- AO/grounding is not scene illumination;
- CI green and merge are not substitutes for deployed Art-Director live acceptance.

---

## After TS-01 Gold Slice acceptance

Once Generated TS-01 passes as the representative quality bar:

1. implement/polish Transfer choreography using accepted Apparatus/Core authorities;
2. decide which art-production patterns become reusable Transfer Ship standards;
3. promote proven room-floor/AO/wear rules into reusable world/archetype rules if they survive QA;
4. promote proven level-design/Prop/tile metadata into reusable world/archetype rule sets;
5. build only additional robot bodies/utility categories needed by next playable content;
6. apply the accepted Actor Grounding Workflow to new directional bodies rather than re-deriving the process ad hoc;
7. stress the compiler with dense PRIMUS, larger ship and larger Bio-Ark/natural floors;
8. expand remaining Transfer Ship beats using compiler + proven art grammar;
9. run explicit Performance & Scale Pass before campaign-scale readiness;
10. write final Agent Authoring Guide last, after workflows stop changing materially.

---

## Deliberately open art/tool questions

Do not silently freeze:

- exact **remaining** Child/Hygiene floor variants until live QA;
- exact AO falloff/opacity values;
- exact wear-mask algorithm/intensity;
- whether room-floor treatment becomes a reusable Level Compiler material-profile system after TS-01 proof;
- whether the semantic tile metadata schema should be generalized beyond current category-specific implementations after another floor family proves it;
- final PRIMUS system-object form;
- exact domestic micro-set needed for finished Family read;
- whether full-room cohesion reveals a concrete need for M3 layered retouching;
- whether later Transfer FX justify a dedicated animation compositor/tool.

Family Living, Main Hall, Transfer Room and PRIMUS floor baselines are no longer open visual targets absent a concrete defect. Directional actor grounding is also no longer open; PICO established the production contract and explicit manual-calibration escape hatch.

---

## Current acceptance discipline

For art:

```text
recipe/method selected
→ source/algorithm produced
→ production QA
→ runtime integration
→ tests/build
→ deployed live QA
→ explicit acceptance
→ recipe/index/status update
```

For directional actor grounding add:

```text
source-integrity analysis
→ connected geometry
→ automated grounding candidate
→ explicit human calibration data
```

before final live acceptance.

For semantic modular floor/tile work add:

```text
tile inventory / semantic contract
→ approved cuttable source or authored material source
→ deterministic extraction/composition
→ per-cell/per-surface metadata incl. spanTiles
→ structural-band subtraction + exact usable-domain fit
→ topology-safe placement
→ regression tests
→ deployed live QA
```

For generated/procedural floor treatment, source approval may be replaced by explicit algorithm/material-variant review when no generative source is used.

For shared compiler/spatial contracts:

```text
contract/spec
→ deterministic implementation
→ automated regression coverage
→ generated TS-01 proof
→ deployed QA
→ explicit live acceptance
```

`Merged` is not `LIVE_ACCEPTED`; `asset accepted` is not `Floor Treatment accepted`; neither is `Gold Slice accepted`.
