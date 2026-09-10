import { resolveClipRead } from './clip-service.js';
import { invariant } from '../../domain/src/errors.js';
import { requireId, requireInteger, requireRecord, requireString, requireEnum } from '../../domain/src/validation.js';
import { validateAssemblyDefinition } from '../../domain/src/assembly-definition.js';
import { assemblyAssetKey, assemblyContentSlots, resolveAssemblyScene, normalizeAssemblyDeclaration } from '../../domain/src/assembly-geometry.js';
import { fingerprint } from './value-utils.js';

const CONTENT_FIELDS = ['assetId', 'operation', 'expectedAssetVersion', 'expectedMetadataVersion', 'name', 'kind', 'metadata', 'assembly'];
export function exactAssemblyFields(value, fields, label) {
  requireRecord(value, label);
  for (const key of Object.keys(value)) invariant(fields.includes(key), 'VALIDATION_ERROR', `${label} contains unsupported field ${key}.`, { field: `${label}.${key}` });
  invariant(new TextEncoder().encode(JSON.stringify(value)).length <= 256 * 1024, 'ASSEMBLY_TOO_LARGE', 'Assembly requests are limited to 256 KiB.');
}

export function assemblyLeafHistory(document, cutoff = Number.MAX_SAFE_INTEGER, assembly = null) {
  const wanted = assembly ? new Set(assemblyContentSlots(assembly).filter(slot => slot.content.kind !== 'none').map(slot => assemblyAssetKey(slot.content.asset))) : null;
  const assets = new Map();
  for (const revision of document.revisions) {
    if (revision.number > cutoff) continue;
    for (const asset of revision.snapshot.assetLibrary?.assets ?? []) if (!wanted || wanted.has(assemblyAssetKey(asset))) assets.set(assemblyAssetKey(asset), asset);
  }
  for (const revision of document.revisions) {
    if (revision.number > cutoff) continue;
    for (const asset of revision.snapshot.clipLibrary?.assets ?? []) {
      const key = assemblyAssetKey(asset);
      if ((!wanted || wanted.has(key)) && !assets.has(key)) assets.set(key, resolveClipRead(asset, document, Math.min(cutoff, asset.createdRevision)));
    }
  }
  return assets;
}

function validateContent(payload, document, cutoff) {
  const assembly = normalizeAssemblyDeclaration(payload.assembly);
  const validated = validateAssemblyDefinition({
    assetId: requireId(payload.assetId, 'assetId'), name: payload.name, kind: payload.kind,
    metadata: payload.metadata, assembly,
    assets: assemblyLeafHistory(document, cutoff, assembly), projectId: document.projectId,
  });
  const errors = validated.findings.filter(finding => finding.severity === 'ERROR');
  invariant(errors.length === 0, 'ASSEMBLY_INVALID', 'Correct the Assembly technical findings before saving or submitting.', { findings: errors });
  return validated;
}

function expectTarget(payload, snapshot) {
  const assetId = requireId(payload.assetId, 'assetId');
  const operation = requireEnum(payload.operation, 'operation', ['create', 'update']);
  const av = requireInteger(payload.expectedAssetVersion, 'expectedAssetVersion', { min: 0 });
  const mv = requireInteger(payload.expectedMetadataVersion, 'expectedMetadataVersion', { min: 0 });
  const current = snapshot.assemblyLibrary?.assets.find(asset => asset.assetId === assetId) ?? null;
  if (operation === 'create') {
    invariant(av === 0 && mv === 0 && !current, 'ASSEMBLY_VERSION_CONFLICT', 'Create requires an unused Asset ID and versions 0/0.');
    invariant(!(snapshot.assets ?? []).some(asset => (asset.id ?? asset.assetId) === assetId)
      && !(snapshot.assetLibrary?.assets ?? []).some(asset => asset.assetId === assetId)
      && !(snapshot.clipLibrary?.assets ?? []).some(asset => asset.assetId === assetId),
    'ASSEMBLY_ID_CONFLICT', 'This ID already belongs to a leaf Asset; choose a new Assembly ID.', { assetId });
  } else invariant(current && current.assetVersion === av && current.metadataVersion === mv,
    'ASSEMBLY_VERSION_CONFLICT', 'The Assembly changed. Recheck its current Asset and metadata versions.', { assetId, expectedAssetVersion: av, expectedMetadataVersion: mv, actualAssetVersion: current?.assetVersion, actualMetadataVersion: current?.metadataVersion });
  return current;
}

