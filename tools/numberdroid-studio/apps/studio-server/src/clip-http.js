import { StudioError } from '../../../packages/domain/src/errors.js';

export async function handleClipHttp({ request, response, url, studioService, humanUiCsrfToken, signal,
  assertHumanUiMutation, readJsonBody, assertExactKeys, humanOwnerContext, humanCommandDto, sendJson }) {
  const sliceRead = /^\/api\/projects\/([^/]+)\/slices\/([^/]+)\/versions\/([1-9][0-9]*)$/.exec(url.pathname);
  const slicePrepare = /^\/api\/projects\/([^/]+)\/slices\/([^/]+)\/revision-preview$/.exec(url.pathname);
  const sliceCommit = /^\/api\/projects\/([^/]+)\/slice-revisions\/([^/]+)\/commit$/.exec(url.pathname);
  const matched = /^\/api\/projects\/([^/]+)\/(clips|clip-proposals)(?:\/([^/]+))?(?:\/(save|resolve))?$/.exec(url.pathname);
  if (!sliceRead && !slicePrepare && !sliceCommit && !matched) return false;
  const route = sliceRead ?? slicePrepare ?? sliceCommit ?? matched, projectId = decodeURIComponent(route[1]);
  const read = Boolean(sliceRead) || Boolean(matched && matched[2] === 'clips' && !matched[4] && matched[3] !== 'resolve-draft');
  const method = read ? 'GET' : 'POST';
  if (request.method !== method) { response.setHeader('allow', method); sendJson(response, 405, { schemaVersion: 1, error: { code: 'METHOD_NOT_ALLOWED' } }); return true; }
  const context = humanOwnerContext(await studioService.readProjectTrusted(projectId));
  if (sliceRead) {
    if (url.search) throw new StudioError('VALIDATION_ERROR', 'Saved-cut reads do not accept query parameters.');
    sendJson(response, 200, await studioService.querySavedSlice({ schemaVersion: 1, projectId, sliceId: decodeURIComponent(sliceRead[2]), sliceVersion: Number(sliceRead[3]) }, context, { signal })); return true;
  }
  if (read) {
    const allowed = ['assetId', 'assetVersion', 'proposalId', 'limit'];
    for (const [key] of url.searchParams) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new StudioError('VALIDATION_ERROR', 'Unsupported clip query parameter.');
    const query = { schemaVersion: 1, projectId, ...Object.fromEntries(url.searchParams), ...(matched[3] ? { assetId: decodeURIComponent(matched[3]) } : {}) };
    for (const field of ['assetVersion', 'limit']) if (query[field] !== undefined) query[field] = Number(query[field]);
    sendJson(response, 200, await studioService.queryClips(query, context, { signal })); return true;
  }
  assertHumanUiMutation(request, humanUiCsrfToken);
  if (url.search) throw new StudioError('VALIDATION_ERROR', 'Clip operations do not accept query parameters.');
  const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
  if (matched?.[2] === 'clips' && matched[3] === 'resolve-draft' && !matched[4]) {
    assertExactKeys(body, new Set(['expectedRevision', 'assetId', 'name', 'kind', 'metadata', 'clip']), 'Clip draft');
    const { expectedRevision, ...resolveDraft } = body;
    sendJson(response, 200, await studioService.queryClips({ schemaVersion: 1, projectId, expectedRevision, resolveDraft }, context, { signal })); return true;
  }
  const common = ['expectedRevision', 'idempotencyKey'], content = ['operation', 'expectedAssetVersion', 'expectedMetadataVersion', 'name', 'kind', 'metadata', 'clip'];
  let type;
  if (slicePrepare) { type = 'slice.revision.prepare'; assertExactKeys(body, new Set([...common, 'sourceSliceVersion', 'expectedSliceVersion', 'expectedAtlasVersion', 'jobId', 'name', 'rectangle']), 'Cut revision preview'); }
  else if (sliceCommit) { type = 'slice.revision.commit'; assertExactKeys(body, new Set([...common, 'sliceId', 'expectedSliceVersion', 'expectedAtlasVersion']), 'Cut revision commit'); }
  else if (matched[2] === 'clips' && matched[3] && matched[4] === 'save') { type = 'clip.save'; assertExactKeys(body, new Set([...common, ...content]), 'Clip save'); }
  else if (matched[2] === 'clip-proposals' && !matched[3] && !matched[4]) { type = 'clip.proposal.submit'; assertExactKeys(body, new Set([...common, ...content, 'assetId', 'proposalId', 'expectedProposalVersion']), 'Clip proposal'); }
  else if (matched[2] === 'clip-proposals' && matched[3] && matched[4] === 'resolve') { type = 'clip.proposal.resolve'; assertExactKeys(body, new Set([...common, 'expectedProposalVersion', 'decision', 'feedback', 'confirmed']), 'Clip resolution'); }
  else throw new StudioError('NOT_FOUND', 'Unsupported Animation route.');
  const { expectedRevision: _revision, idempotencyKey: _key, ...payload } = body;
  if (slicePrepare) payload.sliceId = decodeURIComponent(slicePrepare[2]);
  if (sliceCommit) payload.jobId = decodeURIComponent(sliceCommit[2]);
  if (type === 'clip.save') payload.assetId = decodeURIComponent(matched[3]);
  if (type === 'clip.proposal.resolve') payload.proposalId = decodeURIComponent(matched[3]);
  sendJson(response, 200, await studioService.execute(humanCommandDto(projectId, body, type, payload), context, { signal })); return true;
}
