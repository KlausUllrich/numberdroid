# A4a Numberdroid level-projection status

Status: **SOURCE-INTEGRATED / AUTOMATED GREEN — NOT USER ACCEPTED**

Date: 2026-08-30

A4a is source-integrated through PR #182. The final PR head
`4b2d61ebfb37e280e7819c6c5db7b63ddcb7b6ff` passed Build #2271 / run
`33337454662`, merged as
`e0b2396c31f7f58d500591dbc5c6f9a431d9ef45`, and passed post-merge Build
#2272 / run `33337734484`, including Root, Root browser QA, Studio Linux,
Studio Windows, Pages deployment, and the final CI gate. Integration and CI do
not constitute user acceptance.

The superseded PR run #2270 / `33337354674` found a test-only TypeScript
directive-placement error after all 214 Root tests passed. The final head moved
the existing JavaScript-boundary suppression onto the exact import line; the
complete selected matrix then passed on #2271.

## Implemented scope

- The Numberdroid adapter captures the complete current bounded `LevelSpec` as
  exact plain data, canonical JSON, and SHA-256. Existing rooms, connections,
  props, encounters, staged actors, routes, pickups, zones, triggers, events,
  overrides, flags, runtime metadata, identifiers, tags, and free text remain
  in the Numberdroid closure without normalization loss.
- A strict compiler port pins the exact current Numberdroid compiler closure as
  `numberdroid-level-compiler.sha256:f410926ebe76f57e0cef7e7a6b4e13ddd7ea4829d09b62428de79b3614313713`.
  Override validation and compilation each run twice on fresh frozen inputs;
  mutation, nondeterminism, raw compiler errors, malformed output, and
  serialized/self-rehashed plan forgeries fail closed.
- The exact `numberdroid.compiled-level-spec` plan retains compiler defaults,
  deterministic seeds, Prop metadata, diagnostics, overrides, and runtime
  metadata. The real compiler now includes `runtime` in its semantic plan.
- The safely representable subset projects into A3a requirement, level, and
  logic contracts. Stable graph identities derive from the source identity;
  content fingerprints still change with content. A3a collection limits,
  identifier mismatches, repeated routes, unprojected zone targets, missing
  immutable asset/archetype pins, and the current logic vocabulary remain
  explicit gaps rather than inferred support.
- Every retained source leaf has deterministic `A3A`,
  `NUMBERDROID_CLOSURE`, or `BLOCKED` coverage. Every blocked leaf names a
  declared gap.
- The capability delta is explicitly `NOT_ADVERTISED`. The unchanged production
  profile remains pinned at
  `826a8b7942ccba97393f55efa356525529994ad34189446992a7dff58fe97049`.
  Level requirements/graph are projection-only; actor routes, typed logic,
  dialogue text, `actor-defeated`, `drop-item`, `set-variable`, `show-text`, and
  boolean variables remain blocked pending A4b.

## Bounded hostile-input closure

The adapter rejects proxies, accessors, symbols, custom prototypes, sparse
arrays, cycles, unsafe field names, unknown fields, invalid numbers, and
unbounded values before they can become authority. Source DAG identity is
deliberately flattened because reference identity has no LevelSpec/JSON
semantics.

The source remains bounded to 65,536 code units per text value and 1,000,000
aggregate text code units. The semantic plan has separate finite expansion
limits, including 8,194 compiler diagnostics, 200,000 nodes, 400,000 scalar
values, and 12,000,000 aggregate text code units. The derived serialized
projection allows at most 128,000,000 code units in one canonical closure
string and 256,000,000 aggregate text code units. Those outer limits cover the
maximum six-character JSON escaping and fixed-schema pretty-print overhead
without widening the tighter source/compiler inputs. A regression with 4,096
rooms and 183,000 control-character tags reproduces the former valid-source
false rejection and now completes creation, revalidation, and fingerprinting.

## Preserved authority boundaries

A4a adds no persistence, repository write, task command, UI, HTTP route, MCP
surface, remote service, pairing, HostBinding, agent authority, backup metadata
or operation, public exposure, deletion, retention/cleanup, restore activation,
materialization, publication, or release path. The filesystem-backed compiler
hash helper exists only in tests and is normalized across LF/CRLF checkouts; the
production adapter has no filesystem or network I/O.

A4a does not implement or advertise the A4b reference behavior and does not
create the A4c candidate workflow. It neither accepts CP4.5/CP5 nor changes
VT-012 or VT-013.

## Verification

Local and independent evidence on the final tree
`3e0979769964f747d4d88f1369c1c2c847e09390` includes:

- A4a focused suite: **20 passed, 0 failed**;
- combined A4a/A3a/capability/adapter/package-boundary matrix before the
  final import-layout-only correction: **51 passed, 0 failed**;
- real TS-01, Bio-Ark, and flag fixture pins through the offline Root loader:
  **6 passed, 0 failed**;
- Studio JavaScript syntax: **220 files passed**;
- exact classifier:
  `root=true`, `root_visual=true`, `studio=true`,
  `studio_visual=false`, `studio_windows=true`, `pages=true`, `full=false`;
- Contract-gap, compiler/runtime, security/authority, and test-scope reviews:
  **GO** on the final PR head; and
- `git diff --check`: passed.

Repository evidence:

- final PR head `4b2d61ebfb37e280e7819c6c5db7b63ddcb7b6ff`:
  Build #2271 / run `33337454662` — success;
- merge `e0b2396c31f7f58d500591dbc5c6f9a431d9ef45`:
  Build #2272 / run `33337734484` — success, including Pages.

Automated evidence and source integration do not constitute Klaus acceptance.
A4b is the next bounded engineering slice; A4c remains dependent on it.
