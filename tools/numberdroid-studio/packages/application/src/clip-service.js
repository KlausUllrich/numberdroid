import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger, requireRecord, requireString, requireEnum } from '../../domain/src/validation.js';
import { normalizeClipDeclaration } from '../../domain/src/clip-normalization.js';
import { validateClipDefinition } from '../../domain/src/clip-definition.js';
import { clipSliceHistory } from './exact-cut-history.js';
import { fingerprint } from './value-utils.js';

const CONTENT_FIELDS = ['assetId', 'operation', 'expectedAssetVersion', 'expectedMetadataVersion', 'name', 'kind', 'metadata', 'clip'];
export function exactClipFields(value, fields, label) {
  requireRecord(value, label);
  for (const key of Object.keys(value)) invariant(fields.includes(key), 'VALIDATION_ERROR', `${label} contains unsupported field ${key}.`, { field: `${label}.${key}` });
  invariant(new TextEncoder().encode(JSON.stringify(value)).length <= 256 * 1024, 'CLIP_TOO_LARGE', 'Clip requests are limited to 256 KiB.');
}


function validateContent(payload, document, cutoff) {
  const clip = normalizeClipDeclaration(payload.clip);
  const validated = validateClipDefinition({
    assetId: requireId(payload.assetId, 'assetId'), name: payload.name, kind: payload.kind,
    metadata: payload.metadata, clip,
    slices: clipSliceHistory(document, clip, cutoff), projectId: document.projectId,
  });
  const errors = validated.findings.filter(finding => finding.severity === 'ERROR');
  invariant(errors.length === 0, 'CLIP_INVALID', 'Correct the Clip technical findings before saving or submitting.', { findings: errors });
  return validated;
}

function expectTarget(payload, snapshot) {
  const assetId = requireId(payload.assetId, 'assetId');
  const operation = requireEnum(payload.operation, 'operation', ['create', 'update']);
  const av = requireInteger(payload.expectedAssetVersion, 'expectedAssetVersion', { min: 0 });
  const mv = requireInteger(payload.expectedMetadataVersion, 'expectedMetadataVersion', { min: 0 });
  const current = snapshot.clipLibrary?.assets.find(asset => asset.assetId === assetId) ?? null;
  if (operation === 'create') {
    invariant(av === 0 && mv === 0 && !current, 'CLIP_VERSION_CONFLICT', 'Create requires an unused Asset ID and versions 0/0.');
    invariant(!(snapshot.assets ?? []).some(asset => (asset.id ?? asset.assetId) === assetId)
      && !(snapshot.assetLibrary?.assets ?? []).some(asset => asset.assetId === assetId)
      && !(snapshot.assemblyLibrary?.assets ?? []).some(asset => asset.assetId === assetId),
    'CLIP_ID_CONFLICT', 'This ID already belongs to another Asset; choose a new Clip ID.', { assetId });
  } else invariant(current && current.assetVersion === av && current.metadataVersion === mv,
    'CLIP_VERSION_CONFLICT', 'The Clip changed. Recheck its current Asset and metadata versions.', { assetId, expectedAssetVersion: av, expectedMetadataVersion: mv, actualAssetVersion: current?.assetVersion, actualMetadataVersion: current?.metadataVersion });
  return current;
}

function appendAsset(library, validated, current, command, now, proposal = null) {
  const asset = {
    schemaVersion: 1, contentKind: 'animation', ...validated,
    assetVersion: (current?.assetVersion ?? 0) + 1,
    metadataVersion: current ? current.metadataVersion + (current.metadataFingerprint === validated.metadataFingerprint ? 0 : 1) : 1,
    lifecycle: 'DRAFT', createdRevision: command.baseRevision + 1, createdAt: now,
    createdBy: command.actor.id, proposal,
  };
  const index = library.assets.findIndex(entry => entry.assetId === asset.assetId);
  if (index < 0) library.assets.push(asset); else library.assets[index] = asset;
  return asset;
}

