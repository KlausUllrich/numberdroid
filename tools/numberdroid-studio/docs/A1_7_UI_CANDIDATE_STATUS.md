# A1.7 visual review and correction candidate status

Status: **IMPLEMENTED CANDIDATE — NOT USER ACCEPTED**

This bounded L3 candidate presents the separately integrated processing-result
adoption read projection inside the selected Agent task. The successful visible
state is **Waiting for your review**. It does not mean that the task was
submitted for review or that the DRAFT was accepted, merged, promoted,
materialized, published, or released.

The implementation follows the frozen
[`A1_7_STATE_CONTRACT.md`](A1_7_STATE_CONTRACT.md). Its read-only prerequisite
is recorded separately in
[`A1_7_READ_PROJECTION_STATUS.md`](A1_7_READ_PROJECTION_STATUS.md).

## Bounded visible result

The existing task detail now adds one **Processed asset draft** section directly
after **Current step** and before the general task facts. It preserves the
accepted task list/detail hierarchy and adds no workspace, wizard, shell
rewrite, processing operation, or human composer capability.

For one selected task, the section:

- distinguishes unavailable projection, no DRAFT, attributable denied/failed
  attempts, and a durable task-local DRAFT without treating absence as failure;
- makes the latest ordered durable adoption primary and never lets a later
  failed delivery attempt erase it;
- shows the exact task/adoption-scoped PNG with contain/center/checker behavior,
  a useful alt name, dimensions and an explicit no-replacement fallback;
- presents the current eight correction subjects and unresolved warning copy as
  real lists, with raw identifiers and private admission data excluded;
- keeps history and branch/version identifiers behind closed native technical
  disclosures; and
- visibly labels the whole result **implemented candidate — not user accepted**.

The selected adoption read has a five-second browser bound and its own abort,
generation, project and task context. Selection loads only that task's
projection before the detail first renders. Project/task/list changes cancel
stale work without converting an abort into `PROJECTION_UNAVAILABLE`. A
successful empty read alone means `NO_DRAFT`.

## Refresh, accessibility and responsive behavior

An unchanged task/adoption fingerprint retains the existing task and adoption
DOM nodes. A changed projection restores only compatible selected-task context:
focus, text selection, page and local task scroll, native disclosure state, and
review choices whose exact review baseline still matches. Task, Asset, Room,
Cutter and task-composer retention paths remain separate.

The section uses heading, description-list, list, image/fallback and disclosure
semantics. Its layout is two-column where space permits and stacks inside the
existing 1200 px breakpoint, preserving the protected 1440×900 and 1060×900
shell widths without a new minimum width.

## Real fixture and browser evidence contract

`prepare-visual-a1-7-evidence.js` requires an explicit fresh empty directory. It
uses the real Studio service, schema-v13 stores, CAS registration, trusted task
provisioning, HostBinding and the production private Authoring-v2 HTTP transport
to create exactly:

- project `numberdroid-studio-a1-7` at Main revision 2;
- task `task.a1-7.processed-asset-review`, still `ACTIVE`, with `review: null`;
- one committed branch revision 3 processing Asset in lifecycle `DRAFT`;
- one exact 64×64 selected-output PNG, eight correction items and one warning;
- two private retained processing roles, with Main artifact references
  unchanged and no Main `asset_versions` row.

The fixture performs no task submission, owner review/decision, merge,
finalization, lifecycle promotion, materialization, publication, or release.
Its public preview bytes must equal the exact crop produced before server
restart. Fixture JSON, observations, DOM JSON and server logs are scanned for
authority identifiers, digests, CAS/workspace paths and runner paths.

The dedicated Chrome mode produces exactly two screenshots, at 1440×900 and
1060×900. In the same browser session it verifies:

- exact preview pixels and a real invalid-PNG decode fallback, then restores
  the exact READY image;
- no mutation control inside the A1.7 section and GET-only browser transport;
- byte-identical public project, task, adoption and Activity snapshots before
  and after browser interaction;
- unchanged-refresh node identity plus focus, selection, disclosure and
  nontrivial page/task scroll retention;
- a visual-only changed-projection probe that replaces the bounded DOM and
  restores the same compatible context without a server mutation;
- an Accessibility tree scoped to the A1.7 section; and
- no horizontal overflow or browser runtime/network error.

Chrome was not available in the local workspace. The real 1440/1060 browser
bundle was therefore required from CI and was inspected before source
integration was considered verified. This evidence limitation did not make the
automated result a user-acceptance substitute.

## Compatibility and authority boundary

