# Numberdroid Studio — Operations, Remote Access & Mobile

Status: **current masterplan track; O0 frozen; O1 and O2a source-integrated and automated green; O1 acceptance and O2 deployment pending**

Date added to the masterplan: 2026-08-25

This plan adds four related product outcomes without accepting Checkpoint 4.5,
promoting the dependent Checkpoint 5 candidate, exposing the local service, or
granting agents wider authority:

1. a simple, trustworthy backup and recovery workflow in the human UI;
2. an always-on Studio service that Klaus can reach from his phone;
3. a practical MCP guide for scoped **Artist** and **Level Designer** work; and
4. a responsive, touch-usable Studio UI for smartphones.

The track is deliberately named rather than assigned a Checkpoint number. Its
gates may progress alongside candidate-only CP5 engineering, but each gate has
its own security, evidence, and user-acceptance boundary.

## 1. Reconciled starting point

- Checkpoints 1–4 are accepted and merged on `main`.
- Checkpoint 4.5 and the Checkpoint 5 candidate-only foundation are green and
  source-integrated into `main` through PR #137 / merge
  `2ead87bdd1f386eb0c3d35265914ac8de161f454`. Neither checkpoint is thereby
  user-accepted; CP4.5 still awaits Klaus's live designer walkthrough.
- O1a and the bounded O1b first UI are source-integrated. PR #176 retained head
  `589a7adaa0cb60b608fbc6ad1aec4df441731d94`, passed Build #2252 / run
  `33300488531`, and merged as
  `ac660f0edab39b7ae8b905cd4193f87f3bf87251`. Post-merge Build #2253 / run
  `33303411344` is fully green. VT-012 and explicit O1 user acceptance remain
  open; those states are not inferred from source integration or CI.
- The integrated Checkpoint 5 candidate has no materialize, commit, publish,
  deployment, or release authority and does not accept CP4.5 by coexistence in
  the same source tree.
- `studio.sqlite` plus the SHA-256 artifact CAS are one consistency unit. The
  service remains the one authoritative writer.
- The O0 implementation base is remote `main`
  `f31a0c2df962b4747ade6119ee6850e40e888186`. Its workspace schema is v13;
  migration `0013` is already owned by processing-result adoption.
- The administration CLI already provides integrity checking, verified full
  backup, backup verification, and restore into a new destination. The UI must
  reuse those application/persistence primitives instead of introducing a
  second copying implementation.
- The accepted human service is loopback-only. Remote access must be a new,
  authenticated deployment adapter; changing the current listener's bind host
  is forbidden.
- The accepted MCP transport is local stdio with private loopback pairing and
  explicit human authorization. A role label is guidance, never authority.

## 2. Product outcome

Klaus can leave Studio running on one controlled machine, open it securely from
an Android phone, understand whether his work is protected, create and verify a
complete backup, and perform normal review/authoring flows without using a
compressed desktop layout.

An authorized agent can connect with no private repository knowledge, discover
its effective scope, follow a concise Artist or Level Designer playbook, submit
reviewable work, and stop at the human-owned decision boundary.

## 3. Hard invariants

1. Remote or browser clients never become authority sources.
2. A complete backup treats SQLite and CAS as one snapshot-consistent unit.
3. Restore never overwrites or automatically replaces the active workspace.
4. Existing backups and restore destinations are never overwritten.
5. A backup or restored copy becomes usable/visible only after complete
   verification; failed staging output is retained or cleaned only by an exact,
   explicit recovery rule and is never mistaken for a valid backup.
6. Recovery-test cleanup can target only the exact generated test copy and can
   never target the active workspace, source backup, or another restored copy.
7. A disconnected browser does not cancel or corrupt a server-side operation.
8. No remote mode exposes an unauthenticated project, artifact, preview,
   backup, job, pairing, or MCP endpoint.
9. The loopback development mode and local stdio MCP remain secure defaults.
10. Role names do not widen human-rooted project/task/branch/object/budget/time
    authority chains. A4c child derivation is local private application authority
    that can only attenuate an active parent; it grants no remote, browser, MCP,
    Pairing, or HostBinding authority.
11. Agents cannot create, verify, recovery-test, restore, clean up, or activate
   workspace backups; approve, merge, perform restore cutover, materialize,
   publish, select arbitrary server paths, or access unrelated work.
12. Healthy state uses plain professional language; IDs, digests, paths,
    revisions, and rule codes remain optional technical details.
