# A1.3 project-bound adoption preflight status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

A1.3 is a non-visual L2 Domain/Application candidate based on verified `main`
head `dcf85b36f7b68d9b88d314cdccb49287dc70bdc8`. It closes one accepted
`ProcessingRecipe` → `ProcessingResult` → `AssetInputSelection` chain against
an exact capability pin, one read-only project Asset observation, and two
project-scoped CAS observations. It returns a deterministic immutable receipt;
it never creates, updates, approves, adopts, persists, or authorizes an Asset.
Automated tests, review, source integration, and CI do not constitute Klaus's
contract acceptance.

## Implemented scope

- `packages/domain/src/processing-adoption-preflight.js` defines strict
  schema-v1 request and receipt contracts, canonical LF-terminated JSON, and
  SHA-256 identities. The whole untrusted input graph is snapshotted before
  accepted A1 validators run; proxies, accessors, custom prototypes, symbols,
  sparse arrays, cycles, inherited serialization hooks, unknown fields, and
  unbounded graphs fail closed.
- A request closes the complete accepted Recipe/Result/Selection values, exact
  project ID/revision, exact capability-manifest identity and fingerprint, the
  dedicated validate operation
  `studio.asset.processing-result-adoption-preflight@1`, and either `create`
  coordinates `0/0` or positive exact `update` Asset/metadata versions.
- Capability support requires exact `studio.asset@v2` and
  `studio.image-processing@v1` modules, exact v1 recipe/result/selection input
  formats, and the v1 receipt output format. Broad module presence is not
  treated as operation support. The current Numberdroid profile v1 therefore
  deterministically returns `PROCESSING_ADOPTION_CAPABILITY_UNSUPPORTED`
  before Asset or CAS ports are called.
- The application service has only three read dependencies: the existing
  capability provider, a strict Asset-state reader, and a strict artifact
  verifier. A1.3 supplies the two new port contracts and test fakes only; it
  does not wire them to `StudioService`, SQLite, the production CAS, HTTP, MCP,
  or the Numberdroid adapter.
- Asset evidence distinguishes `UNUSED`, legacy-only occupation, an exact V2
  head, and ambiguous legacy/V2 identity. `create` requires unused identity;
  `update` requires the exact expected V2 kind, Asset version, metadata
  version, project, and project revision.
- The verifier selection reveals only project, revision, fixed role, and
  digest. For both `recipe-input` and `selected-output`, returned evidence must
  independently prove a registered project reference, registered metadata in
  `LIVE`, and matching physical digest/media type/byte size/dimensions. Missing,
  non-live, corrupt, stale, or descriptor-drift evidence blocks preflight.
- A valid result `ERROR` blocks before read ports. `WARNING` remains fully
  fingerprint-bound and is carried as `UNRESOLVED`; A1.3 neither accepts nor
  dispositions it. Malformed protocol values throw without manufacturing a
  receipt. Dependency failures are sanitized, and cancellation is rechecked
  before and after every await.
- Receipt validation independently re-derives every capability, Asset, and
  artifact status from the closed observations and enforces the fixed
  short-circuit order. Caller-declared `SUPPORTED`, `MATCHED`, or `VERIFIED`
  labels cannot manufacture a passing receipt. A missing configured capability
  profile is a deterministic blocker, not an implied fallback.
- Every receipt says `READ_ONLY`, `NOT_GRANTED`, `NONE` Asset mutation, and
  `REQUIRED_AT_MUTATION` revalidation. It contains no actor, task, branch,
  grant, clock, destination, review, lifecycle, materialization, repository,
  or publication authority. A passing preflight is an observation, not a
  lease, lock, command, approval, or time-of-use guarantee.

The pinned synthetic generic-profile v2 fixture identities are:

- request: `edbcc5deddec9a49eba30a8a42f315722c833c96504ec74e14944599379fd840`;
- passing receipt: `fe6e897d4eec5a770fc6b79a25dd812d31f183de69a518f932c4926ca83b66fb`.

These are contract fixtures, not Numberdroid capability or product acceptance
evidence.

## Preserved compatibility

- Current Numberdroid capability profile v1 remains byte-identical at
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`.
- A1.0 recipe, A1.1 result, and A1.2 selection fingerprints and the four
  accepted Family Hygiene output bytes/digests are unchanged.
- Command definitions remain 33; SQLite migrations remain 12; the only job
  kind remains `ATLAS_PREVIEW`; ordinary MCP discovery remains exactly 19
  tools/four templates and matching-task discovery remains 30/five.
- CandidateManifest v1, EngineBridge v1, Numberdroid adapter/compiler goldens,
  CP2C `ExactSliceBinding`/`AssetProposal`, persisted schemas, public transport,
  UI, and accepted visual evidence are untouched.

## Explicitly not implemented or authorized

- no semantic Asset adoption command, mutation, idempotency key, unit of work,
  task-branch policy, owner decision, review, lifecycle, or warning disposition;
- no persistence model, migration, artifact reference write, retention lease,
  lock, race resolution, or production port adapter;
- no registered command/query, durable job, MCP resource/tool, HTTP endpoint,
  UI state, or visual acceptance;
- no Numberdroid profile v2 advertisement, CandidateManifest/adapter mapping,
  `ExactSliceBinding` reuse, new pixel operation, materialization, repository
  write, publication, release, or end-to-end satisfaction of `IMG-006`.

A1.4 must revalidate all observations inside any later atomic mutation boundary;
it cannot treat this receipt as authorization or a concurrency guarantee.

## Verification

Local Node 22.17.0 verification on 2026-08-28:

- new A1.3 contract/service suite: **10 passed, 0 failed**;
- focused A1/Capability/Asset/CAS/package-boundary suite: **76 passed, 0 failed**;
- full Studio suite: **346 passed, 0 failed**;
- `npm run check`: passed after documentation finalization;
- production-adapter evidence verification: `VERIFIED`, with protected source
  manifest hash unchanged at
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- repository Markdown link check and `git diff --check`: passed.

The first ambient Node 24 full-suite attempt lacked installed runtime
dependencies. A lockfile install under the project's pinned Node 22.17.0
runtime restored the intended environment and the complete suite then passed.
This setup diagnostic is not product evidence. PR, implementation head, source
integration, and required GitHub Actions facts are recorded in VT-004 when
available; none will change this candidate-only acceptance state.
