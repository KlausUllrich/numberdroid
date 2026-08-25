# Checkpoint 5 candidate-only foundation status

Status: **dependent implementation candidate; not user-accepted**

Branch posture: stacked on the green but still unaccepted Checkpoint 4.5
candidate. This record does not accept or merge either checkpoint and grants no
materialization, Git, GitHub, deployment, release, or publication authority.

## Implemented first slice

- `packages/numberdroid-adapter` freezes one exact FINAL room/archetype version
  plus the exact referenced FINAL/runtime-eligible asset, slice, approved-source,
  adapter-binding, and byte/decoded-dimension CAS verification closure.
- Snapshot and manifest IDs use canonical UTF-8 JSON with sorted object keys and
  one trailing LF. Clock values and attempt IDs are excluded.
- The adapter emits virtual Level Spec, exact Studio-room, and provenance JSON
  plus digest-addressed runtime/source copy descriptors; it never emits bitmap
  bytes or writes repository paths.
- Runtime targets are confined to `public/`; approved sources to
  `art-source/approved/`. Absolute/traversal/backslash paths and exact or
  case-folded collisions fail closed.
- The fixed repository bridge accepts only the exact in-process snapshot object
  branded by the trusted factory, hardcodes the canonical compiler modules,
  fingerprints the complete production
  `src/levelgen` TypeScript surface plus `src/game/types.ts`, and invokes
  `validatePlacementOverrides`, `compileLevelSpec`, and the full
  `compileWorkbenchPlan` with the canonical Prop and Prop Art registries.
- Full Workbench output is checked against each exact Studio prop offset and
  rotation. Studio spans, canonical footprints, rotations, and presentation art
  paths are independently checked.
- Compiler exceptions become stable sanitized findings without stacks, current
  working directories, credentials, or caller-controlled module paths.
- The manifest shows candidate `VERIFIED` or `BLOCKED`; `materialize`, `commit`,
  and `publish` are fixed to `NOT_AUTHORIZED`.

## Intentional fail-closed gaps

- Non-empty `VOID` or `BLOCKED` masks remain visible in `studio-room.json`, block
  the candidate, and skip the misleading rectangular compiler projection.
- Studio entrances remain exact review data; the adapter does not invent
  external semantic spaces.
- Ambiguous hallway orientation and Studio `item` mapping block approval.
- Structural surface assets currently block because Level Spec/runtime has no
  canonical floor-material art/tileset binding; manifesting a PNG alone would
  orphan it from compiled output.
- Canonical Prop art status, shadow dependencies, and exact-fit/placement
  contracts block until they are closed over and fingerprint-pinned losslessly.
- A Studio slice that is not already the exact 64-pixel-per-tile runtime size
  blocks direct copy. No implicit resize or unversioned processing is allowed.
- Candidate persistence, owner review/approval UI, materialization, commit,
  publication, and their recovery ledgers are not implemented in this slice.

## Verification

Local verification on 2026-08-25:

- full isolated Studio suite: **289 passed, 0 failed**;
- Checkpoint 5 adapter plus package-boundary subset: **11 passed, 0 failed**;
- adapter and fixed bridge syntax plus JSON manifests: passed;
- deterministic blocked golden snapshot:
  `d39ce37f66ab2b94620b0ba149d1e414ecdcb797b7a48d133434709c5e196f99`;
- deterministic blocked test-authority manifest:
  `1aadaedb311eb368819e8ce14a3625f2cdc8af352cbe69aea789d247a464a08e`.

The golden intentionally uses a deterministic compiler test authority and is
`BLOCKED` by the honest missing runtime floor-material binding. The
separate root Vitest integration loads the real compiler, fingerprints its
authority files, compiles exact room and Prop locks through the full Workbench,
and checks repeatability. Root dependencies are not installed in the local
Studio-only workspace, so the first pushed candidate must obtain that proof from
the repository CI root job before this record can claim a green combined gate.

## Remaining Checkpoint 5 work

1. Obtain green root and Studio CI for the dependent branch and record the run.
2. Add an immutable persisted export aggregate and candidate-attempt/review
   projection without changing room history.
3. Add the designer candidate preview, findings/remediation navigation, exact
   manifest comparison, and owner approval of one manifest hash.
4. Decide and implement the reviewed canonical Level Spec extension for
   `VOID`/`BLOCKED`, connector-to-level-graph mapping, and any required
   deterministic runtime materializers.
5. Only after separate user authorization, design recoverable materialize and
   commit stages. Production publication remains a further separate decision.