13. Smartphone state cannot depend on hover, color alone, or gesture-only
    destructive actions.
14. `CI green`, remote reachability, visually accepted, and production-ready
    remain distinct states.

## 4. Gate O0 — contract, threat model, and test seam

This gate can be completed while Klaus is unavailable for visual testing. Its
frozen decision is
[`O0_BACKUP_RECOVERY_CONTRACT.md`](O0_BACKUP_RECOVERY_CONTRACT.md).

Deliverables:

- one architecture decision covering backup job ownership, destination
  configuration, remote/local deployment separation, authentication/session
  boundary, proxy trust, MCP transport scope, and mobile information hierarchy;
- an exact implementation-base and migration-order decision: the selected
  external operations ledger uses independent control schema v1 outside the
  backed-up workspace and every output root, while O1 allocates no workspace
  migration on the current schema-v13 base (`0014` is only the current next
  semantic slot, not O1 authority);
- an explicit self-snapshot rule: active backup operation state lives only in
  the selected external control ledger and is excluded from workspace
  snapshots; restored copies receive no operation queue, destination registry,
  lease, or source-host resume authority;
- a threat model for workspace loss, mixed SQLite/CAS snapshots, overwrite,
  traversal, confused-deputy access, session theft, direct-port bypass, CSRF,
  stale/replayed commands, leaked paths/credentials, and second-writer startup;
- a reusable adversarial test matrix and deterministic fixtures;
- explicit owner decisions that remain open rather than hidden defaults.

O0 changes no listener, authentication behavior, database schema, or UI. The
linked contract records the selected external-ledger, migration,
self-snapshot/quarantine, state, authority, path, publication, UI, and
adversarial-test decisions required before O1 implementation.

### 4.1 Decisions frozen for O1 code

The linked O0 contract resolves all of these decisions; later implementation
must not reopen them implicitly:

1. **Operation ledger.** External service control ledger, schema v1, outside
   every workspace/output root, with one service-owned control writer,
   fixed SQLite-owned WAL sidecars, a separate lifetime-exclusive SQLite
   process lock, reconstruction rules, snapshot exclusion, and no restored
   resume authority.
2. **Implementation base and migration.** Exact base
   `f31a0c2df962b4747ade6119ee6850e40e888186`, workspace schema v13; O1 has no
   workspace migration and the external ledger writes no semantic project state.
3. **Workspace authority.** Dedicated local human
   `workspace.backup.manage` capability for create/verify/recovery-test/restore;
   a one-use launcher-terminal secret authenticates the local bootstrap. CSRF
   alone, project ownership, task authority, agent grants, and MCP discovery
   cannot imply it.
4. **Destination registry.** Trusted startup configuration supplies disjoint
   service-managed roots; browser/API callers use opaque IDs only. Resolution
   pins containment and same-filesystem identity, rejects links/reparse points,
   case-fold/nesting/TOCTOU drift, and uses fixed manifest filenames. Windows
   proof uses fixed bounded-stdin Win32 root-inspection/publication helpers,
   local NTFS file identity, no reparse or case-sensitive ancestor, and no
   weaker fallback.
5. **Atomic visibility.** Unique same-filesystem stage reservation, durable
   lane-specific closure, complete verification, one service-exclusive
   serialized publisher, immediate final-absence proof, and atomic rename to a
   previously nonexistent final. A failed stage is never a visible backup and
   is never silently reused. One live-CAS-root shared/exclusive barrier covers
   Create plus every destructive mark/sweep path across same-root store objects.
6. **Operation state machines.** Fixed phases, terminal states, backup-health
   states, one serialized effect worker, leases/idempotency, retry/resume policy,
   stale-worker exclusion, and interruption behavior separately for create,
   verify, recovery test, and restore. The first slice omits cancellation rather
   than offer unsafe partial cancellation.
7. **Restored-copy quarantine.** Recovery test writes the fixed marker before
   its internal-purpose read-only open and starts no listener or worker. Every
   durable restored copy carries the same startup-blocking quarantine marker.
   Copied sessions, HostBindings, grants, jobs, and source-host coordinates
   remain inert.
8. **Activation boundary.** Restore-as-copy is not activation. Any later
   cutover requires a stopped original writer, reauthentication, security-state
   rotation/revocation, pre-cutover verification, and rollback record. It is
   outside O1.

