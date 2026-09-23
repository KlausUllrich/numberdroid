# Numberdroid — production authoring session resume

DATE: 2026-09-23
REPOSITORY: `KlausUllrich/numberdroid`
STATUS: Session ending at Klaus's request. Production authoring has begun;
manual Room Save/responsiveness is user-passed. Preserve saved production work.
BASELINE MAIN HEAD AT CREATION: `5409bc81da84e34842244d36dd802fd20431584b`,
tree `edaeb6559f8811d952e82b1319527edfedfb7e52` (pre-handoff baseline;
receiver must re-resolve current `main`).
BASELINE CI / PAGES STATE: PR #273 exact-head Build2543 and post-merge
Build2544 / run `35862571266` green. Root build, Pages and unrequested Windows
correctly skipped. Documentation PR #274 is open, not merged; before this
handoff addition, head `f8d63bac982dabc12dcf468a55b46d4cc72582c1`, tree
`66d468a5cc6e54b4dedfb1360e98eceff65f5f43`, Build2545 / run `35868815997`
green. Resolve the updated PR head and its own CI; do not reuse older green.
PRIMARY RECEIVING ROLE: Coordinator / cross-domain production continuation.
SECONDARY / TRIGGER ROLES: Game Designer for the first actual content brief;
QA / Integrator for saved-state identity; Persistence/Operations for backup;
Artist/Technical Artist/Engineer only for the concrete content or repair slice.
NEXT MILESTONE / TASK: Safely reopen existing Numberdroid work, protect it with
a verified backup, then build the first agreed real game-content slice.

## 1. Read in task order

Complete `AGENTS.md` and its Universal Bootstrap: `REPOSITORY_STRUCTURE.md`,
`docs/agents/ROLE_ENTRYPOINTS.md`, `docs/agents/REPOSITORY_WORKFLOW.md`,
`docs/agents/CHANGE_RISK_AND_VERIFICATION.md`, and `docs/README.md`.
Then read the Coordinator route and these current documents:

1. `tools/numberdroid-studio/docs/START_HERE.md`;
2. `docs/planning/DEVELOPMENT_PLAN_NEXT.md`;
3. `tools/numberdroid-studio/README.md`;
4. `tools/numberdroid-studio/docs/ROOM_EDITOR_L3_STATUS.md`;
5. `tools/numberdroid-studio/docs/O0_BACKUP_RECOVERY_CONTRACT.md` before any
   backup/recovery operation on existing data;
6. `docs/agents/HANDOFF_PROTOCOL.md`, then this snapshot last.

Register the actual selected route under `docs/agents/CODEX_CONTEXT_RETENTION.md`.
Do not load the full historical Studio/art/remote corpus for a simple restart.
Before a content-design decision, activate the Game Designer route and
`docs/game-design/LEVEL_DESIGN_RULES.md`; story changes add the Story route.
Before art production, follow the Artist route, approved sources and exact
recipe. Before a repair, inspect its actual source/tests and triggered contracts.
Remote/mobile, A5/A6 and engine materialization are not initial resume tasks.

## 2. Production decision and acceptance truth

Klaus directed that earlier levels were tests and that from now on real
Numberdroid content is authored while Studio continues to improve. Do not
force another generic pilot or silently freeze existing test layouts as the
final game. Approved art and individual acceptances remain protected.

Accepted/frozen: Checkpoints 1–4 and the bounded recorded acceptances in the
current router, including VT-024/VT-025, Rooms navigation and Surface tools.
The latest explicit **“pass!”** accepts the presented manual-save/responsiveness
bundle: local repeated Move/Rotate, `Unsaved changes`, Discard, explicit checked
Save and reload retention. All Room tools share a local draft; Save checks the
complete Room before one atomic persisted version. Do not restore autosave.

Implemented but not globally accepted: broader VT-001/CP4.5 remains REVISE;
unpresented checks, broader Assembly and other candidate gates stay separate.
Engineering proof and a merge do not invent human acceptance.

Planned/open: automatic backup configuration, the first production-content
brief and eventual Studio-to-runtime materialization. Studio Preview remains
approximate/read-only; the EngineBridge is validate-only. Production authoring
does not grant publication/release, public access, agent activation, provider
egress/cost or image-generation authority. Prop generation still requires the
current message to be exactly the standalone `generieren` command.

## 3. Saved data — do not recreate or reset

The private continuity record `.agent-context/production-transition-20260923.md`
holds local directory paths, project identifiers, startup helper and terminal
details. It is deliberately ignored and not part of repository publication.
If that local record is unavailable, ask the owner for the existing production
directory and verify its saved working-project identity. Do not guess a path,
publish private access links or create a replacement project.

Read-only session-close observation:

| Purpose | Observed saved state |
| --- | --- |
| Production Numberdroid | **r11**; one source, one cut layout, **two Assets in assetLibrary**, and one Room v1, 4×4, zero placements |
| Earlier real-artwork reference | **r132**; the two retained Rooms are v70 and v41 |
| Earlier permanent pilot | Preserved; not reopened or changed in this block. Earlier r34/v17 is historical, not a restore target. |

