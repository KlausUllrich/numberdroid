# Handoff — Numberdroid Studio A1 Technical-Art Foundation

**DATE:** 2026-08-27

**REPOSITORY:** `KlausUllrich/numberdroid`

**STATUS:** A0.1–A0.4 are integrated on `main` but not user-accepted; A1 has not started and this handoff does not authorize implementation or image generation

**BASELINE MAIN HEAD AT CREATION:** `7afb1895f60d47bf2ded413fb49b647d5b36f7e4` (PR #142 merge; tree `7479471e9a2796be426cb086b32b45ac95f76786`)

**BASELINE CI / PAGES STATE:** PR #142 run `33056320620` passed Root Build, Linux Studio/browser evidence, and Windows Studio at exact head `bfdab45416b5da5116a4244c7d632096260452b2`; post-merge run `33056801016` passed Root Build, Linux Studio/browser evidence, Windows Studio, and Pages at exact `main` head `7afb1895f60d47bf2ded413fb49b647d5b36f7e4`

**PRIMARY RECEIVING ROLE:** Technical Artist / Numberdroid Studio product-architecture engineer

**SECONDARY / TRIGGER ROLES:** Artist and User/Art Director for operation and visual-quality decisions; Coordinator/Engineering for domain/application/job/persistence changes; Security/QA for agent authority and Authoring-v2 discovery; UI/UX only after semantic workflow states stabilize; Game/Level Design only when image operations affect authored topology or gameplay semantics

**NEXT MILESTONE / TASK:** A1 planning — inventory proven Numberdroid image-processing needs, propose the smallest typed `ProcessingRecipe` v1 contract and first deterministic fixture, and stop for user approval before implementation

## Why the primary role changes now

A0 established the general project-capability, candidate, query, and safe
EngineBridge boundaries without choosing a speculative image or level DSL. The
next roadmap item is the first complete Artist path:

```text
immutable approved source
→ typed reproducible processing
→ immutable derived artifact + lineage + findings
→ explicit semantic asset input
```

The remaining risk is no longer the A0 adapter boundary. It is accidentally
turning asset-specific scripts, unsafe background removal, arbitrary editor
history, or planned toolkit slots into a false universal processing contract.
Technical Art is therefore primary before any operation vocabulary is frozen.

The user asked to be told before work passes to the next agent. This document is
the transition package only. The receiver MUST first summarize the findings and
propose the bounded A1 block; it MUST NOT begin implementation or generation
until the user explicitly continues across that gate.

## Required reading

Read in this order before proposing or changing code:

1. `AGENTS.md`.
2. `REPOSITORY_STRUCTURE.md`, `docs/agents/ROLE_ENTRYPOINTS.md`,
   `docs/agents/REPOSITORY_WORKFLOW.md`, `docs/README.md`, and
   `docs/agents/HANDOFF_PROTOCOL.md`.
3. The Technical Artist route and its inherited Artist bundle:
   - `docs/art/README.md`;
   - `docs/art/production/ARTIST_AGENT_WORKFLOW.md`;
   - `docs/art/production/ART_ASSET_VALIDATION_RULES.md`;
   - `docs/art/production/ART_ASSET_VALIDATION_PROCESS_ADDENDUM.md`;
   - `docs/art/direction/ART_DIRECTION_TRANSFER_SHIP.md`;
   - `docs/art/production/ART_PRODUCTION_RULES_TRANSFER_SHIP.md`;
   - `docs/art-production-methods/README.md`;
   - `docs/art-production-methods/METHOD_SELECTION_GATE.md`;
   - `docs/art-production-toolkit/README.md`;
   - `docs/art-production-toolkit/CAPABILITY_INDEX.md`;
   - `docs/art-production-toolkit/tools/prop-source-preparation.md`;
   - `scripts/art/toolkit/README.md` and relevant current code under
     `scripts/art/toolkit/`.
4. The selected current Numberdroid floor fixture and semantic guardrails:
   - `art-source/recipes/transfer-hall/floor-treatment/recipe.md`;
   - `art-source/approved/area-01-transfer-ship/floor-treatment/README.md`;
   - `docs/art/production/FLOOR_TILE_METADATA_CONTRACT.md`;
   - the exact approved Family Hygiene source named in the technical block below.
5. Studio direction and binding contracts:
   - `tools/numberdroid-studio/docs/VISION.md`;
   - `tools/numberdroid-studio/docs/REQUIREMENTS.md`, especially `IMG-*`,
     `ATL-*`, `AST-*`, `AGT-*`, and `ARC-*`;
   - `tools/numberdroid-studio/docs/ARCHITECTURE.md`;
   - `tools/numberdroid-studio/docs/MCP_CONTRACT.md`;
   - `tools/numberdroid-studio/docs/ROADMAP.md`, especially A0–A2;
   - `tools/numberdroid-studio/docs/CHECKPOINT_2B_CONTRACT.md`,
     `CHECKPOINT_2B_STATUS.md`, `CHECKPOINT_2C_CONTRACT.md`, and
     `CHECKPOINT_2C_STATUS.md`.
6. Actual current processing and authority code:
   - `tools/numberdroid-studio/packages/domain/src/atlas-definition.js`;
   - `tools/numberdroid-studio/packages/domain/src/command-catalog.js`;
   - `tools/numberdroid-studio/packages/preview/src/index.js`;
   - relevant atlas/job paths in
     `tools/numberdroid-studio/packages/application/src/studio-service.js`;
   - `tools/numberdroid-studio/packages/numberdroid-adapter/src/project-capabilities.js`;
   - `tools/numberdroid-studio/tests/checkpoint-2b-preview.node-test.js` and
     `checkpoint-2b-integration.node-test.js`.
7. The A0 contracts that the new recipe must fit without widening authority:
   - `packages/domain/src/project-capability-manifest.js`;
   - `packages/domain/src/candidate-manifest.js`;
   - `packages/application/src/project-capability-provider.js`;
   - `packages/application/src/engine-bridge.js`;
   - their focused tests.

Paths in items 6–7 are relative to `tools/numberdroid-studio/` when they begin
with `packages/` or `tests/`.

### Do not load initially

Do not initially load the full story/campaign corpus, every art recipe, general
runtime gameplay, all LevelSpec/compiler sources, the A3 actor/logic vocabulary,
Godot/Unreal integration, or the future materialization/publish design. None is
needed to classify image operations and propose the first recipe contract.

Expand only on these triggers:

- **Floor/tile topology:** the floor metadata contract is already mandatory; add
  Level/Runtime context only if an operation changes connector, rotation,
  threshold, span, placement, or topology semantics.
- **Runtime/map integration:** Engineering becomes primary before changing
  `src/`, runtime asset paths, Tiled/GIDs/layers, collision, registries, build
  scripts, or materializers.
- **New visual generation:** follow the hard generation and image-turn gates and
  obtain explicit user authorization before a generation call.
- **Narrative content:** Story/Narrative is triggered only if the selected asset
  depicts a canonical person, event, relationship, sign, message, or story beat.
- **Agent task bitmap jobs or new discovery:** Engineering plus Security/QA are
  mandatory before a SQLite migration, branch-local job authority, or a changed
  Authoring-v2 MCP count/surface.
- **Background removal:** Technical Art plus User/Art Director must first define
  what background is removable and what edge/halo evidence proves safety. The
  current generic Freistellen capability is only planned.

## State at handoff

### Accepted / frozen

- Checkpoints 1–4 are user-accepted. Preserve the one-writer SQLite/CAS model,
  immutable revisions/activity, grants, isolated task branches, explicit review,
  atomic merge/revert, protected UI baselines, and recovery behavior.
- Accepted MCP compatibility remains exactly 19 tools/four templates normally
  and 30 tools/five templates for a matching live task binding. A1 does not
  change those counts without a separately named Authoring-v2 gate.
- Checkpoints 2A–2C accepted the original-source review, exact PNG cutter,
  durable bounded atlas-preview job, explicit slice replacement, typed asset
  proposal/review, and Family Hygiene fixture. Do not rewrite those historical
  contracts to imply general image processing already existed.
- Source bytes and previously accepted derived outputs are immutable. Analysis
  may propose geometry or cleanup, but explicit recipes and exact output pixels
  remain reviewable authority.
- The proven Studio processor is
  `numberdroid-studio.exact-png-crop.v1`: bounded non-interlaced 8-bit RGB/RGBA
  PNG decode, exact integer rectangle crop, canonical RGBA PNG output, and
  deterministic digests.
- The root art toolkit capability index is binding: only `PROVEN` rows exist.
  Generic Freistellen, atlas packing/frame extraction, broad resampling,
  generic halo QA, seamless texture work, and palette QA remain `PLANNED`.
- The proven prop-source preparation tool accepts an already transparent source,
  applies configured low-alpha cleanup, crops surviving alpha, performs
  premultiplied-alpha Lanczos resize, and centers the result on an exact canvas.
  It does not remove an opaque background, infer collision/footprints, create a
  shadow, pack an atlas, or grant visual acceptance.

### Implemented but not accepted

- Checkpoint 4.5 remains integrated but not user-accepted: list/create/detail
  task flow, useful prop preview, persistent room canvas, and explicit
  `VOID`/`BLOCKED` schema-v12 authoring.
- Checkpoint 5 remains a candidate-only Numberdroid snapshot/adapter/canonical
  compiler slice. It has no candidate persistence/approval UI, materialization,
  commit, or publication authority.
- A0.1–A0.4 are integrated through PRs #139–#142 but are not user-accepted:
  - schema-v1 fail-closed `ProjectCapabilityManifest` and Numberdroid profile;
  - injected read-only application capability query, with no new HTTP/MCP/UI;
  - schema-v1 immutable universal `CandidateManifest` and trusted Numberdroid
    projection;
  - schema-v1 `VALIDATE_ONLY`, `CANDIDATE_TO_ENGINE` EngineBridge common
    denominator with no concrete bridge or write authority.
- Current pinned A0 fingerprints are:
  - Numberdroid capability profile:
    `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`;
  - projected universal Numberdroid candidate:
    `4c065dd883eac529129a594c30fe786cb5d9233701791df9e4500d845fa0212b`;
  - unchanged CP5 Numberdroid-specific golden manifest:
    `1aadaedb311eb368819e8ce14a3625f2cdc8af352cbe69aea789d247a464a08e`.

### Planned / not implemented

- A general versioned `ProcessingRecipe` domain contract and operation registry.
- Immutable derived-artifact records that pin complete recipe/processor/input
  lineage outside the accepted exact-slice model.
- Typed trim/padding, canvas normalization, broad deterministic resize,
  safely specified background/alpha cleanup, and atlas/sprite composition or
  slicing beyond current proven bounded implementations.
- Processing preview/review/replacement flows and durable jobs beyond accepted
  `ATLAS_PREVIEW`.
- Ordinary Artist task-branch MCP parity under a separately versioned
  Authoring-v2 discovery gate.
- Branch-local bitmap jobs. The current accepted v8 atlas job ledger is bound to
  authoritative main revisions, and Checkpoint 4 deliberately rejects shared
  intake/preview/commit effects on isolated task branches.
- Any UI redesign, candidate materialization, Git/GitHub/release work, Godot/
  Unreal output, provider integration, or generic image generation.

### Open decisions and owners

| Decision | Safe current default | Decision owner / trigger |
| --- | --- | --- |
| Exact first ordinary recipe operations | Inventory concrete Numberdroid needs and proven processors first; do not claim the complete `IMG-002` set exists | User + Technical Artist before schema freeze |
| First A1 implementation fixture | Use the accepted Family Hygiene crop to prove compatibility; add one transparent-prop fixture only if it proves a distinct needed operation | User + Technical Artist |
| Prop alpha crop/runtime fit as universal operation or adapter/tool capability | Keep it proven but outside Studio ordinary recipes until parameters, limits, processor identity, and Numberdroid evidence are mapped | Technical Artist + Architecture |
| Generic background removal / Freistellen | Remains planned; never treat low-alpha cleanup as opaque-background removal | User/Art Director + Technical Artist before implementation/generation |
| Generic resize/filter contract | No broad operation yet; the prop tool's premultiplied Lanczos path is evidence for transparent Props only | Technical Artist |
| Atlas packing / sprite composition | Keep separate from accepted exact slicing until a concrete Numberdroid asset/runtime need exists | Technical Artist + Runtime when registry/performance changes |
| Branch-local processing jobs | Remain disabled; do not smuggle main-revision jobs into task branches | User + Engineering + Security/QA before persistence design |
| Authoring-v2 MCP surface/counts | Preserve 19/4 and 30/5 until a separate gate pins the new exact contract | User + Security/QA + MCP Engineering |
| Detailed Artist UI | No redesign now; low-fidelity normal/empty/error/conflict/review maps follow stable commands | User + UI/UX after semantic contract |

## Exact technical context

### Accepted Family Hygiene compatibility fixture

- Source path:
  `art-source/approved/area-01-transfer-ship/floor-treatment/source/family-hygiene-floor-2x2__source-approved__2026-08-21.png`
- Media/dimensions: PNG, 1254×1254.
- Bytes: 2,720,519.
- SHA-256:
  `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`.
- Accepted crop grid: 3px outer margin, 4px gaps, four row-major 622×622
  rectangles at `(3,3)`, `(629,3)`, `(3,629)`, and `(629,629)`.
- Each canonical output is 1,548,341 bytes. Exact output digests remain pinned
  in `tools/numberdroid-studio/docs/CHECKPOINT_2B_STATUS.md`.
- Current cutter bounds: at most 64 rectangles, 67,108,864 aggregate output
  pixels, 16 MiB per canonical output, and three job attempts including the
  initial run.
- Current padding policy: `preserve_exact_rect`.

### Proven transparent-Prop processor evidence

Implementation:

- `scripts/art/toolkit/prop-source.mjs`;
- `scripts/art/prepare-prop-asset.mjs`;
- `scripts/art/toolkit/selftest.mjs`;
- `docs/art-production-toolkit/tools/prop-source-preparation.md`.

Current CLI parameters are exact output width/height, transparent margin
(default 3px), and low-alpha cutoff (default 4). These defaults are production
tool facts, not automatically approved universal Studio defaults.

### A0 package and authority boundary

- Universal contracts live in `packages/domain`; application ports/orchestration
  live in `packages/application`; deterministic pixel kernels consume domain
  contracts through `packages/preview`; only `packages/numberdroid-adapter` may
  know Numberdroid schemas/paths/compiler rules.
- Application/domain/preview code must not import Numberdroid internals.
- A `ProcessingRecipe` is evidence and transformation intent, never review,
  approval, destination, repository, materialization, commit, or publication
  authority.
- Candidate manifests already have a typed `recipes` version-pin closure; A1
  must preserve that universal pin rather than embedding scripts or editor logs.
- Do not create an empty `image-module` facade. Introduce a physical module only
  when one real contract, implementation, fixture, and boundary test require it.

### Verification commands

From `tools/numberdroid-studio/`:

```bash
npm ci
npm run check
npm test
npm run evidence:verify
```

Focused existing evidence:

```bash
node --test \
  tests/checkpoint-2b-preview.node-test.js \
  tests/checkpoint-2b-integration.node-test.js \
  tests/package-boundaries.node-test.js
```

Run root toolkit self-tests if the proposal would reuse or change root art tools.
Run root tests/build only if root scripts/runtime are actually changed; a pure
Studio contract slice should avoid that expansion.

## Reusable process decisions

- Generalize only from proven Numberdroid workflows. A roadmap operation name is
  not implementation evidence.
- Separate three classifications before coding: reusable deterministic tool,
  production method with its own authority model, or asset-specific recipe step.
- Model/image analysis may propose crop, bounds, frame, or cleanup. It never
  silently owns accepted semantics or pixels.
- Preserve approved originals and prior derived bytes. Reprocessing creates new
  immutable output/version or an explicit one-to-one replacement mapping.
- Alpha cleanup of an already transparent image is not background removal.
- Resize transparent pixels in premultiplied-alpha space when that operation is
  selected; straight-alpha filtering can introduce matte halos.
- Floor pixels never invent connectivity, collision, or navigation. Semantic
  topology and exact-fit constraints are authored and validated separately.
- A contract-only A1 slice is non-visual. Any new/changed pixel output needs
  deterministic evidence plus before/after human QA; tool success does not make
  an asset `LIVE_ACCEPTED`.
- Preserve accepted UI and MCP counts until separate gates. Do not use UI
  automation as an agent authoring interface.

## Exact next action — A1.0 proposal gate

### First inspection

1. Verify current remote `main`, PR #142 merge, post-merge Actions, open PRs,
   current branch, and complete worktree.
2. Re-run the complete required reading bundle above.
3. Inventory every concrete Numberdroid transformation currently needed and
   classify each as `PROVEN`, asset-specific, or `PLANNED` using actual code,
   recipes, tests, and the toolkit capability index.
4. Compare the accepted exact crop processor and proven transparent-Prop tool
   against `IMG-001`–`IMG-008`, the A0 capability profile, candidate recipe pins,
   current job model, and package-boundary tests.
5. Report any contradiction with newer `main` before proposing a schema.

### First bounded design block

Present the user with one compact operation matrix containing, for each proposed
v1 operation:

- concrete Numberdroid need and fixture;
- proof/status (`PROVEN`, asset-specific, or not implemented);
- typed bounded parameters and defaults, if any;
- supported input/output media, dimensions, alpha/padding semantics, and limits;
- deterministic processor/version identity and digest evidence;
- synchronous versus durable-job threshold;
- structured finding/failure cases;
- what semantic/art authority it explicitly does not grant.

Then propose only the smallest A1.0 implementation slice. The recommended
default is a pure schema-v1 `ProcessingRecipe` contract plus compatibility
projection for the already accepted exact crop processor, unless the Technical
Artist can prove that one additional operation is both required now and already
bounded by production evidence. Do not implement this default before the user
approves the operation matrix and first fixture.

### May change after user approval

- current Studio vision/requirements/architecture/roadmap corrections supported
  by concrete implementation evidence;
- existing domain/application/preview packages and focused tests for one real
  recipe contract/processor;
- Numberdroid capability profile fields needed to truthfully advertise the
  newly proven operation without claiming planned features;
- deterministic fixtures that preserve accepted source/output bytes.

### Must not change in A1.0

- accepted Checkpoint 1–4 behavior, historical contracts, UI layout/CSS, or
  exact MCP discovery counts;
- SQLite schema, branch-local job authority, or remote/mobile/backup state;
- runtime assets, registries, maps, LevelSpec/compiler behavior, runtime paths,
  materializers, Git/GitHub, or release output;
- approved source bytes or prior accepted derived artifacts;
- opaque-background removal, generic resampling/packing, arbitrary scripts,
  editor histories, or generation merely because they appear in `IMG-002`;
- user/owner review, merge, finalization, publication, or visual acceptance
  authority.

### Definition of done for the proposal gate

- the operation inventory distinguishes proven implementation from planned need;
- the user can choose the exact v1 operations and first fixture without hidden
  architecture assumptions;
- every operation has a deterministic authority/parameter/limit/finding boundary;
- accepted crop/asset behavior and A0 authority boundaries remain intact;
- persistence, task-branch jobs, MCP-v2, UI, background removal, and runtime work
  are explicitly deferred or separately gated;
- the receiver stops for user approval before code or image generation.

### Later implementation verification

After the user approves a bounded slice, require deterministic normalization and
fingerprint tests, unknown-version/operation/field rejection, limit and authority
adversarial tests, package-boundary tests, the real pinned Numberdroid fixture,
full Studio tests/check/evidence, Linux and Windows CI, and status docs that say
implemented versus user-accepted truthfully. Pixel-changing slices additionally
require before/after user QA before visual acceptance.

## Cross-role handoff

Technical Art is primary because operation semantics, alpha behavior, filters,
padding, and deterministic pixel evidence must be correct before architecture or
UI can safely expose them. A0 already resolved universal project/candidate/query/
bridge trust boundaries. The receiving role should reuse those constraints, not
reopen them.

Bring Coordinator/Engineering back before adding a new durable job kind,
persistence schema, task-branch bitmap work, or command/query orchestration.
Bring Security/QA back before Authoring-v2 discovery or agent scopes. Bring
Artist/User QA in for operation selection and all pixel acceptance. Bring Runtime
Engineering in only if output paths, registries, maps, collision, rendering, or
materialization change. Bring Game/Level Design in only if an image operation
would alter topology or gameplay meaning rather than pixels alone.

## Receiver launch protocol

1. Verify current `main`, PR #142, post-merge Actions, open PRs, and worktree.
2. Read `AGENTS.md`, the universal bootstrap, and the complete role/task bundle.
3. Inspect actual processor, toolkit, job, capability, candidate, and fixture code.
4. Summarize accepted/implemented/planned state and report authority conflicts.
5. Present the operation matrix and one smallest A1.0 proposal.
6. Tell the user which Technical-Art decisions are still required.
7. Do not implement, generate, migrate, widen MCP, or change runtime output until
   the user explicitly approves the bounded A1.0 block.
