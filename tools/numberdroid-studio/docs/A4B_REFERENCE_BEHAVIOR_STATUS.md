# A4b Numberdroid reference-behavior status

Status: **SOURCE-INTEGRATED / AUTOMATED GREEN — NOT USER ACCEPTED**

Date: 2026-08-30

A4b is source-integrated through PR #184. The final PR head
`475280def81cee3371c0a62606a496e846f010bc` and tree
`35cef8d7dc12fd8ed3a9e5cdf5f01ba43e373a66` passed Build #2275 / run
`33341970255`, merged as
`8238d05a29ee6524f6457bfccc315179ee3896b5`, and passed post-merge Build
#2276 / run `33342294000`, including Root, Root browser QA, Studio Linux,
Studio Windows, Pages deployment, and the final CI gate. Integration and CI do
not constitute user acceptance.

## Implemented bounded reference

- Numberdroid `LevelSpec` now retains typed Boolean declarations, immutable
  visible-text references, encounter-Actor archetype pins, initially dormant
  pickups, and the exact `actor-defeated`, `drop-item`, `collect`,
  `set-variable`, `state-change`, and `show-text` source forms required by the
  reference behavior.
- The compiler accepts only the causal Actor-defeated → hidden Pickup drop →
  Pickup collection → Boolean change → visible-text chain. Drop, setter, and
  text actions each require one valid owner; Actor ownership is exact; setter
  and text triggers are once-only with no delay; the setter must change its
  declared initial value.
- Compilation carries the typed program through semantic planning, Tiled
  emission, the runtime script contract, and the existing MetaGame runtime.
  Defeat makes the dropped key available but never grants it. Only later
  collection grants the key, changes the Boolean, and resolves the exact
  immutable visible-text reference.
- Duel return compares the complete transfer candidate against an otherwise
  identical pre-defeat state. The new defeat edge therefore cannot
  accidentally fire movement, zone, or proximity triggers.
- The bounded A4b collections admit at most 512 variables, text references,
  actions, and triggers. One visible-text value admits at most 4,096 code
  units. Exact 512/513 and 4,096/4,097 tests pin those limits.

## Save, display, and authority closure

Save restoration does not trust individually allowlisted downstream state.
Actor-defeated firings are reconstructed from sanitized defeated-Actor facts;
Pickup availability and collection are revalidated; Boolean values
and collect/state trigger firings are reconstructed from those upstream facts.
Visible text is then causally revalidated and either preserved or removed; it
is not synthesized during restore. A valid-ID, valid-type downstream-only
forgery is therefore stripped rather than suppressing legitimate once-only
triggers.

Visible text is rendered as a React text node. Authored HTML-shaped content is
escaped and cannot become markup or script authority.

The additive Numberdroid target profile v3 is pinned at
`6079209041cb71a3e7c8b36ea41796c2e38ea6ef828bf78829e8f0dc4ea3f074`.
The v3 profile is cumulative over v2. Its bounded A4b delta advertises only
the proven A4b modules and vocabulary and permits only real
`encounter` Actors as defeat/drop authority. Staged-Actor authoring remains
explicitly unsupported. The historical v1 and v2 profiles remain
byte-identical at
`826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049` and
`5488df72b2e45c738735d90046cd3c4a7a560a99922936cfeb5a3e84c63fc106`.
The exact compiler authority is
`numberdroid-level-compiler.sha256:01b144303ff217054f01c0dcd85acc3d442a02c1727ad9b01291dcc5c2559ce1`.

A4b-supported actions or triggers whose Actor, Pickup, variable, text, or
linked action is outside the safe A3a projection receive the explicit
`numberdroid.logic.reference-not-projected` gap. They are not mislabeled as
unsupported vocabulary. Actor #513 and compiler-valid non-A3a identifiers are
direct falsification cases.

## Preserved boundaries

A4b adds no task command, candidate persistence, repository write, HTTP or MCP
surface, pairing, HostBinding, agent authority, remote service, backup metadata
or operation, public/Funnel exposure, deletion, retention/cleanup, restore
activation, O3/O4/A5/A6 scope, materialization, publication, or release path.
It does not accept CP4.5/CP5 and does not change VT-012 or VT-013.

The reference fixture is not registered as a playable production Floor. A4b
therefore creates no distinct Klaus live-test surface and adds no `VT-` item.
That absence is not acceptance: the slice remains **not user accepted**.

## Verification

Local and independent evidence on the final tree
`35cef8d7dc12fd8ed3a9e5cdf5f01ba43e373a66` includes:

- combined A4b reference and Numberdroid projection suite: **16 passed, 0
  failed**;
- portable A3a/A4a capability, authority, and projection matrix: **26 passed,
  0 failed**;
- complete Root suite: **224 passed, 0 failed**;
- complete Studio suite: **669 passed, 0 failed, 4 platform skips**;
- Root TypeScript/Vite production build and Studio 220-file JavaScript build:
  passed;
- production-adapter evidence verification: **VERIFIED** with
  `better-sqlite3`;
- exact classifier:
  `root=true`, `root_visual=true`, `studio=true`,
  `studio_visual=false`, `studio_windows=true`, `pages=true`, `full=false`;
- classifier, Markdown-link, Markdown-checker, and Studio syntax-policy
  self-tests: passed;
- compiler/runtime, contract-gap, security/authority, test-scope, and forbidden
  scope reviews: **GO** on the final PR head; and
- `git diff --check`: passed.

Repository evidence:

- final PR head `475280def81cee3371c0a62606a496e846f010bc`:
  Build #2275 / run `33341970255` — success;
- merge `8238d05a29ee6524f6457bfccc315179ee3896b5`:
  Build #2276 / run `33342294000` — success, including Pages.

Automated evidence and source integration do not constitute Klaus acceptance.
A4c is now the next bounded engineering slice. It must use the integrated A4a
projection and A4b behavior to create, validate, compile, preview, diff, and
submit one task-scoped immutable candidate, then stop at **Waiting for your
review** without materialization, repository publication, or release authority.