O1 is SQLite-only. Protected JSON mode opens no operations ledger, operator
bootstrap, operation route, or worker and remains fail-closed unavailable.

### 4.2 O0 exit criteria

O0 is complete only when:

- one reviewed architecture decision resolves all eight items above;
- the state diagrams and stable failure codes are written;
- the full adversarial matrix below is mapped to test seams;
- package/transport boundaries show that O1a changes no UI, listener, CSS, or
  MCP catalog, while O1b adds only bounded loopback human HTTP/UI surfaces and
  changes neither listener binding nor MCP catalog; and
- the exact implementation base and migration/control-store ownership are
  recorded.

## 5. Gate O1 — trustworthy backup core and human UI

### 5.1 O1a safe autonomous backend candidate

The first implementation block should be non-visual and fail closed:

- introduce a durable human-owned backup operation/job using the existing
  integrity, backup, verify, and restore primitives;
- expose only configured destination references, never caller-supplied server
  filesystem paths;
- support `create`, `verify again`, `restore as a new working copy`, and an
  automated recovery test;
- persist phase, progress, result, sanitized findings, manifest identity,
  artifact count/bytes, and verification/recovery-test timestamps;
- require the dedicated authenticated workspace-operator authority and expose
  no backup/restore tool or resource through MCP;
- make create/verify/restore idempotent and restart-resumable or safely terminal;
- use a unique staging destination and expose the backup/restored copy as usable
  only after complete verification; incomplete output is never silently reused;
- leave deletion, automatic retention cleanup, active-workspace cutover, and
  remote invocation absent;
- prove consistency under concurrent writes, worker/process failure, browser
  disconnect, corruption, duplicate request, and destination conflict.

This backend block can be reviewed and verified by automated tests, but it is
only **implemented candidate — not user accepted**. It cannot satisfy the O1
product gate without the bounded first UI below.

### 5.2 Required adversarial evidence before the UI gate

- exactly one winner for competing workers, duplicate create requests, and
  restore destination reservations;
- same idempotency key plus identical payload returns one operation; changed
  payload is rejected;
- injected process failure after reservation, integrity check, SQLite snapshot,
  each CAS copy boundary, manifest write, verification, durable flush, rename,
  and ledger completion;
- disk-full, permission, read-only filesystem, and durable-flush failure;
- Unix symlink, every Windows reparse tag, non-NTFS or case-sensitive/mixed
  ancestor, traversal, absolute/drive/UNC path, case-fold collision, nested
  live/backup roots, volume/file-ID drift, and directory-swap TOCTOU;
- corrupt, missing, extra, or swapped database/manifest/CAS content at verify and
  restore boundaries;
- concurrent semantic commit, atlas-job discard, reference release, and
  faulted/delayed CAS mark plus sweep through a second same-root store, with the
  backup equal to a complete pre- or post-mutation state and both barrier modes
  released after failure;
- process-death/stale-lease recovery only after both old process locks are
  released, with no live lease takeover and no second publication;
- restore failure leaves no visible final copy and changes no active workspace,
  source backup, or earlier backup;
- recovery-test and restored-copy startup proves no listener, worker, session,
  HostBinding, grant, or copied nonterminal operation becomes active;
- findings/logs/results contain no machine path, token, stack, secret, raw root,
  or destination configuration; and
- MCP discovery remains exactly the accepted 19/30-tool surfaces, while the
  loopback listener and accepted HTTP routes remain unchanged.

### 5.3 O1b required first human UI candidate and gate

Add **Backups** or **Safety & backups** with one dominant action:
**Create backup now**. The normal view answers:

- Is my current work saved?
- When was the last complete verified backup?
- Is there a problem that needs action?
- Can this backup be restored safely?

Each backup exposes **Verify again**, **Test recovery**, and **Restore as a new
working copy**. Success means durably complete and verified, not merely queued.
Technical details may show manifest, counts, size, revisions, and findings
without making them the primary workflow. The candidate exposes no deletion,
retention, activation/cutover, arbitrary path, or remote function.

O1b may be implemented and verified while Klaus is unavailable, but it must
remain labelled **implemented candidate — not user accepted** and receive a
return-test backlog entry. O1 acceptance still requires Klaus's live UI
walkthrough.

The bounded O1b implementation now exists as recorded in
[`O1B_BACKUPS_UI_STATUS.md`](O1B_BACKUPS_UI_STATUS.md), with the return
walkthrough in `VT-012`. Source integration and automated browser evidence do
not close the live gate.

