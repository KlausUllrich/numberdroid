# A1.2 AssetInputSelection contract status

Status: **implemented candidate; not user-accepted**

A1.2 is a non-visual, pure contract-only slice based on exact `main` head
`a5323636941acdb98342e5d737e358919b8e5fe7`. It records inert selection intent
for one exact ProcessingResult output as the fixed `primary-visual` input of an
explicitly caller-selected `surface`, `prop`, or `item`. It does not create,
adopt, update, approve, or finalize an Asset. Acceptance of A1.0 and A1.1 does
not accept A1.2; tests, CI, review, source integration, or a PR merge would not
constitute user acceptance.

## Implemented scope

- `packages/domain/src/asset-input-selection.js` defines fail-closed schema-v1
  `studio.asset-input-selection`, canonical JSON, and SHA-256 descriptor
  identity.
- The descriptor pins the ProcessingResult schema, kind, and complete
  fingerprint; recipe ID, version, and fingerprint; operation and processor;
  the complete unchanged input artifact descriptor; and exactly one selected
  output descriptor.
- `surface`, `prop`, and `item` are frozen into this schema version. The fixed
  `primary-visual` role is compatible with the existing kebab-case candidate
  role grammar without integrating with CandidateManifest.
- Standalone validation proves only the descriptor's exact shape and internal
  artifact coherence. Relational validation additionally reconstructs and
  compares every result, recipe, operation, input, and selected-output pin
  against a complete validated ProcessingResult.
- The pure contract builder requires caller-explicit `processingResult`,
  `outputId`, and `assetKind`, normalizes the standalone ProcessingResult
  descriptor, recomputes its fingerprint, resolves the output by ID, copies all
  descriptors, and deeply freezes the normalized selection. It does not prove
  recipe execution, source/output bytes, CAS availability, or attestation.
- Within A1.2-owned selection and builder envelopes, required values must be
  enumerable own data fields. Unknown, symbolic, hidden, inherited,
  accessor-backed, proxied, sparse, unsupported, or incoherent values fail
  closed before caller-defined proxy traps run. The nested ProcessingResult
  argument is first handled by its separately accepted A1.1 validator and then
  copied into A1.2-owned records.
- Compatibility-only hardening makes the A1.0 recipe, A1.1 result, atlas
  rectangle, A1.1 finding-identity, and A1.2 selection fingerprint paths ignore
  inherited `toJSON` hooks. Canonical bytes, finding order and duplicate
  semantics, and all pinned fingerprints remain unchanged.
- Findings remain bound through the complete ProcessingResult fingerprint. A
  result containing an `ERROR` finding may still be selected because selection
  records intent only and grants no adoption or warning-disposition authority.

The pinned Family Hygiene selection fingerprint for output
`rect.family-hygiene.0.0` as a `surface` is:

`d32d2c38315fe8cf2a2c8a7463e83c4815cd1e9156587041cf8cb563c0526ce0`

## Preserved compatibility

- A1.0 recipe fingerprint remains
  `ca939dfd972a0aef6f70016fca20e6d45108e05795c4c705489a3b7decd63c46`.
- A1.1 result fingerprint remains
  `83e784f8e9303bb0832fe89d415cc05c93c56e2e9dd66b0ce04b6a1b79409378`.
- The four accepted Family Hygiene output bytes and digests are unchanged.
- CandidateManifest v1, the Numberdroid adapter, Checkpoint 2C
  `ExactSliceBinding`/`AssetProposal`, the active capability profile, command
  and job catalogs, SQLite migrations, MCP surfaces, and accepted checkpoint
  evidence are untouched.

## Explicitly not implemented or authorized

- no semantic adoption command and therefore no end-to-end satisfaction of
  `IMG-006`;
- no Asset ID/version/name/metadata, replacement, pivot, collision, navigation,
  connectors, review, approval, warning disposition, or lifecycle transition;
- no project, revision, actor, task, branch, grant, clock, or destination;
- no CAS read/write/existence/retention/`LIVE` proof and no processor
  attestation;
- no persistence, jobs, commands, queries, SQLite migration, MCP, HTTP, or UI;
- no capability-manifest/profile, CandidateManifest, Numberdroid-adapter,
  `ExactSliceBinding`, or `AssetProposal` integration;
- no new image operation, materialization, repository write, merge,
  publication, or release authority.

The first project-scoped consumer must separately decide capability/profile
versioning, authorization, CAS revalidation, findings policy, persistence,
idempotency, and semantic Asset versioning. A1.2 grants none of those decisions.

## Verification

Local verification on 2026-08-27:

- new A1.2 contract suite: **7 passed, 0 failed**;
- A1.0/A1.1/A1.2 plus capability, candidate-adapter, and package-boundary
  subset: **40 passed, 0 failed**;
- full Studio suite: **336 passed, 0 failed**;
- `npm run check`: passed;
- `npm run evidence:verify`: `VERIFIED`, with the protected Checkpoint 1A
  source manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