The candidate adds one static browser state module and uses the already
integrated public task/adoption GET resources. It adds no public or private
mutation route, command, scope, HostBinding rule, MCP tool/resource, discovery
entry, capability profile, migration, bundle version, retention root, Main
reference, lifecycle transition, or release operation.

These remain exact:

- legacy command/scope definitions 33/30;
- MCP discovery 19/four, matching-task 30/five, and explicit Authoring-v2
  31/six;
- SQLite schema v13 and portable bundle versions v1-v3; and
- existing Main Asset, task review/merge, Activity, recovery, backup, Room,
  Asset, Cutter and canvas contracts.

Generic pre-existing task controls retain their existing authority outside the
A1.7 section. They are not exercised by the A1.7 fixture or success path.

## Verification and acceptance

At the integrated source checkpoint:

- focused A1.7, CP4.5 and HTTP regression: **17 passed, 0 failed**;
- full Studio regression: **540 passed, 0 failed**;
- JavaScript syntax check: **156 files**, with checker self-test passed;
- real production fixture preparation and fresh-directory refusal: passed;
- protected production-adapter evidence: **VERIFIED** at source-manifest hash
  `7468adf14333c5fe9bce872526223ebf0134fb90ebf33d1ac2f5d809aa680673`;
- graceful CLI SIGTERM shutdown on the fixture workspace: passed; and
- five independent final actual-diff reviews covering Domain/Application,
  Transport/Races, Persistence/Recovery, UI/Accessibility and browser-evidence
  boundaries: **GO**, with no open code finding.

Documentation and classifier results, PR/Actions/source integration, and real
Chrome artifact evidence are recorded at final source freeze in `VT-011` of
[`VACATION_TEST_BACKLOG.md`](VACATION_TEST_BACKLOG.md).

The visual source candidate was integrated through PR
[#169](https://github.com/KlausUllrich/numberdroid/pull/169). Its final tested
head is `ea4079dd9599d10fbe077be092bdc6f558177f5c`, with tree
`a0bcb5115d1bde5d2266ad391ce1dae51bebf0db`, based on verified read-projection
`main` `df2e65a02d1c10ca7de9084539ebc262865f206b`. GitHub created normal merge
commit `2bac6e77d5e8dae8ee88021aaa9dfba7345c5196`.

PR Actions
[#2223](https://github.com/KlausUllrich/numberdroid/actions/runs/33264560427)
completed successfully across classification, Root, Studio Linux/browser,
Studio Windows and CI gate. Its A1.7 artifact
[#9718313654](https://github.com/KlausUllrich/numberdroid/actions/runs/33264560427/artifacts/9718313654)
has digest
`18f7f41a98aecc31d78e74436e65689764ce23410f728a721af703f47e76a890`
and was downloaded and independently reverified as two screenshots. Post-merge
`main` Actions
[#2224](https://github.com/KlausUllrich/numberdroid/actions/runs/33264894733)
also completed successfully across classification, Root, Studio Linux/browser,
Studio Windows, Pages and CI gate. Its independently reverified A1.7 artifact
[#9718416600](https://github.com/KlausUllrich/numberdroid/actions/runs/33264894733/artifacts/9718416600)
has digest
`8df3dc8a9ce333c0e0f7f4b69d42587b49bc067796b64c5fccda4b5b98b893c8`.
Both artifacts contain the same final screenshot hashes:
`cd03a98645cdf71c9d32268482cd1fdc05e8bf8b101d8619dcf8da22c969e8c6`
at 1440×900 and
`b3b838fd4a81332c64d3bd993f4c7eab93ae9b94edfd79a18890eb511647a269`
at 1060×900.

Intermediate PR runs #2218–#2222 were diagnostic, not accepted evidence:
#2218 exposed the older CP4 capture's missing wait for asynchronous task
selection; #2219 exposed CSP-incompatible evidence probes; #2220 and #2221
exposed incompatible text-boundary and task-root scroll restoration; and #2222
passed the full Linux/browser path but exposed Windows `EBUSY` cleanup ordering.
Each finding received the smallest bounded correction before the clean #2223
source freeze.

The final state remains **implemented candidate — not user accepted** and
**Waiting for your review**. Only Klaus can accept or revise the visual and
correction experience in the return test. Automation cannot close that gate.

## Safe rollback

The UI/state module, static allowlist entry, evidence scripts and CI wiring are
additive and create no durable format. Reverting the focused visual candidate
requires no SQLite downgrade, portable-bundle conversion, CAS cleanup,
HostBinding/Grant repair, task repair, Main Asset repair, materialized-file
cleanup, publication rollback, or release rollback. Disposable evidence data
must be confined to its exact fresh temporary directory.
