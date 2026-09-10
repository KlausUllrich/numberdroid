# Library navigation — Approved Design

Status: **DESIGN APPROVED — PASS, 2026-09-10**. Klaus explicitly replied
**“pass”** to the five-item Library mockup batch. Production implementation and
its live acceptance remain separate.

This screen specializes the [Authoring Product Model](AUTHORING_PRODUCT_MODEL.md)
and connects to the approved [Review changes design](REVIEW_CHANGES_DESIGN.md).
The [task router](START_HERE.md) owns implementation sequencing. The accepted
Cutter, Asset and Animation editors remain foundations; the broader Assembly
acceptance record retains its existing scope.

## Goal

Make saved reusable content easy to find, inspect and edit. Give agent changes a
clear review entry point without making proposals or cutting work occupy the
Asset browsing page. Sources introduces and prepares material; Library holds
saved reusable content, including content that will keep evolving.

## Library landing page

Use two sub-navigation points: **Assets** and **Pending changes**. Keep the
project context compact so the useful content starts near the top of the page.
Activity stays in main navigation; do not restore the removed Activity sidebar.

Assets is one inventory of supported Images, Animations and Assemblies. Search
names/source relationships and provide separate **Content** and **Use** filters:
Image/Animation/Assembly describes content, while Surface/Prop/Item describes use.
Do not force an Assembly or Animation into a competing gameplay category or
advertise unimplemented media and roles. Each tab retains its own filter state.
Empty results explain how to clear the filters.

Cards have equally sized preview frames and show the entire image without
cropping or stretching. Default information is the name, useful size/content
summary and saved/pending status. Detailed metadata belongs in the in-app detail
view. Pictures open the full-size preview in a new browser tab; names and
**Details** open the detail view in the current tab. Animation/Assembly cards use
a labelled saved presentation rather than silently running game behavior.

A current Asset preview always shows its saved version while an agent proposes
changes. A pending badge can open the complete related review. Asset filters
narrow discovery, not the review's dependency context: filtering to Assemblies
must not hide the new Animation that a proposed Assembly update needs.

**Add from Sources** routes to source preparation for new image/Animation
content. **Create Assembly** belongs in Library because it starts with saved
reusable components. Saved cuts and cutting work remain in Sources. The approved
mockup demonstrates these entry points; the separate Sources redesign follows
later.

## Detail and return

Show a large whole-content preview, useful size/use/version/source information
and appropriate component or frame summaries. Make a pending-change notice clear
that the displayed content is still the saved version. Open the existing
content-specific editor from the detail view in the production application.

Back restores the originating section, filters, focus and scroll. Opening
Details from Review also retains selected changes, feedback drafts and the
Current/Proposed selection. A trip through Details never discards compatible
editor drafts or silently changes saved content. Unsupported or stale content
must be explained rather than substituted with a newer version.

The isolated mockup links to earlier approved editor mockups in new tabs to
avoid reproducing their tools. That demonstration shortcut does not change the
production requirement for contextual editor navigation and return.

## Pending changes and shared Review

Pending changes lists related review groups with a concise intent, affected
change count, task/agent context, current decision state and **Review changes**.
The tab badge counts groups; rows state their individual change counts.
Avoid permanent large proposal previews in the Asset grid. Sources, Library and
Agent tasks open the same review and saved decisions rather than duplicating
approval ceremonies.

The approved Review screen owns Current/Proposed comparison, dependencies,
selection, feedback, exact acceptance and history. Selection previews reflect
the selected changes. Selecting only a new Animation must not imply that an
unselected Assembly update will be saved. A missing dependency blocks acceptance
with a concrete explanation in reserved space that does not move the preview.

Partial acceptance keeps the same review group, with copy such as
**“1 change left · 1 accepted”**. Reopening it retains the accepted dependency
context and offers decisions only for remaining work. The receipt links to the
saved result and the remaining review. A completed group leaves Pending changes
and remains inspectable through Activity. Completed reviews do not offer new
feedback or discard against already accepted work.

**Request changes** saves actionable feedback and accepts no content. It must
not suggest an agent is running merely because feedback or permission was saved.
Technical correction belongs with the relevant task/preparation until the agent
can deliberately submit reviewable work. If a submitted proposal becomes blocked,
show the concrete problem and responsible next action; preserve inspection and
feedback without sending technical debugging to the owner as an approval task.
**Discard proposal** stays secondary and preserves accepted work and sources.

## Approved artifact and test batch

Artifact directory:
`/home/klaus/.bb/thread-storage/numberdroid-design/`.

| File | SHA-256 |
| --- | --- |
| `library-v1.html` | `a2769eb12ac18ebd90b5bc60f0bf49258f7e9665cf926547fe86b34dacead42d` |
| `library-v1.mjs` | `721d7cd2787c106ef583195ff10d4e7bb162f056743df052c60f71c7cbba95a8` |
| `library-v1.css` | `8b2d5ca485f18899088a1461376c4fede4f14717f4ed880f2ecb227cc8c38734` |

The illustrative SVGs are sample UI artwork under `library-art/`, not accepted
Numberdroid production sources. The mockup mutates only in-page sample data.

Klaus passed this presented batch:

1. Filter Assets, open Details and return with the filters and position retained.
2. Open the whole Transfer apparatus image in a new browser tab.
3. Open the coffee station's two proposed changes, including the dependent
   Animation even when the Library is filtered to Assemblies.
4. Type feedback, inspect change Details and return with the draft retained.
5. Accept only Coffee-ready glow; see one change left and one accepted in the
   same group, then accept the remainder and find the completed review in Activity.

Native mockup checks passed at 1440 and 1060 widths. Focused follow-ups verified
Current/Proposed retention, selection-specific preview and disabled decisions
when a completed review is reopened. Browser profiles closed before cleanup.
These are design checks, not production persistence, agent or milestone evidence.

## Bounded implementation sequence

1. **Library navigation and detail integration.** Implement the Assets/Pending
   changes shell, compact current-content cards, filters, detail/editor return,
   source/Assembly entry points and links to currently supported review records.
   This block must not pretend that separate existing proposals already form an
   atomic mixed-content review or provide unsupported partial acceptance.
2. **Shared Review workflow.** Evolve the applicable command/state/persistence
   contracts for related changes, dependencies, partial pending work and coherent
   acceptance, then connect all entry points to that supported workflow.

Read current consumers and write each block's implementation contract before
changing its source. Preserve old data, exact pins, owner decisions, authority,
idempotent retries and recovery; no visual shortcut may bypass those boundaries.
The [risk policy](../../../docs/agents/CHANGE_RISK_AND_VERIFICATION.md) selects
actual-diff gates. Use focused checks during development and one independent
review pass with the tier-required reviewers at freeze, then exercise the semantic
workflow with a real agent before
Klaus's production batch. Do not repeat accepted editor walkthroughs without a
changed risk or concrete regression. Add a new VT item only once its production
implementation exists.

No Sources redesign, new media, kits/variant-set storage, task Resume repair,
image generation, materialization/export, release or game-behavior editor is
started by this design approval. VT-020/VT-022 and prior accepted foundations
remain protected; VT-001/CP4.5, broader VT-021 and A1.7 keep their separate gates.
