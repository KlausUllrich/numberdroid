# A3a typed level-intent and logic-validation kernel status

Status: **SOURCE-INTEGRATED / AUTOMATED GREEN — NOT USER ACCEPTED**

Date: 2026-08-30

A3a is source-integrated through PR #179. The final rebased PR head
`dbc6dabf6d821032c90ef31e87dfa0737fe20f48` passed Build #2264 / run
`33313560001`, merged as `7322542b07907710bbba16e3ffd7d1b2fc6aa5a3`,
and passed post-merge Build #2265 / run `33313888975`. Integration and CI do
not constitute user acceptance.

A3a is the first UI-independent Domain/Application slice of the requirements-
driven level and logic track. It defines portable intent and validation only.
It does not make the reference scenario playable and does not widen any owner,
agent, repository, or release authority.

## Implemented scope

- `packages/domain/src/level-authoring-kernel.js` defines strict schema-v1
  `LevelRequirementSet`, `LevelGraph`, and `LogicGraph` values. Unknown fields,
  versions, kinds, unsafe identifiers, duplicate identities, sparse arrays,
  accessors, symbols, invalid typed values, and unbounded input fail closed.
- Validation returns fresh deeply frozen values. Set-like collections are sorted
  by stable IDs, while semantically ordered paths, routes, trigger actions, and
  bindings retain their declared order.
- Each contract has canonical JSON and a deterministic SHA-256 fingerprint.
  Version/fingerprint pins close `LevelGraph` over its exact requirement set and
  `LogicGraph` over its exact level graph.
- `packages/application/src/level-authoring-validation.js` validates project
  identity, immutable pins, typed references, graph integrity, requirement and
  assumption traceability, required/preferred coverage, coordinate units,
  declared capability modules, and declared vocabulary.
- Findings have stable identities, ordering, explanations, and remediations.
  Errors produce `BLOCKED`; a finding-free or warning-only receipt can be
  `VALID`. The receipt and its coverage/finding collections are deeply frozen
  and fingerprinted.
- The contract fixture closes the intended reference chain: actor defeated →
  key drop → pickup → boolean state change → visible text. It also proves that
  actor bindings, actor-defeated triggers, and drop actions cannot silently
  disagree about the actor.
- A synthetic capability profile validates the complete fixture. The unchanged
  Numberdroid capability profile remains `BLOCKED` with its established
  fingerprint
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`.

## Preserved boundaries

A3a adds no persistence schema or repository, command, query, job, HTTP route,
UI, MCP tool/resource, simulator, runtime execution, Numberdroid capability,
materialization, publication, or release path. The synthetic profile exists in
tests only. No production capability profile is mutated.

The reference chain is contract evidence, not game content and not an accepted
user workflow. Concrete Numberdroid semantics and a playable candidate remain
A4. O2a is separately source-integrated but remains undeployed and unaccepted.

## Verification

Local independent integration verification on 2026-08-30:

- A3a contract and validation focus: **5 passed, 0 failed**;
- A3a plus capability-manifest and package-boundary regression subset:
  **11 passed, 0 failed**;
- Studio JavaScript syntax check: **181 files passed**;
- Studio syntax-checker self-test: passed;
- `git diff --check`: passed.

Repository evidence:

- initial A3a head `8da392473a883d98f79d48b218e1fbe3dd17a1ce`:
  Build #2262 / run `33308934589` — success;
- final O2a-updated head `dbc6dabf6d821032c90ef31e87dfa0737fe20f48`:
  Build #2264 / run `33313560001` — success;
- merge `7322542b07907710bbba16e3ffd7d1b2fc6aa5a3`:
  Build #2265 / run `33313888975` — success.

Automated evidence and source integration do not constitute user acceptance.
A4 remains the next product block.
