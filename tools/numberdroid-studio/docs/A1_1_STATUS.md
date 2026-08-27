# A1.1 ProcessingResult contract status

Status: **explicitly user-accepted on 2026-08-27**

This is a non-visual, contract-only A1 slice for the already accepted exact-PNG
crop processor. It introduces no new pixel operation and changes none of the
accepted Checkpoint 2B output bytes. Source integration or test success alone
did not create acceptance. The user explicitly accepted this exact bounded
contract at implementation head
`4f555baf4bad41dc3599bde4aceff22e94fee261`; it was then merged through PR
#145 as `a5323636941acdb98342e5d737e358919b8e5fe7`. Acceptance does not broaden
the authority boundary below or accept A1.2 or the complete A1 Artist workflow.

## Implemented scope

- `packages/domain/src/processing-result.js` defines a fail-closed schema-v1
  `studio.processing-result` value. Its canonical JSON SHA-256 is the immutable
  descriptor identity; there is no caller-selected result ID, mutable head,
  version, clock, actor, or lifecycle status.
- One result pins exactly one `ProcessingRecipe` ID, version, and recomputed
  fingerprint, one exact-crop operation and processor, one immutable PNG input,
  and one to 64 ordered derived PNG artifact descriptors.
- Each input/output descriptor records a canonical content address, SHA-256,
  media type, byte size, and dimensions. Output IDs are unique and remain in
  recipe order; distinct IDs may legitimately share one digest through CAS
  deduplication only when all artifact metadata is identical.
- `validateProcessingResult` validates the standalone descriptor, bounded total
  output pixels, normalized findings, references, canonical PNG sizes, and
  content-address syntax. `validateProcessingResultForRecipe` additionally
  closes the recipe pin, operation, processor, complete input descriptor, output
  count/order/IDs, media type, and dimensions against the validated recipe.
- Findings use the existing `ERROR`, `WARNING`, and `INFO` envelope with bounded,
  path-safe text and deterministic ordering. They are evidence only: even an
  empty findings array grants no adoption, approval, or lifecycle authority.
- `createExactPngCropProcessingResult` takes a validated recipe plus the actual
  immutable source bytes, snapshots those bytes once, and runs only the existing
  `numberdroid-studio.exact-png-crop.v1` kernel. It recomputes output hashes and
  lengths, verifies recipe geometry and kernel fingerprints, and confirms the
  canonical PNG encoding before removing all bitmap bytes from the result.
- Recipe validation now also rejects sparse arrays and hidden or symbolic extra
  fields, so relational result validation cannot bypass A1.0's fail-closed
  contract. Valid A1.0 canonical recipe bytes and the pinned fingerprint are
  unchanged.

The three validation levels are intentionally different. Standalone validation
proves a descriptor's internal shape; recipe validation proves relational
closure; the source-bytes builder executes the accepted crop kernel for that
exact input. None is a cryptographic attestation of an external process.

## Pinned Family Hygiene fixture

- source SHA-256:
  `67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`;
- recipe fingerprint:
  `ca939dfd972a0aef6f70016fca20e6d45108e05795c4c705489a3b7decd63c46`;
- processing-result fingerprint:
  `83e784f8e9303bb0832fe89d415cc05c93c56e2e9dd66b0ce04b6a1b79409378`;
- processor rectangle fingerprint:
  `41a48e0c7b695186bd59ea8dbcbe023bf22acee48b2a065d40b1b70b6da4a884`;
- processor derivation fingerprint:
  `3073e797c167b708f534ec3cd9c38db755eb5eeca653475ff794529272c850b5`.

The four outputs remain 622×622 pixels and 1,548,341 bytes each, in recipe
order, with unchanged SHA-256 digests:

1. `ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2`
2. `3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e`
3. `9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526`
4. `a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318`

## Compatibility and authority boundaries

An `artifactUri` in a ProcessingResult is only the canonical address implied by
its digest. It does not prove that an object exists, is retained, is `LIVE`, or
is readable in any CAS. Likewise, `processingResultSha256` fingerprints the
descriptor; it is not a storage receipt or processor attestation. A later
application/persistence boundary must store and revalidate bytes before relying
on availability.

`CandidateManifest` v1 already has compatible recipe pins and artifact
descriptors, so A1.1 does not change that contract. A future explicit candidate
builder may map a ProcessingResult into those fields and use its fingerprint as
provenance. The current Numberdroid adapter must continue to emit no invented
recipe lineage before semantic asset adoption exists.

The accepted Checkpoint 2B job, slice, SQLite, CAS-reference, and apply schemas
remain untouched. Existing rows are not retroactively relabeled as A1.1
ProcessingResults.

After acceptance, A1.2 added compatibility-only serialization hardening to
A1.1 canonical result fingerprints and finding-identity checks: inherited
`toJSON` hooks are ignored. The accepted contract, canonical bytes, normalized
finding order and duplicate semantics, pinned fingerprint, and authority
boundary are unchanged; this hardening does not widen A1.1 acceptance.

## Explicitly outside A1.1 acceptance

- no persisted recipe/result aggregate, CAS write or existence check, durable
  execution/job integration, command/query, SQLite migration, HTTP, MCP, or UI;
- no asset role, semantic adoption, replacement/remap, pivot, review,
  disposition, approval, merge, finalization, destination, materialization,
  repository write, commit, or publication authority;
- no failed/incomplete execution record or second job state machine;
- no trim, canvas normalization, resize, alpha/background cleanup, packing,
  composition, generation, or arbitrary script/editor-history operation;
- no project capability validation and no automatic CandidateManifest or
  Numberdroid adapter integration.

A1.1 acceptance therefore covers only the pure result/evidence seam for A1.0's one accepted
operation. It does not satisfy `IMG-001`–`IMG-008` end to end or complete the A1
Artist path.

## Verification

Verification on 2026-08-27:

- new A1.1 result suite: **8 passed, 0 failed**;
- A1.0/A1.1 plus package-boundary subset: **15 passed, 0 failed**;
- full Studio suite: **327 passed, 0 failed**;
- `npm run check`: passed;
- `npm run evidence:verify`: `VERIFIED`, with the protected Checkpoint 1A
  source manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
