import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const baseUrl = new URL(process.argv[2] ?? 'http://127.0.0.1:4317/');
const evidenceDirectory = resolve(process.argv[3] ?? 'artifacts/studio-visual');
const candidateDirectory = join(evidenceDirectory, 'candidate-1b');
const fixture = JSON.parse(await readFile(join(evidenceDirectory, 'candidate-fixture.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path) {
  const response = await fetch(new URL(path, baseUrl));
  assert(response.ok, `${path} returned HTTP ${response.status}.`);
  return response.json();
}

function dataAttribute(html, name) {
  const value = new RegExp(`\\bdata-${name}="([^"]*)"`).exec(html)?.[1];
  assert(value !== undefined, `DOM evidence is missing data-${name}.`);
  return value;
}

const projectList = await getJson('/api/projects');
const listedProject = projectList.projects.find((project) => project.projectId === fixture.projectId);
assert(listedProject, `Live project list is missing ${fixture.projectId}.`);
assert(listedProject.revision === fixture.revision, 'Live project list revision differs from the prepared fixture.');

const project = await getJson(`/api/projects/${encodeURIComponent(fixture.projectId)}`);
const activity = await getJson(`/api/projects/${encodeURIComponent(fixture.projectId)}/activity`);
const access = await getJson(`/api/projects/${encodeURIComponent(fixture.projectId)}/agent-access`);
const assets = project.snapshot.assets;
assert(project.projectId === fixture.projectId, 'Live project identity differs from the prepared fixture.');
assert(project.revision === fixture.revision, 'Live project revision differs from the prepared fixture.');
assert(assets.length === fixture.assetCount, 'Live asset count differs from the prepared fixture.');
assert(activity.events.length === fixture.revision, 'The visual fixture must have one activity event per revision.');
assert(activity.events.at(-1)?.revision === fixture.revision, 'Activity does not reach the visual fixture head.');

const readyAsset = assets.find((asset) => asset.id === 'tile.hygiene.floor.visual-ready');
const processingAsset = assets.find((asset) => asset.id === 'tile.hygiene.floor.clean-a');
assert(readyAsset?.preview?.state === 'READY', 'The full-source visual fixture must be the READY Asset.');
assert(processingAsset?.preview?.state === 'PROCESSING', 'The real hygiene crop must remain PROCESSING.');
assert(assets.filter((asset) => asset.preview?.state === 'READY').length === 1, 'Expected exactly one READY Asset.');
assert(assets.filter((asset) => asset.preview?.state === 'PROCESSING').length === 1, 'Expected exactly one PROCESSING Asset.');
assert(processingAsset.preview.resourceUri === null, 'A crop without generated preview must not expose the full source.');
assert(readyAsset.preview.resourceUri?.startsWith(
  `/api/projects/${encodeURIComponent(fixture.projectId)}/artifacts/sha256/`,
), 'The READY preview must use the same-origin project artifact route.');

const previewResponse = await fetch(new URL(readyAsset.preview.resourceUri, baseUrl));
assert(previewResponse.ok, `READY preview returned HTTP ${previewResponse.status}.`);
assert(previewResponse.headers.get('content-type') === 'image/png', 'READY preview did not retain its verified PNG media type.');
const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
assert(previewBytes.subarray(1, 4).toString('ascii') === 'PNG', 'READY preview response is not a PNG.');

const workspaces = ['overview', 'sources', 'assets', 'rooms', 'levels', 'activity'];
const domEvidence = [];
for (const workspace of workspaces) {
  const path = join(candidateDirectory, 'dom', `${workspace}-1060.html`);
  const html = await readFile(path, 'utf8');
  const observation = {
    workspace: dataAttribute(html, 'visual-workspace'),
    ready: dataAttribute(html, 'visual-evidence-ready'),
    horizontalOverflow: dataAttribute(html, 'horizontal-overflow'),
    visualErrorCount: Number(dataAttribute(html, 'visual-error-count')),
    assetCardCount: Number(dataAttribute(html, 'asset-card-count')),
    readyImageCount: Number(dataAttribute(html, 'ready-image-count')),
    processingFallbackCount: Number(dataAttribute(html, 'processing-fallback-count')),
    policyMode: dataAttribute(html, 'agent-policy-mode'),
    policyState: dataAttribute(html, 'agent-policy-state'),
  };
  assert(observation.workspace === workspace, `${workspace} DOM rendered a different workspace.`);
  assert(observation.ready === 'true', `${workspace} DOM was captured before visual readiness.`);
  assert(observation.horizontalOverflow === 'false', `${workspace} overflows horizontally at 1060px.`);
  assert(observation.visualErrorCount === 0, `${workspace} recorded a browser error.`);
  assert(observation.policyMode === 'execute_scoped', `${workspace} rendered an unexpected effective policy mode.`);
  assert(observation.policyState === 'ACTIVE_EXECUTE', `${workspace} rendered an unexpected effective policy state.`);
  if (workspace === 'assets') {
    assert(observation.assetCardCount === 2, 'Asset DOM does not contain both fixture cards.');
    assert(observation.readyImageCount === 1, 'Asset DOM did not load the authorized preview image.');
    assert(observation.processingFallbackCount === 1, 'Asset DOM lost the processing fallback.');
    assert(html.includes('data-preview-state="PROCESSING"'), 'Asset DOM lacks the explicit PROCESSING state.');
    const readyCard = new RegExp(
      `data-asset-id="${readyAsset.id}"[\\s\\S]*?<\\/article>`,
    ).exec(html)?.[0];
    const processingCard = new RegExp(
      `data-asset-id="${processingAsset.id}"[\\s\\S]*?<\\/article>`,
    ).exec(html)?.[0];
    assert(readyCard?.includes('data-preview-state="READY"'), 'READY preview is attached to the wrong Asset card.');
    assert(readyCard?.includes('<img'), 'READY Asset card does not contain an image.');
    assert(readyCard?.includes(`src="${readyAsset.preview.resourceUri}"`), 'READY Asset card does not reference the authorized preview URI.');
    assert(processingCard?.includes('data-preview-state="PROCESSING"'), 'PROCESSING fallback is attached to the wrong Asset card.');
    assert(!processingCard?.includes('<img'), 'PROCESSING crop must not render the source atlas as an image.');
  } else {
    assert(observation.assetCardCount === 0, `${workspace} unexpectedly rendered Asset cards.`);
  }
  domEvidence.push(observation);
}

const agentHtml = await readFile(join(candidateDirectory, 'dom', 'agent-access-1060.html'), 'utf8');
const agentAccessDom = {
  ready: dataAttribute(agentHtml, 'visual-evidence-ready') === 'true',
  open: dataAttribute(agentHtml, 'agent-panel-open') === 'true',
  horizontalOverflow: dataAttribute(agentHtml, 'horizontal-overflow') === 'true',
  visualErrorCount: Number(dataAttribute(agentHtml, 'visual-error-count')),
};
assert(agentAccessDom.ready, 'Agent access DOM was captured before readiness.');
assert(agentAccessDom.open, 'Agent access popover is not open in its evidence view.');
assert(!agentAccessDom.horizontalOverflow, 'Open Agent access popover overflows at 1060px.');
assert(agentAccessDom.visualErrorCount === 0, 'Agent access evidence recorded a browser error.');
assert(agentHtml.includes('id="agent-access-select"'), 'Header Agent access pull-down is absent.');

assert(access.effectivePolicy.mode === 'execute_scoped', 'Live effective policy is not the scoped demo grant.');
assert(access.effectivePolicy.state === 'ACTIVE_EXECUTE', 'Live effective policy state is not ACTIVE_EXECUTE.');
assert(access.hostBindings.length === 0, 'Visual evidence must not authorize an MCP host.');

const liveState = {
  schemaVersion: 1,
  projectId: project.projectId,
  revision: project.revision,
  activityCount: activity.events.length,
  activityRevisions: activity.events.map((event) => event.revision),
  assetCount: assets.length,
  assetIds: assets.map((asset) => asset.id),
  previewStates: assets.map((asset) => asset.preview.state).sort(),
  readyPreview: {
    assetId: readyAsset.id,
    resourceUri: readyAsset.preview.resourceUri,
    byteSize: previewBytes.length,
    sha256: createHash('sha256').update(previewBytes).digest('hex'),
    width: previewBytes.readUInt32BE(16),
    height: previewBytes.readUInt32BE(20),
  },
  effectivePolicy: {
    mode: access.effectivePolicy.mode,
    state: access.effectivePolicy.state,
    activeHostCount: access.hostBindings.filter((binding) => binding.status === 'ACTIVE').length,
  },
  dom: {
    workspaces: domEvidence,
    agentAccess: agentAccessDom,
  },
};
await writeFile(join(evidenceDirectory, 'live-state.json'), `${JSON.stringify(liveState, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', projectId: project.projectId, revision: project.revision })}\n`);
