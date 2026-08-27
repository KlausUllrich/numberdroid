# A1.0 ProcessingRecipe contract status

Status: **implemented candidate; not user-accepted**

This is a non-visual, contract-only A1 slice. It creates no new image bytes and
does not change the accepted Checkpoint 2B cutter output. Source integration or
test success does not accept A1.0 or any later Artist workflow.

## Implemented scope

- `packages/domain/src/processing-recipe.js` defines a fail-closed schema-v1
  `studio.processing-recipe` value with canonical JSON and SHA-256
  fingerprinting.
- Schema v1 deliberately permits one immutable CAS-backed PNG input and one
  ordered `studio.image.exact-png-crop` operation only. The processor identity is
  fixed to the accepted `numberdroid-studio.exact-png-crop.v1` implementation.
- Input bytes and dimensions use the existing cutter bounds: 16 MiB input,
  4096 px per source dimension, 64 rectangles, 67,108,864 aggregate output
  pixels, and 16 MiB per canonical output.
- Each crop output has a stable `outputId`, explicit integer rectangle, and the
  only proven padding policy, `preserve_exact_rect`. Unknown versions,
  operations, processors, media, fields, references, parameters, duplicate
  output identities, unsafe CAS bindings, and limit violations fail closed.
- The compatibility builder maps an accepted `AtlasDefinition` into pixel-only
  recipe intent. Inclusion selects outputs; pivot and prior-slice replacement
  data are deliberately not copied because a recipe grants no semantic remap
  authority.
- `packages/preview` projects a validated recipe back to the unchanged exact
  crop processor input and binds the expected source byte size in addition to
  its digest, media type, and dimensions.

The pinned Family Hygiene recipe fingerprint is:

`ca939dfd972a0aef6f70016fca20e6d45108e05795c4c705489a3b7decd63c46`

## Preserved compatibility evidence

The accepted source remains the 2,720,519-byte, 1254×1254 PNG with SHA-256
`67b87430b0c78b6bb9b3af5b3a8bc75c9156a38d75b433a1cbbef8fd7979c71e`.
Recipe projection produces the same four 622×622, 1,548,341-byte canonical PNGs
in row-major order, with the unchanged accepted digests:

1. `ef83efbee4b00ec49679f0409ba6f33423729b9d67946ba45f3ab119a91886f2`
2. `3781086c30598cf8c07582f9b830e3343e0e1363f2e7c17d35a6678eeeb41c7e`
3. `9d4c867156c590d372c9c7ef955596c919d717821b65ea992db0e7606cde2526`
4. `a63dceb520a894a3e91e547d93e15d154873f04bb32e0ac8f8354ca7d2150318`

## Explicitly not implemented or authorized

- no persisted recipe aggregate, derived-artifact/result record, output digest
  binding in the recipe definition, structured processing findings, adoption,
  replacement, or review flow;
- no new synchronous execution path, durable job kind, task-branch bitmap work,
  SQLite migration, command/query, HTTP, MCP, or UI surface;
- no trim, canvas normalization, resize, alpha/background cleanup, packing,
  composition, generation, or arbitrary script/editor-history operation;
- no approval, semantic asset binding, merge, finalization, destination,
  materialization, repository write, commit, publication, or visual-acceptance
  authority.

A1.0 therefore proves only the versioned recipe contract and compatibility seam
for the already accepted crop kernel. It does not complete `IMG-001`–`IMG-008`
or the A1 Artist path.

## Verification

Local verification on 2026-08-27:

- new A1.0 contract/fixture suite: **6 passed, 0 failed**;
- A1.0 plus Checkpoint 2B and package-boundary subset: **22 passed, 0 failed**;
- full Studio suite: **319 passed, 0 failed**;
- `npm run check`: passed;
- `npm run evidence:verify`: `VERIFIED`, with the protected Checkpoint 1A
  source manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`.
