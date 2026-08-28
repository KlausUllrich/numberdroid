# Numberdroid — Change Risk and Verification

Status: **binding repository execution, review, and verification policy**

This policy keeps small changes fast without weakening Numberdroid's authority,
compatibility, recovery, or acceptance boundaries. Process cost follows the
highest actual risk in the diff, not the number of lines or the apparent size of
the feature name.

## Non-negotiable rules

- Classification controls planning, review, and verification cost only. It does
  not grant merge authority, user acceptance, owner authority, materialization,
  publication, deployment, or release permission.
- Ambiguity, scope growth, multiple risk axes, an unknown path, or a conflict
  with current authority escalates to the highest applicable tier.
- Existing hard stops, role triggers, accepted schemas, migration checksums,
  MCP surfaces, goldens, evidence fingerprints, and visual/live gates remain
  binding at every tier.
- The implementer and final independent reviewer are different people/agents
  for behavior changes. D0 documentation may use one reviewer when facts or
  links need independent confirmation.
- Do not repeat a broad planning or review pass unless the scope/diff changed
  materially or the prior pass found a substantive issue.

## Adaptive tiers

| Tier | Scope | Targeted superagents | Required local verification |
| --- | --- | ---: | --- |
| **D0 — documentation** | Markdown only; no generated/runtime output, configuration, workflow, executable example, fixture, schema, or acceptance invention | 0–1 | `git diff --check`, changed-link check, exact fact/path/status verification |
| **L1 — portable pure contract** | Additive deterministic Domain value/helper; no I/O, Application port, persistence, public protocol, authority/lifecycle, UI, platform behavior, or pixel effect | 2–3 | focused tests plus relevant syntax/type/boundary/fingerprint checks |
| **L2 — bounded integration seam** | Application port/query/command, compatible private protocol seam, persistence without migration, deterministic processor, adapter/integration boundary | 3–5 | focused tests, relevant complete package/core suite, and triggered protocol/fault/restart/platform checks |
| **L3 — high-risk or visible** | Migration, public MCP/HTTP compatibility change, authority/lifecycle transition, UI/browser behavior, remote/auth, destructive/recovery operation, packaging, materialization/publication, new pixel operation, or multiple risk axes | 5–6 | full relevant suites, platforms, browser/evidence, migration/fault/recovery, security, and applicable human gates |

“Targeted” is binding: use only roles triggered by the change. Every specialist
reads the universal bootstrap, its role bundle, the directly affected authority,
and the actual diff. Do not make every reviewer reread the whole repository.

## Planning and review cadence

For one bounded block:

1. classify the tier and record the reason, promise, exclusions, rollback, and
   any escalation trigger;
2. run one parallel planning pass with only the triggered roles;
3. implement with one writer per shared file area;
4. run tier-required focused verification;
5. run one independent actual-diff review pass;
6. update only directly affected current authority/status plus the compact test
   or vacation backlog;
7. open one focused PR and require all selected PR checks to pass.

Repeat planning/review only after a material scope change or a substantive
finding. Reviewer quantity never overrides a binding contract.

### Cohesive L1 batching

Two to four adjacent L1 microsteps may share one PR when all of them:

- form one testable product promise;
- have the same package owner, authority boundary, compatibility surface, and
  rollback;
- remain pure, portable, additive, and deterministic as a combined diff; and
- introduce no second risk axis.

Otherwise split them. L2 and L3 work is never disguised as an L1 batch.

## Verification economy

- D0 is an allow-list, not “any file that looks textual”: root orientation
  Markdown, `docs/**/*.md`, `art-source/**/*.md`, Studio README/current docs,
  fixture `README.md` files, and the art-toolkit README. JSON, YAML, HTML, CSS,
  SVG, SQL, locks, fixtures, workflow/config files, executable examples,
  symlinks, invalid UTF-8, noncanonical `.MD` suffixes, and unknown locations
  are never D0 automatically. The D0 CI job scans all tracked Markdown so a
  deleted or renamed link target cannot evade incoming-link validation. The
  cheap all-Markdown link/bootstrap scan runs for every workflow classification,
  so deleting a referenced non-Markdown target is covered too.
- Run focused checks first. Do not duplicate full local and CI suites without a
  concrete tier or trigger reason.
- The complete Linux Studio core suite is the default CI floor for Studio code.
  Browser evidence runs only for visible/server/preview/evidence-fixture changes
  or an explicit higher-risk trigger.
- Windows runs for persistence, filesystem, server/CLI/MCP, packaging,
  dependency, script, test, or otherwise unclassified Studio paths. Only the
  classifier's explicit portable Domain/Application contracts and tests use the
  headless Linux-only fast lane; portable Preview work still carries its Linux
  browser trigger.
- Portable test modules use the explicit `*.portable.node-test.js` convention
  when they are not already named by the classifier's protected A0/A1 contract
  family. The suffix is a reviewable portability claim, not authority to hide an
  I/O, UI, protocol, persistence, or platform trigger.
- Numberdroid adapter changes also run the root integration gate because the
  game compiler consumes that package.
- Approved root art bytes consumed directly by protected Studio tests or browser
  fixtures run both root and Studio visual/platform gates; these cross-boundary
  fixture paths are explicit classifier entries.
- Root runtime/build/art changes run the root suite and build. Pages deploys
  only when deployable root inputs changed on `main`. Root test-only and
  repository-helper changes skip grounding-browser evidence and Pages.
- GitHub automation/classifier changes, line-ending policy, an empty/unresolvable diff,
  a manual Build-workflow run, the PR label `ci-full`, and the exact PR-title
  marker `[ci-full]` fail closed to the complete matrix. Adding the label or
  marker starts a fresh classification run.
- Path automation is a lower bound, not permission to under-test. Apply the
  `ci-full` label or `[ci-full]` title marker whenever semantic risk is higher
  than the inferred path risk.

The always-present `CI gate` job verifies that every selected job succeeded;
unselected jobs may be skipped. Do not use workflow-wide Markdown path filters,
because an entirely absent required workflow can remain pending indefinitely.

## Merge and post-merge concurrency

All tier-required local checks and all selected PR checks must be green before a
human-authorized repository merge. After merge, resolve the new exact `main` SHA
and observe its CI. Read-only planning for the next independent block may run in
parallel; dependent implementation/integration waits for the prior post-merge
gate. Any post-merge failure stops that lane and becomes the highest-priority
repair.

`CI green`, `source-integrated`, `live-tested`, and `user-accepted` remain
different states.

## Documentation and handoff cadence

A routine candidate updates directly affected current contracts/status and the
compact decision/test backlog. It does not trigger a repository-wide rewrite or
a full handoff.

Create a full handoff only at a clean milestone, a real session or primary-role
transition, or a stop gate where all useful authorized lanes are blocked.