Klaus's acceptance walkthrough must create and verify a backup, pass a recovery
test, restore it as a copy, compare the recovered project, and observe a
deliberately failed/corrupt case without damage to active work or prior backups.

## 6. Gate O2 — always-on private remote service

Preserve two explicit modes:

1. **Local development:** current loopback-only service and local stdio MCP.
2. **Remote service:** separately configured persistent deployment with
   authenticated HTTPS, supervised restart, explicit proxy trust, and durable
   workspace/backup mounts.

Recommended first deployment is one Klaus-controlled Linux host reachable only
through a private encrypted network such as Tailscale. Public registration,
multi-user teams, password-reset email, and public internet exposure are not
part of the first gate.

Remote mode must fail startup when authentication, trusted ingress/TLS policy,
persistent storage, or required secrets are missing. A host or process restart
must not create a second writer. Unauthenticated and direct-port access must
return no project or artifact data.

Remote MCP is not implied. Authenticated Streamable HTTP MCP requires its own
reviewed credential, scoping, revocation, logging, and transport tests. Local
stdio remains supported.

### 6.1 O2a — autonomous private-service backend candidate

O2a is a separate remote-human gateway in front of the unchanged loopback-only
Studio server. It is source-integrated through PR #178 and remains undeployed
and unaccepted. VT-012 may remain open because O2a exposes neither backup
authority nor an O1 acceptance claim.

The first coherent block must:

- target one Klaus-controlled Linux host, one systemd-supervised process, local
  persistent storage, and one exactly configured private HTTPS ingress;
- keep both the existing Studio listener and the gateway upstream on loopback;
- require a canonical external `https://` origin, exactly one trusted local
  proxy hop, real application authentication, server-side sessions, per-session
  CSRF, bounded login attempts, and fail-closed startup configuration;
- use a positive method/path registry so unauthenticated, unknown, and newly
  added routes expose no project, job, activity, artifact, or preview data;
- validate explicit existing persistent roots and mount identities before any
  listener or workspace writer opens;
- prove one lifetime writer, readiness only after complete composition,
  controlled drain/close ordering, restart persistence, and session
  invalidation across restart; and
- keep remote data and previews non-cacheable across logout/session changes.

Even after login, O2a must deny `/api/backups/**`, `/internal/mcp/**`, remote
agent pairing or access mutation, demo/bootstrap authority, arbitrary server
paths, and any route not explicitly registered. It adds no remote backup or MCP
authority, public-internet exposure, mobile redesign, deletion/retention,
restore activation/cutover, materialization, publication, or release. No live
deployment is activated by source integration alone.

## 7. Gate O3 — responsive and touch-usable Studio

O3 room/canvas work depends on the CP4.5 persistent-editor candidate. It may
begin only after CP4.5 acceptance or as a clearly stacked candidate that does
not accept CP4.5. A phone walkthrough cannot silently replace the separate
desktop/designer CP4.5 gate.

Mobile uses a task-oriented hierarchy rather than compressed desktop columns:

1. project/workflow summary;
2. one list;
3. selected detail;
4. contextual actions;
5. optional technical details.

Required phone flows include sign-in/out, project status, sources/assets/props,
tasks and review, rooms/hallways, findings/activity, agent authorization,
backup/verify/restore-as-copy, and ordinary guided room editing. Precision atlas
editing may remain more efficient on desktop, but phone inspection, safety, and
review cannot disappear.

Acceptance targets:

- real Chrome at 360×800, 390×844, and approximately 412×915 CSS pixels;
- no page-level horizontal scrolling or clipped primary action;
- at least 44×44 CSS-pixel primary touch targets;
- no hover-only information or gesture-only state change;
- dialogs remain usable above the virtual keyboard;
- active canvas tool/mode is visible by text/icon and not color alone;
- pan/zoom/paint do not trigger accidental browser navigation;
- polling/reconnect preserve selection, focus, scroll, zoom, open disclosure,
  canvas position, and valid unsaved drafts;
- keyboard and protected desktop behavior remain intact.

Automated evidence supports but cannot replace Klaus's explicit walkthrough on
his phone.

## 8. Gate O4 — practical MCP onboarding and role playbooks

Runtime discovery explains tools; it does not by itself explain a production
workflow or quality bar. Studio therefore needs a scoped getting-started
resource plus concise versioned playbooks.

