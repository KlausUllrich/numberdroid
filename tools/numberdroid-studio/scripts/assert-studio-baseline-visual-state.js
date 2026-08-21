import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const baseUrl = new URL(process.argv[2] ?? 'http://127.0.0.1:4318/');
const evidenceDirectory = resolve(process.argv[3] ?? 'artifacts/studio-visual');
const expectedPath = resolve(
  process.argv[4] ?? new URL('../fixtures/checkpoint-1a/expected-behavior.json', import.meta.url).pathname,
);
const expected = JSON.parse(await readFile(expectedPath, 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path) {
  const response = await fetch(new URL(path, baseUrl));
  assert(response.ok, `${path} returned HTTP ${response.status}.`);
  return response.json();
}

const projects = await getJson('/api/projects');
const listed = projects.projects.find((project) => project.projectId === 'numberdroid-studio-demo');
assert(listed?.revision === expected.observed.revision5.headRevision, 'Baseline project list is not at protected revision 5.');
const project = await getJson('/api/projects/numberdroid-studio-demo');
const activity = await getJson('/api/projects/numberdroid-studio-demo/activity');
assert(project.revision === expected.observed.revision5.headRevision, 'Baseline project API is not at protected revision 5.');
assert(activity.events.length === expected.observed.revision5.activityCount, 'Baseline Activity API count changed.');
assert(project.snapshot.sources.length === expected.observed.revision5.counts.sources, 'Baseline source count changed.');
assert(project.snapshot.assets.length === expected.observed.revision5.counts.assets, 'Baseline Asset count changed.');
assert(project.snapshot.project.status === expected.observed.revision5.projectStatus, 'Baseline project status changed.');
const activityProjection = activity.events.map((event) => ({
  id: event.id,
  actorId: event.actor.id,
  actorKind: event.actor.kind,
  taskId: event.taskId,
}));
assert(
  JSON.stringify(activityProjection) === JSON.stringify(expected.observed.revision5.activity),
  'Baseline Activity ordering or attribution changed.',
);

const baselineState = {
  schemaVersion: 1,
  projectId: project.projectId,
  revision: project.revision,
  activityCount: activity.events.length,
  activity: activityProjection,
  sourceCount: project.snapshot.sources.length,
  assetCount: project.snapshot.assets.length,
  projectStatus: project.snapshot.project.status,
};
await writeFile(join(evidenceDirectory, 'baseline-state.json'), `${JSON.stringify(baselineState, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ status: 'VERIFIED', projectId: project.projectId, revision: project.revision })}\n`);