function appendAsset(library, validated, current, command, now, proposal = null) {
  const asset = {
    schemaVersion: 1, contentKind: 'assembly', ...validated,
    assetVersion: (current?.assetVersion ?? 0) + 1,
    metadataVersion: current ? current.metadataVersion + (current.metadataFingerprint === validated.metadataFingerprint ? 0 : 1) : 1,
    lifecycle: 'DRAFT', createdRevision: command.baseRevision + 1, createdAt: now,
    createdBy: command.actor.id, proposal,
  };
  const index = library.assets.findIndex(entry => entry.assetId === asset.assetId);
  if (index < 0) library.assets.push(asset); else library.assets[index] = asset;
  return asset;
}

export function applyAssemblyCommand(command, next, document, now) {
  const payload = command.payload;
  const library = next.assemblyLibrary ??= { schemaVersion: 1, assets: [], proposals: [] };
  let result;
  if (command.type === 'assembly.save') {
    exactAssemblyFields(payload, CONTENT_FIELDS, 'Assembly save');
    const current = expectTarget(payload, next);
    const asset = appendAsset(library, validateContent(payload, document, command.baseRevision), current, command, now);
    result = { assetId: asset.assetId, assetVersion: asset.assetVersion, metadataVersion: asset.metadataVersion, lifecycle: asset.lifecycle };
  } else if (command.type === 'assembly.proposal.submit') {
    exactAssemblyFields(payload, [...CONTENT_FIELDS, 'proposalId', 'expectedProposalVersion'], 'Assembly proposal');
    const proposalId = requireId(payload.proposalId, 'proposalId');
    const expected = requireInteger(payload.expectedProposalVersion, 'expectedProposalVersion', { min: 0 });
    const previous = library.proposals.find(proposal => proposal.proposalId === proposalId);
    invariant((!previous && expected === 0) || (previous?.proposalVersion === expected && previous.status === 'CHANGES_REQUESTED'),
      'ASSEMBLY_PROPOSAL_CONFLICT', 'Only a new proposal or the exact changes-requested version can be submitted.');
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
    exactAssemblyFields(payload, ['proposalId', 'expectedProposalVersion', 'decision', 'feedback', 'confirmed'], 'Assembly resolution');
    invariant(payload.confirmed === true, 'FORBIDDEN', 'Assembly resolution requires explicit owner confirmation.');
    const proposalId = requireId(payload.proposalId, 'proposalId');
    const expected = requireInteger(payload.expectedProposalVersion, 'expectedProposalVersion', { min: 1 });
    const index = library.proposals.findIndex(entry => entry.proposalId === proposalId);
    const prior = library.proposals[index];
    invariant(prior && prior.proposalVersion === expected && prior.status === 'PENDING', 'ASSEMBLY_PROPOSAL_CONFLICT', 'Resolve the exact pending Assembly proposal version.');
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
  return { snapshot: next, result, summary: `Assembly ${command.type === 'assembly.save' ? 'saved' : result.status.toLowerCase()}.`,
    changes: [{ entityType: 'assembly', entityId: result.assetId ?? result.proposalId, operation: command.type === 'assembly.save' ? 'versioned' : 'updated' }] };
}

export function resolveAssemblyRead(record, document, selection = undefined, cutoff = Number.MAX_SAFE_INTEGER) {
  const available = assemblyLeafHistory(document, cutoff, record.assembly);
  const pins = assemblyContentSlots(record.assembly).filter(slot => slot.content.kind !== 'none').map(slot => slot.content.asset);
  const leafAssets = [...new Set(pins.map(assemblyAssetKey))].map(key => {
    const asset = available.get(key);
    invariant(asset, 'ASSEMBLY_COMPONENT_NOT_FOUND', 'An exact component Asset version is unavailable.', { key });
    return structuredClone(asset);
  });
  const scene = resolveAssemblyScene({ assembly: record.assembly, assets: leafAssets, projectId: document.projectId, selection });
  for (const element of scene.elements) {
    for (const frame of element.contentKind === 'animation' ? element.clip.frames : [element]) frame.previewUrl = `/api/projects/${encodeURIComponent(document.projectId)}/artifacts/sha256/${frame.artifact.digest}`;
  }
  const result = { ...structuredClone(record), leafAssets, scene };
  if (record.assembly.schemaVersion === 2) invariant(new TextEncoder().encode(JSON.stringify(result)).byteLength <= 16 * 1024 * 1024, 'ASSEMBLY_RESPONSE_LIMIT', 'This resolved Assembly exceeds the 16 MiB response bound. Reduce its referenced content.');
  return result;
}

export function queryAssemblyDocument(request, document) {
  exactAssemblyFields(request, ['schemaVersion', 'projectId', 'assetId', 'assetVersion', 'proposalId', 'limit', 'resolveDraft', 'selection', 'expectedRevision'], 'Assembly query');
  invariant(request.schemaVersion === 1, 'SCHEMA_VERSION_UNSUPPORTED', 'Assembly reads require schemaVersion 1.');
  const head = document.revisions.at(-1);
  if (request.selection !== undefined) {
    exactAssemblyFields(request.selection, ['stateId', 'variantId'], 'Assembly preview selection');
    for (const key of ['stateId', 'variantId']) if (request.selection[key] !== undefined) requireId(request.selection[key], `selection.${key}`);
  }
  if (request.expectedRevision !== undefined) invariant(request.expectedRevision === head.number, 'REVISION_CONFLICT', 'Recheck the current project before resolving the draft.');
  if (request.resolveDraft) {
    exactAssemblyFields(request.resolveDraft, ['assetId', 'name', 'kind', 'metadata', 'assembly'], 'Assembly draft');
    const validated = validateContent(request.resolveDraft, document, head.number);
    return { schemaVersion: 1, projectId: document.projectId, revision: head.number, draft: resolveAssemblyRead(validated, document, request.selection) };
  }
  const limit = request.limit === undefined ? 100 : requireInteger(request.limit, 'limit', { min: 1, max: 100 });
  const assetId = request.assetId === undefined ? null : requireId(request.assetId, 'assetId');
  const proposalId = request.proposalId === undefined ? null : requireId(request.proposalId, 'proposalId');
  let assets = head.snapshot.assemblyLibrary?.assets ?? [];
  if (request.assetVersion !== undefined) {
    invariant(assetId, 'VALIDATION_ERROR', 'Historical reads require assetId.');
    const version = requireInteger(request.assetVersion, 'assetVersion', { min: 1 });
    assets = document.revisions.flatMap(revision => revision.snapshot.assemblyLibrary?.assets ?? []).filter(asset => asset.assetId === assetId && asset.assetVersion === version);
    assets = assets.slice(0, 1);
  }
  assets = assets.filter(asset => !assetId || asset.assetId === assetId).sort((a, b) => a.name.localeCompare(b.name) || a.assetId.localeCompare(b.assetId)).slice(0, limit);
  invariant(!assetId || assets.length === 1, 'ASSEMBLY_NOT_FOUND', 'The requested Assembly version does not exist.');
  return { schemaVersion: 1, projectId: document.projectId, revision: head.number,
    assets: assets.map(asset => assetId ? resolveAssemblyRead(asset, document, request.selection, asset.createdRevision) : structuredClone(asset)),
    proposals: structuredClone((head.snapshot.assemblyLibrary?.proposals ?? []).filter(proposal => !proposalId || proposal.proposalId === proposalId).slice(0, limit)) };
}

export function assemblyRecordFingerprint(record) { return fingerprint(record); }