The production project was created empty earlier this session, **but is no
longer empty**. Its saved Room finding
`studio.room.surface.coverage_incomplete` is an unfinished-content error, not a
new product defect or an instruction to discard the Room. Read the actual
`assetLibrary.assets` collection; the legacy `snapshot.assets` array is empty
and must not be mistaken for an empty Library. Newer saves always supersede
these observed revisions. Never restore an older acceptance snapshot over them.

Production Agent Access was **Off**, with zero grants, bindings and pending
hosts. Pairing is disabled. No production data was committed to GitHub.
Initial empty-project integrity was green; that earlier result does not claim
verification of all later content. **No automatic backups are configured and
this documentation commit is not a database/CAS backup.**

## 4. Source, servers and safe restart

The locally served accepted application has HEAD
`8af8a22acbe8a8c35db569e8986bf38f9d7183e1`; its committed tree exactly matches
the baseline main tree above. Resolve its local worktree from the private
continuity record. Only root/Studio `node_modules` symlinks were untracked.
Preserve them and do not edit a worktree serving live authoring.

The production startup helper pins the existing project ID and reviewed source,
listens on loopback, and drains on Ctrl+C or `q` then Enter. Production and
reference servers both responded during the session-close audit. Their runs
are time-bounded; no shutdown was performed by this documentation task. Resolve
current process state and private access details locally rather than assuming
an earlier terminal or link remains available next session.

Before stopping a server, have the user save any wanted browser-local draft
and resolve an uncertain Save; the saved API cannot observe unsaved UI edits.
Stop only the identified terminal gracefully, confirm exit and clean up its
BB share. A server stop does not delete saved data. Do not kill unrelated
processes or delete worktrees/workspaces as session cleanup.

On resume, first check whether the intended server is still running. Never
start a second writer against the same data. If stopped, use the existing
working-project launcher described in the Studio README: select verified
source and **Open a working project** at the existing production directory.
Do not choose Create, demo or a fixture. The local helper is an alternative
only after rechecking its source path, pinned identity and port. If that
helper/worktree is unavailable, reopen through the supported launcher from
verified compatible source; do not recreate data to work around missing code.
Use the BB CLI/share-server-links skills to start a bounded persistent terminal
and give the newly confirmed private link in the private session, not in Git.
Verify project identity, saved revision/content and Agent Access before any
authoring mutation.

## 5. Repository recovery and checks

Current documentation local branch: `agent/studio-production-transition-local`;
remote branch
`agent/studio-production-transition`, [PR #274](https://github.com/KlausUllrich/numberdroid/pull/274).
The preceding local checkpoint is `4cf6d1b3e47848986c83b0f3d4ae5316f632caa3`;
the final session-close commit follows it. Resolve its exact remote head/CI
from that PR rather than treating the preceding SHA as the handoff commit.
The user's request is **update documents, commit and push**, not an additional
merge request. Do not describe the documentation as merged while PR274 is open.

The thread's older checkout, HEAD `ac73d17a7025cac6b1d55b60e5b5f174b08f020a`,
is not the production source or documentation branch. A checkout merely named
`main` is not proof of freshness; verify its actual tree. Other worktrees may
hold unrelated user changes. No cleanup was performed or authorized by this
pause; resolve exact local paths from the private continuity record.

This closeout is D0 Markdown only. Use explicit timeouts for `git diff --check`
and the repository `repo:docs-check` script, verify exact facts/links and the
updated PR's selected CI. No product suite, browser retest or Windows run is
needed for unchanged application code. Windows remains explicit opt-in only.

## 6. Concrete next block and receiver launch protocol

1. Verify canonical main, PR274's latest head/state and Actions through the
   GitHub connector only. Read the current bootstrap/role bundle, then this
   snapshot. Report any conflict; keep integrated, reviewed and accepted distinct.
2. Resolve actual process, source and saved production identity. Reopen the
   existing Numberdroid project safely; preserve all newer work.
3. Follow the current backup contract to create and verify a non-destructive
   backup before further valuable work/administration. Do not copy a live SQLite
   file by hand, activate a restored copy or claim backup readiness from Git.
4. Continue from the existing source/Assets/Room and discuss their intended role in
   the first real game-content brief. Klaus/Game Design own the actual room
   purpose, objectives and layout; the saved Room alone does not resolve these.
   Reuse approved art and identify only genuinely missing Assets.
5. Complete one useful production slice with relevant checks and a bundled
   designer review. Fix concrete blocking Studio defects; batch minor polish.
   Do not restart generic acceptance tours or use production data for fault tests.

Definition of done for that next block: the correct saved project is retained,
data protection is verified, the first bounded content brief is explicit and
useful real content is saved/reopened. Runtime integration remains a separately
scoped engineering boundary. No image generation, deletion, grant broadening,
public deployment or release follows automatically from resuming.
