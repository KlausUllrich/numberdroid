import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startStudioHttpServer } from '../apps/studio-server/src/server.js';
import { prepareAnimationEditorFixture, ANIMATION_FIXTURE_PROJECT } from './prepare-animation-editor-fixture.js';

export const SHARED_REVIEW_UI_PROJECT = ANIMATION_FIXTURE_PROJECT;
export const SHARED_REVIEW_UI_ID = 'review.coffee-package';
export const SHARED_REVIEW_UI_ACTOR = { actor: { id: 'agent.review-fixture', kind: 'agent', displayName: 'Synthetic fixture agent' }, taskId: 'task.review-fixture', grantId: 'grant.review-fixture', branchId: 'branch.main' };
const owner = { actor: { id: 'local.designer', kind: 'human', displayName: 'Local designer' }, taskId: null, grantId: null, branchId: 'branch.main' };
export async function sharedReviewFixtureCommand(running, type, payload, actor = owner) {
  const revision = (await running.studioService.readProjectTrusted(SHARED_REVIEW_UI_PROJECT)).revision;
  const key = `fixture.shared-review.${crypto.randomUUID()}`;
  return running.studioService.execute({ schemaVersion: 1, commandId: key, idempotencyKey: key, type, projectId: SHARED_REVIEW_UI_PROJECT, baseRevision: revision, expectedVersion: revision, payload }, actor);
}
/** Synthetic saved cuts and an authorized fixture actor; never a real-agent workflow claim. */
export async function prepareSharedReviewUiFixture(directory) {
  const dataDirectory = resolve(directory), fixture = await prepareAnimationEditorFixture(dataDirectory);
  const running = await startStudioHttpServer({ dataDirectory, host: '127.0.0.1', port: 0, storeMode: 'sqlite', pairingEnabled: false, operationsConfigurationFilename: null });
  try {
    const project = await running.studioService.readProjectTrusted(SHARED_REVIEW_UI_PROJECT);
    const body = project.snapshot.assetLibrary.assets.find(asset => asset.assetId === 'asset.animation-graphite');
    const clip = project.snapshot.clipLibrary.assets.find(asset => asset.assetId === fixture.clipId);
    const original = project.snapshot.assemblyLibrary.assets.find(asset => asset.assetId === fixture.assemblyId);
    const imagePayload = { assetId: 'asset.review-machine', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: 'Review machine body', kind: 'prop', metadata: structuredClone(body.metadata), image: { mode: 'saved-slice', sliceId: body.sliceBinding.sliceId, expectedSliceVersion: body.sliceBinding.sliceVersion } };
    imagePayload.metadata = Object.fromEntries(Object.entries(imagePayload.metadata).filter(([key]) => ['role','tags','variantGroup','compatibilityGroups','spanTiles','anchor','attachment','rotationPolicy','placement','collision','navigation','runtimeEligible','connectors','continuityProfile','continuityTags','selectionPriority','visualWeight','extensions','spatial'].includes(key)));
    const clipPayload = { assetId: 'clip.review-brewing', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: 'Review brewing display', kind: 'prop', metadata: structuredClone(clip.metadata), clip: structuredClone(clip.clip) };
    const assembly = structuredClone(original.assembly);
    assembly.components.find(component => component.componentId === 'component.body').content.asset = { assetId: imagePayload.assetId, assetVersion: 1, metadataVersion: 1 };
    assembly.components.find(component => component.componentId === 'component.display').stateOverrides.find(value => value.stateId === 'state.brewing').content.asset = { assetId: clipPayload.assetId, assetVersion: 1, metadataVersion: 1 };
    const assemblyPayload = { assetId: 'assembly.review-coffee', operation: 'create', expectedAssetVersion: 0, expectedMetadataVersion: 0, name: 'Review coffee station', kind: 'prop', metadata: structuredClone(original.metadata), assembly };
    await sharedReviewFixtureCommand(running, 'grant.issue', { grantId: SHARED_REVIEW_UI_ACTOR.grantId, agentId: SHARED_REVIEW_UI_ACTOR.actor.id, taskId: SHARED_REVIEW_UI_ACTOR.taskId, branchId: 'branch.main', scopes: ['project.read', 'review.proposal.submit'], objectScopes: [{ kind: 'project', id: SHARED_REVIEW_UI_PROJECT }], budget: { maxCommands: 20, maxJobs: 0, maxArtifactBytes: 0, maxCostCents: 0 } });
    const submission = { reviewId: SHARED_REVIEW_UI_ID, expectedReviewVersion: 0, title: 'Coffee station and its components', items: [
      { itemId: 'assembly', contentKind: 'assembly', payload: assemblyPayload, dependsOn: ['image', 'animation'] },
      { itemId: 'image', contentKind: 'image', payload: imagePayload, dependsOn: [] },
      { itemId: 'animation', contentKind: 'animation', payload: clipPayload, dependsOn: [] },
    ] };
    await sharedReviewFixtureCommand(running, 'review.proposal.submit', submission, SHARED_REVIEW_UI_ACTOR);
    const result = { ...fixture, reviewId: SHARED_REVIEW_UI_ID, submission, revision: (await running.studioService.readProjectTrusted(SHARED_REVIEW_UI_PROJECT)).revision, fixtureOnly: true };
    await writeFile(resolve(dataDirectory, 'shared-review-ui-fixture.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    return result;
  } finally { await new Promise((done, reject) => running.server.close(error => error ? reject(error) : done())); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error('Usage: prepare-shared-review-ui-fixture.js NEW_DATA_DIRECTORY');
  process.stdout.write(`${JSON.stringify(await prepareSharedReviewUiFixture(process.argv[2]))}\n`);
}
