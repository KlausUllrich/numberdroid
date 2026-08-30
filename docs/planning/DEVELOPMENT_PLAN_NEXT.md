# Numberdroid — Current Development Plan

Status: **current forward plan — updated 2026-08-30 after source integration of the CI-green Studio O1b candidate; VT-012 remains pending and O2a is next**

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
clicks. Human-exclusive authority remains grant issue/revoke, owner review,
merge, recovered-copy activation, repository/engine materialization, and publish.

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
→ separately authenticated O2a private-service backend candidate
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
`ac660f0edab39b7ae8b905cd4193f87f3bf87251`. Source integration and automated
evidence do not record Klaus's live acceptance: `VT-012` remains **NEEDS KLAUS
LIVE**, and O1b remains **source-integrated / automated green — not user
accepted**.

Klaus's current engineering authority removes the earlier global development
stop while that live review is pending. `VT-012` still blocks claiming O1 user
acceptance and blocks remote exposure of backup metadata or backup-operation
authority. It does not block a separately configured O2a private-service
backend candidate, local MCP guidance based on already accepted semantics, or
the UI-independent A3a level-logic kernel.

Current autonomous engineering sequence:

```text
O1b source-integrated; VT-012 retained for later live review
→ O2a private-service backend candidate
→ A3a typed level-logic kernel
→ later O2 deployment, O3 phone, and O4 final onboarding gates with Klaus
```

O2a must add a distinct fail-closed deployment adapter without widening the
accepted loopback listener. Its first block excludes remote MCP, remote backup
reads or mutations, public registration/internet exposure, O3 redesign,
deletion/retention, activation/cutover, materialization, publication, and
release. A3a begins afterward as strict Domain/Application contracts and
validation only; it adds no persistence, UI, MCP advertisement, runtime
execution, materialization, or publication.

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