export function applyClipCommand(command, next, document, now) {
  const payload = command.payload;
  const library = next.clipLibrary ??= { schemaVersion: 1, assets: [], proposals: [] };
  let result;
  if (command.type === 'clip.save') {
    exactClipFields(payload, CONTENT_FIELDS, 'Clip save');
    const current = expectTarget(payload, next);
    const asset = appendAsset(library, validateContent(payload, document, command.baseRevision), current, command, now);
    result = { assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion, lifecycle: asset.lifecycle };
  } else if (command.type === 'clip.proposal.submit') {
    exactClipFields(payload, [...CONTENT_FIELDS, 'proposalId', 'expectedProposalVersion'], 'Clip proposal');
    const proposalId = requireId(payload.proposalId, 'proposalId');
    const expected = requireInteger(payload.expectedProposalVersion, 'expectedProposalVersion', { min: 0 });
    const previous = library.proposals.find(proposal => proposal.proposalId === proposalId);
    invariant((!previous && expected === 0) || (previous?.proposalVersion === expected && previous.status === 'CHANGES_REQUESTED'),
      'CLIP_PROPOSAL_CONFLICT', 'Only a new proposal or the exact changes-requested version can be submitted.');
    invariant(!previous || (previous.proposerActorId === command.actor.id && previous.proposerTaskId === command.taskId),
      'FORBIDDEN', 'Only the proposing agent and task may revise this proposal.');
    expectTarget(payload, next);
    const validated = validateContent(payload, document, command.baseRevision);
    const proposal = {
      schemaVersion: 1, proposalId, proposalVersion: expected + 1, status: 'PENDING',
      content: Object.fromEntries(CONTENT_FIELDS.map(key => [key, structuredClone(Object.hasOwn(validated, key) ? validated[key] : payload[key])])),
      validated, proposerActorId: command.actor.id, proposerActorKind: command.actor.kind,
      proposerTaskId: command.taskId, createdRevision: command.baseRevision + 1,
      createdAt: now, updatedBy: command.actor.id, feedback: previous?.feedback ?? null,
      previousProposalVersion: previous?.proposalVersion ?? null, decision: null,
    };
    const index = library.proposals.findIndex(entry => entry.proposalId === proposalId);
    if (index < 0) library.proposals.push(proposal); else library.proposals[index] = proposal;
    result = { proposalId, proposalVersion: proposal.proposalVersion, status: proposal.status };
  } else {
    exactClipFields(payload, ['proposalId', 'expectedProposalVersion', 'decision', 'feedback', 'confirmed'], 'Clip resolution');
    invariant(payload.confirmed === true, 'FORBIDDEN', 'Clip resolution requires explicit owner confirmation.');
    const proposalId = requireId(payload.proposalId, 'proposalId');
    const expected = requireInteger(payload.expectedProposalVersion, 'expectedProposalVersion', { min: 1 });
    const index = library.proposals.findIndex(entry => entry.proposalId === proposalId);
    const prior = library.proposals[index];
    invariant(prior && prior.proposalVersion === expected && prior.status === 'PENDING', 'CLIP_PROPOSAL_CONFLICT', 'Resolve the exact pending Clip proposal version.');
    const decision = requireEnum(payload.decision, 'decision', ['ACCEPT', 'REQUEST_CHANGES', 'DISCARD']);
    const feedback = payload.feedback === undefined || payload.feedback === null ? null : requireString(payload.feedback, 'feedback', { max: 2000 });
    invariant(decision !== 'REQUEST_CHANGES' || feedback?.trim(), 'VALIDATION_ERROR', 'Request changes requires nonblank feedback.', { field: 'feedback' });
    const proposal = { ...prior, proposalVersion: expected + 1, previousProposalVersion: expected,
      status: { ACCEPT: 'ACCEPTED', REQUEST_CHANGES: 'CHANGES_REQUESTED', DISCARD: 'DISCARDED' }[decision],
      decision, feedback, createdRevision: command.baseRevision + 1, createdAt: now, updatedBy: command.actor.id };
    library.proposals[index] = proposal;
    result = { proposalId, proposalVersion: proposal.proposalVersion, status: proposal.status };
    if (decision === 'ACCEPT') {
      const current = expectTarget(prior.content, next);
      const validated = validateContent(prior.content, document, command.baseRevision);
      const asset = appendAsset(library, validated, current, command, now, { proposalId, proposalVersion: proposal.proposalVersion });
      result = { ...result, assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion };
    }
  }
  return { snapshot: next, result, summary: `Clip ${command.type === 'clip.save' ? 'saved' : result.status.toLowerCase()}.`,
    changes: [{ entityType: 'clip', entityId: result.assetId ?? result.proposalId, operation: command.type === 'clip.save' ? 'versioned' : 'updated' }] };
}

