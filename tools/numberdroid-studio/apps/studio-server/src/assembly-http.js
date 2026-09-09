import { StudioError } from '../../../packages/domain/src/errors.js';

export async function handleAssemblyHttp({ request, response, url, studioService, humanUiCsrfToken, signal,
  assertHumanUiMutation, readJsonBody, assertExactKeys, humanOwnerContext, humanCommandDto, sendJson }) {
  const matched = /^\/api\/projects\/([^/]+)\/(assemblies|assembly-proposals)(?:\/([^/]+))?(?:\/(save|resolve))?$/.exec(url.pathname);
  if (!matched) return false;
  const projectId = decodeURIComponent(matched[1]);
  const collection = matched[2];
  const id = matched[3] ? decodeURIComponent(matched[3]) : null;
  const action = matched[4] ?? null;
  const read = collection === 'assemblies' && !action && id !== 'resolve-draft';
  const method = read ? 'GET' : 'POST';
  if (request.method !== method) { response.setHeader('allow', method); sendJson(response, 405, { schemaVersion: 1, error: { code: 'METHOD_NOT_ALLOWED' } }); return true; }
  const project = await studioService.readProjectTrusted(projectId);
  const context = humanOwnerContext(project);
  if (read) {
    const allowed = ['assetId', 'assetVersion', 'proposalId', 'limit'];
    for (const [key] of url.searchParams) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new StudioError('VALIDATION_ERROR', 'Unsupported Assembly query parameter.');
    const query = { schemaVersion: 1, projectId, ...Object.fromEntries(url.searchParams), ...(id ? { assetId: id } : {}) };
    for (const field of ['assetVersion', 'limit']) if (query[field] !== undefined) query[field] = Number(query[field]);
    sendJson(response, 200, await studioService.queryAssemblies(query, context, { signal }));
    return true;
  }
  assertHumanUiMutation(request, humanUiCsrfToken);
  if (url.search) throw new StudioError('VALIDATION_ERROR', 'Assembly operations do not accept query parameters.');
  const body = await readJsonBody(request, { maxBytes: 256 * 1024 });
  if (collection === 'assemblies' && id === 'resolve-draft' && !action) {
    assertExactKeys(body, new Set(['expectedRevision', 'assetId', 'name', 'kind', 'metadata', 'assembly', 'selection']), 'Assembly draft request');
    const { expectedRevision, selection, ...resolveDraft } = body;
    sendJson(response, 200, await studioService.queryAssemblies({ schemaVersion: 1, projectId, expectedRevision, resolveDraft, ...(selection ? { selection } : {}) }, context, { signal }));
    return true;
  }
  const common = ['expectedRevision', 'idempotencyKey'];
  const content = ['operation', 'expectedAssetVersion', 'expectedMetadataVersion', 'name', 'kind', 'metadata', 'assembly'];
  let type;
  if (collection === 'assemblies' && id && action === 'save') {
    assertExactKeys(body, new Set([...common, ...content]), 'Assembly save'); type = 'assembly.save';
  } else if (collection === 'assembly-proposals' && !id && !action) {
    assertExactKeys(body, new Set([...common, ...content, 'assetId', 'proposalId', 'expectedProposalVersion']), 'Assembly proposal'); type = 'assembly.proposal.submit';
  } else if (collection === 'assembly-proposals' && id && action === 'resolve') {
    assertExactKeys(body, new Set([...common, 'expectedProposalVersion', 'decision', 'feedback', 'confirmed']), 'Assembly proposal resolve'); type = 'assembly.proposal.resolve';
  } else throw new StudioError('NOT_FOUND', 'Unsupported Assembly route.');
  const { expectedRevision: _revision, idempotencyKey: _key, ...payload } = body;
  if (type === 'assembly.save') payload.assetId = id;
  if (type === 'assembly.proposal.resolve') payload.proposalId = id;
  sendJson(response, 200, await studioService.execute(humanCommandDto(projectId, body, type, payload), context, { signal }));
  return true;
}
