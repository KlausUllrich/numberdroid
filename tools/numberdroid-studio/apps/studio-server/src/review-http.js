import { StudioError } from '../../../packages/domain/src/errors.js';

/** Owner-only routes are explicit. Preview uses the read service and saves nothing. */
export async function handleReviewHttp({ request, response, url, studioService, humanUiCsrfToken, signal,
  assertHumanUiMutation, readJsonBody, assertExactKeys, humanOwnerContext, humanCommandDto, sendJson }) {
  const legacy = /^\/api\/projects\/([^/]+)\/legacy-reviews\/(image|animation|assembly)\/([^/]+)(?:\/(preview))?$/.exec(url.pathname);
  if (legacy) {
    if ((legacy[4] && request.method !== 'POST') || (!legacy[4] && request.method !== 'GET')) {
      response.setHeader('allow', legacy[4] ? 'POST' : 'GET'); sendJson(response, 405, { schemaVersion: 1, error: { code: 'METHOD_NOT_ALLOWED' } }); return true;
    }
    const projectId = decodeURIComponent(legacy[1]), contentKind = legacy[2], proposalId = decodeURIComponent(legacy[3]);
    const context = humanOwnerContext(await studioService.readProjectTrusted(projectId));
    let query;
    if (legacy[4]) {
      assertHumanUiMutation(request, humanUiCsrfToken);
      if (url.search) throw new StudioError('VALIDATION_ERROR', 'Legacy preview does not accept query parameters.');
      query = await readJsonBody(request, { maxBytes: 16 * 1024 });
      assertExactKeys(query, new Set(['expectedProposalVersion', 'selectedItemIds', 'selection', 'expectedRevision', 'includeHistory']), 'Legacy Review preview');
    } else {
      for (const [key] of url.searchParams) if (!['expectedProposalVersion', 'includeHistory'].includes(key) || url.searchParams.getAll(key).length !== 1) throw new StudioError('VALIDATION_ERROR', 'Unsupported legacy Review query parameter.');
      query = Object.fromEntries(url.searchParams);
      if (!/^[1-9][0-9]*$/.test(query.expectedProposalVersion ?? '')) throw new StudioError('VALIDATION_ERROR', 'Use an exact positive proposal version.');
      query.expectedProposalVersion = Number(query.expectedProposalVersion);
      if (query.includeHistory !== undefined) {
        if (!['true', 'false'].includes(query.includeHistory)) throw new StudioError('VALIDATION_ERROR', 'includeHistory must be true or false.');
        query.includeHistory = query.includeHistory === 'true';
      }
    }
    const { expectedProposalVersion, ...options } = query;
    sendJson(response, 200, await studioService.queryLegacyReview({ schemaVersion: 1, projectId,
      legacySource: { contentKind, proposalId, expectedProposalVersion }, ...options }, context, { signal })); return true;
  }
  const match = /^\/api\/projects\/([^/]+)\/reviews(?:\/([^/]+))?(?:\/(feedback|accept|discard|preview))?$/.exec(url.pathname);
  if (!match) return false;
  const projectId = decodeURIComponent(match[1]), reviewId = match[2] ? decodeURIComponent(match[2]) : null, action = match[3];
  const read = request.method === 'GET' && !action;
  if ((!action && !['GET', 'POST'].includes(request.method)) || (action && request.method !== 'POST') || (request.method === 'POST' && reviewId && !action)) {
    response.setHeader('allow', action ? 'POST' : reviewId ? 'GET' : 'GET, POST');
    sendJson(response, 405, { schemaVersion: 1, error: { code: 'METHOD_NOT_ALLOWED' } }); return true;
  }
  if (studioService.durableReviewStoreReady !== true) throw new StudioError('REVIEW_STORE_DISABLED', 'Shared Review requires the complete SQLite v18 service.');
  const context = humanOwnerContext(await studioService.readProjectTrusted(projectId));
  if (read) {
    const allowed = ['reviewVersion', 'limit', 'includeHistory'];
    for (const [key] of url.searchParams) if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1) throw new StudioError('VALIDATION_ERROR', 'Unsupported shared Review query parameter.');
    const query = { schemaVersion: 1, projectId, ...(reviewId ? { reviewId } : {}), ...Object.fromEntries(url.searchParams) };
    for (const key of ['reviewVersion', 'limit']) if (query[key] !== undefined) { if (!/^[1-9][0-9]*$/.test(query[key])) throw new StudioError('VALIDATION_ERROR', 'Review versions and limits must be positive integers.'); query[key] = Number(query[key]); }
    if (query.includeHistory !== undefined) { if (!['true', 'false'].includes(query.includeHistory)) throw new StudioError('VALIDATION_ERROR', 'includeHistory must be true or false.'); query.includeHistory = query.includeHistory === 'true'; }
    sendJson(response, 200, await studioService.queryReviews(query, context, { signal })); return true;
  }
  assertHumanUiMutation(request, humanUiCsrfToken);
  if (url.search) throw new StudioError('VALIDATION_ERROR', 'Review operations do not accept query parameters.');
  const body = await readJsonBody(request, { maxBytes: ['preview', 'accept', 'discard'].includes(action) ? 16 * 1024 : 1024 * 1024 });
  if (action === 'preview') {
    assertExactKeys(body, new Set(['reviewVersion', 'selectedItemIds', 'includeHistory', 'expectedRevision', 'selection']), 'Review preview');
    sendJson(response, 200, await studioService.queryReviews({ schemaVersion: 1, projectId, reviewId, ...body }, context, { signal })); return true;
  }
  const common = ['expectedRevision', 'idempotencyKey', 'expectedReviewVersion'];
  const decisionCommon = [...common, 'legacySource'];
  let type;
  if (!reviewId) { type = 'review.proposal.submit'; assertExactKeys(body, new Set([...common, 'reviewId', 'title', 'items']), 'Review proposal'); }
  else if (action === 'feedback') { type = 'review.feedback.save'; assertExactKeys(body, new Set([...decisionCommon, 'summary', 'itemComments', 'confirmed']), 'Review feedback'); }
  else if (action === 'accept') { type = 'review.accept'; assertExactKeys(body, new Set([...decisionCommon, 'selectedItemIds', 'confirmed']), 'Review acceptance'); }
  else if (action === 'discard') { type = 'review.discard'; assertExactKeys(body, new Set([...decisionCommon, 'confirmed']), 'Review discard'); }
  else throw new StudioError('NOT_FOUND', 'Unsupported shared Review operation.');
  const { expectedRevision: _revision, idempotencyKey: _key, ...payload } = body;
  if (reviewId) payload.reviewId = reviewId;
  sendJson(response, 200, await studioService.execute(humanCommandDto(projectId, body, type, payload), context, { signal })); return true;
}