export function resolveClipRead(record, document, cutoff = Number.MAX_SAFE_INTEGER) {
  const slices=clipSliceHistory(document,record.clip,cutoff);
  const resolved={...structuredClone(record),frameBindings:record.clip.frames.map(frame=>({frameId:frame.frameId,sliceBinding:structuredClone(slices.get(`${frame.slice.sliceId}@${frame.slice.sliceVersion}`))}))};
  invariant(new TextEncoder().encode(JSON.stringify(resolved)).length<=4*1024*1024,'CLIP_TOO_LARGE','Resolved clip exceeds the 4 MiB response limit.');return resolved;
}

export function queryClipDocument(request, document) {
  exactClipFields(request, ['schemaVersion', 'projectId', 'assetId', 'assetVersion', 'proposalId', 'limit', 'resolveDraft', 'expectedRevision'], 'Clip query');
  invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Clip reads require schemaVersion 1.');
  const head = document.revisions.at(-1);
  if (request.expectedRevision !== undefined) invariant(request.expectedRevision === head.number, 'REVISION_CONFLICT', 'Recheck the current project before resolving the draft.');
  if (request.resolveDraft) {
    exactClipFields(request.resolveDraft, ['assetId', 'name', 'kind', 'metadata', 'clip'], 'Clip draft');
    const validated = validateContent(request.resolveDraft, document, head.number);
    return { schemaVersion: 1, projectId: document.projectId, revision: head.number, draft: resolveClipRead(validated, document) };
  }
  const limit = request.limit === undefined ? 100 : requireInteger(request.limit, 'limit', { min: 1, max: 100 });
  const assetId = request.assetId === undefined ? null : requireId(request.assetId, 'assetId');
  const proposalId = request.proposalId === undefined ? null : requireId(request.proposalId, 'proposalId');
  const proposals = (head.snapshot.clipLibrary?.proposals ?? []).filter(proposal => (!proposalId || proposal.proposalId === proposalId) && (!assetId || proposal.content.assetId === assetId)).slice(0, limit);
  let assets = (head.snapshot.clipLibrary?.assets ?? []).filter(asset => !proposalId || proposals.some(proposal => proposal.content.assetId === asset.assetId));
  if (request.assetVersion !== undefined) {
    invariant(assetId, 'VALIDATION_ERROR', 'Historical reads require assetId.');
    const version = requireInteger(request.assetVersion, 'assetVersion', { min: 1 });
    assets = document.revisions.flatMap(revision => revision.snapshot.clipLibrary?.assets ?? []).filter(asset => asset.assetId === assetId && asset.assetVersion === version);
    assets = assets.slice(0, 1);
  }
  assets = assets.filter(asset => !assetId || asset.assetId === assetId).sort((a, b) => a.name.localeCompare(b.name) || a.assetId.localeCompare(b.assetId)).slice(0, limit);
  invariant(!assetId || assets.length === 1, 'CLIP_NOT_FOUND', 'The requested Clip version does not exist.');
  const response = { schemaVersion: 1, projectId: document.projectId, revision: head.number,
    assets: assets.map(asset => assetId ? resolveClipRead(asset, document, asset.createdRevision) : structuredClone(asset)),
    proposals: structuredClone(proposals) };
  invariant(Buffer.byteLength(JSON.stringify(response)) <= 4 * 1024 * 1024, 'CLIP_RESPONSE_TOO_LARGE', 'The Animation result exceeds 4 MiB. Query one exact assetId or proposalId, or use a smaller limit.');
  return response;
}

export function clipRecordFingerprint(record) { return fingerprint(record); }