The first O4 slice must preserve the accepted exact discovery surfaces: 19
tools/four resource templates normally and 30/five for a matching task. It uses
MCP server instructions plus additive versioned guidance inside the already
authorized project/task resources and repository playbooks. A new getting-
started template or tool is a later explicit feature gate with new pinned exact
counts; documentation alone must not make it discoverable.

### Artist

The Artist may inspect art direction and available sources/slices/assets,
prepare source or asset proposals within an exact task, attach useful preview
and lineage evidence, validate/dry-run, and submit for review. The Artist cannot
approve its own source/asset, finalize owner-only state, broaden scope, publish,
or select arbitrary storage paths.

### Level Designer

The first accepted Level Designer guide may demonstrate the existing DRAFT
room/hallway surface. The complete agent-first guide follows the selected
project's capability manifest: it may inspect typed level requirements,
archetypes and finalized asset vocabulary; author layout/rooms/connections,
exact-version placements, actors, routes, pickups, variables, triggers,
conditions/actions, dialogue/text, and supported waves/spawners on its isolated
task branch; validate requirement coverage, bounds, collision, reachability,
logic and adapter/compiler constraints; inspect the preview/diff; build an
immutable candidate; and submit it for human review. The role cannot decide
owner review, merge, revert owner history, activate a recovered copy,
materialize, or publish.

The guide and runtime getting-started surface must cover:

- connection and discovery;
- effective task/scope/budget/expiry and who acts next;
- normal semantic workflow, `dryRun`, versions, and idempotency;
- stale state, denial, budget exhaustion, job failure, requested changes, and
  revocation;
- completion checklist and exact handoff to **Waiting for your review**;
- one minimal and one realistic end-to-end example;
- no real secret, token, private path, or user-specific credential.

A clean agent with no repository context must complete one scoped Artist and
one scoped Level Designer scenario and prove denial of approval, merge,
publication, cross-task access, and post-revocation use. The accepted 19/4 and
30/5 surfaces remain compatibility gates; complete Artist/Level Designer parity
requires a separately versioned Authoring v2 discovery surface with newly pinned
counts.

## 9. Recommended execution order

```text
O0 contract + threat model
→ O1 backup backend and recovery proofs
→ O1 backup UI source integration; VT-012 remains pending
→ O2a private-service backend source integration (complete)
→ O2 deployment/live private-access gate
→ O3 complete phone/touch workflows
→ O4 runtime onboarding + final role guides
```

The local Artist/Level Designer guide may be drafted earlier from accepted MCP
semantics, but its final examples and acceptance wait until the relevant Studio
workflows stop changing.

Stop gates are strict:

- O0 architecture/state/authority/path decisions before O1 code;
- Linux and Windows failure/restart/race proof before backup UI work;
- Klaus's backup UI acceptance before remote backup metadata or backup-operation
  authority, but not before the isolated O2a gateway/backend candidate;
- authenticated/direct-port/single-writer proof before O3 phone completion;
- real Android/Chrome acceptance for O3; and
- accepted local semantic playbooks before any remote MCP transport decision.

## 10. Current autonomous next step

O0 is frozen; O1a/O1b and O2a are source-integrated and automated green.
VT-012 remains **Waiting for your review**, and O2a remains undeployed pending
the deliberate VT-013 host/configuration gate. A3a is also source-integrated
and automated green. A4a/A4b are source-integrated and automated green; the
next UI-independent product block is the private A4c Application candidate path
in `ROADMAP.md`. Its separately authorized derived-child task support is a later
local L3 slice, not Remote MCP work and not a prerequisite.

Do not treat source integration as deployment or acceptance. Remote backup,
remote MCP, responsive mobile completion, deletion/retention, restore
activation/cutover, materialization, publication, and release remain outside
the integrated O2a/A3a boundaries.

## 11. Combined definition of done

The four-outcome track is complete only when:

- Klaus accepts the workflow on a real phone;
- Studio survives host/process restart and remains reachable at the documented
  private address;
- unauthenticated clients receive no project/artifact data;
- a UI-created backup is verified, restored as a copy, and parity-checked;
- injected failures touch neither the active workspace nor prior/source
  backups;
- mobile and protected desktop browser suites are green;
- a clean bounded agent completes the Artist and Level Designer scenarios and
  stops at human review; and
- Linux plus supported Windows/Node 22.17.0 gates remain green.
