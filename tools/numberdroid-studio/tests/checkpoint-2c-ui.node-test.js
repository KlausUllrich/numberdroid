import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appUrl = new URL('../apps/studio-server/public/app.js', import.meta.url);
const stylesUrl = new URL('../apps/studio-server/public/styles.css', import.meta.url);

test('2C Asset Library is additive, ordinal-first, filterable, and keeps exact safe preview provenance', async () => {
  const app = await readFile(appUrl, 'utf8');
  const assetRenderer = app.slice(
    app.indexOf('function renderV2AssetCard'),
    app.indexOf('function renderActivityWorkspace'),
  );
  assert.match(assetRenderer, /article\.className = 'card asset-card asset-v2-card'/);
  assert.match(assetRenderer, /article\.dataset\.assetId = asset\.assetId/);
  assert.match(app, /label: match \? `Slice \$\{match\.ordinal\}` : 'Pinned historical slice'/);
  assert.match(assetRenderer, /Canonical slice ID/);
  assert.match(app, /button\.dataset\.copyCanonical = value/);
  assert.match(assetRenderer, /Search name, ID, or tag/);
  assert.match(assetRenderer, /placementSummary\(asset\.metadata\)/);
  assert.match(assetRenderer, /connectivitySummary\(asset\.metadata\)/);
  assert.match(assetRenderer, /collisionSummary\(asset\.metadata\)/);
  assert.match(assetRenderer, /findingSummary\(asset\.findings\)/);
  assert.match(assetRenderer, /committed r/);
  assert.match(assetRenderer, /sha256:/);
  assert.match(assetRenderer, /Legacy asset inventory/);
  assert.match(assetRenderer, /renderCollection\(snapshot\.assets, 'assets'\)/);

  const safePreview = app.slice(app.indexOf('function safeV2Preview'), app.indexOf('function compactValues'));
  assert.match(safePreview, /encodeURIComponent\(projectId\)/);
  assert.match(safePreview, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(safePreview, /declared\.resourceUri\.startsWith\(safeProjectPrefix\)/);
  assert.match(safePreview, /asset\?\.sliceBinding\?\.digest/);
  assert.doesNotMatch(safePreview, /artifactUri/);

  assert.doesNotMatch(app, /api\/projects\/\$\{encodeURIComponent\(projectId\)\}\/assets`/);
});

test('2C proposal review exposes complete decisions, rejection reasons, accepted-subset apply, and stable evidence hooks', async () => {
  const app = await readFile(appUrl, 'utf8');
  assert.match(app, /section\.dataset\.assetProposal = proposal\.proposalId/);
  assert.match(app, /section\.dataset\.proposalState = proposal\.state/);
  assert.match(app, /article\.dataset\.proposalItem = item\.itemId/);
  assert.match(app, /article\.dataset\.proposalRejectionReason/);
  assert.match(app, /Deterministic findings/);
  assert.match(app, /proposalDiffRows\(item\)/);
  assert.match(app, /A rejection reason is required for/);
  assert.match(app, /Record complete decision/);
  assert.match(app, /Apply accepted subset \(\$\{accepted\}\)/);
  assert.match(app, /Rejected items create no assets/);
  assert.match(app, /expectedProposalVersion: proposal\.proposalVersion/);
  assert.match(app, /decisions,/);
  assert.match(app, /confirm: true/);
  assert.match(app, /\/asset-proposals\/\$\{encodeURIComponent\(target\)\}\/decision/);
  assert.match(app, /\/asset-proposals\/\$\{encodeURIComponent\(target\)\}\/apply/);
  assert.match(app, /response\.projectId !== operationProjectId \|\| response\.revision !== operationRevision \+ 1/);
});

test('2C passive refresh retains dirty decision state, focus, selection, local/page scroll, and one poll owner', async () => {
  const app = await readFile(appUrl, 'utf8');
  const capture = app.slice(app.indexOf('function captureAssetDomState'), app.indexOf('function restoreAssetDomState'));
  const restore = app.slice(app.indexOf('function restoreAssetDomState'), app.indexOf('function sourcePreview'));
  assert.match(capture, /selectionStart/);
  assert.match(capture, /selectionEnd/);
  assert.match(capture, /scrollLeft/);
  assert.match(capture, /scrollTop/);
  assert.match(capture, /window\.scrollX/);
  assert.match(capture, /window\.scrollY/);
  assert.match(restore, /focus\(\{ preventScroll: true \}\)/);
  assert.match(restore, /setSelectionRange/);
  assert.match(restore, /window\.scrollTo/);
  assert.match(app, /preserveAssetDraft = preserveCutterDraft && state\.workspace === 'assets'/);
  assert.match(app, /Proposal changed from .*Your local draft was retained but cannot be submitted/);
  assert.match(app, /state\.assetUi\.dirty/);
  assert.match(app, /projectLoadGeneration/);
  assert.equal((app.match(/setInterval\(/g) ?? []).length, 1, 'The shell must retain one passive project poll owner.');
  assert.match(app, /document\.addEventListener\('keydown', \(event\) => \{\s+if \(cutterDrag\) return;/);
});

test('2C Asset Library remains usable at the protected 1060px layout', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.asset-inventory-grid \{[^}]*overflow: auto/);
  assert.match(styles, /\.proposal-items \{[^}]*overflow: auto/);
  assert.match(styles, /\.proposal-item \{[^}]*grid-template-columns: 140px minmax\(0, 1fr\)/);
  assert.match(styles, /\.proposal-diff \{[^}]*table-layout: fixed/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.asset-filters \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*\.proposal-item \{ grid-template-columns: 112px minmax\(0, 1fr\)/);
}
);
